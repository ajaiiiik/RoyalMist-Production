// ================================================================
// controller/admin/orderController.js
// ================================================================

const Order   = require("../../model/orderSchema");
const Product = require("../../model/productSchema");
const Wallet  = require("../../model/walletSchema");

const ORDERS_PER_PAGE = 10;

// ── GET /admin/orders ────────────────────────────────────────────
const getOrdersController = async (req, res) => {
  try {
    const page    = parseInt(req.query.page) || 1;
    const search  = req.query.search  || "";
    const status  = req.query.status  || "";
    const sort    = req.query.sort    || "newest";
    const payment = req.query.payment || "";

    const query = {};
    if (status)  query.orderStatus   = status;
    if (payment) query.paymentMethod = payment;
    if (search)  query.$or = [{ orderId: { $regex: search, $options: "i" } }];

    const sortMap = {
      newest:  { createdAt: -1 },
      oldest:  { createdAt:  1 },
      highest: { grandTotal: -1 },
      lowest:  { grandTotal:  1 },
    };

    const total  = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .populate("user", "firstName lastName email")
      .sort(sortMap[sort] || { createdAt: -1 })
      .skip((page - 1) * ORDERS_PER_PAGE)
      .limit(ORDERS_PER_PAGE)
      .lean();

    const [totalCount, pendingCount, shippedCount, deliveredCount, cancelledCount, returnCount] =
      await Promise.all([
        Order.countDocuments({}),
        Order.countDocuments({ orderStatus: "Pending" }),
        Order.countDocuments({ orderStatus: { $in: ["Shipped", "Processing"] } }),
        Order.countDocuments({ orderStatus: "Delivered" }),
        Order.countDocuments({ orderStatus: "Cancelled" }),
        Order.countDocuments({ orderStatus: "Return Requested" }),
      ]);

    res.render("admin/orders", {
      orders,
      currentPage: page,
      totalPages:  Math.ceil(total / ORDERS_PER_PAGE),
      total,
      filters: { search, status, sort, payment },
      stats: { totalCount, pendingCount, shippedCount, deliveredCount, cancelledCount, returnCount },
    });
  } catch (err) {
    console.error("Admin get orders error:", err);
    res.status(500).send("Server error");
  }
};

// ── GET /admin/orders/:id ────────────────────────────────────────
const getOrderDetailController = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("user", "firstName lastName email phoneNumber")
      .lean();
    if (!order) return res.redirect("/admin/orders");
    res.render("admin/orderDetail", { order });
  } catch (err) {
    console.error("Admin order detail error:", err);
    res.redirect("/admin/orders");
  }
};

// ── PATCH /admin/orders/:id/status ──────────────────────────────
const updateOrderStatusController = async (req, res) => {
  try {
    const { status, reason } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) return res.json({ success: false, message: "Order not found" });

    if (order.orderStatus === "Cancelled")
      return res.json({ success: false, message: "Cannot update a cancelled order" });

    // ── Forward-only flow ────────────────────────────────────────
    const flow = ["Pending", "Processing", "Shipped", "Delivered"];
    const currentIdx = flow.indexOf(order.orderStatus);
    const newIdx     = flow.indexOf(status);

    // Allow cancel from any non-cancelled, non-delivered state
    if (status === "Cancelled") {
      if (order.orderStatus === "Delivered")
        return res.json({ success: false, message: "Cannot cancel a delivered order" });
    } else {
      // Must be forward move only
      if (newIdx === -1)
        return res.json({ success: false, message: "Invalid status" });
      if (newIdx <= currentIdx)
        return res.json({ success: false, message: `Cannot move back from "${order.orderStatus}" to "${status}"` });
    }

    const prevStatus  = order.orderStatus;
    order.orderStatus = status;

    // Delivered → mark paid for COD
    if (status === "Delivered") {
      order.deliveredAt = new Date();
      if (order.paymentMethod === "COD") order.paymentStatus = "Paid";

      const User = require("../../model/userSchema");
      const orderUser = await User.findById(order.user);

      const needsReward = orderUser && orderUser.referredBy && orderUser.referralRewardGiven !== true;

      if (needsReward) {
        const deliveredCount = await Order.countDocuments({ user: order.user, orderStatus: "Delivered" });

        if (deliveredCount === 1) {
          let userWallet = await Wallet.findOne({ user: orderUser._id });
          if (userWallet === null) userWallet = await Wallet.create({ user: orderUser._id, balance: 0, transactions: [] });
          userWallet.balance += 100;
          userWallet.transactions.push({ type: "credit", amount: 100, description: "Referral signup bonus", orderId: order._id });
          await userWallet.save();

          let referrerWallet = await Wallet.findOne({ user: orderUser.referredBy });
          if (referrerWallet === null) referrerWallet = await Wallet.create({ user: orderUser.referredBy, balance: 0, transactions: [] });
          referrerWallet.balance += 500;
          referrerWallet.transactions.push({ type: "credit", amount: 500, description: "Referral reward", orderId: order._id });
          await referrerWallet.save();

          orderUser.referralRewardGiven = true;
          await orderUser.save();
        }
      }
    }

    // Cancelled → restore stock + refund
    if (status === "Cancelled") {
      order.cancelledAt  = new Date();
      order.cancelReason = reason || "Cancelled by admin";

      // Restore per-variant stock
      for (const item of order.items) {
        await Product.findOneAndUpdate(
          { _id: item.product, "volumes.size": item.size },
          { $inc: { "volumes.$.stock": item.quantity } }
        );
      }

      // Refund if paid
      if (order.paymentStatus === "Paid") {
        let wallet = await Wallet.findOne({ user: order.user });
        if (!wallet) wallet = new Wallet({ user: order.user, balance: 0, transactions: [] });
        wallet.balance += order.grandTotal;
        wallet.transactions.push({
          type:        "credit",
          amount:      order.grandTotal,
          description: `Admin cancellation refund — ${order.orderId}`,
        });
        await wallet.save();
        order.paymentStatus = "Refunded";
      }
    }

    await order.save();
    res.json({ success: true, newStatus: order.orderStatus, message: `Order updated to ${status}` });

  } catch (err) {
    console.error("Update order status error:", err);
    res.json({ success: false, message: "Server error" });
  }
};

// ── PATCH /admin/orders/:id/approve-return ───────────────────────
const approveReturnController = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.json({ success: false, message: "Order not found" });
    if (order.orderStatus !== "Return Requested")
      return res.json({ success: false, message: "No return request pending" });

    // Mark all return_requested items as returned
    for (const item of order.items) {
      if (item.itemStatus === "return_requested") {
        item.itemStatus   = "returned";
        item.refundAmount = item.price * item.quantity;

        // ← Fix: restore per-variant stock
        await Product.findOneAndUpdate(
          { _id: item.product, "volumes.size": item.size },
          { $inc: { "volumes.$.stock": item.quantity } }
        );
      }
    }

    // Refund total of returned items to wallet
    const refundTotal = order.items
      .filter(i => i.itemStatus === "returned")
      .reduce((sum, i) => sum + i.refundAmount, 0);

    let wallet = await Wallet.findOne({ user: order.user });
    if (!wallet) wallet = new Wallet({ user: order.user, balance: 0, transactions: [] });
    wallet.balance += refundTotal;
    wallet.transactions.push({
      type:        "credit",
      amount:      refundTotal,
      description: `Return approved - Order #${order.orderId}`,
    });
    await wallet.save();

    order.orderStatus   = "Cancelled";
    order.returnStatus  = "Approved";
    order.paymentStatus = "Refunded";
    await order.save();

    res.json({ success: true, message: `Return approved. ₹${refundTotal.toLocaleString("en-IN")} refunded to wallet.` });
  } catch (err) {
    console.error("Approve return error:", err);
    res.json({ success: false, message: "Server error" });
  }
};

// ── PATCH /admin/orders/:id/reject-return ───────────────────────
const rejectReturnController = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.json({ success: false, message: "Order not found" });
    if (order.orderStatus !== "Return Requested")
      return res.json({ success: false, message: "No return request pending" });

    // Reset return_requested items back to active
    order.items.forEach(item => {
      if (item.itemStatus === "return_requested") {
        item.itemStatus  = "active";
        item.returnReason = "";
      }
    });

    order.returnStatus    = "Rejected";
    order.orderStatus     = "Delivered";
    order.returnRequested = false;
    await order.save();

    res.json({ success: true, message: "Return rejected. Order restored to Delivered." });
  } catch (err) {
    console.error("Reject return error:", err);
    res.json({ success: false, message: "Server error" });
  }
};

// ── PATCH /admin/orders/:id/item/:itemId/status ─────────────────
const updateItemStatusController = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["active", "cancelled", "return_requested", "returned"];
    if (!allowed.includes(status))
      return res.json({ success: false, message: "Invalid status" });

    const order = await Order.findById(req.params.id);
    if (!order) return res.json({ success: false, message: "Order not found" });

    const item = order.items.id(req.params.itemId);
    if (!item) return res.json({ success: false, message: "Item not found" });

    // ← ADD THIS CHECK
    if (item.itemStatus === "cancelled")
      return res.json({ success: false, message: "Cancelled item cannot be updated" });

    item.itemStatus = status;
    await order.save();

    res.json({ success: true, message: "Item status updated" });
  } catch (err) {
    console.error("Update item status error:", err);
    res.json({ success: false, message: "Server error" });
  }
};

module.exports = {
  getOrdersController,
  getOrderDetailController,
  updateOrderStatusController,
  approveReturnController,
  rejectReturnController,
  updateItemStatusController,
};
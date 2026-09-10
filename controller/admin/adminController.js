
const User = require("../../model/userSchema");
const { adminSigninService } = require("../../services/admin/adminService");

const adminSigninController = async (req, res) => {
  try {
    const result = await adminSigninService(req.body, req);
    return res.json({
      success: true,
      message: result.message
    });
  } catch (err) {
    console.error("Admin signin error:", err);
    return res.status(400).json({ 
        success: false,
         message: err
        });
  }
};

const PAGE_SIZE = 5;

const getCustomersController = async (req, res) => {
  try {
    const page   = parseInt(req.query.page) || 1;
    const search = req.query.search || "";
    const query  = { role: { $ne: "admin" } };

    if (search.trim()) {
      query.$or = [
        { firstName: { $regex: search.trim(), $options: "i" } },
        { lastName:  { $regex: search.trim(), $options: "i" } },
        { email:     { $regex: search.trim(), $options: "i" } },
      ];
    }

    const total      = await User.countDocuments(query);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage   = Math.min(Math.max(1, page), totalPages);

    const customers = await User.find(query)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .select("firstName lastName email isBlocked createdAt");

    res.render("admin/customers", {
      customers,
      currentPage:  safePage,
      totalPages,
      total,
      search,
      pageSize: PAGE_SIZE,
    });
  } catch (err) {
    console.error("getCustomersController error:", err);
    res.status(500).send("Server error");
  }
};

const blockUserController = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBlocked: true },
      { new: true }
    );
    if (!user) return res.json({ success: false, message: "User not found" });
    res.json({ success: true, message: `${user.firstName} has been blocked` });
  } catch (err) {
    console.error("blockUserController error:", err);
    res.json({ success: false, message: "Something went wrong" });
  }
};

const unblockUserController = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBlocked: false },
      { new: true }
    );
    if (!user) return res.json({ success: false, message: "User not found" });
    res.json({ success: true, message: `${user.firstName} has been unblocked` });
  } catch (err) {
    console.error("unblockUserController error:", err);
    res.json({ success: false, message: "Something went wrong" });
  }
};


const getDashboardController = async (req, res) => {
  try {
    const Order   = require("../../model/orderSchema");
    const now     = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalCustomers,
      totalOrders,
      monthlyOrders,
      allOrders,
    ] = await Promise.all([
      User.countDocuments({ role: { $ne: "admin" } }),
      Order.countDocuments({}),
      Order.find({ createdAt: { $gte: firstOfMonth }, orderStatus: { $nin: ["Cancelled"] } }).lean(),
      Order.find({ orderStatus: { $nin: ["Cancelled"] } }).lean(),
    ]);

    const totalRevenue    = allOrders.reduce((s, o) => s + o.grandTotal, 0);
    const monthlyRevenue  = monthlyOrders.reduce((s, o) => s + o.grandTotal, 0);

    const [delivered, pending, shipped, cancelled] = await Promise.all([
      Order.countDocuments({ orderStatus: "Delivered" }),
      Order.countDocuments({ orderStatus: "Pending" }),
      Order.countDocuments({ orderStatus: { $in: ["Shipped", "Processing"] } }),
      Order.countDocuments({ orderStatus: "Cancelled" }),
    ]);

    const weekLabels = [];
    const weekData = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i + 1);
      const dayOrders = await Order.find({ createdAt: { $gte: dayStart, $lt: dayEnd }, orderStatus: { $nin: ["Cancelled"] } }).lean();
      const dayRevenue = dayOrders.reduce((s, o) => s + o.grandTotal, 0);
      weekLabels.push(dayStart.toLocaleDateString("en-US", { weekday: "short" }));
      weekData.push(dayRevenue);
    }

    const monthLabels = [];
    const monthData = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const weekOrders = await Order.find({ createdAt: { $gte: weekStart, $lt: weekEnd }, orderStatus: { $nin: ["Cancelled"] } }).lean();
      const weekRevenue = weekOrders.reduce((s, o) => s + o.grandTotal, 0);
      monthLabels.push("Week " + (4 - i));
      monthData.push(weekRevenue);
    }

    const yearLabels = [];
    const yearData = [];
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const monthOrders = await Order.find({ createdAt: { $gte: monthStart, $lt: monthEnd }, orderStatus: { $nin: ["Cancelled"] } }).lean();
      const monthRevenue = monthOrders.reduce((s, o) => s + o.grandTotal, 0);
      yearLabels.push(monthStart.toLocaleDateString("en-US", { month: "short" }));
      yearData.push(monthRevenue);
    }

    res.render("admin/dashboard", {
      totalCustomers,
      totalOrders,
      totalRevenue,
      monthlyRevenue,
      delivered,
      pending,
      shipped,
      cancelled,
      chartDataJson: JSON.stringify({
        week: { labels: weekLabels, data: weekData },
        month: { labels: monthLabels, data: monthData },
        year: { labels: yearLabels, data: yearData },
      }),
    });
  } catch (err) {
    console.error("getDashboardController error:", err);
    res.status(500).send("Server error");
  }
};
module.exports = { 
  adminSigninController,
    getDashboardController, 
  getCustomersController,
  blockUserController,
  unblockUserController
};
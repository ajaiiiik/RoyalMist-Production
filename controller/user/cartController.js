// ================================================================
// controller/user/cartController.js — UPDATED
// d.iv: Remove from wishlist when added to cart ← NEW
// ================================================================

const Cart     = require("../../model/cartSchema");
const Product  = require("../../model/productSchema");
const Wishlist = require("../../model/wishlistSchema"); // ← NEW
const { getEffectivePrice } = require("../../utils/offerHelper");

const MAX_QUANTITY = 5;

// ── GET /cart ────────────────────────────────────────────────────
const getCartController = async (req, res) => {
  try {
    const user = req.session.user || null;

    if (!user) {
      return res.render("user/cart", {
        user: null, cartItems: [], totalAmount: 0, totalItems: 0,
      });
    }

    const userId = user.id;

    const cart = await Cart.findOne({ user: userId })
      .populate({
        path: "items.product",
        select: "name images volumes  isActive isDeleted fragranceType category",
        populate: { path: "category", select: "name" },
      });

    if (!cart || cart.items.length === 0) {
      return res.render("user/cart", {
        user, cartItems: [], totalAmount: 0, totalItems: 0,
      });
    }
    
    const validItems = cart.items.filter(
      item => item.product && item.product.isActive && !item.product.isDeleted
    );

    if (validItems.length !== cart.items.length) {
      cart.items = validItems;
      await cart.save();
    }

    const totalAmount = validItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const totalItems  = validItems.reduce((sum, item) => sum + item.quantity, 0);

    res.render("user/cart", { user, cartItems: validItems, totalAmount, totalItems });

  } catch (err) {
    console.error("Get cart error:", err);
    res.status(500).send("Server error");
  }
};

// ── POST /cart/add ───────────────────────────────────────────────
const addToCartController = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { productId, size, quantity = 1 } = req.body; // ← price removed from destructure

    // 1. Validate product — populate category to check category-level offer too
    const product = await Product.findOne({
      _id: productId, isActive: true, isDeleted: false,
    }).populate({ path: "category", select: "name offer" });
    if (!product) return res.json({ success: false, message: "Product not available" });

    // 2. Validate size and stock
    const selectedVolume = product.volumes.find(v => v.size === size);
    if (!selectedVolume) return res.json({ success: false, message: "Invalid size selected" });
    if (selectedVolume.stock === 0) return res.json({ success: false, message: "This size is out of stock" });

    // 3. Calculate REAL price server-side — never trust client price ← NEW
    const categoryOffer = product.category?.offer;
    const offerInfo = getEffectivePrice(product, categoryOffer);
    const finalPrice = offerInfo.hasOffer
      ? Math.max(0, selectedVolume.price - offerInfo.discount)
      : selectedVolume.price;

    // 3. Find or create cart
    let cart = await Cart.findOne({ user: userId });
    if (!cart) cart = new Cart({ user: userId, items: [] });

    // 4. Check if already in cart
    const existingIndex = cart.items.findIndex(
      item => item.product.toString() === productId && item.size === size
    );
if (existingIndex > -1) {
  // Product + size already in cart — don't touch quantity, just inform user
  return res.json({ success: false, message: "This item is already in your cart" });
}else {
  if (Number(quantity) > MAX_QUANTITY) {
    return res.json({ success: false, message: `Maximum ${MAX_QUANTITY} items allowed per product` });
  }
  if (Number(quantity) > selectedVolume.stock) {
    return res.json({ success: false, message: `Only ${selectedVolume.stock} units available` });
  }
  cart.items.push({ product: productId, quantity: Number(quantity), size, price: finalPrice }); // ← finalPrice
}

    await cart.save();

    // ── d.iv: Remove from wishlist if product is there ────────────
    try {
      const wishlist = await Wishlist.findOne({ user: userId });
      if (wishlist) {
        const inWishlist = wishlist.items.some(
          item => item.product.toString() === productId
        );
        if (inWishlist) {
          wishlist.items = wishlist.items.filter(
            item => item.product.toString() !== productId
          );
          await wishlist.save();
        }
      }
    } catch (wishlistErr) {
      // Wishlist error — cart added, even wishlist remove fail its ok
      console.error("Wishlist remove error:", wishlistErr);
    }

    const totalItems = cart.items.reduce((sum, i) => sum + i.quantity, 0);

    return res.json({ success: true, message: "Added to cart", totalItems });

  } catch (err) {
    console.error("Add to cart error:", err);
    res.json({ success: false, message: "Server error" });
  }
};

// ── POST /cart/update ────────────────────────────────────────────
const updateCartController = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { productId, size, action } = req.body;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.json({ success: false, message: "Cart not found" });

    const itemIndex = cart.items.findIndex(
      item => item.product.toString() === productId && item.size === size
    );
    if (itemIndex === -1) return res.json({ success: false, message: "Item not in cart" });

   

if (action === "increment") {
  const product = await Product.findById(productId);
  if (!product) return res.json({ success: false, message: "Product not found" });
  if (cart.items[itemIndex].quantity >= MAX_QUANTITY) {
    return res.json({ success: false, message: `Maximum ${MAX_QUANTITY} items allowed` });
  }
  // ← Check volume specific stock
  const vol = product.volumes?.find(v => v.size === size);
  const volStock = vol ? vol.stock : 0;
  if (cart.items[itemIndex].quantity >= volStock) {
    return res.json({ success: false, message: `Only ${volStock} units available` });
  }
  cart.items[itemIndex].quantity += 1;
}else if (action === "decrement") {
      if (cart.items[itemIndex].quantity <= 1) {
        cart.items.splice(itemIndex, 1);
      } else {
        cart.items[itemIndex].quantity -= 1;
      }
    }

    await cart.save();

    const totalAmount = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const totalItems  = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    const itemTotal   = itemIndex > -1 && cart.items[itemIndex]
      ? cart.items[itemIndex].price * cart.items[itemIndex].quantity
      : 0;

    return res.json({
      success: true,
      quantity:    cart.items[itemIndex]?.quantity || 0,
      itemTotal,
      totalAmount,
      totalItems,
    });

  } catch (err) {
    console.error("Update cart error:", err);
    res.json({ success: false, message: "Server error" });
  }
};

// ── POST /cart/remove ────────────────────────────────────────────
const removeFromCartController = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { productId, size } = req.body;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.json({ success: false, message: "Cart not found" });

    cart.items = cart.items.filter(
      item => !(item.product.toString() === productId && item.size === size)
    );
    await cart.save();

    const totalAmount = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const totalItems  = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    return res.json({ success: true, totalAmount, totalItems });

  } catch (err) {
    console.error("Remove from cart error:", err);
    res.json({ success: false, message: "Server error" });
  }
};

module.exports = {
  getCartController,
  addToCartController,
  updateCartController,
  removeFromCartController,
};

const {
  addToWishlistService,
  removeFromWishlistService,
  getWishlistService,
  moveToCartService,
} = require("../../services/user/wishlistService");

const getWishlistController = async (req, res) => {
  try {
    const user = req.session.user || null;

    if (!user) {
      const guestIds = req.session.guestWishlist || [];
      if (guestIds.length === 0) {
        return res.render("user/wishlist", { user: null, wishlistItems: [], totalItems: 0 });
      }
      const Product = require("../../model/productSchema");
      const products = await Product.find({ _id: { $in: guestIds }, isActive: true, isDeleted: false })
        .select("name images volumes stock isActive isDeleted fragranceType category")
        .populate({ path: "category", select: "name" })
        .lean();
      const wishlistItems = products.map(p => ({ product: p }));
      return res.render("user/wishlist", { user: null, wishlistItems, totalItems: wishlistItems.length });
    }

    const userId = user.id;
    const { items, totalItems } = await getWishlistService(userId);
    res.render("user/wishlist", { user, wishlistItems: items, totalItems });
  } catch (err) {
    console.error("Get wishlist error:", err);
    res.status(500).send("Server error");
  }
};

const addToWishlistController = async (req, res) => {
  try {
    const user = req.session.user || null;
    const { productId } = req.body;
    if (!productId)
      return res.json({ success: false, message: "Product ID required" });

    if (!user) {
      if (!req.session.guestWishlist) req.session.guestWishlist = [];
      if (!req.session.guestWishlist.includes(productId)) {
        req.session.guestWishlist.push(productId);
      }
      return req.session.save(() => {
        res.json({ success: true, message: "Added to wishlist", totalItems: req.session.guestWishlist.length });
      });
    }

    const result = await addToWishlistService(user.id, productId);
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.json({ success: false, message: err.message || "Server error" });
  }
};

const removeFromWishlistController = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { productId } = req.body;
    if (!productId)
      return res.json({ success: false, message: "Product ID required" });
    const result = await removeFromWishlistService(userId, productId);
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.json({ success: false, message: err.message || "Server error" });
  }
};

const moveToCartController = async (req, res) => {
  try {
    const user = req.session.user || null;
    const { productId } = req.body;
    if (!productId)
      return res.json({ success: false, message: "Product ID required" });

    if (!user) {
      const Product = require("../../model/productSchema");
      const product = await Product.findOne({ _id: productId, isActive: true, isDeleted: false });
      if (!product) return res.json({ success: false, message: "Product not available" });

      const size  = product.volumes[0].size;
      const price = product.volumes[0].price;
      const stock = product.volumes[0].stock;
      if (stock === 0) return res.json({ success: false, message: "This variant is out of stock" });

      if (!req.session.guestCart) req.session.guestCart = [];
      const existingIndex = req.session.guestCart.findIndex(
        item => item.productId === productId && item.size === size
      );
      if (existingIndex > -1) {
        return res.json({ success: true, alreadyInCart: true });
      }
      req.session.guestCart.push({ productId, size, quantity: 1, price });

      req.session.guestWishlist = (req.session.guestWishlist || []).filter(id => id !== productId);

      return req.session.save(() => {
        res.json({ success: true, alreadyInCart: false, totalItems: req.session.guestCart.length });
      });
    }

    const userId = user.id;
    const result = await moveToCartService(userId, productId);
    return res.json({
      success: true,
      alreadyInCart: result.alreadyInCart,
      totalItems: result.totalItems,
    });
  } catch (err) {
    return res.json({ success: false, message: err.message || "Server error" });
  }
};

module.exports = {
  getWishlistController,
  addToWishlistController,
  removeFromWishlistController,
  moveToCartController,
};
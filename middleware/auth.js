const User = require("../model/userSchema");
const Cart = require("../model/cartSchema"); // ← NEW

const isAuthenticated = async (req, res, next) => {
  if (!req.isAuthenticated() && !req.session.user) {
    if (req.headers.accept && req.headers.accept.includes("application/json") || req.headers["content-type"] === "application/json") {
      return res.status(401).json({ success: false, message: "Please sign in to continue", redirectTo: "/signin" });
    }
    return res.redirect("/signin");
  }

  try {
    const userId = req.session.user?._id || req.session.user?.id || req.user?._id;

    if (userId) {
      res.locals.cartCount = 0; // ← NEW default

      const user = await User.findById(userId).select("isBlocked");

      if (!user || user.isBlocked) {
        req.session.user = null;
        return req.session.save(() => {
          return res.redirect("/signin?blocked=true");
        });
      }

      // ← NEW: cart count for navbar badge
      const cart = await Cart.findOne({ user: userId });
      res.locals.cartCount = cart
        ? cart.items.reduce((sum, i) => sum + i.quantity, 0)
        : 0;
    }
  } catch (err) {
    console.error("isAuthenticated middleware error:", err);
    return res.redirect("/signin");
  }

  return next();
};

const requireSignupSession = (req, res, next) => {
  if (!req.session.userData) {
    return res.redirect("/signup");
  }
  next();
};

module.exports = { isAuthenticated, requireSignupSession };
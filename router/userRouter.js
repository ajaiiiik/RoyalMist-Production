const express = require("express");
const router = express.Router();
const passport = require("passport")
const multer = require("multer");
const path = require("path");
const { isAuthenticated,requireSignupSession } = require("../middleware/auth");
const Product = require("../model/productSchema");


const {
  signupController,
  signinController,
  verifyOtpController,
  resendOtpController,
  accountController,
  updateProfileImageController,
  removeProfileImageController,
  updateProfileController,
  sendEmailChangeOtpController,
  verifyEmailChangeOtpController,
  addAddressController, 
  saveAddressController,
  deleteAddressController,
getAddressController, 
updateAddressController,
changePasswordController,
forgotPasswordController,
verifyForgotOtpController,
resetPasswordController,
  orderHistoryController,
  cancelOrderController
} = require("../controller/user/userController");

const { getShopController,getProductDetailsController } = require("../controller/user/shopController");
const { contactUsController } = require("../controller/user/contactController");


const {
  getCartController,
  addToCartController,
  updateCartController,
  removeFromCartController,
} = require("../controller/user/cartController");


const { postReviewController, deleteReviewController } = require("../controller/user/reviewController");

const {
  getWishlistController,
  addToWishlistController,
  removeFromWishlistController,
  moveToCartController 
} = require("../controller/user/wishlistController");


const {
  getCheckoutController,
  createRazorpayOrderController,
  placeOrderController,
  getOrderSuccessController,
} = require("../controller/user/checkoutController");

const {
  applyCouponController,
  removeCouponController,
} = require("../controller/user/couponController");


const { orderDetailController,cancelOrderItemController, returnOrderItemController, downloadInvoiceController } = require("../controller/user/orderController");

const { getWalletController, createWalletOrderController, verifyWalletPaymentController } = require("../controller/user/walletController");




router.get("/", (req, res) => {
  res.redirect("/home");
});


// signup page
router.get("/signup", (req, res) => {
  res.render("user/signup");
});
router.get("/signin", (req, res) => {
  res.render("user/signin")
});
router.get("/otp", requireSignupSession, (req,res)=>{
  res.render("user/otp")
})
//goog login start
router.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

//google login
router.get("/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/signup"
  }),
  (req, res) => {
      req.session.user = {
      id: req.user._id,                         
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      email: req.user.email,
      phone: req.user.phoneNumber || null,
      referralCode: req.user.referralCode || null
    };
    req.session.save((err) => {
  if (err) return res.redirect("/home");
    res.redirect("/home"); 
  })
}
);
router.get("/home", async (req, res) => {
  try {
    const user = req.session.user || req.user || null;

    const products = await Product.find({ 
      isActive: true,      // blocked hide
      isDeleted: false     // deleted hide
    })
    .populate("category", "name")
    .sort({ createdAt: -1 }) // newest first
    .limit(4)               
    .lean();

    res.render("user/home", { user, products });

  } catch (err) {
    console.log(err);
    res.send("Error loading home");
  }
});
router.get("/editProfile", isAuthenticated, (req, res) => {
  const user = req.session.user || null;
  res.render("user/profile/editProfile", { user });
});

router.get("/checkAuthType", isAuthenticated, (req, res) => {
  if (req.user && req.user.googleId) {
    return res.json({ googleUser: true });
  }
  res.json({ googleUser: false });
});
router.get("/forgot-password", (req, res) => {
  res.render("user/forgotPassword");
});

router.get("/account", isAuthenticated, accountController);
router.get("/addAddress", isAuthenticated, addAddressController);
router.get("/getAddress/:id", isAuthenticated, getAddressController);
router.get("/orders", isAuthenticated, orderHistoryController);





//SHOP
router.get("/shop",           getShopController);
router.get("/shop/men",       getShopController);
router.get("/shop/women",     getShopController);
router.get("/shop/unisex",    getShopController);
router.get("/shop/:id",       getProductDetailsController);


// ABOUT
router.get("/about", (req, res) => {
  const user = req.session.user || null;
  const cartCount = req.session.cartCount || 0;
  res.render("user/about", { user, cartCount });
});

router.post("/contact-us",contactUsController);



// Forgot password OTP page
router.get("/forgot-otp", (req, res) => {
  res.render("user/otp");
});

router.get("/reset-password", (req, res) => {
  res.render("user/resetPassword");
});





// signup
router.post("/signup", signupController);
router.post("/signin", signinController);
router.post("/verify-otp", verifyOtpController);
router.post("/resend-otp",resendOtpController);
router.post("/removeProfileImage", isAuthenticated, removeProfileImageController);
router.post("/updateProfile", isAuthenticated, updateProfileController);
router.post("/send-email-otp", isAuthenticated, sendEmailChangeOtpController);
router.post("/verify-email-otp", isAuthenticated, verifyEmailChangeOtpController);
router.post("/addAddress", isAuthenticated, saveAddressController);
router.delete("/deleteAddress/:id", isAuthenticated, deleteAddressController);
router.post("/editAddress/:id", isAuthenticated, updateAddressController);
router.post("/changePassword", isAuthenticated,changePasswordController);
router.post("/forgot-password", forgotPasswordController);
router.post("/verify-forgot-otp", verifyForgotOtpController);



router.post("/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).send("Logout failed");
    res.clearCookie("connect.sid");
    res.redirect("/signin");
  });
});

// Clear OTP session
router.post("/clear-otp-session", requireSignupSession,(req, res) => {
    req.session.otp = null;
    req.session.email = null; // if you store email in session
    res.json({ success: true });
});

router.post("/reset-password", resetPasswordController);



//review
router.post  ("/shop/:id/review", isAuthenticated, postReviewController);
router.delete("/shop/:id/review", isAuthenticated, deleteReviewController);





//CART
router.get ("/cart",        isAuthenticated, getCartController);
router.post("/cart/add",    isAuthenticated, addToCartController);
router.post("/cart/update", isAuthenticated, updateCartController);
router.post("/cart/remove", isAuthenticated, removeFromCartController);


router.get ("/wishlist",        isAuthenticated, getWishlistController);
router.post("/wishlist/add",    isAuthenticated, addToWishlistController);
router.post("/wishlist/remove", isAuthenticated, removeFromWishlistController);
router.post("/wishlist/move-to-cart", isAuthenticated, moveToCartController);





router.get ("/checkout",                isAuthenticated, getCheckoutController);
router.post("/checkout/place-order",    isAuthenticated, placeOrderController);
router.post("/checkout/razorpay-order", isAuthenticated, createRazorpayOrderController);
router.get ("/order-success",           isAuthenticated, getOrderSuccessController);



router.post("/orders/:id/cancel-item", isAuthenticated, cancelOrderItemController);
router.post("/orders/:id/return-item", isAuthenticated, returnOrderItemController);
router.get ("/orders/invoice/:id",     isAuthenticated, downloadInvoiceController);
router.get ("/orders/:id",             isAuthenticated, orderDetailController);

// Coupon
router.post("/cart/apply-coupon",  isAuthenticated, applyCouponController);
router.post("/cart/remove-coupon", isAuthenticated, removeCouponController);


//wallet
router.get ("/wallet",                isAuthenticated, getWalletController);
router.post("/wallet/create-order",   isAuthenticated, createWalletOrderController);
router.post("/wallet/verify-payment", isAuthenticated, verifyWalletPaymentController);



// multer setup

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/uploads/"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, "profile_" + Date.now() + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error("Only JPEG, PNG, WEBP allowed"), false);
  }
});
router.post("/updateProfileImage", isAuthenticated, (req, res, next) => {
  upload.single("profileImage")(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
}, updateProfileImageController);






module.exports = router;
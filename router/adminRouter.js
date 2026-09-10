const express = require("express");
const router = express.Router();
const { upload } = require('../config/cloudinary');

const { 
  adminSigninController,
   getDashboardController,
  getCustomersController,
  blockUserController,
  unblockUserController,
} = require("../controller/admin/adminController");

const {
  getCategoriesController,
  getAddCategoryController,
  postAddCategoryController,
  getEditCategoryController,
  postEditCategoryController,
  deleteCategoryController,
} = require("../controller/admin/categoryController");

const {
  getProductsController,
  getAddProductController,
  postAddProductController,
  deleteProductController,
   getEditProductController,
  postEditProductController,
   toggleProductStatusController,
} = require('../controller/admin/productController');


const { getOrdersController, updateOrderStatusController, getOrderDetailController, approveReturnController,updateItemStatusController,  // ← ADD
  rejectReturnController,  } = require("../controller/admin/orderController");
const { getInventoryController, updateStockController } = require("../controller/admin/inventoryController");


const { getCouponsController, addCouponController, editCouponController, toggleCouponController, deleteCouponController, getCouponByIdController } = require("../controller/admin/couponController");


const { getProductOfferController, setProductOfferController, toggleProductOfferController, removeProductOfferController, getProductOfferByIdController } = require("../controller/admin/productOfferController");
const { getCategoryOfferController, setCategoryOfferController, toggleCategoryOfferController, removeCategoryOfferController, getCategoryOfferByIdController } = require("../controller/admin/categoryOfferController");

const { getSalesReportController, downloadSalesReportController } = require("../controller/admin/salesReportController");



const adminAuth = (req, res, next) => {
  if (req.session.admin) return next();
  const wantsJson = (req.headers.accept && req.headers.accept.includes("application/json")) || req.headers["content-type"] === "application/json";
  if (wantsJson) {
    return res.status(401).json({ success: false, message: "Admin session expired. Please sign in again." });
  }
  return res.redirect("/admin/signin");
};

const blockUserFromAdmin = (req, res, next) => {
  if (req.session.user && !req.session.admin) {
    return res.status(403).send("Access denied");
  }
  next();
};

// AUTH
router.get("/signin", (req, res) => res.render("admin/adminsignin"));
router.post("/signin", adminSigninController);

// DASHBOARD
router.get("/dashboard", adminAuth, getDashboardController);

// LOGOUT
// LOGOUT
router.get("/logout", adminAuth, (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error("Admin logout error:", err);
      return res.redirect("/admin/dashboard");
    }
    res.clearCookie("connect.sid");
    res.redirect("/admin/signin");
  });
});

// CUSTOMERS
router.get("/customers", adminAuth, getCustomersController);
router.patch("/customers/:id/block", adminAuth, blockUserController);
router.patch("/customers/:id/unblock", adminAuth, unblockUserController);

// CATEGORIES
router.get ("/categories", adminAuth, getCategoriesController);
router.get ("/categories/add",adminAuth, getAddCategoryController);
router.post("/categories/add", adminAuth, postAddCategoryController);
router.get ("/categories/edit/:id",adminAuth, getEditCategoryController);
router.post("/categories/edit/:id",adminAuth, postEditCategoryController);
router.post("/categories/delete/:id",adminAuth, deleteCategoryController);

// PRODUCTS
router.get ("/products", adminAuth, getProductsController);
router.get ("/products/add",adminAuth, getAddProductController);
router.patch("/products/toggle/:id", adminAuth, toggleProductStatusController);
router.post("/products/add", adminAuth, (req, res, next) => {
  upload.array('images', 6)(req, res, (err) => {
    if (err) return next(err)
    next();
  });
}, postAddProductController);




router.get ("/products/edit/:id", adminAuth, getEditProductController);
router.post("/products/edit/:id", adminAuth, (req, res, next) => {
  upload.array('images', 6)(req, res, (err) => {
    if (err) { req.multerError = err; }
    next();
  });
}, postEditProductController);




router.post("/products/delete/:id", adminAuth, deleteProductController);

router.get  ("/orders",              adminAuth, getOrdersController);
router.get  ("/orders/:id",          adminAuth, getOrderDetailController);
router.patch("/orders/:id/status",   adminAuth, updateOrderStatusController);
router.get  ("/inventory",           adminAuth, getInventoryController);
router.patch("/inventory/:id/stock", adminAuth, updateStockController);
router.patch("/orders/:id/approve-return", adminAuth, approveReturnController);



//COUPONS
router.get   ("/coupons",              adminAuth, getCouponsController);
router.get   ("/coupons/:id",          adminAuth, getCouponByIdController);
router.post  ("/coupons/add",          adminAuth, addCouponController);
router.post  ("/coupons/edit/:id",     adminAuth, editCouponController);
router.patch ("/coupons/toggle/:id",   adminAuth, toggleCouponController);
router.delete("/coupons/delete/:id",   adminAuth, deleteCouponController);

//PRODUCT OFFER
router.get   ("/product-offer",          adminAuth, getProductOfferController);
router.get   ("/product-offer/:id",      adminAuth, getProductOfferByIdController);
router.post  ("/product-offer/:id",      adminAuth, setProductOfferController);
router.patch ("/product-offer/:id/toggle", adminAuth, toggleProductOfferController);
router.delete("/product-offer/:id",      adminAuth, removeProductOfferController);


//CATEGORY OFFER
router.get   ("/category-offer",           adminAuth, getCategoryOfferController);
router.get   ("/category-offer/:id",       adminAuth, getCategoryOfferByIdController);
router.post  ("/category-offer/:id",       adminAuth, setCategoryOfferController);
router.patch ("/category-offer/:id/toggle", adminAuth, toggleCategoryOfferController);
router.delete("/category-offer/:id",       adminAuth, removeCategoryOfferController);


router.get("/sales-report",          adminAuth, getSalesReportController);
router.get("/sales-report/download", adminAuth, downloadSalesReportController);



router.patch('/orders/:id/item/:itemId/status',adminAuth, updateItemStatusController);
router.patch('/orders/:id/reject-return',  adminAuth,     rejectReturnController);


module.exports = router;
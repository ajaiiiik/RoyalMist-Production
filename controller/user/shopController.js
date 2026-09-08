// ================================================================
// controller/user/shopController.js — UPDATED WITH OFFER PRICES
// Replace your entire existing shopController.js with this
// ================================================================

const Product  = require("../../model/productSchema");
const Category = require("../../model/categorySchema");
const { getProductReviewsService, getProductsRatingService } = require("../../services/user/reviewService");
const { getEffectivePrice } = require("../../utils/offerHelper");

// ── GET /shop ─────────────────────────────────────────────────
const getShopController = async (req, res) => {
  try {
    const user          = req.session.user || null;
    const search        = req.query.search        || "";
    const category      = req.query.category      || "";
    const gender        = req.query.gender        || "";
    const fragranceType = req.query.fragranceType || "";
    const minPrice      = req.query.minPrice      || "";
    const maxPrice      = req.query.maxPrice      || "";
    const sort          = req.query.sort          || "";
    const currentPage   = Math.max(1, parseInt(req.query.page) || 1);
    const LIMIT         = 9;
    const skip          = (currentPage - 1) * LIMIT;

    const filter = { isActive: true, isDeleted: false };

    if (search.trim()) {
      filter.$or = [
        { name:        { $regex: search.trim(), $options: "i" } },
        { description: { $regex: search.trim(), $options: "i" } },
      ];
    }

    if (gender.trim()) {
      const genderCat = await Category.findOne({
        name:      { $regex: new RegExp(`^${gender.trim()}$`, "i") },
        isActive:  true,
        isDeleted: false,
      });
      if (genderCat) filter.category = genderCat._id;
      else filter._id = null;
    }

    if (category.trim() && !gender.trim()) filter.category = category.trim();
    if (fragranceType.trim()) filter.fragranceType = fragranceType.trim();

    if (minPrice !== "" || maxPrice !== "") {
      const priceFilter = {};
      if (minPrice !== "") priceFilter.$gte = Number(minPrice);
      if (maxPrice !== "") priceFilter.$lte = Number(maxPrice);
      filter["volumes.0.price"] = priceFilter;
    }

    let sortQuery = { createdAt: -1 };
    if (sort === "price_asc")  sortQuery = { "volumes.0.price":  1 };
    if (sort === "price_desc") sortQuery = { "volumes.0.price": -1 };
    if (sort === "name_asc")   sortQuery = { name:  1 };
    if (sort === "name_desc")  sortQuery = { name: -1 };

   const [products, totalProducts, categories] = await Promise.all([
  Product.find(filter)
    .populate({
      path: "category",
      select: "name offer",
      match: { isDeleted: { $ne: true }, isActive: { $ne: false } } // ← ADD THIS
    })
    .sort(sortQuery)
    .skip(skip)
    .limit(LIMIT)
    .lean(),
      Product.countDocuments(filter),
      Category.find({ isActive: true, isDeleted: false }).select("name").lean(),
    ]);

    // Ratings + Offer prices
    // Filter products whose category is deleted
const validProducts = products.filter(p => p.category !== null); // ← ADD

// Ratings + Offer prices
const productIds = validProducts.map(p => p._id); // ← change products to validProducts
    const ratingMap  = await getProductsRatingService(productIds);

    validProducts.forEach(p => {
      const r        = ratingMap[p._id.toString()];
      p.avgRating    = r ? Math.round(r.avgRating * 10) / 10 : 0;
      p.totalReviews = r ? r.totalReviews : 0;

      // Apply offer price
      const categoryOffer = p.category?.offer;
      const offerInfo = getEffectivePrice(p, categoryOffer);
      p.hasOffer           = offerInfo.hasOffer;
      p.offerLabel         = offerInfo.offerLabel;
      p.originalBasePrice  = offerInfo.originalBasePrice;
      p.discountedBasePrice = offerInfo.discountedBasePrice;
      p.discountedVolumes  = offerInfo.discountedVolumes;
    });

    const totalPages  = Math.ceil(totalProducts / LIMIT);
    const startPage   = Math.max(1, currentPage - 2);
    const endPage     = Math.min(totalPages, currentPage + 2);
    const pageNumbers = [];
    for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);

    res.render("user/shop", {
      user, products: validProducts, categories,
      fragranceTypes: ["Citrus","Woody","Floral","Oriental","Aquatic","Spicy","Musky","Fresh"],
      filters: { search, category, gender, fragranceType, minPrice, maxPrice, sort },
      currentPage, totalPages, totalProducts, pageNumbers,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
      activePath: "",
    });

  } catch (err) {
    console.error("Shop error:", err);
    res.status(500).send("Server error");
  }
};

// ── GET /shop/:id ─────────────────────────────────────────────
const getProductDetailsController = async (req, res) => {
  try {
    const user      = req.session.user || null;
    const productId = req.params.id;

   const product = await Product.findOne({
  _id:       productId,
  isActive:  true,
  isDeleted: false,
}).populate({
  path: "category",
  match: { isDeleted: { $ne: true }, isActive: { $ne: false } } // ← ADD THIS
}).lean();

// ← ADD THIS CHECK
if (!product || !product.category) {
  return res.render("user/productDetails", {
    user,
    product: null,
    unavailable: true,
    relatedProducts: [],
    reviews: [], avgRating: 0, totalReviews: 0,
    ratingBreakdown: {}, userReview: null,
  });
}
    // Apply offer price
    const categoryOffer = product.category?.offer;
    const offerInfo     = getEffectivePrice(product, categoryOffer);
    product.hasOffer          = offerInfo.hasOffer;
    product.offerLabel        = offerInfo.offerLabel;
    product.originalBasePrice = offerInfo.originalBasePrice;
    product.discountedBasePrice = offerInfo.discountedBasePrice;
    product.discountedVolumes = offerInfo.discountedVolumes;

    const relatedProducts = await Product.find({
      category:  product.category._id,
      _id:       { $ne: product._id },
      isActive:  true,
      isDeleted: false,
    }).populate("category", "name offer").limit(4).lean();

    // Apply offers to related products too
    relatedProducts.forEach(p => {
      const catOffer = p.category?.offer;
      const info = getEffectivePrice(p, catOffer);
      p.hasOffer = info.hasOffer;
      p.offerLabel = info.offerLabel;
      p.discountedBasePrice = info.discountedBasePrice;
      p.originalBasePrice = info.originalBasePrice;
    });

    const { reviews, totalReviews, avgRating, ratingBreakdown, userReview } =
      await getProductReviewsService(productId, user?.id);

    res.render("user/productDetails", {
      user,
      product,
      unavailable:false,
      relatedProducts,
      reviews,
      avgRating,
      totalReviews,
      ratingBreakdown,
      userReview,
    });

  } catch (err) {
    console.error("Product details error:", err);
    res.redirect("/shop");
  }
};

module.exports = { getShopController, getProductDetailsController };

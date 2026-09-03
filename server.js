require("dotenv").config();

const { MongoStore } = require("connect-mongo")
const express = require("express");
const path = require("path");
const session = require("express-session")
const passport = require("./config/passport");
const User = require("./model/userSchema");

const connectDB = require("./config/db");
const userRoutes = require("./router/userRouter"); 
const adminRoutes = require("./router/adminRouter");

const app = express();
app.set("trust proxy", 1);

//DATABASE 
connectDB();



//MIDDLEWARE
app.use(express.urlencoded({ extended: true })); 
app.use(express.json());


app.use(express.static(path.join(__dirname, "public")));


//VIEW ENGINE
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "mysecretkey",
    resave: false,
    saveUninitialized: false,
   store: new MongoStore({       
  mongoUrl: process.env.MONGO_URI,
  ttl: 24 * 60 * 60          
}),
    cookie :{
      maxAge:24*60*60*1000,
      httpOnly:true,
        secure: process.env.NODE_ENV === "production", 
        sameSite: "lax"
    }
  })
);
app.use(passport.initialize());
app.use(passport.session());



const Cart = require("./model/cartSchema");
app.use(async (req, res, next) => {
  try {
    if (req.session && req.session.user) {
      const cart = await Cart.findOne({ user: req.session.user.id });
      res.locals.cartCount = cart
        ? cart.items.reduce((sum, i) => sum + i.quantity, 0)
        : 0;
    } else {
      res.locals.cartCount = 0;
    }
  } catch {
    res.locals.cartCount = 0;
  }
  next();
});




// ROUTES
app.use('/',userRoutes);
app.use('/admin', adminRoutes);


//SERVER 
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim:true
  },
  lastName: {
    type:String,
     required:  function () {
    return this.googleId?false:true
  },
    trim:true
},
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  role: {
  type: String,
  enum: ["user", "admin"],
  default: "user"
},

  phoneNumber: {
    type: String,
    unique:true,
    sparse:true,
    default:undefined,
    required:  function () {
    return this.googleId ?false:true
  }
  },

  password: {
    type: String,
    required:  function () {
    return this.googleId ?false:true
  }
  },

  referralCode: {
    type: String,
    default: null,
    trim:true
  },

  myReferralCode: {
    type: String,
    unique: true,
    sparse: true
  },

  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },

  referralRewardGiven: {
    type: Boolean,
    default: false
  },

  profileImage: 
  { type: String, 
    default: "" },
    
    googleId:{
    type:String
  },

  signupMethod: {
    type: String,
    enum: ['email', 'google'],
    default: 'email'
  },

  isBlocked: {
    type: Boolean,
    default: false
  },

addresses: [{
    fullName:     String,
    addressLine1: String,
    addressLine2: String,
    city:         String,
    state:        String,
    country:      String,
    zipCode:      String,
    addressType:  String
}]
},{ timestamps: true });

module.exports = mongoose.model("User", userSchema);
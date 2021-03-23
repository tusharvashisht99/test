"use strict";
let mongoose = require("./db.server.connect"),
  Schema = mongoose.Schema,
  crypto = require("crypto");
  // _ = require("underscore");
/**
 * Module dependencies.
 */
var UserSchema = new Schema({
  firstName: {
    type: String,
    trim: true,
  },
  lastName: {
    type: String,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
    default: "",
    match: [/.+\@.+\..+/, "Please fill a valid email address"],
    // unique: true
  },
  password: {
    type: String,
    default: "",
    // validate: [validateLocalStrategyPassword, "Password should be longer"],
  },
  resetPasswordToken: {
    type: String,
  },
  resetPasswordExpires: {
    type: Date,
  },
  salt: {
    type: String,
  },
  deviceDetails: [
    {
      deviceType: {
        type: Number,
        enum: [2, 1],
        default: 1,
      },
      deviceToken: { type: String, trim: true, default: "" },
      deviceId: { type: String, default: "" },
    },
  ],
 role: {
    type: Number,
    default: 2,
  },
});
/**
 * Hook a pre save method to hash the password
 */
UserSchema.pre("save", function (next) {
  if (this.password && this.password.length > 0) {
    this.salt = new Buffer(crypto.randomBytes(16).toString("base64"), "base64");
    this.password = this.hashPassword(this.password);
  }
  next();
});
/**
 * Create instance method for hashing a password
 */
UserSchema.methods.hashPassword = function (password) {
  if (this.salt && password) {
    return crypto
      .pbkdf2Sync(password, this.salt, 10000, 64, "sha512")
      .toString("base64");
  } else {
    return password;
  }
};
/**
 * Create instance method for authenticating user
 */
UserSchema.methods.authenticate = function (password) {
  return this.password === this.hashPassword(password);
};

module.exports = mongoose.model("newuser", UserSchema);

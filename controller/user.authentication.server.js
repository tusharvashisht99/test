"use strict";

/**
 * Module dependencies.
 */
var _ = require("lodash"),
  mongoose = require("mongoose"),
  // User = mongoose.model('User'),

  config = require("../config.server"),
  models = require("../model"),
  passport = require("passport"),
  jwt = require("jsonwebtoken");

/**
 * Passport Authentcation
 */
exports.hasAuthentcation = function (req, res, next) {
  return (req, res, next) => {
    var token =
      req.body.token || req.query.token || req.headers["authorization"];
    if (token) {
      //Decode the token
      token = token.replace(/^Bearer\s/, "");
      jwt.verify(token, config.secret, async function (err, decod) {
        if (err) {
          res.status(403).json({
            success: false,
            message: "Wrong Token",
          });
        } else {
          //If user then call next() so that respective route is called.
          let userData = await models.users.findOne({
            _id: decod.data,
          });
          if (!userData) {
            res.status(403).json({
              success: false,
              message: "Oops!!! You are not Authorized Please Contact Admin.",
            });
          }
          if (userData) {
            userData = userData.toJSON();
            delete userData["modified_at"];
            delete userData["created_at"];
            delete userData["__v"];
            delete userData["salt"];
            req.user = userData;
            next();
          }
        }
      });
    } else {
      res.status(403).json({
        success: false,
        message: "No Token",
      });
    }
  };
};

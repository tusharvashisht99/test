"use strict";

let mongoose = require("mongoose"),
  // users = mongoose.model("newuser"),
  config = require("../config.server"),
  // constants = require("../constants"),
  nodemailer = require("nodemailer"),
  async = require("async"),
  models = require("../model");
const users = require("../model/user.server.model"),
  errorHandler = require("./errors.server.controller"),
  jwt = require("jsonwebtoken");

var crud = {
  login: async function (req, res) {
    try {
      console.log("body", req.body);
      if (!req.body.username || !req.body.password) {
        return res.status(401).json({
          success: false,
          message: "Authentication failed. Missing credentials.",
        });
      }
      let username = req.body.username,
        criteria =
          username.indexOf("@") === -1
            ? { email: username }
            : { email: username };
      users.findOne(criteria, async function (err, user) {
        if (err) {
          return res.status(200).send({
            success: false,
            message: errorHandler.getErrorMessage(err),
          });
        }
        if (!user) {
          return res.status(200).json({
            success: false,
            message: "Authentication failed. User not found.",
          });
        }
        if (user.isDeleted === true) {
          return res.status(200).json({
            success: false,
            message: "Authentication failed. User not found.",
          });
        } else {
          if (!user.authenticate(req.body.password)) {
            return res.status(200).json({
              success: false,
              message: "Authentication failed. Passwords did not match.",
            });
          }
          var token = jwt.sign({ data: user._id }, config.secret, {
            expiresIn: config.sessionExpire, // in seconds
          });
          let body = req.body;
          var check = await users.findOne(
            { _id: user._id },
            { deviceDetails: { $elemMatch: { deviceId: body.deviceId } } }
          );
          // console.log("check",check)
          if (check.deviceDetails.length > 0) {
            console.log("check", check);
            var updatedToken = await users.updateOne(
              { _id: user._id, "deviceDetails.deviceId": body.deviceId },
              { $set: { "deviceDetails.$.deviceToken": body.deviceToken } }
            );
          } else {
            user = JSON.parse(JSON.stringify(user));
            // console.log("user",user)
            let updated = user.deviceDetails ? user.deviceDetails : [];
            if (body.deviceToken && body.deviceType) {
              updated.push({
                deviceToken: body.deviceToken,
                deviceType: body.deviceType,
                deviceId: body.deviceId,
              });
            }
            await users.findOneAndUpdate(
              { _id: user._id },
              { $set: { deviceDetails: updated } }
            );
          }

          delete user["modified_at"];
          delete user["created_at"];
          delete user["__v"];
          delete user["salt"];
          delete user["created_at"];
          delete user["isDeleted"];
          delete user["password"];
          // delete user["deviceDetails"];
          // console.log("user",ypdate);

          res.json({
            success: true,
            token: token,
            data: user,
          });
        }
      });
    } catch (error) {
      res.status(400).send({
        success: false,
        message: errorHandler.getErrorMessage(error),
      });
    }
  },
  addUser: async function (req, res) {
    try {
      let body = req.body;
      let alreadyExist = await users.findOne({ email: body.email });
      if (alreadyExist) {
        res.status(200).send({
          success: false,
          message: "User Already Exist",
        });
      } else {
        let deviceDetails = [];
        if (body.deviceToken && body.deviceType && body.deviceId) {
          deviceDetails.push({
            deviceToken: body.deviceToken,
            deviceType: body.deviceType,
            deviceId: body.deviceId,
          });
        }
        body.deviceDetails = deviceDetails;
        users.create(body, async function (err, results) {
          if (err) {
            console.log("err", err);
            res.status(400).send({
              success: false,
              message: errorHandler.getErrorMessage(err),
            });
          } else {
            var token = jwt.sign(
              { data: results._id },
              "P16s2vsj6BRyFUKomxXG",
              {
                expiresIn: 15552000, // in seconds
              }
            );
            results = JSON.parse(JSON.stringify(results));
            delete results["modified_at"];
            delete results["created_at"];
            delete results["__v"];
            delete results["salt"];
            delete results["created_at"];
            delete results["isDeleted"];
            delete results["password"];

            res.status(200).send({
              success: true,
              token: token,
              data: results,
            });
          }
        });
      }
    } catch (error) {
      console.log("erre", error);
      res.status(400).send({
        success: false,
        message: error,
      });
    }
  },
  forgot: async function (req, res, next) {
    async.waterfall(
      [
        // Generate random token
        function (done) {
          var val = Math.floor(100000 + Math.random() * 9000);
          // console.log("otp", val);
          done(null, val);
          // crypto.randomBytes(2, function (err, buffer) {
          //   var token = buffer.toString('hex');
          //   done(err, token);
          // });
        },
        function (token, done) {
          if (req.body.email) {
            models.users.findOne(
              {
                email: req.body.email,
              },
              "-salt -password",
              function (err, user) {
                if (!user) {
                  return res.status(200).send({
                    success: false,
                    message: "No account with this email has been found.",
                    statusCode: 200,
                  });
                } else {
                  user.resetPasswordToken = token;
                  user.resetPasswordExpires = Date.now() + 900000; // 15 min
                  user.save(function (err) {
                    done(err, token, user);
                  });
                }
              }
            );
          } else {
            return res.status(400).send({
              success: false,
              message: "Username field must not be blank",
              statusCode: 200,
            });
          }
        },
        function (token, user, done) {
          console.log(`http://${req.headers.host}/auth/reset/${token}`);
          let emailHTML = `
<!doctype html>
<html lang="en">
   <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
      <title>QueenDom</title>
      <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@100;400;500;700&display=swap" rel="stylesheet"> 
      <style>
       {
         box-sizing: border-box;
         }
      </style>
   </head>
   <body style="font-family: 'Roboto';padding: 0;margin: 0;">
   <h2>Your Otp For Password reset is</h2>
          <h4> ${token}<h4> 
          <p>Valid for 15 minutes only</p>
   </body>
</html>`;
          done(null, emailHTML, user, token);
        },
        // If valid email, send reset email using service
        function (emailHTML, user, token, done) {
          var transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: config.sendEmail.user,
              pass: config.sendEmail.pass,
            },
            port: 457,
          });
          var mailOptions = {
            from: config.sendEmail.from,
            to: user.email,
            subject: "Test App Password Reset",
            html: emailHTML,
          };
          transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
              console.log(error);
            } else {
              res.status(200).send({
                success: true,
                message:
                  "An email has been sent to " +
                  user.email +
                  " with further instructions.",
                statusCode: 200,
                otp: token,
                data: info,
              });
            }
            // done(err)
            done(error);
          });
        },
      ],
      function (err) {
        console.log("err", err);
        if (err) return next(err);
      }
    );
  },
  validateResetToken: function (req, res) {
    let token = req.params.token;
    models.users.findOne(
      {
        resetPasswordToken: req.params.token,
        resetPasswordExpires: {
          $gt: Date.now(),
        },
      },
      function (err, user) {
        if (!user) {
          res.status(200).send({
            success: false,
            message: "Invalid Otp",
            token: token,
          });
        } else {
          res.status(200).send({
            success: true,
            message: "Otp Verified",
            token: token,
          });
        }
      }
    );
  },
  reset: function (req, res, next) {
    // Init Variables
    var passwordDetails = req.body;
    // console.log("yes in AUth")
    // console.log("passwordDetails", passwordDetails);
    async.waterfall(
      [
        function (done) {
          models.users.findOne(
            {
              resetPasswordToken: req.params.token,
              resetPasswordExpires: {
                $gt: Date.now(),
              },
            },
            function (err, user) {
              if (!err && user) {
                if (
                  passwordDetails.newPassword === passwordDetails.verifyPassword
                ) {
                  user.password = req.body.newPassword;
                  user.resetPasswordToken = undefined;
                  user.resetPasswordExpires = undefined;
                  user.isPasswordSet = true;
                  user.save(function (err) {
                    if (err) {
                      return res.status(400).send({
                        success: false,
                        message: errorHandler.getErrorMessage(err),
                      });
                    } else {
                      var token = jwt.sign({ data: user._id }, config.secret, {
                        expiresIn: config.sessionExpire, // in seconds
                      });
                      res.status(200).send({
                        success: true,
                        message: "Password Reset successfully",
                      });
                      // res.json({ status: 1, token: token });

                      // res.render('password-changed', {
                      // 	token
                      // })
                    }
                  });
                } else {
                  return res.status(200).send({
                    success: false,
                    message: "Passwords do not match",
                  });
                }
              } else {
                return res.status(200).send({
                  success: false,
                  message: "Password reset Otp is invalid or has expired.",
                });
              }
            }
          );
        },
        // If valid email, send reset email using service
        function (emailHTML, user, done) {
          var transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: config.sendEmail.user,
              pass: config.sendEmail.pass,
            },
          });

          var mailOptions = {
            from: config.sendEmail.from,
            // from: config.sendEmail.from,
            to: user.email,
            subject: "Test App Password Changed",
            html: emailHTML,
          };
          transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
              console.log(error);
            } else {
              res.status(200).send({
                success: true,
                message: "Password Reset Successful",
              });
            }
          });
        },
      ],
      function (err) {
        if (err) return next(err);
      }
    );
  },
  logout: async function (req, res) {
    try {
      let body = req.body;
      let user = await users.findOne({ _id: req.user._id });
      if (!user) {
        res.status(400).send({
          success: false,
          message: "User Not Exist",
        });
      } else {
        if (body.deviceToken && body.deviceType) {
          let updated = user.deviceDetails ? user.deviceDetails : [];
          updated = updated.filter(
            (e) =>
              e.deviceToken != body.deviceToken &&
              e.deviceType != body.deviceType
          );
          await users.findOneAndUpdate(
            { _id: user._id },
            { $set: { deviceDetails: updated } }
          );
          res.status(200).send({
            success: true,
            message: "Logout Successfully",
          });
        }
      }
    } catch (error) {
      res.status(400).send({
        success: false,
        message: errorHandler.getErrorMessage(error),
      });
    }
  },
  updateUserProfile: async function (req, res) {
    try {
      let body = req.body;
      let alreadyExist = await models.users.findOne({ _id: req.user._id });
      if (!alreadyExist) {
        res.status(400).send({
          success: false,
          message: "User Not Exist",
        });
      } else {
        users.findOneAndUpdate(
          { _id: req.user._id },
          { $set: body },
          async function (err, rs) {
            if (err) {
              console.log("err", err);
              res.status(400).send({
                success: false,
                message: errorHandler.getErrorMessage(err),
              });
            } else {
              let results = await models.users.findOne({ _id: req.user._id });
              results = JSON.parse(JSON.stringify(results));
              delete results["modified_at"];
              delete results["created_at"];
              delete results["__v"];
              delete results["salt"];
              delete results["created_at"];
              delete results["isDeleted"];
              delete results["password"];
              res.status(200).send({
                success: true,
                data: results,
              });
            }
          }
        );
      }
    } catch (error) {
      res.status(400).send({
        success: false,
        message: errorHandler.getErrorMessage(error),
      });
    }
  },
};

module.exports = crud;

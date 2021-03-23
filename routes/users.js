const router = require("express").Router();
var users = require("../controller/users.server.controller");
var auth = require("../controller/user.authentication.server");

// Setting up the users profile api
router.route("/login").post(users.login);

router.route("/signup").post(users.addUser);

router.route("/logout").delete(auth.hasAuthentcation(), users.logout);

router
  .route("/update/profile")
  .post(auth.hasAuthentcation(), users.updateUserProfile);

router.post("/forgot-password", users.forgot);

router.route("/auth/reset/:token").get(users.validateResetToken);

router.route("/auth/reset-password/:token").post(users.reset);

module.exports = router;

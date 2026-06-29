const express = require("express");
const passport = require("passport");

const router = express.Router();

// Start Google Login
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account"
  })
);

// Google Callback
router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  (req, res) => {

    if (!req.user.isProfileCompleted) {
      return res.redirect("/complete-profile");
    }

    res.redirect("/listings");
  }
);

module.exports = router;
console.log("USERS ROUTE LOADED");
const { redirectIfLoggedIn } = require("../middleware");
const express = require("express");
const router = express.Router();
const passport = require("passport");
const User = require("../models/user");


// Register Form
router.get("/signup", (req, res)=>{
   res.render("users/signup.ejs");
});

// Register User
router.post("/signup", async(req,res)=>{
   try{
      const { username,email,password } = req.body;
      const newUser = new User({ username,email,password });
      await newUser.save();
      req.flash("success","Account created! Please login.");
      res.redirect("/login");
   }catch(err){
      req.flash("error",err.message);
      res.redirect("/signup");
   }
});

// Login Form 
router.get("/login", redirectIfLoggedIn, (req, res) => {
   res.render("users/login");
});

// Login User
router.post("/login", (req, res, next) => {

  passport.authenticate("local", (err, user, info) => {

    if (err) {
      return res.json({ success: false, message: "Server error" });
    }

    if (!user) {
      return res.json({ success: false, message: info?.message || "Invalid credentials" });
    }
    req.logIn(user, (err) => {
      if (err) {
        return res.json({
          success: false,
          message: "Login failed"
        });
      }

      return res.json({
        success: true,
        message: "Welcome back!"
      });
    });

  })(req, res, next);

});

// LogOut User
router.post("/logout", (req, res, next) => {
  req.logout(function(err) {
    if (err) { return next(err); }

    req.flash("success", "Logged out successfully");
    res.redirect("/listings");
  });
});

router.get("/complete-profile", (req, res) => {


    if (!req.isAuthenticated()) {
        req.flash("error", "Please login first.");
        return res.redirect("/login");
    }

    res.render("users/complete-profile");

});

// complete-user-profile------

router.post("/complete-profile", async (req, res) => {
  try {


    if (!req.isAuthenticated()) {
      req.flash("error", "Please login first.");
      return res.redirect("/login");
    }

    const { username, mobile, fullName, dob, gender } = req.body;

    // validate phone number---

    const phone = mobile.replace(/\s+/g, "");

    if (!/^\+?[1-9]\d{7,14}$/.test(phone)) {
        req.flash("error", "Please enter a valid international mobile number.");
        return res.redirect("/complete-profile");
    }

    const existingUser = await User.findOne({username,_id: { $ne: req.user._id }, });

    if (existingUser) {
    req.flash("error", "Username already exists.");

    return req.session.save(() => {
        res.redirect("/complete-profile");
    });
}

    await User.findByIdAndUpdate(req.user._id, {
      username,
      mobile,
      fullName,
      dob,
      gender,
      isProfileCompleted: true,
    });

    req.flash("success", "Profile completed successfully.");

    return req.session.save(() => {
      res.redirect("/listings");
    });

  } catch (err) {
    console.error(err);
    req.flash("error", "Unable to update profile.");
    res.redirect("/complete-profile");
  }
});

module.exports = router;

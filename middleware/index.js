const Listing = require("../models/listing");

// Protect private routes
module.exports.isLoggedIn = (req, res, next) => {
   if (!req.isAuthenticated()) {
      req.flash("error", "You must be logged in first!");
      return res.redirect("/login");
   }
   next();
};

//  Prevent logged-in users from visiting login/signup
module.exports.redirectIfLoggedIn = (req, res, next) => {
   if (req.isAuthenticated()) {
      return res.redirect("/listings");
   }
   next();
};

// Owner Authorization

module.exports.isOwner = async (req, res, next) => {
   let { id } = req.params;
   let listing = await Listing.findById(id);

   // Safety check
   if(!listing){
      req.flash("error","Listing not found!");
      return res.redirect("/listings");
   }

   // If owner missing (old data)
   if(!listing.owner){
      req.flash("error","Owner not assigned to this listing!");
      return res.redirect(`/listings/${id}`);
   }

   // Owner OR Dev allowed
   if(
      !listing.owner.equals(req.user._id) &&
      req.user.role !== "dev"
   ){
      req.flash("error","You are not the owner!");
      return res.redirect(`/listings/${id}`);
   }

   next();
};

module.exports.isDev = (req,res,next)=>{
   if(req.user && req.user.role === "dev"){
      return next();
   }
   req.flash("error","Developer access only!");
   res.redirect("/listings");
};
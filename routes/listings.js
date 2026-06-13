
const express = require('express');
const router = express.Router();

const Listing = require('../models/listing');
const upload = require("../utils/multer");
const { isLoggedIn, isOwner } = require("../middleware");

// const mapToken = process.env.MAP_TOKEN;
// const geocoder = mbxGeocoding({ accessToken: mapToken });

router.get("/", async (req, res) => {
  try {

    const { search, location, guests, dates} = req.query;

    let query = {};

    const searchTerm = location || search;

    if (guests && Number(guests) > 0) {
      query.maxGuests = {
        $gte: Number(guests)
      };
    }

    if (searchTerm && searchTerm.trim() !== "") {

      query.$or = [
        { title: { $regex: searchTerm, $options: "i" } },
        { location: { $regex: searchTerm, $options: "i" } },
        { country: { $regex: searchTerm, $options: "i" } }
      ];

    }

    const allListings = await Listing.find(query);

    res.render("listings/index", {
    allListings,
    filters: {
      location,
      guests,
      dates
    }
  });

  } catch (err) {
    console.error("Search error:", err);
    res.status(500).send("Something went wrong");
  }
});

// New listing form
router.get("/new",isLoggedIn, async (req, res) => {
    try {
        res.render("listings/new.ejs");
    } catch (err) {
        console.log(err);
        res.send("Error loading new listing form");
    }
});

// Create new listing
router.post("/",isLoggedIn, upload.fields([
  { name: "images", maxCount: 10 },
  { name: "ownershipProof", maxCount: 1 }
])
, async (req, res) => {
    try {
        const listingData = req.body.listing;

      /* ===== CREATE LISTING FIRST ===== */
      const newListing = new Listing(listingData);
          console.log(listingData);

      newListing.owner = req.user._id;

        //  free geocoding
        const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(listingData.location)}`,
        {
          headers: {
            "User-Agent": "Locara/1.0"
          }
        }
     );

        const data = await response.json();

        if(data && data.length){
        newListing.geometry = {
          type:"Point",
          coordinates:[ data[0].lon, data[0].lat ]
        };
      }

         /* ===== IMAGES ===== */
      const imageFiles = req.files["images"];

      newListing.images = [];

      if(imageFiles && imageFiles.length){
        newListing.images = imageFiles.map(f => ({
          url: "uploads/" + f.filename,
          filename: f.filename
        }));
      }

      /* ===== OWNERSHIP PROOF ===== */
      const proofFile = req.files["ownershipProof"];

      if(proofFile && proofFile.length){
        newListing.ownershipProof = {
          url: proofFile[0].path,
          filename: proofFile[0].filename
        };
        newListing.ownershipType = "owner";
      }

      /* ===== SAVE ===== */
      await newListing.save();

      req.flash("success","Listing created successfully");
      res.redirect("/listings");

    } catch(err){
      console.log(err);
      req.flash("error","Something went wrong");
      res.redirect("/listings/new");
    }

});

// search API for navbar autocomplete

router.get("/api/search", async (req, res) => {
  try {

    const query = req.query.query?.trim();

    if (!query) {
      return res.json([]);
    }

    const listings = await Listing.find({
      $or: [
        { title: { $regex: query, $options: "i" } },
        { location: { $regex: query, $options: "i" } },
        { country: { $regex: query, $options: "i" } }
      ]
    })
    .limit(8)
    .select("title location country");

    res.json(listings);

  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

// Show single listing
router.get("/:id",isLoggedIn, async (req, res) => {
    try {
        const { id } = req.params;
        const listing = await Listing.findById(id).populate("owner");
        const reservedSuccess = req.query.reserved === "true";
        const showReserve = req.query.reserve === "true";   
        res.render("listings/show.ejs", { listing, reservedSuccess, showReserve });
    } catch (err) {
        console.log(err);
        res.send("Error fetching listing");
    }
});

// Edit form
router.get("/:id/edit",isLoggedIn, isOwner, async (req, res) => {
    try {
        const { id } = req.params;
        const listing = await Listing.findById(id);
        res.render("listings/edit.ejs", { listing });
    } catch (err) {
        console.log(err);
        res.send("Error fetching listing");
    }
});

router.put("/:id",isLoggedIn, isOwner, async (req, res) => {
    try {
        const { id } = req.params;
        await Listing.findByIdAndUpdate(id, { ...req.body.listing });
        res.redirect(`/listings/${id}`);
    } catch (err) {
        console.log(err);
        res.send("Error updating listing");
    }
});

// Delete listing
router.delete("/:id",isLoggedIn, isOwner, async (req, res) => {
    try {
        const { id } = req.params;
        await Listing.findByIdAndDelete(id);
        res.redirect("/listings");
    } catch (err) {
        console.log(err);
        res.send("Error deleting listing");
    }
});

// VERIFY OWNER (DEV ONLY)
router.post("/:id/verify-owner", isLoggedIn, async (req, res) => {

    try {

        if (req.user.role !== "dev") {
            req.flash("error", "Unauthorized action");
            return res.redirect("/listings");
        }

        const { id } = req.params;

        await Listing.findByIdAndUpdate(id, {
            verificationStatus: "verified"
        });

        req.flash("success", "Owner verified successfully");
        res.redirect(`/listings/${id}`);

    } catch (err) {
        console.log(err);
        req.flash("error", "Something went wrong");
        res.redirect("/listings");
    }

});

module.exports = router;
const mongoose = require("mongoose");

const listingSchema = new mongoose.Schema({
    title:{
        type: String,
        required: true,
    },
    description:{
        type: String,
        required: true,
    },

    images: [
   {
      url: String,
      filename: String
   }
 ],
    price:{
        type: Number,
        required: true,
    },

    roomPrice: {
    type:Number,
    default:0
    },

    totalRooms:{
    type:Number,
    required: true,
    default: 1,
    min: 1
    },
    
    maxGuests: {
    type: Number,
    required: true,
    default: 2,
    min: 1
    },

    location:{
        type: String,
        required: true,
    },
    country:{
    type: String,
    },

   geometry: {
    type: {
        type: String,
        enum: ["Point"],
        default: "Point",
        required: true,
    },
     coordinates: {
        type:[Number],
        required: true
      }
    },

    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    category: {
    type: String,
    enum: ["rent", "personal"],
    default: "rent"
    },

    ownershipProof: {
    url: String,
    filename: String
    },

    ownershipType: {
    type: String,
    enum: ["platform", "owner"],
    default: "platform"
    },

    verificationStatus: {
    type: String,
    enum: ["none", "pending", "verified", "rejected"],
    default: "none"
    },

    ownershipProofImage: {
    type: String,
    filename: String
    },

    isVerifiedOwner: {
    type: Boolean,
    default: false
    }

});

listingSchema.index({ geometry: "2dsphere" });

const Listing = mongoose.model("Listing", listingSchema);

module.exports = Listing;
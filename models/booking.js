const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bookingSchema = new Schema({

  listing: {
    type: Schema.Types.ObjectId,
    ref: "Listing",
    required: true,
    index: true
  },

  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  checkIn: {
    type: Date,
    required: true,
    index: true
  },

  checkOut: {
    type: Date,
    required: true,
    index: true
  },

  guests: {
    type: Number,
    default: 1,
    min: 1
  },

bookingType:{
  type:String,
  enum:["whole","room"],
  default:"whole"
},

roomsBooked:{
  type:Number,
  min:1,
  default:1
},

totalRooms: {
  type: Number,
  min:1,
  default:1
},

totalPrice: {
    type: Number,
    required: true,
    min: 0,
  },

  status: {
    type: String,
    enum: ["pending", "confirmed", "cancelled"],
    default: "pending"
  },

  paymentStatus: {
  type: String,
  enum: ["paid", "unpaid", "pending"],
  default: "unpaid"
},

  razorpayOrderId:   { type: String, default: null },
  razorpayPaymentId: { type: String, default: null },
    
  expiresAt: {
    type: Date,
    default: null
}

}, { timestamps: true });

bookingSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0,
    partialFilterExpression: {
      status: "pending"
    }
  }
);

module.exports = mongoose.model("Booking", bookingSchema);

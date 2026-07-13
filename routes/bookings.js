
"use strict";

const express  = require("express");
const crypto   = require("crypto");
const router   = express.Router();
const Booking  = require("../models/booking");
const Listing  = require("../models/listing");
const { isLoggedIn } = require("../middleware");

/* ═══════════════════════════════════════════════════════════════
   RAZORPAY INSTANCE  (lazy — graceful when keys are missing)
═══════════════════════════════════════════════════════════════ */
const Razorpay = require("razorpay");

let razorpay = null;

if (process.env.RAZORPAY_KEY && process.env.RAZORPAY_SECRET) {
  razorpay = new Razorpay({
    key_id:     process.env.RAZORPAY_KEY,
    key_secret: process.env.RAZORPAY_SECRET,
  });
} else {
  console.warn("⚠️  Razorpay not configured — set RAZORPAY_KEY + RAZORPAY_SECRET in .env");
}

/* ═══════════════════════════════════════════════════════════════
   HELPER — wrap async route handlers to catch unhandled errors
═══════════════════════════════════════════════════════════════ */
const asyncWrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);


/* ═══════════════════════════════════════════════════════════════
   1.  POST /listings/:id/book
       Create a pending booking then redirect to /reserve page.
       Called via AJAX from show.ejs booking card.
═══════════════════════════════════════════════════════════════ */

router.post("/listings/:id/book", isLoggedIn, asyncWrap(async (req, res) => {

  const listing = await Listing.findById(req.params.id);
  if (!listing) {
    return res.json({ success: false, message: "Listing not found" });
  }

  if (listing.owner.equals(req.user._id)) {
    return res.json({ success: false, message: "You cannot book your own property" });
  }

  const { checkIn, checkOut, guests, bookingType, roomsBooked } = req.body;

  const newCheckIn  = new Date(checkIn);
  const newCheckOut = new Date(checkOut);
  newCheckIn.setHours(0, 0, 0, 0);
  newCheckOut.setHours(0, 0, 0, 0);

  if (isNaN(newCheckIn) || isNaN(newCheckOut)) {
    return res.json({ success: false, message: "Invalid date format" });
  }

  if (newCheckIn >= newCheckOut) {
    return res.json({ success: false, message: "Check-out must be after check-in" });
  }

  /* ── Overlap check ── */
  const overlapping = await Booking.find({
    listing: req.params.id,
    status:  "confirmed",
    checkIn:  { $lt: newCheckOut },
    checkOut: { $gt: newCheckIn },
  });

  let selectedRooms = 1;

  if (bookingType === "room") {
    selectedRooms = Number(roomsBooked) || 1;

    if (selectedRooms < 1 || selectedRooms > listing.totalRooms) {
      return res.json({ success: false, message: "Invalid room selection" });
    }

    if (overlapping.some(b => b.bookingType === "whole")) {
      return res.json({ success: false, message: "Property is fully reserved for those dates" });
    }

    const roomsTaken = overlapping.reduce((sum, b) => sum + (b.roomsBooked || 1), 0);
    if (roomsTaken + selectedRooms > listing.totalRooms) {
      return res.json({ success: false, message: "Not enough rooms available" });
    }

  } else {
    if (overlapping.length > 0) {
      return res.json({ success: false, message: "Already booked for selected dates" });
    }
  }

  /* ── Price calculation ── */
  const days = Math.ceil((newCheckOut - newCheckIn) / 86400000);
  let totalPrice;

  if (bookingType === "room") {
    const roomPrice = listing.price / (listing.totalRooms || 1);
    totalPrice = Math.round(roomPrice * selectedRooms * days);
  } else {
    totalPrice = listing.price * days;
  }

  /* ── Create pending booking ── */
  const booking = new Booking({
    listing:       req.params.id,
    user:          req.user._id,
    checkIn:       newCheckIn,
    checkOut:      newCheckOut,
    guests:        Number(guests) || 1,
    bookingType:   bookingType || "whole",
    roomsBooked:   selectedRooms,
    totalPrice,
    status:        "pending",
    paymentStatus: "unpaid",

    expiresAt: new Date(Date.now() + 15 * 60 * 1000)
  });

  await booking.save();

  /* AJAX response → show.ejs JS will redirect */
  return res.json({
    success:  true,
    redirect: `/bookings/${booking._id}/reserve`,
  });

}));


/* ═══════════════════════════════════════════════════════════════
   2.  GET /bookings/:id/reserve
       Show booking summary + Pay Now / Pay at Property choice.
       → views/bookings/reserve.ejs
═══════════════════════════════════════════════════════════════ */

router.get("/bookings/:id/reserve", isLoggedIn, asyncWrap(async (req, res) => {

  const booking = await Booking.findById(req.params.id)
    .populate("listing")
    .populate("user");

   
  if (!booking) {
    req.flash("error", "Booking not found.");
    return res.redirect("/listings");
  }

    if (
    booking.status === "pending" &&
    booking.expiresAt &&
    booking.expiresAt < new Date()
  ) {
    booking.status = "cancelled";
    await booking.save();

    req.flash("error", "This booking session has expired.");
    return res.redirect("/listings");
  }

  if (!booking.user._id.equals(req.user._id)) {
    req.flash("error", "Unauthorised.");
    return res.redirect("/listings");
  }

  /* Already confirmed → go straight to success */
  if (booking.status === "confirmed") {
    return res.redirect(`/bookings/${booking._id}/success`);
  }

  res.render("bookings/reserve", { booking, currentUser: req.user });

}));


/* ═══  3.  POST /bookings/:id/choose-payment ═══ */

router.post("/bookings/:id/choose-payment", isLoggedIn, asyncWrap(async (req, res) => {

  const booking = await Booking.findById(req.params.id).populate("listing");

  if (!booking) {
    req.flash("error", "Booking not found.");
    return res.redirect("/listings");
  }

  if (!booking.user.equals(req.user._id)) {
    req.flash("error", "Unauthorised.");
    return res.redirect("/listings");
  }

  const { paymentMethod } = req.body;

  /* ── Pay at property ── */
  if (paymentMethod === "property") {
    if (booking.status !== "pending" || (booking.expiresAt && booking.expiresAt < new Date())) {
      if (booking.status === "pending") {
        booking.status = "cancelled";
        await booking.save();
      }

      req.flash("error", "This booking session has expired. Please start again.");
      return res.redirect("/listings");
    }

    if (!booking.listing) {
      req.flash("error", "This listing is no longer available.");
      return res.redirect("/listings");
    }

    // Availability can change while a booking is pending, so check again

    const overlapping = await Booking.find({
      _id: { $ne: booking._id },
      listing: booking.listing._id,
      status: "confirmed",
      checkIn: { $lt: booking.checkOut },
      checkOut: { $gt: booking.checkIn },
    });

    if (booking.bookingType === "whole" && overlapping.length > 0) {
      req.flash("error", "This property is no longer available for those dates.");
      return res.redirect("/listings");
    }

    if (booking.bookingType === "room") {
      const hasWholeBooking = overlapping.some(item => item.bookingType === "whole");
      const roomsTaken = overlapping
        .filter(item => item.bookingType === "room")
        .reduce((sum, item) => sum + (item.roomsBooked || 1), 0);

      if (hasWholeBooking || roomsTaken + booking.roomsBooked > booking.listing.totalRooms) {
        req.flash("error", "The selected rooms are no longer available for those dates.");
        return res.redirect("/listings");
      }
    }

    booking.status        = "confirmed";
    booking.paymentStatus = "pending";   /* pending = due at check-in */
    await booking.save();
    return res.redirect(`/bookings/${booking._id}/success?payAtProperty=true`);
  }

  /* ── Pay online: create Razorpay order ── */
  if (!razorpay) {
    req.flash("error", "Payment system is not configured. Please try Pay at Property.");
    return res.redirect(`/bookings/${booking._id}/reserve`);
  }

  const order = await razorpay.orders.create({
    amount:   booking.totalPrice * 100,     /* paise */
    currency: "INR",
    receipt:  `locara_${booking._id}`,
    notes: {
      bookingId: booking._id.toString(),
      userId:    req.user._id.toString(),
    },
  });

  booking.razorpayOrderId = order.id;
  await booking.save();

  return res.redirect(`/bookings/${booking._id}/payment`);

}));


/* ═══════ 4.  GET /bookings/:id/payment ══════ */

router.get("/bookings/:id/payment", isLoggedIn, asyncWrap(async (req, res) => {

  const booking = await Booking.findById(req.params.id)
    .populate("listing")
    .populate("user");

  if (!booking) {
    req.flash("error", "Booking not found.");
    return res.redirect("/listings");
  }

  if (!booking.user._id.equals(req.user._id)) {
    req.flash("error", "Unauthorised.");
    return res.redirect("/listings");
  }

  if (!booking.razorpayOrderId) {
    /* No order yet — send back to reserve */
    return res.redirect(`/bookings/${booking._id}/reserve`);
  }

  if (!razorpay) {
    return res.send("⚠️ Payment system not configured. Contact support.");
  }

  res.render("bookings/payment", {
    booking,
    currentUser:     req.user,
    razorpayKeyId:   process.env.RAZORPAY_KEY,
    razorpayOrderId: booking.razorpayOrderId,
  });

}));


/* ═══════  5.  POST /bookings/:id/verify-payment ═══════ */

router.post("/bookings/:id/verify-payment", isLoggedIn, asyncWrap(async (req, res) => {

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  /* ── 1. HMAC-SHA256 signature verification ── */

  const expectedSig = crypto
    .createHmac("sha256", process.env.RAZORPAY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSig !== razorpay_signature) {
    return res.status(400).json({
      success: false,
      message: "Payment verification failed — signature mismatch.",
    });
  }

  /* ── 2. Find booking by Razorpay order ID ── */

  const booking = await Booking.findOne({ razorpayOrderId: razorpay_order_id });

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: "No booking found for this payment.",
    });
  }

  if (!booking._id.equals(req.params.id) || !booking.user.equals(req.user._id)) {
    return res.status(403).json({
      success: false,
      message: "Unauthorised payment verification request.",
    });
  }

// overlap check
  const overlapping = await Booking.find({
    _id: { $ne: booking._id },

    listing: booking.listing,

    status: "confirmed",

    checkIn: { $lt: booking.checkOut },
    checkOut: { $gt: booking.checkIn }
  });

  // when booking type is whole, check if there are any overlapping bookings. If so, return a 409 conflict response.

    if (booking.bookingType === "whole") {
    if (overlapping.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Property is no longer available."
      });
    }
  }

  // when booking type is room, check if there are any overlapping bookings of type whole. If so, return a 409 conflict response. Then check if the total number of rooms booked exceeds the total number of rooms available. If so, return a 409 conflict response.
  const listing = await Listing.findById(booking.listing);

  if (booking.bookingType === "room") {

    if (overlapping.some(b => b.bookingType === "whole")) {
      return res.status(409).json({
        success: false,
        message: "Property is fully booked."
      });
    }

    const roomsTaken = overlapping
      .filter(b => b.bookingType === "room")
      .reduce((sum, b) => sum + (b.roomsBooked || 1), 0);

    if (roomsTaken + booking.roomsBooked > listing.totalRooms) {
      return res.status(409).json({
        success: false,
        message: "Rooms are no longer available."
      });
    }
  }

  /* ── 3. Idempotency guard + confirm ── */
  if (booking.paymentStatus !== "paid") {
    booking.status            = "confirmed";
    booking.paymentStatus     = "paid";
    booking.razorpayPaymentId = razorpay_payment_id;
    await booking.save();
  }

  return res.json({ success: true });

}));


/* ═════ 6.  GET /bookings/:id/success ══════ */
router.get("/bookings/:id/success", isLoggedIn, asyncWrap(async (req, res) => {

  const booking = await Booking.findById(req.params.id)
    .populate("listing")
    .populate("user");

  if (!booking) {
    req.flash("error", "Booking not found.");
    return res.redirect("/listings");
  }

  if (!booking.user._id.equals(req.user._id)) {
    req.flash("error", "Unauthorised.");
    return res.redirect("/listings");
  }

  if (booking.status !== "confirmed") {
    if (booking.status === "pending") {
      req.flash("error", "Complete your payment before viewing the booking confirmation.");
      return res.redirect(`/bookings/${booking._id}/reserve`);
    }

    req.flash("error", "This booking has been cancelled.");
    return res.redirect("/listings");
  }

  const payAtProperty =
    req.query.payAtProperty === "true" ||
    booking.paymentStatus === "pending";

  res.render("bookings/success", {
    booking,
    currentUser: req.user,
    payAtProperty,
  });

}));


/* ════  7.  GET /my-bookings Current user's booking history.════ */
router.get("/my-bookings", isLoggedIn, asyncWrap(async (req, res) => {

  const bookings = await Booking.find({ user: req.user._id })
    .populate("listing")
    .sort({ createdAt: -1 });

    console.log(bookings[0]?.listing);
  res.render("bookings/index", { bookings, currentUser: req.user });

}));


/* ═════ 8.  PATCH /bookings/:id/cancel ═════ */
router.patch("/bookings/:id/cancel", isLoggedIn, asyncWrap(async (req, res) => {

  const booking = await Booking.findById(req.params.id);

  if (!booking || !booking.user.equals(req.user._id)) {
    return res.json({ success: false, message: "Unauthorised" });
  }

  if (booking.status === "confirmed" && booking.paymentStatus === "paid") {
    /* Refund handling would go here if needed */
  }

  booking.status = "cancelled";
  await booking.save();

  return res.json({ success: true, message: "Booking cancelled" });

}));


/* ════  9.  DELETE /bookings/:id ══════ */

router.delete("/bookings/:id", isLoggedIn, asyncWrap(async (req, res) => {

  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return res.json({ success: false, message: "Not found" });
  }

  if (!booking.user.equals(req.user._id)) {
    return res.json({ success: false, message: "Unauthorised" });
  }

  if (
    booking.status !== "pending" &&
    booking.status !== "cancelled"
  ) {
    return res.json({
      success: false,
      message: "Only pending or cancelled bookings can be deleted"
    });
}

  await booking.deleteOne();

  return res.json({ success: true });

}));


/* ══════ GLOBAL ERROR HANDLER for this router ══════ */
router.use((err, req, res, next) => {
  console.error("[booking.js]", err);
  /* JSON routes */
  if (req.headers["content-type"]?.includes("application/json")) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
  req.flash?.("error", "Something went wrong. Please try again.");
  res.redirect("/listings");
});


module.exports = router;

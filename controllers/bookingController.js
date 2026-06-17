/**
 * LOCARA — bookingController.js
 * Handles: reserve page, payment choice, Razorpay order creation,
 *          payment verification, success page, pay-at-property flow.
 */

const crypto   = require("crypto");
const Razorpay = require("razorpay");
const Booking  = require("../models/booking");  

/* ── Razorpay instance ─────────────────────────────────────── */
const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* ─────────────────────────────────────────────────────────────
   GET /bookings/:id/reserve
   Show booking summary + pay-now / pay-at-property choice
───────────────────────────────────────────────────────────── */
exports.showReserve = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("listing")
      .populate("user");

    if (!booking) {
      req.flash("error", "Booking not found.");
      return res.redirect("/listings");
    }

    /* Only the booking owner can view this page */
    if (!booking.user._id.equals(req.user._id)) {
      req.flash("error", "Unauthorised.");
      return res.redirect("/listings");
    }

    /* Booking must still be pending */
    if (booking.status !== "pending") {
      return res.redirect(`/bookings/${booking._id}/success`);
    }

    res.render("reserve", { booking, currentUser: req.user });
  } catch (err) {
    console.error("[showReserve]", err);
    req.flash("error", "Something went wrong.");
    res.redirect("/listings");
  }
};

/* ─────────────────────────────────────────────────────────────
   POST /bookings/:id/choose-payment
   Body: { paymentMethod: "online" | "property" }
───────────────────────────────────────────────────────────── */
exports.choosePayment = async (req, res) => {
  try {
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

    /* ── Case 1: Pay at property ── */
    if (paymentMethod === "property") {
      booking.status        = "confirmed";
      booking.paymentStatus = "pending";  /* pending = due at property */
      await booking.save();

      return res.redirect(`/bookings/${booking._id}/success?payAtProperty=true`);
    }

    /* ── Case 2: Pay now — create Razorpay order ── */
    const order = await razorpay.orders.create({
      amount:   booking.totalPrice * 100,         /* paise */
      currency: "INR",
      receipt:  `locara_${booking._id}`,
      notes: {
        bookingId: booking._id.toString(),
        userId:    req.user._id.toString(),
      },
    });

    /* Persist order ID so we can verify later */
    booking.razorpayOrderId = order.id;
    await booking.save();

    return res.redirect(`/bookings/${booking._id}/payment`);
  } catch (err) {
    console.error("[choosePayment]", err);
    req.flash("error", "Could not process request. Please try again.");
    res.redirect(`/bookings/${req.params.id}/reserve`);
  }
};

/* ─────────────────────────────────────────────────────────────
   GET /bookings/:id/payment
   Show the premium Razorpay payment UI
───────────────────────────────────────────────────────────── */
exports.showPayment = async (req, res) => {
  try {
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

    /* If no Razorpay order exists, redirect to reserve */
    if (!booking.razorpayOrderId) {
      return res.redirect(`/bookings/${booking._id}/reserve`);
    }

    res.render("payment", {
      booking,
      currentUser:      req.user,
      razorpayKeyId:    process.env.RAZORPAY_KEY_ID,
      razorpayOrderId:  booking.razorpayOrderId,
    });
  } catch (err) {
    console.error("[showPayment]", err);
    req.flash("error", "Something went wrong.");
    res.redirect("/listings");
  }
};

/* ─────────────────────────────────────────────────────────────
   POST /bookings/:id/verify-payment
   Body (JSON): { razorpay_order_id, razorpay_payment_id, razorpay_signature }
   CRITICAL: Always verify signature before confirming booking.
───────────────────────────────────────────────────────────── */
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    /* ── 1. Signature verification ── */
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed. Signature mismatch.",
      });
    }

    /* ── 2. Find booking by Razorpay order ID ── */
    const booking = await Booking.findOne({
      razorpayOrderId: razorpay_order_id
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found for this payment.",
      });
    }

    /* ── 2.5 Verify order amount ── */
    
    const order = await razorpay.orders.fetch(
      razorpay_order_id
    );

    if (order.amount !== booking.totalPrice * 100) {
      return res.status(400).json({
        success: false,
        message: "Amount mismatch"
      });
    }

    /* ── 3. Confirm only if still pending ── */
   if (booking.paymentStatus !== "paid") {

      booking.status = "confirmed";
      booking.paymentStatus = "paid";

      booking.razorpayPaymentId = razorpay_payment_id;
      booking.razorpaySignature = razorpay_signature;

      booking.paidAt = new Date();

      await booking.save();
  }

    return res.json({ success: true });
      
    } catch (err) {
      console.error("[verifyPayment]", err);
      return res.status(500).json({
        success: false,
        message: "Server error during verification. Please contact support.",
      });
    }
  };

/* ─────────────────────────────────────────────────────────────
   GET /bookings/:id/success
   Show the confirmation / success page
───────────────────────────────────────────────────────────── */
exports.showSuccess = async (req, res) => {
  try {
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

    const payAtProperty = req.query.payAtProperty === "true"
      || booking.paymentStatus === "pending";

    res.render("success", {
      booking,
      currentUser:   req.user,
      payAtProperty,
    });
  } catch (err) {
    console.error("[showSuccess]", err);
    req.flash("error", "Something went wrong.");
    res.redirect("/listings");
  }
};

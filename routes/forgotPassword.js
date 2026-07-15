// FORGOT / RESET PASSWORD ROUTES 

const express = require("express");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const router = express.Router();

const User = require("../models/user");

/*  EMAIL TRANSPORTER */

  const requiredEnv = [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASS",
  ];

  for (const key of requiredEnv) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: 465,
      secure: true,
      family: 4,
      auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
  });

/* POST /forgot-password */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      // Still return success — never reveal whether email exists
      return res.json({ success: true });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (user) {
      // Generate cryptographically secure token
      const token  = crypto.randomBytes(32).toString("hex");
      const expiry = Date.now() + 15 * 60 * 1000; // 15 minutes

      // Save to user document
      user.resetPasswordToken  = token;
      user.resetPasswordExpiry = expiry;
      await user.save();

      // Build reset URL
      const baseUrl   = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5050}`;
      const resetLink = `${baseUrl}/reset-password/${token}`;
      
      // Send email
      const info = await transporter.sendMail({
        from: `"Locara" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: "Reset your Locara password",
        html: `
          <div style="font-family: 'DM Sans', sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 32px; background: #f6f5f7; border-radius: 16px;">
            <h1 style="font-size: 1.4rem; color: #1a1a2e; margin-bottom: 8px;">Reset your password</h1>
            <p style="color: #64748b; font-size: 0.9rem; line-height: 1.6; margin-bottom: 28px;">
              We received a request to reset the password for your Locara account.
              Click the button below to set a new password.
              This link expires in <strong>15 minutes</strong>.
            </p>
            <a href="${resetLink}"
               style="display: inline-block; background: #6366f1; color: #fff;
                      padding: 13px 36px; border-radius: 12px; text-decoration: none;
                      font-weight: 700; font-size: 0.88rem; letter-spacing: 0.06em;">
              Reset Password
            </a>
            <p style="color: #94a3b8; font-size: 0.78rem; margin-top: 28px; line-height: 1.5;">
              If you didn't request this, you can safely ignore this email.
              Your password won't change.
            </p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
            <p style="color: #cbd5e1; font-size: 0.75rem;">
              © 2026 Locara · Developed by Mr.A
            </p>
          </div>
        `,
      });
    }
    // Always return success
    res.json({ success: true });

  } catch (err) {
    console.error("Forgot password error:", err);
    // Return success even on error — prevents enumeration
    res.json({ success: true });
  }
});

/*  GET /reset-password/:token */
router.get("/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      resetPasswordToken:  token,
      resetPasswordExpiry: { $gt: Date.now() }, // not expired
    });

    if (!user) {
      // Token invalid or expired — render error state
      return res.render("users/reset-password", {
        token: null,
        error: "This reset link is invalid or has expired.",
      });
    }

    res.render("users/reset-password", { token, error: null });

  } catch (err) {
    console.error("Reset password GET error:", err);
    res.render("users/reset-password", {
      token: null,
      error: "Something went wrong. Please try again.",
    });
  }
});

/*  POST /reset-password  */
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;

    // Basic validation
    if (!password || password.length < 8) {
      return res.render("users/reset-password", {
        token,
        error: "Password must be at least 8 characters.",
      });
    }
    if (password !== confirmPassword) {
      return res.render("users/reset-password", {
        token,
        error: "Passwords do not match.",
      });
    }

    const user = await User.findOne({
      resetPasswordToken:  token,
      resetPasswordExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.render("auth/reset-password", {
        token: null,
        error: "This reset link is invalid or has expired.",
      });
    }

    // Update password — passport-local-mongoose provides setPassword()
    // If you're hashing manually: user.password = bcrypt.hashSync(password, 12)

    user.password = password;

    // Clear reset fields so token can't be reused
    user.resetPasswordToken  = undefined;
    user.resetPasswordExpiry = undefined;
    await user.save();

    // Flash success and redirect to login
    req.flash("success", "Password updated! You can now sign in.");
    res.redirect("/login");

  } catch (err) {
    console.error("Reset password POST error:", err);
    res.render("users/reset-password", {
      token: req.body.token,
      error: "Something went wrong. Please try again.",
    });
  }
});

module.exports = router;

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/user");
require("dotenv").config();

async function resetPassword() {
  await mongoose.connect("mongodb://127.0.0.1:27017/staynest");

  const hashedPassword = await bcrypt.hash("Dev@12345", 10);

  await User.updateOne(
    { username: "mrankit" },
    { $set: { password: hashedPassword } }
  );

  console.log("✅ Dev password reset successfully");
  process.exit();
}

resetPassword();
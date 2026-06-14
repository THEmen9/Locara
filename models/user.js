const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
   username: {
      type: String,
      required: true,
      unique: true
   },
   email: {
      type: String,
      required: true,
      unique: true
   },
      
   password: {
      type: String,
      required: true
   },
   
   role: {
   type: String,
   enum: ["user", "dev"],
   default: "user"
  },

   resetPasswordToken: {
      type: String
   },
   resetPasswordExpiry: {
      type: Date
   }
});

// hash password before save
userSchema.pre("save", async function(next){
   if(!this.isModified("password")) return next();
   this.password = await bcrypt.hash(this.password, 10);
   next();
});

// compare password
userSchema.methods.comparePassword = async function(password){
   return bcrypt.compare(password, this.password);
};

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
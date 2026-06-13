require("dotenv").config();
console.log("SMTP_USER:", process.env.SMTP_USER);
console.log("SMTP_PASS:", process.env.SMTP_PASS);
const express = require("express");
const mongoose = require("mongoose");
console.log("Mongoose runtime version:", mongoose.version);


const path = require("path");
const expressLayouts = require("express-ejs-layouts");
const methodOverride = require("method-override");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const flash = require("connect-flash");


const passport = require("passport");



const listingRoutes = require("./routes/listings");
const userRoutes = require("./routes/users");
const User = require("./models/user");
const bookingRoutes = require("./routes/bookings");


const app = express();
const PORT = 5050;

// View engine setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layouts/boilerplate");

// Static files
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));
app.use(express.static(path.join(__dirname, "public")));

// Body parser middleware
app.use(methodOverride("_method"));

// Session & flash middleware
const store = MongoStore.create({
  mongoUrl: "mongodb://127.0.0.1:27017/staynest",
  crypto: { secret: "staynestsecret" }
});

app.use(session({
  secret: "staynestsecret",
  resave: false,
  saveUninitialized: false,
  store,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

app.use(flash());

// Passport authentication
app.use(passport.initialize());
app.use(passport.session());
const LocalStrategy = require("passport-local").Strategy;

passport.use(new LocalStrategy(async (username, password, done)=>{
   try{
      const user = await User.findOne({ username });
      if(!user) return done(null,false,{ message:"Invalid username" });

      const isMatch = await user.comparePassword(password);
      if(!isMatch) return done(null,false,{ message:"Wrong password" });

      return done(null,user);
   }catch(err){
      return done(err);
   }
}));

passport.serializeUser((user,done)=>{
   done(null,user.id);
});

passport.deserializeUser(async(id,done)=>{
   try{
      const user = await User.findById(id);
      done(null,user);
   }catch(err){
      done(err);
   }
});

// Locals middleware
app.use((req, res, next) => {
     res.locals.currentUser = req.user;
     res.locals.success = req.flash("success");
     res.locals.error = req.flash("error");
     
     res.locals.filters = req.query || {};
     res.locals.currPath = req.path;
     next();
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Routes

const forgotRoutes = require("./routes/forgotPassword");

app.use("/", forgotRoutes);

app.use("/", userRoutes);

app.use("/listings", listingRoutes);

app.use("/",bookingRoutes);


app.get("/", (req, res) => {
    res.send("StayNest running");
});

app.get("/listings", async (req,res)=>{
   let { search } = req.query;
   let filter = {};

   if(search){
      filter.title = { $regex: search, $options: "i" };
   }

   let allListings = await Listing.find(filter);
   res.render("listings/index",{allListings});
});



// Database connection
async function connectDB() {
    try {
        await mongoose.connect("mongodb://127.0.0.1:27017/staynest", {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 5000
        });
        console.log("MongoDB Connected");
    } catch (err) {
        console.log("Database connection error:", err.message);
    }
}

connectDB();

// Start server
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});

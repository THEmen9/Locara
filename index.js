require("dotenv").config();

if (!process.env.MONGO_URL) {
  throw new Error("MONGO_URL environment variable is missing");
}
const dbUrl = process.env.MONGO_URL;
console.log("Environment variables loaded");
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
const PORT = process.env.PORT || 5050;

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
  mongoUrl: dbUrl,
  crypto: {
    secret: process.env.SESSION_SECRET || "staynestsecret"
  }
});

app.use(session({
  secret: process.env.SESSION_SECRET || "staynestsecret",
  resave: false,
  saveUninitialized: false,
  store,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000
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

// Home route

app.get("/", (req, res) => {
    res.redirect("/listings");
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR:");
  console.error(err);

  res.status(err.status || 500).send(
    err.message || "Internal Server Error"
  );
});

// Database connection

async function connectDB() {
    try {
        const dbUrl = process.env.MONGO_URL;

        console.log("Connecting to:", dbUrl.split("@")[1]);

        await mongoose.connect(dbUrl, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 5000
        });

        console.log("MongoDB Connected");
        console.log("Database:", mongoose.connection.name);

    } catch (err) {
        console.log("Database connection error:", err.message);
        console.error(err);
    }
}

connectDB();

// Start server
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});

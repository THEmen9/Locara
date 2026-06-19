require("dns").setDefaultResultOrder("ipv4first");
require("dns").setServers(["8.8.8.8", "8.8.4.4"]);
require("dotenv").config();

// ─── Environment Validation ────────────────────────────────────────────────────
const REQUIRED_ENV = [
  "MONGO_URL",
  "SESSION_SECRET",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length) {
  throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}

// ─── Core Imports ──────────────────────────────────────────────────────────────
const express        = require("express");
const mongoose       = require("mongoose");
const path           = require("path");
const expressLayouts = require("express-ejs-layouts");
const methodOverride = require("method-override");
const session        = require("express-session");
const MongoStore     = require("connect-mongo").default;
const flash          = require("connect-flash");
const passport       = require("passport");
const LocalStrategy  = require("passport-local").Strategy;

// ─── Route Imports ─────────────────────────────────────────────────────────────
const listingRoutes  = require("./routes/listings");
const userRoutes     = require("./routes/users");
const bookingRoutes  = require("./routes/bookings");
const forgotRoutes   = require("./routes/forgotPassword");
const User           = require("./models/user");

// ─── App Init ─────────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 5050;

// ─── View Engine ──────────────────────────────────────────────────────────────
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layouts/boilerplate");

// ─── Static Files ─────────────────────────────────────────────────────────────
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));
app.use(express.static(path.join(__dirname, "public")));

// ─── Body Parsers (MUST be before routes and methodOverride) ──────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ─── Method Override (needs body already parsed to read _method) ──────────────
app.use(methodOverride("_method"));

// ─── Session Store ────────────────────────────────────────────────────────────
const store = MongoStore.create({
  mongoUrl: process.env.MONGO_URL,
  dbName: "staynest",                        // explicit — never falls back to "test"
  crypto: {
    secret: process.env.SESSION_SECRET,
  },
  touchAfter: 24 * 60 * 60,                 // lazy session update (seconds)
});

store.on("error", (err) => {
  console.error("Session store error:", err);
});

// ─── Session ──────────────────────────────────────────────────────────────────
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store,
    cookie: {
      maxAge:   7 * 24 * 60 * 60 * 1000,   // 7 days
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
    },
  })
);

// ─── Flash ────────────────────────────────────────────────────────────────────
app.use(flash());

// ─── Passport ─────────────────────────────────────────────────────────────────
app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await User.findOne({ username });
      if (!user) return done(null, false, { message: "Invalid username" });

      const isMatch = await user.comparePassword(password);
      if (!isMatch) return done(null, false, { message: "Wrong password" });

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// ─── Locals Middleware ────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.success     = req.flash("success");
  res.locals.error       = req.flash("error");
  res.locals.filters     = req.query || {};
  res.locals.currPath    = req.path;
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/", forgotRoutes);
app.use("/", userRoutes);
app.use("/listings", listingRoutes);
app.use("/", bookingRoutes);

// Home redirect
app.get("/", (req, res) => res.redirect("/listings"));

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR:", err);
  res.status(err.status || 500).send(err.message || "Internal Server Error");
});

// ─── Database Connection ──────────────────────────────────────────────────────
async function connectDB() {
  try {
    const dbUrl = process.env.MONGO_URL;

    // Log host only — never log credentials
    const hostPart = dbUrl.split("@")[1];
    console.log("Connecting to:", hostPart);

    await mongoose.connect(dbUrl, {
      dbName: "locara",                    // ← THE CRITICAL FIX
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS:          45000,
    });

    console.log("✅ MongoDB Connected");
    console.log("   Database:   ", mongoose.connection.name);   // must print "locara"
    console.log("   Mongoose v :", mongoose.version);

    const cols = await mongoose.connection.db.listCollections().toArray();
    console.log("   Collections:", cols.map((c) => c.name));

  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1);                         // crash fast — Render will restart
  }
}

connectDB();

// ─── Server ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});
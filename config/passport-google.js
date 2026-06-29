const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/user");

module.exports = function (passport) {

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/auth/google/callback",
      },

      async (accessToken, refreshToken, profile, done) => {
        try {

          let user = await User.findOne({
            googleId: profile.id,
          });

          if (user) {

            user.avatar = profile.photos?.[0]?.value || user.avatar;

            await user.save();

            return done(null, user);
          }

          const email = profile.emails?.[0]?.value;

          user = await User.findOne({ email });

          if (user) {
          user.googleId = profile.id;
          user.provider = "google";
          user.avatar = profile.photos?.[0]?.value || user.avatar;

          await user.save();

          return done(null, user);
        }

        const newUser = await User.create({
          googleId: profile.id,
          provider: "google",

          username: profile.displayName.replace(/\s+/g, "").toLowerCase(),

          email,

          avatar: profile.photos?.[0]?.value || "",

          password: Math.random().toString(36),

          isProfileCompleted: false,
        });

          return done(null, newUser);

        } catch (err) {
          return done(err, null);
        }
      }
    )
  );

};
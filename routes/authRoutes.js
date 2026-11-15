// routes/authRoutes.js
import express from "express";
import passport from "passport";
import GoogleStrategy from "passport-google-oauth2";
import LocalStrategy from "passport-local";
import bcrypt from "bcrypt";
import db from "../config/db.js";

const router = express.Router();

// Helper: Normalize Google OAuth Callback URL
const getGoogleCallbackURL = () => {
  const envUrl = (process.env.GOOGLE_CALLBACK_URL || "").trim();
  if (!envUrl) {
    return "http://localhost:3000/auth/google/secrets";
  }
  if (!envUrl.includes("/auth/google/secrets")) {
    const baseUrl = envUrl.replace(/\/+$/, "");
    return `${baseUrl}/auth/google/secrets`;
  }
  return envUrl;
};

// ---------- Google OAuth Strategy ----------
passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: getGoogleCallbackURL(),
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        const result = await db.query("SELECT * FROM users WHERE email = $1", [
          profile.email,
        ]);

        if (result.rows.length === 0) {
          const newUser = await db.query(
            "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *",
            [profile.displayName, profile.email]
          );
          return cb(null, newUser.rows[0]);
        } else {
          return cb(null, result.rows[0]);
        }
      } catch (err) {
        return cb(err);
      }
    }
  )
);

// ---------- Local Strategy (Email & Password) ----------
passport.use(
  "local",
  new LocalStrategy(async (username, password, cb) => {
    try {
      const email = username ? username.trim().toLowerCase() : "";
      const result = await db.query("SELECT * FROM users WHERE email = $1", [
        email,
      ]);

      if (result.rows.length === 0) {
        return cb(null, false, { message: "No account found with this email." });
      }

      const user = result.rows[0];

      if (!user.password) {
        return cb(null, false, {
          message: "Account was created via Google. Please log in with Google.",
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (isMatch) {
        return cb(null, user);
      } else {
        return cb(null, false, { message: "Incorrect password." });
      }
    } catch (err) {
      return cb(err);
    }
  })
);

passport.serializeUser((user, cb) => cb(null, user.id));
passport.deserializeUser(async (id, cb) => {
  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
    cb(null, result.rows.length > 0 ? result.rows[0] : false);
  } catch (err) {
    cb(err);
  }
});

// ---------- Local Auth Routes ----------
router.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/index",
    failureRedirect: "/login",
  })
);

router.post("/register", async (req, res) => {
  const email = (req.body.username || "").trim().toLowerCase();
  const password = req.body.password;
  const name = (req.body.name || "").trim() || email.split("@")[0] || "User";

  if (!email || !password) {
    return res.redirect("/register");
  }

  try {
    const checkUser = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (checkUser.rows.length > 0) {
      // User already exists, redirect to login
      return res.redirect("/login");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *",
      [name, email, hashedPassword]
    );

    const newUser = result.rows[0];

    // Automatically log in the newly registered user
    req.login(newUser, (err) => {
      if (err) {
        console.error("Auto-login error after registration:", err);
        return res.redirect("/login");
      }
      return res.redirect("/index");
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.redirect("/register");
  }
});

// ---------- Google OAuth Routes ----------
router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/auth/google/secrets",
  passport.authenticate("google", {
    successRedirect: "/index",
    failureRedirect: "/login",
  })
);

router.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect("/");
  });
});

router.get("/index", (req, res) => {
  if (req.isAuthenticated()) {
    console.log("Authenticated user:", req.user.name);
    res.render("index", { username: req.user.name });
  } else {
    res.render("home");
  }
});

export default router;

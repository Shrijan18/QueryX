// routes/historyRoutes.js
import express from "express";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import db from "../config/db.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const chatHistoryPath = path.join(__dirname, "../chat.json");

// ---------- Fetch History ----------

router.get("/history", async (req, res) => {
  if (!req.isAuthenticated()) return res.redirect("/login");

  try {
    const result = await db.query(
      `SELECT user_msg, bot_msg, created_at
     FROM history
     WHERE users_id = $1
     ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.render("history", { fault: result.rows, username: req.user.name });

  } catch (error) {
    console.error("History error:", error);
    res.render("history", { fault: [], username: req.user?.name || "Guest" });
  }
});


// ---------- Clear History ----------
router.post("/clear-history", async (req, res) => {
  try {
    await db.query("DELETE FROM history WHERE users_id = $1", [req.user.id]);
    res.status(200).send("History cleared");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

export default router;

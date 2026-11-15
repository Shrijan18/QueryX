// server.js
import express from "express";
import passport from "passport";
import bodyParser from "body-parser";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import Tesseract from "tesseract.js";

import db from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import historyRoutes from "./routes/historyRoutes.js";
import proRoutes from "./routes/proRoutes.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Middlewares ----------
app.use(
  session({
    secret: process.env.SESSION_SECRET || "default_session_secret_change_in_prod",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  })
);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(passport.initialize());
app.use(passport.session());

// Configure multer storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

async function extractTextFromFile(filePath, originalname) {
  const ext = (originalname.split(".").pop() || "").toLowerCase();

  if (ext === "pdf") {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text || "";
  }

  if (ext === "docx") {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || "";
  }

  if (ext === "txt") {
    return fs.readFileSync(filePath, "utf-8");
  }

  if (["png", "jpg", "jpeg", "bmp", "webp"].includes(ext)) {
    try {
      const {
        data: { text },
      } = await Tesseract.recognize(filePath, "eng");
      return text || "";
    } catch (ocrErr) {
      console.warn("OCR recognition notice:", ocrErr.message || ocrErr);
      return "";
    }
  }

  return "";
}

// Upload & OCR route
app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const filePath = req.file.path;

  try {
    const extractedText = await extractTextFromFile(filePath, req.file.originalname);
    console.log("Extracted Text preview:", extractedText.slice(0, 80));

    res.json({
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      extractedText,
    });
  } catch (err) {
    console.error("File text extraction error:", err);
    res.json({
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      extractedText: "",
    });
  }
});

// Guard against third-party worker thread crashes
process.on("uncaughtException", (err) => {
  console.error("Guarded uncaught exception:", err.message || err);
});
process.on("unhandledRejection", (reason) => {
  console.error("Guarded unhandled rejection:", reason);
});

app.set("upload", upload);

// ---------- Base Routes ----------
app.get("/", (req, res) => res.render("home"));
app.get("/login", (req, res) => res.render("login.ejs"));
app.get("/register", (req, res) => res.render("register.ejs"));

// ---------- Modular Routes ----------
app.use("/", authRoutes);
app.use("/", chatRoutes);
app.use("/", historyRoutes);
app.use("/", proRoutes);

// ---------- Start Server ----------
app.listen(port, () => {
  console.log(`Server running on port http://localhost:${port}`);
});

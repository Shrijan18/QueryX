// routes/chatRoutes.js
import express from "express";
import fetch from "node-fetch";
import db from "../config/db.js";
import fs from "fs";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

const router = express.Router();

const API_KEY = process.env.API_KEY;
const MODELS = [process.env.GEMINI_MODEL || "gemini-3.5-flash", "gemini-3.5-flash-lite"];
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODELS[0]}:generateContent?key=${API_KEY}`;

// ---------- Call Gemini With Fallback (Text & Multimodal) ----------
const callGemini = async (contents) => {
  for (const model of MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`Gemini API Error (${model}):`, errorData);
        continue;
      }

      const data = await response.json();
      const textPart = data.candidates?.[0]?.content?.parts?.find(
        (p) => p.text && !p.thought
      );
      const reply = textPart?.text || data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (reply) {
        console.log(`Gemini response received using ${model}`);
        return reply.trim();
      }
    } catch (error) {
      console.error(`Error calling Gemini (${model}):`, error);
    }
  }

  return "Sorry, I couldn't generate a response.";
};

// ---------- Generate Bot Response ----------
const generateBotResponse = async (query) => {
  console.log("Reached generateBotResponse function");
  return callGemini([{ parts: [{ text: query }] }]);
};

// ---------- Chat Route ----------
router.post("/submit-search-query", async (req, res) => {
  try {
    const userMsg = req.body.message.trim();
    console.log("User:", userMsg);

    let previousHistory = "";

    // Fetch last 10 messages from DB
    if (req.isAuthenticated()) {
      const { rows } = await db.query(
        `SELECT user_msg, bot_msg 
         FROM history 
         WHERE users_id = $1 
         ORDER BY id DESC LIMIT 10`,
        [req.user.id]
      );
      rows.reverse();
      previousHistory = rows
        .map(r => `User: ${r.user_msg}\nBot: ${r.bot_msg}`)
        .join("\n");
    }

    const prompt = `
You are QueryX, a helpful and memory-aware AI assistant.
You must remember important details that the user shares during the conversation,
such as their name or preferences, and use them in future responses.

If the user asks about something they mentioned earlier (like their name),
recall it from the conversation history instead of saying you don't know.

Conversation so far:
${previousHistory || "(No previous conversation yet)"}

User: ${userMsg}
Bot:
    `;

    console.log("Final Prompt Sent to Gemini:\n", prompt);

    const botMsg = await generateBotResponse(prompt);
    console.log("Bot response received:");

    const newEntry = { user_msg: userMsg, bot_msg: botMsg };

    // Save current chat
    if (req.isAuthenticated()) {
      await db.query(
        "INSERT INTO history (user_msg, bot_msg, users_id) VALUES ($1, $2, $3)",
        [newEntry.user_msg, newEntry.bot_msg, req.user.id]
      );
    }

    res.json({ reply: botMsg });
  } catch (error) {
    console.error("Error generating bot response:", error);
    res.status(500).json({ error: "Failed to get a response from the bot." });
  }
});

/*
// doc processing
router.post("/submit-doc-query", async (req, res) => {

  // -------------------
  // Helper: extract content from file
  async function extractContent(filePath, originalname) {
    const ext = originalname.split(".").pop().toLowerCase();

    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    if (ext === "txt") return fs.readFileSync(filePath, "utf-8");
    if (ext === "pdf") {
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return data.text;
    }
    if (ext === "docx") {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    }
    if (["png", "jpg", "jpeg"].includes(ext)) {
      const imageBase64 = fs.readFileSync(filePath).toString("base64");
      const mimeType = `image/${ext === "jpg" ? "jpeg" : ext}`;
      return { imageBase64, mimeType };
    }

    throw new Error(`Unsupported file type: ${originalname}`);
  }

  // -------------------
  // Helper: send text to Gemini
  async function summarizeText(text) {
    const body = {
      contents: [
        { role: "user", parts: [{ text: `Summarize this content in simple words:\n\n${text}` }] }
      ]
    };

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    // Extract summary
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "No summary returned";
  }

  // -------------------
  // Helper: send image to Gemini
  async function summarizeImage(imageBase64, mimeType) {
    const body = {
      contents: [
        {
          role: "user",
          parts: [
            { text: "Summarize this image in simple words." },
            { inlineData: { data: imageBase64, mimeType } }
          ]
        }
      ]
    };

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    // Extract summary
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "No summary returned";
  }

  // -------------------
  // Automatically get all files in uploads/
  const uploadsFolder = "uploads";
  if (!fs.existsSync(uploadsFolder)) {
    console.error(`❌ Uploads folder not found: ${uploadsFolder}`);
    process.exit(1);
  }

  const testFiles = fs.readdirSync(uploadsFolder).map(f => `${uploadsFolder}/${f}`);

  // -------------------
  // Process files
  (async () => {
    for (const path of testFiles) {
      const originalname = path.split("/").pop();
      console.log(`\n=== ${originalname} ===`);

      try {
        const content = await extractContent(path, originalname);
        let summary;

        if (typeof content === "string") {
          summary = await summarizeText(content);
        } else {
          summary = await summarizeImage(content.imageBase64, content.mimeType);
        }

        console.log("Summary:\n", summary);
        res.json({ reply: summary });

      } catch (err) {
        console.error("Error processing file:", err.message);
      }
    }
  })();

});
*/
// const multer = require("multer");
import multer from "multer";
const upload = multer({ dest: "uploads/" }); // temp storage for uploaded files

router.post("/submit-doc-query", upload.single("file"), async (req, res) => {
  const file = req.file;

  try {
    const rawUserMsg = req.body.message?.trim() || "";
    if (!file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const filePath = file.path;
    const originalname = file.originalname;
    const ext = (originalname.split(".").pop() || "").toLowerCase();

    // ------------------- Helper: extract content
    async function extractContent(filePath, ext) {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File does not exist: ${filePath}`);
      }

      if (ext === "txt") {
        return fs.readFileSync(filePath, "utf-8");
      }

      if (ext === "pdf") {
        const buffer = fs.readFileSync(filePath);
        const data = await pdfParse(buffer);
        return data.text;
      }

      if (ext === "docx") {
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value;
      }

      if (["png", "jpg", "jpeg", "webp"].includes(ext)) {
        const imageBase64 = fs.readFileSync(filePath).toString("base64");
        const mimeType = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
        return { imageBase64, mimeType };
      }

      throw new Error(`Unsupported file type: ${originalname}`);
    }

    const contentData = await extractContent(filePath, ext);
    let reply = "";
    const userPrompt = rawUserMsg || "Please analyze and summarize this file in detail.";

    if (typeof contentData === "string") {
      const contents = [
        {
          role: "user",
          parts: [
            {
              text: `You are QueryX, an intelligent AI assistant.
A file named "${originalname}" has been provided.

Document Content:
${contentData}

User Question: ${userPrompt}

Please provide a helpful, clear, and accurate answer based on the document.`
            }
          ]
        }
      ];

      reply = await callGemini(contents);
    } else {
      const contents = [
        {
          role: "user",
          parts: [
            {
              text: `You are QueryX, an intelligent multimodal AI assistant.
An image named "${originalname}" has been provided.

User Request: ${userPrompt}

Please inspect the image thoroughly and fulfill the user request clearly and accurately.`
            },
            {
              inlineData: {
                data: contentData.imageBase64,
                mimeType: contentData.mimeType
              }
            }
          ]
        }
      ];

      reply = await callGemini(contents);
    }

    console.log("Document Query Reply Generated successfully");

    // Save to PostgreSQL history if authenticated
    if (req.isAuthenticated()) {
      try {
        const savedUserMsg = rawUserMsg
          ? `[Attached: ${originalname}] ${rawUserMsg}`
          : `[Attached: ${originalname}]`;

        await db.query(
          "INSERT INTO history (user_msg, bot_msg, users_id) VALUES ($1, $2, $3)",
          [savedUserMsg, reply, req.user.id]
        );
      } catch (dbErr) {
        console.error("Failed to save doc query to history:", dbErr);
      }
    }

    res.json({ reply, summary: reply });
  } catch (err) {
    console.error("Error processing document query:", err.message);
    res.status(500).json({ error: "Failed to process document query." });
  } finally {
    if (file && file.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch (cleanupErr) {
        console.error("Error cleaning up upload file:", cleanupErr);
      }
    }
  }
});

export default router;

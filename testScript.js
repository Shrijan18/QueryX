/*
import fetch from "node-fetch"; // If Node < 18, otherwise fetch is global
import fs from "fs";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
const API_KEY = process.env.API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${API_KEY}`;

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

  const response = await fetch(GEMINI_URL, {
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
          { text: "Extract the indian plate number from the image." },
          { inlineData: { data: imageBase64, mimeType } }
        ]
      }
    ]
  };

  const response = await fetch(GEMINI_URL, {
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

    } catch (err) {
      console.error("Error processing file:", err.message);
    }
  }
})();
*/

import fs from "fs";
import fetch from "node-fetch"; // Node <18, skip if global fetch available
import dotenv from "dotenv";
dotenv.config();

// -------------------
// Check API Key
const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("❌ GEMINI_API_KEY not set. Set it as an environment variable and try again.");
  process.exit(1);
}

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${API_KEY}`;

// -------------------
// Helper: extract image content
function extractImage(filePath, originalname) {
  const ext = originalname.split(".").pop().toLowerCase();

  if (!["png", "jpg", "jpeg"].includes(ext)) {
    return null; // Skip non-image files
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`File does not exist: ${filePath}`);
  }

  const imageBase64 = fs.readFileSync(filePath).toString("base64");
  const mimeType = `image/${ext === "jpg" ? "jpeg" : ext}`;
  return { imageBase64, mimeType };
}

// -------------------
// Helper: send image to Gemini
async function extractPlateNumber(imageBase64, mimeType) {
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: "Write the summary of the image." },
          { inlineData: { data: imageBase64, mimeType } }
        ]
      }
    ]
  };

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "No plate number detected";
}

// -------------------
// Process only images in uploads/
const uploadsFolder = "uploads";
if (!fs.existsSync(uploadsFolder)) {
  console.error(`❌ Uploads folder not found: ${uploadsFolder}`);
  process.exit(1);
}

const files = fs.readdirSync(uploadsFolder);

(async () => {
  for (const file of files) {
    const filePath = `${uploadsFolder}/${file}`;
    const imgData = extractImage(filePath, file);

    if (!imgData) continue; // Skip non-images

    console.log(`\n=== Processing Image: ${file} ===`);

    try {
      const plateNumber = await extractPlateNumber(imgData.imageBase64, imgData.mimeType);
      console.log("Extracted Plate Number:", plateNumber);
    } catch (err) {
      console.error("Error processing image:", err.message);
    }
  }
})();

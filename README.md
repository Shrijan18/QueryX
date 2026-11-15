# QueryX - Intelligent Memory-Aware AI Chatbot & Document Assistant

**QueryX** is a full-stack, multimodal conversational AI web application built with **Node.js**, **Express**, **EJS**, **PostgreSQL**, and **Google Gemini API**. It features persistent conversation memory, Google OAuth 2.0 authentication, document/image parsing (PDF, DOCX, TXT, OCR for images), and custom dark/light theme switching.

---

## 📑 Table of Contents
1. [Project Overview](#project-overview)
2. [Key Features](#key-features)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Database Architecture & Schema](#database-architecture--schema)
6. [Page-by-Page Breakdown (UI, Functions & Usage)](#page-by-page-breakdown-ui-functions--usage)
   - [1. Landing Page (`/` - `home.ejs`)](#1-landing-page---homeejs)
   - [2. Login Page (`/login` - `login.ejs`)](#2-login-page-login---loginejs)
   - [3. Register Page (`/register` - `register.ejs`)](#3-register-page-register---registerejs)
   - [4. Main Chat Interface (`/index` - `index.ejs`)](#4-main-chat-interface-index---indexejs)
   - [5. History Page (`/history` - `history.ejs`)](#5-history-page-history---historyejs)
7. [API Endpoints & Server Routes](#api-endpoints--server-routes)
8. [File & Multimodal Processing Pipeline](#file--multimodal-processing-pipeline)
9. [Installation & Setup Guide](#installation--setup-guide)
10. [Configuration & Environment Variables](#configuration--environment-variables)
11. [Troubleshooting & Common Issues](#troubleshooting--common-issues)

---

## 🌟 Project Overview

QueryX is designed to deliver a modern, state-of-the-art conversational experience:
- **Conversational Memory**: Remembers context across turns by querying the last 10 messages from PostgreSQL and injecting them into the Gemini prompt.
- **Multimodal Document Q&A**: Users can attach documents (`.pdf`, `.docx`, `.txt`) or images (`.png`, `.jpg`, `.jpeg`). Text is parsed and summarized, while images are processed with multimodal vision or OCR (Tesseract.js).
- **Authentication**: Secure session management using Passport.js with Google OAuth 2.0 and session storage.
- **Responsive UI**: Custom interface styled with CSS, Markdown rendering using `marked.js`, and code syntax highlighting via `highlight.js`.

---

## 🚀 Key Features

- **Google OAuth 2.0 Authentication**: Seamless login and registration with Google accounts.
- **Memory-Aware Chat**: Stores conversations in PostgreSQL so the bot retains knowledge of previous conversation points (e.g., user name, preferences).
- **Document Analysis**:
  - **PDF Extraction**: Extracts text using `pdf-parse`.
  - **Word Documents**: Extracts text using `mammoth`.
  - **Text Files**: Directly read using native Node `fs`.
  - **Images**: Analyzed using Gemini Multimodal inline data and optical character recognition via `tesseract.js` using `eng.traineddata`.
- **Markdown & Syntax Highlighting**: Bot responses format Markdown (bold, lists, code blocks) and highlight code snippets.
- **Theme Switcher**: One-click toggling between Dark Mode and Light Mode.
- **Conversation History Viewer**: Dedicated history dashboard to review past questions and bot answers with persistent storage.

---

## 🛠 Technology Stack

### Backend
- **Runtime**: Node.js (ES Modules, `"type": "module"`)
- **Web Framework**: Express.js 5.x
- **Database**: PostgreSQL 16+ via `pg` (Node-Postgres)
- **Authentication**: Passport.js (`passport-google-oauth2`, `passport-local`, `express-session`, `bcrypt`)
- **File Uploads**: `multer`
- **AI Engine**: Google Gemini API (`gemini-3.5-flash`, `gemini-3.5-flash-lite`, `@google/genai`)
- **Document & Image Parsing**:
  - `pdf-parse` (PDF text extraction)
  - `mammoth` (DOCX text extraction)
  - `tesseract.js` (Optical Character Recognition / OCR)
- **HTTP Client**: `node-fetch`

### Frontend
- **Templating Engine**: EJS (Embedded JavaScript)
- **Styling**: Custom CSS (`main.css`) + Bootstrap 4 (for auth/landing views)
- **Icons**: Font Awesome 5 + Custom vector icons
- **Client Libraries**:
  - `marked.js` (Markdown parsing)
  - `highlight.js` (Code syntax highlighting)

---

## 📂 Project Structure

```text
QueryX/
├── config/
│   └── db.js                 # PostgreSQL connection pool and initialization
├── public/
│   ├── images/               # UI icons (logo, arrows, search, doc icons, etc.)
│   ├── styles/
│   │   └── main.css          # Main styling for chat UI, sidebar, and history
│   └── script.js             # Client-side chat logic, theme toggling, file uploads
├── routes/
│   ├── authRoutes.js         # Google OAuth strategy, login/logout, /index route
│   ├── chatRoutes.js         # /submit-search-query and /submit-doc-query routes
│   └── historyRoutes.js      # /history view and /clear-history endpoint
├── views/
│   ├── partials/             # Header and footer for the main app
│   │   ├── header.ejs        # Marked.js, highlight.js, and main stylesheets
│   │   └── footer.ejs
│   ├── partials1/            # Header and footer for landing & auth pages
│   │   ├── header.ejs        # Bootstrap 4 and FontAwesome links
│   │   └── footer.ejs
│   ├── home.ejs              # Public welcome & landing page
│   ├── login.ejs             # Login screen with Google OAuth
│   ├── register.ejs          # Registration screen with Google OAuth
│   ├── index.ejs             # Main interactive chat application
│   └── history.ejs           # Conversation history viewer
├── uploads/                  # Temporary staging directory for file uploads
├── .env                      # Environment variables and API credentials
├── eng.traineddata           # Tesseract English OCR training dataset
├── package.json              # Project dependencies and startup scripts
└── server.js                 # Application entry point and server configuration
```

---

## 🗄 Database Architecture & Schema

The application uses PostgreSQL with four relational tables covering authentication, conversation persistence, and payment subscriptions:

### 1. `users` Table
Stores user credentials and profile details for both local email/password and Google OAuth 2.0.
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) -- Bcrypt hashed password (optional for Google OAuth users)
);
```

### 2. `history` Table
Stores user messages and corresponding bot responses mapped to user accounts with timestamps.
```sql
CREATE TABLE history (
    id SERIAL PRIMARY KEY,
    user_msg TEXT NOT NULL,
    bot_msg TEXT NOT NULL,
    users_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3. `pro_orders` Table
Tracks Razorpay checkout orders and payment settlement records.
```sql
CREATE TABLE pro_orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    razorpay_order_id VARCHAR(255) NOT NULL,
    razorpay_payment_id VARCHAR(255),
    amount INTEGER NOT NULL, -- Amount in paise (e.g. 9900 = ₹99)
    currency VARCHAR(10) DEFAULT 'INR',
    status VARCHAR(50) DEFAULT 'created', -- 'created', 'paid', 'failed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP
);
```

### 4. `subscriptions` Table
Maintains active Pro membership entitlements, start dates, and expiration timestamps.
```sql
CREATE TABLE subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    plan VARCHAR(50) NOT NULL DEFAULT 'free', -- 'free' or 'pro'
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🖥 Page-by-Page Breakdown (UI, Functions & Usage)

### 1. Landing Page (`/` - `home.ejs`)
- **Route**: `GET /`
- **Purpose**: Welcomes unauthenticated visitors and provides clear entry points into the application.
- **Key UI Elements**:
  - QueryX Brand Title & Hero banner (`fas fa-key` icon).
  - Call to Action: **Register** button (links to `/register`).
  - Call to Action: **Login** button (links to `/login`).
- **Usage**:
  1. Open `http://localhost:3000/`.
  2. Click **Login** or **Register** to proceed to authentication.

---

### 2. Login Page (`/login` - `login.ejs`)
- **Route**: `GET /login`, `POST /login`
- **Purpose**: Authenticates returning users via email & password or Google Single Sign-On.
- **Key UI Elements**:
  - **Local Login Form**: Fields for Email (`username`) and Password (`password`), with submit button.
  - **Google OAuth Button**: Large button with Google icon linking to `/auth/google`.
- **Backend Flow**:
  - **Local Auth**: Verifies email in PostgreSQL, evaluates password using `bcrypt.compare`, and initializes Passport session.
  - **Google OAuth**: Redirects to Google consent screen via `passport.authenticate('google')`.
  - On approval, Google redirects back to `/auth/google/secrets`.
  - The user record is fetched or inserted into PostgreSQL, serialized into the session, and redirected to `/index`.

---

### 3. Register Page (`/register` - `register.ejs`)
- **Route**: `GET /register`, `POST /register`
- **Purpose**: Allows new users to create an account locally or via Google OAuth.
- **Key UI Elements**:
  - Registration Form: Name (`name`), Email (`username`), and Password (`password`) input fields.
  - **Sign Up with Google**: Quick-start registration using Google credentials.
- **Backend Flow**:
  - Validates duplicate email, hashes password with `bcrypt.hash(password, 10)`, creates user record in `users`, and logs user in directly via `req.login()`.

---

### 4. Main Chat Interface (`/index` - `index.ejs`)
- **Route**: `GET /index`
- **Protected**: Accessible only when authenticated (`req.isAuthenticated()`); unauthenticated visitors are redirected to `/`.
- **Layout & Components**:
  - **Sidebar (Left Panel)**:
    - **Logo & Title**: Branding with link to reset/new chat.
    - **Sidebar Toggle & Dock**: Close button (`#sidebarToggleBtn`) in top-right of sidebar; floating reopen button (`#sidebarOpenBtn`) docks on the left when collapsed.
    - **Navigation Links**:
      - `New Chat` (`/index`): Starts a fresh conversational view.
      - `Prompts`: Saved or recommended prompt ideas.
      - `Documents`: View processed documents.
      - `History` (`/history`): Direct link to conversation history.
    - **Search Box**: Quick filter for prior topics.
    - **Upgrade to QueryX Pro Card**: Displays subscription status, ₹99 upgrade trigger with Razorpay Modal popup.
    - **User Profile Capsule**: Displays avatar circle with user's initial and their display name (`<%= username %>`).
  - **Top Navigation Bar**:
    - **Theme Toggle (`🌙` / `☀️`)**: Switches the entire page between dark and light themes dynamically in JavaScript.
    - **Settings Icon**: Quick link for application preferences.
  - **Chat Message Area (`#chat-box`)**:
    - Displays the conversation stream.
    - Renders user prompts aligned to the right.
    - Renders QueryX bot responses aligned to the left with markdown parsing and syntax-highlighted code.
  - **Bottom Input Bar**:
    - **Attachment Button (`📎`)**: Hidden `<input type="file" id="file-upload">` allowing users to attach PDFs, DOCX, TXT, or images.
    - **Message Input Box (`#search-query`)**: Main text prompt field with `Enter` key listener.
    - **Send Button (`.Btn`)**: Submits message or document query.
- **Usage**:
  1. Type a query into the message box and press **Enter** or click **Send**.
  2. To query a file, click `📎`, choose a document/image, type an optional prompt, and click **Send**.
  3. Toggle theme anytime using the top-right moon/sun button.
  4. Click **Upgrade to QueryX Pro** to trigger test/live Razorpay checkout.

---

### 5. History Page (`/history` - `history.ejs`)
- **Route**: `GET /history`
- **Protected**: Requires active user session; unauthenticated requests redirect to `/login`.
- **Purpose**: Displays a persistent transcript of all historical exchanges for the logged-in user.
- **Key UI Elements**:
  - Full sidebar matching the main interface for consistent navigation.
  - **History Feed**: Iterates over all history records (`fault`) retrieved from the database:
    - `Ques:` The user's original message.
    - `Solution:` The bot's recorded reply.
    - Visual separators (`<hr>`) between exchanges.
  - User avatar with initial badge in the lower sidebar.
- **Usage**:
  - Click **History** in the sidebar to review all past conversations.
  - Historical records persist in PostgreSQL across server restarts.

---

## 📡 API Endpoints & Server Routes

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/` | Renders public landing page (`home.ejs`) | No |
| `GET` | `/login` | Renders login page (`login.ejs`) | No |
| `POST` | `/login` | Authenticates email & password via Passport Local Strategy | No |
| `GET` | `/register` | Renders registration page (`register.ejs`) | No |
| `POST` | `/register` | Registers new user with Bcrypt password hashing | No |
| `GET` | `/auth/google` | Initiates Google OAuth 2.0 flow | No |
| `GET` | `/auth/google/secrets` | Google OAuth callback handler | No |
| `GET` | `/logout` | Destroys session and redirects to `/` | Yes |
| `GET` | `/index` | Renders main chat interface (`index.ejs`) | Yes |
| `POST` | `/submit-search-query` | Processes text prompt with memory & Gemini AI | Optional (Saves to DB if logged in) |
| `POST` | `/submit-doc-query` | Parses uploaded document/image and answers query | No |
| `POST` | `/upload` | Staged file upload with Tesseract OCR analysis | No |
| `GET` | `/history` | Fetches and renders conversation history (`history.ejs`) | Yes |
| `POST` | `/clear-history` | Deletes user conversation records from PostgreSQL | Yes |
| `GET` | `/api/pro/status` | Returns subscription status (`isPro`, `plan`, `expiresAt`) | Yes |
| `POST` | `/api/pro/create-order` | Generates Razorpay checkout order for Pro subscription | Yes |
| `POST` | `/api/pro/verify-payment` | Verifies Razorpay HMAC SHA256 signature and activates Pro | Yes |

---

## 📄 File & Multimodal Processing Pipeline

```mermaid
flowchart TD
    A[User Selects File] --> B{File Extension}
    B -->|.txt| C[Read via fs.readFileSync]
    B -->|.pdf| D[Extract text via pdf-parse]
    B -->|.docx| E[Extract text via mammoth]
    B -->|.png / .jpg / .jpeg| F[Encode to Base64 + MIME]
    
    C --> G[Construct Gemini Text Prompt]
    D --> G
    E --> G
    F --> H[Construct Gemini Multimodal Payload]
    
    G --> I[Google Gemini API]
    H --> I
    I --> J[Return Answer / Summary to Frontend]
    J --> K[Unlink Temp File from uploads/]
```

1. **Upload Handling**: Handled via `multer` in `routes/chatRoutes.js` and stored temporarily in `uploads/`.
2. **File Extraction**:
   - **Text**: Read directly into memory as UTF-8 string.
   - **PDF**: Converted to text using `pdf-parse`.
   - **Word**: Converted to raw text using `mammoth`.
   - **Images**: Converted to Base64 and passed as `inlineData` to Gemini.
3. **Prompt Composition**: Combines document contents with the user's explicit question.
4. **Cleanup**: Temp file is deleted immediately after processing via `fs.unlinkSync()`.

---

## ⚙️ Installation & Setup Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **PostgreSQL**: Installed and running locally or on a remote host
- **Google Gemini API Key**: From [Google AI Studio](https://aistudio.google.com/)
- **Google Cloud Console Credentials**: OAuth 2.0 Client ID and Secret

### Step-by-Step Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd "ChatBot Lvl 4"
   ```

2. **Install Node.js dependencies**:
   ```bash
   npm install
   ```

3. **Set up PostgreSQL Database**:
   Create a database named `chatbot` and execute the schema initialization:
   ```sql
   CREATE DATABASE chatbot;

   \c chatbot;

   -- Users Table
   CREATE TABLE users (
       id SERIAL PRIMARY KEY,
       name VARCHAR(255) NOT NULL,
       email VARCHAR(255) UNIQUE NOT NULL,
       password VARCHAR(255)
   );

   -- Chat History Table
   CREATE TABLE history (
       id SERIAL PRIMARY KEY,
       user_msg TEXT NOT NULL,
       bot_msg TEXT NOT NULL,
       users_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

   -- Razorpay Orders Table
   CREATE TABLE pro_orders (
       id SERIAL PRIMARY KEY,
       user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
       razorpay_order_id VARCHAR(255) NOT NULL,
       razorpay_payment_id VARCHAR(255),
       amount INTEGER NOT NULL,
       currency VARCHAR(10) DEFAULT 'INR',
       status VARCHAR(50) DEFAULT 'created',
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       paid_at TIMESTAMP
   );

   -- Subscriptions Table
   CREATE TABLE subscriptions (
       id SERIAL PRIMARY KEY,
       user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
       plan VARCHAR(50) NOT NULL DEFAULT 'free',
       started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       expires_at TIMESTAMP,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

4. **Configure Environment Variables**:
   Create a `.env` file in the root directory (see format below).

5. **Start the Application**:
   ```bash
   npm start
   ```
   Open your browser and navigate to: `http://localhost:3000`

---

## 🔑 Configuration & Environment Variables

Create a `.env` file in the project root:

```env
# Server Port (optional; defaults to 3000)
PORT=3000

# Google Gemini API Key (from Google AI Studio)
API_KEY=your_gemini_api_key_here

# Active Gemini Model (gemini-3.5-flash or gemini-3.5-flash-lite)
GEMINI_MODEL=gemini-3.5-flash

# Google OAuth 2.0 Credentials (from Google Cloud Console)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
# Optional callback override for production deployment:
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/secrets

# Session Secret Key
SESSION_SECRET=your_random_secret_session_key

# Database Connection (Option A: Cloud Database URL with SSL)
# Supported by Neon, Supabase, Render, Railway, AWS RDS
DATABASE_URL=postgres://user:password@host:5432/dbname?sslmode=require

# Database Connection (Option B: Individual Local Variables)
PG_USER=postgres
PG_HOST=localhost
PG_DATABASE=chatbot
PG_PASSWORD=your_postgres_password
PG_PORT=5432

# Razorpay Payment Gateway Credentials (from Razorpay Dashboard)
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret
```

---

## 🚀 Cloud Deployment Guide

QueryX is configured for zero-friction cloud deployment to platforms like **Render**, **Railway**, **Fly.io**, or VPS:

### 1. Database (Cloud PostgreSQL)
- Provision a free managed PostgreSQL database on **Neon** (neon.tech), **Supabase** (supabase.com), or **Render**.
- Run the SQL schema script provided in [Database Setup](#step-by-step-installation) in your provider's SQL editor.
- Copy your connection string into `DATABASE_URL`. QueryX's database pool (`config/db.js`) automatically enables SSL (`rejectUnauthorized: false`) when `DATABASE_URL` is present.

### 2. Google OAuth Redirect URI
- In the [Google Cloud Console](https://console.cloud.google.com/), navigate to **APIs & Services > Credentials**.
- Add your production URL to Authorized Redirect URIs:
  `https://your-domain.onrender.com/auth/google/secrets`
- Set `GOOGLE_CALLBACK_URL=https://your-domain.onrender.com/auth/google/secrets` in your hosting dashboard environment variables.

### 3. Deploy on Render / Railway
1. Push your repository to GitHub (`.gitignore` protects your `.env` and `uploads/`).
2. Link your GitHub repository in your cloud provider.
3. Set **Build Command**: `npm install`
4. Set **Start Command**: `npm start`
5. Fill in the environment variables from the `.env` example above.
6. The app dynamically binds to `process.env.PORT` assigned by the host.

---

## 🔧 Troubleshooting & Common Issues

- **Model Deprecation / 404 Error**:
  - If you encounter `models/gemini-2.0-flash is no longer available`, set `GEMINI_MODEL=gemini-3.5-flash` or `gemini-3.5-flash-lite` in `.env`. The backend has automatic fallback between both models.
- **Database Connection Error (`ECONNREFUSED` / `EACCES`)**:
  - Verify PostgreSQL service is running (`net start postgresql-x64-16` on Windows or `sudo service postgresql status` on Linux).
  - Verify credentials or ensure `DATABASE_URL` is set correctly for cloud instances.
- **Razorpay Order Creation Error**:
  - Ensure `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are correctly configured in `.env`.
- **File Upload Errors**:
  - Ensure the `uploads/` folder exists in the project root. Temporary files are automatically cleaned up in a `finally` block after processing.
- **OAuth Callback Mismatch**:
  - In Google Cloud Console, ensure Authorized Redirect URI includes:
    `http://localhost:3000/auth/google/secrets` (local) or your deployed URL.

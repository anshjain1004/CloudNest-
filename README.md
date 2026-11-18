# CloudNest - Full-Stack File Storage & Sharing Platform

A comprehensive cloud file storage and sharing platform built with the MERN stack, featuring authentication, nested folder organization, multi-file upload, token-based sharing, storage quota tracking, trash/restore functionality, and activity logging.

## 📖 Project Report

This repository includes a complete **BTech CSE Project Report** in `.docx` format, covering:

- Project introduction, motivation, and problem statement
- System architecture and database schema (5 tables)
- 50+ API endpoints documented
- 8 key features with detailed descriptions
- Docker deployment configuration
- Getting started guide
- Future scope and enhancements
- License and acknowledgments

The report is available as:
- `BTech_CSE_Project_Report.docx` - Text format (openable in any editor)
- `CloudNest_Final_Report.docx` - Converted Microsoft Word 2007+ format

## 🚀 Features

- **Authentication** — Register/login with hashed passwords (bcrypt) and JWT in httpOnly cookie
- **Nested folders** — Unlimited folder depth, rename, move, browse with breadcrumbs
- **File uploads** — Multi-file upload (up to 10 per request) with drag & drop and size limits
- **Preview & download** — Short-lived presigned S3 URLs, buckets stay private
- **Share links** — Tokenised public links for files/folders with `download` permission, access counting, optional expiry, revocation
- **Trash** — Soft delete, restore, permanent delete, empty-trash in one place
- **Storage quota** — Per-user usage tracking with live progress bar (1 GB default)
- **Responsive UI** — Mobile drawer navigation, toast notifications, Tailwind design

## 📐 Tech Stack

| Layer     | Stack |
| --------- | ----- |
| **Frontend** | React 19, Vite 8, Tailwind CSS 4, React Router 7, Axios, lucide-react, react-hot-toast, react-dropzone |
| **Backend** | Node.js, Express 5, JWT, bcryptjs, Multer, cookie-parser, CORS |
| **Database** | Neon serverless Postgres |
| **Storage** | AWS S3 (or any S3-compatible endpoint) via `@aws-sdk/client-s3` + presigned URLs |
| **Report** | MS Word (.docx) format with comprehensive project documentation |

## 📁 Project Structure

```text
.
├── client/                 # React + Vite frontend
│   ├── public/             # logo, favicon, patterns
│   └── src/
│       ├── components/     # layout, files, folders, auth, ui
│       ├── context/        # auth + app state
│       ├── hooks/          # useDrive and friends
│       ├── pages/          # Login, Drive, Trash, SharedWithMe, SharedFile
│       └── config/api.js   # axios instance (VITE_BASE_URL)
├── server/                 # Express API
│   ├── config/             # db (Neon) and s3 client
│   ├── controllers/        # auth, file, folder, share, trash
│   ├── middleware/         # auth guard, multer upload
│   ├── routes/             # /api/* routers
│   ├── services/           # storage helpers
│   ├── utils/              # s3 helpers
│   ├── Dockerfile          # Server Docker configuration
│   └── seed-db.js          # Database seeding script
├── docker-compose.yml      # Docker compose (server:3000, client:8080)
├── .gitignore              # Git ignore rules
└── README.md               # This file
```

## ⚡ Getting Started

### Prerequisites

- Node.js 18+
- A Neon (or any Postgres) database URL
- An S3-compatible bucket plus access keys

### 1. Clone and Install

```bash
git clone https://github.com/anshjain1004/CloudNest-.git
cd CloudNest-

cd client && npm install
cd ../server && npm install
```

### 2. Configure the Server

Create `server/.env`:

```env
PORT=3000
DATABASE_URL=postgresql://user:password@host/db?sslmode=require
JWT_SECRET=replace-with-a-long-random-string
ORIGINS=http://localhost:5173

AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=your-bucket-name
AWS_ENDPOINT_URL_S3=https://your-s3-endpoint

MAX_FILE_SIZE=104857600       # bytes, 100 MB default
MAX_STORAGE_PER_USER=1073741824 # bytes, 1 GB default
```

Optionally create `client/.env`:

```env
VITE_BASE_URL=http://localhost:3000
```

### 3. Start the Application

**Terminal 1 - Server:**

```bash
cd server
npm run dev
# Server runs at http://localhost:3000
```

**Terminal 2 - Client:**

```bash
cd client
npm run dev
# Vite dev server at http://localhost:5173
```

Access the app at: http://localhost:5173

### 4. Seed the Database (first time)

```bash
docker compose exec server node seed-db.js
# Or run: node server/seed-db.js
```

### 5. Register First Account

1. Open http://localhost:5173 in browser
2. Click "Register"
3. Fill in name, email, password
4. Login with credentials

## 📦 Docker Deployment

Run with Docker Compose:

```bash
docker compose up --build
```

This starts two services:
- **server**: Node.js/Express on port 3000
- **client**: React/Nginx on port 8080

Access the web app at: http://localhost:8080

## 📄 Project Report Files

- `CloudNest_Final_Report.docx` - Complete BTech project report (Word format, pandoc-converted)
- `BTech_CSE_Project_Report.docx` - Original text-format report
- Both files include: cover page, abstract, 11 chapters, and appendices with full SQL and API documentation

## 🛠️ Available Scripts

### Client (`client/package.json`)

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "oxlint",
    "preview": "vite preview"
  }
}
```

### Server (`server/package.json`)

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "server": "nodemon server.js"
  }
}
```

## 📊 API Endpoints Overview

### Authentication (`/api/auth/`)

- `POST /register` - Create account
- `POST /login` - Sign in (sets JWT cookie)
- `POST /logout` - Clear session
- `GET /me` - Get current user + storage usage

### Folders (`/api/folders/`)

- `POST /` - Create folder
- `GET /` - List all user folders
- `GET /:id` - Folder details + contents
- `PATCH /:id/rename` - Rename folder
- `PATCH /:id/move` - Move folder
- `DELETE /:id` - Move to trash
- `POST /:id/restore` - Restore from trash

### Files (`/api/files/`)

- `POST /upload` - Upload up to 10 files
- `GET /` - List files with pagination/search
- `GET /:id/preview` - Get presigned download/preview URL
- `PATCH /:id/rename` - Rename file
- `PATCH /:id/move` - Move file to folder
- `DELETE /:id` - Move to trash
- `POST /:id/restore` - Restore from trash
- `DELETE /:id/permanent` - Permanent delete

### Share Links (`/api/shares/`)

- `POST /` - Create public share link
- `GET /` - List user's share links
- `GET /access/:token` - Public access via token (optional auth)
- `DELETE /:id` - Revoke share link
- `GET /analytics` - Share access analytics
- `GET /:id/access-history` - Access history per link

### Trash (`/api/trash/`)

- `GET /` - List trashed items
- `POST /empty` - Permanently delete all trashed items
- `POST /files/:id/restore` - Restore specific file
- `POST /folders/:id/restore` - Restore specific folder
- `DELETE /files/:id/permanent` - Permanent delete file
- `DELETE /folders/:id/permanent` - Permanent delete folder

### Activity (`/api/activity/`)

- `GET /` - View activity logs

## 🤝 Acknowledgments

- The React team for the amazing UI library
- The Express.js team for the minimal web framework
- The Tailwind CSS team for the utility-first styling system
- The Neon team for serverless Postgres without migrations
- The AWS SDK team for robust S3 client libraries
- All contributors to the libraries used in this project

## 📜 License

**ISC License** - Permission to use, copy, modify, and distribute this software for any purpose with or without fee, provided the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

Copyright (c) [Year] [Student Name or Organization]

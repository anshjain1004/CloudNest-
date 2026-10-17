# Cloud-Nest

A full-stack file storage platform — upload files, organise them into nested folders, share them with permission-based links, and restore anything you delete from Trash. Built with React + Express, backed by Neon Postgres for metadata and S3-compatible object storage for the files themselves.

## Features

- **Authentication** — register / login with hashed passwords (bcrypt) and JWT issued in an httpOnly cookie.
- **Nested folders** — unlimited folder depth, rename, move, and browse with breadcrumbs.
- **File uploads** — multi-file upload (up to 10 per request) with drag & drop and per-request size limits.
- **Preview & download** — short-lived presigned S3 URLs, so buckets stay private.
- **Share links** — tokenised public links for files and folders, with a permission flag (`download` by default), access counting, optional expiry, and revocation.
- **Trash** — soft delete, restore, permanent delete, and empty-trash in one place.
- **Storage quota** — per-user usage tracking with a live progress bar in the sidebar (1 GB default).
- **Responsive UI** — mobile drawer navigation, toast notifications, and a clean Tailwind design.

## Tech stack

| Layer     | Stack |
| --------- | ----- |
| Frontend  | React 19, Vite 8, Tailwind CSS 4, React Router 7, Axios, lucide-react, react-hot-toast, react-dropzone |
| Backend   | Node.js, Express 5, JWT, bcryptjs, Multer, cookie-parser, CORS |
| Database  | Neon serverless Postgres |
| Storage   | AWS S3 (or any S3-compatible endpoint) via `@aws-sdk/client-s3` + presigned URLs |

## Project structure

```
.
├── client/                 # React + Vite frontend
│   ├── public/             # logo, favicon, patterns
│   └── src/
│       ├── components/     # layout, files, folders, auth, ui
│       ├── context/        # auth + app state
│       ├── hooks/          # useDrive and friends
│       ├── pages/          # Login, Drive, Trash, SharedWithMe, SharedFile
│       └── config/api.js   # axios instance (VITE_BASE_URL)
└── server/                 # Express API
    ├── config/             # db (Neon) and s3 client
    ├── controllers/        # auth, file, folder, share, trash
    ├── middleware/         # auth guard, multer upload
    ├── routes/             # /api/* routers
    ├── services/           # storage helpers
    └── utils/              # s3 helpers
```

## Getting started

### Prerequisites

- Node.js 18+
- A Neon (or any Postgres) database URL
- An S3-compatible bucket plus access keys

### 1. Clone and install

```bash
git clone https://github.com/anshjain1004/CloudNest-.git
cd CloudNest-

cd client && npm install
cd ../server && npm install
```

### 2. Configure the server

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

MAX_FILE_SIZE=104857600          # bytes, 100 MB default
MAX_STORAGE_PER_USER=1073741824  # bytes, 1 GB default
```

Tables and indexes are created automatically on first boot, so no migrations are needed.

### 3. Configure the client (optional)

Create `client/.env` if your API is not on `http://localhost:3000`:

```env
VITE_BASE_URL=http://localhost:3000
```

### 4. Run

```bash
# terminal 1
cd server && npm run dev     # nodemon on http://localhost:3000

# terminal 2
cd client && npm run dev     # Vite on http://localhost:5173
```

## API overview

All routes are prefixed with `/api`. Everything except register/login and public share access requires the auth cookie.

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| POST | `/auth/register` | Create an account |
| POST | `/auth/login` | Sign in, sets JWT cookie |
| POST | `/auth/logout` | Clear session |
| GET | `/auth/me` | Current user + storage usage |
| POST | `/folders` | Create folder |
| GET | `/folders` | List folders |
| GET | `/folders/:id` | Folder details + contents |
| PATCH | `/folders/:id/rename` | Rename folder |
| PATCH | `/folders/:id/move` | Move folder |
| DELETE | `/folders/:id` | Move folder to trash |
| POST | `/folders/:id/restore` | Restore folder |
| DELETE | `/folders/:id/permanent` | Delete folder permanently |
| POST | `/files/upload` | Upload up to 10 files |
| GET | `/files` | List files |
| GET | `/files/:id/preview` | Presigned preview URL |
| PATCH | `/files/:id/rename` | Rename file |
| PATCH | `/files/:id/move` | Move file |
| DELETE | `/files/:id` | Move file to trash |
| POST | `/files/:id/restore` | Restore file |
| DELETE | `/files/:id/permanent` | Delete file permanently |
| POST | `/shares` | Create share link |
| GET | `/shares` | List your share links |
| GET | `/shares/access/:token` | Public access via token |
| DELETE | `/shares/:id` | Revoke share link |
| GET | `/trash` | List trashed items |
| POST | `/trash/empty` | Empty trash |

## Scripts

| Location | Command | Purpose |
| -------- | ------- | ------- |
| `client` | `npm run dev` | Vite dev server |
| `client` | `npm run build` | Production build to `client/dist` |
| `client` | `npm run preview` | Preview the build |
| `client` | `npm run lint` | Oxlint |
| `server` | `npm run dev` | Nodemon with reload |
| `server` | `npm start` | Plain Node start |

## Deployment notes

- Serve `client/dist` from any static host (Vercel, Netlify, Cloudflare Pages) and deploy `server` to a Node host.
- Set `ORIGINS` to your deployed frontend URL(s), comma-separated, and `VITE_BASE_URL` to the API base URL.
- With cross-site cookies, the API must be served over HTTPS and the cookie settings require the same parent domain or `SameSite=None`.
- Keep the bucket private; all reads go through presigned URLs.

## License

ISC

# Mindmap Self-Hosted

Professional self-hosted collaborative mind mapping tool with real-time collaboration, version history, and multiple export formats.

## Tech Stack

- **Frontend**: Next.js 16 + React 19, Zustand, XYFlow (React Flow), TipTap
- **Backend**: Next.js API Routes, Prisma ORM, PostgreSQL
- **Auth**: Argon2 + JWT/JOSE (HttpOnly cookies)
- **Real-time**: Server-Sent Events (SSE)
- **Storage**: MinIO (S3-compatible) for attachments
- **Infrastructure**: Docker Compose (PG, Redis, MinIO)

## Quick Start

### Prerequisites

- Node.js ≥ 20
- Docker & Docker Compose
- Git

### Setup

```bash
# 1. Clone & install
git clone <repo-url>
cd mindmap-selfhost
npm install

# 2. Start infrastructure
docker compose up -d

# 3. Configure environment
cp .env.example .env
# Edit .env with your values (JWT_SECRET is REQUIRED in production)

# 4. Run migrations
npx prisma migrate deploy

# 5. (Optional) Seed demo data
npx tsx prisma/seed.ts
# Login: demo@mindmap.dev / demo123

# 6. Start dev server
npm run dev
```

Visit `http://localhost:3000`

### Production

```bash
# Build
npm run build

# Start
npm start
```

> **Important**: Set `JWT_SECRET` in production — the app will **throw an error** if it's not set.

## API Reference

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/register` | POST | ❌ | Register new user |
| `/api/auth/login` | POST | ❌ | Login (returns session cookie) |
| `/api/auth/logout` | POST | ✅ | Clear session |
| `/api/auth/me` | GET | ✅ | Current user info |
| `/api/maps` | GET | ✅ | List maps (paginated: `?page=1&limit=20&search=`) |
| `/api/maps` | POST | ✅ | Create new map |
| `/api/maps/:id` | GET | ✅ | Get map details |
| `/api/maps/:id` | PATCH | ✅ | Update map (Zod validated) |
| `/api/maps/:id` | DELETE | ✅ | Delete map (owner only) |
| `/api/maps/:id/save` | POST | ✅ | Save nodes/edges |
| `/api/maps/:id/sync` | GET | ✅ | SSE real-time sync |
| `/api/maps/:id/share` | POST | ✅ | Generate invite link |
| `/api/maps/:id/versions` | GET | ✅ | List versions |
| `/api/maps/:id/publish` | POST | ✅ | Publish version |
| `/api/maps/:id/restore` | POST | ✅ | Restore version |
| `/api/maps/:id/export/md` | GET | ✅ | Export as Markdown |
| `/api/maps/:id/export/docx` | GET | ✅ | Export as DOCX |
| `/api/health` | GET | ❌ | Health check (DB connectivity) |
| `/api/invite/:token` | GET | ❌ | Accept invite |

## Architecture

```
┌─────────────────────────────────────────┐
│               Client (React 19)         │
│  Zustand Store ←→ XYFlow/TipTap/Editor  │
│  SSE Listener ←→ Real-time updates      │
└───────────┬─────────────────────────────┘
            │ HTTP / SSE
┌───────────▼─────────────────────────────┐
│           Next.js API Routes            │
│  Middleware (JWT, CORS, Size Limit)     │
│  Zod Validation · Rate Limiting         │
│  Structured JSON Logger                 │
└───────────┬─────────────────────────────┘
            │ Prisma ORM
┌───────────▼─────────┐  ┌───────────────┐
│    PostgreSQL       │  │    MinIO (S3)  │
│  7 tables, UUIDs    │  │  attachments   │
│  Migration-managed  │  │  bucket        │
└─────────────────────┘  └───────────────┘
```

## Security

- **Password hashing**: Argon2id
- **Sessions**: JWT in HttpOnly, SameSite=Lax, Secure (production) cookies
- **Input validation**: Zod schemas on all write endpoints
- **XSS prevention**: HTML sanitization on note content
- **CORS**: Configurable origin via `APP_PUBLIC_URL`
- **Rate limiting**: Auth endpoints (5 attempts/15min), Share API (10/15min)
- **Request size limit**: 5MB body limit on API routes

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `JWT_SECRET` | ✅ (prod) | `dev-secret` | JWT signing secret |
| `APP_PUBLIC_URL` | ❌ | `http://localhost:3000` | Public URL (CORS origin) |
| `NODE_ENV` | ❌ | `development` | Environment mode |
| `MINIO_ENDPOINT` | ❌ | — | MinIO host |
| `MINIO_ACCESS_KEY` | ❌ | — | MinIO access key |
| `MINIO_SECRET_KEY` | ❌ | — | MinIO secret key |
| `MINIO_BUCKET` | ❌ | — | MinIO bucket name |

## Development

```bash
# Run dev server
npm run dev

# Run ESLint
npx eslint .

# Build for production
npm run build

# Seed database
npx tsx prisma/seed.ts

# Reset database
npx prisma migrate reset
```

## License

Private — All rights reserved.

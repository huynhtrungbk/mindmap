# Sprint 0 — Repo Infrastructure + Auth + Routing

> **Sprint Goal**: Local Docker chạy, DB schema đầy đủ, Auth register/login/logout, routing cơ bản + trang tạo/danh sách mindmap.
> **DoD (Definition of Done)**: `docker compose up -d` → Prisma migrate → register → login → tạo mindmap record → thấy trong danh sách.

---

## Proposed Changes

### 1. Prisma Schema (`prisma/schema.prisma`)

Tạo đầy đủ models theo PRD Section 4:

| Model | Mô tả |
|-------|--------|
| `User` | id, email (unique), passwordHash, createdAt |
| `Mindmap` | id, ownerId (FK), title, viewportX/Y/Zoom, timestamps |
| `MindmapNode` | id, mindmapId (FK), parentId (self-ref), sortIndex, positionX/Y, title, collapsed, styleJson, noteDoc, notePlain, timestamps |
| `MindmapEdge` | id, mindmapId, sourceId/targetId, type, createdAt |
| `Attachment` | id, nodeId, bucket, objectKey, filename, mime, size, createdAt |
| `MindmapVersion` | id, mindmapId, versionNo, snapshotJson, createdAt, createdBy |

Index: `(mindmapId, parentId, sortIndex)` trên MindmapNode.

---

### 2. Library Utilities (`lib/`)

| File | Nội dung |
|------|---------|
| `lib/db.ts` | Prisma client singleton |
| `lib/auth.ts` | `hashPassword()`, `verifyPassword()`, `signJwt()`, `verifyJwt()` |
| `lib/session.ts` | `getSession(req)` — đọc JWT cookie → trả user hoặc null |

---

### 3. API Routes (Next.js Route Handlers)

| Route | Method | Mô tả |
|-------|--------|--------|
| `app/api/auth/register/route.ts` | POST | Tạo user (email+password), trả JWT cookie |
| `app/api/auth/login/route.ts` | POST | Verify password, trả JWT cookie |
| `app/api/auth/logout/route.ts` | POST | Xóa JWT cookie |
| `app/api/auth/me/route.ts` | GET | Trả user info từ JWT |
| `app/api/maps/route.ts` | GET/POST | Danh sách maps / Tạo map mới |
| `app/api/maps/[id]/route.ts` | GET/PATCH/DELETE | Chi tiết / Cập nhật / Xóa map |

---

### 4. Frontend Pages

| Route | File | Mô tả |
|-------|------|--------|
| `/` | `app/page.tsx` | Landing / redirect nếu đã login |
| `/login` | `app/login/page.tsx` | Form login |
| `/register` | `app/register/page.tsx` | Form register |
| `/dashboard` | `app/dashboard/page.tsx` | Danh sách mindmaps |
| `/maps/[id]` | `app/maps/[id]/page.tsx` | (placeholder) Editor page — Sprint 1 |

---

### 5. Middleware

| File | Mô tả |
|------|--------|
| `middleware.ts` | Bảo vệ routes `/dashboard`, `/maps/*` — redirect về `/login` nếu chưa auth |

---

## File List (tất cả NEW)

```
prisma/schema.prisma              [MODIFY] — thêm models
lib/db.ts                         [NEW]
lib/auth.ts                       [NEW]
lib/session.ts                    [NEW]
app/api/auth/register/route.ts    [NEW]
app/api/auth/login/route.ts       [NEW]
app/api/auth/logout/route.ts      [NEW]
app/api/auth/me/route.ts          [NEW]
app/api/maps/route.ts             [NEW]
app/api/maps/[id]/route.ts        [NEW]
app/login/page.tsx                [NEW]
app/register/page.tsx             [NEW]
app/dashboard/page.tsx            [NEW]
app/maps/[id]/page.tsx            [NEW]
middleware.ts                     [NEW]
app/globals.css                   [MODIFY] — basic styling
```

---

## ⚠️ Cần Bạn Làm Trước

1. **Mở Docker Desktop** — chờ "Docker is running"
2. **Chạy**: `docker compose up -d` trong `e:\Dev\mindmap\mindmap-selfhost`
3. Sau đó tôi sẽ chạy `npx prisma migrate dev` để tạo tables

---

## Verification Plan

### Automated (tôi sẽ tự chạy)
1. `npx prisma migrate dev --name init` — verify schema tạo tables thành công
2. `npm run build` — verify TypeScript compile không lỗi
3. `npm run dev` → test các API endpoints bằng browser subagent:
   - POST `/api/auth/register` với email/password
   - POST `/api/auth/login` với email/password
   - GET `/api/auth/me` → verify trả user info
   - POST `/api/maps` → tạo mindmap
   - GET `/api/maps` → verify danh sách có map vừa tạo

### Manual (bạn kiểm tra)
1. Mở `http://localhost:3000` → thấy trang landing
2. Click Register → nhập email/password → redirect dashboard
3. Click Login/Logout → hoạt động đúng
4. Dashboard hiển thị danh sách mindmaps

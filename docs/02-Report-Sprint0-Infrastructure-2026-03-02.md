# Report: Sprint 0 — Infrastructure + Auth + Routing

**Date**: 2026-03-02  
**Status**: ✅ Complete

## Kết Quả

| Hạng mục | Status |
|----------|:------:|
| Docker (Postgres 16 + Redis 7 + MinIO) | ✅ |
| Prisma schema (6 models, migrated) | ✅ |
| Auth API (register/login/logout/me) | ✅ |
| Maps CRUD API (list/create/get/update/delete) | ✅ |
| Frontend pages (landing/login/register/dashboard) | ✅ |
| Auth middleware | ✅ |
| `npm run build` (12 routes) | ✅ |
| Browser test (9/9 pass) | ✅ |

## Lưu Ý Kỹ Thuật

- **Prisma 7** yêu cầu adapter pattern (`PrismaPg` + `pg.Pool`) thay vì `url` trong schema
- **Turbopack** không resolve được Prisma generated files qua `@/` alias — dùng relative import `../src/generated/prisma/client`
- `serverExternalPackages` trong `next.config.ts` cho Prisma, pg, argon2
- Next.js 16 deprecate `middleware.ts` → sẽ migrate sang `proxy` trong sprint sau

## Files Created

```
lib/db.ts, lib/auth.ts, lib/session.ts
app/api/auth/{register,login,logout,me}/route.ts
app/api/maps/route.ts, app/api/maps/[id]/route.ts
app/{login,register,dashboard}/page.tsx
app/maps/[id]/page.tsx
middleware.ts
app/globals.css (dark theme)
```

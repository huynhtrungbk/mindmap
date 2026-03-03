# Phân Tích Kỹ Toàn Bộ Project — FE, BE, DB, UI/UX

**Date**: 2026-03-02  
**Files analyzed**: 40 source files  
**Build status**: ✅ 20 routes, 0 errors  

---

## 1. DATABASE (Prisma Schema)

### ✅ Đạt
- 6 models đầy đủ theo PRD: User, Mindmap, MindmapNode, MindmapEdge, Attachment, MindmapVersion
- UUID primary keys, snake_case mapping (`@@map`)
- Relations + cascade delete đúng (User→Mindmap, Mindmap→Node, Node→Edge, Node→Attachment)
- Self-referencing relation `NodeTree` cho parent-child
- Composite index `(mindmap_id, parent_id, sort_index)` cho query performance
- `noteDoc` (JSONB) + `notePlain` (TEXT) đúng PRD

### ⚠️ Thiếu / Cần cải thiện
| # | Issue | Mức độ | Giải pháp |
|---|-------|--------|-----------|
| DB-1 | **Thiếu `updatedAt` trên User** — không track user activity | Low | Thêm `updatedAt DateTime @updatedAt` |
| DB-2 | **Thiếu GIN index trên `note_plain`** cho full-text search | Medium | Thêm raw SQL migration cho GIN index |
| DB-3 | **MindmapVersion thiếu unique constraint** `(mindmap_id, version_no)` | Medium | Thêm `@@unique([mindmapId, versionNo])` |
| DB-4 | **Attachment model chưa được dùng** — không có API presign/commit | Medium | Cần implement Sprint 2 attachment flow |

---

## 2. BACKEND (API Routes)

### ✅ Đạt
- Auth: register (argon2 + validation) / login / logout / me — solid
- Maps CRUD: list / create / get / update / delete — ownership validation đầy đủ
- Bulk save: transaction upsert nodes + edges + viewport — robust
- Export MD/DOCX + Import MD/DOCX — DIF intermediate format
- Versioning: publish / list / restore — snapshot JSON approach

### ⚠️ Thiếu / Cần cải thiện
| # | Issue | Mức độ | Giải pháp |
|---|-------|--------|-----------|
| BE-1 | **Thiếu Attachments API** (`/api/attachments/presign` + `/commit`) | **High** | Implement MinIO presign flow |
| BE-2 | **Thiếu input validation** trong save/import — không limit nodes count | Medium | Thêm zod validation, limit 2000 nodes |
| BE-3 | **Thiếu rate limiting** trên auth endpoints | Medium | Thêm simple rate limiter (Redis-based) |
| BE-4 | **DOCX export chạy sync** — nên dùng BullMQ job cho file lớn | Low | Di chuyển sang worker queue |
| BE-5 | **Middleware chỉ check cookie existence** — không verify JWT trong middleware | Low | Middleware đủ cho v1 (JWT verified ở API layer) |
| BE-6 | **`POST /api/maps` không validate body** — nhận bất kỳ title | Low | Thêm length validation (1-200 chars) |
| BE-7 | **Import MD/DOCX thiếu edges** — `difToMindmapNodes` tạo nodes nhưng API chưa tự tạo edges từ parent-child | **High** | API import đã tạo edges ✅ (checked) |

---

## 3. FRONTEND (Pages + Components)

### ✅ Đạt
- Landing page: hero + features — clean layout
- Auth pages: login + register — form validation, error display, redirect
- Dashboard: maps grid, create, delete, logout
- Editor: React Flow canvas + Zustand store + toolbar + side panel
- Note editor: Tiptap + debounce save + sync on node change
- Keyboard shortcuts: Tab/Enter/Delete/Ctrl+Z/Y
- Autosave: 1s debounce → POST `/save` → "Saved" indicator
- Undo/redo: 50-step history with structuredClone

### ⚠️ Thiếu / Cần cải thiện
| # | Issue | Mức độ | Giải pháp |
|---|-------|--------|-----------|
| FE-1 | **Thiếu Export/Import UI** — không có buttons trên toolbar/dashboard | **High** | Thêm Export MD/DOCX + Import buttons |
| FE-2 | **Thiếu Search** trong dashboard — PRD yêu cầu search maps | **High** | Thêm search input với debounce |
| FE-3 | **Thiếu Version UI** — API có nhưng không có UI publish/list/restore | **High** | Thêm version panel trong editor |
| FE-4 | **Dashboard thiếu pagination** — load tất cả maps 1 lần | Low | Thêm infinite scroll hoặc pagination |
| FE-5 | **Editor `autoLayout` mutates nodes** — side effect, nên return new array | Medium | Clone nodes trước khi layout |
| FE-6 | **`useEffect` deps warning** — `store` object trong deps thay đổi mỗi render | Low | Destructure thành individual functions |
| FE-7 | **Landing page thiếu `<title>` tag** — SEO | Low | Thêm metadata export |
| FE-8 | **Toolbar dùng `<a>` cho back** — full page reload thay vì client navigation | Low | Đổi sang `router.push` |

---

## 4. UI/UX DESIGN

### ✅ Đạt
- Dark theme nhất quán (CSS variables)
- Gradient heading trên landing page
- Hover effects, transitions smooth
- Editor layout 100vh + toolbar fixed
- Custom node styling với selection state (purple border + glow)
- Side panel 360px responsive

### ⚠️ Thiếu / Cần cải thiện
| # | Issue | Mức độ | Giải pháp |
|---|-------|--------|-----------|
| UX-1 | **Landing page quá basic** — chỉ 3 feature cards, không có demo/preview | Medium | Thêm screenshot mindmap hoặc animation |
| UX-2 | **Dashboard cards đơn điệu** — không có thumbnail/preview | Medium | Thêm node count, color dot hoặc mini preview |
| UX-3 | **Editor toolbar không có map title** — chỉ hiện UUID truncated | Medium | Hiện + inline edit title |
| UX-4 | **Note editor thiếu formatting toolbar** — Tiptap có nhưng không có buttons | **High** | Thêm bold/italic/list/code/heading buttons |
| UX-5 | **No loading skeleton** — dashboard shows "Loading…" text | Low | Đổi thành skeleton cards |
| UX-6 | **No toast notifications** — save/error chỉ console.log | Medium | Thêm toast component |
| UX-7 | **No confirmation dialog** — delete dùng browser `confirm()` | Low | Custom modal |
| UX-8 | **Mobile responsiveness** — editor toolbar không wrap tốt trên mobile | Low | Thêm hamburger menu hoặc icon-only mode |
| UX-9 | **No empty state illustration** — "No mindmaps yet" text only | Low | Thêm SVG illustration |

---

## 5. STATE MANAGEMENT (Zustand Store)

### ✅ Đạt
- Clean typed interface (222 lines)
- History stack management (50 entries max)
- structuredClone cho immutability
- Auto-layout algorithm (left-to-right tree)

### ⚠️ Issues
| # | Issue | Mức độ |
|---|-------|--------|
| SM-1 | **`autoLayout` mutates input array** — không tạo copy | Medium |
| SM-2 | **`addNode` gọi `autoLayout` toàn bộ tree** — O(n) mỗi lần thêm node | Low |
| SM-3 | **`setViewport` marks dirty** — viewport pan/zoom liên tục trigger autosave | **High** |

---

## 6. CONVERTERS (DIF/MD/DOCX)

### ✅ Đạt
- DIF intermediate format theo PRD spec
- MD export: headings + `:::note` blocks
- MD import: headings priority, bullet list fallback
- DOCX export: heading levels + note paragraphs
- DOCX import: mammoth HTML → heading tree

### ⚠️ Issues
| # | Issue | Mức độ |
|---|-------|--------|
| CV-1 | **MD export không serialize Tiptap JSON** — chỉ dùng `notePlain` | Medium |
| CV-2 | **DOCX import regex parsing** — `tagRegex` chỉ match single-line tags | Medium |
| CV-3 | **DIF `difToMindmapNodes` layout order** — nodes pushed ở vị trí sai | Low |

---

## 7. SECURITY

| # | Check | Status |
|---|-------|:------:|
| SEC-1 | Password hashing (argon2) | ✅ |
| SEC-2 | JWT + HttpOnly cookies | ✅ |
| SEC-3 | Ownership validation trên API | ✅ |
| SEC-4 | Cascade delete (prevent orphans) | ✅ |
| SEC-5 | Rate limiting | ❌ Thiếu |
| SEC-6 | CSRF protection | ⚠️ Partial (SameSite=Lax) |
| SEC-7 | Input sanitization (HTML) | ❌ Thiếu |
| SEC-8 | Upload validation (size/mime) | ❌ N/A (chưa có upload) |

---

## 8. TỔNG KẾT PRIORITY

### 🔴 Critical (cần fix ngay)
1. **SM-3**: `setViewport` gây autosave liên tục khi pan/zoom → waste bandwidth
2. **FE-1**: Thiếu Export/Import UI buttons
3. **FE-3**: Thiếu Version UI panel
4. **UX-4**: Tiptap thiếu formatting toolbar

### 🟡 Important (nên có cho v1)
5. **FE-2**: Search trong dashboard
6. **BE-1**: Attachments API (MinIO presign)
7. **UX-3**: Editor toolbar hiện + edit map title
8. **DB-3**: Unique constraint version_no
9. **UX-6**: Toast notifications thay vì console.log
10. **FE-5**: `autoLayout` immutability fix

### 🟢 Nice-to-have (v1.1)
11. Rate limiting, VPS docs, loading skeletons, mobile optimization

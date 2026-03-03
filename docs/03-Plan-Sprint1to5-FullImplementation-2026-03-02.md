# Plan: Sprint 1-5 — Full Implementation

**Date**: 2026-03-02  
**Mode**: Triển khai liên tục (skip approval per user request)

---

## Sprint 1 — Mindmap Editor Core (5-7 days)

### Files

| File | Mô tả |
|------|--------|
| `app/maps/[id]/page.tsx` | [MODIFY] Server component load map data |
| `components/editor/mindmap-canvas.tsx` | [NEW] React Flow canvas |
| `components/editor/custom-node.tsx` | [NEW] Custom node component |
| `components/editor/editor-toolbar.tsx` | [NEW] Toolbar (add/delete/zoom) |
| `stores/mindmap-store.ts` | [NEW] Zustand store (nodes/edges/history) |
| `app/api/maps/[id]/save/route.ts` | [NEW] Bulk save API |
| `lib/auto-layout.ts` | [NEW] Tree layout algorithm |

### Logic
- Zustand store quản lý nodes/edges/viewport + undo/redo stack
- Autosave: debounce 1s → POST `/api/maps/:id/save`
- Keyboard: Enter (sibling), Tab (child), Delete (remove), Ctrl+Z/Y

---

## Sprint 2 — Notes Per Node (5-8 days)

### Files

| File | Mô tả |
|------|--------|
| `components/editor/side-panel.tsx` | [NEW] Tabs: Note/Attachments |
| `components/editor/note-editor.tsx` | [NEW] Tiptap rich text editor |
| `app/api/attachments/presign/route.ts` | [NEW] MinIO presigned URL |
| `app/api/attachments/commit/route.ts` | [NEW] Commit attachment |

### Logic
- Click node → side panel mở → Tiptap editor
- noteDoc (JSON) + notePlain (text) lưu cùng node trong bulk save
- Attachments: presign → upload → commit → insert vào note

---

## Sprint 3 — Markdown Import/Export (6-10 days)

### Files

| File | Mô tả |
|------|--------|
| `lib/converters/mindmap-to-dif.ts` | [NEW] Mindmap → DIF tree |
| `lib/converters/dif-to-markdown.ts` | [NEW] DIF → Markdown |
| `lib/converters/markdown-to-dif.ts` | [NEW] Markdown → DIF |
| `lib/converters/dif-to-mindmap.ts` | [NEW] DIF → Mindmap nodes |
| `app/api/maps/[id]/export/md/route.ts` | [NEW] Export endpoint |
| `app/api/import/md/route.ts` | [NEW] Import endpoint |

### Logic
- DIF = intermediate tree format (title + note + children)
- Export: mindmap → DIF → MD (headings + `:::note` blocks)
- Import: MD → DIF → auto-layout → save as new mindmap

---

## Sprint 4 — DOCX Import/Export (8-12 days)

### Files

| File | Mô tả |
|------|--------|
| `lib/converters/dif-to-docx.ts` | [NEW] DIF → DOCX |
| `lib/converters/docx-to-dif.ts` | [NEW] DOCX → DIF |
| `app/api/maps/[id]/export/docx/route.ts` | [NEW] Export endpoint |
| `app/api/import/docx/route.ts` | [NEW] Import endpoint |

### Deps cần cài
- `docx` (DOCX generation)
- `mammoth` (DOCX parsing)

---

## Sprint 5 — Versioning + Hardening (4-7 days)

### Files

| File | Mô tả |
|------|--------|
| `app/api/maps/[id]/publish/route.ts` | [NEW] Publish snapshot |
| `app/api/maps/[id]/versions/route.ts` | [NEW] List versions |
| `app/api/maps/[id]/restore/route.ts` | [NEW] Restore snapshot |
| `components/editor/version-panel.tsx` | [NEW] Version UI |

### Logic
- Snapshot = full JSON của mindmap state tại thời điểm publish
- Restore = overwrite current state từ snapshot

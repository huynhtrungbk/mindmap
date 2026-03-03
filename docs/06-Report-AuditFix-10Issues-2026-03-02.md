# Report: Audit Fix — 10 Issues Resolved

**Date**: 2026-03-02  
**Status**: ✅ All 10 issues fixed, 22 routes, 0 build errors

---

## Summary

| Category | Issues Fixed |
|----------|:-----------:|
| 🔴 Critical | 4/4 |
| 🟡 Important | 6/6 |

## Changes

### Zustand Store (`mindmap-store.ts`)
- **SM-3**: `setViewport` no longer marks `isDirty` → prevents autosave spam on pan/zoom
- **FE-5**: `autoLayout` now clones input nodes before mutating
- **UX-3**: Added `mapTitle` + `setMapTitle` to store

### Database (`schema.prisma`)
- **DB-3**: Added `@@unique([mindmapId, versionNo])` on `MindmapVersion`

### New Components
- `components/ui/toast.tsx` — Global toast notification system (pub/sub, 3s auto-dismiss)
- `components/editor/note-toolbar.tsx` — Tiptap formatting: B/I/S/H2/H3/•/1./❝/</>
- `components/editor/version-panel.tsx` — Publish snapshot, list versions, restore

### Updated Components
- `editor-toolbar.tsx` — Map title editing, Export dropdown (MD/DOCX), Import file picker
- `side-panel.tsx` — Tab-based (📝 Note + 📦 Versions)
- `note-editor.tsx` — Integrated NoteToolbar
- `editor-client.tsx` — ToastContainer + mapTitle sync
- `dashboard/page.tsx` — Search input, loading skeletons, filtered list

### New API Routes
- `POST /api/attachments/presign` — MinIO presigned upload URL (10MB max, mime validation)
- `POST /api/attachments/commit` — Save attachment record to DB

### CSS (`globals.css`)
- +260 lines: toast, note-toolbar, version-panel, side-panel-tabs, toolbar-title, dropdown, search, skeleton, responsive

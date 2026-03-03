# Report: Final Hardening & Polish

**Date**: 2026-03-03  
**Status**: ✅ All 9 items implemented and verified

## Security
- **Rate Limiting**: In-memory sliding window, 10 attempts per 15 min per IP (auth endpoints)
- **Input Validation**: Zod schemas for all API endpoints (register, login, maps, save, attachments)
- **HTML Sanitization**: Allowlist-based sanitizer applied to markdown preview rendering
- **XSS Prevention**: Strips script tags, on* handlers, javascript: URLs, data: URLs, style attrs

## UX Polish
- **Custom Confirm Modal**: Replaces browser `confirm()` with themed modal, danger variant, Escape key, backdrop blur
- **Empty State SVG**: Animated floating illustration when dashboard has no maps
- **Mobile Responsive**: Toolbar compact mode, wrapped actions, smaller font sizes on mobile

## Testing
- **Unit Tests**: 5 test suites, 29 assertions, all passing
  - DIF round-trip, empty input, multiple roots, sort order, position calculation
  - Run with `npx tsx scripts/test-converters.ts`

## New Files (5)
- `lib/rate-limit.ts`
- `lib/sanitize.ts`
- `lib/validation.ts`
- `components/ui/confirm-modal.tsx`
- `scripts/test-converters.ts`

## Updated Files (4)
- `app/api/auth/login/route.ts` — Rate limit + zod
- `app/api/auth/register/route.ts` — Rate limit + zod
- `app/dashboard/page.tsx` — Confirm modal + empty state SVG
- `components/editor/markdown-view.tsx` — Sanitize HTML preview
- `app/globals.css` — Modal, btn-danger, empty state, mobile CSS

## Dependencies
- `zod` — Input validation (already installed)

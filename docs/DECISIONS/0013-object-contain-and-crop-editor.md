# ADR-0013: Object-contain everywhere + optional pre-upload pan/zoom crop editor

Status: Accepted
Date: 2026-07-13

## Context

Three card surfaces were using CSS `background-size: cover` (or `<img object-cover>`) to render merchant images:

- **Trade Center browse card** (`TradeCenterBrowseShell.tsx`) — 4:3 aspect
- **LiveFeedBlock hero banner** (`components/feed/LiveFeedBlock.tsx`) — 16:9 aspect
- **CanteenLiveFeedWow thumbnail** (`components/xrated/yard/CanteenLiveFeedWow.tsx`) — 1:1 aspect

All three cropped merchant uploads to fill the frame. Anything that wasn't the exact target aspect got its edges chopped. That violates the global platform rule (`Global image rule — object-contain, full height + width, no cropping` — feedback memory). The rule exists because merchants photograph products on phones and rarely match a specific aspect; forced cropping decapitates their images.

The fix has two halves:

1. **Change the render** — switch all three to `object-contain` with a soft grey fallback so full images ship uncropped.
2. **Give merchants control when they want it** — the "no crop" default is right for a phone-snap workflow, but merchants who WANT a tighter shot (or who uploaded a wrong-aspect image and want to reframe) need a simple editor. Not everyone will use it; that's fine.

## Decision

**Half 1: Object-contain on the three card surfaces.** Every merchant image renders full-height + full-width via `object-contain` inside a fixed-aspect frame with a `#F3F4F6` soft grey fallback. The badges (Sponsored / Bulk / etc.) stay in their absolute positions overlaid on top. No image loses edges.

**Half 2: Pre-upload crop editor (`ImageCropSheet`).** Optional, opt-in per surface. When the merchant picks a file for the main product image, a full-screen mobile-first sheet opens with:

- The image visible inside a fixed-aspect frame (default 4:3 — matches TC card)
- **Drag to pan** — touch + mouse via pointer events, clamped so the image never leaves an edge inside the frame
- **Zoom slider** (1×–4×) + **+/− buttons** at 44px min tap targets
- **"Save frame"** button — canvas-exports the visible region as a 1600×1200 JPEG blob (quality 0.9), uploads via the existing multipart endpoint
- **"Use original"** button — skips crop, uploads the source file unchanged. Merchants who want the object-contain fit get it in one tap.
- Body scroll lock + backdrop-tap-to-close + Cancel X

Wired into `ProductEditorForm.tsx` main-image upload only. Gallery images stay direct-upload (supporting shots, not the primary card image) — coverage can extend if merchants ask.

**Why pan+zoom instead of the existing focal-point tool** (`src/lib/hero-swap/imageCrop.ts`): focal-point picks a centre in the source image and derives the crop mathematically. Pan+zoom lets the merchant see the exact frame result while editing. For a "which part of my image do I want to keep" workflow, direct manipulation wins on comprehension.

**Client-side canvas export** — the endpoint receives a JPEG blob wrapped in a `File` so the existing `POST /api/trade-off/canteen-product/upload-image` needs no change. Everything downstream (Supabase Storage, the URL flow) is unaffected.

## Consequences

- **Positive:** Zero forced cropping across the three main card surfaces. Merchants see the whole image they uploaded.
- **Positive:** Merchants who want a specific frame have a native mobile-friendly editor with real-time preview. No dependency on a third-party crop library (~30KB saved).
- **Positive:** "Use original" ships the image untouched in one tap — the editor is present but never mandatory. Fastest path stays fast.
- **Positive:** Canvas export at 1600px long-side gives sharp 2× retina rendering on the biggest card without bloating storage.
- **Negative:** Non-4:3 images on TC cards now show soft grey padding on the sides or top/bottom. This is the correct visual outcome per the rule but looks less "designed" than a full-bleed crop. If it turns into a real complaint, the crop editor is one tap away and gets the merchant an in-aspect result.
- **Negative:** Gallery + per-variant images don't get the editor yet. If merchants complain about gallery images looking off, extend the same pattern.
- **Neutral:** Existing `hero-swap` focal-point utility still ships and covers a different UX (fully automatic centred crop for hero images). The two tools coexist; use the right one per surface.

## Alternatives considered

- **Force cropping via focal-point auto-detection (face/subject-detection)** — rejected. Wrong subject-detection on a product photo (kitchen worktop mistaken for background) loses the whole shot. Manual > guess.
- **Third-party crop lib (react-easy-crop, react-image-crop)** — rejected. ~30KB gzipped adds up when we ship it into every page that loads the editor. Custom implementation is ~250 lines and does exactly what we need with pointer events.
- **Store crop metadata (focal x/y/zoom) alongside the URL, render with CSS transforms** — rejected. Two problems: (1) every render surface would need to know the crop math, and (2) buyers download the full-size image every time, even when only 40% is visible. Client-side canvas export produces one clean asset.
- **Server-side crop via sharp** — rejected for v1. Adds a Node runtime dependency and shifts complexity to the endpoint. Client canvas is simpler and works offline.
- **Keep object-cover but let merchants upload at the exact card aspect** — rejected. Would force merchants into image-editing tools before uploading. Kills the phone-snap workflow.

## Enforcement / audit checklist

Any new surface that renders a merchant image must:

1. Use `object-contain` inside a fixed-aspect frame with `bg-[#F3F4F6]` fallback. Only full-bleed hero banners with gradients may `object-cover`.
2. If merchant image upload is added to that surface, wire the crop sheet with the appropriate `aspect` prop.

# Image Library Migration Plan — thenetworkers → NEX

Generated: 2026-07-27T05:44:30.394Z

Discovery pass per ADR-0023 discussion. Zero images moved.
This document proposes target NEX-named Supabase buckets,
classifies the migration set, and sequences the work.
Approve or amend before any execution.

## Current state

- **Unique image URLs across the app:** 981
- **By origin:**
  - `imagekit-legacy`: 720
  - `supabase-storage`: 127
  - `imagekit-nex-era`: 134
- **Existing migration map entries** (`scripts/.imagekit-migration-map.json`): 82
- **Legacy ImageKit URLs still awaiting migration:** 638 of 720

## Supabase buckets currently referenced by URL

- `product-images`: 121 referenced URLs
- `networkers-tv-thumbnails`: 4 referenced URLs
- `social-media`: 1 referenced URLs
- `network-uploads`: 1 referenced URLs

## Legacy migration set — purpose breakdown

These are the URLs on `ik.imagekit.io/9mrgsv2rp/` that
still need to move to NEX-owned storage. Purpose is inferred
from filename + referring-file context (best-effort — audit
the inventory JSON for edge cases).

| Purpose | Count | Suggested NEX bucket |
|---|---:|---|
| hero_banner | 311 | `nex-hero-banners` |
| unclassified | 211 | `nex-unclassified-inbox` |
| avatar | 92 | `nex-avatars` |
| logo | 12 | `nex-logos` |
| product | 7 | `nex-product-images` |
| template_thumbnail | 3 | `nex-template-thumbnails` |
| diagram | 2 | `nex-diagrams` |

## Proposed target-bucket schema

Every NEX-owned bucket follows the naming convention `nex-<domain>-<subdomain>`
so provenance is unambiguous. All buckets `public: true` for CDN reads
(RLS via storage.objects policies for writes). Retire the legacy
`networkers-*` bucket names once references are updated.

## Recommended sequence

1. **Approve target buckets** (this doc)
2. **Write bucket-creation migration** (`supabase/migrations/YYYYMMDD_nex_image_buckets.sql`)
3. **Batch 1 — staircase subset** (~staircase count above): highest-value for the current directory push
4. **Batch 2 — logos + avatars**: small, high-visibility, cleanly separable
5. **Batch 3 — hero banners + wood samples**: modest volume
6. **Batch 4 — product images**: bulk work
7. **Batch 5 — long tail** (templates, sitebook, badges, diagrams, unclassified)
8. **Update reference map** on every batch: extend `scripts/.imagekit-migration-map.json` in append-only mode
9. **Codemod pass** to swap URLs across the ~40 referring files (one-shot per batch, verified diff-by-diff)
10. **Retire the legacy ImageKit account** only after zero references remain (grep verification)

## Referring-files hotspots (top 20 files by legacy URL count)

- `scripts\hero-library.json` — 307 URLs
- `src\app\trade-off\yard\canteens\[slug]\CanteenPageShell.tsx` — 75 URLs
- `src\lib\cache\profiles.json` — 72 URLs
- `src\components\xrated\yard\CanteenTabbedSection.tsx` — 56 URLs
- `src\lib\canteens.ts` — 55 URLs
- `src\lib\yardMoods.ts` — 32 URLs
- `src\apps\notebook\components\NotebookCategoriesStrip.tsx` — 31 URLs
- `scripts\download-plant-imgs.mjs` — 26 URLs
- `scripts\patch-stuart-plant-all-images.mjs` — 26 URLs
- `scripts\seed-stuart-shop-categories.mjs` — 19 URLs
- `src\lib\canteenFeedTileLibrary.ts` — 17 URLs
- `scripts\seed-demo-trade-avatars.mjs` — 15 URLs
- `src\components\xrated\yard\CanteenDashboardSections.tsx` — 13 URLs
- `src\components\xrated\yard\CanteenProfileFocus.tsx` — 12 URLs
- `src\components\xrated\yard\CanteenMobileAppShowcase.tsx` — 11 URLs
- `src\lib\keyCutting.ts` — 10 URLs
- `scripts\beforeafter-library.json` — 10 URLs
- `scripts\patch-plant-brand-logos.mjs` — 10 URLs
- `src\app\trade-off\find-trades\page.tsx` — 9 URLs
- `scripts\seed-yard-chat-mock-life.mjs` — 9 URLs

## Raw inventory

Full per-URL data (canonical URL · origin · purpose · referring files) is in:

`scripts/image-migration-inventory.json`

---

_Next step:_ review + amend, then approve execution posture (batched vs. all-at-once).
Per ADR-0023, no images move until you say go.
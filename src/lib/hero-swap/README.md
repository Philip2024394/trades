# Hero Swap — architecture notes

## What lives where

- **`scripts/hero-library.json`** — canonical seed of 93+ hero images. Human-authored via Claude image-scan sessions. Ships with the app for dev + fallback.
- **`supabase/migrations/20260706000000_hero_library.sql`** — runtime table (`hero_library`) + per-merchant slot persistence (`merchant_hero_slots`). GIN-indexed keywords for fast strict-match queries.
- **`scripts/seed-hero-library.mjs`** — idempotent upsert of JSON into Supabase. Run after adding new entries.
- **`src/lib/hero-swap/library.ts`** — client-side matcher (still reads static JSON — used by demo).
- **`src/lib/hero-swap/supabaseLoader.ts`** — server-side loader (Supabase-first, JSON fallback). Used by API route.
- **`src/app/api/hero-library/route.ts`** — merchant-facing query endpoint. Takes trade keywords, returns matched images.
- **`src/apps/hero-swap/`** — the UI: sheet, chip, carousel, upload panel, crop preview, siblings rail, preset picker, suggestion engine.

## Runtime pattern

```
merchant page loads
  ↓
Server component calls loadHeroLibraryForMerchant(trade_keywords)
  ↓
Supabase available? → hero_library query (GIN-indexed, ~2ms)
Supabase down?     → static JSON filter (still fast, ships with build)
  ↓
Client gets HeroSwapSlot pre-populated with matched images
```

## Adding new hero images

1. Post the image + strict keywords to Claude
2. Claude adds a structured entry to `scripts/hero-library.json`
3. Commit + push (this is enough for dev + JSON fallback)
4. When Supabase seeding is desired:
   ```
   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-hero-library.mjs
   ```
5. Runtime picks up the new entry immediately (no deploy needed once table is authoritative)

## Merchant persistence

Saved to `merchant_hero_slots (merchant_id, slot_key)` — one row per (merchant, page-slot).
`slot_key` examples: `landing_hero`, `about_hero`, `services_hero`, `contact_hero`.

Sibling group "apply across site" writes to multiple slot_keys in one transaction.

## Guarantees

- Strict-match rule is enforced at the query level — client never gets wrong-trade images.
- RLS ensures merchants can only read/write their own hero_slots.
- Static JSON fallback means the platform still works during Supabase incidents.
- Sibling groups + presets + edits are all merchant-editable at runtime.

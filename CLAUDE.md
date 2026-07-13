# Claude context — Thenetworkers

Auto-loaded at the start of every Claude Code session. Keep this file small and pointer-heavy — the real detail lives in `docs/`.

## Read these first

1. **`docs/BLUEPRINT.md`** — auto-generated map of the whole app (50 apps, 158 lib entries, 32 platform areas, 391 pages, 523 APIs, 207 migrations, 17 crons). Regenerate any time with `node scripts/scan-blueprint.mjs`.
2. **`docs/features/index.md`** — human-curated feature index. One line per feature area.
3. **`docs/DECISIONS/`** — Architecture Decision Records. Read the numbered ADRs before questioning a pattern.

## What this codebase is

Thenetworkers — a UK trades platform. Merchant canteen pages (`thenetworkers.app/{slug}`), Trade Center marketplace, Construction Notebook homeowner OS, and a community feed (The Yard). Manifest-first app architecture — see ADR-0001.

## The five things that matter most

1. **Single domain**: `thenetworkers.app`. Every merchant regardless of tier. Never sell them a URL change. See ADR-0002.
2. **Never sell leads / never take commission**. Fixed subscription only. Anti-Checkatrade positioning. See ADR-0003.
3. **Non-destructive restore.** Every merchant edit is recoverable via the admin snapshot system. See ADR-0005.
4. **Free tier is a viral loop, not a loss leader.** Homeowners get Notebook free; free-tier merchants get their URL as long as they log in every 30 days. See ADR-0004.
5. **Every paid feature clears Stripe margin, both directions.** No commission (rule 2) means add-ons self-fund. Min £4.99 with `.99` suffix, ≥95% net-to-us at money-in. See ADR-0010.

## Pricing (as of 2026-07-13)

- **Free** — £0/mo (push bike)
- **Canteen** — £7.99/mo · £72/yr (motor bike)
- **Marketplace** — £11.99/mo · £120/yr (van)
- **The Works** — £15.99/mo · £175/yr (jeep — everything unlocked)

Vehicle metaphor is intentional; see ADR-0006.

## Where to put things

- New feature module → `src/apps/{slug}/` with a `manifest.ts` + one-line `README.md`
- New page → `src/app/{route}/page.tsx` with a leading `//` summary comment
- New API endpoint → `src/app/api/{route}/route.ts` with a leading `//` summary comment
- New library → `src/lib/{name}/index.ts` with a leading `//` summary comment
- New architectural decision → next `docs/DECISIONS/{number}-{title}.md`

## At the end of a meaningful session

```
node scripts/scan-blueprint.mjs
```

Regenerates `docs/BLUEPRINT.md` from actual code. Takes ~2 seconds.

## Rules the user cares about

Some of these live in Philip's auto-memory too, but worth mirroring here:

- **Object-contain everywhere.** Merchant / product / service / machine images use `object-contain` (no cropping). Only full-bleed hero banners with gradients may use `object-cover`.
- **Yellow for accents + CTAs on the packages page.** Dark green for CTAs elsewhere (in-stock indicator green `#10B981` is reserved for that; use `#166534` for CTAs).
- **No em dashes in hero copy.** Use periods or restructure.
- **No AI-star / Sparkles icons.** Star icons in review chips are fine (they mean rating).
- **13px text floor** on the StreetLocal donut app + dashboards. Elsewhere 12px WCAG floor.
- **Evidence-or-silence.** Every displayed fact needs a provable evidence chain OR must be hidden. No fabricated stats ship to real users.
- **Object-contain for all images unless it's a full-bleed hero.** Global rule.

## Not this repo

- `hammer/` (Hammerex product site) lives at `C:\Users\Victus\hammer\`. It shares Supabase with this repo but is a separate Next.js app. Tables prefixed `hammerex_` are shared.
- `citydrivers.id` / `cityriders.id` — Indonesia ride-hail apps. Separate codebase.
- `streetlocal.live` — separate codebase.

## Session-end habits

1. Update the code (usual).
2. Update or write an ADR if the change was architecturally significant.
3. Update `docs/features/index.md` if you added / renamed / removed a feature area.
4. Run `node scripts/scan-blueprint.mjs`.
5. Commit + push.

Everything else the AI or a new dev needs is in `docs/`.

# Route Map · Canonical concept → URL directory

**Read this before scaffolding any new route.** If the concept already lives at a URL below, extend that route. Do not build a parallel one. When in doubt, run `node scripts/scan-routes.mjs` (writes to `docs/route-inventory.md` + `docs/route-inventory.json`).

This document is hand-curated. It flags which URL owns each concept, deprecated routes, redirect shims, and known name-collision hazards. The auto-scanner is the source of truth for *what exists*; this file is the source of truth for *what each thing means*.

---

## Concept ownership (must-know)

| Concept | Canonical URL | Notes |
|---|---|---|
| **Canteens** (community trade-topic hubs) | `/trade-off/yard/canteens/*` | UK Kitchen Fitters, UK Electricians, UK Scaffolders. Rich shell: header + main feed + The Counter side-lane + product panel + PDP + about + manage. |
| Canteen — index | `/trade-off/yard/canteens` | Directory + "Start a canteen" CTA. |
| Canteen — detail | `/trade-off/yard/canteens/[slug]` | Two-column shell. Mobile: hero → carousel → Counter → composer + posts. |
| Canteen — about | `/trade-off/yard/canteens/[slug]/about` | Host card + stats + details. Hosts the profile info that was on the AdminCard. |
| Canteen — manage | `/trade-off/yard/canteens/[slug]/manage` | Host dashboard. Add products, review members, boost. |
| Canteen — products list | `/trade-off/yard/canteens/[slug]/products` | Full grid; each card has "View details" (yellow) + "WhatsApp" (green). |
| Canteen — product PDP | `/trade-off/yard/canteens/[slug]/products/[productId]` | Full detail page, mirror Trade Center PDP structure. Hero with green "Home" + glass "About us" pills. |
| **Public trade profile** (per-trade individual) | `/trade/[slug]` (canonical `/[slug]`) | Trade profile pages. The "individual trade canteen" concept lives here, NOT under `/canteen`. |
| **Trade Center marketplace** | `/tc/trade-center/*` | Wholesale product marketplace. Product PDP at `/tc/trade-center/product/[slug]`. |
| **Yard** — live feed of the network | `/trade-off/yard` | Public activity feed. Canteen posts auto-appear here as of 2026-07-12. |
| **AppShell** (persistent chrome) | wraps `/trade-off/*` | Sticky top bar (search + Canteen chip + Marketplace chip + auth). Mobile: top bar hidden below `md:`. |

## Compatibility redirects (stale-URL shims)

| URL | Redirects to | Why |
|---|---|---|
| `/community` | `/trade-off/yard/canteens` | Absorbs stale 308s cached by browsers when ADR-053 tried to rename canteens → community. That rename never shipped; the shim exists only for cached-URL grace. |
| `/community/[slug]` | `/trade-off/yard/canteens/[slug]` | Same reason. |

Two redirects previously lived in `next.config.mjs` (`/trade-off/yard/canteens → /community`). Those were commented out on 2026-07-12; do NOT re-enable until the `/community/*` product actually ships.

## Deprecated / removed (do NOT rebuild)

| URL | Status | Notes |
|---|---|---|
| `/canteen/*` | **Deleted 2026-07-12** | Parallel per-trade canteen system built briefly, then consolidated back into `/trade-off/yard/canteens/*`. All pages, API routes, mock lib, apps folder, and auth provisioning calls removed. If a per-trade profile page is needed, extend `/trade/[slug]` instead. |
| `/canteen/live` | **Deleted 2026-07-12** | Global feed. Yard already serves this role. |
| `/canteen/[slug]` | **Deleted 2026-07-12** | Per-trade canteen. Use `/trade/[slug]` for individual profiles. |

## Known collision hazards

Watch for concepts that ALREADY exist under multiple names in the repo. If you're about to build one of these, audit first:

- **canteen** — resolved 2026-07-12. Only `/trade-off/yard/canteens/*` remains.
- **shop** — lives under `/trade/[slug]/shop` (per-trade storefront, gated on paid tier). Do NOT create `/shop`.
- **prices** — many surfaces: `/trade-off/prices`, `/trade-off/edit/[slug]/prices`, `/tc/rates/*`. Read all three before building any pricing UI.
- **dashboard** — see `/trade-off/edit/[slug]` (trade dashboard) and `/tc/hub` (Trade Center hub). Ask before building a new dashboard root.

---

## How to keep this file honest

1. **Before scaffolding**: run `node scripts/scan-routes.mjs --search <concept>` and skim the results. Cross-reference against the tables above.
2. **When adding a new route**: append it to the "Concept ownership" table with a one-line purpose.
3. **When removing / renaming a route**: move the old entry to "Deprecated / removed" with a `Deleted YYYY-MM-DD` marker.
4. **When flagging a new collision**: add it to "Known collision hazards" so the next author sees it.

The auto-scanner (`scripts/scan-routes.mjs`) writes `docs/route-inventory.{json,md}` — regenerate anytime.

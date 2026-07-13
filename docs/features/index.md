# Feature Index

One line per feature area. Read this to understand *what the app does*, cross-referenced against `docs/BLUEPRINT.md` for *where the files live*.

## Merchant surfaces

### Canteen (per-merchant landing)
Every merchant gets a public canteen page at `thenetworkers.app/{slug}` — Feed / Products / Designs / Reviews / Contact / Jobs tabs, mobile-first, in-page tab switching via `canteen:set-tab` CustomEvent. Detail: `docs/features/canteen.md` (write me).

### Trade Center Marketplace
Product / parts / service selling with Stripe Connect / PayPal / Coinbase payouts. Bulk-buy, Wholesale, Plant Hire, Key Cutting, Materials Network. Merchants keep 100% — we take no cut. Detail: `src/apps/marketplace/` + `src/app/trade-off/trade-center/`.

### Studio Editor + Live Edit
Merchant-side visual editor + inline content editing on the live canteen. Hero Swap library backs image search. Detail: `src/lib/studio/`.

### Canteen Edit-mode carousel
Edit-mode tile carousel on every canteen (Add Product · Add Service · Live Listing · Kitchen Designs · Edit Profile · Edit Trending · Manage Reviews · Plan & Storage · Members · Reviews), plus a hero-level "Button Features" documentation panel. Selected tile turns yellow, its flow opens inline below the carousel. Reference implementation for the direct-manipulation edit pattern (ADR-0014). Detail: `src/app/trade-off/yard/canteens/[slug]/CanteenPageShell.tsx` (`CanteenHeroStats` + `EditActionSquare`).

### PostCardActionsMenu (3-dots on your own posts)
Pulse-animated 3-dot menu top-right of every Yard post card when the signed-in viewer owns the post. Actions: View · Boost · Archive · Delete. Desktop dropdown, mobile bottom sheet. Replaces the deleted `/trade-off/yard/manage` dashboard. Detail: `src/components/xrated/yard/PostCardActionsMenu.tsx`, ADR-0014.

### Business Card + QR
Full-screen popup card with hero image, address, phone, small QR opening the canteen on the customer's phone. Detail: `src/components/xrated/yard/CanteenBusinessCardModal.tsx`.

## Customer / homeowner surfaces

### Construction Notebook
Homeowner-side personal vault — projects, property records, quotes, warranties. Free forever. Detail: `src/apps/notebook/`.

### Submit Project → Merchant Matching
Homeowner posts a project; matched trades in the postcode get an alert; merchant replies on WhatsApp. No lead fees, no bidding. Detail: `src/app/api/project/*`.

### Property Vault
Property records that follow the property, not the owner. Detail: memory `project_wardflow_auth_assignment.md` context + `src/apps/notebook/`.

## Community

### The Yard
Community-wide feed where UK trades share jobs, tools, tips. Free tier access, active moderation. Detail: `src/app/trade-off/yard/`.

### Live Listings (The Counter)
Auto-scrolling marketplace stream showing Trade Center products, merchant marketing, member listings. Detail: `src/components/xrated/yard/CanteenSideLane.tsx`.

### Find Trades
Trade directory with competitor exclusion — a kitchen fitter's page never lists other kitchen fitters. Priority sort for paid tiers. Detail: `src/lib/tradeOff.ts` (`competitorSlugsFor()`), `src/app/trade-off/find-trades/`.

## Trust & Reputation

### Reviews (Bayesian)
Verified job reviews with weighted aggregate — one 1-star can't crater a new merchant. Detail: `src/lib/reviews.ts` (Bayesian math + zero-rating protection).

### Verified Trade badge
Ultimate-tier only. Companies House auto-verify if slug matches an active UK company (fuzzy Jaccard match, threshold 0.75). Detail: `src/lib/companiesHouse/`.

### Slug policy
Free tier keeps slug while merchant logs in every 30 days. Paid tiers reserve slug for life. Detail: `src/app/api/cron/free-slug-expiry/`, ADR-0004 (write me).

## Money flow

### Packages / Pricing
4-tier ladder — Free / Canteen £7.99 / Marketplace £11.99 / The Works £15.99. Annual saves ~2 months. Fair-use bandwidth cap on The Works video. Detail: `src/app/trade-off/packages/`.

### Stripe subscriptions
Standard Stripe subscription + Stripe Connect for merchant payouts (Marketplace tier onwards). We're never counterparty. Detail: `src/app/api/os/billing/`, `src/app/api/stripe/`.

## Admin

### Customer Support
Admin restore of a canteen to a prior snapshot, gated by admin session + passcode + slug confirmation + 20-char reason note. Non-destructive (pre-restore snapshot captured). Detail: `src/app/admin/(authed)/support/`, `src/lib/canteens.snapshots.server.ts`.

### Content moderation
Reviews, Yard posts, canteen posts all have moderation queues. Detail: `src/app/admin/(authed)/reviews/`, `src/app/admin/(authed)/yard/`.

## Data platform

### Manifest-first apps
Every "app" (Marketplace, Notebook, CRM, etc.) declares itself via `manifest.ts`. Runtime reads manifests to install / uninstall / compose nav. Detail: `src/platform/manifest/`, `src/platform/runtime/`.

### Activity events (OS event bus)
Cross-app event bus — canteen post created, review published, order paid, etc. Powers the landing activity feed and cron aggregations. Detail: `src/lib/activity.ts`, `src/lib/os/events/types.ts`.

### Hero Library
Curated image library backing the "swap hero image" chip on every merchant surface. 14 structured fields per image (subject, keywords, palette, aspect variants, sibling group). Detail: `scripts/hero-library.json`.

## AI

### AI Visualiser
Kitchen / room mockups from customer photos. Ultimate-tier only. Detail: `src/apps/ai-visualiser/`, `src/app/api/apps/ai-visualiser/`.

### Business Coach AI
Merchant-facing AI advisor for pricing, positioning, content. Detail: `src/lib/business-hub/`.

## Missing detail docs

Each entry above should eventually have its own `docs/features/{name}.md` with:
- What it does
- Key files (paths)
- Data model (Supabase tables)
- API endpoints
- Known edge cases / open work

Write these on-demand as each area gets touched. Start with the most-touched: `canteen.md`, `marketplace.md`, `notebook.md`.

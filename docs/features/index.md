# Feature Map — Thenetworkers

**Purpose.** One-stop map of what the app does, organised by domain, so any Claude session (or new dev) can grok the whole system in one read. Complements the auto-generated `docs/BLUEPRINT.md` (file inventory) with human-curated "what and why".

**How to use.**
- Skim the **Domains** TOC to find your area
- Each entry: `**Route/module** — What it does. Tables: t1, t2. Status: live/beta/stub. See: <link>` where relevant

**Update rule.** When you ship or retire a feature, update this file in the same PR. It's a curated map — don't let it drift.

**Companion docs — read this stack for full system knowledge.**
- **`docs/BLUEPRINT.md`** — auto file inventory (50 apps · 179 lib · 32 platform · 423 pages · 570 APIs · 232 migrations · 17 crons). Regenerate: `node scripts/scan-blueprint.mjs`
- **`docs/DB_SCHEMA.md`** — full DB schema (334 tables · 4,459 cols · 444 FKs · 1,215 indexes). Regenerate: `node scripts/scan-db-schema.mjs`
- **`docs/DECISIONS/INDEX.md`** — 15 ADRs each in 3 lines (Context / Decision / Consequences). Full ADRs under `docs/DECISIONS/`
- **`docs/CRONS.md`** — 21 scheduled jobs (17 Vercel + 4 pg_cron) with cadence + purpose + tables
- **`docs/STUBS.md`** — 24 unfinished features (9 S · 9 M · 6 L effort) with what's missing per stub
- **`docs/REVENUE_MAP.md`** — every monetization path with margins + status
- **`docs/SYSTEM_STATE.md`** — honest strength assessment (8.0/10 today) + single points of failure
- **`docs/OLD_CODE.md`** — legacy identifiers kept for compat + genuinely deprecated code
- `docs/EXTERNAL_INTEGRATIONS.md` — Stripe, Companies House, Resend, ImageKit, Supabase
- `docs/SUBDOMAIN_ROUTING.md` — custom domains + `{slug}.thenetworkers.app`
- `docs/trade-palette-catalog.md` — per-trade palette map

---

## Domains

1. [Merchant surfaces](#1-merchant-surfaces) — signup, dashboard, canteen editor, business card
2. [Homeowner surfaces](#2-homeowner-surfaces) — find a trade, notebook, home dashboard
3. [Community — Yard + Canteens](#3-community--yard--canteens) — social feed + per-merchant hubs
4. [Trade Center marketplace](#4-trade-center-marketplace) — product/parts/services buying
5. [Site Interest (image store)](#5-site-interest-image-store) — B2B image sales
6. [Growth loops](#6-growth-loops) — referrals, affiliates, SEO surface
7. [Studio + Apps platform](#7-studio--apps-platform) — manifest apps, runtime, calculators
8. [Washers (lead monetization)](#8-washers-lead-monetization) — WhatsApp lead packs
9. [Admin](#9-admin) — moderation, payouts, red zone
10. [Auth + sessions](#10-auth--sessions) — merchant/homeowner/affiliate/store logins
11. [Marketing + legal](#11-marketing--legal) — about/how/why/legal
12. [Infrastructure](#12-infrastructure) — integrations, DB, crons, watermark pipeline

---

## 1. Merchant surfaces

Everything a signed-in merchant sees. All writes gated by an edit-token cookie (`hammerex_edit_token`).

- **`/trade-off/signup/wizard`** — Multi-step onboarding (trade, location, contact, hours). Tables: `hammerex_trade_off_listings`. Status: live. See: ADR-0004 (free tier), ADR-0006 (vehicle pricing).
- **`/trade-off/signup/done`** — Post-signup confirmation + first-run onboarding prompt. Status: live.
- **`/trade-off/edit/[slug]`** — Merchant dashboard hub (profile, tier, subscription, referrals, notifications). Tables: `hammerex_trade_off_listings`. Status: live.
- **`/trade-off/edit/[slug]/products`** — Product catalog CRUD. Tables: `hammerex_standard_products`. Status: live.
- **`/trade-off/edit/[slug]/services-prices`** — Hourly/daily/project rates. Status: live.
- **`/trade-off/edit/[slug]/operating-hours`** — Weekly availability. Status: live.
- **`/trade-off/edit/[slug]/job-diary`** — Job-progress logbook. Tables: `app_job_diary_jobs, app_job_diary_entries`. Status: live.
- **`/trade-off/edit/[slug]/washers`** — WhatsApp lead quota + top-up. Tables: `hammerex_washer_bags`. Status: live. See: `project_washers_lead_gen_model.md`.
- **`/trade-off/edit/[slug]/insights`** — Impressions, clicks, conversions. Status: live.
- **`/trade-off/edit/[slug]/add-ons`** — Premium app upsells. Tables: `hammerex_app_subscriptions`. Status: live. See: ADR-0010.
- **`/trade-off/edit/[slug]/payments`** — Stripe subscription management. Status: live.
- **`/trade-off/edit/[slug]/newsletter`** — Email campaigns to saved leads. Status: **live (CSV export)**. Full in-platform Resend send + scheduler + audience picker not yet built.
- **`/trade-off/edit/[slug]/team`** — Sub-user invites. Status: **stub**.
- **`/trade-off/edit/[slug]/shop-mode`** — Retail shipping + tax config. Status: live.
- **`/trade-off/edit/[slug]/notifications`** — Push notification prefs. Tables: `hammerex_yard_targeted_notifications`. Status: live.
- **`/trade-off/edit/[slug]/custom-domain`** — Custom domain add-on. See: `docs/SUBDOMAIN_ROUTING.md`. Status: live.
- **`/trade/[slug]`** — Public merchant profile (portfolio, services, reviews, CTA). Tables: `hammerex_trade_off_listings, hammerex_reviews`. Status: live.
- **`{slug}.thenetworkers.app`** — Subdomain-per-trade routing via `src/middleware.ts` (rewrites to `/trade/{slug}`). Status: live.
- **`ReferralShareCard`** on merchant dashboard — 50-free-washer referral CTA. See: `project_merchant_referral_loop.md`. Status: live.

## 2. Homeowner surfaces

- **`/`** — Root landing (AudienceGateBright) with `SmartVisitorHook` face-detection strip. Status: live. See: `src/lib/visitorIntent.ts`.
- **`/trade-off/search?tab=inspiration`** — Endless-scroll masonry of curated + submitted trade-work imagery. Explicit width/height on `<img>` (backfilled via `scripts/backfill-image-dims.mjs`) prevents scroll-jump. `is_banner` filter keeps marketing composites out. Status: live.
- **`/trade-off/inspiration/[id]`** — Per-image detail page: big anti-theft image + 3 WhatsApp-opted trades matching the image tags + "buy this image" store CTA (when in tier 2/3) + related images (sibling group) + ImageObject JSON-LD. Tables: `hammerex_trade_off_listings, networkers_image_submissions, hammerex_feed_tile_library`. Status: live.
- **`/find`** — Directory search (trade, city, postcode). Tables: `hammerex_trade_off_listings, os_business_listings`. Status: live.
- **`/find/[city]`** — City-scoped homeowner landing (100 cities). Tables: `hammerex_trade_off_listings`. Status: live. See: `src/lib/uk-cities.ts`.
- **`/find/beacon`** — Push project to 3 nearest trades for quotes. Tables: `hammerex_xrated_project_beacons`. Status: live.
- **3-tier beacon routing engine** — Homeowner enquiry → fans out to 3 nearest trades with 2h SLA → cron (`*/5`) times out + back-fills → after 4 waves, escalates to `/admin/beacon-residuals` as merchant-acquisition bait (public URL at `/beacon-join/[slug]`). Tables: `hammerex_xrated_project_beacons` (extended), `hammerex_beacon_claims`, `hammerex_beacon_conversion_events`, `hammerex_beacon_admin_residuals`. Status: live 2026-07-17.
- **`/home`** — Homeowner dashboard (properties, projects, quotes, documents). Tables: `os_properties, os_projects, os_documents, app_quote_workspace_quotes, app_job_diary_jobs`. Status: live.
- **`/home/sites`** — Foreman sites overview. Tables: `os_sites, os_site_engagements`. Status: live.
- **`/home/sites/[siteId]`** — Single-site tracker (jobs, engagements, hires). Status: live.
- **`/home/sites/[siteId]/hire`** — Quote-request flow. Tables: `app_quote_workspace_quotes`. Status: live.
- **Construction Notebook** — Homeowner-side personal vault (`src/apps/notebook/`). Status: live. See: `project_construction_notebook_slogan.md`.

## 3. Community — Yard + Canteens

- **`/trade-off/yard`** — Main community feed. Tables: `hammerex_yard_posts, hammerex_yard_likes`. Status: live.
- **`/trade-off/yard/[id]`** — Post detail + comments. Tables: `hammerex_yard_comments`. Status: live.
- **`/trade-off/yard/compose`** — New feed post. Status: live.
- **`/trade-off/yard/canteens`** — Directory of all canteens. Tables: `hammerex_yard_canteens`. Status: live.
- **`/trade-off/yard/canteens/new`** — Create a canteen. Status: live.
- **`/trade-off/yard/canteens/[slug]`** — Per-merchant canteen page (Feed/Products/Designs/Reviews/Contact/Jobs). Tables: `hammerex_yard_canteens, hammerex_yard_posts, hammerex_yard_canteen_members, hammerex_yard_canteen_products`. Status: live. See: `project_canteen_stays_in_canteen.md`, `feedback_canteen_page_bg_white.md`, `project_canteen_palette_set.md`.
- **`/trade-off/yard/canteens/[slug]/manage`** — Canteen settings + moderation. Status: live.
- **`/trade-off/yard/canteens/[slug]/products`** — Canteen product listings. Tables: `hammerex_yard_canteen_products`. Status: live. See: `project_canteen_featured_cap_5.md`.
- **`CanteenBusinessCardModal`** — Fullscreen contact card with QR (every canteen hero). See: `project_canteen_business_card_button_standard.md`. Status: live.
- **`PostCardActionsMenu`** — 3-dot menu on owned posts (View/Boost/Archive/Delete). See: ADR-0014. Status: live.
- **The Counter** — Marketplace-stream naming (`project_the_counter_naming.md`). Status: partial.
- **Yard mood characters** — Optional worker illustration on posts. See: `project_yard_mood_characters.md`. Status: live.

## 4. Trade Center marketplace

Merchant-catalogue-first buying. Merchants keep 100%. See: ADR-0003 (no commission), `project_trade_center_is_os_not_ecommerce.md`, `project_trade_center_checkout_model.md`.

- **`/trade-off/trade-center`** — Browse products across all canteens. Tables: `hammerex_yard_canteen_products`. Status: live.
- **`/tc/identity`** — Trade Center identity home. Status: live.
- **`/tc/apply/[m]`** — Trade Center R05 apply flow. Status: live.
- **`/tc/confidence`** + **`/tc/confidence/consent`** — R07 confidence + consent. Status: live.
- **`src/apps/marketplace/`** — Core product discovery + search. Status: live.
- **Bulk-tiers, Wholesale, Plant Hire, Key Cutting, Materials Network** — Merchant-configurable price bands + inventory rules. Status: live (see `/trade-off/edit/[slug]/*` subroutes).

## 5. Site Interest (image store)

B2B image sales. AI-curated UK trade imagery. See: `project_image_tier_routing_rule.md`, `feedback_image_copyright_risk_rules.md`.

- **`/store`** — Landing: hero + category strip + featured grid + pricing + FAQ. Tables: `hammerex_feed_tile_library`. Status: live.
- **`/store/browse`** — Search + trade chips + masonry grid. Status: live.
- **`/store/i/[id]`** — Image detail + buy/member panel + interactive crop preview. Status: live.
- **`/store/membership`** — Monthly/annual unlimited subscription. Tables: `hammerex_store_memberships`. Status: live.
- **`/store/cart`** — Multi-image cart. Tables: `hammerex_store_orders`. Status: live.
- **`/store/login`** — Store customer sign-in (magic-link). Status: live.
- **`/legal/image-licence`** — Commercial licence terms. Status: live.
- **4-tier routing** — `tier 1..4` + `has_brand_marks` + `is_banner` on `hammerex_feed_tile_library`. Store queries `tier IN (2,3)` clean only; Tier 4 = studio archive. See: `project_image_tier_routing_rule.md`. Status: live.
- **Anti-theft preview** — `src/app/store/i/[id]/PreviewViewer.tsx`: canvas render (no img src in DOM) + 3×3 CSS tile scrim + 720px preview cap + subject-focal watermark + right-click/drag/copy blockers. Status: live.
- **Watermark pipeline** — `src/lib/watermark/`: LSB stego + IPTC copyright + aHash registry. Runs on every paid + member download. Verify endpoint: `POST /api/image/verify`. Tables: `watermark_images, watermark_incidents`. Status: live.

## 6. Growth loops

Merchant acquisition + traffic multiplication. See: `project_networkers_linktree_growth_playbook.md`.

- **SEO city × trade grid** — 108 trades × 100 cities = 10,800 permutations emitted in sitemap. `src/lib/uk-cities.ts` is the catalog. Status: live.
- **`sitemap.ts`** — Emits marketing, trades, cities, cross-product, demo profiles, live listings, yard posts, legal, news (~12k+ URLs). Status: live.
- **`/trade-off/[trade]/[city]`** — Trade × city landing page with LocalBusiness + ItemList + Service schema.org. Also cross-links to 8 nearby cities + 8 sibling trades. Status: live.
- **Cross-link footer** on trade × city pages — `nearbyCities(citySlug)` + `siblingTrades(tradeSlug)`. Multiplies internal link depth. Status: live.
- **Schema.org helpers** in `src/lib/seo.ts` — `localBusinessJsonLd`, `itemListJsonLd`, `serviceJsonLd`, `breadcrumbJsonLd`, `productJsonLd`, `faqJsonLd`, `organizationJsonLd`, `websiteJsonLd`. Status: live.
- **Merchant-to-merchant referral loop** — `?mref=<slug>` → `tn_mref` cookie → `merchant_referrer_slug` on new listings → queues 50-washer reward for both sides. Tables: `hammerex_merchant_referral_rewards`. See: `project_merchant_referral_loop.md`. Status: live.
- **`ReferralShareCard`** — Dashboard widget (copy/WhatsApp/email share). Status: live.
- **Third-party affiliate program** — `?ref=<int>` numeric cookie → `affiliate_referrer_id`. Full admin at `/admin/(authed)/affiliates` (campaigns, commissions, payouts, review-queue, marketing assets, API tokens). Tables: `hammerex_affiliates, hammerex_affiliate_commissions, hammerex_affiliate_payouts`. Status: live. Coexists with merchant referral above.
- **`SmartVisitorHook`** — Face-detect strip on `/`. 5 faces: homeowner / trade / b2b-image / merchant / default. See: `src/lib/visitorIntent.ts`. Status: live (root only; not yet on `/trade-off` or `/find/[city]`).
- **Newsletter drip** (planned) — `/trade-off/edit/[slug]/newsletter`. Status: **stub**.
- **Auto-defaults** (planned per growth playbook) — Status: **not built**.
- **Analytics** (planned) — Status: **not built**.

## 7. Studio + Apps platform

Manifest-first architecture. Every module is a plugin. See: ADR-0001, `project_platform_business_os_architecture.md`, `feedback_platform_apps_manifest_first.md`.

- **`/studio/*`** — Merchant visual editor + inline live edit. Status: live. See: `feedback_studio_first_platform.md`, `feedback_studio_appearance_vs_content.md`.
- **`src/platform/runtime/`** — Install / uninstall / page-create / nav-compose / slots. **Authoritative** — SDK is a thin adapter. See: `feedback_platform_runtime_vs_sdk.md`.
- **`src/platform/design/`** — Theme-aware UI components. `contentShape` preserves content on theme swap. See: `project_platform_design_system.md`.
- **`src/platform/ui/`** — Frozen presentation primitives (SurfaceCard / Grid / Button / ServiceTile / ProjectTile / MobileNavDrawer / StickyBottomActionBar / BottomSheet / SwipeGallery). No hand-rolled Tailwind allowed. See: `feedback_xratedtrades_mobile_ui_kit.md`.
- **`src/apps/<slug>/manifest.ts`** — Every app declares itself here. Tables prefixed `app_<slug>_`. See: `feedback_platform_apps_manifest_first.md`.
- **Calculator apps (20 shipped)** — `calc-bricks, calc-concrete, calc-decking, calc-delivery, calc-fencing, calc-flooring, calc-gravel, calc-insulation, calc-mortar, calc-paint, calc-paving, calc-plasterboard, calc-plastering, calc-render, calc-roof-tiles, calc-skirting, calc-tiles, calc-turf, calc-wallpaper`. Each wraps `src/lib/calculators/*.ts`. Status: live. See: `project_xratedtrade_calculator_suite.md`.
- **App / template distribution model** — **tier-inclusive, NOT a-la-carte marketplace.** Merchants unlock apps + templates by paying subscription tier (Van / Jeep / The Works). Locked apps show "Included in Pro / Upgrade / Start Trial" (per `feedback_studio_add_library_upgrade_path.md`), never "Buy for £X". A-la-carte template purchases are a **future build**, blocked until we have a real catalogue of 5+ sellable-worth-buying templates. Don't build the marketplace scaffolding into empty shelves.
- **`src/apps/ai-visualiser`** — AI photo-to-renovation renders with lead capture (paid). Tables: `app_ai_visualiser_renders`. Status: live.
- **`src/apps/before-after`** — Side-by-side image comparison viewer. Status: live. See: `feedback_beforeafter_library_rule.md`.
- **`src/apps/job-diary`** — Job site logbook. Tables: `app_job_diary_jobs, app_job_diary_entries`. Status: live.
- **`src/apps/notebook`** — Homeowner property + project vault. Tables: `os_properties, os_projects, app_quote_workspace_quotes`. Status: live.
- **`src/apps/crm`** — Contact/project CRM (notes, tasks, follow-ups). Tables: `app_crm_contacts`. Status: **stub**.
- **`src/apps/completer, src/apps/deals`** — Status: **stub / no summary**.

## 8. Washers (lead monetization)

1 washer = 1 verified WhatsApp lead. See: `project_washers_lead_gen_model.md`.

- **Pricing** — Free 10 one-off, packs £4.99/50, £14.99/200, £49.99/1000. Auto-topup default-on. ADR-0010 margin-safe.
- **Bag storage** — `hammerex_washer_bags`. Tracks balance + auto-topup config.
- **Refund** — Admin red-zone flow. See: `/admin/(authed)/red-zone`.
- **Dashboard surface** — `/trade-off/edit/[slug]/washers`. Status: live.
- **Contact gate** — WhatsApp button on canteen requires washer balance. Homeowner→trade contact CTAs never use washers; form friction is the qualifier. See: `feedback_form_gate_not_washer_for_contact.md`.

## 9. Admin

Rooted at `/admin/(authed)/*`. Cookie-gated (`admin_session`).

- **`/admin/payments`** — Stripe transaction ledger, refunds, failed charges. Tables: `stripe_events`. Status: live.
- **`/admin/(authed)/affiliates`** — Affiliate account management. Sub-routes: campaigns, commissions, payouts, marketing, review-queue, reports, audit-log, password-recovery. Tables: `hammerex_affiliates, hammerex_affiliate_*`. Status: live.
- **`/admin/(authed)/news`** — Publish platform news posts. Tables: `hammerex_news`. Status: live.
- **`/admin/(authed)/hero-library`** — Curated hero rotation. Status: live. See: `feedback_hero_library_rule.md`.
- **`/admin/(authed)/featured-placements`** — Pin merchants to featured slots. Status: live.
- **`/admin/(authed)/ai-visualiser`** — AI render quality review + abuse watch. Status: live.
- **`/admin/(authed)/yard`** — Moderate Yard posts. Status: live.
- **`/admin/(authed)/reviews`** — Review moderation. Status: live.
- **`/admin/(authed)/red-zone`** — Banned merchants + violations + washer refunds. Status: live.
- **`/admin/network-reviews`** — 6-axis review moderation shell (freeze/remove/verify actions, wired to `/api/admin/reviews/[id]/action`). Status: live.

## 10. Auth + sessions

Three parallel session models. Never mix.

- **`/sign-in`** + **`/join`** — Unified merchant/homeowner/affiliate entry. Status: live.
- **`/magic-link`** — Passwordless sign-in token validation (Resend email delivery). Status: live.
- **`/home/sign-in`** — Homeowner-specific login. Cookie: `homeowner_session` (HMAC). Status: live.
- **Merchant** — Cookie: `hammerex_edit_token` (HMAC). Set on signup + magic-link. Gates `/trade-off/edit/*`.
- **Admin** — Cookie: `admin_session` (HMAC). Gates `/admin/(authed)/*`.
- **Store customer** — `si-member` cookie (HMAC). `src/lib/storeMemberSession.ts`. Magic-link at `/store/login/verify`.
- **Affiliates** — Password + reset flow. Tables: `hammerex_affiliates`. Login at `/affiliates/login`.

## 11. Marketing + legal

- **`/`** — Root audience gate (`AudienceGateBright`) with `SmartVisitorHook` above. Status: live.
- **`/trade-off`** — Trade marketing home (hero, CTA, live tradie count, demo profiles). Status: live.
- **`/trade-off/why`** — Anti-lead-gen positioning. See: ADR-0003. Status: live.
- **`/trade-off/how`** — How the platform works. Status: live.
- **`/trade-off/faq`** — FAQ. Status: live.
- **`/trade-off/services`** — Discover by service category. Status: live.
- **`/trade-off/pricing`** — Vehicle-metaphor tier comparison. See: ADR-0006. Status: live.
- **`/trade-off/tips`** — Blog: best practices (photography, reviews, WhatsApp, pricing, social). Status: live.
- **`/about, /contact, /status`** — Company + trust pages (Stripe risk requires these). Status: live.
- **`/site-office`** — Merchant help/reference hub. See: `project_xratedtrade_brand_voice_no_ties.md`. Status: live.
- **`/showcase`** — Case studies. 277-line SSR page with live listings + `ItemList` JSON-LD. Status: live.
- **`/news`** — Platform news feed. Tables: `hammerex_xrated_news_posts`. 269-line SSR feed reading live posts. Status: live (thin content — needs more admin-published posts).
- **`/legal/{terms,privacy,refunds,image-licence,aup}`** — Legal pages. Status: live.

## 12. Infrastructure

- **DB** — Supabase `msdonkkechxzgagyguoe` (shared with Hammerex). All Networkers tables prefixed `hammerex_*` (legacy), `app_*` (per-app), or `os_*` (Notebook-side OS). 232 migrations.
- **Management API access** — Token in `.env.tools.local`. `POST api.supabase.com/v1/projects/{ref}/database/query`. See: `reference_hammerex_supabase_admin.md`.
- **Middleware** (`src/middleware.ts`) — Host router (custom domains + subdomain-per-trade) + affiliate `?ref=` cookie + merchant `?mref=` cookie. Runs on every request.
- **Stripe** — LIVE. Subscriptions (merchant tiers), one-off (store single image + packs), Customer Portal, webhook at `/api/stripe/webhook` (invoice.payment_succeeded, charge.refunded). Separate webhook at `/api/store/stripe-webhook` for store orders + subscriptions.
- **Resend** — Email delivery (magic links, affiliate emails, contact form).
- **Companies House** — LIVE. Verification lookup for merchant onboarding.
- **ImageKit** — Image CDN with URL transforms (`?tr=w-N,h-N,cm-extract,fo-face_auto,q-N,f-jpg`). Migration cron ImageKit→Supabase Storage (see `reference_hammerex_imagekit_migration_routine.md`).
- **WhatsApp** — Deep-link only (`wa.me/{digits}?text=...`). No Business API. Contact gate consumes washers.
- **Cron jobs (17 total)** — News scheduling, listing tier expiry, verified recompute, affiliate monthly alerts, affiliate social health, subscription grace, review reminders, washer auto-topup, etc. See `docs/BLUEPRINT.md` for the list.
- **Watermark pipeline** — `src/lib/watermark/{visible,steganography,metadata,perceptualHash,pipeline,registry,config,cache,urls}.ts`. Runs on paid store downloads. Tables: `watermark_images, watermark_incidents`. Verify: `POST /api/image/verify`.
- **Hero library** — `scripts/hero-library.json` (203+ entries, 14 fields each). See: `feedback_hero_library_rule.md`.
- **Blueprint scanner** — `node scripts/scan-blueprint.mjs` regenerates `docs/BLUEPRINT.md`. Run after every meaningful session.

---

## ADR quick reference

| # | Title | One-liner |
|---|---|---|
| 0001 | Manifest-first apps | Every feature module is a plugin at `src/apps/<slug>/manifest.ts` |
| 0002 | Single domain | Every merchant lives at `thenetworkers.app`. Never sell URL changes. |
| 0003 | Never sell leads | Fixed subscription only. No commission. Ever. |
| 0004 | Free slug expiry | Free tier keeps URL if logged in every 30 days |
| 0005 | Non-destructive canteen restore | Every merchant edit is recoverable via admin snapshot |
| 0006 | Vehicle metaphor pricing | Push bike / Motor bike / Van / Jeep tier metaphor |
| 0007 | No editorial image rules | Every image the merchant uploads is theirs to place |
| 0008 | Per-product surface flags | Products can opt-in/out of specific surfaces individually |
| 0009 | eBay parity — category aspects | Product schemas follow eBay's category attribute shape |
| 0010 | Stripe-margin-safe pricing | Every paid feature ≥95% net-to-us both directions |
| 0011 | Per-variant overrides | Variants can override any parent product field |
| 0012 | Consumer variant picker | Standard picker UX across every surface |
| 0013 | object-contain + crop editor | Global image rule: contain, never crop. See global rule. |
| 0014 | Direct-manipulation edit pattern | 3-dots-on-your-own-content model (canteens + yard) |
| 0015 | Canteen app + template split | Templates are visual only; content lives in dedicated editors |

---

## Recent additions (2026-07-17)

- **4-tier image routing** (`project_image_tier_routing_rule.md`) — store filters `tier IN (2,3)` clean
- **Site Interest anti-theft** — canvas render + 720px cap + subject watermark + right-click blockers
- **Layer-4 stego pipeline wired** — every paid download embeds buyer email + registers aHash
- **UK city catalog** (`src/lib/uk-cities.ts`) — 100 cities with nearby lookup
- **Sitemap cross-product** — 10,800 trade × city URLs emitted
- **Cross-link footer** on trade × city pages
- **ItemList + Service schema.org** on trade × city pages
- **Visitor intent classifier** + `SmartVisitorHook` component (root landing)
- **Merchant referral loop** — `?mref=<slug>` cookie + `merchant_referrer_slug` column + reward queue
- **`ReferralShareCard`** wired into merchant dashboard
- **MEMORY.md housekeeping** — 30KB → 22.6KB, grouped by cluster

---

_Update this file when you ship or retire a feature. Regenerate `BLUEPRINT.md` with `node scripts/scan-blueprint.mjs` for the file-level inventory._

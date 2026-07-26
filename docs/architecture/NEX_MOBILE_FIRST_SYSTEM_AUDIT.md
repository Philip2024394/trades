# NEX Mobile-First System Audit

**Author:** Claude
**Date:** 2026-07-27
**Status:** Report only — no code, no migrations, no deletions
**Purpose:** Give Philip a complete map of the existing NEX ecosystem so a mobile-first architecture decision can be made.

---

## Executive summary

The repository contains **two overlapping systems**:

1. **The mature xratedTrades / Thenetworkers platform** — a manifest-driven, event-sourced, 50-app OS with 455 pages, 606 API endpoints, 322 migrations. Started as `hammerex_trade_off_*`, evolved into a full trade-directory + merchant SaaS.

2. **The new NEX mobile-first surface + intelligence layer** — a smaller footprint under `/nex-app/*` (9 pages) plus the substantial NEX intelligence layer (10 nex_*.sql migrations + `data/staircase-*.json` engines + `knowledge/staircase.json` + `docs/brains/*`).

The two systems currently coexist but **do not fully share data**. The mobile-first `/nex-app/centre` (Pinterest feed) renders hardcoded demo data, not the actual `os_products_*` catalogue that the platform's products app populates.

**The core recommendation is not to rebuild.** The platform's 322 migrations + 606 API endpoints represent enormous engineering. The right path is to:
- **Keep the desktop platform as the operations layer** (admin, business management, analytics, complex flows)
- **Promote `/nex-app/*` as the primary customer + trade-facing mobile surface**
- **Wire the NEX Pinterest feed to the real product / merchant / brain data**, replacing the hardcoded demo
- **Consolidate 8-12 legacy surfaces** that duplicate what NEX now does

---

## PART 1 — Complete existing system inventory

### 1.1 Apps (`src/apps/`) — 54 modules

Categorised for the audit:

**Calculators (18):** calc-bricks · calc-concrete · calc-decking · calc-delivery · calc-fencing · calc-flooring · calc-gravel · calc-insulation · calc-mortar · calc-paint · calc-paving · calc-plasterboard · calc-plastering · calc-render · calc-roof-tiles · calc-skirting · calc-tiles · calc-turf · calc-wallpaper

**Core commerce (5):** products · orders · quote-workspace · tradecenter · tradeCounter

**Trade productivity (7):** notebook · job-diary · jobs · jobBoard · job-builder · crm · rates

**Merchant profile/site (7):** merchant · identity · hub · onboarding · meet-the-team · newsletter · trade-connections

**Content/feed (5):** live-feed · live-edit · social · deals · favourites

**Visualisation (3):** ai-visualiser · before-after · van-wrap

**Studio + branding (4):** author-studio · business-card · hero-swap · sitebook

**Communication (2):** messages · reviews

**Other (3):** completer · routes · trades

### 1.2 Platform (`src/platform/`) — 32 areas

Manifest-first foundation: aiTools · apps · booking · business · buttons · coach · commands · content · dashboard · demo · design · featureFlags · forms · goldenPath · journey · layouts · manifest · metrics · navigation · notifications · packs · policy · registryKit · runtime · sdk · search · shell · studio · telemetry · themes · ui · widgets.

### 1.3 Route surfaces (`src/app/`) — 455 pages

Grouped by URL prefix:

| Prefix | Purpose | Approx pages |
|---|---|---|
| `/admin/*` | Operator/admin surface | 60+ |
| `/tc/*` | Trade Center customer app | 25+ subdirs |
| `/trade-off/*` | Merchant signup + editing | 40+ |
| `/trade/[slug]/*` | Public trade/merchant profile | 30+ |
| `/nex-app/*` | **New mobile-first NEX surface** | 9 pages |
| `/api/*` | 606 endpoints | (see 1.4) |
| Marketing (about · pricing · homes · find · plan · etc.) | Public entry pages | 100+ |
| Homeowner (project · sitebook · site-board · property · quote) | Homeowner flows | 40+ |

### 1.4 API endpoints (`src/app/api/`) — 606 routes

Top-level groups: activity · admin · affiliates · ai · analytics · apprenticeships · apps · assets · auth · beacon · boost · brain · brain-admin · bug-reports · canteens · case-studies · channels · checkout · comparison-lead · contact · content-reports · conversations · counter · cron · dev · entity · events · feed · foreman · geo · gold-path · health · hero-library · home · homeowner · image · image-library · inbox · insights · inspiration · invitations · jobs · join · knowledge · licenses · logo · media · memory · merchant · merchant-page · nex · notebook · oauth · os · pay · payments · plan · plant-hire · platform · pricing · project · publications · quote · quote-requests · rates · reply · report · repurpose · reviews · scheduled-posts · signals · signup · site · site-boards · sitebook-invite · story-arcs · stripe · studio · support · trade · trade-off · upgrade-prompts · uploads · videos · vision · washers · webhooks.

### 1.5 Database (`supabase/migrations/`) — 322 migrations

Table families (from migration filenames):
- **`hammerex_*`** — legacy platform tables (trade_off_listings, quote_requests, network_reviews, canteen products, trade_off_yard, washer_bag, etc.)
- **`app_products_*`** — Products app tables (merchant offers, collections, supplier ranges)
- **`os_products_*`** — canonical product truth
- **`os_activity_events`** — cross-cutting event log
- **`os_whatsapp_logs`** — audit trail
- **`hammerex_nex_knowledge_entries`** — NEX brain content
- **`nex_*` migrations (10)** — intelligence, publish RPC, source library, research reports, health, backups, social, verified knowledge, memory, business brain

### 1.6 Lib (`src/lib/`) — 188 entries

Largest clusters: LLM wrappers · affiliate infrastructure · trade session/auth · canteen/reviews/notebook helpers · calculators · demo seeds · trade brand/theme · trust scoring · payment providers (Stripe/PayPal/Square/Wise) · WhatsApp/SMS/email dispatch · geocoding · UK postcode centroids · knowledge graph · hero library.

### 1.7 NEX intelligence layer (built this session)

Not in `src/*` — separate content/data layer:

- **`knowledge/staircase.json`** — 1,922 FAQ brain entries
- **`data/staircase-*.json`** — 8 structured engines (diagnosis · design recommendation · quote engine · defect responsibility · supplier matching · project workflow · customer intent profile · country packs × 3)
- **`data/uk-merchant-directory.json`** — 142 UK merchant records
- **`docs/brains/*`** — 12 architecture/spec docs

---

## PART 2 — Module report

For each significant module: purpose · users · functionality · database · status · value.

### Legend
- **Status:** Active (in production use) · Partially active (built but underused) · Prototype (visible but demo only) · Legacy (superseded by newer) · Unknown (need Philip input)
- **Value scores:** Customer / Business / Future NEX importance, each 1-10

---

### CENTRE / TRADECENTER (customer marketplace)

| Field | Value |
|---|---|
| Purpose | Discovery surface where customers browse products, projects, deals, suppliers |
| Current users | Customers · Homeowners · Trades browsing suppliers |
| Functionality — old `/tc/trade-center` | (Now deleted this session) Categorised grid, category / merchant / product pages, real DB backing via `browseAllProductsFromDb()` on `show_in_trade_center=true` |
| Functionality — new `/nex-app/centre` | Pinterest-style masonry feed, 12 card kinds, hardcoded demo data currently |
| Database | `os_products_canonical` · `app_products_merchant_offers` · `hammerex_trade_off_listings` (merchants) · `hammerex_feed_tile_library` |
| Status | `/nex-app/centre` **Prototype** (needs wiring to real data) · `/tc/trade-center` deleted this session |
| Customer value | **9** — this is the front door to the whole marketplace |
| Business value | **10** — where merchant listings surface to buyers |
| Future NEX importance | **10** — the primary mobile discovery experience |

---

### PRODUCTS (App #006 — canonical layer)

| Field | Value |
|---|---|
| Purpose | Three-tier product model: manufacturer publishes canonical → supplier distributes → merchant sets price + stock |
| Current users | Manufacturer · Supplier · Merchant · consumed by every downstream commerce/quote app |
| Functionality | Canonical product truth, variant tree (colour × size × finish), merchant offers with local price/stock, merchant collections, supplier ranges, supplier feed ingest, lifecycle states (draft/active/legacy/withdrawn), event system (product.published/updated/withdrawn/price_changed/stock_low) |
| Database | `os_products_canonical` · `os_products_variants` · `app_products_merchant_offers` · `app_products_merchant_collections` · `app_products_supplier_ranges` · `app_products_supplier_feeds` — 10 migrations |
| Status | **Active** — foundational, RLS-gated, event-driven |
| Customer value | **9** |
| Business value | **10** |
| Future NEX importance | **10** — every marketplace listing goes through here |

---

### NEX INTELLIGENCE LAYER (this session's builds)

| Field | Value |
|---|---|
| Purpose | Reasoning + knowledge layer that turns NEX from information tool into decision engine |
| Current users | Customer chat surfaces · staircase configurator · future merchant assistant |
| Functionality | 1,922 FAQ brain · 100-entry diagnosis engine · design recommendation (10 styles) · quote engine · supplier matching · defect responsibility matrix · country packs (UK/US/AU) · project workflow · customer intent profile · trust architecture · answer confidence model |
| Database | `hammerex_nex_knowledge_entries` (322 migrations include 10 `nex_*` tables); file-system knowledge/data/docs |
| Status | **Active** — knowledge in production, engines in JSON not yet wired into UI end-to-end |
| Customer value | **9** — the "smart" in NEX |
| Business value | **8** — differentiator vs generic marketplaces |
| Future NEX importance | **10** — this is what makes NEX not-a-chatbot |

---

### CANTEEN (merchant public profile / product catalogue)

| Field | Value |
|---|---|
| Purpose | Merchant's public-facing storefront with products, hero, sections, snapshots |
| Current users | Merchants (edit) · Customers (browse) |
| Functionality | Public merchant profile at `/trade/<slug>`, canteen products with `show_in_trade_center` flag, hero swap, section-based layout, non-destructive snapshot/restore, product surface flags for feed |
| Database | `hammerex_trade_off_listings` · `hammerex_canteen_products` · `hammerex_canteen_snapshots` · `hammerex_feed_tile_library` |
| Status | **Active** — real merchants use it |
| Customer value | **7** |
| Business value | **10** — this is the merchant's shop window |
| Future NEX importance | **8** — merchants keep editing here; `/nex-app/centre` reads from the same data |

---

### YARD (community post feed)

| Field | Value |
|---|---|
| Purpose | Merchant-side community feed — posts, reactions, comments, WhatsApp deep-links |
| Current users | Paid-tier merchants + builder-grade trades (free access) |
| Functionality | Yard posts + reactions + moods, admin cross-post from newsroom, merchant welcome message, WhatsApp button on posts, access gated by `yardAccess` predicate |
| Database | `hammerex_trade_off_yard_posts` · yard reactions tables |
| Status | **Active** — has real posts and access rules |
| Customer value | **4** (customers don't see it) |
| Business value | **6** — retention feature for merchants |
| Future NEX importance | **6** — could become "NEX Community" but needs redesign for mobile |

---

### CANTEEN PRODUCTS + PICKS (merchant-curated selections)

| Field | Value |
|---|---|
| Purpose | Merchants pick which of their canteen products appear on the trade-center marketplace |
| Current users | Merchant-grade trades (via add-on) |
| Functionality | `/trade-off/edit/[slug]/trade-center-picks` editor with magic-link token, browse shell, upsert/list/delete APIs |
| Database | Uses `hammerex_canteen_products` with a picks/filter table |
| Status | **Partially active** — will be superseded by the Phase 7 Merchant AI Assistant |
| Customer value | **N/A** (merchant tool) |
| Business value | **6** — being replaced by conversational alternative |
| Future NEX importance | **3** — replace with merchant AI assistant |

---

### IMAGE LIBRARY / HERO LIBRARY / SITE BOARDS

| Field | Value |
|---|---|
| Purpose | Multi-purpose image ecosystem: 93+ curated hero images, trade-submitted images, homeowner site pinboard |
| Current users | Merchants (choose hero) · Homeowners (save inspiration) · Admin (moderate) |
| Functionality | Hero library CRUD, image submission with quality gate, site board with cookie-scoped owner_key, inspiration detail page finds 3 nearest matching trades, image submission moderation queue |
| Database | `hero_library` · `networkers_image_submissions` · site board tables |
| Status | **Active** — has moderation queue, admin CRUD, homeowner pinboard flow |
| Customer value | **8** — visual inspiration drives project starts |
| Business value | **7** — inspiration → matched trade → enquiry |
| Future NEX importance | **9** — this IS the "NEX Inspiration Library" Philip asked about |

---

### APP WAREHOUSE (xratedAddons / App Store)

| Field | Value |
|---|---|
| Purpose | Registry of every "App" a merchant can install from the App Store — feeds dashboard hub, public app store page, public profile renderer |
| Current users | Merchants (install/enable) · Customers (see enabled features on merchant pages) |
| Functionality | Single-source-of-truth registry, `addons_enabled` DB column, hub dashboard tiles, public app store page, per-app entitlement gates |
| Database | `hammerex_trade_off_listings.addons_enabled` · per-app tables |
| Status | **Active** — 50+ apps registered, merchant install flow exists |
| Customer value | **5** (indirect) |
| Business value | **9** — subscription upsell layer |
| Future NEX importance | **7** — rebadged as "NEX Tools / Apps" for mobile |

---

### CALCULATORS (18 modules)

| Field | Value |
|---|---|
| Purpose | UK-specific trade calculators (bricks, concrete, plastering, roofing, etc.) — merchant PDPs use one as the default alongside their product |
| Current users | Merchants (add to app store) · Customers (calculate quantities) |
| Functionality | Pure-function calculators with 3 embed sizes, trade-allowlist gating, Part L 2025 compliance where relevant |
| Database | Pure functions — no state |
| Status | **Active** — 18 launched |
| Customer value | **8** |
| Business value | **7** — enquiry driver |
| Future NEX importance | **8** — every quote-request flow benefits |

---

### NOTEBOOK (trade's private buying list)

| Field | Value |
|---|---|
| Purpose | Trade's personal buying list — each item auto-matches nearest verified merchant, bulk quote requests fan out |
| Current users | Trades who buy materials (plasterer, bricklayer, carpenter, etc.) |
| Functionality | Personal-list-first (never a global deals wall), nearest-merchant matching, multi-item basket → one bulk quote request |
| Database | `hammerex_trade_off_notebook_*` + activity events |
| Status | **Active** |
| Customer value | **6** (trades are the users) |
| Business value | **9** — surfaces merchants without commission |
| Future NEX importance | **8** — trade-facing companion to customer-facing centre |

---

### QUOTE WORKSPACE

| Field | Value |
|---|---|
| Purpose | Loop-closer between AI Visualiser (produces spec) and Orders (accepted quote in fulfilment) |
| Current users | Merchants + trades |
| Functionality | Consumes render.completed → auto-draft, publishes quote.* events for CRM, Home Timeline, Orders |
| Database | Quote tables + shared event bus |
| Status | **Active** |
| Customer value | **7** |
| Business value | **10** — the money loop |
| Future NEX importance | **10** — Phase 3 Quote Engine feeds this |

---

### JOB DIARY / CRM / REVIEWS / ORDERS

| Field | Value |
|---|---|
| Purpose | Operational spine: quote.accepted → job.opened → job.checked_in → job.photo_added → job.signed_off → warranty.registered → review.requested → review.posted |
| Current users | Merchants + trades |
| Functionality | Event-sourced job lifecycle, verified reviews (bound to signed-off jobs — no drive-by), CRM contact per merchant × person |
| Database | Job diary tables · CRM contacts · `hammerex_network_reviews` · order tables |
| Status | **Active** — foundational apps |
| Customer value | **7** |
| Business value | **10** — retention loop |
| Future NEX importance | **9** — feeds into project tracking workflow |

---

### AFFILIATES SYSTEM

| Field | Value |
|---|---|
| Purpose | Affiliate marketing with commission tracking, fraud detection, tax reports, level system, campaigns |
| Current users | Affiliates · admin · new signup merchants (mref cookie) |
| Functionality | Session cookie · commission approval · payout generation · 4-rule fraud detection · levels · tax report CSV · campaigns |
| Database | Affiliate tables · commissions · payouts · click logs |
| Status | **Active** — extensive infrastructure |
| Customer value | **2** (invisible) |
| Business value | **8** — growth loop |
| Future NEX importance | **6** — background growth engine, keep as-is |

---

### AI VISUALISER

| Field | Value |
|---|---|
| Purpose | Merchant-scoped AI renovation renders — customer uploads room, gets styled render with merchant products |
| Current users | Merchants who install the app · Homeowners on merchant pages |
| Functionality | Multi-provider (OpenAI Images, Flux, Nano Banana), abuse detection, perceptual hashing, credit gating, admin firehose |
| Database | Render logs · provider config · usage credits |
| Status | **Active** |
| Customer value | **9** — dramatic conversion tool |
| Business value | **8** — premium tier feature |
| Future NEX importance | **9** — extends to whole-project visualisation |

---

### AUTHOR STUDIO / LIVE EDIT / STUDIO / SITEBOOK

| Field | Value |
|---|---|
| Purpose | Content creation surfaces — merchants edit their sites, homeowners publish sitebooks |
| Current users | Merchants (author) · Homeowners (sitebook) |
| Functionality | Live editing of merchant profile, section-based layouts, palette tokens, brand theming |
| Database | Numerous edit-state tables |
| Status | **Active** for author-studio + live-edit; **Partially active** for sitebook |
| Customer value | **6** |
| Business value | **8** |
| Future NEX importance | **5** for author-studio (desktop editing), **8** for sitebook (mobile homeowner surface) |

---

### ADMIN SURFACE (`/admin/*` — 60+ pages)

| Field | Value |
|---|---|
| Purpose | Operator/owner surface — every operational lever in one place |
| Current users | Admin only (password-gated) |
| Functionality | Payments · red-zone command centre · reviews moderation · image submissions queue · affiliate management · shadow profile growth · beacon residuals · news composer · feed tile library · brain-health · pilot ops |
| Database | Reads across every table via `supabaseAdmin` (service role bypasses RLS) |
| Status | **Active** |
| Customer value | **N/A** |
| Business value | **10** — operations depend on this |
| Future NEX importance | **10** — this becomes "NEX Desktop Operations Layer" per Philip's brief |

---

### NEX MOBILE SURFACE (`/nex-app/*` — 9 pages built this session or recently)

| Field | Value |
|---|---|
| Purpose | Mobile-first NEX customer + trade surface |
| Current pages | `/nex-app` (root) · `/centre` (Pinterest feed) · `/brains` + `/brains/[brain_slug]` · `/contacts` · `/design-system` · `/discover` + `/discover/join` · `/messages` · `/staircase-configurator` |
| Current users | Customers (browsing) · Trades (via subdomains soon) |
| Functionality | Currently: Pinterest feed with demo data, staircase configurator (real), brains browsing, discover surface, contacts, messages, design system reference |
| Database | Not fully wired — feed is hardcoded demo, brains/staircase-configurator connect to real content |
| Status | **Prototype** — mobile-first UI shell built, data pipes not connected |
| Customer value | **9** (once connected to real data) |
| Business value | **10** — this is the future front door |
| Future NEX importance | **10** — primary mobile experience |

---

## PART 3 — Specific module deep dives

### 3.1 NEX Centre — should it be the main discovery home?

**Findings:**
- Route: `/nex-app/centre` — served by `NexPinterestFeed` component
- Layout: CSS masonry, 2-column mobile-first, 12 card kinds (product, project, deal, activity, community, AI recommendation, supplier, review, calculator, calc-result, article, video)
- Design language: warm off-white base, orange gradient accents used sparingly, photograph-forward
- **Currently rendering hardcoded demo data** — not the real `os_products_canonical` catalogue
- No dependency on `src/apps/tradecenter/` internals — self-contained
- Existing search API at `/api/nex/centre-search/route.ts` — needs postcode-proximity extension (see Phase 7 plan)

**Recommendation: YES — make this the main mobile discovery home.**

**Required to make it real:**
1. Replace hardcoded `SEED_ITEMS` with a real feed pipeline that reads:
   - `os_products_canonical` + `app_products_merchant_offers` (products, deals)
   - `hammerex_feed_tile_library` (curated tiles)
   - `hammerex_trade_off_yard_posts` (community activity)
   - `hero_library` + `networkers_image_submissions` (inspiration)
   - Merchant profiles via `hammerex_trade_off_listings` (supplier cards)
2. Add region filter driven by user postcode (uses postcode → region map from `staircase-supplier-matching-rules.json`)
3. Personalisation shaped by Customer Intent Profile (Phase 5 spec)
4. Save/heart affordance persists per user

---

### 3.2 Image Library — should it become "NEX Inspiration Library"?

**Findings:**
- Three overlapping surfaces:
  - **Hero Library** — 93+ curated hero images, admin CRUD, JSON seed + `hero_library` DB table
  - **Trade Image Submissions** — `networkers_image_submissions` table, quality gate + moderation queue
  - **Site Boards** — cookie-scoped homeowner pinboard, `inspirationDetail.server.ts` matches saved images to nearest 3 WhatsApp-opted-in trades
- **`inspirationDetail.server.ts` already unifies these** — reads from both sources, ranks by trade match
- APIs: `/api/hero-library/*` · `/api/image-library/submit` · `/api/image-submissions` · `/api/site-boards/*`

**Recommendation: YES — merge and rename to "NEX Inspiration Library".**

Consolidation opportunities:
1. Rename umbrella surface as "NEX Inspiration" — single entry point for both curated + trade-submitted images
2. Site Board becomes "My NEX Inspiration Board" — same underlying table
3. Image submissions moderation stays in admin (desktop)
4. Add inspiration image → matched merchant products (bridges to Products via visual similarity — future)

---

### 3.3 Yard — mobile-valuable?

**Findings:**
- Merchant-facing community feed (not customer-facing)
- Access gated: paid tier or builder-grade trade
- Real activity: yard posts, reactions, moods, admin cross-posts from newsroom
- Small footprint: ~6 files in `src/lib/yard*`

**Recommendation: MERGE into a "NEX Community" tab within `/nex-app/*`.**

- Keep the data (`hammerex_trade_off_yard_posts` etc.)
- Redesign the UX for mobile — thumb-first scroll, larger tap targets
- Merge yard posts + reactions + newsroom cross-posts into one feed
- Keep merchant-only access (Philip's builder-grade rule)

**Do not remove.** Yard has real content and real users. Rebranding + mobile UX is the answer.

---

### 3.4 Canteen — should it become "NEX Community"?

**Findings:**
- Canteen is NOT a community feed — it's the **merchant's product catalogue and public storefront**
- Confusion likely from the word "canteen"
- Data model: `hammerex_canteen_products` are the merchant's products; `hammerex_trade_off_listings` is the merchant record
- Snapshots + restore for non-destructive editing

**Recommendation: RENAME "Canteen" → "NEX Merchant Store" (internal only; user-facing "shop" or similar).**

- Do NOT convert Canteen into Community — it's a storefront, not a chat
- Yard is the community candidate (see 3.3)
- Canteen products feed the NEX Centre marketplace directly

---

### 3.5 App Warehouse — should it become "NEX Tools / Apps"?

**Findings:**
- `xratedAddons.ts` is the registry — 50+ apps (calculators, CRM, notebook, orders, etc.)
- Merchant installs from an "App Store" surface
- Existing internal name is confusing (Addons vs Apps)

**Recommendation: RENAME to "NEX Tools" (customer-facing) / "NEX Apps" (merchant-facing).**

- Move the App Store UI into the mobile `/nex-app/*` surface for merchants
- Keep the current dashboard for desktop merchant users
- Rebadge calculators as "NEX Tools" so customers understand they're free utilities

---

### 3.6 Products system — how does it connect to NEX Centre / Merchant / Supplier matching?

**Findings:**
- Three-tier canonical/variants/offers already built (see PART 2 Products)
- Event system already publishes product.published etc.
- **NOT currently wired into `/nex-app/centre`**
- The Phase 4 Supplier Matching Engine (this session's JSON) doesn't know about the actual product records — it matches on merchant category tags

**Recommendation: this is the critical integration for Phase 7+.**

Integration architecture:
```
Merchant creates product via Merchant AI Assistant (Phase 7)
        ↓
os_products_canonical + app_products_merchant_offers (existing tables)
        ↓
Approval → published → product.published event fired
        ↓
NEX Centre feed pipeline picks it up (needs to be built)
        ↓
Displayed in Pinterest feed at /nex-app/centre
        ↓
Customer searches / filters via /api/nex/centre-search (needs postcode extension)
        ↓
Supplier Matching Engine reads product records (not just categories)
        ↓
Design Recommendation Engine + Quote Engine reference real product prices
```

**This is the single most important architectural connection to build.**

---

## PART 4 — Mobile-first decision matrix

| Module | Keep | Rebuild | Merge | Archive | Remove | Reason |
|---|:-:|:-:|:-:|:-:|:-:|---|
| NEX Centre (`/nex-app/centre`) | ✅ | Data wiring | | | | Primary mobile discovery — needs real data pipeline |
| Old `/tc/trade-center/*` | | | | ✅ | Done | 6 pages deleted this session; redirects catch legacy links |
| `/tc/trade-counter/*` | | | | ✅ | Done | Deleted this session |
| Products (App #006) | ✅ | | | | | Foundational — feeds Centre + Supplier Match |
| NEX Intelligence Layer | ✅ | Wire to platform | | | | 8 engines + 1,922 brain entries; needs UI plumbing |
| Canteen (merchant storefront) | ✅ | Rename | | | | Real merchants; feeds Centre |
| Yard | | | ✅ into Community | | | Merge with newsroom cross-posts into "NEX Community" |
| Image / Hero / Site-boards | | | ✅ into NEX Inspiration | | | Unify 3 surfaces under one name |
| App Warehouse (xratedAddons) | ✅ | Rename → "NEX Tools" | | | | Registry is fine, branding is confusing |
| Calculators (18) | ✅ | | | | | Direct customer value; embed on `/nex-app/*` |
| Notebook | ✅ | | | | | Trade-facing companion to Centre |
| Quote Workspace | ✅ | Wire NEX quote engine | | | | Money loop — Phase 3 quote engine feeds it |
| Job Diary / CRM / Reviews / Orders | ✅ | | | | | Operational spine |
| AI Visualiser | ✅ | Extend beyond merchant scope | | | | Conversion driver |
| Author Studio / Live Edit | ✅ desktop | | | | | Merchant desktop editing — keep off mobile |
| Sitebook | ✅ | | | | | Mobile-friendly homeowner surface |
| Affiliates | ✅ | | | | | Background growth engine, no mobile-first work needed |
| Admin (`/admin/*`) | ✅ desktop | | | | | Owner operations — desktop-only forever |
| `/trade-off/edit/[slug]/trade-center-picks` | | | ✅ into Merchant AI Assistant | | | Phase 7 supersedes this editor |
| Beacon (3-tier lead routing) | ✅ | | | | | Real production use |
| Shadow profiles (growth) | ✅ | | | | | Growth machine, keep as-is |
| Meet the Team / Hero Swap / Business Card | ✅ | | | | | Component-level tools |
| Deals / Favourites | | | ✅ into Centre + Notebook | | | Deals appear in Centre feed; favourites are the save/heart action |
| Trade Connections | ✅ | | | | | Auto-scrolling carousel already integrated |
| Newsletter | ✅ | | | | | GDPR-compliant capture |
| Van Wrap / Before-After | ✅ | | | | | Niche but valuable creative tools |

---

## PART 5 — Proposed NEX 2.0 architecture

### NEX MOBILE APP (primary experience — `/nex-app/*`)

```
Home (opinionated feed)
├── NEX Centre — Pinterest-style discovery
│    ├── Products (from os_products_canonical + offers)
│    ├── Inspiration (merged image + hero + site-boards)
│    ├── Suppliers (merchant cards)
│    ├── Deals (product.promotion + flash cards)
│    ├── Community (yard + newsroom, merchant-gated)
│    └── AI Recommendations (from NEX intelligence layer)
├── Projects
│    ├── My Sitebook (homeowner)
│    ├── My Notebook (trade)
│    └── My Project (project workflow — Phase 5 spec)
├── Connect
│    ├── Discover (already exists at /nex-app/discover)
│    ├── Contacts (already exists at /nex-app/contacts)
│    ├── Messages (already exists at /nex-app/messages)
│    └── Supplier Matching (AI-routed via matching engine)
├── Tools (rebadged App Warehouse)
│    ├── Calculators (18 launched)
│    ├── Staircase Configurator (existing)
│    ├── AI Visualiser
│    └── Future NEX tools
└── Profile
     ├── Intent Profile (Phase 5 spec)
     ├── Saved
     ├── Reviews written
     └── Settings
```

### MERCHANT MOBILE (subset of `/nex-app/*` — merchant-gated)

```
Merchant Home
├── Merchant Assistant (Phase 7 — conversational product management)
├── My Products (from Products app)
├── My Storefront (Canteen preview)
├── Leads (Beacon + Quote requests)
├── Community (Yard as merchant only)
└── Analytics (light — desktop for depth)
```

### DESKTOP (operations layer — no rebuild)

```
Merchant Desktop
├── Author Studio (site editing)
├── Live Edit (real-time)
├── Full Products management
├── Full Analytics + Insights
├── Advanced CRM
└── Job Diary depth view

Admin Desktop
├── Red Zone (command centre)
├── Payments
├── Moderation (reviews, images)
├── Affiliates + Shadow Profiles
├── Feed Tile Library
├── Beacon Residuals
├── Brain Health (NEX)
└── Pilot Ops
```

### NEX BRAIN LAYER (cross-cutting reasoning)

```
Brain content
├── knowledge/staircase.json (1,922 entries)
├── data/staircase-*.json (8 engines)
├── data/uk-merchant-directory.json (142 records)
└── docs/brains/* (12 architecture docs)

Wired into:
├── /api/nex/staircase-chat (existing)
├── /api/nex/merchant-assistant (Phase 7 — to build)
├── /nex-app/centre feed personalisation (to wire)
└── /nex-app/staircase-configurator (existing)

Trust + confidence enforced everywhere:
├── nex-business-listing-and-trust-architecture.md
├── nex-answer-engine-confidence-model.md
└── nex-staircase-knowledge-architecture.md
```

---

## PART 6 — Data architecture review

### KEEP (foundational — do not migrate)

| Table family | Reason |
|---|---|
| `os_products_*` | Canonical product truth used by every commerce path |
| `app_products_merchant_*` | Merchant offers + collections + supplier ranges |
| `hammerex_trade_off_listings` | Merchant/business identity — referenced everywhere |
| `hammerex_canteen_products` | Merchant storefront products |
| `hammerex_network_reviews` | Verified reviews bound to signed-off jobs |
| `hammerex_nex_knowledge_entries` + 10 nex_* tables | NEX intelligence layer content |
| `os_activity_events` | Cross-cutting event log — evidence trail |
| `hammerex_trade_off_yard_posts` | Community content |
| `hero_library` + `networkers_image_submissions` | Inspiration content |
| Job diary / CRM / order tables | Operational spine |
| Affiliate + payout tables | Growth loop |

### MERGE (duplication or overlap)

| Current | Merge into | Notes |
|---|---|---|
| Hero library + Trade image submissions + Site boards | NEX Inspiration Library | Same conceptual entity; unify UX + naming |
| Yard + Newsroom cross-posts | NEX Community | Yard already ingests newsroom; formalise |
| Trade Center Picks editor + Merchant assistant | Merchant Assistant (Phase 7) | Conversational replaces form-based |
| `hammerex_feed_tile_library` + product tiles + activity events | NEX Centre feed pipeline (new server-side view) | Combine into one masonry data source |

### ARCHIVE (historical, keep read-only)

| Table / route | Reason |
|---|---|
| Any `demo_*` seed data | Keep for dev, gate behind NODE_ENV in production reads |
| `hammerex_*` tables that no active app writes to | Audit later — do not delete pre-audit |
| Legacy shadow profile drip email logs after conversion | Keep 12 months, then archive |

### REMOVE (candidates — need Philip confirmation before any deletion)

None recommended without further audit. **The rule: nothing gets deleted from `hammerex_*` or `os_*` tables until we have a full reference graph.** Deleting a table with 1 known reference can silently break 5 unknown ones.

---

## PART 7 — Technical risks

### 7.1 Duplicate systems (real)

- **Two marketplace surfaces existed** — resolved this session (`/tc/trade-center` deleted, `/nex-app/centre` is canonical)
- **Products data model exists but NEX Centre doesn't use it** — biggest current integration gap
- **Merchant editing has form-based (trade-center-picks) AND future conversational (Phase 7)** — need transition plan so merchants aren't confused during rollout
- **Two knowledge stores**: `data/staircase-*.json` (file system, this session) vs `hammerex_nex_knowledge_entries` (database). Both are "NEX brain". Reconcile before scaling.

### 7.2 Conflicting databases (potential)

- `os_products_canonical` (new, RLS-gated) vs `hammerex_canteen_products` (older merchant products). Different schemas, different consumers. Both are live. Which is canonical for the Centre feed?
- `hammerex_trade_off_listings.addons_enabled` (App Store) vs `product_categories` (calculator per PDP). Both drive which apps appear on a merchant page.

### 7.3 Old dependencies

- 322 migrations — some may be superseded by later ones (e.g. drift codify + fidelity migrations). Suggest a "schema audit" pass to identify redundant tables/columns.
- `xratedAddons.ts` still uses "Addon" internal naming despite user-facing "App" — cosmetic but confusing during onboarding.
- STUB modules (`whatsappBusiness`, `wisePayouts`, `paypalPayouts`, `vpnDetection`, `plantStripe`) — placeholders that fail gracefully. Track which are real needs vs vestigial.

### 7.4 Security concerns

- `supabaseAdmin` (service-role, bypasses RLS) is imported from 100+ files. Correct pattern for admin routes; needs audit that no customer-facing route uses it.
- Legacy magic-link tokens (`edit_token`, `sitebook-invite`, `projectTrackToken`) — HMAC-signed, but signature secrets need rotation policy.
- Merchant AI Assistant (Phase 7) opens a new attack surface for prompt injection — code-level guardrails required (already in Phase 7 plan).

### 7.5 Migration risks (if any consolidation happens)

- **Never delete `hammerex_*` tables in one shot.** Rename-and-alias-first, then delete after 2+ weeks of no reads.
- Consolidating Yard + Newsroom cross-posts requires a data-migration script that preserves post IDs (linked from other systems).
- Merging Image Library + Site Boards requires a schema harmonisation pass — different owner_key strategies.

### 7.6 Features that should NOT be carried forward

Nothing recommended for hard removal without further audit. The historical decision cost of every subsystem is high enough that "remove" is the last resort.

**Candidates for archival + review later:**
- Duplicate calculator embed sizes that no merchant chose (usage-driven decision)
- STUB payment providers that never got wired (PayPal / Wise / Square if only Stripe is in use)

---

## PART 8 — Final recommendation

### NEX 2.0 Architecture — the decisions

**What is the core mobile experience?**
`/nex-app/*` becomes the primary customer + trade + merchant surface. The Pinterest feed at `/nex-app/centre` is the front door. Home tab = feed. Other tabs = Projects · Connect · Tools · Profile. Merchants get a merchant-gated slice with the AI Assistant.

**What features create the most value?**
1. NEX Centre with real product / inspiration / community data
2. Merchant AI Assistant (Phase 7) — conversational product management
3. Supplier Matching Engine wired to real merchant offers
4. Quote Engine feeding Quote Workspace
5. AI Visualiser extended beyond merchant scope
6. NEX Inspiration Library (merged from Hero + Submissions + Site Boards)

**What should be removed?**
Right now: only the 6 pages already deleted this session. Everything else archives or merges. **Hard deletion is a Phase 8+ conversation after we've watched the consolidation land.**

**What should be rebuilt?**
Nothing rebuilt from scratch. **Data pipes rebuilt** (NEX Centre feed connects to real tables; Merchant Assistant wraps existing Products app; supplier matching reads product records). **Branding rebuilt** (Addons → Apps → NEX Tools; Canteen → Merchant Store; Yard → NEX Community).

**What should merchants use?**
- Desktop: full editing, analytics, complex operations (Author Studio · Live Edit · Full Products management · Advanced CRM · Job Diary depth)
- Mobile: Merchant Assistant · quick product actions · leads · community · light analytics

**What should customers use?**
- Mobile primary: `/nex-app/*` (browse · save · connect · project)
- Desktop secondary: same content, wider layout (auto-responsive)

**What should desktop become?**
- Admin operations (`/admin/*`)
- Merchant advanced surfaces (Author Studio · Live Edit · Full Analytics)
- Complex workflows (bulk product edit · advanced quoting · manual moderation)
- Desktop is NOT deprecated — it's specialised

---

## Highest priority decisions

Ranked by business impact:

1. **Wire NEX Centre to real data.** Replace hardcoded `SEED_ITEMS` in `NexPinterestFeed.tsx` with a real feed pipeline reading `os_products_canonical` + `app_products_merchant_offers` + `hero_library` + `hammerex_trade_off_yard_posts` + `hammerex_feed_tile_library`. **Highest leverage decision — enables everything else.**

2. **Ship Phase 7 Merchant AI Assistant.** Plan already drafted (`docs/brains/PHASE_7_IMPLEMENTATION_PLAN.md`) awaiting your 13 confirmation points. This is the merchant on-ramp for real product data flowing into NEX Centre.

3. **Reconcile the two knowledge stores.** `data/staircase-*.json` (file system) vs `hammerex_nex_knowledge_entries` (DB). Pick one authoritative store per content type. My recommendation: DB for content that changes at runtime (brain entries, merchant reviews, ratings); file system for structural engine rules that ship with the code (design rules, matching rules, quote bands).

---

## FINAL RESPONSE FORMAT

Delivered per the requested template — see the closing summary in the assistant message.

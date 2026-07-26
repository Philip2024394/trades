# NEX Master Data Flow Architecture

**Author:** Claude
**Date:** 2026-07-27
**Status:** Reference architecture — approved gate before Phase 7 Increment 1
**Companion to:** `docs/architecture/NEX_MOBILE_FIRST_SYSTEM_AUDIT.md`

---

## Purpose

The audit found NEX growing into a **Construction Operating System** with the staircase vertical as its first proof point. Multiple content sources exist (products · inspiration · community · offers · projects · reviews · knowledge · conversations). Without one canonical map, we build duplicate paths — the exact failure mode the audit was designed to prevent.

This document answers three questions for every content type:

1. **Who creates it?**
2. **Where does it live (single canonical store)?**
3. **How does it get to every place it needs to appear?**

**One NEX system. No duplicate content paths.**

---

## Core design principles

Six rules that govern every content path below:

1. **One canonical store per content type.** Reviews live in `hammerex_network_reviews`, nowhere else. Products live in `os_products_canonical` + `app_products_merchant_offers`, nowhere else. Every read/write goes through the canonical store.

2. **Event-driven propagation.** When content is created or changes, an event fires. Downstream consumers subscribe. No consumer polls the source directly.

3. **DB for changing content, files for expert rules.** Per Philip's decision:
   - **Database:** brain entries · merchant info · reviews · community posts · products · projects · conversations · offers
   - **Files:** design rules · matching algorithms · quote bands · scoring weights · country packs · country-specific terminology

4. **Trust always wins over placement.** From the Business Listing Trust doc: verified suppliers surface before paid placement.

5. **Verticals plug into the same architecture.** Staircase is Vertical #1. Flooring, kitchens, bathrooms, tools, landscaping, building supplies all reuse the same engines with vertical-specific content.

6. **Every content path has one owner.** The owner is who has write authority. Everything else is read-only reference.

---

## The 15 content types

Every piece of content in NEX resolves to one of these types. If a new feature doesn't fit, extend the taxonomy — do not duplicate an existing type.

| # | Content type | Canonical store | Primary source | Destination surfaces |
|---|---|---|---|---|
| 1 | Products (canonical) | `os_products_canonical` + `os_products_variants` | Manufacturer publish · Supplier feed ingest | Centre · Quote Workspace · AI Visualiser · Merchant profile · Search |
| 2 | Merchant offers (price + stock) | `app_products_merchant_offers` | Merchant (via AI Assistant or manual) | Centre · PDP · Quote responses |
| 3 | Merchants / suppliers (identity) | `hammerex_trade_off_listings` | Signup · merchant self-edit · admin verification | Centre supplier cards · subdomain routing · profile pages · Community access |
| 4 | Inspiration images | `hero_library` + `networkers_image_submissions` + site boards | Curated (admin) · Trade-submitted (moderation) · Homeowner saved | Centre inspiration tiles · Inspiration Library page · Site Interest Store · Matched trade cards |
| 5 | Community posts | `hammerex_trade_off_yard_posts` | Merchants (paid/builder-grade) · Admin (newsroom cross-post) | Centre community section · Community app · Merchant profile activity |
| 6 | Reviews | `hammerex_network_reviews` | Verified customers (bound to signed-off jobs) | Merchant profile · Centre trust signals · ReviewsShell |
| 7 | Deals / promotions | `app_products_merchant_offers.promotion` (JSONB) | Merchant (via AI Assistant or offer editor) | Centre flash cards · Deals app · Notifications |
| 8 | Homeowner projects | Project brief tables + beacon fanout | Homeowner via `/project` wizard | Matched trades · Admin queue · Project Tracking (Phase 5) |
| 9 | Knowledge (runtime-changeable) | `hammerex_nex_knowledge_entries` + version tables | Trade brain authors · Philip curator · User corrections | NEX chat · Configurators · Merchant AI · Design engine · Quote engine |
| 10 | Knowledge (expert rules) | Files in `data/` and `knowledge/` | Curated by engineering (Philip + Claude) | Same as #9 |
| 11 | Merchant AI conversations | `app_nex_merchant_assistant_threads` + messages (Phase 7) | Merchant chat with AI Assistant | Merchant view · Audit log · Admin oversight |
| 12 | Customer conversations (NEX chat) | Existing NEX chat history tables | Customer chat with NEX | Chat UI · Learning loop |
| 13 | Job lifecycle events | Job Diary tables + `os_activity_events` | Fires from `quote.accepted` | CRM · Reviews · Home Timeline · Notebook |
| 14 | Quote requests | `hammerex_quote_requests` | Customer (PDP form · WhatsApp CTA · Contact form · Beacon fanout) | Merchant inbox · Notebook · CRM |
| 15 | Payments + subscriptions | Payment tables + Stripe subscription state | Stripe webhooks + provider payloads | Tier enforcement · Merchant billing · Admin payments |

---

## Master architecture diagram

The whole system in one picture. Every arrow is an event or a canonical read.

```
                    ┌─────────────────────────────────────────────────┐
                    │            CONTENT CREATORS                     │
                    ├─────────────────────────────────────────────────┤
                    │ Manufacturer · Supplier · Merchant · Homeowner  │
                    │ Trade · Admin · NEX AI · System (events + cron) │
                    └─────────────────┬───────────────────────────────┘
                                      │
                                      ▼
      ┌─────────────────────────────────────────────────────────────────┐
      │                    CANONICAL STORES (DB)                        │
      ├─────────────────────────────────────────────────────────────────┤
      │                                                                 │
      │  os_products_canonical ──── os_products_variants                │
      │           │                                                     │
      │           └──── app_products_merchant_offers ──── promotions    │
      │                                                                 │
      │  hammerex_trade_off_listings (merchants)                        │
      │  hammerex_canteen_products (merchant storefront items)          │
      │  hammerex_network_reviews                                       │
      │  hammerex_trade_off_yard_posts (community)                      │
      │  hero_library + networkers_image_submissions + site_boards      │
      │  hammerex_nex_knowledge_entries + versions (runtime brain)      │
      │  hammerex_quote_requests                                        │
      │  Project + beacon tables                                        │
      │  Job Diary + CRM + Orders tables                                │
      │  app_nex_merchant_assistant_threads (Phase 7 - new)             │
      │  os_activity_events (cross-cutting event log)                   │
      │                                                                 │
      └─────────────────┬───────────────────────────────────────────────┘
                        │
                        ▼
      ┌─────────────────────────────────────────────────────────────────┐
      │                CANONICAL STORES (FILES)                         │
      ├─────────────────────────────────────────────────────────────────┤
      │                                                                 │
      │  data/staircase-diagnosis-engine.json (100 problems)            │
      │  data/staircase-design-recommendation-rules.json (10 styles)    │
      │  data/staircase-quote-engine.json (bands + rates)               │
      │  data/staircase-supplier-matching-rules.json (routing)          │
      │  data/staircase-defect-responsibility-matrix.json               │
      │  data/staircase-project-workflow.json                           │
      │  data/staircase-customer-intent-profile.json                    │
      │  data/staircase-country-packs/{uk,usa,australia}.json           │
      │  data/uk-merchant-directory.json (142 records)                  │
      │  knowledge/staircase.json (1,922 FAQ entries)                   │
      │  docs/brains/* (12 architecture + spec docs)                    │
      │                                                                 │
      └─────────────────┬───────────────────────────────────────────────┘
                        │
                        ▼
      ┌─────────────────────────────────────────────────────────────────┐
      │                      EVENT BUS                                  │
      ├─────────────────────────────────────────────────────────────────┤
      │                                                                 │
      │  product.published · .updated · .withdrawn · .price_changed     │
      │  product.stock_low · deal.created · deal.expiring               │
      │  listing.created · .updated · .verified · .tier_changed         │
      │  review.requested · .published · .responded                     │
      │  yard.post_published · community.reaction_added                 │
      │  inspiration.published · inspiration.saved                      │
      │  project.submitted · .claimed · .completed                      │
      │  quote.requested · .responded · .accepted                       │
      │  job.opened · .checked_in · .photo_added · .signed_off          │
      │  warranty.registered                                            │
      │  knowledge.published · .corrected · .version_created            │
      │  assistant.tool_called · assistant.draft_created (Phase 7)      │
      │  centre.item_ranked · centre.item_saved                         │
      │                                                                 │
      └─────────────────┬───────────────────────────────────────────────┘
                        │
                        ▼
      ┌─────────────────────────────────────────────────────────────────┐
      │                 CONSUMPTION SURFACES                            │
      ├─────────────────────────────────────────────────────────────────┤
      │                                                                 │
      │  ┌───────────────────────────────────────────────────────────┐  │
      │  │   /nex-app/centre — THE HEART (Pinterest feed)            │  │
      │  │   Reads: products · offers · deals · inspiration ·        │  │
      │  │          community · merchants · reviews · knowledge      │  │
      │  └───────────────────────────────────────────────────────────┘  │
      │                                                                 │
      │  Customer surfaces:                                             │
      │    /nex-app/discover · /messages · /brains · /contacts         │
      │    /project · /sitebook · /site-board · /inspiration/[id]      │
      │    Search · Configurators · AI Visualiser · Quote flows        │
      │                                                                 │
      │  Merchant surfaces:                                             │
      │    Merchant AI Assistant (Phase 7) · Dashboard · Author Studio │
      │    Live Edit · Notebook · CRM · Reviews · Job Diary            │
      │                                                                 │
      │  Trade surfaces:                                                │
      │    /trade/[slug] public profile · Notebook · Community · Yard  │
      │                                                                 │
      │  Admin surfaces:                                                │
      │    /admin/* — 60+ operations pages                              │
      │                                                                 │
      └─────────────────────────────────────────────────────────────────┘
```

---

## Per-content-type data flows

### Flow 1 — Products (the heart of the marketplace)

```
Creator                Store                          Event                    Consumers
─────────────────────────────────────────────────────────────────────────────────────────

Manufacturer      →   os_products_canonical      →  product.published      →   NEX Centre feed
publishes                                            product.updated           Quote Workspace
                                                                               AI Visualiser
Supplier feed     →   os_products_variants                                     Merchant profile
ingests                                                                        Search index
                                                                               Supplier Matching
Merchant AI       →   app_products_merchant_      →  price_changed          →  Centre price cards
Assistant             offers (price + stock)         stock_low                 Notebook alerts
(Phase 7)                                            (draft state until        Quote Workspace
                                                     merchant approves)
Merchant manual   →   Same as above
```

**Rule:** Every product surface in the app reads from `os_products_canonical` + `app_products_merchant_offers`. No feature caches its own product list. The Centre feed is a query, not a copy.

---

### Flow 2 — Merchant identity + trust

```
Creator          →   Store                                Event                    Consumers
──────────────────────────────────────────────────────────────────────────────────────────────

Signup wizard    →   hammerex_trade_off_listings    →   listing.created       →   NEX Centre supplier cards
                                                                                  Subdomain routing
Admin verify     →   verification_level field       →   listing.verified          Profile pages
                     (per Trust Architecture doc)                                 Community access rule
                                                                                  Search ranking boost
Merchant self-  →   Same table                     →   listing.updated
edit                                                                              Supplier Matching (Phase 4)
                                                                                  Merchant AI eligibility
Stripe webhook  →   tier + billing fields          →   listing.tier_changed
                                                                                  App Store entitlement gates
                                                                                  Feature enablement
```

**Rule:** `hammerex_trade_off_listings` is the ONE identity for a business. Every reference (products, reviews, yard posts, subscriptions) FKs to this record.

---

### Flow 3 — NEX Inspiration Library (merged from 3 sources)

```
Creator             →   Canonical Store                   Event                    Consumers
──────────────────────────────────────────────────────────────────────────────────────────────

Admin curates    →   hero_library                    →   inspiration.published →   Centre inspiration tiles
                                                                                   Inspiration Library page

Trade submits    →   networkers_image_submissions    →   image.submitted       →   Admin moderation queue
                     (quality gate + moderation)                                   Then → inspiration.published

Homeowner saves  →   site_boards (cookie owner_key)  →   inspiration.saved     →   My Inspiration board
                                                                                   Matched trade cards
                                                                                   Site Interest Store
```

**Unification:** rename umbrella surface to **NEX Inspiration Library**. Merge the 3 read paths into `inspirationDetail.server.ts` (already exists — extend). Site Board becomes "My NEX Inspiration Board" on the same underlying table.

---

### Flow 4 — NEX Community (merged from Yard + Newsroom)

```
Creator             →   Canonical Store                       Event                    Consumers
──────────────────────────────────────────────────────────────────────────────────────────────────

Merchant post    →   hammerex_trade_off_yard_posts       →   community.post_published→ Centre community tiles
(paid tier or        (reactions + moods included)                                       Community app view
builder-grade)                                                                          Merchant profile activity

Admin newsroom   →   News table                          →   news.published        →   Yard cross-poster fires
publish                                                                                 (writes yard post row)
                                                                                        → community.post_published
                                                                                        Centre community tiles
```

**Unification:** the newsroom cross-poster (`newsCrossPost.ts`) already writes into yard posts. Rename user-facing surface to **NEX Community**. Access rules unchanged (paid + builder-grade).

---

### Flow 5 — Reviews (verified transactions only)

```
Creator             →   Canonical Store                Event                    Consumers
──────────────────────────────────────────────────────────────────────────────────────────

System           →   review.requested fires         →   review.requested      →   Email to customer
(from job.                                                                        (review link)
signed_off)

Customer          →   hammerex_network_reviews      →   review.landed         →   Admin moderation
submits             (24h publish delay)                                           (24h window)
                                                                                  goes_live_at → review.published
                                                                                  → Merchant profile
                                                                                  → Centre trust signals
                                                                                  → ReviewsShell

Merchant          →   Same table                     →  review.responded      →   Response public on profile
responds
```

**Rule:** ONLY the `review.requested` → `review.landed` path creates reviews. No merchant self-post. No drive-by reviews. Verified-transaction bind is enforced by the trigger, not by policy. This is what the Business Listing Trust doc means by "reviews must be from verified transactions".

---

### Flow 6 — Merchant AI Assistant (Phase 7 — the productivity accelerator)

```
Creator                Store                                Event                    Consumers
───────────────────────────────────────────────────────────────────────────────────────────────

Merchant chat    →   app_nex_merchant_assistant_      →   assistant.thread_       →   Merchant chat view
                     threads + messages                    started
                     (new tables per Phase 7 plan)

AI proposes      →   os_products_canonical (draft     →   assistant.draft_        →   Merchant preview
create_product_      state) + merchant offer draft        created                    (in chat UI)
draft tool           (via existing Products lib)          + audit log entry

Merchant         →   lifecycleStatus: draft → active  →   product.published       →   NEX Centre feed
approves                                                                             (auto-appears)
                                                                                     Search index refresh
                                                                                     Supplier Matching pool
                                                                                     Quote Workspace availability

AI generates     →   app_nex_merchant_assistant_      →   banner.generated        →   Merchant preview
banner tool          banners (versioned)                                             Auto-marketing refresh
                                                                                     (opt-in cron)

Auto-marketing   →   New banner rows (is_active:      →   banner.refresh_ready    →   Merchant notification
cron                 false, awaiting approval)                                       (review + activate)
```

**The Phase 7 wire is what turns NEX from information into infrastructure.** Merchant chats → real products in Centre → customer discovers → quote → project → job → review. The whole loop closes.

---

### Flow 7 — Homeowner projects + quote requests

```
Creator               Store                              Event                      Consumers
────────────────────────────────────────────────────────────────────────────────────────────────

Homeowner        →   Project brief tables            →   project.submitted      →   Beacon fanout engine
via /project                                                                        (3-tier lead routing)
wizard                                                                              → matched trades notified

Homeowner        →   hammerex_quote_requests         →   quote.requested        →   Merchant inbox
via PDP/                                                                            Notebook activity
WhatsApp CTA                                                                        CRM contact record
                                                                                    Merchant AI awareness

Merchant         →   Same table (response fields)    →   quote.responded        →   Homeowner notification
responds

Homeowner        →   Same table (accepted state)     →   quote.accepted         →   Job Diary opens
accepts                                                                             job.opened event
                                                                                    Money loop begins
```

---

### Flow 8 — Knowledge (dual-store per Philip's rule)

```
Store type          Content                                Publish path                 Consumer

──────────────────  DATABASE  ──────────────────────────────────────────────────────────

Runtime changeable  Brain entries (FAQ · answers)         Trade brain authors      →  NEX chat
                    hammerex_nex_knowledge_entries        via author-studio            Configurators
                    + versions + review queue             + Philip review              Merchant AI

                    User corrections                       Customer feedback       →  Learning loop
                    /api/nex/correction                    → correction endpoint       (correction feeds
                                                          → review queue               into next version)

──────────────────  FILES  ─────────────────────────────────────────────────────────────

Expert rules that   data/staircase-design-             Engineered as JSON        →  Design engine
ship with code      recommendation-rules.json          Committed to repo             (server-side reads)
                    data/staircase-quote-engine.json                                 Configurators
                    data/staircase-supplier-matching-                                Merchant AI
                    rules.json                                                       Auto-quote paths
                    data/staircase-country-packs/*
                    data/uk-merchant-directory.json

                    docs/brains/* architecture specs   Same                       →  Reference docs
                                                                                    (not consumed at
                                                                                    runtime — human ref)

Reasoning:  DB for anything that CHANGES between deploys (brain content updated by
authors, corrections from users). FILES for rules that are part of the CODEBASE
(design logic ships with the engine, changes trigger a deploy anyway).
```

---

### Flow 9 — Job lifecycle (the operational spine)

```
Event                Store                            Downstream fires
──────────────────────────────────────────────────────────────────────────────

quote.accepted   →   Job Diary tables            →   job.opened

job.opened       →   Same                        →   Merchant Notebook entry
                                                     CRM contact created

job.checked_in   →   Same                        →   Home Timeline update

job.photo_added  →   Same                        →   Home Timeline update
                                                     Photo archived

job.signed_off   →   Same                        →   review.requested (email)
                                                     warranty.registered
                                                     Merchant metric updated

warranty.        →   Warranty tables             →   Digital Staircase Passport
registered                                           (future — Phase 15 in
                                                     Philip's original list)
```

---

## Vertical extensibility — staircase is #1, then flooring, kitchens, etc.

The staircase intelligence layer built this session is the **reference implementation** for how any vertical plugs into NEX.

Each new vertical (Flooring · Kitchens · Bathrooms · Landscaping · Building Supplies · Tools) gets:

**File-store additions:**
- `data/{vertical}-diagnosis-engine.json`
- `data/{vertical}-design-recommendation-rules.json`
- `data/{vertical}-quote-engine.json`
- `data/{vertical}-supplier-matching-rules.json`
- `data/{vertical}-country-packs/*.json`
- `knowledge/{vertical}.json`

**DB-store additions:**
- `hammerex_nex_knowledge_entries.vertical` column (already exists as `category`)
- No new tables — same schema serves every vertical

**Same engines, vertical-specific content:**
- Design recommendation engine reads `data/{vertical}-design-recommendation-rules.json`
- Quote engine reads `data/{vertical}-quote-engine.json`
- Supplier matching reads `data/{vertical}-supplier-matching-rules.json`

**Same event structure:**
- `product.published` events carry vertical tag; Centre feed filters as needed
- `knowledge.published` events carry vertical tag; NEX chat routes by user context

**Onboarding pattern for Vertical #2 (Flooring, e.g.):**
1. Author 500-1000 flooring FAQ brain entries → `hammerex_nex_knowledge_entries`
2. Ship 5-6 flooring engines as JSON → `data/flooring-*.json`
3. Populate ~50 flooring-specific merchant records → extends `uk-merchant-directory.json`
4. Wire Merchant AI Assistant to know about flooring category → tool executor extension
5. Centre feed filter adds flooring content
6. Ship — total time weeks not months once the pattern is established

---

## Permissions matrix

Who can write what. Everything not listed here is read-only for that role.

| Content type | Customer | Merchant | Manufacturer | Supplier | Admin | NEX AI |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Products canonical | | | ✅ own products | | ✅ | ✅ via Merchant Assistant tool executor (ownership re-checked) |
| Merchant offers | | ✅ own | | | ✅ | ✅ via Merchant Assistant (draft only) |
| Merchant identity | | ✅ own profile | | | ✅ | |
| Inspiration (curated) | | | | | ✅ | |
| Inspiration (submitted) | | ✅ (moderation queue) | | | ✅ approve | |
| Inspiration (saved) | ✅ own site board | | | | | |
| Community posts | | ✅ paid + builder-grade | | | ✅ newsroom | |
| Reviews | ✅ after job.signed_off only | ✅ response only | | | ✅ moderation | |
| Deals / promotions | | ✅ on own offers | | | ✅ | ✅ via Merchant Assistant (draft only) |
| Projects | ✅ own briefs | | | | | |
| Quote requests | ✅ create | ✅ respond | | | | |
| Knowledge (DB) | ✅ corrections only | | | | ✅ approve | ✅ suggest via feedback |
| Knowledge (files) | | | | | ✅ (via code commit) | |
| Merchant AI conversations | | ✅ own | | | ✅ read for audit | ✅ generate |
| Job lifecycle | | ✅ (per role) | | | ✅ | |
| Payments | | (via Stripe) | | | ✅ | |

**Hard rule (from Trust Architecture doc):** paying for a subscription tier unlocks *management rights*, never *the ability to change facts*. A merchant can update their opening hours; they cannot update Companies House registration year.

---

## Event catalog

Every published event on the NEX bus, its source, and its consumers.

### Product events

| Event | Fired by | Consumed by |
|---|---|---|
| `product.published` | Products app (new canonical or offer active) | NEX Centre feed · Search · Supplier Matching · AI Visualiser · Merchant Assistant metrics |
| `product.updated` | Products app | Same + downstream re-indexers |
| `product.withdrawn` | Products app | Centre feed removes · Search de-indexes · Notebook alerts saved-item removal |
| `product.price_changed` | Products app | Centre price cards · Notebook alerts · CRM (interest tracking) |
| `product.stock_low` | Products app | Merchant Assistant notification · Notebook alerts |
| `deal.created` | Products app (promotion set on offer) | Centre flash cards · Deals app · Notifications |
| `deal.expiring` | Cron (48h before end) | Merchant notification · Customer notification (if saved) |

### Merchant events

| Event | Fired by | Consumed by |
|---|---|---|
| `listing.created` | Signup wizard | Onboarding flow · Welcome email · Yard welcome post |
| `listing.updated` | Merchant self-edit · Admin verify | Search re-index · Centre supplier cards refresh |
| `listing.verified` | Admin verify | Trust badge display · Merchant Assistant eligibility |
| `listing.tier_changed` | Stripe webhook | App Store entitlements · Feature enablement · Merchant Assistant eligibility |

### Community + inspiration events

| Event | Fired by | Consumed by |
|---|---|---|
| `community.post_published` | Yard post save · Newsroom cross-post | Centre community tiles · Community app · Merchant profile activity |
| `community.reaction_added` | Reaction endpoint | Post reaction counter · Notebook activity for post author |
| `inspiration.published` | Admin curate · Trade submission approved | Centre inspiration tiles · Inspiration Library page · Matched trade cards |
| `inspiration.saved` | Homeowner save action | Site Board · Matched trade cards refresh |

### Review + job events

| Event | Fired by | Consumed by |
|---|---|---|
| `review.requested` | `job.signed_off` | Email to customer · Merchant notification |
| `review.landed` | Customer submits | Admin moderation queue · 24h publish timer |
| `review.published` | Publish timer expires · admin approves | Merchant profile · Centre trust signals · ReviewsShell |
| `review.responded` | Merchant responds | Public response on profile |
| `quote.requested` | Customer submits form | Merchant inbox · Notebook · CRM |
| `quote.responded` | Merchant responds | Homeowner notification |
| `quote.accepted` | Homeowner accepts | Job Diary opens |
| `job.opened` | Quote accepted | Notebook · CRM entry |
| `job.checked_in` | Merchant on site | Home Timeline update |
| `job.photo_added` | Merchant uploads | Home Timeline · photo archive |
| `job.signed_off` | Merchant completes | `review.requested` · `warranty.registered` |
| `warranty.registered` | On signoff | Warranty tables · Digital Staircase Passport (future) |

### Knowledge events

| Event | Fired by | Consumed by |
|---|---|---|
| `knowledge.published` | Author-studio publish action | NEX chat cache invalidation · Configurator refresh · Merchant Assistant context refresh |
| `knowledge.version_created` | Any DB brain update | Version history table · Audit trail |
| `knowledge.corrected` | Customer correction endpoint | Review queue for authors |

### Merchant AI events (Phase 7 — new)

| Event | Fired by | Consumed by |
|---|---|---|
| `assistant.thread_started` | Merchant opens chat | Thread table · Chat UI |
| `assistant.tool_called` | AI invokes tool | Audit log · Rate-limit counter · Admin oversight |
| `assistant.draft_created` | AI creates product draft | Merchant preview · Optional notification |
| `banner.generated` | AI generates banner | Merchant preview · Banner versions table |
| `banner.refresh_ready` | Auto-marketing cron | Merchant notification |

### System + cron events

| Event | Fired by | Consumed by |
|---|---|---|
| `project_stalled_30_days` | Cron (Phase 5 workflow) | Pause + notify customer + trade |
| `safety_critical_finding` | Assessment engine | Block proceed-to-design until acknowledged |
| `unverified_supplier_recommended` | Supplier matching | Auto-attach caveat wording |
| `centre.item_ranked` | Feed pipeline | Analytics · Personalisation feedback |
| `centre.item_saved` | Save/heart action | Site Board · Personalisation feedback |

---

## Duplicate content paths — resolved

Every path that had two writers or two readers, mapped to its single canonical.

| Duplicate | Resolution |
|---|---|
| `os_products_canonical` vs `hammerex_canteen_products` | **Canteen products remain the merchant's storefront view. Products canonical is the marketplace + supplier-fed authoritative store. Canteen products migrate into `app_products_merchant_offers` over time — but not in V1.** Both coexist during transition. Centre reads from Products canonical + merchant offers, not from Canteen. |
| Hero library + Trade submissions + Site boards | Merged into **NEX Inspiration Library**. Existing `inspirationDetail.server.ts` already unifies reads. Rename user-facing UX only. |
| Yard + Newsroom cross-post | Already unified in the DB (`newsCrossPost.ts` writes yard rows). Rename user-facing UX to **NEX Community**. |
| Trade Center Picks editor + Merchant AI Assistant | AI Assistant (Phase 7) supersedes. Picks editor kept during transition, deprecated after Assistant proven. |
| File brain vs DB brain | **DB for runtime-changeable · Files for expert rules.** Reconcile by content type, not by content. |
| Old `/tc/trade-center/*` marketplace vs `/nex-app/centre` | Old marketplace deleted this session. Middleware redirects catch legacy links. |
| Old `/tc/trade-counter/*` vs `/nex-app/centre` | Same — deleted, redirected. |

---

## What is NOT in this map (deferred to future)

- **Payment provider unification** (Stripe canonical, PayPal / Wise / Square as fallbacks) — separate architecture decision
- **Multi-currency + FX display** — country pack layer will handle when live
- **Cross-vertical search** (customer searches "oak" and gets stairs + flooring + kitchens) — needs unified search index
- **Real-time collaboration** on projects (merchant + homeowner same-time editing) — not a V1 requirement
- **Federation** with external product feeds (Amazon, Screwfix, etc.) — supplier feed ingest exists but external federation is separate work
- **Analytics + insights aggregation** across all content types — dashboard-only, not architecture

---

## The one-line summary

**Every content type has one canonical store, one write path, and event-driven propagation to every surface that needs to read it. NEX Centre reads from all of them, personalised by Customer Intent Profile, delivered as a Pinterest feed. Merchants create content through the Merchant AI Assistant (Phase 7). Verticals plug in as new content classifications on the same tables + new engine JSON files.**

---

## Sign-off gate

This document unlocks Phase 7 Increment 1 (Foundation migration + skeleton + guardrails).

**Once Philip confirms this data flow map is directionally correct, Phase 7 build proceeds** — starting with the migration + `src/lib/nex/merchant-assistant/` skeleton per the Phase 7 plan.

**If any content type / flow needs redesign,** we update this doc first, then Phase 7 plan, then start Increment 1. No silent drift.

The Phase 7 plan's 13 confirmation points still stand — sign-off on those + this data flow map = green light to code.

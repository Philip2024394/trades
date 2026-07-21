# Admin Ops Roadmap · 60-Day Engine-First Build

**Date**: 2026-07-19
**Status**: Active plan. Supersedes any prior admin roadmap draft.

## The one rule

Every module below either **increases successful matches within 90 days** or **prevents an existential platform risk**. Anything that fails both tests is deferred or killed.

## North star

`first_reply_latency_48h` — % of new SiteBook + Yard homeowner posts receiving a trade reply within 48 hours. Segmented by city × trade category. Tracked daily.

## Build principle · Vertical slices, engines first

Every phase ships one engine + one dashboard that uses it + one supporting module. Founder sees value within week 1, not week 8. No 3-week engine build with nothing visible.

---

# THE SIX ENGINES (build once · reuse everywhere)

Cross-cutting capabilities extracted from per-product implementations. Every current + future product (Trade Centre, SiteBook, Marketplace, Delivery, Rentals, Beauty, Massage, Home Services) consumes these.

### 1 · Analytics Engine
Event capture pipeline + materialised KPIs. Every product calls `.track(event, actor, target, metadata)`. Table: `hammerex_events` (append-only). Views drive Network Health, Coverage, Growth, Revenue centres.

### 2 · Marketplace Liquidity Engine  *(the core)*
Standardised marketplace lifecycle across ALL products. Every product emits the same seven event shapes:
- `demand_created` (post, order, booking, request)
- `supply_available` (trade profile, product listing, driver online, provider slot)
- `supply_contacted` (invitation sent, order placed, driver notified)
- `supply_responded` (trade replied, order acknowledged, driver accepted)
- `match_created` (trade hired, order confirmed, ride booked)
- `match_completed` (job done, order delivered, service completed)
- `revenue_generated` (invoice paid, order paid, subscription active)

Product-specific event slugs (`sitebook.post_created`, `marketplace.order_created`, `delivery.job_created`) map to the same lifecycle. Every dashboard becomes a view of this one engine.

### 3 · Notification Engine
Pluggable delivery: WhatsApp / email / web push / SMS / in-app. Every product calls `.notify(user, template, data, channels[])`. Provider adapters isolated behind common contract.

### 4 · Verification Engine
Prove identity + credentials for any entity. Consumed by trades (Gas Safe / NICEIC / ID), merchants (Companies House / VAT), homeowners (address ownership — future), drivers (licence — future), dating (age + ID — future). Single `hammerex_verifications` table + engine service.

### 5 · Moderation Engine
Queue + review + action for any content across any surface. `hammerex_moderation_queue` polymorphic `target_type` + `target_id`. Every product calls `.report(target)` or `.approve(target)`. Existing fragmented queues (Yard, image-submissions, tickets) migrate to it.

### 6 · Referral Engine
Attribution + reward. Consolidates mref + affiliate program + future refer-a-friend + future driver referral into one system with `program_slug` distinguishing them.

---

# THE FOUR + TWO DASHBOARDS (compose engines)

### `/warroom` · Founder War Room *(1-page brutal minimalism)*
Not another dashboard. One page. Founder lives here.

- Demand Today · Supply Today · Matches Today · Revenue Today
- Worst City · Best City
- Worst Trade Category · Best Trade Category
- Top Acquisition Channel
- Critical Alerts

10-second glance. Everything else = drill-down.

### `/admin` · Network Health Centre
60-second morning read. New homeowners today · new trades · active trades · active homeowners · jobs posted · jobs matched · jobs completed · first reply latency · reply rate · coverage gaps summary · weekly trend arrows.

### `/admin/coverage` · Coverage Map + City Launch Engine
Postcode × trade-category heatmap. Red-zone highlighting. Coverage-gap sidebar auto-generates recruitment list. Plus per-city launch status (PREPARE / RECRUIT / ACTIVATE / GROW / DOMINATE) with metrics per stage.

### `/admin/growth` · Growth Engine Centre
Referral performance · shadow-scrape claim funnel · SEO landing performance · city launch performance · acquisition funnel · activation rate · retention cohorts. Every chart answers "what should we do next?"

### `/admin/revenue` · Revenue Centre
MRR · ARR · active subs · trial · churn · reactivations · ARPU · LTV · revenue by city · revenue by trade category.

### `/admin/system` · System Health Centre
17 crons visible · database health · external-service status · error log · audit log summary.

---

# 60-DAY BUILD ORDER · Vertical Slices

Each phase = one engine + one dashboard using it + one supporting module. Founder sees working value at end of every phase.

## PHASE 0 · Safety foundation (Days 1-7)

- Days 1-3: **Audit Log** (migration + write helper + wrap one existing admin action)
- Days 4-7: **RBAC scaffold** (5 roles: admin / moderator / support / analyst / finance · guard helper · applied to one route as proof)

Milestone: platform can safely add a second admin. Every action is traceable.

## PHASE 1 · Liquidity Engine + War Room (Days 8-19)

- Days 8-12: **Analytics Engine** — events table + track helper + first materialised views
- Days 13-17: **Marketplace Liquidity Engine** — 7-event lifecycle contract + product-slug adapters (SiteBook + Yard first)
- Days 18-19: **War Room dashboard** at `/warroom`

Milestone: founder opens `/warroom`, sees demand · supply · matches · revenue for today, in 10 seconds. Growth loop is visible.

## PHASE 2 · Core user ops + Network Health (Days 20-30)

- Days 20-23: **User Management** (`/admin/users` — search, inspect, suspend, refund)
- Days 24-27: **Merchant Management** (`/admin/merchants` — CRUD + tier admin + suspend)
- Days 28-30: **Network Health Centre** at `/admin` (composes Analytics + Liquidity engines)

Milestone: any user is manageable. Morning-loop screen live.

## PHASE 3 · Notification + Growth Engine (Days 31-40)

- Days 31-34: **Notification Engine** (unifies WhatsApp + Postmark + web push contract)
- Days 35-37: **Referral Engine** (consolidates mref + affiliate)
- Days 38-40: **Growth Engine Centre** at `/admin/growth`

Milestone: growth acquisition channels visible + attributed.

## PHASE 4 · Verification + Coverage Map (Days 41-50)

- Days 41-45: **Verification Engine** + **Merchant Verification workflow** (Gas Safe / NICEIC manual v1 · API integration Q2)
- Days 46-50: **Coverage Map + City Launch Engine** at `/admin/coverage`

Milestone: founder sees exactly which trades to recruit next in which city. Verified badges live.

## PHASE 5 · Moderation + Safety Compliance (Days 51-58)

- Days 51-54: **Moderation Engine** (polymorphic queue · migrate Yard + image-submissions to it)
- Days 55-56: **SiteBook Photo Moderation** (uses Moderation Engine — 2 days not 5 because engine exists)
- Days 57-58: **GDPR Tools** (export + right-to-erasure queue)

Milestone: publicly launchable in UK regulatory environment.

## PHASE 6 · Revenue + System Health (Days 59-60 · buffer)

- Day 59: **Stripe reconciliation + Revenue Centre**
- Day 60: **Cron / system-health monitor** at `/admin/system`

If Phase 5 overran, ship Revenue Centre first (higher ROI) and defer system-health monitor to Q2.

---

# DELIBERATELY KILLED (not deferred — killed)

- Complex moderation workflows beyond engine v1
- Analytics v2 (20-KPI dashboard) — the war room + 4 centres are the KPIs
- Manufacturer verification (Verification Engine handles when manufacturers arrive)
- Advanced billing admin
- Cross-canteen moderation propagation
- Evidence Engine composer-approval queue
- Internal messaging (WhatsApp does it — Rule 6)
- Escrow (Rule 6)
- Social-network following
- Trade Center product moderation (Moderation Engine covers when reported)
- Studio abuse detection
- Beacon-specific spam controls (Moderation Engine covers)
- KYC threshold for washer top-ups (defer until volume triggers)

**~15 modules dropped.** Each fails the 5-test filter or is subsumed by an engine.

---

# PLATFORM RULES (permanent · also in trades/CLAUDE.md)

1. Build engines before modules.
2. Build reusable systems before product-specific systems.
3. Every feature must pass one of these tests:
   a) Increases successful matches
   b) Increases liquidity
   c) Increases retention
   d) Increases revenue
   e) Removes existential risk
4. If a feature fails all 5 tests → DO NOT BUILD.
5. Every dashboard must answer: "Are more homeowners getting matched with more trades faster than last week?"
6. Prefer one shared engine used by all products over multiple product-specific implementations.
7. Founder workflow must fit inside 10 minutes per day.
8. Network effects are more important than feature count.
9. Liquidity is more important than perfection.
10. Distribution beats development.

---

# FOUNDER DAILY OPERATING LOOP (after 60 days)

1. `/warroom` — 30 sec — is today better than yesterday?
2. `/admin` (Network Health) — 60 sec — is the week stronger than last week?
3. `/admin/coverage` — 60 sec — who to recruit next?
4. `/admin/growth` — 60 sec — which channel is winning?
5. `/admin/revenue` — 30 sec — is MRR growing?
6. `/admin/moderation` + `/admin/support/tickets` — 5 min — clear queues.

Total: ~10 min/day. Rest of the day = distribution.

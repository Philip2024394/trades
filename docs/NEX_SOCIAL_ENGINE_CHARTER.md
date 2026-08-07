# NEX Social Engine · Charter v0.1

**Status:** doctrine locked · **NOT authorised for build**
**Author of record:** Philip
**Date:** 2026-08-08
**Sits alongside:** `docs/COMMUNICATIONS_CENTRE_ARCHITECTURE_v1.0.md` · `docs/JOURNEY_ENGINE_CHARTER.md`

This charter is the reference every future Social Engine contribution is measured against. It is not a roadmap — it describes what the system MUST be, what it MUST NOT be, and how it must behave. Implementation begins only after Philip's explicit greenlight AND after the Predictive observation-mode has formally concluded.

If a proposed change would violate one of the invariants below, the architecture — not just the implementation — is at risk. Reject the change until the invariant is explicitly re-negotiated in an amendment to this document.

---

## 0 · Mission (North Star)

Build a world-class Nex Social Engine that allows Nex Headquarters and Nex trade businesses to maintain a consistent social-media presence with minimal effort.

**The one-line pitch (verbatim · this is the market position, not a scheduler position):**

> *"Nex keeps my business visible while I get on with my work."*

The product is not merely a scheduler. It is a controlled content-production and publishing system. Every design decision must answer to that framing. A staircase company connects Instagram + Facebook, gives Nex projects + company information, selects one post per day, chooses Automatic — and Nex keeps the business active online. Everything else is machinery.

---

## 1 · Two operating modes

The engine must support two distinct tenants; each is a first-class citizen.

### 1.1 · Nex Headquarters

Nex controls its own brand, content library, campaigns, publishing calendar, approved imagery, educational content, product announcements, and promotional content. HQ can publish automatically according to a central content strategy.

Example weekly rhythm (illustrative, not prescriptive):

- Monday · staircase inspiration
- Tuesday · trade education
- Wednesday · completed project
- Thursday · Nex feature
- Friday · homeowner education
- Saturday · inspirational project
- Sunday · optional evergreen content

### 1.2 · Trade business

Each trade has an isolated social workspace with its own brand profile, social connections, content sources, approval settings, publishing schedule, timezone, content preferences, and analytics.

Example:

```
ABC Staircases
  Connected:  ✓ Facebook  ✓ Instagram
  Posting:    1 post/day
  Mode:       Automatic
  Content:    ✓ Projects
              ✓ Staircase education
              ✓ Company services
              ✓ Product information
              ✓ Seasonal content
```

**Never mix tenant content.** HQ must never accidentally publish a trade's content. A trade must never see another trade's private data. See §3 (Tenant Isolation) — this is an invariant.

---

## 2 · Trade customer flow (locked)

```
Trade joins Nex Premium
       ↓
Connect Facebook / Instagram (OAuth)
       ↓
Choose "Auto Social"
       ↓
Nex prepares posts
       ↓
Merchant approves OR enables automatic posting
       ↓
Nex posts according to schedule
       ↓
Nex records results
```

At launch the merchant must never encounter a "just publish everything" toggle without per-category granularity. Approval is default-ON (§18).

---

## 3 · Invariants (Social Engine · candidate numbering S-I … S-XII)

These will be ratified into `docs/COMMUNICATIONS_CENTRE_ARCHITECTURE_v1.0.md` as a numbered amendment when the build is greenlit. Until then they govern this charter alone.

**S-I · Tenant isolation.** Every asset · post · account · campaign · schedule · analytics record MUST carry a `tenant_id`. HQ and each trade are separate tenants. No cross-tenant read or write from any surface. Composite indexes MUST include `tenant_id`. RLS MUST enforce it at the database layer.

**S-II · Provider adapter isolation.** Only files under `src/lib/nex/social/adapters/*.ts` may import a social provider SDK (Meta / IG / LinkedIn / X / TikTok / future). The content engine emits `publish(post)`; the adapter handles provider-specifics. No provider-specific logic in the content engine, scheduler, or worker.

**S-III · Content grounding.** Never invent prices, guarantees, qualifications, completed projects, locations, customer claims, products, or reviews. If the data doesn't exist in the tenant's own record or in an authorised Nex source, don't claim it. No LLM output is publishable until this check passes.

**S-IV · Rights classification required.** Every content asset carries a `rights_status` (one of: `owned` · `uploaded_by_customer` · `licensed` · `nex_owned` · `approved_nex_asset` · `unknown` · `restricted`). Only assets whose status is in the *approved* subset may enter automatic publishing. `unknown` and `restricted` are hard-blocked from autopublish.

**S-V · Approval-default-ON at launch.** Autonomous publishing is opt-in per content category, never a global switch. The merchant retains a one-click pause at all times. See §18 for the three modes.

**S-VI · Publishing pipeline is one-way.** Content → Scheduled Post → Social Delivery Job → Worker → Provider Adapter → Provider. UI code never calls the adapter directly. This mirrors Comms Centre delivery discipline.

**S-VII · Idempotency required.** Every publish operation carries an idempotency key of `(tenant_id, post_id, platform, account_id)`. Workers restarting, providers timing out, webhooks duplicating, queues restarting, or networks failing MUST NOT cause a duplicate post.

**S-VIII · Multi-stage safety validation.** Before a generated post can autopublish it MUST pass Fact-checker → Rights-checker → Policy-checker → Brand-checker → Platform-validator. Automatic posting must never bypass these checks. Manual/Assisted modes may skip only checks the merchant can override; Rights and Policy are never overridable.

**S-IX · No passwords · OAuth only · tokens encrypted.** Social account connection is through the platform's official OAuth/API flow. Nex never stores passwords. Tokens are encrypted at rest and never exposed to the UI. Account status is one of: `connected` · `attention_required` · `expired` · `revoked` · `disabled`. Token expiry triggers `attention_required` and a merchant re-auth prompt.

**S-X · Analytics grounded in provider APIs.** Track published · reach · impressions · likes · comments · shares · saves · clicks · profile visits · followers · engagement rate — WHERE the provider API exposes the metric. Never invent unavailable metrics. Honest "—" for missing values (mirrors the pattern locked in the Storage Runtime doctrine).

**S-XI · Business ROI via existing Attribution.** Social activity attributed to Nex conversions MUST use `src/lib/nex/attribution/*` and `nex.conversion_events`. No parallel attribution system. Social emits canonical analytics events; Attribution credits them.

**S-XII · Social 1.x does NOT consume Predictive.** Social v1 uses fixed scheduling, merchant settings, content rules, and approved calendars. It MUST NOT read from `nex.predictions`, call the Predictive Engine, or use predicted send-time / conversion probability to make posting decisions. Cross-linking to Predictive is a later, separately-scoped negotiation that requires (a) the Predictive observation-mode to have formally concluded, (b) v0.1 to be proven against reality, and (c) explicit Philip greenlight.

---

## 4 · Initial providers · adapter shape

```
SocialProvider (interface)
├── adapters/meta.ts          (Facebook · via Meta Graph API)
├── adapters/instagram.ts     (Instagram · via Meta Graph API)
├── adapters/linkedin.ts      (LinkedIn API)
├── adapters/tiktok.ts        (TikTok API)
└── adapters/simulator.ts     (dev/test · no external calls)
```

Adapter interface must expose:

- `connect(tenant_id, oauth_result) → account`
- `refreshToken(account) → account`
- `publish(post) → { provider_post_id, url }`
- `fetchMetrics(provider_post_id) → MetricSet`
- `healthCheck() → { ok, note? }`

No provider-specific field ever leaves the adapter untranslated. Cross-provider posts use the shared `ContentIntent` object (§9).

---

## 5 · Content sources (locked)

The content engine composes from data the merchant has already given us or authorised, plus the HQ-approved library.

### 5.1 · Business sources (per-tenant)

- Business profile
- Projects (with `rights_status`)
- Products
- Services
- Reviews (only verified customer data · never fabricated)
- Offers (only if merchant supplied)
- Completed work
- FAQs
- Knowledge articles
- Approved images / videos
- Company milestones

### 5.2 · Nex HQ sources (distributable to trades if opted-in)

- Evergreen content
- Educational content
- Trade tips
- Homeowner education
- Seasonal content
- Nex announcements
- Approved campaigns

### 5.3 · User-created (trade uploads)

Image · video · project · caption · offer · announcement. Uploaded assets default to `rights_status = uploaded_by_customer`.

**Never scrape third-party imagery. Never post another merchant's content on a different merchant's account.**

---

## 6 · Content library (asset schema)

Every piece of content is a structured asset:

```
content_asset
  id              UUID
  tenant_id       UUID          -- S-I
  asset_type      enum          -- project | product | education | inspiration | faq | testimonial | seasonal | company | offer | before_after
  title           text
  description     text
  media           jsonb         -- refs to image/video assets + rights metadata
  source          enum          -- merchant_upload | merchant_profile | nex_library | trade_content_library
  tags            text[]
  trade           text
  location        text
  product_ref     UUID?
  project_ref     UUID?
  status          enum          -- draft | approved | scheduled | published | archived | rejected
  rights_status   enum          -- S-IV
  created_at      timestamptz
  updated_at      timestamptz
```

Status lifecycle is one-way toward `published` or `archived`; a `rejected` asset cannot re-enter the pipeline without an explicit merchant/admin unlock.

---

## 7 · Content generation

The content engine may produce: post concept · caption · headline · CTA · hashtags · platform adaptation · image selection · publishing recommendation.

Grounded in the tenant's actual data (S-III). If the data doesn't exist, don't claim it.

### 7.1 · ContentIntent (the internal blueprint)

Every post carries:

```
ContentIntent
  audience         enum          -- homeowners | trade | b2b | homeowners_local
  trade            text          -- staircase | doors | kitchens | ...
  topic            text          -- oak staircase | closed-string | seasonal_renovation | ...
  objective        enum          -- lead_generation | brand_awareness | education | traffic | social_proof
  source_assets    UUID[]        -- refs into content_asset table
  claims           string[]      -- factual claims requiring grounding
  cta              enum          -- request_a_quote | visit_website | dm_us | book_consultation | learn_more
  platform         enum          -- meta | instagram | linkedin | tiktok
  tone             enum          -- see §11.1
  campaign         UUID?
```

The generator's output is `ContentIntent → CandidatePost`; the safety layer (§10) validates before publish.

### 7.2 · Content types (taxonomy)

`project · educational · inspiration · product · faq · before_after · testimonial · seasonal · company · offer`

Each type has its own generation template and its own safety-check profile (e.g. `testimonial` requires verified customer data; `offer` requires an explicit merchant-supplied offer record).

---

## 8 · AI safety layer

Before a generated post is publishable:

```
Generator
   ↓
Fact-checker      (claims resolvable to tenant data)
   ↓
Rights-checker    (every media asset is publishable · S-IV)
   ↓
Policy-checker    (no forbidden claims · no unauthorised prices)
   ↓
Brand-checker    (tone/voice/hashtags/CTAs match brand profile)
   ↓
Platform-validator (character limits · aspect ratios · hashtag limits · link rules)
   ↓
Approval (per §18 mode)
```

Automatic posting must never bypass Fact / Rights / Policy. Brand and Platform failures may fall back to a Manual queue rather than block the pipeline outright — the merchant sees "Nex prepared this post but needs your review because [reason]."

---

## 9 · Brand profile

Every tenant has:

- Business name
- Description
- Trade
- Location
- Service areas
- Tone (see 9.1)
- Preferred terminology
- Logo
- Brand imagery
- Website
- Phone
- CTA defaults
- Opening hours
- Approved hashtags
- **Forbidden claims** (explicit deny list — e.g. "cheapest", "guaranteed for life", price claims the merchant hasn't authorised)

### 9.1 · Tone options

`Professional · Friendly · Premium · Traditional · Modern · Technical · Local`

Tone selection affects caption generation but never overrides Fact/Rights/Policy checks.

---

## 10 · Platform adaptation

One `ContentIntent` becomes different platform-specific `Post` objects:

- **Instagram** · visual-first · short caption · relevant hashtags
- **Facebook** · more explanatory · local-business friendly
- **LinkedIn** · professional/business angle
- **TikTok** · short video / story structure

The underlying content idea is stable; the presentation adapts. Never publish identical content blindly across every platform.

---

## 11 · Social calendar

Visual per-tenant calendar showing status per day:

```
                AUGUST
Mon Tue Wed Thu Fri Sat Sun
  3   4   5   6   7   8   9
  🟢  🟡  🟢  🔵  🟢  🟢  -
```

Post status: `Draft · Awaiting approval · Approved · Scheduled · Publishing · Published · Failed`.

---

## 12 · Publishing pipeline

```
Content
   ↓
Scheduled Post          (tenant_id · asset · schedule_at · platform · account)
   ↓
Social Delivery Job     (in nex.social_jobs · analogous to nex.delivery_jobs)
   ↓
Worker                  (SELECT FOR UPDATE SKIP LOCKED)
   ↓
Provider Adapter        (§4)
   ↓
Provider
```

This gives retry, rate limiting, recovery, idempotency, logging, and provider isolation — the same properties Comms Centre's delivery pipeline provides for email. UI code never calls the adapter directly.

---

## 13 · Idempotency (S-VII detail)

Every publish attempt records an idempotency row keyed by `(tenant_id, post_id, platform, account_id)` BEFORE the adapter call. Duplicate keys → skip. Workers restarting mid-flight, provider webhooks arriving twice, network partitions retrying — none may cause a duplicate publish.

Analogous to Comms Centre's `nex.campaign_recipients` UNIQUE + `nex.delivery_jobs.attempt_key` pattern.

---

## 14 · Failure handling

```
attempt 1  →  retry
attempt 2  →  backoff
attempt 3  →  failed
```

On terminal failure the tenant sees a specific message:

> *"Instagram publishing failed. Reconnect your account."*

Never *"Something went wrong."* Never a stack trace.

Account is flipped to `attention_required` (S-IX). Autopublish for that account pauses until the merchant re-authenticates.

---

## 15 · Approval modes (S-V detail)

Three modes per tenant · per content category:

- **Manual.** Every post requires merchant approval.
- **Assisted.** Nex prepares posts and recommends publishing; merchant one-tap approves.
- **Automatic.** Approved content categories publish automatically per schedule.

**Automatic is opt-in per category, never global.** The merchant may pause automatic publishing immediately from any surface (mobile · dashboard · email footer link).

---

## 16 · Entitlements (subscription controls · not architecture)

Plan limits govern posting allowance:

- Free · 0-3 posts/month
- Premium · 1 post/day
- Professional · multiple scheduled posts/day

Do NOT hard-code pricing into the architecture. Plan entitlements are a separate table (`nex.social_entitlements`) referenced by the scheduler at slot-allocation time. Pricing changes must not require a code deploy.

---

## 17 · HQ content distribution (network effect)

Nex HQ publishes something like *"5 things homeowners should know before replacing a staircase"* and can make it available (opt-in per tenant) to:

- Staircase companies
- Joinery companies
- Builders
- Architects
- Kitchen companies

A trade opts in per Nex content category. Nex then adapts the post to the tenant's location · trade · brand · CTA — while **clearly distinguishing Nex-owned content from merchant-owned content** in the audit trail and (optionally) in the post metadata.

---

## 18 · Localisation

A staircase company in Nottingham should not receive exactly the same post as one in London. Use `country · region · city · service_area · trade · season` to make content locally relevant. **Never fabricate local claims** — if we don't know the merchant serves a postcode, don't say we do.

---

## 19 · Content frequency engine

Do not simply say "post every day." Calculate:

`available assets · content mix · platform · frequency · campaign · season · previous posts`

Then generate the calendar. Example for a 7-post week:

- 2 project posts
- 1 education
- 1 product
- 1 FAQ
- 1 inspiration
- 1 company

Prevents the feed becoming "BUY OUR SERVICE × 7."

---

## 20 · Repetition protection

Before scheduling, detect:

`duplicate captions · same image · similar images · same topic · repeated CTA · repetitive hashtags`

If too similar → regenerate or select another asset. Similarity threshold and comparison horizon are tenant-configurable but ship with sensible defaults.

---

## 21 · Analytics (S-X detail)

Per-post metrics from the provider: `published · reach · impressions · likes · comments · shares · saves · clicks · profile visits · followers_delta · engagement_rate`.

Where the provider API doesn't expose a metric, the field is `null` and the UI renders "—". No invented metrics, ever.

---

## 22 · Business ROI (S-XI detail)

Social activity attribution:

```
Social post
   ↓
Website click (UTM · tracked link)
   ↓
Nex contact form / Planner interaction
   ↓
Quote
   ↓
Conversion
   ↓
Revenue
```

Uses existing `src/lib/nex/attribution/*` machinery. Social emits canonical `nex.analytics_events` rows with `source=social` and appropriate refs. Attribution reads them like any other touchpoint. **No parallel attribution system.**

---

## 23 · Social → NEX journey (canonical events only)

The Social Engine emits canonical events (S-XI, S-X). It does NOT create parallel analytics tables. A homeowner clicking through from Instagram → Nex landing → Planner → Lead → Journey → Quote is one canonical event stream, attributable via Attribution.

---

## 24 · HQ + trade content separation (S-I detail)

Every asset, post, account, campaign, schedule, and analytics record carries `tenant_id`. Every SQL query includes `WHERE tenant_id = $1` (or is enforced by RLS). Cross-tenant reads are impossible from the application layer. HQ has a special tenant_id but is subject to the same discipline.

---

## 25 · Admin HQ surfaces (Social Command Centre)

HQ needs a mission-control page (following the Storage / Notifications pattern) with sections for:

- Accounts (all connected accounts across all tenants · admin-only)
- HQ content library
- Content factory
- Calendar (HQ + drill-down per trade)
- Publishing queue
- Failed posts
- Templates
- Trade content distribution
- Analytics (network-wide + per-tenant)
- Permissions

Add sections to this page. Do NOT create parallel pages. (Same rule as Storage Runtime.)

---

## 26 · Trade social dashboard (merchant surface)

Keep it extremely simple:

```
TODAY

  Today's post
  [IMAGE]

  "Beautiful oak staircase..."

  ✓ Ready
  [Publish automatically]

  Next post:  Tomorrow 10:00
```

Plus a monthly summary:

```
This month
  18 posts
  12,400 reach
  63 enquiries
  £18,500 attributed pipeline
```

The merchant should not need to understand the machinery underneath.

---

## 27 · Architectural boundary vs Comms Centre kernel

Social is an **additive module**. It MUST NOT modify the frozen Communications Centre v1.0 kernel. Conceptually:

```
NEX COMMUNICATIONS CENTRE
│
├── Email
├── Journeys
├── A/B
├── Attribution
├── Predictive
│
└── SOCIAL ENGINE   ← new · additive
     ├── Content
     ├── Accounts
     ├── Calendar
     ├── Scheduler
     ├── Provider adapters
     └── Analytics bridge
```

Social consumes existing capabilities (Contacts · Attribution · Analytics event ingest) where appropriate. Social's own state lives in a new set of `nex.social_*` tables. Zero changes to any of the 7 frozen v1.0.0 interface hashes.

---

## 28 · Predictive boundary (S-XII detail)

**Explicit and current:** Predictive v0.1 is observation-only. Five gates must pass before any model change. Therefore Social v1 must use **fixed scheduling, merchant settings, content rules, approved calendars** — never predicted send-time or predicted-conversion-probability inputs.

Later, ONLY after (a) the observation-mode has formally concluded, (b) v0.1 is proven against reality, and (c) Philip explicitly greenlights the coupling — Predictive may recommend posting time / prioritisation. Even then, the Predictive Engine emits recommendations; the Social Scheduler validates and executes. Predictive never becomes an execution authority (invariant #15 still holds).

---

## 29 · Implementation phases (locked build order · not yet authorised)

### Social 1.0 · Foundation
Tenant isolation · Social accounts · OAuth · Provider adapter interface · Content assets · Posts · Calendar · Scheduling · Queue · Worker · Idempotency · Retry/recovery.

### Social 1.1 · Content Factory
Templates · AI captions · Image selection · Content types · Brand profiles · Content validation · Approval workflow.

### Social 1.2 · Automation
Daily posting · Content mix · Automatic calendar generation · Repetition protection · Pause/resume · Entitlements.

### Social 1.3 · Analytics
Provider metrics · Post performance · Account performance · Attribution integration.

### Social 1.4 · HQ Network
HQ content library · Trade content distribution · Industry-specific content · Local adaptation · Permission system.

**Do not skip ahead.** Each phase must complete + be verified before the next begins. Amendments to this charter go through the same amendment-first pattern that carried Comms Centre v1.x.

---

## 30 · Governance rules (mandatory before any implementation)

1. This charter must be committed and referenced from an amendment to `docs/COMMUNICATIONS_CENTRE_ARCHITECTURE_v1.0.md` (candidate invariant #16 · *"Social is an additive module bound by the Nex Social Engine Charter"*). The amendment must be applied BEFORE the first schema migration lands.
2. Every phase gets a phase-close doctrine memory (like the Comms Centre v1.x memories).
3. The 7 frozen v1.0.0 interface hashes must remain unchanged for every commit. Automated hash-check at CI time (planned when build begins).
4. New provider adapters land as new files under `adapters/`. Never inline provider SDK usage.
5. New tables land under `nex.social_*` namespace. Never reuse Comms Centre tables for Social data.
6. Every merchant-facing surface must pass a lightweight "would this need explanation?" check — if a merchant would need training to use it, redesign.

---

## 31 · The commercial distinction (north-star restated)

The finished product should feel like:

> *"I connected my Instagram and Facebook, gave Nex my projects and company information, selected one post a day, and Nex keeps my business active online."*

**Not:**

> *"I have another complicated marketing dashboard I need to manage."*

That distinction is what makes the Social Engine commercially valuable. Every design decision — every UI · every default · every merchant surface — must honour it.

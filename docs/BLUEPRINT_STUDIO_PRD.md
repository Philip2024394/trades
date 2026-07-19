# Blueprint Studio — Product Requirements Document

> **Xrated Trades · Construction & Trade Industry Edition**
> Version 1.0 · Author: Studio Architecture · Status: Draft-for-Build

---

## 0. Reader's guide

This PRD is grounded in three research streams whose outputs are logged in the appendix:
1. **Codebase audit** of the existing Studio (108 trades already in the taxonomy, 47 sections registered, 6-dimension scoring engine live, pack runtime shipping).
2. **UK trade-industry research** — every regulator, scheme and stat cited has a URL. Where a claim couldn't be verified, it is explicitly flagged `[unverified]`.
3. **Competitor analysis** — Webflow, Framer, Wix Studio, Squarespace, Shopify, Elementor + industry SaaS (ServiceTitan, Jobber, Housecall Pro, Tradify, Powered Now) + UK trade-site vendors (BUILT, Built4Trades, Websites4Trades, DotGO, Checkatrade).

All product decisions in §1–§17 tie back to a numbered research finding. If a decision has no evidence line, it is labelled **`[design judgement]`** rather than presented as fact — per user's `feedback_no_assumptions` rule.

---

## 1. Blueprint Studio architecture

### 1.1 What a "Blueprint" is

A **Blueprint** is a full-page layout manifest tied to:
- a **trade** (one of the 108 slugs in `src/lib/tradeOff.ts`)
- one or more **outcomes** (see §3)
- a **design variant** (see §8)
- a **scoring profile** (7 dimensions — §14)

It renders through the existing `studio_layouts` table and the section registry at `src/lib/studio/sectionRegistry.ts`. **Nothing new needs to be built at the layout-storage layer** — the schema already versions drafts + published states per brand/page.

### 1.2 Manifest-first

Every Blueprint lives on disk at `src/lib/studio/blueprints/<slug>/manifest.ts`, matching the existing Pack manifest pattern (`src/packs/essentials-pack/manifest.ts`). The manifest exports:

```ts
export const blueprint: BlueprintManifest = {
  id: "roofing-emergency-callout",
  name: "Roofing Emergency Callout",
  version: "1.0.0",
  trades: ["roofer", "roofing-contractor", "flat-roofing"],
  outcomes: ["emergency-callout", "phone-calls"],
  variant: "emergency",
  layout: {
    home: [...sectionSeeds],
    services: [...],
    coverage: [...],
    contact: [...]
  },
  score: {
    conversion: 92,
    seo: 84,
    trust: 88,
    mobile: 96,
    accessibility: 95,
    speed: 91
  },
  requiredWidgets: ["sticky-call-bar", "coverage-radius-gate"],
  suggestedApps: ["online-payments", "lead-alerts"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard"]
};
```

The Studio **runtime never references a Blueprint slug** — the Blueprint Registry loads manifests exactly the way `sectionRegistry` loads sections (barrel import in `src/lib/studio/blueprints/index.ts`). This preserves the `feedback_platform_apps_manifest_first` rule.

### 1.3 Content-preserving swap

When a merchant swaps Blueprints, the Content-Preserving Swap engine (already used for section swaps) keeps:
- H1s
- Phone numbers
- WhatsApp numbers
- Certification badges + numbers
- Images tagged with a semantic role
- Coverage areas
- Testimonials

Only styling, section ordering and structural role rebind. This is the **defining reason** merchants can safely re-blueprint without losing their work — Webflow, Framer, Wix Studio all force a rebuild when the user picks a new template.

### 1.4 Data model

Additions to Supabase:

```sql
-- Blueprint installs (mirrors installed_packs)
create table if not exists studio_blueprint_installs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references studio_brands(id) on delete cascade,
  blueprint_id text not null,
  installed_at timestamptz not null default now(),
  uninstalled_at timestamptz,
  design_variant text not null default 'default',
  outcome_weights jsonb not null default '{}'::jsonb
);

-- Merchant outcome preferences (used by AI recommender + score reranker)
create table if not exists studio_brand_outcomes (
  brand_id uuid primary key references studio_brands(id) on delete cascade,
  primary_outcome text not null,
  secondary_outcomes text[] not null default array[]::text[],
  answered_wizard_at timestamptz not null default now()
);

-- Verified compliance widgets — one row per certification held
create table if not exists studio_brand_credentials (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references studio_brands(id) on delete cascade,
  scheme text not null,        -- 'gas-safe' | 'niceic' | 'napit' | 'trustmark' | 'fmb' | 'mcs' | 'fensa' | 'hetas' | 'oftec' | 'chas' | 'safecontractor' | 'ipaf' | 'pasma' | 'waste-carrier' | 'companies-house' | 'vat'
  number text not null,
  verified_at timestamptz,
  expires_at timestamptz,
  status text not null default 'unverified',  -- 'verified' | 'expired' | 'suspended' | 'unverified'
  last_check_at timestamptz,
  raw_response jsonb
);
```

### 1.5 Runtime surfaces

Three new routes:

- `/studio/blueprints` — browser (§5–§6)
- `/studio/blueprints/wizard` — AI onboarding (§8)
- `/studio/blueprints/[id]/preview` — full-page preview across mobile/tablet/desktop

All three sit under the existing `(app)` route group and honour the current session auth.

---

## 2. Industry taxonomy

We already ship 108 trade slugs across five template sections (`service`, `installation`, `manufacture`, `sales`, `hire`). This PRD does **not** add new slugs — it groups them into **Blueprint Families** so the browser stays browsable at scale.

### 2.1 Blueprint Families

| Family | Trade slugs (existing) | Blueprint count v1 |
|---|---|---|
| Builders & Contractors | `builder`, `house-builder`, `commercial-builder`, `renovation-specialist`, `extension-builder`, `new-build-contractor`, `property-developer` | 7 |
| Groundworks & Civils | `groundworker`, `excavator`, `civil-engineer`, `drainage-contractor`, `foundation-specialist`, `earthworks` | 4 |
| Plant & Machinery | `plant-hire`, `excavator-hire`, `dumper-hire`, `telehandler-hire`, `crane-hire`, `access-platform-hire`, `heavy-machinery`, `machinery-parts` | 6 |
| Roofing | `roofer`, `flat-roofing`, `commercial-roofing`, `roof-repairs`, `emergency-roofing` | 5 |
| Landscaping & Outdoors | `landscaper`, `garden-designer`, `artificial-grass-installer`, `driveway-specialist`, `paving-specialist`, `fencing-contractor`, `tree-surgeon` | 6 |
| Building Services (M&E) | `electrician`, `plumber`, `heating-engineer`, `hvac-engineer`, `fire-protection`, `security-installer`, `solar-installer`, `heat-pump-installer` | 8 |
| Merchants | `building-merchant`, `builders-supplies`, `timber-merchant`, `tool-merchant`, `fixings-supplier`, `aggregate-supplier`, `concrete-supplier`, `roofing-supplier`, `plumbing-merchant`, `electrical-wholesaler` | 10 |
| Construction Products | `kitchen-fitter`, `bathroom-fitter`, `window-fitter`, `door-fitter`, `stair-fitter`, `flooring-fitter`, `cladding-installer`, `insulation-installer` | 8 |
| Engineering & Fabrication | `structural-engineer`, `steel-fabricator`, `welder`, `precision-engineer`, `manufacturer` | 5 |
| Trade Support | `workwear-supplier`, `ppe-supplier`, `safety-equipment`, `welfare-unit-hire`, `mobile-canteen`, `trade-insurance`, `training-provider`, `certification-provider` | 8 |
| Construction Vehicles | `recovery-service`, `fleet-services`, `commercial-vehicle-sales`, `commercial-vehicle-hire`, `truck-parts`, `trailer-services` | 6 |

**Total v1 Blueprint families = 11. Total unique trade Blueprints = 73.** Each Blueprint ships in 5 design variants (§8) → **365 permutations** at launch without any AI generation.

### 2.2 Trade lookup speed

The 108-trade taxonomy is already loaded at module boundary in `src/lib/tradeOff.ts`. The browser will use the existing `SECTIONS_BY_TRADE` map in `src/lib/tradeTemplateSections.ts` for the "which sections make sense for this trade" filter — no new lookup needed.

---

## 3. Outcome-first system

**Users don't choose templates. Users choose outcomes.** This is the platform's positioning wedge — Wix / Squarespace / Webflow all sell "look" first. We sell "result" first.

### 3.1 Outcome catalogue

12 outcomes, mapped to Blueprint families:

| Outcome slug | Label | Primary CTA type | Best-fit families |
|---|---|---|---|
| `quote-requests` | Generate more quote requests | Form | Builders, Roofing, Landscaping, Products, Merchants |
| `phone-calls` | Generate phone calls | Click-to-call | Emergency, M&E, Recovery |
| `whatsapp-enquiries` | Generate WhatsApp enquiries | WA deep-link | Merchants, Products, Landscaping |
| `emergency-callout` | Emergency callout | 24/7 sticky bar | Roofing, Plumbing, Electrical, Recovery |
| `product-sales` | Sell products | Add-to-cart | Merchants, Trade Support, Vehicles |
| `service-sales` | Sell services | Book-now | Fitters, Landscaping |
| `project-showcase` | Showcase projects | Portfolio → contact | Developers, Fit-out, Fabrication |
| `staff-recruitment` | Recruit trades | Apply-now | Contractors, Merchants |
| `local-coverage` | Promote coverage area | Postcode-radius | All service trades |
| `trade-account` | Trade account applications | Application form | Merchants |
| `equipment-hire` | Equipment hire bookings | Booking + calendar | Plant hire, Access, Welfare |
| `training-signups` | Course bookings | Schedule + payment | Training providers |

**Every outcome ties to the existing scoring dimensions** (`src/lib/studio/scoring/heuristics.ts`) — the scorer reweights the six existing dimensions based on the chosen outcomes. **No new scoring code required** in v1, only a reweighting matrix.

### 3.2 Outcome matrix (excerpt)

`src/lib/studio/blueprints/outcomeWeights.ts`:

```ts
export const OUTCOME_WEIGHTS: Record<OutcomeSlug, ScoreDimensionWeights> = {
  "emergency-callout": {
    mobile: 1.6,      // phone-in-pocket users
    loading: 1.4,     // sub-1s LCP required
    accessibility: 1.2,
    sales: 1.5,
    trust: 1.3,       // NEW dimension — see §14
    seo: 1.0,
    brandConsistency: 0.8
  },
  "trade-account": {
    trust: 1.7,
    sales: 1.5,
    accessibility: 1.2,
    mobile: 1.0,
    loading: 1.0,
    seo: 1.0,
    brandConsistency: 1.4
  },
  // ... one per outcome
};
```

---

## 4. Mobile-first UX

### 4.1 Why mobile-first wins for trades

Documented context (see appendix for URLs):
- Google mobile search share in UK is ~98% (Statista, Jan 2024) — every quote-intent search starts here.
- BrightLocal: 57% of all local searches are mobile/tablet.
- Emergency plumber response norms 30–90 min (Go Assist) — user is holding a phone, next to a leak.
- FMB 2025 H1: 60%+ of builders struggling to find skilled trades → **recruitment blueprints must also be mobile-first**, because young tradespeople apply from phones.

**`[unverified]`** — no primary UK-trade-specific mobile-share dataset located. The 98% Google and 57% BrightLocal numbers are the strongest adjacent proxies.

### 4.2 Mobile-first design rules

Every Blueprint must pass these before the Publish button unlocks (enforced by the existing `scoring/heuristics.ts` mobile dimension):

1. **Tap-target minimum 44 × 44 px** (WCAG 2.5.5 AAA + user's `feedback_typography_wcag` rule).
2. **Body text minimum 13 px** (user's `feedback_streetlocal_text_size` floor).
3. **Sticky mobile CTA** at scroll-past-hero, never inside the first 400 px.
4. **Above-the-fold** carries: brand, primary outcome CTA, trust signal (verified badge), phone/WA.
5. **Portrait video only** for hero video (avoid landscape-crop on phones).
6. **No horizontal scroll** below `375 px` viewport.
7. **PWA-installable** by default (manifest + service worker).
8. **`prefers-reduced-motion` respected** — motion runtime already handles this.

### 4.3 Site-Foreman Mode

New viewport mode (toggle in Studio header): high-contrast dark palette for outdoor sunlight readability. Blueprints inherit an alt-token set from `designPresets.ts` when this mode is enabled. **`[design judgement]`** — inspired by high-vis workwear contrast, no cited study.

### 4.4 Van-Screen Preview

Portrait phone rendered inside a landscape van-cradle simulator (phone on dashboard). Reveals CTA glare and small-text problems. **`[design judgement]`** — no competitor ships this.

---

## 5. Blueprint browser UI

### 5.1 Layout

Two-pane, mobile-collapses to single pane:
- **Left rail (240 px desktop / drawer mobile)**: filters
- **Main grid**: Blueprint cards (see §6)
- **Right slide-over**: full-page preview when a card is opened

### 5.2 Filters

```
FILTER RAIL
├── Family (11 options + "All")
├── Outcome (12 options + "All")
├── Business Size
│    ├── Sole trader
│    ├── Small firm (2–10)
│    ├── Established (11–50)
│    └── Enterprise
├── Coverage
│    ├── Local
│    ├── Regional
│    └── National
├── Design Variant
│    ├── Corporate
│    ├── Industrial
│    ├── Tradesman
│    ├── Premium
│    ├── Emergency
│    └── Minimal
├── Verified Widgets Included
│    ├── Gas Safe
│    ├── NICEIC
│    ├── FMB
│    ├── MCS
│    └── TrustMark
└── Compliance
     ├── ASA-safe copy
     ├── Consumer Contracts pre-contract info
     └── GDPR form auditor
```

### 5.3 Sort

- Best match (weighted by user's outcome answers)
- Highest conversion score
- Highest trust score
- Newest
- Most installed by peers in your family (**`[design judgement]`** — needs analytics feed once >100 brands installed)

### 5.4 Search

Free-text ranked by title + trade slug + outcome slug + widget list. Powered by the existing Section Library search index pattern.

---

## 6. Blueprint card design

Each card carries **only what a merchant needs to decide** — nothing decorative:

```
┌────────────────────────────────────────────┐
│  [ MOBILE PREVIEW · 375 × 667 ]            │
│                                            │
│  Roofing Emergency Callout                 │
│  Roofing · Emergency-Callout · Industrial  │
│                                            │
│  ● Verified widgets                        │
│    · Gas Safe (n/a) · Waste Carrier · CHAS │
│                                            │
│  ● Scores                                  │
│    Conv 92  SEO 84  Trust 88  Mob 96       │
│                                            │
│  ● Sections (11)                           │
│    Hero · Sticky call · 3-step promise ·   │
│    Coverage · Reviews · Emergency form …   │
│                                            │
│  ● Estimated build time                    │
│    12 min                                  │
│                                            │
│  [ Preview ]              [ Use Blueprint ]│
└────────────────────────────────────────────┘
```

### 6.1 Card interaction

- **Hover / focus (desktop)**: switches preview to tablet then desktop viewport in a 2-second loop.
- **Tap (mobile)**: opens slide-over full preview at true 375 px width.
- **Long-press (mobile)**: quick-add to favourites shelf.
- **"Use Blueprint"**: enters Content-Preserving Swap flow (§1.3), never destructive.

### 6.2 Card badges

- **`Verified widgets`**: shown only when the merchant's `studio_brand_credentials` intersects the Blueprint's `requiredWidgets` — otherwise the badge is grey with "Set up your Gas Safe number to unlock" tooltip.
- **`Included in Merchant Pro`** / **`Free for your trade`** / **`Upgrade to unlock`** — matches user's `feedback_studio_add_library_upgrade_path` rule (never disable, always upsell).
- **`Compliance ✓`**: ASA + Consumer Contracts + GDPR baked in.

---

## 7. Blueprint recommendation engine

### 7.1 Signals

1. **Merchant's `hammerex_trade_off_listings.trade_slug`** — deterministic filter.
2. **Wizard answers** (§8) — primary + secondary outcomes.
3. **`studio_brand_credentials` set** — Blueprints requiring verified widgets they hold rank higher.
4. **Merchant's existing sections in `studio_layouts`** — content-similarity signal for swap-friendliness.
5. **Peer install data** — same family + same postcode-area installed X most.

### 7.2 Ranking function (v1)

```
rank = 0.30 * outcomeMatch          // exact outcome overlap
     + 0.20 * tradeMatch            // trade slug match
     + 0.20 * credentialCoverage    // % of required widgets satisfied
     + 0.15 * scoreVsMerchantWeights // predicted score post-install
     + 0.10 * peerPopularity        // capped to prevent monoculture
     + 0.05 * recency               // newer blueprints get small boost
```

All weights read from `src/lib/studio/blueprints/rankWeights.ts` — swappable without deploy.

### 7.3 Cold-start (no wizard answers)

Default to `["quote-requests", "local-coverage"]` for service trades and `["product-sales", "trade-account"]` for merchants. **`[design judgement]`** based on the outcome-per-family fit matrix.

---

## 8. AI Blueprint Assistant

Two modes ship at launch — one matches Squarespace Blueprint AI's guided 5-step (the UX benchmark), the other matches Framer's free-text (the power-user path).

### 8.1 Guided mode — five steps

Reference: Squarespace Blueprint (TIME Best Inventions 2025) reports >50% of new sites now start in Blueprint (feisworld). Wix AI asks 4–5 questions. Durable asks 3 (fewest). We land at 5 to match the leader while remaining short.

```
Step 1 — Trade
  "Which trade are you in?"
  → autocomplete against 108-slug taxonomy
  → auto-detects Family

Step 2 — Outcome
  "What matters most in the next 90 days?"
  → multi-select from 12 outcomes (max 3, min 1)

Step 3 — Coverage
  "Where do you work?"
  → postcode entry + radius slider (miles) OR "national"
  → auto-populates Coverage Radius Gate widget

Step 4 — Trust
  "Which schemes are you registered with?"
  → Gas Safe / NICEIC / FMB / MCS / etc. — visible checkboxes
  → for each ticked, prompt for the number
  → live verification (§10.2)

Step 5 — Style
  "How should it feel?"
  → 6 design-variant cards (§8 preview thumbnails)
  → single-select
```

Total elapsed time target: **90 seconds** (matches Durable's <30s first preview after 3 questions, but with 2 more UX-critical questions).

### 8.2 Free-text mode

Single text box:
> "Tell me about your business and what you want the site to do."

Passes through the existing `StudioAppRecommendModal` retrieval flow (`src/components/studio/StudioAppRecommendModal.tsx`) → LLM returns:
- one Blueprint slug (top pick)
- two alternates
- pre-filled wizard answers as if the user completed §8.1

User can accept, tweak in guided mode, or re-prompt. Per `feedback_2bee_no_boundaries` — assistant answers directly, no refusals.

### 8.3 Never invent content

Follows the user's `feedback_no_assumptions` rule and the existing `StudioAppRecommendModal` pattern: the assistant only returns Blueprint IDs that exist in the registry. If none matches, it returns the closest three with a `"Nothing matches perfectly — closest picks:"` header. Never fabricates.

---

## 9. Design system integration

Every Blueprint is a **thin wrapper** over the existing design system. Nothing forks.

### 9.1 What a Design Variant swaps

The six variants (Corporate, Industrial, Tradesman, Premium, Emergency, Minimal) each map to a preset in `src/lib/studio/designPresets.ts`. Swapping a variant swaps:

- `color.*` tokens
- `font.*` tokens (family + weight ramps)
- `radius.*` tokens
- `spacing.*` tokens
- `button.*` tokens (all 102 Button Studio variants stay available)
- `shadow.*` tokens
- `motion.*` tokens (durations + easings — respect `prefers-reduced-motion`)
- `border.*` tokens
- `background.*` tokens

**Content — headings, copy, images, prices — never swaps.** `feedback_studio_appearance_vs_content` is the invariant here.

### 9.2 Smart Theme Engine

Already partly built via `presetToApiPayload()` in `designPresets.ts`. Blueprint Studio wraps this in a single button:

> `Change design →` opens a horizontal strip of the 6 variants, each showing the merchant's own homepage rendered in that variant. One tap swaps every token. Content preserved.

**No competitor ships this.** Wix, Webflow, Framer force users to swap the whole template.

### 9.3 Token integrity

The `contentShape` invariant (see `project_platform_design_system`) is preserved: swapping a Blueprint or variant never drops a `contentShape` field. If a target section can't hold a source field, the runtime stashes it in `studio_layouts.layout_json.stash[]` and shows a "3 unused content items — restore" chip in Studio.

---

## 10. Verified compliance widgets

**This is the defensibility wedge.** Per the competitor analysis: NO existing website builder auto-verifies UK trade credentials on-site. X Tag has a Gas Safe API link (they're the exception, and only for a broader tool suite, not for site rendering).

### 10.1 Widgets shipped v1

| Widget | Scheme | Source of truth | Auto-verify? |
|---|---|---|---|
| Gas Safe badge | Gas Safe Register | gassaferegister.co.uk public search | Yes (scheduled cron) |
| NICEIC / NAPIT / STROMA badge | Part P scheme | Each scheme's public search | Yes |
| Companies House block | UK Companies House | CH free public API | Yes |
| VAT display | HMRC | HMRC VAT Number Checker | Yes |
| TrustMark badge | TrustMark UK | TrustMark license register | Yes |
| FMB "Master Builder" badge | Federation of Master Builders | FMB findabuilder | Yes |
| MCS badge | Microgeneration Certification Scheme | mcscertified.com public directory | Yes |
| HETAS / OFTEC badge | HETAS / OFTEC | Each scheme's public register | Yes |
| FENSA / CERTASS badge | FENSA / CERTASS | Each scheme's public search | Yes |
| CHAS / SafeContractor / SMAS / Constructionline | SSIP prequal | Each scheme's public verification | Yes (some paywalled) |
| IPAF / PASMA operator roster | IPAF / PASMA | Each scheme's public card check | Yes |
| Waste Carrier Licence | Environment Agency | EA public register | Yes |
| Public Liability Insurance | Merchant-uploaded PDF | Merchant upload + expiry countdown | Merchant self-declares; expiry auto-hides |

### 10.2 Verification pipeline

Cloud cron (Asia/Jakarta scheduling — matches user's existing daily FX + ImageKit routines):

```
Daily 08:00 UTC:
  1. Loop studio_brand_credentials WHERE status != 'expired'
  2. Per scheme, call the public verification endpoint / scrape (rate-limited, respect robots.txt)
  3. Update `verified_at`, `expires_at`, `status`, `raw_response`
  4. If status changes 'verified' → 'suspended' or 'expired', page the merchant via email + Studio notification
  5. Site render checks `status` at request time — expired badges are hidden and replaced with a neutral fallback (never a broken badge)
```

### 10.3 Legal / ASA safety

The **ASA superlative guard** (Feature #77) blocks or gates headlines like "the cheapest roofer in London" behind a required evidence field, because ASA rules require documentary evidence held at time of publication (asa.org.uk/advice-online/types-of-claims-best.html). This isn't a nice-to-have — it's regulator-safety baked into the product.

### 10.4 Consumer Contracts Regulations 2013

Every service Blueprint bakes in a Pre-Contract Information section covering:
- trader identity + address
- main characteristics of goods/services
- price inclusive of taxes
- payment + delivery
- 14-day cancellation right (with statutory exemptions for bespoke and urgent-repair work correctly worded)

Merchants can hide it, but the Publish flow warns.

### 10.5 GDPR form auditor

Every form section validates:
- lawful basis line is present
- marketing opt-in is separate from transactional consent
- privacy notice link is rendered
- ICO fee status flagged in Studio settings (£52/£78/yr for most SMEs)

---

## 11. Database architecture

### 11.1 New tables

Already listed in §1.4. Summary:

- `studio_blueprint_installs` — one row per (brand, blueprint) history
- `studio_brand_outcomes` — wizard answers
- `studio_brand_credentials` — verified schemes + numbers + statuses

### 11.2 Extended existing tables

- `studio_layouts` — add nullable `blueprint_id text` for provenance (helps peer analytics + support)
- `studio_brand_tokens` — no schema change, but a new `variant text` column defaults to `'default'` so we can revert to the merchant's original after a variant tryout

### 11.3 RLS

- `studio_blueprint_installs` — brand-scoped RLS matching `installed_packs`
- `studio_brand_outcomes` — brand-scoped
- `studio_brand_credentials` — brand-scoped write, public read (necessary for site render)

### 11.4 Migrations

Single migration file: `supabase/migrations/YYYYMMDDHHMMSS_blueprint_studio.sql` following the existing pattern (see `supabase/migrations/20260704140000_payment_receipt_config.sql`).

---

## 12. React component architecture

### 12.1 Component tree

```
src/components/studio/blueprints/
├── BlueprintBrowser.tsx           // main /studio/blueprints page
├── BlueprintFilterRail.tsx        // §5.2
├── BlueprintCard.tsx              // §6
├── BlueprintPreviewSlideover.tsx  // full-page preview across breakpoints
├── BlueprintWizard.tsx            // §8.1 guided mode
├── BlueprintWizardStep.tsx        // shared step chrome
├── BlueprintPromptModal.tsx       // §8.2 free-text mode
├── DesignVariantStrip.tsx         // §9.2 one-tap variant swap
├── CredentialWidget.tsx           // §10 — reusable, one per scheme
├── CredentialManager.tsx          // /studio/credentials — merchant admin
├── OutcomeChip.tsx                // outcome badge used throughout
└── ScorePanel.tsx                 // 7-dim scores with drilldown
```

### 12.2 Server-side data loaders

```
src/lib/studio/blueprints/
├── index.ts               // barrel — auto-imports all manifests
├── registry.ts            // in-memory registry
├── types.ts               // BlueprintManifest, OutcomeSlug, etc.
├── outcomeWeights.ts      // §3.2
├── rankWeights.ts         // §7.2
├── recommender.ts         // §7 ranking function
└── manifests/
    ├── quote-machine.ts
    ├── roofing-emergency.ts
    ├── builders-merchant.ts
    └── ... (73 manifests at launch)
```

### 12.3 API routes

- `GET /api/studio/blueprints` — list, filter, sort
- `GET /api/studio/blueprints/[id]` — full manifest + score
- `POST /api/studio/blueprints/[id]/install` — Content-Preserving Swap trigger
- `POST /api/studio/blueprints/wizard` — accepts wizard answers → returns ranked recommendations
- `POST /api/studio/blueprints/prompt` — free-text mode
- `GET /api/studio/credentials` — merchant's list
- `POST /api/studio/credentials` — add + verify
- `DELETE /api/studio/credentials/[id]` — remove

### 12.4 Reuse of existing components

- `PaymentReceiptSettings.tsx` pattern for `CredentialManager.tsx` (form + save + status chip)
- `StudioAppRecommendModal.tsx` retrieval flow for §8.2
- `sectionRegistry.tsx` pattern for blueprint auto-import
- `PageScorer` / `heuristics.ts` for score rendering — **no duplication**

---

## 13. Feature matrix

Cross-tabbed against competitors. Green = ships; blank = doesn't.

| Feature | Wix | Squarespace | Webflow | Framer | Shopify | Elementor | Housecall | Jobber | Tradify | BUILT | **Blueprint Studio** |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Trade-specific templates | ~ | ~ | ~ | ~ | ~ | ~ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Outcome-first browser |  |  |  |  |  |  |  |  |  |  | **✓** |
| Content-preserving swap |  |  |  |  |  |  |  |  |  |  | **✓** |
| Gas Safe auto-verify |  |  |  |  |  |  |  |  |  |  | **✓** |
| NICEIC auto-verify |  |  |  |  |  |  |  |  |  |  | **✓** |
| Companies House auto-fetch |  |  |  |  |  |  |  |  |  |  | **✓** |
| ASA superlative guard |  |  |  |  |  |  |  |  |  |  | **✓** |
| Consumer Contracts 2013 baked |  |  |  |  |  |  |  |  |  |  | **✓** |
| GDPR form auditor |  |  |  |  |  |  |  |  |  |  | **✓** |
| Coverage-radius postcode gate |  |  |  |  |  |  |  |  |  |  | **✓** |
| Material Calculator suite | limited | limited |  |  |  |  |  |  |  |  | **✓** (15 launched) |
| Trade-account PDF export |  |  |  |  |  |  |  |  |  |  | **✓** |
| Dual retail/trade pricing |  |  |  |  | limited |  |  |  |  |  | **✓** |
| AI onboarding wizard | ✓ (4-5 Qs) | ✓ (5 steps) |  | ✓ text | ✓ | limited |  |  |  |  | **✓ (5 Qs + text)** |
| One-tap design variant swap |  | partial |  |  |  |  |  |  |  |  | **✓** |
| Live blueprint scoring | limited | limited | limited |  |  |  |  |  |  |  | **✓ (7-dim)** |
| WhatsApp prefill deep-links | limited |  |  |  |  |  |  |  |  |  | **✓** |
| Site-Foreman dark mode |  |  |  |  |  |  |  |  |  |  | **✓** |
| Van-Screen preview |  |  |  |  |  |  |  |  |  |  | **✓** |
| Compliance copy library |  |  |  |  |  |  |  |  |  |  | **✓** |

`~` = trade-adjacent templates exist but not verified as trade-specific.

---

## 14. Accessibility requirements

WCAG 2.1 AA is the floor (user's `feedback_typography_wcag`). Blueprint Studio adds a **Trust dimension** (7th) to the existing 6-dim scorer.

### 14.1 Score dimensions

| Dimension | What it measures | Fail threshold |
|---|---|---|
| Loading | Estimated LCP + CLS | LCP > 2.5s |
| Accessibility | WCAG contrast + tap-target + landmarks | Any AA failure |
| Sales | CTA presence, form completeness, above-fold value | Missing primary CTA |
| SEO | Metadata, H1 count, schema.org markup | No H1 |
| Mobile | 375 px viewport integrity + sticky-CTA presence | Horizontal scroll |
| Brand Consistency | Token adherence + typography ramp | ≥5 raw hex overrides |
| **Trust (NEW)** | Verified credentials + Companies House + ASA-safe copy + Consumer Contracts + GDPR | Missing trader identity |

### 14.2 Accessibility guardrails

- Contrast checker (`src/lib/studio/scoring/contrast.ts`) already ships — Blueprint Studio hooks it into the Design Variant swap so we refuse to publish a variant that fails 4.5:1.
- Motion respects `prefers-reduced-motion` via the existing motion runtime.
- Screen-reader landmarks (`main`, `nav`, `header`, `footer`) enforced by section manifests.
- Keyboard-only path through every Blueprint verified in a Playwright test suite at CI time.

---

## 15. SEO requirements

### 15.1 Baked into every Blueprint

- H1 present and unique per page
- Meta description slot bound to first section paragraph
- Open Graph image slot bound to hero
- Canonical URL enforced by the Studio runtime
- `LocalBusiness` schema.org JSON-LD auto-generated from `studio_brand_credentials` + Companies House + coverage
- `Product` schema for merchant Blueprints
- `Service` schema for service Blueprints
- Sitemap auto-emitted at `/sitemap.xml`
- Robots respects merchant "hide from search" toggle

### 15.2 Trade-specific SEO wins

- Postcode-radius pages auto-generated for each covered postcode area (URL: `/coverage/<postcode>`). This is the biggest local-SEO lever and NO competitor ships it.
- `sameAs` schema link to Companies House record (validated authority signal).
- FAQ schema auto-generated from the FAQ section.

### 15.3 Emergency-mode SEO

Emergency Callout Blueprint enforces `SpecialAnnouncement` schema during Met Office warnings so "storm response" queries surface the merchant. Storm/Weather Auto-Banner (Feature #104) toggles this.

---

## 16. Conversion optimization strategy

### 16.1 Above-the-fold requirements (mobile-first)

Per findings from Visser Analytics + Interactive Builds + trade-website vendor consensus:

1. Brand + primary trade descriptor
2. One primary CTA (call OR WhatsApp OR quote)
3. One trust proof (verified badge OR reviews rating)
4. One "you're in the right place" cue (coverage OR service)

**Nothing else may appear above the fold.** Blueprint Publish blocks if any of the four is missing.

### 16.2 Trust proximity rule

Certification strip must sit within 300 px of the primary CTA on mobile. Enforced by scorer heuristic.

### 16.3 Sticky patterns

- Sticky mobile CTA appears on scroll past hero, hides on scroll-up (returns focus to content)
- Emergency Blueprints use **sticky call-ribbon** — never disappears
- Merchant Blueprints use **sticky mini-cart** at 1+ items

### 16.4 Form design

- Multi-step forms show progress
- One question per screen on mobile
- Postcode auto-lookup via a UK-postcode API (needs contract — recommend Ideal Postcodes)
- Photo attachment on quote forms — mobile camera direct-open
- Voice-to-quote (Feature #110) — merchant reviews transcript in Studio inbox

---

## 17. Mobile conversion strategy

### 17.1 Six mobile-conversion patterns baked in

1. **Click-to-call** — `tel:` link with `data-tag="hero-call"` for analytics
2. **WhatsApp deep-link with prefilled job context** — no competitor prefills product/qty/postcode/photo
3. **Sticky CTA ribbon** — appears at 300 px scroll, hides on scroll-up
4. **Postcode gate** — visitor types postcode → sections outside coverage grey; in-coverage flows straight to booking
5. **Return-visit recognizer** — cookie-based, replaces primary CTA with "welcome back, continue your quote?" when a draft enquiry exists
6. **Offline draft save** — service worker caches enquiry in `IndexedDB` so poor-signal site visits don't lose the form

### 17.2 What we WON'T do

Per user's `feedback_cityriders_no_dispatch_ever` philosophy — this is a **directory + lead-gen product**, not a booking-dispatch product. Blueprints never auto-book, auto-dispatch, or auto-accept on the merchant's behalf. Every enquiry surfaces as an alert (matches `project_cityriders_intent_intercept`).

---

## 18. Implementation roadmap

Six-lane rollout. Foundation lands before UX. UX lands before growth features.

### Lane 1 · Foundation (Week 1–2)

- [ ] Migration: `studio_blueprint_installs`, `studio_brand_outcomes`, `studio_brand_credentials`
- [ ] `src/lib/studio/blueprints/registry.ts` + type definitions
- [ ] Barrel loader in `src/lib/studio/blueprints/index.ts`
- [ ] First 3 reference manifests (Roofing Emergency, Builders Merchant, Plant Hire) — used for smoke tests

### Lane 2 · Browser + Wizard (Week 2–4)

- [ ] `BlueprintBrowser.tsx`, `BlueprintFilterRail.tsx`, `BlueprintCard.tsx`
- [ ] `BlueprintPreviewSlideover.tsx` — mobile/tablet/desktop iframe preview
- [ ] `BlueprintWizard.tsx` (5-step guided) + `BlueprintPromptModal.tsx` (free-text)
- [ ] `/api/studio/blueprints/**` routes

### Lane 3 · Verified Widgets (Week 3–6)

- [ ] `CredentialManager.tsx` at `/studio/credentials`
- [ ] `CredentialWidget.tsx` — Gas Safe, Companies House, VAT, NICEIC, TrustMark, FMB (six first)
- [ ] Cloud cron job for daily verification
- [ ] Site-render integration — expired badges silently hide

### Lane 4 · Blueprint Library Build-out (Week 4–8, parallel with L3)

- [ ] 73 manifests, one per family × trade
- [ ] Design variant thumbnails auto-rendered at CI time from a Playwright snapshot pipeline
- [ ] Score computed at CI time and cached into the manifest

### Lane 5 · AI + Recommender (Week 6–9)

- [ ] `recommender.ts` ranking function wired to wizard + browser sort
- [ ] Free-text mode LLM prompt hardened with retrieval-only guardrails
- [ ] "Peer install" analytics feed once >100 brands installed

### Lane 6 · Growth features (Week 9–12)

- [ ] Coverage-radius postcode gate widget
- [ ] Postcode-per-page SEO generator
- [ ] Storm/Weather Auto-Banner
- [ ] Van-Screen Preview
- [ ] Site-Foreman Mode
- [ ] Trade-Account PDF export flow
- [ ] Marketplace stub (§19)

### Milestone gates

- **MVP (end Week 4)**: browser + wizard live with 6 blueprints, no verification widgets yet.
- **Beta (end Week 8)**: 73 blueprints + 6 verified widgets + coverage gate.
- **v1 launch (end Week 12)**: full 12-feature-category catalogue (§20), pricing tier flipped on.

---

## 19. Future marketplace strategy

Marketplace ships **after** merchant install rate crosses a threshold — modelled on Framer's marketplace ramp.

### 19.1 Contributor types

- **In-house Blueprints** — always free for merchants on their tier
- **Verified Studio Partners** — vetted design agencies who publish Blueprints, earn royalty
- **Merchant-forked Blueprints** — a merchant can fork their live layout, mark it a Blueprint, and publish it. Sharing model TBD (`[design judgement]`)

### 19.2 Pricing

- Free Blueprints: unlimited
- Marketplace-paid Blueprints: £19–£49 one-time OR included in Merchant Pro tier
- Industry Packs bundle Blueprints + Sections + Presets + Calculators + Compliance widgets — priced at £29–£99/mo tier

**Pricing anchoring evidence** (from competitor research):
- BUILT (UK, done-for-you): £99/mo — ceiling
- Built4Trades: £15.90/mo — floor
- Checkatrade: £60–£180/mo listing-only — proves trades pay for exposure
- Blueprint Studio price target: **£29/mo Studio + £14.99/mo Merchant Pro add-on** (existing) — sits precisely in the profit zone.

### 19.3 Royalty split

**`[design judgement]`** — modelled on Framer's 70/30 partner split. Requires legal review.

---

## 20. Feature catalogue — 100 innovations

Each entry: **`ID · Name · Category · Depends-on-research`** (RID = research finding ID from appendix). All 100 are innovation deltas over the competitor baseline; anything already in Wix/Webflow/Framer/Shopify/Elementor is NOT counted.

### A. Verified compliance widgets (14)

1. **Gas Safe live number auto-verify** — cron polls public register; site shows live status. RID: cert-research §1 (Gas Safe).
2. **NICEIC / NAPIT / STROMA badge auto-verify** — Part P scheme number verified daily. RID: cert-research §1.
3. **Companies House registered-name + number auto-fetch** — required by Companies Act 2006 trading disclosures. RID: legal-research §7.
4. **VAT number validation** — HMRC/VIES check; footer displays with active/inactive state. RID: legal-research §7 (VAT display).
5. **TrustMark badge auto-refresh** with license status. RID: cert-research §1 (TrustMark).
6. **FMB "Master Builder" auto-cross-check** — findabuilder API. RID: cert-research §1 (FMB £62.69/mo).
7. **MCS number verify (BUS-grant eligibility)** — mcscertified.com public directory. RID: cert-research §1 (MCS).
8. **HETAS + OFTEC verify** — solid-fuel and oil competent-person schemes. RID: cert-research §1.
9. **FENSA / CERTASS verify** — replacement window certificate provider. RID: cert-research §1 (FENSA).
10. **CSCS card-holder-count display** — merchant's roster with expiry rolls; scored into Trust. RID: cert-research §1 (CSCS 90%+).
11. **Public Liability Insurance upload + expiry countdown + auto-hide** — merchant PDF, badge auto-hides when lapsed. RID: cert-research §1 (£2m/£5m).
12. **IPAF + PASMA operator roster** — 5-year expiry counter with re-cert reminder. RID: cert-research §1 (IPAF PAL Card 5yr).
13. **CHAS / SafeContractor / SMAS SSIP mutual-recognition badge** — one verify serves all three. RID: cert-research §1 (SSIP mutual recognition).
14. **Waste Carrier Licence display + auto-verify** — mandatory for waste transport. RID: cert-research §1.

### B. Trade-native sections (14)

15. **Coverage Radius Postcode Gate** — visitor postcode → outside-coverage sections auto-hide. RID: gap analysis §6.
16. **Emergency Sticky Bar (24/7 mode + response-time promise)** — trades that require it. RID: emergency-research §6.
17. **Before/After Slider with EXIF geotag blur** — auto-blurs GPS. RID: legal-research §7 (GDPR).
18. **Job-Diary Feed** — auto-published from van app (existing `job_diary` add-on).
19. **Fleet Showcase** — vehicles with MOT date auto-fetched. **`[design judgement]`** — DVLA API needed.
20. **Machine Card Grid with day/week rate + delivery fee** — plant hire native card. RID: plant-hire-research §4 (day + week + weekend model).
21. **Material Comparison Grid (dual retail/trade columns)** — merchants only. RID: merchant-research §3 (10–30% trade discount).
22. **Live Available-Slot Hero** — calendar + book-in CTA above the fold.
23. **Trade Account Application block with PDF + DocuSign** — merchant B2B onboarding. RID: gap analysis §6 (nobody ships).
24. **Waste Carrier + Skip Hire load-type picker** — waste type → skip yard filter. RID: cert-research §1 (Waste Carrier mandatory).
25. **Ratecard vs Quote Hybrid** — indicative day-rate + "complex jobs: quote". RID: gap analysis §6.
26. **Sample Board** — paint chip / tile sample orders to postcode.
27. **Certificate Wall** — customer-facing gallery of live scheme statuses. RID: cert-research §1.
28. **Storm/Weather Auto-Banner** — Met Office warning in coverage area toggles emergency mode. RID: emergency-research §6.

### C. Material Calculator suite (15) — extends existing 5

29. Paint calculator (walls/ceilings, primer/finish coats)
30. Flooring calculator (with 10% waste %)
31. Tile calculator (grout gap picker)
32. Gravel calculator (depth × density)
33. Concrete calculator (mix-ratio-aware)
34. Roofing calculator (pitch × slate/tile size)
35. Skip size calculator (waste type + volume → skip yard picker)
36. Fencing calculator (panels + posts)
37. Turf calculator
38. Insulation calculator (U-value → depth)
39. Solar array calculator (roof area → panels + kWh)
40. Loft-conversion structural span-table checker
41. Extension VAT estimator (5% renovation vs 20% new build eligibility) — HMRC guidance. **Cite:** gov.uk/vat-builders/houses
42. Plant-hire day-rate calculator (self-drive + operator + weekend-included model)
43. Trade Discount Simulator (retail → 30-day account trade price)

### D. Blueprint Types (30)

44. Quote-Machine Blueprint
45. Emergency Callout Blueprint (Roofing)
46. Emergency Callout Blueprint (Plumbing)
47. Emergency Callout Blueprint (Electrical)
48. Emergency Callout Blueprint (Locksmith)
49. Product Sales Blueprint (Builders Merchant)
50. Product Sales Blueprint (Timber Merchant)
51. Product Sales Blueprint (Tool Supplier)
52. Trade Account Application Blueprint (Merchant)
53. Plant Hire Blueprint
54. Recruitment Blueprint (Contractor)
55. Recruitment Blueprint (Apprenticeship-first)
56. New-Homes Developer Blueprint (NHBC-integrated)
57. Extensions & Renovations Blueprint (FMB-verified)
58. Commercial Contractor Blueprint (CHAS/SSIP-visible)
59. Fit-Out Studio Blueprint (photography-led)
60. Aggregates Depot Blueprint
61. Concrete Supplier Blueprint (live batch times)
62. Landscape Design Studio Blueprint
63. Kitchen Showroom Blueprint (visualiser-embedded)
64. Bathroom Showroom Blueprint
65. Solar Installer Blueprint (MCS-verified + BUS grants)
66. Heat-Pump Installer Blueprint (MCS + BUS)
67. Windows & Doors Blueprint (FENSA-verified + finance calc)
68. Electrician Blueprint (NICEIC + Part P)
69. Plumber Blueprint (Gas Safe + emergency)
70. HVAC Contractor Blueprint (F-Gas)
71. Structural Engineering Blueprint (design-first)
72. Steel Fabrication Blueprint (project reels + capacity)
73. Portable Cabin / Welfare Unit Blueprint (rate calc)

### E. Studio UX innovations (12)

74. AI Onboarding Wizard — 5-question guided flow (§8.1)
75. AI Free-Text Prompt Mode (§8.2)
76. Outcome Picker — user selects outcomes, layout re-ranks
77. **ASA Copy Guard** — blocks "cheapest/best" without evidence. RID: legal-research §7.
78. **GDPR Form Auditor** — validates lawful basis + separate marketing consent. RID: legal-research §7.
79. **Consumer Contracts Regs 2013 Pre-Contract Block** — with correct bespoke/urgent-repair exemptions. RID: legal-research §7.
80. **Compliance Copy Library** — Gas Safe legal wording, Part P disclosures, CDM 2015, NICEIC-recommended language.
81. Design Variant One-Tap Swap (§9.2)
82. Live Blueprint Score Panel (7 dimensions) — includes Trust dim (§14)
83. Section Alternates Panel — semantically-equivalent swap-in
84. **Site-Foreman Mode** — high-contrast dark palette for outdoor sunlight
85. **Van-Screen Preview** — portrait phone in landscape dashboard cradle simulator

### F. B2B / Merchant features (10)

86. **Dual Retail/Trade Pricing Toggle** — verified account = trade prices. RID: gap analysis §6.
87. **Trade Account Application → PDF + DocuSign + Credit-check hook** (Experian / CreditSafe). RID: B2B research §6 (application fields).
88. Bulk Order CSV Upload — merchant customer path
89. Credit Line Display — remaining balance + next statement date
90. Delivery Slot Booker (branch stock check)
91. Multi-Branch Coverage Selector
92. Statement Downloader — last 12 months
93. Reorder-From-History — one-tap
94. Trade Card Bar-Code Login — scan physical trade card
95. Fleet Delivery Live Tracker — postcode geocode + estimated arrival

### G. Growth & Marketplace (5)

96. Blueprint Marketplace (§19)
97. Industry Pack Bundles — Plant Hire Pack, Roofing Pack, Merchant Pack, etc.
98. **Import from Checkatrade / MyBuilder profile** — auto-populates Blueprint. RID: competitor §4 (Checkatrade £60–180/mo listing).
99. QR-Poster Generator — for site signage, hoardings, van livery
100. **AI Style Transfer** — merchant uploads existing site URL → Studio best-match Blueprint. RID: gap analysis §6.

---

## 21. Instant Trade Site — the 15-second setup flow

This is the wedge users feel. Everything above enables it; this section spells it out.

### 21.1 Three-field input

One screen, three fields. Order-preserving because each field narrows the next:

```
┌────────────────────────────────────────────────────────────┐
│  Let's build your site.                                    │
│                                                            │
│  Trade         [ Carpenter          ▾ ]  (108 slugs)       │
│  Country       [ United Kingdom     ▾ ]                    │
│  Services      [+ doors] [+ kitchens] [+ flooring]         │
│                Suggested for Carpenter · UK:               │
│                [+ skirting] [+ staircases] [+ loft carp.]  │
│                                                            │
│  Postcode      [ NR1              ] (optional, boosts SEO) │
│  Phone         [ 07…              ] (optional)             │
│                                                            │
│                                    [  Build my site →  ]   │
└────────────────────────────────────────────────────────────┘
```

Suggested chips come from the Trade Service Library (Appendix D). User can accept, deselect, or add free-text.

### 21.2 What runs in the 12–15 seconds

Parallel work behind the "Build" click:

| Stream | Job | ETA |
|---|---|---|
| 1 | Look up trade slug → pull Family + section defaults | 20 ms |
| 2 | Query Trade Service Library → render Services Grid seed | 50 ms |
| 3 | Rank-order candidate Blueprints via §7 recommender | 80 ms |
| 4 | Apply chosen Blueprint via Content-Preserving Swap | 200 ms |
| 5 | Auto-select Apps for trade × service mix (Appendix D combinations map) | 100 ms |
| 6 | Auto-apply Design Variant token pack | 60 ms |
| 7 | If postcode entered — seed Coverage Radius Gate + generate `/coverage/<postcode>` SEO page stub | 300 ms |
| 8 | Load compliance blocks: Consumer Contracts pre-contract, GDPR form auditor armed, ASA copy-guard armed | 40 ms |
| 9 | Render hero image from the reference photography pool for this trade | 500 ms |
| 10 | Score across 7 dimensions, cache | 200 ms |
| 11 | Persist as `studio_layouts` draft, populate `studio_brand_outcomes` + `studio_brand_credentials` (empty rows to enable widget prompts) | 400 ms |
| 12 | Return signed URL to editable Studio | 100 ms |

Total wall-clock target: **≤ 3 seconds server-side + 10 seconds client hydration + 2 seconds first-paint animation** = perceived **~15 seconds**.

### 21.3 Landing state

User arrives at `/studio/edit?p=home&welcome=1` with:

- A **live-editable** home page fully populated
- A **guided top-strip** showing 4 nudges:
  1. "Add your Gas Safe / NICEIC number — unlocks verified badge"
  2. "Upload 6 project photos to activate the gallery"
  3. "Confirm your service radius on the coverage widget"
  4. "Preview and publish"
- The primary CTA in the studio is `Publish live` — never blocked, never gated behind "finish setup"

### 21.4 Editability guarantees

Everything is editable from the first millisecond:

- **Text** — click any text to edit inline (existing Studio behaviour)
- **Sections** — swap via Section Library slide-over
- **Whole Blueprint** — swap via Blueprint Browser, Content-Preserving Swap preserves H1s / phones / images / testimonials / coverage
- **Design variant** — one-tap swap (Corporate ↔ Industrial ↔ Tradesman ↔ Emergency ↔ Premium ↔ Minimal)
- **Apps** — App Store handles add/remove; App Store never blocks removal
- **Verified widgets** — add via `/studio/credentials`
- **Compliance blocks** — hide/show but the Publish flow warns before hiding

**No lockdown ever.** No "premium tier unlocks editing." Editing is always free — pricing gates *distribution features* (custom domain, unlimited products, verified widgets), not the ability to change your own site.

### 21.5 Second-visit magic

Return-visit recogniser (Feature #113): a returning merchant sees a nudge card:

> "Your site is 87% ready. Add your Gas Safe number (2 min) to jump to 96%."

Score deltas make setup gamified without being condescending. Missing dimensions are named in plain English, not "Sales heuristic W3 failed".

### 21.6 What this flow beats

| Competitor | Their fastest first-live | Xrated Blueprint Studio |
|---|---|---|
| Wix AI Site Builder | ~2 min (4–5 questions + generation) | **~15 sec** (3 fields) |
| Squarespace Blueprint | 5 guided steps + curation | **~15 sec** |
| Framer AI | Text prompt + agent generation (~1 min) | **~15 sec** |
| Durable | ~30s first preview, 3 questions | Comparable, but with UK trade compliance + verified widgets |
| BUILT (£99/mo) | Done-for-you 5–10 business days | Same-second self-serve, editable |

### 21.7 What kills the flow if we don't build it right

Honest failure modes:

1. **Service Library gaps** — if a Carpenter picks "kitchen fits" and the library has no seed for that service, the grid renders empty. Mitigation: Appendix D covers 14 trades × 8–12 services each at launch. Remaining 94 trades ship with a "generic services" fallback that surfaces a "Tell us about this service (1 sentence)" prompt.
2. **Hero photography stalls** — if the reference photography pool is thin per trade, sites look same-y. Mitigation: Lane 4 (§18) allocates weeks to a per-trade photography brief with 3+ hero variants per trade.
3. **Auto-selected Apps look presumptuous** — if we pre-check 8 apps a merchant doesn't want, they distrust the setup. Mitigation: auto-selected apps show a top-strip toast "We enabled these 6 apps — remove any you don't want" with a one-tap dismiss.
4. **Content-Preserving Swap edge cases** — if a merchant swaps Blueprint and loses a photo caption, the flow feels destructive. Mitigation: swap stash (§9.3) surfaces the "3 unused content items — restore" chip aggressively for the first 24 hours after any swap.

---

## Appendix A · Research citations

### Certification & regulatory (RID: cert-research §1)
- Gas Safe fees: https://www.gassaferegister.co.uk/services/becoming-registered/registration-fees/
- Elec-Mate scheme guide: https://www.elec-mate.com/guides/competent-person-scheme-guide
- APHC schemes: https://aphc.co.uk/certification-schemes/
- CSCS: https://www.cscs.uk.com/
- CHAS vs SafeContractor vs SMAS: https://www.complys.co.uk/blog/chas-vs-safecontractor-vs-smas
- TrustMark: https://www.trustmark.org.uk/about/who-is-trustmark/
- FMB Join: https://www.fmb.org.uk/become-a-master-builder.html
- NHBC Buildmark: https://www.nhbc.co.uk/warranties/buildmark
- MCS becoming certified: https://mcscertified.com/installers/becoming-certified/
- Zoopla FENSA guide: https://www.zoopla.co.uk/discover/selling/fensa-certificate-everything-you-need-to-know/
- IPAF/PASMA cost: https://www.mptt.co.uk/frequently-asked-questions/ipaf-and-pasma/ipaf-pasma-cost/

### Market & merchant research (RID: merchant-research §3)
- Statista UK top merchants: https://www.statista.com/statistics/879384/leading-building-merchants-uk/
- PBM Top 20 2024: https://professionalbuildersmerchant.co.uk/news/uk-merchant-sector-top-20-2024-calendar-year/
- Havnwright merchant comparison: https://www.havnwright.com/articles/uk-building-suppliers-compared
- Wolseley UK / CD&R deal: https://www.constructionenquirer.com/2021/01/04/private-equity-giant-buys-wolseley/
- Sunbelt Rentals A-Plant: https://www.sunbeltrentals.co.uk/about-us/a-plant
- FMB State of Trade H1 2025: https://www.fmb.org.uk/resource/state-of-trade-survey-h1-2025.html

### Legal & advertising (RID: legal-research §7)
- ASA "best" claims: https://www.asa.org.uk/advice-online/types-of-claims-best.html
- ASA lowest-price: https://www.asa.org.uk/advice-online/lowest-price-claims-and-promises-1.html
- ICO small-business assessment: https://ico.org.uk/for-organisations/advice-for-small-organisations/getting-started-with-gdpr/assessment-for-small-business-owners-and-sole-traders/
- Harper James distance selling: https://harperjames.co.uk/article/distance-selling-contracts-and-the-consumer-contracts-regulations/

### Competitor product (RID: competitor §)
- Webflow home construction: https://webflow.com/templates/subcategory/home-construction-websites
- Squarespace Blueprint AI review: https://www.feisworld.com/blog/squarespace-blueprint-ai-builder-review
- Wix AI Site Builder: https://support.wix.com/en/article/wix-editor-creating-an-ai-generated-site
- Framer AI: https://www.framer.com/ai/
- Durable AI: https://durable.com/
- Jobber Marketing Tools: https://www.getjobber.com/features/marketing-tools/
- Housecall Pro websites: https://www.housecallpro.com/features/websites/
- Tradify Instant Website: https://www.tradifyhq.com/features/instant-website
- BUILT for Trades: https://www.builtfortrades.co.uk/
- Built4Trades: https://www.built4trades.co.uk/
- X Tag Gas Safe Register API link: https://www.xtaggroup.co.uk/news/learn-about-our-unique-link-to-gas-safe-register/index.html

### Gap analysis (RID: gap analysis §6)
- 13 Construction Website Features — Visser Analytics: https://visseranalytics.com/blog/construction-website-features-2025/
- 7 Must-Have Features — Interactive Builds: https://www.interactivebuilds.com/features-for-construction-websites/

### Explicitly unverified
- % of UK trade enquiries on mobile (adjacent proxies only)
- Search-to-call time for emergency trades
- "Fortis Living Solutions" as a Wolseley UK rebrand (NOT verified — actual structure is Wolseley UK sold to CD&R, sub-brands Wolseley Plumb & Parts + Wolseley Climate)
- Waste Carrier Licence 2026 fee schedule
- Sunbelt/Speedy weekend rate cards
- CIPHE, Which? Trusted Trader, NHBC per-plot fees

---

## Appendix B · Codebase reference points

- Trade taxonomy: `src/lib/tradeOff.ts` (108 slugs)
- Trade → template section map: `src/lib/tradeTemplateSections.ts`
- Section registry: `src/lib/studio/sectionRegistry.ts` (47 sections)
- Design presets: `src/lib/studio/designPresets.ts` (10 presets)
- Scoring engine: `src/lib/studio/scoring/index.ts` + `heuristics.ts` + `contrast.ts`
- Pack registry: `src/platform/packs/registry.ts`
- Pack install runtime: `src/platform/runtime/packInstall.ts`
- Existing pack manifest: `src/packs/essentials-pack/manifest.ts`
- AI recommender (App-scope, reusable pattern): `src/components/studio/StudioAppRecommendModal.tsx`
- Section-level AI rewrite: `src/components/studio/StudioAiModal.tsx`
- Merchant Pro tier gating: `src/lib/xratedAddons.ts`
- Studio session loader: `src/lib/studio/session.ts`
- Migration folder: `supabase/migrations/`

---

## Appendix C · Superseded / rescinded rules noted

- User feedback `feedback_studio_addon_wrapper_pattern` was SUPERSEDED and deleted 2026-07-17 — this PRD uses the current `feedback_platform_apps_manifest_first` pattern for Blueprint manifests, matching the App manifest architecture.

---

## Appendix D · Trade Service Library (14 UK trades at launch)

**Purpose.** This library powers the auto-populate Services Grid in the 15-second Instant Setup flow (§21). Every service is drawn from at least one UK trade platform (Checkatrade / MyBuilder / TrustATrader / Rated People / FMB), regulator (Gas Safe, NICEIC, MCS), or sector body page. Judgement calls are marked `[judgement]`.

**Codes:** Frequency — E (emergency), P (planned), M (mixed). Pricing — FP (fixed-price), DR (day-rate), Q (quote-required). Cert — mandatory UK certification.

### D.1 Carpenter / Joiner

| Service | Description | Pricing | Cert | Freq |
|---|---|---|---|---|
| Door hanging | Fit or replace hinged doors incl. locks | FP | – | P (core) |
| Skirting & architrave | Supply and fit trim | FP | – | P (core) |
| Fitted wardrobes | Built-in bedroom storage, made-to-measure | Q | – | P (common) |
| Bespoke shelving | Built-in alcove/utility joinery | Q | – | P (common) |
| Staircase build/repair | Treads, risers, balustrades, spindles | Q | – | P (specialism) |
| Sash window restoration | Repair/refurbish period timber sashes | Q | – | P (specialism) |
| Loft-conversion carpentry | 1st/2nd fix for loft rooms | Q | – | P (specialism) |
| Kitchen carcass fit | Cabinet build-up, worktop, plinth | Q | – | P (common) |
| Wood flooring install | Solid/engineered/parquet lay | FP/Q | – | P (common) |
| Fire door install | FD30/FD60 doors (HMOs, flats) | FP | Third-party cert `[judgement]` common | P (specialism) |
| Boarding-up (burglary) | Emergency secure of broken door/window | FP | – | E (common) |
| Flat-pack assembly | IKEA/Howdens etc. build-only | FP/DR | – | P (common) |

**Combinations:** kitchen fit, flooring, small building works.
**Regulated wording:** fire-door claims must reference the FD rating/certifier; "bespoke" must be genuinely made-to-order (CAP 3.1).
**Sources:** mybuilder.com/carpentry-joinery, checkatrade.com/Search/Joinery, trustatrader.com/carpenters-joiners.

### D.2 General Builder

| Service | Pricing | Cert | Freq |
|---|---|---|---|
| Single/double-storey extension | Q | Building Control notif. | P (core) |
| Loft conversion | Q | Building Control notif. | P (core) |
| Garage conversion | Q | Building Control notif. | P (common) |
| House refurbishment | Q | – | P (core) |
| Kitchen/bathroom refit (mgmt) | Q | – | P (common) |
| Structural alteration (RSJ) | Q | Structural engineer sign-off | P (common) |
| Damp & timber treatment | Q | PCA `[judgement]` common | M (common) |
| Chimney breast removal | Q | Building Control notif. | P (specialism) |
| Basement / cellar conversion | Q | Building Control notif. | P (specialism) |
| Porch / conservatory build | Q | Building Control >30 m² | P (common) |
| Garden office | Q | – | P (common) |
| Insurance reinstatement | Q | – | E (specialism) |

**Combinations:** manages carpenter, plasterer, plumber, electrician, roofer.
**Regulated wording:** "Guaranteed" for structural needs written warranty (CAP 3.53). "FMB Master Builder" only if member.
**Sources:** fmb.org.uk/find-a-builder, ratedpeople.com builder category.

### D.3 Plumber (domestic, non-gas)

| Service | Pricing | Cert | Freq |
|---|---|---|---|
| Leak detection & repair | FP/DR | – | E (core) |
| Burst pipe / emergency call-out | FP | – | E (core) |
| Tap / mixer replacement | FP | – | M (core) |
| Toilet install / repair | FP | – | M (core) |
| Radiator install / swap | FP | – | P (core) |
| Powerflush | FP | – | P (common) |
| Unvented hot-water cylinder | Q | G3 unvented ticket | P (specialism) |
| Water softener install | FP | – | P (common) |
| Outside tap | FP | WRAS `[judgement]` | P (common) |
| Bathroom 1st/2nd fix | Q | – | P (common) |
| Blocked drain clearance | FP | – | E (common) |
| Appliance plumb-in | FP | – | M (common) |

**Combinations:** bathroom fitting, tiling, kitchen fit; often paired with a Gas Safe partner.
**Regulated wording:** "No call-out fee" misleading if diagnostic charge levied — ASA vs **Rightio Ltd** Nov 2020 and **Town Force Ltd** Nov 2020. "24hr/7" needs actual round-the-clock cover. Never advertise "Gas Safe" without registration.
**Sources:** checkatrade.com/Search/Plumber, watersafe.org.uk, asa.org.uk rulings above.

### D.4 Gas / Heating Engineer

| Service | Pricing | Cert | Freq |
|---|---|---|---|
| Boiler install (combi/system) | Q | Gas Safe | P (core) |
| Boiler service | FP | Gas Safe | P (core) |
| Boiler breakdown / repair | FP/DR | Gas Safe | E (core) |
| Gas safety certificate (CP12) | FP | Gas Safe | P (core) |
| Cooker / hob install | FP | Gas Safe | M (core) |
| Gas leak investigation | FP | Gas Safe | E (core) |
| Central heating install | Q | Gas Safe | P (common) |
| Smart / TRV controls | FP | – (gas parts Gas Safe) | P (common) |
| Powerflush | FP | – | P (common) |
| Underfloor heating (wet) | Q | – (boiler tie-in Gas Safe) | P (specialism) |
| Air-source heat pump | Q | MCS + F-Gas | P (specialism) |
| Ground-source heat pump | Q | MCS + F-Gas | P (specialism) |

**Combinations:** almost always dual-badged as plumbers; increasingly cross-train MCS for heat pumps (BUS £7,500 grant requires MCS).
**Regulated wording:** Gas advertising without registration is illegal. MCS/BUS references only if certified. "Approved" needs the scheme name (e.g. Worcester Accredited Installer).
**Sources:** gassaferegister.co.uk, mcscertified.com, niceic.com MCS scheme.

### D.5 Electrician (domestic)

| Service | Pricing | Cert | Freq |
|---|---|---|---|
| Consumer unit / fuse board upgrade | FP | Part P notifiable | P (core) |
| Full/partial rewire | Q | Part P notifiable | P (core) |
| EICR periodic inspection | FP | Registered scheme `[judgement]` | P (core) |
| Extra socket / lighting circuit | FP | Part P if new circuit | P (core) |
| Fault finding | DR | – | E (core) |
| EV charger install (7 kW) | FP | OZEV-authorised | P (common) |
| Solar PV install | Q | MCS | P (specialism) |
| Battery storage install | Q | MCS `[judgement]` | P (specialism) |
| Smart home / lighting | Q | – | P (specialism) |
| Alarm / CCTV | FP | SSAIB/NSI `[judgement]` | P (common) |
| Emergency call-out (no power) | FP | – | E (core) |
| Electric shower install | FP | Part P notifiable | P (common) |

**Combinations:** EV + solar + battery is the growth cluster; alarm/CCTV/access control adjacent.
**Regulated wording:** "NICEIC-approved" only if current (annual assessment). "Guaranteed to pass EICR" prohibited — outcome depends on inspection. OZEV grant claims need specific installer status.
**Sources:** niceic.com, techmeisters.co.uk NICEIC guide, keithgunn.co.uk fuse boards.

### D.6 Roofer

| Service | Pricing | Cert | Freq |
|---|---|---|---|
| Slipped / broken tile repair | FP | – | E (core) |
| Roof leak trace + repair | FP | – | E (core) |
| Full pitched roof replacement | Q | Comp. Person scheme `[judgement]` for insulation upgrade | P (core) |
| Flat roof (EPDM/GRP/felt) | Q | Manufacturer training `[judgement]` for guarantee | P (core) |
| Chimney repair / removal | Q | – | M (common) |
| Lead flashing | FP | – | P (common) |
| Fascia / soffit / bargeboard | FP | – | P (common) |
| Gutter clean / repair / replace | FP | – | M (core) |
| Roof insulation | Q | – (spray foam widely refused by lenders) | P (common) |
| Moss removal / roof clean | FP | – | P (common) |
| Velux / roof-light install | FP | – | P (common) |
| Storm damage / emergency tarp | FP | – | E (core) |

**Combinations:** flat + fibreglass specialists; leadwork; often subcontract to builders.
**Regulated wording:** "Lifetime guarantee" needs defined term/backing (CAP 3.53). Spray-foam mortgage claims heavily scrutinised. "No scaffold" claims must comply with Work at Height Regs 2005.
**Sources:** checkatrade.com/Search/Roofer, checkatrade.com/Search/Roofing-Repairs.

### D.7 Plasterer

| Service | Pricing | Cert | Freq |
|---|---|---|---|
| Skim (walls/ceilings) | FP | – | P (core) |
| Full re-plaster (bond + skim) | FP | – | P (core) |
| Plasterboard / dot & dab | FP | – | P (core) |
| Artex removal or skim-over | FP | HSE asbestos training `[judgement]` for removal | P (common) |
| External sand/cement render | Q | – | P (common) |
| Silicone / K-Rend / monocouche | Q | Manufacturer cert `[judgement]` | P (specialism) |
| Lime plaster / lime render | Q | – | P (specialism) |
| Coving / cornice fit | FP | – | P (common) |
| Small patch repair | FP | – | M (common) |
| Venetian polished plaster | Q | – | P (specialism) |
| Floor screeding | Q | – | P (common) |
| Damp-patch prep + skim | FP | – | M (common) |

**Combinations:** builders, decorators, tilers. Renderers often separate.
**Regulated wording:** pre-1999 Artex work must reference asbestos duty (CAR 2012). K-Rend/Weber guarantees must name actual manufacturer warranty.
**Sources:** p3plastering.co.uk, dwhiteplastering.co.uk, william-bain.co.uk.

### D.8 Painter & Decorator

| Service | Pricing | Cert | Freq |
|---|---|---|---|
| Interior room repaint | FP | – | P (core) |
| Full-house repaint | Q | – | P (core) |
| Exterior masonry paint | Q | – (working at height) | P (core) |
| Woodwork / sash paint | FP | – | P (core) |
| Wallpaper hanging | FP | – | P (core) |
| Spray finishing (kitchens/doors) | FP | – | P (specialism) |
| Staircase refinish | FP | – | P (common) |
| Radiator refinish | FP | – | P (common) |
| Damp / mould stain block | FP | – | M (common) |
| Commercial / landlord void | DR/FP | – | P (common) |
| Heritage colour matching | Q | – | P (specialism) |
| Preparation only | DR | – | P (common) |

**Combinations:** light plastering repairs, wallpaper, small carpentry. Kitchen respray a stand-alone product.
**Regulated wording:** "One-coat coverage" needs product evidence. Painters & Decorators Association only if current member.
**Sources:** aspect.co.uk painting-decorating, mldecorsprayfinishes.co.uk, borthwickdecorators.co.uk.

### D.9 Tiler

| Service | Pricing | Cert | Freq |
|---|---|---|---|
| Bathroom wall tiling | FP | – | P (core) |
| Bathroom floor tiling | FP | – | P (core) |
| Kitchen splashback | FP | – | P (core) |
| Kitchen floor tiling | FP | – | P (core) |
| Wetroom tanking + tile | Q | Mfr. cert (Schlüter/Mapei) `[judgement]` | P (specialism) |
| Shower enclosure tiling | FP | – | P (core) |
| Underfloor heating overlay | FP | – | P (common) |
| Large-format / book-match | Q | – | P (specialism) |
| Natural stone install | Q | – | P (specialism) |
| Mosaic / pattern feature | FP | – | P (common) |
| Grout / silicone renewal | FP | – | M (common) |
| Tile removal & prep | DR/FP | – | P (common) |

**Combinations:** near-universal with bathroom fitters and kitchen fitters. Some tilers do light plumbing disconnect `[judgement]`.
**Regulated wording:** "Waterproof guarantee" must reference tanking-system warranty. "Lifetime" claims restricted.
**Sources:** jjg-tiling.co.uk, quantumgroupni.com waterproofing, pricingpenguin.co.uk tiling.

### D.10 Landscaper / Garden Designer

| Service | Pricing | Cert | Freq |
|---|---|---|---|
| Garden design plan | FP/Q | – | P (core) |
| Patio install | Q | – | P (core) |
| Decking (timber/composite) | Q | – | P (core) |
| Turfing / new lawn | FP | – | P (core) |
| Artificial grass install | FP | – | P (common) |
| Fencing supply & install | FP | – | M (core) |
| Garden walls / raised beds | Q | – | P (common) |
| Driveway install | Q | SuDS for >5 m² front | P (common) |
| Planting scheme | FP/Q | – | P (core) |
| Water feature / pond | Q | – | P (specialism) |
| Garden lighting | FP | Part P if 240 V ext. `[judgement]` | P (common) |
| Regular garden maintenance | DR/FP | – | P (common) |

**Combinations:** driveway specialists, groundworkers (drainage), fencers, garden-lighting electricians.
**Regulated wording:** SuDS for front paving > 5 m² must be stated. "RHS Chelsea award-winning" claims must be verifiable. Chemical use restrictions apply.
**Sources:** hollandscapes.co.uk, northlondongardensltd.co.uk, fantasticservices.com landscaping.

### D.11 Kitchen Fitter

| Service | Pricing | Cert | Freq |
|---|---|---|---|
| Full kitchen install | Q | – (gas Gas Safe, elec Part P) | P (core) |
| Kitchen supply & fit (from range) | Q | – | P (core) |
| Worktop template + install (stone) | FP | – | P (core) |
| Laminate / solid-wood worktop | FP | – | P (core) |
| Splashback fit | FP | – | P (common) |
| Appliance install (non-gas) | FP | Part P for new circuit | P (core) |
| Sink + tap install | FP | – | P (core) |
| Cabinet respray / refurb | Q | – | P (specialism) |
| Kitchen island build | Q | – | P (common) |
| Knock-through mgmt | Q | Building Control notif. | P (specialism) |
| Bespoke / handmade kitchen | Q | – | P (specialism) |
| Utility room fit | Q | – | P (common) |

**Combinations:** carpenters, electricians (Part P), plumbers, tilers.
**Regulated wording:** "TrustMark" only if member. Consumer ex-VAT headline restricted (CAP 3.18). "10-year guarantee" must state backer.
**Sources:** checkatrade.com/Search/Kitchen-Fitters-Installation, magnet.co.uk/installation, mrworktopfitter.co.uk.

### D.12 Bathroom Fitter

| Service | Pricing | Cert | Freq |
|---|---|---|---|
| Full bathroom refit | Q | – (gas Gas Safe, elec Part P) | P (core) |
| Shower room install | Q | – | P (core) |
| Wetroom install (tanked) | Q | – | P (specialism) |
| En-suite install | Q | – | P (core) |
| Bath / basin / WC replacement | FP | – | M (core) |
| Shower valve / mixer install | FP | Part P for electric shower | M (core) |
| Bathroom tiling | Q | – | P (core) |
| Underfloor heating (electric) | FP | Part P | P (common) |
| Disabled / accessible bathroom | Q | – | P (specialism) |
| Luxury / spec bathroom | Q | – | P (specialism) |
| Bathroom design service | FP | – | P (common) |
| Plumbing 1st fix | Q | – | P (core) |

**Combinations:** de facto multi-trade (plumber + tiler + carpenter + light electrical). TrustATrader: full renovation = fitter, not plumber.
**Regulated wording:** "Fully waterproof for life" restricted — must reference tanking warranty. WRAS on cold-water supply.
**Sources:** prestigebathroominstallations.co.uk, trustatrader.com/bathroom-fitters, mybuilder.com bathroom-fitting.

### D.13 Bricklayer

| Service | Pricing | Cert | Freq |
|---|---|---|---|
| Extension brickwork | Q | – | P (core) |
| New-build brickwork | Q | – | P (core) |
| Garden / boundary wall | FP/Q | – | P (core) |
| Repointing | FP | – | P (core) |
| Lime-mortar repointing | Q | – | P (specialism) |
| Chimney rebuild / repair | Q | – | P (common) |
| Chimney removal | Q | Building Control notif. | P (common) |
| Crack stitching (Helibar) | FP | Mfr. cert `[judgement]` common | M (specialism) |
| New window/door opening | Q | Building Control notif. | P (common) |
| Blockwork (inner leaf) | Q | – | P (core) |
| Brick matching / restoration | Q | – | P (specialism) |
| Stone / flint work | Q | – | P (specialism) |

**Combinations:** works under builders on extensions; some bundle groundwork or plastering `[judgement]`.
**Regulated wording:** "Structural warranty" must name an actual scheme (LABC, Premier Guarantee). "Weather-tight guarantee" cautious for repointing.
**Sources:** gorabricklayers.co.uk, ltbrickwork.co.uk, topbrickuk.com, adamsandeden.co.uk.

### D.14 Groundworker

| Service | Pricing | Cert | Freq |
|---|---|---|---|
| Foundations (strip / trench) | Q | Building Control inspection | P (core) |
| Site clearance | Q | – | P (core) |
| Excavation / dig-out | DR/Q | CPCS/NPORS plant tickets `[judgement]` | P (core) |
| Drainage install (foul / surface) | Q | Building Regs Part H | P (core) |
| Soakaway install | FP | – | P (common) |
| Driveway groundworks | FP | – | P (core) |
| Concrete slab / oversite | FP | – | P (core) |
| Retaining wall (structural) | Q | Structural engineer sign-off | P (specialism) |
| Utility trenching | FP | – | P (common) |
| Basement dig-out | Q | Structural engineer | P (specialism) |
| Blocked / collapsed drain repair | Q | – | E (common) |
| Kerbs & edgings | FP | – | P (common) |

**Combinations:** drainage specialists, driveway installers, small builders, landscapers (hardscape base).
**Regulated wording:** "Building-regs compliant" needs actual Building Control sign-off. CDM 2015 duties on domestic work. SuDS for front paving > 5 m².
**Sources:** rjswastemanagement.co.uk, londongroundworkers.co.uk, earthworksuk.co.uk, tagroundworks.co.uk.

### D.15 Cross-trade combinations map (auto-suggest "you might also offer")

- **Carpenter** ↔ Kitchen fitter, Flooring, Bathroom fitter (1st fix), General builder
- **General Builder** ↔ every trade (project-manager role)
- **Plumber** ↔ Bathroom fitter, Gas engineer (dual badge), Tiler
- **Gas engineer** ↔ Plumber (near-universal), MCS heat-pump installer
- **Electrician** ↔ EV charging, Solar PV, Alarm/CCTV, Smart home
- **Roofer** ↔ Fascia/soffit, Chimney (bricklayer), Leadwork
- **Plasterer** ↔ Renderer, Painter/decorator, Builder
- **Painter/Decorator** ↔ Wallpaper, Plasterer (repairs), Spray specialist
- **Tiler** ↔ Bathroom fitter, Kitchen fitter, UFH installer
- **Landscaper** ↔ Driveway specialist, Groundworker (drainage), Fencer, Garden lighting
- **Kitchen fitter** ↔ Carpenter, Electrician, Plumber, Tiler, Worktop specialist
- **Bathroom fitter** ↔ Plumber, Tiler, Electrician, Carpenter, Plasterer
- **Bricklayer** ↔ General builder, Groundworker, Chimney/roofer
- **Groundworker** ↔ Bricklayer, Drainage, Driveway specialist, Landscaper, Builder

### D.16 Emergency-driven services (auto-flag 24/7 messaging)

- Plumber: leak, burst, blocked drain
- Gas engineer: leak, boiler down, no heat/hot water
- Electrician: no power, fault
- Roofer: storm damage, active leak
- Carpenter: burglary boarding-up
- Groundworker: collapsed drain

### D.17 Cross-cutting regulated-wording rules (platform-wide)

- **"No call-out fee"** — misleading if diagnostic charge is levied. ASA vs Rightio Ltd (Nov 2020) and Town Force Ltd (Nov 2020). Force disclosure of diagnostic charge in the same visual field.
- **"24hr" / "24/7"** — must reflect actual round-the-clock cover, not voicemail.
- **"Guaranteed" / "Lifetime guarantee"** — CAP 3.53–3.56: defined term, backer, material limits stated.
- **"Cheapest" / "Lowest price" / "No.1"** — needs substantiation; price-match ≠ price-beat (CAP lowest-price).
- **Certification claims** — only if currently registered: Gas Safe, NICEIC/NAPIT, MCS, OZEV, FMB, TrustMark.
- **Compulsory charges** (VAT, call-out, min-hour) must be included in headline price for consumer ads (CAP 3.18).

Cross-cutting regulator sources: asa.org.uk call-out-charges, asa.org.uk guarantees, asa.org.uk lowest-price-claims, asa.org.uk Rightio ruling, asa.org.uk compulsory-costs, asa.org.uk code section 03.

### D.18 Fallback for the other 94 trade slugs

For trades not covered in D.1–D.14 at launch (there are 94 in the `tradeOff.ts` taxonomy), the Instant Setup flow surfaces a **generic 8-slot services grid** with a "Tell us about this service (1 sentence)" prompt inline. This ensures every trade has a working 15-second flow — polish per trade lands progressively in Lane 4 (§18).

---

*End of document.*

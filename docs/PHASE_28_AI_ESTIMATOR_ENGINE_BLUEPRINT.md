# Phase 28 — Nex AI Estimator Engine

**Blueprint · 2026-07-23**
**Status:** Design document. Not yet built. Builds on Phase 7 (`src/lib/nex/est/`), Phase 13 (`src/lib/nex/cv/`), Phase 24 (mesh + trade agents), Phase 26 (memory substrate), and Phase 27 (Trade Expert Brains blueprint).

---

## Executive Summary

Nex already ships a construction estimator. Phase 7 (`src/lib/nex/est/buildEstimate`) produces labour + materials + waste + overhead + profit + VAT for a scoped brief. Phase 13 (`src/lib/nex/cv/`) reads images. Phase 24 mesh coordinates trade specialists. Phase 26 memory recalls the merchant's own pricing history. What Nex does not have yet is the **composition layer that turns those parts into a full customer-ready estimating experience**.

Phase 28 is that layer. It orchestrates: multi-input intake (photos, drawings, PDFs, voice-notes-with-caveat, measurements, homeowner brief) → vision + document analysis → routing to trade Brains (Phase 27) → memory recall → material intelligence → labour intelligence → profit optimisation → customer-ready quotation. The output is a professional proposal in minutes, not hours, that reads like a 30-year estimator wrote it because a 30-year Brain per trade did.

The strategic result is a step-change in the merchant's economics. Estimating time is the invisible cost that eats small trade businesses alive. Turning it from hours per lead into minutes per lead — while raising conversion — is the biggest lever Nex can pull for merchant profitability. That makes Phase 28 arguably the most commercially valuable feature in the platform.

The moat is the same as Phases 24-27: the composition works because every piece exists, and each piece gets better with every project. A competitor building this from scratch faces the same multi-year path Section 13 describes.

---

## 1. AI Estimating Architecture

### 1.1 The full pipeline

```
Merchant / Homeowner input
    │
    ├── photos, videos, drawings, PDFs, hand sketches
    ├── measurements (dimensions, quantities)
    ├── project brief (typed; voice see §14)
    └── budget signal (optional)
        │
        ▼
┌────────────────────────────────────────────────┐
│  Input Router (Phase 28 new)                   │
│  - Classifies each input                       │
│  - Fans out to the appropriate analyzer        │
└────────────────┬───────────────────────────────┘
                 │
    ┌────────────┼────────────┬──────────────┐
    ▼            ▼            ▼              ▼
Vision AI    Doc AI     Measure Norm.   Brief Parser
 (Phase 13)  (Phase 13   (Phase 28 new)  (Phase 28 new)
             OCR)
    │            │            │              │
    └────────────┴──────┬─────┴──────────────┘
                        ▼
┌────────────────────────────────────────────────┐
│  Scope Assembler (Phase 28 new)                │
│  Extracts: trades required, structural work,   │
│  fixtures, finishes, access, waste, RAMS       │
└────────────────┬───────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────┐
│  Trade Brain Fan-Out (Phase 27)                │
│  Each involved Brain returns:                  │
│  · Trade-specific scope                        │
│  · Material intents                            │
│  · Labour intents                              │
│  · Risk-rule triggers                          │
└────────────────┬───────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────┐
│  Composition Layer (Phase 28 new)              │
│  · Deduplicate cross-trade materials           │
│  · Sequence via workflow dependency graph      │
│  · Merge risk assessments                      │
└────────────────┬───────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────┐
│  Material Intelligence (Phase 28 · uses MP 17)│
│  Quantities → waste → pack sizes → suppliers   │
└────────────────┬───────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────┐
│  Labour Intelligence (Phase 28 · uses memory)  │
│  Hours → crew → days → weather/regional adj.   │
└────────────────┬───────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────┐
│  Risk Analysis (Phase 25 BOS)                  │
│  Cost/schedule/cash/workforce/material risks   │
└────────────────┬───────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────┐
│  Profit Optimiser (Phase 28 new)               │
│  Min / target / premium price + negotiation    │
│  range · pulls FI, BOS, memory, market rollups │
└────────────────┬───────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────┐
│  Quote Generator (Phase 28 new)                │
│  Professional proposal · scope · materials     │
│  · labour · timeline · warranty · brand        │
└────────────────┬───────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────┐
│  Customer Presentation (Phase 28 new)          │
│  Interactive proposal · options · upgrade path │
│  · payment schedule · digital approval         │
└────────────────────────────────────────────────┘
```

### 1.2 Composition boundary

Phase 28 does **not** re-implement estimating logic that lives elsewhere. Each stage delegates:

- Vision → Phase 13 CV
- Trade-specific pricing → Phase 27 Trade Brain pricing_model modules
- Regional regulations → Phase 21 global
- Historical benchmarks → Phase 26 memory
- Risk scoring → Phase 25 BOS
- Supplier ranking → Phase 17 MP

The Estimator's own IP is the **composition**: assembling all these into one coherent customer-ready output.

### 1.3 Constitutional constraints

Per the platform rules from CLAUDE.md and merchant memory:

- **Evidence-or-silence.** Every material line, every labour hour, every regulation cite carries an evidence chain. When we don't know, we say so — "using regional median because no company history exists yet" is transparent; a fabricated number is not.
- **No voice AI in purchasing path.** The user brief lists voice notes as input. See §14 — voice is available on the merchant side (as scope-drafting shorthand the merchant reviews before submission), never on the homeowner-checkout side.
- **Never destructive.** Every draft estimate is a memory row. Revisions append; they don't overwrite. The full audit trail is retained.
- **Approval-required for anything auto-sent.** Merchant approves every quote before it goes to the customer.

---

## 2. Multi-Input Intelligence

### 2.1 Input types + routing

| Input             | Analyzer                                        | Extracts                                             |
| ----------------- | ----------------------------------------------- | ---------------------------------------------------- |
| Photograph        | Phase 13 CV `analyzeConstructionImage`          | Surfaces, fixtures, defects, ballpark dimensions     |
| Video             | Phase 28 frame sampler → Phase 13 CV per frame  | As above + walk-through spatial understanding        |
| Floor plan (PDF)  | Phase 13 CV drawing mode                        | Room list, wall run, door swings, dimensions         |
| Architectural drawing | Phase 13 CV drawing mode                    | Elevations, section detail, spec references          |
| Hand sketch       | Phase 13 CV sketch mode                         | Approximate layout + annotations                     |
| PDF spec doc      | Phase 13 CV OCR + Phase 28 spec parser          | Named products, standards references                 |
| Site measurements | Phase 28 measurement normalizer                 | Structured lengths/areas/counts + unit disambiguation |
| Customer brief    | Phase 28 brief parser                           | Scope keywords, budget cues, style cues              |
| Voice note        | Merchant side only — see §14                    | Scope shorthand for merchant to review               |

### 2.2 Kitchen worked example

Customer uploads:
- 4 kitchen photos (existing state)
- Floor plan JPG showing new layout with dimensions
- Typed brief: "want a shaker style, prefer white units, budget around £15,000, timeline flexible"
- Pinterest board link (5 pinned images of kitchens)

Nex processes:

1. **Photos** → Vision detects: existing units (need removal), tiling (need removal), sink type (top-mount, standard drain), electrical points (7 sockets, under-cabinet lighting), extract to ceiling (rerouting needed), floor finish (LVT, retain)
2. **Floor plan** → Room area 18 sqm, run of units 4.2m + peninsula 1.8m, extract position moves 1.2m
3. **Brief** → Trade classification: kitchen fit + electrical + plumbing + plastering + decorating. Budget signal: £15,000. Style: shaker/white. Timeline: flexible.
4. **Pinterest** → Style-similarity match: 5 boards suggest shaker white with brass handles + quartz worktop
5. **Composition** → Scope assembled with cross-trade sequence

Output within minutes: full quotation with three price tiers (see §7), material list with alternates, timeline, RAMS drafted, customer-ready proposal.

### 2.3 Ambiguity handling

Multi-input cases inevitably contradict. Photo shows a wooden worktop; brief says quartz; Pinterest says quartz. Rules:

1. **Prefer written brief** > extracted image detail > style board — written intent beats interpreted image
2. **Never silently pick** — surface the conflict to the merchant with a suggestion
3. **Confidence badge** — the estimate declares confidence per line item

---

## 3. Trade-Specific Estimating

Phase 27 Trade Brains own trade-specific pricing_model modules. Phase 28 invokes them.

### 3.1 Invocation pattern

```typescript
// pseudo-code
const brains = mesh.plan(scope)               // returns list of trade Brains
const contributions = await Promise.all(
  brains.map((brain) => brain.estimatePricingFor({
    scope_slice: sliceFor(brain, scope),
    region:      merchant.region,
    memory:      memoryClient(merchant),
    market:      marketClient()
  }))
)
```

Each Brain returns a **TradeEstimate** object with structured line items — never a total. Composition adds the totals so cross-trade waste dedup + shared-scaffold factors + shared skip-hire can be applied correctly.

### 3.2 Trade coverage matrix

The launch estimator should cover every trade already agent-registered in Phase 24 (10 baseline + 30 specialists) via their Phase 27 pricing_model modules. New trades plug in as Phase 27's schema requires:

- Builder — top-level orchestrator when a project has 3+ trades
- Bricklayer, Carpenter, Roofer, Plumber, Electrician, Plasterer, Painter, Tiler
- Landscaper, Groundworker
- Kitchen/Bathroom Installer (composite trade with sub-trade fan-out)
- Heating Engineer, Solar Installer, Window Installer
- Steel Fabricator, Scaffolder

Composite trades (Kitchen Installer, Bathroom Installer) internally fan out to Carpenter + Electrician + Plumber + Tiler + Plasterer + Painter through Phase 24 mesh dependencies.

---

## 4. Scope of Works Generator

The estimate is only half the deliverable. A scope-of-works document communicates what's included, excluded, and assumed. Nex composes this from Trade Brain contributions.

### 4.1 Scope skeleton

Every SOW has these blocks. Missing data = honest omission, never fabrication.

```
1. Project overview             — from brief parser
2. Construction stages          — from mesh sequence graph
3. Materials                    — from Material Intelligence
4. Labour                       — from Labour Intelligence
5. Plant + equipment            — from trade Brain tools modules
6. Access requirements          — from Vision (scaffolds, MEWP, permits)
7. Waste disposal               — computed from material volumes + skip factor
8. Health + Safety              — trade Brain safety modules + RAMS
9. Building Regulations         — Phase 21 cites scoped to the job
10. Exclusions                  — everything not explicitly included
11. Assumptions                 — every design decision Nex made on the merchant's behalf
12. Warranty                    — from merchant profile + trade Brain defaults
```

### 4.2 Assumptions transparency

Every "assumption" in section 11 is a decision Nex made when the input was ambiguous. Example: "Assumed cavity wall construction based on brick pattern in photo — verify on site." The merchant sees these before sending. The customer sees these after acceptance. Assumptions are how the estimator stays honest.

---

## 5. Material Intelligence

### 5.1 The math

For each trade-declared material line, the engine computes:

```
purchase_qty = ceil((scope_qty × (1 + waste_factor)) / pack_size)
purchase_pence = purchase_qty × pack_price_pence
```

**Waste factors** come from the Trade Brain (regional-adjusted). **Pack sizes + prices** come from Phase 17 Marketplace + memory-known supplier prices. **Alternatives** are pulled from Phase 24 Procurement Agent + market memory when V1 memory rollups exist.

### 5.2 Alternates + tiers

Every material line offers three alternates: premium, standard, budget. The Brain declares each. Example (Carpenter, joist):

```
premium:   C24 KD 47×195mm, FSC + 25-yr warranty (£12/m)
standard:  C24 47×195mm      (£8.50/m)
budget:    C16 47×195mm      (£6.20/m — flags: not for structural spans > 3.5m)
```

The customer proposal shows all three with clear tradeoffs. Selection updates the total in real time.

### 5.3 Supplier ranking

Suppliers are ranked by a composite score, not headline price:

```
score = 0.4 × price_index
      + 0.3 × on_time_pct (from Phase 26 memory)
      + 0.2 × defect_rate_inv (from memory)
      + 0.1 × proximity_km_inv
```

Weights are tunable per merchant. Trade Brain can override — e.g., Heating Brain prefers Wolseley for gas boiler supply because of the parts network.

### 5.4 Availability + price history

When Phase 26 memory has supplier lead-time data, availability shows as "in stock at Wolseley Cardiff · 3 delivered in 90 days on time." When it doesn't, we say so: "no delivery history on file." Never fabricated.

---

## 6. Labour Intelligence

### 6.1 The math

For each trade line:

```
hours = base_hours_per_unit × units × complexity_factor × regional_productivity_factor
crew_days = hours / (crew_size × hours_per_day)
```

**Base hours** from Trade Brain pricing_model. **Complexity factor** from Vision AI (e.g., 1.15 for tight access, 1.25 for existing plaster removal, 1.0 for standard). **Regional productivity** from Phase 26 regional rollups when K≥5, else from Trade Brain regional defaults, else 1.0 with a "no data" flag.

### 6.2 Trade sequence + working days

Working days come from the mesh dependency graph. Two carpenters + two plasterers cannot both be in the same room, so the estimator serialises where the sequence graph says they must. The result is a Gantt-ready timeline, not just an hours count.

### 6.3 Weather + site adjustments

Weather adjustment (rain days, frost) uses country-scoped baseline probability × job duration. Site adjustments (travel time, urban vs rural access) come from address + Vision AI parking cues.

### 6.4 Continuous improvement via Memory

When the estimate is accepted and the project completes, Phase 26 memory writes:

```
project.duration.days              (from actual)
project.labour.hours               (from timesheet)
project.materials.total_pence      (from actual invoices)
project.snags.count                (from SiteBook)
```

Delta between estimate and actual is memorised as an accuracy row:

```
merchant.estimating.accuracy.duration_days      = -1.4  (avg over 12 projects)
merchant.estimating.accuracy.labour_hours       = +6.2
merchant.estimating.accuracy.materials_pct      = +8.3%
```

Next estimate uses these as personalised calibration factors. This is how the estimator gets more accurate for THIS merchant over time — grounded in real deltas, not fabrication.

---

## 7. Profit Intelligence

### 7.1 The three-price model

Every estimate returns three prices, each derived from evidence:

| Tier            | Formula                                                                 | When it's for                                     |
| --------------- | ----------------------------------------------------------------------- | ------------------------------------------------- |
| Minimum safe    | cost + minimum_margin_pct × cost                                        | Break-glass. Never quote below this.              |
| Target price    | Minimum safe + Brain-recommended uplift + memory-derived merchant style | The default. Balances margin + close-rate.        |
| Premium price   | Target + optional-inclusions uplift + premium-supplier swap             | For customers who want the best; adds warranty.   |

**Minimum margin pct** comes from Phase 10 FI merchant target + Phase 26 memory-derived floor. It's never zero.

**Brain-recommended uplift** is a trade-specific factor. Roofing at height carries more risk than internal decorating; the uplift reflects it.

**Merchant style** — some merchants close at 20% margin, some at 40%. Learned from accepted-quote / rejected-quote deltas in memory.

### 7.2 Negotiation range

The output also shows a **negotiation floor**: the price the merchant should not drop below in a haggle. Equals Minimum Safe + a small buffer. Merchant sees this internally; never surfaced to the customer.

### 7.3 Analysis surfaces per estimate

Every estimate surfaces to the merchant these numbers:

- Projected margin at target
- Cash-flow impact on the 30-day / 90-day horizon (via Phase 25 BOS)
- Material volatility risk (Brain-flagged materials whose prices move fast)
- Labour risk (are hours confident, or is there a low-sample-size caveat?)
- Hidden-cost flags (e.g., "concealed pipework upstream of your scope — recommend a variation clause")

### 7.4 Competitor pricing (optional add-on)

If the merchant subscribes to Regional Pricing Report (Phase 26 monetisation) the estimate also shows regional-median comparison — "you're 8% above median, still within top-quartile close-rate band."

---

## 8. AI Vision Estimating

Vision is the flagship feature. It's the input modality most competitors can't touch because it requires (a) Phase 13 CV depth, (b) Phase 27 trade brains to interpret findings, and (c) memory to calibrate.

### 8.1 Bathroom worked example

Customer uploads three bathroom photos. Vision AI extracts:

| Element             | Detection method                                       | Downstream            |
| ------------------- | ------------------------------------------------------ | --------------------- |
| Wall area           | Perspective + reference-object scaling (door width)   | Tiler scope           |
| Floor area          | Same, from floor-plane recognition                     | Tiler + Waste calc    |
| Existing tiles      | Texture segmentation                                   | Removal scope         |
| Bath                | Object detection + brand-family classifier             | Plumber replacement   |
| Toilet              | Object detection + wall vs floor mount detection       | Plumber first-fix    |
| Vanity              | Object detection + width estimate                      | Carpenter + Plumber   |
| Visible pipework    | Line detection + material classifier                   | Concealment scope     |
| Lighting            | IP-rating estimation from fitting shape + zone         | Electrician scope     |
| Ventilation         | Extract fan detect + duct-run inference                | HVAC scope            |
| Decoration          | Paint condition classifier                             | Decorator scope       |
| Removal work        | Deduced from mismatch of "existing" vs "desired"       | Waste + labour        |
| Access issues       | Doorway + landing detection                            | Complexity factor     |
| Hidden risk flags   | Damp patterns, cracks, old asbestos-era finishes       | Risk assessment       |

### 8.2 Innovative Vision AI features competitors don't offer

Beyond the standard extraction list:

1. **Substrate detection** — from grout line patterns + edge behaviour, infer whether tile substrate is plywood, cement board, or old plaster. Predicts re-tile complexity.
2. **Age dating** — from fixture style + fitting era, estimate installation decade. Informs the "how likely is there hidden asbestos / lead paint" flag.
3. **Owner-hint detection** — inferred owner priorities from what's cluttered vs what's staged. Predicts the customer's style preferences before they say them.
4. **Progression detection** — same address, multiple upload dates. Nex flags progress vs the original scope so mid-job variations are captured automatically for billing.
5. **Cross-photo consistency** — three photos of one bathroom sometimes disagree. Nex reconciles (e.g., all three show the same toilet from different angles → high-confidence; two photos taken on different days show different tile → time-shifted, flag for merchant).
6. **Standards-triggered flags** — Vision detects Zone 1 lighting fitting without IP rating; automatically raises "confirm IP44+ or replace" flag on the Estimator's risk section.
7. **Warranty-registerable extraction** — Vision reads product labels + records the model/serial into SiteBook so the customer's warranty vault is auto-filled on project completion.
8. **Sequence-planning from clutter** — Vision estimates ability to work around fixed obstacles (e.g., grand piano in living room during kitchen refit → longer duration, complexity flag).

### 8.3 Drawing interpretation

Beyond photos: floor plans, sections, elevations. Phase 13 CV drawing mode extracts:

- Room list + areas
- Wall runs + heights + partition kinds
- Door + window schedule
- Kitchen + sanitary fixture positions
- Structural markings (RSJ callouts, load lines)
- Spec sheet references (product codes to look up)

Combined with Vision from photos, drawings resolve dimensional ambiguity (photos are approximate; drawings are dimensioned). When they disagree, drawing wins.

---

## 9. Customer Presentation Engine

The estimate should convert.

### 9.1 The interactive proposal

Every quote is a **web-native interactive proposal**, not a PDF attachment. Homeowner opens on any device, sees:

- Cover page: project name, address, merchant brand
- Scope: three-price tier selector at the top
- Visual breakdown: photos or renderings per stage
- Timeline: Gantt-lite showing when their kitchen is unusable, when trades on site, when handover
- Options + upgrades: toggleable inclusions with live price update
- Payment schedule: milestone-linked
- Warranty: merchant-brand + trade Brain defaults
- Digital approval: signature + card-on-file for first milestone

### 9.2 Alternative finishes preview

For finish-heavy trades (tiling, decorating, kitchens), the proposal shows visual alternates. Vision AI's Pinterest-style board becomes actionable — click a variant, price updates. This is where Phase 13 CV's compositing capability plus Phase 27 Materials modules combine.

### 9.3 Customer portal

After acceptance the customer keeps access via SiteBook. Ongoing surfaces:

- Progress photos (auto-added from SiteBook)
- Milestone approvals (pay X on completion of Y)
- Variations (any change is a mini-proposal in the same UI)
- Warranty vault (per §8.2.7)

### 9.4 Merchant branding

Every proposal uses the merchant's canteen branding (colours, logo, tagline) from `src/lib/nex/orch/registry.ts` Studio integration. Never Nex-branded to the customer, except a discreet "Powered by Nex" footer that respects Phase 20 free-tier viral-loop rules.

---

## 10. Learning + Continuous Improvement

### 10.1 The feedback loop

For every project, Phase 26 memory writes both the estimate and the actual:

```
project.estimated.duration_days     = 12
project.actual.duration_days        = 14
project.estimated.labour_hours      = 88
project.actual.labour_hours         = 94
project.estimated.materials_pence   = 250,000
project.actual.materials_pence      = 268,000
project.customer.satisfaction       = 4.8 / 5
project.margin.achieved_pct         = 21.4
```

The deltas roll up nightly into merchant-level calibration factors (§6.4). Once K≥5 merchants per trade × region, they also feed regional benchmark rollups (Phase 26 V1+).

### 10.2 Named-lesson memory

Beyond deltas, some projects yield named lessons the merchant wants to reuse:

```
subject: "lesson.kitchen.always_check_wall_run_flatness"
value:   { note: "8mm packing needed on last 4 jobs, price it in" }
```

Lessons are merchant-writable. They surface as extra risk flags on similar future scopes.

### 10.3 Privacy inherited from Memory

Same five hard rules from Phase 26 blueprint. No PII crosses tenants; K-anonymity for cross-tenant reads; regional gate; opt-out; "your data helped" transparency.

---

## 11. Integration Across Nex

| Nex module               | Estimator uses it for                                              |
| ------------------------ | ------------------------------------------------------------------ |
| Trade Expert Brains (27) | Trade-specific pricing_model + workflow + risk rules               |
| Memory (26)              | Merchant's own history, calibration deltas, cross-tenant K-safe    |
| Knowledge Graph (25 bos) | Trade → tools → materials edges                                    |
| SiteBook                 | Deliver interactive proposals + capture actuals                    |
| Studio                   | Merchant branding on quote                                         |
| Trade Centre             | Homeowner-facing marketplace surface for accepted quotes           |
| Marketplace (17 mp)      | Supplier catalogue + rankings                                      |
| CRM (8 cx)               | Customer history + payment behaviour                               |
| Scheduling (24 orch)     | Trade sequence + Gantt from mesh graph                             |
| Finance (10 fi)          | Margin gate + cash-flow impact                                     |
| Inventory                | Merchant-stocked materials get preferred (avoid re-buying)         |
| Supplier network         | Live availability + on-time performance                            |
| Digital Twin (23 twin)   | "What if I quote at premium" scenario simulation                   |
| Autonomous agents (15 ab)| Auto-follow-up after quote sent                                    |
| Business Intelligence    | Estimator KPIs (win rate, quote-to-close days, margin achieved)    |

Everything is a first-class read. The Estimator writes back to memory as it runs. The loop is closed.

---

## 12. Monetisation Strategy

### 12.1 Tier ladder (aligned with `src/lib/tierCatalog.ts`)

| Tier                       | Estimator access                                                   |
| -------------------------- | ------------------------------------------------------------------ |
| Free                       | 3 AI estimates / month · single-input (photo OR brief) · no memory calibration |
| Starter £9.99/mo           | 20 estimates / month · multi-input · own-memory calibration        |
| Professional £14.99/mo     | Unlimited estimates · Trade Brain access · Vision AI + drawings    |
| Business £24.99/mo         | + Regional benchmarks · Interactive proposal · Customer portal     |
| The Works £39.99/mo        | + Profit optimiser Premium tier · negotiation coach                |

### 12.2 Add-ons

- Pay-per-estimate credit packs for merchants who exceed their tier: 20 estimates for £14.99
- Supplier partnership listing fee: £29/mo/supplier to appear as preferred alternate in the material picker
- Manufacturer integration: £99/mo/manufacturer to embed product data into the Materials module (opt-in per merchant, clear label)
- Material purchasing commissions: small % of platform-brokered material orders when merchant clicks "buy through Nex"
- Insurance estimating pack: bespoke rate for loss-adjuster workflows (schedule of loss + reinstatement estimate)
- Commercial tendering pack: multi-user bid workspace, versioned bid documents, red-team review
- Construction consultancy: warm handoff to human consultant when Nex confidence is low; Nex takes finder's fee
- White-label estimator: bulk merchants under an umbrella brand (agency, franchise) pay per seat + revenue share

### 12.3 Sustainable recurring revenue

Estimator sits on the retention seam. Every estimate produced is memorised. Every memorised estimate makes the next one better. A merchant with 200 memorised estimates on Nex sees no equivalent quality anywhere else, because nowhere else has 200 of their estimates.

---

## 13. Competitor Analysis

### 13.1 vs. Buildxact / Buildertrend / Procore / ServiceTitan

**Their strength:** established workflows, integrated project management.

**Their gap:** their estimating is form-driven, not intelligence-driven. Their AI is a summary-and-populate layer over the form. No trade-brain depth, no cross-project calibration, no Vision AI at the level Phase 13 already ships.

### 13.2 vs. Xactimate

**Their strength:** insurance-industry standard for property loss estimating; deep tables.

**Their gap:** narrowly scoped to loss-adjust workflows. Not built for a plumber's day rate or a kitchen fitter's package. Does not learn per-merchant.

**Nex advantage:** Nex can serve loss-adjust flows AND general contractor flows AND small-trades flows from the same substrate.

### 13.3 vs. STACK / PlanSwift / Bluebeam

**Their strength:** takeoff (measuring drawings for quantities).

**Their gap:** takeoff is one input. Nex composes takeoff + photos + brief + memory + market into a full quote. Takeoff tools stop at quantities.

**Nex advantage:** Nex delivers a proposal, not a takeoff.

### 13.4 vs. ChatGPT / Claude / Gemini

**Their strength:** natural language, broad reasoning.

**Their gap:** no regulation cite grounding, no market rollup access, no per-merchant memory, no Vision AI trained on construction defects, no supplier ranking, no trade-brain depth.

**Nex advantage:** Nex composes them all. A generic LLM writing an estimate makes up plausible-sounding numbers. Nex writes evidence-backed numbers.

### 13.5 The moat

Same as Phases 24-27: composition over years of specialist substrate. A competitor could ship any single piece in weeks. Shipping all pieces simultaneously, calibrated to real merchants, priced honestly under Stripe-margin rules, takes years.

---

## 14. Future Vision + the Voice Constraint

### 14.1 The 10-photo scenario

Homeowner uploads: 10 photos, a short voice message, a floor plan, a budget signal.

Nex produces within minutes:

- Complete project analysis (Vision + drawing interpretation composed)
- Trade sequencing (mesh dependency graph)
- Material quantities (Material Intelligence)
- Labour calculations (Labour Intelligence + memory calibration)
- Professional quotation (Quote Generator, three tiers)
- Interactive proposal (Customer Presentation)
- Timeline (from sequence graph)
- Profit optimisation (Profit Intelligence + BOS integration)
- Risk analysis (BOS + Trade Brain risk rules)
- Supplier recommendations (Marketplace + memory)
- Customer-ready presentation (interactive proposal + digital approval)

### 14.2 The voice-note caveat

The user brief lists voice notes as an input. Nex's own constitutional rules (`feedback_no_voice_in_purchasing.md` + `feedback_no_voice_seo_at_all.md`) prohibit voice AI in the purchasing path.

**Reconciliation:**

- Voice notes are **merchant-side, on-site draft input only**. A merchant records "add a socket next to the fridge, standard height, existing chase" while on a site walk. Nex transcribes locally (browser API, no cloud transcription of customer voice), the merchant reviews the transcript, then the transcript enters the Estimator as typed brief.
- Homeowners do **not** submit voice on the checkout/purchasing side.
- The Speakable SEO schema is not shipped.

This is compliance-first, and the merchant workflow value (walk-and-talk scope capture) is preserved.

### 14.3 Why this becomes the benchmark

Three reasons the fully mature Estimator becomes the industry benchmark:

1. **Speed × accuracy × price honesty at the same time.** Competitors optimise one; Nex optimises all three because the substrate is honest by design.
2. **The customer proposal is a sales tool.** Interactive, personalised, evidence-backed. Close rates go up because the proposal is a story, not a spreadsheet.
3. **Every merchant's estimator is uniquely theirs.** After 50 quotes memorised, the estimator writes like the merchant writes, quotes like the merchant quotes, prices like the merchant prices. No competitor achieves that from a cold start.

---

## 15. Technical Requirements

| Layer                 | Depends on                                     | Est. build load                    |
| --------------------- | ---------------------------------------------- | ---------------------------------- |
| Input Router          | Phase 28 (new)                                 | 2 weeks                            |
| Scope Assembler       | Phase 13 CV + Phase 28 brief parser            | 4 weeks                            |
| Trade Brain Fan-Out   | Phase 27 (must be at V1)                       | Blocked by Phase 27                |
| Composition Layer     | Phase 24 mesh already shipped                  | 3 weeks                            |
| Material Intelligence | Phase 17 MP + Phase 26 memory + Phase 24 orch  | 4 weeks                            |
| Labour Intelligence   | Phase 24 orch + Phase 26 memory                | 3 weeks                            |
| Profit Optimiser      | Phase 10 FI + Phase 25 BOS + Phase 26 memory   | 3 weeks                            |
| Quote Generator       | Phase 28 (new)                                 | 4 weeks                            |
| Customer Presentation | Phase 28 (new) + Studio branding integration   | 6 weeks                            |
| Interactive Proposal  | Phase 28 (new) + SiteBook portal integration   | 6 weeks                            |
| Learning + calibration| Phase 26 memory writes/reads                   | 2 weeks                            |

### 15.1 AI models

- **Vision** — Phase 13 CV already uses OpenAI GPT-4-Vision or equivalent. Extends here to Vision + drawing modes.
- **OCR** — for PDF spec extraction. Existing options (Google Document AI, Amazon Textract, Azure OCR) are commodity.
- **Language** — Nex voice on customer-facing outputs runs through Claude Opus 4.7 (per merchant memory rule pinning the model).
- **No fine-tuning V0.** Fine-tuning is a V3 conversation, after the substrate has enough calibrated data to make training data non-fabricated.

### 15.2 Database

No new tables required for V0. The Estimator writes into existing Phase 26 memory tables. If the interactive proposal needs a durable state store beyond memory, we introduce `hammerex_nex_proposals` as a follow-up migration once V0 UX is proven.

---

## 16. Development Roadmap

- **V0 · single-trade estimator** (6 weeks). Kitchen or bathroom fit. Photos + brief + budget. Three-price output. No interactive proposal — plain PDF/HTML output. Blocked only on Phase 27 electrician + plumber + carpenter Brains at V1.
- **V1 · multi-trade extension** (6 weeks). Compose trade Brains for kitchen fit + bathroom fit. Add supplier ranking (Phase 26 memory reads).
- **V2 · interactive proposal + customer portal** (8 weeks). Web-native quote. Digital approval. SiteBook portal integration.
- **V3 · Vision AI innovations** (8 weeks). Bathroom scene extraction, substrate detection, style similarity board.
- **V4 · full trade coverage** (aligned with Phase 27 V2 second-wave Brains). Rolls out estimator to bricklayer / roofer / plasterer once those Brains ship.
- **V5 · monetisation add-ons** (rolling). Supplier partnerships, manufacturer integrations, insurance pack.

---

## 17. Risks + Mitigations

| Risk                                                              | Severity | Mitigation                                                                     |
| ----------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------ |
| Vision extraction inaccuracy on non-standard photos                | High     | Confidence badge per line item; merchant reviews before quote goes to customer |
| Merchant over-relies on estimator; misses site-specific issues     | High     | Assumptions transparency section; SOW mandatory before quote issue             |
| Regional pricing drift (memory ages)                               | Medium   | Phase 26 decay rules already handle this; add explicit "stale" flag           |
| Manufacturer bias in materials                                     | Medium   | Clear cite labels; merchant can filter out sponsored recommendations           |
| Customer confusion over three-tier pricing                         | Medium   | UX research + A/B on three-tier vs single-price default                        |
| Voice-note transcription errors leaking into quote                 | Low      | Merchant review gate; local transcription only                                 |
| Competitor releases similar feature                                | Medium   | Composition depth is the moat, not the feature list                            |
| Free tier abuse (agencies burning quotes at no cost)               | Low      | Rate-limit + Cloudflare Turnstile on the free tier                             |

---

## 18. Final Recommendation

Phase 28 has the highest **commercial delta per engineering hour** of any phase Nex has planned. Estimating time is the largest hidden cost small merchants pay. Shrinking it by 10× while raising close rates is the single biggest lever on merchant profitability. That makes this the phase merchants will most enthusiastically pay for.

**Sequencing constraint:** Phase 28 V0 is blocked by Phase 27's V1 (three second-wave Brains). Skipping Phase 27 in favour of a form-driven Phase 28 would work commercially but repeat every competitor's mistake — form-driven estimating is what already exists everywhere. The point of Phase 28 is that the intelligence comes from the trade Brains. Do not start Phase 28 before Phase 27 V1.

**Recommended:**

1. Ship Phase 27 V0 (Electrician reference Brain) first.
2. Migrate Phase 24 trades to the Brain contract.
3. Author three second-wave Brains (Carpenter + Plumber + Roofer) — 6 weeks each in parallel.
4. Begin Phase 28 V0 the moment the second wave crosses V1.

Total path from now: approximately 20 weeks to Phase 28 V0 in production for kitchen + bathroom + roofing estimates. 6 months later: full trade coverage.

---

**End of Phase 28 blueprint.**

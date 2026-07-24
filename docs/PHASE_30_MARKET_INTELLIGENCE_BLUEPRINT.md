# Phase 30 — Nex Construction Market Intelligence

**Blueprint · 2026-07-23**
**Status:** Design document. Not yet built. Extends Phase 25 (`bos/industry.ts` — the basic industry signal detector already shipped), composes Phase 14 (`net/`), Phase 17 (`mp/`), Phase 21 (`global/`), Phase 26 (`memory/`), Phase 27 Brains, Phase 29 Twin.

---

## Executive Summary

Phase 25 shipped a starter industry-signal detector. It reads passed-in observations (`bos/industry.ts::detectIndustrySignals`) and filters noise. Useful, but reactive. Phase 30 is the deliberate build-out: a full **Construction Market Intelligence Engine** that continuously observes the construction economy across four data streams — platform-native, public, subscribed, and merchant-contributed — and turns those observations into actionable recommendations per merchant per morning.

The user brief invokes "Bloomberg Terminal for construction." That framing is useful but a hazard. Bloomberg's power came from decades of exclusive data feeds bought at scale. Nex will not out-buy Bloomberg for global feeds. The realistic moat is a different one: **Nex owns platform-native data no one else has** — real quote-to-close ratios, real supplier on-time-pct, real labour productivity per trade × region, real regulation-compliance-drift, real homeowner intent signals. Layer public feeds on top and the composition becomes irreplaceable.

The strategic result is a merchant-facing product that answers *strategic* questions — "should I hire?", "should I expand to bathrooms?", "where should my next van be based?", "what will materials cost in Q3?" — with cited evidence rather than plausible-sounding numbers. And a wholesale product that other market participants (suppliers, insurers, standards bodies, local authorities, developers) pay to consume.

The privacy discipline from Phase 26 is the load-bearing constraint. Every cross-tenant aggregate goes through K≥5 gating, PII never leaks, region granularity stays at ONS-region / AU-state / IE-province. Without that, this phase becomes a liability. With it, this phase becomes the phase where Nex crosses from "SaaS for trades" into "market intelligence utility for construction."

---

## 1. Market Intelligence Architecture

### 1.1 The four-stream model

```
┌────────────────────────────────────────────────────────────────┐
│  Consumers                                                     │
│  · Merchant Market Advisor  · Regional dashboards              │
│  · Wholesale API            · Published indices                │
│  · Reports (PDF + CSV)      · Alerting                         │
└──────────────────────────────────┬─────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────┐
│  Prediction + Recommendation Engine (Phase 30 new)             │
│  · Signal fusion          · Forecast models                    │
│  · Cross-signal causation · Region-aware calibration           │
│  · Merchant advisor       · Confidence tagging                 │
└──────────────────────────────────┬─────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────┐
│  Signal Store (Phase 30 new)                                   │
│  Typed, dated, region-scoped, source-attributed observations   │
└─────────┬──────────┬──────────┬──────────┬─────────────────────┘
          │          │          │          │
    ┌─────▼───┐  ┌───▼────┐  ┌──▼─────┐  ┌─▼──────────────┐
    │Platform │  │Public  │  │Subscri-│  │Merchant-       │
    │Native   │  │Feeds   │  │bed     │  │Contributed     │
    │Data     │  │(gov,   │  │Feeds   │  │(memory rollups)│
    │(BI, MP, │  │weather,│  │(paid)  │  │                │
    │Est, PI, │  │econ)   │  │        │  │                │
    │CX, memry│  │        │  │        │  │                │
    │Twin)    │  │        │  │        │  │                │
    └─────────┘  └────────┘  └────────┘  └────────────────┘
```

### 1.2 The core discipline

Every signal that enters the Signal Store carries:

- `source_kind` — one of the four streams
- `source_id` — traceable back to the exact feed URL / merchant / rollup
- `region` — country + sub-region (ONS UK / AU state / IE province — never post-code for cross-tenant)
- `observed_at` — when the underlying event happened, not when we ingested it
- `confidence` — from the Phase 26 `computeConfidence()` scale
- `sample_size` — 1 for atomic observations; N for aggregates
- `decays_at` — every signal ages (Phase 26 rules)
- `visible_to` — same visibility scale as memory

Every derived recommendation carries a **chain of citations** to the underlying signals. No fabricated stats. Every merchant-visible number can be drilled into.

### 1.3 Signal fusion vs signal aggregation

Fusion (harder) — combining signals from different streams that point at the same thing. Example: gov planning applications for Manchester + SiteBook photo uploads from Manchester merchants + Trade Centre bathroom searches from Manchester homeowners → one demand signal.

Aggregation (easier) — rolling atomic observations into medians / percentiles at K≥5.

Phase 30 does both. Fusion is where the intelligence lives.

---

## 2. Data Sources

### 2.1 Platform-native (owned)

| Source                | Signal                                             | Feasibility          |
| --------------------- | -------------------------------------------------- | -------------------- |
| Trade Centre sales    | Actual homeowner spend by trade × region × month   | Already logged      |
| Marketplace demand    | Search terms + filter usage                        | Phase 17 MP          |
| Business Intelligence | Merchant quote-to-close ratios                     | Phase 5 BI          |
| Est engine outputs    | Priced-vs-region distribution                      | Phase 7 est         |
| Project deliveries    | Supplier on-time + defect                          | Phase 11 SC + Phase 26 memory |
| CX payment patterns   | Regional payment-days distribution                 | Phase 8 CX + memory |
| Memory rollups        | K≥5 aggregates across trades and regions           | Phase 26 memory     |
| Twin events           | Progression + snags + variations                   | Phase 29 Twin       |
| Studio activity       | Merchant onboarding + churn                         | Existing platform   |

This stream is the moat. It is the one no competitor has by default.

### 2.2 Public feeds (free / low cost)

| Source                                     | Signal                                | Ingest work                 |
| ------------------------------------------ | ------------------------------------- | --------------------------- |
| UK Planning Portal / Local Authorities     | Planning applications + permits       | Regional scrapers per LA    |
| UK Building Regs Approvals (LABC)          | Building Control notifications        | LABC data feeds             |
| UK Companies House                         | Merchant registrations + closures     | Already used (per memory)   |
| ONS / gov.uk statistics                    | Construction employment, housing starts | REST API                   |
| Land Registry                              | House prices, sale volumes           | Free feed                   |
| Met Office / OpenWeatherMap                | Weather + forecasts                    | Free API                    |
| Bank of England rates                      | Base rate + mortgage indices          | Free API                    |
| HMRC VAT registrations                     | Construction sector activity           | Free (with lag)             |
| IE / AU / US equivalents                   | Same signals, per country              | Extend Phase 21 global      |
| Trade associations (FMB, NHBC, RIBA, etc.) | Published industry reports (PDF)       | Parsed periodically         |

### 2.3 Subscribed feeds (paid)

Reserve budget for one or two high-signal feeds. Not "buy everything."

| Source                        | Signal                            | Value proposition                    |
| ----------------------------- | --------------------------------- | ------------------------------------ |
| Glenigan / Barbour ABI        | Pipeline projects + tenders       | Real forward-looking indicator       |
| Materials index (e.g. BEIS)   | Composite material price index    | Ground-truth for volatility signals  |
| Nationwide / Halifax HPI      | Regional house-price time series  | Renovation demand leading indicator  |

Start with none. Add only when Phase 30 V1 has proven merchant demand for the specific signal.

### 2.4 Merchant-contributed (opt-in)

Via Phase 26 Memory Engine's cross-tenant contribution. Merchants who opt in get free / reduced-cost benchmark reads; contributions are K-anonymised and roll up nightly.

### 2.5 What Phase 30 does NOT ingest

- Personal data of homeowners without explicit consent
- Merchant-confidential pricing without merchant opt-in
- Data from web scraping targets whose terms forbid it
- Voice-derived data from customer purchase surfaces (per platform rule)

---

## 3. Regional Construction Intelligence

### 3.1 The Regional Dashboard

Every region gets a live dashboard. "Region" is layered: country → sub-region (ONS / state / province) → city where consented. Never post-code for cross-tenant surfaces.

Ten tiles per region:

| Tile                     | Signal drivers                                                        |
| ------------------------ | --------------------------------------------------------------------- |
| Current demand           | Trade Centre searches + platform quote requests + planning applications |
| Fastest-growing trades   | 90-day trend of demand signals per trade × region                     |
| Material costs           | Rolled supplier prices from platform-native + published material index |
| Labour shortages         | Trade Brain-declared regional workforce rollup + gov employment data   |
| Average project values   | Est engine + BI booked-revenue rollup                                  |
| Supplier availability    | On-time-pct memory + lead-time rollups                                 |
| Seasonal opportunities   | 3-year seasonality patterns + weather forecast                          |
| Competition level        | Merchant density × active-quote-share                                  |
| Profit potential         | Regional margin-realised distribution per trade                        |
| Future forecast          | 90-day and 12-month forecast per top-signal trade                       |

### 3.2 Region examples

For each region the dashboard renders in the local vocabulary + currency + regulation set (Phase 21 global). Example regions to launch:

- London · Manchester · Birmingham · Cardiff · Belfast
- Sydney · Melbourne · Brisbane · Perth
- Dublin · Cork · Galway
- New York · San Francisco · Austin
- Auckland · Wellington
- Dubai (Emirate-level only — different data landscape)
- Jakarta · Singapore (V2+)

Launch scope is 5 UK regions + 2 IE + 2 AU. Broader rollout when the pattern proves.

### 3.3 Why regional matters more than country

Trade markets are regional, not national. UK average roofing-day-rate is a lie; London vs. Newcastle is not. Every merchant-facing metric goes at the smallest region for which K-anonymity permits — usually ONS statistical region for UK.

---

## 4. AI Prediction Engine

### 4.1 Forecasts we can honestly produce

Each of these has a signal chain we can trace. Where the chain is thin, confidence is `low` and the merchant sees it that way.

| Forecast              | Signal chain                                                                              | Horizon        |
| --------------------- | ----------------------------------------------------------------------------------------- | -------------- |
| Trade demand          | Trade Centre searches × planning applications × housing approvals × economic indicators   | 30d + 90d + 12m |
| Material shortages    | Supplier lead-time drift × sector activity × published material index                       | 30d + 90d      |
| Price increases       | Rolling supplier prices × published indices × economic macro (rates, FX)                    | 30d + 90d      |
| Labour shortages      | Trade Brain workforce rollup × gov employment stats × migration data                        | 90d + 12m      |
| Government spending   | Tender notices × published infrastructure pipeline                                          | 12m            |
| Housing booms         | Planning applications × house-price momentum × mortgage-rate direction                       | 90d + 12m      |
| Commercial development| Planning applications (commercial category) × sector-specific rents                          | 12m            |
| Renovation trends     | Land Registry sale volumes + Trade Centre searches × 3-month lag                             | 90d            |
| Technology adoption   | Trade Centre category-growth + planning-application feature-tagging                         | 12m            |

### 4.2 The prediction stack

Three layers, ordered from most to least trustworthy:

1. **Deterministic composition** — signal + memory + Brain rules → forecast. No ML. Used for anything customer-facing.
2. **Time-series statistics** — SARIMA / Prophet-style seasonality decomposition for well-sampled signals. Used only where sample size supports.
3. **ML models (V3+)** — gradient-boosted trees for signals with rich features. Never released until validated against out-of-sample deterministic baselines.

Do not start with ML. Deterministic is what the Bloomberg Terminal is: aggregation + tables + math. It is enough for V0-V2.

### 4.3 Predicting before it's obvious

Two mechanisms:

- **Leading indicators** — planning applications lead Building Control notifications by 6-12 weeks; Trade Centre searches lead quote requests by 2-4 weeks; homeowner SiteBook photos lead quote requests by 1-4 weeks. Phase 30 explicitly encodes these leads.
- **Cross-signal causation graph** — Phase 30 documents which signals move which others. Regulation change → material demand spike → material price move. Rate change → mortgage demand change → home renovation demand change 60-90 days later. When lead signals move, Nex forecasts the trail.

### 4.4 Confidence + calibration

Every forecast writes to memory. Every forecast's realized-vs-predicted delta is stored. Forecasts with poor track records get flagged internally and their confidence badge drops. The engine learns which classes it's honest at.

---

## 5. Material Intelligence

### 5.1 What's tracked per SKU × region

- Price history (from platform-native supplier prices + published material indices)
- Availability (lead time distribution from memory + supplier feeds)
- Supplier performance (on-time-pct + defect-rate + response-speed)
- Alternative products (Phase 27 Materials modules per Brain)
- Carbon footprint (manufacturer-declared where available; else null with honest gap)
- Manufacturer updates (product changes, spec revisions)
- Product recalls (subscribed feeds where available)
- Regional pricing distribution
- Seasonal demand pattern
- Market volatility index (rolling std-dev of price)

### 5.2 The Material Advisor per merchant

Every merchant gets a personalised advisor. Given the merchant's typical materials mix:

- What's rising in cost this month?
- What has a supply-risk flag?
- What alternates are their peers using?
- What should be stocked in advance?
- What can safely be ordered just-in-time?

Advice cites the underlying signal. "Prices for X moved +8% in your region over 30 days across 3 suppliers. Peer merchants have shifted to alternate Y."

### 5.3 What Nex uniquely adds

Beyond price tracking (that many competitors offer):

- **Substitution intelligence** — when X becomes expensive, which alternate do peers actually pick, and does the substitution correlate with lower snag rates? Requires Phase 27 + Phase 29 to work.
- **Delivery-time-to-price causation** — when supplier lead time drifts, price often follows. Nex measures this in memory.
- **Batch defect propagation** — when a Vision-fed Twin flags a batch defect, every merchant who bought from the same batch gets a low-severity notice.

None of these can be replicated by a pure price-tracking product because none of them own the platform-native data.

---

## 6. Labour Intelligence

### 6.1 What's tracked

- Trade shortages (from platform activity + gov employment data)
- Average wages (from platform-native pricing rollups + gov stats)
- Regional availability (workforce agent + trade Brain rollups)
- Apprenticeship pipeline (subscribed feeds + trade body reports)
- Skills demand (Trade Centre + planning-application skill-inference)
- Certification trends (CPD activity per Brain — Phase 27)
- Migration signals (gov stats + inter-region merchant movement)
- Subcontractor availability (per trade × region)
- Productivity index (memory rollup: hours / m² per trade × region)
- Business growth signals (merchant expansion patterns)

### 6.2 Labour Forecast per region

Twelve-month look-ahead per trade per region. Where confidence is thin, the forecast says so. Example output:

> "London plumbing labour: 12-month forecast points to modest tightening (+8% wage vs baseline). Confidence: medium. Drivers: mortgage-rate direction, gov infrastructure pipeline, aging demographic in your region. Regional apprenticeship intake down 4% YoY — supply-side pressure will compound."

Every phrase in that output is derived from a cited signal. Nothing is fabricated.

---

## 7. Project Opportunity Intelligence

### 7.1 Sources of leads

- Planning applications (public feed) — filter by scope + status + geography
- Tender notices (public + subscribed feeds)
- Government infrastructure pipelines (published)
- Commercial developments (planning + subscribed feeds)
- Housing estates (planning + Land Registry)
- Renewable energy (Ofgem / DESNZ published)
- Schools + hospitals (published capital programmes)
- Industrial developments (planning)
- Maintenance contracts (frameworks)
- Merchant-to-merchant referrals (Phase 14 net + memory)

### 7.2 Opportunity scoring

Each opportunity is scored per merchant:

- **Fit** — merchant's declared services × opportunity's scope keywords
- **Reachability** — travel time from merchant's base
- **Competition** — merchant density in the opportunity's category × region
- **Capacity** — merchant's declared bandwidth (from Twin utilisation signals)
- **Payment risk** — public-body vs private + region reputation

Merchants see the top-3 (per user rule "always return 3 unless overridden") ranked by composite score. Every score has explanation.

### 7.3 What's NOT here

- Cold-outreach automation. Nex does not send unsolicited messages; that is spam by another name and violates platform rules (Phase 15 AB approvals).
- Fake leads. Every lead cites a public source URL.

---

## 8. Business Growth Recommendations

### 8.1 The Growth Advisor

Every morning, alongside the Phase 25 BOS morning report, the merchant gets a Market Intelligence slice:

> **Today's market view:**
> · Roofing enquiries in your region ↑ 18% over 60 days. Two comparable local roofers have added a second van in the last 90 days.
> · Warehousing developments in Coventry expanding — 3 planning approvals since April.
> · Scaffolding demand forecast +12% next quarter based on planning-app rate.
> **Suggested action:** Increase advertising in your Bathroom category — quote-request growth is outpacing Kitchen for the second consecutive month.

Every phrase in the recommendation is a click into the underlying signal. Merchant can drill into "why does Nex think that?"

### 8.2 Recommendation classes

- **Timing** — when to raise prices, when to run promotions
- **Capacity** — when to hire, when to subcontract
- **Portfolio** — which trade to add or drop
- **Location** — where to base the next van; where to open a second location
- **Suppliers** — when to consolidate; when to diversify
- **Marketing** — which channels are proving out per region × trade
- **Pricing** — when the regional median moves and the merchant is drifting

Every class is evidence-anchored. No "you should hire because it feels like a good time." Always a signal citation.

---

## 9. Industry Benchmarking

### 9.1 What every merchant can compare

Same as Phase 26 memory blueprint's benchmarking list:

- Profit margins (Phase 10 FI)
- Quote acceptance (Phase 7 est + Phase 8 CX)
- Average project value (Phase 5 BI)
- Labour efficiency (hours per m²)
- Material waste
- Customer satisfaction (review score)
- Completion time
- Marketing performance
- Digital adoption (platform-feature usage)
- Cash flow (30 / 90 day nets)

### 9.2 Privacy-safe methodology

- K-anonymity K_MIN = 5 for any cross-tenant benchmark
- Regional granularity gate: ONS UK region / AU state / IE province
- No individual merchant identifiable from percentile ranking
- Opt-out: any merchant can prevent their data contributing without losing read access
- "Your data helped" transparency surface — merchant sees anonymised examples of what their contribution unlocked
- Right to be forgotten: merchant deletion cascades to memory including rollup regeneration

### 9.3 Percentile framing

Merchants never see the raw distribution. They see: "You are in the top quartile of your regional peer set for this metric. 6 merchants contributed to the peer set." Percentile framing preserves anonymity better than raw numbers.

### 9.4 The dishonest-metric guardrail

Some metrics have too much variance to be honest — e.g., customer satisfaction with a sample size of 4 reviews is noise, not signal. Phase 30 hides metrics where the merchant's own sample size or the peer set's sample size falls below the honesty threshold.

---

## 10. Integration Across Nex

| Nex module          | Contributes                                                    | Consumes                                                        |
| ------------------- | -------------------------------------------------------------- | --------------------------------------------------------------- |
| Trade Expert Brains | Trade rollups feeding regional labour + material intelligence  | Regional adjustment factors for their pricing / labour modules  |
| Memory Engine       | K≥5 rollups from every layer                                   | Signal store queries                                            |
| Knowledge Graph     | Adjacency edges informing cross-trade demand coupling          | New edges from observed regional patterns                        |
| AI Estimator        | Region-adjusted pricing signals                                 | Merchant-specific historical calibration                        |
| Digital Twin        | Per-project signals feed regional intelligence                 | Twin-scoped predictions from regional forecasts                 |
| CRM (Phase 8 cx)    | Customer payment patterns per region                            | Regional payment-risk score                                     |
| Trade Centre        | Homeowner search + spend data                                   | Category demand signals                                         |
| Marketplace (17 mp) | Search + filter data                                           | Supplier rankings updated by regional aggregate performance     |
| Finance (10 fi)     | Booked-revenue rollups                                          | Regional margin comparators                                     |
| Business Intelligence | Aggregated merchant KPIs                                     | Benchmark set                                                    |
| Marketing (bi social)| Post-performance per region                                    | Channel effectiveness benchmarks                                |
| Autonomous agents   | Auto-draft messaging tuned to regional peers                   | Timing signals for actions                                      |
| Studio              | Trend-informed content suggestions                              | Category demand for services page                                |

Every module contributes signals. Every module receives insight. The composition is the product.

---

## 11. AI Market Advisor

### 11.1 Strategic questions Nex can answer

Six question shapes, all cited:

| Question                                | How it's answered                                                                |
| --------------------------------------- | -------------------------------------------------------------------------------- |
| "What services should I offer next year?" | Fit(services × merchant profile) × forecast(demand growth) × margin distribution |
| "Should I employ another electrician?"    | Cash affordability (Phase 25 BOS) × forecast(regional demand) × merchant's pipeline density |
| "Should I open a second branch?"          | Regional density map × merchant's productivity ceiling × cash horizon             |
| "What machinery should I buy?"            | Merchant's job mix × plant utilisation rate × regional hire market                |
| "Where should I advertise?"               | Channel effectiveness peer benchmark × regional homeowner intent signals          |
| "Which suppliers should I use?"           | Ranked composite score (§5) × merchant's stock category                            |

### 11.2 The advisor's promise

Every answer:

- Cites the underlying signals
- Shows confidence
- Shows the sample sizes
- Names the tradeoffs
- Includes an explicit "here's what would change my recommendation" — the signals to watch

Never presents a recommendation as a single verdict. Always a considered position with evidence.

### 11.3 What the advisor won't do

- Guarantee outcomes
- Speak on behalf of external markets it doesn't have data for
- Replace a human advisor for capital-intensive decisions (opening a branch is a big decision; the advisor helps frame it, doesn't decide it)

---

## 12. Revenue Opportunities

### 12.1 Merchant-side tier ladder

Consistent with `src/lib/tierCatalog.ts`:

| Tier                     | Market Intelligence included                                     |
| ------------------------ | ---------------------------------------------------------------- |
| Free                     | Regional demand headline only. No forecasts.                     |
| Starter £9.99/mo         | + Own-trade regional signals · basic benchmarks                  |
| Professional £14.99/mo   | + Full regional dashboard · material advisor · labour forecasts  |
| Business £24.99/mo       | + Opportunity feed · advisor Q&A · monthly report                |
| The Works £39.99/mo      | + Multi-region view · alerting · API sandbox                     |

### 12.2 Add-ons (opt-in)

- Regional Market Report PDF — £4.99/mo (already introduced in Phase 26 blueprint)
- Supplier Intelligence pack — £9.99/mo
- Custom Benchmark Query — £4.99/query
- Weekly peer-diff digest — £9.99/mo
- Opportunity-detection accelerator (near-real-time planning-app alerting) — £14.99/mo

### 12.3 Wholesale side (paying consumers of Nex intelligence)

Where the biggest revenue is, once volumes justify:

- **Supplier subscriptions** — suppliers pay to see anonymised regional demand for their SKUs
- **Manufacturer intelligence** — manufacturers pay for regional adoption / defect / substitution signals for their product families
- **Developer analytics** — housebuilders + commercial developers pay for regional labour + material forecasts (their planning cycles are 18-36 months)
- **Government dashboards** — local authorities + national bodies pay for retrofit / decarbonisation / housing-programme aggregate data
- **Investment reports** — investors + PE firms pay for construction sector distribution reports
- **Insurance analytics** — insurers pay for anonymised project quality × claim rate data (Phase 29 Twin outcome data feeds here)
- **Published indices** — Nex Construction Cost Index, Nex Labour Availability Index, Nex Demand Signal Index — brand-building syndicated data
- **API licensing** — bespoke deals for market-participants who want raw signals into their own tools
- **White-label intelligence** — agencies, franchises, associations wrap Nex Market Intelligence under their brand

### 12.4 Sustainability

Wholesale revenue is where market intelligence pays for itself. Merchant tier adds are complementary but not primary. Discipline: the platform-native signal quality has to be world-class before any wholesale deal signs. Don't sell early. Don't sell hopeful.

---

## 13. Competitive Analysis

### 13.1 vs. IBISWorld / Gartner / market research firms

**Their strength:** structured industry reports; deep sectoral analysts.

**Their gap:** annual PDFs. Not real-time. Not merchant-scoped. Not integrated with the merchant's actual quote engine.

**Nex advantage:** every insight lands as an actionable slice in a merchant's morning brief. Reports become continuous rather than annual.

### 13.2 vs. Dodge Construction Network / Glenigan / ConstructConnect / Barbour ABI

**Their strength:** deep planning-application + tender data. Established sales channels to large contractors.

**Their gap:** they focus on the pipeline. They don't own the completion data (Phase 29 Twin), the material substitution data (Phase 26 memory), or the labour productivity data (Phase 27 Brains + memory).

**Nex advantage:** we cover the full lifecycle. Pipeline is one input to us; it's the entire product to them.

### 13.3 vs. Autodesk / Procore / ServiceTitan / Buildertrend

**Their strength:** deep workflow adoption in their segments.

**Their gap:** they don't do market intelligence at all. Their AI (if any) is workflow assistance, not market forecasting.

**Nex advantage:** they need a market intelligence layer eventually. We build it as a first-class citizen.

### 13.4 vs. Bloomberg Terminal

**Their strength:** decades of exclusive financial data feeds + terminal UX. Ubiquitous in finance.

**Their gap:** they don't do construction verticals. They index equities, not merchants.

**Nex advantage:** we go where Bloomberg won't. Vertical specificity beats horizontal breadth on a specific vertical.

### 13.5 vs. Google Trends

**Their strength:** search demand signal at global scale.

**Their gap:** search demand is one signal. It doesn't tell you material prices, labour rates, or supplier reliability.

**Nex advantage:** we own the follow-on funnel from search to quote to build to outcome. Google Trends can tell you people are searching for "loft conversion." Nex can tell you what those conversions actually cost, how long they take, and which suppliers deliver on time.

### 13.6 The moat

Three durable advantages:

1. **Composition depth.** Every prior phase feeds Phase 30. Copying Phase 30 requires copying Phases 5-29.
2. **Data uniqueness × time.** The platform-native data is uniquely ours from day one. Every year of merchant density compounds the moat.
3. **Vertical specificity beats horizontal generality.** No horizontal intelligence platform will out-specialise a vertical intelligence platform that has years of head start in that vertical.

---

## 14. Global Vision

Ten years in, if Phase 30 succeeds:

- Nex holds continuous signal on regional construction demand across UK, Ireland, Australia, US, New Zealand, UAE, and Canada
- Millions of merchants contribute; billions of atomic construction decisions have been observed and aggregated
- Material supply chains are visible in real time at a granularity gov statistics cannot match
- Labour movements between regions are trackable within 30 days of the underlying shift
- Regional construction indices published by Nex become referenced by trade press, government, and financial analysts
- Nex is the answer to "what is construction doing right now?" for the countries it serves
- Manufacturers plan production against Nex demand signals
- Insurers price against Nex quality signals
- Governments plan retrofit programmes against Nex aggregate data

This is a **civic-scale intelligence utility** — not just a SaaS product. The path from here to there requires: consent discipline, statistical honesty, and the composition depth of Phases 5-29 continuing to accumulate.

---

## 15. Final Strategic Assessment

### 15.1 Is this one of Nex's strongest moats?

Yes, but distinct from Phase 29. Phase 29 (Twin) is a moat by composition + time × per-project persistence. Phase 30 is a moat by **volume of signals across regions** × time. They compound each other: Twins feed Phase 30 signals; Phase 30 signals feed Twin predictions.

The two together are approximately unassailable at scale.

### 15.2 How does it increase retention?

Six months of Nex Market Intelligence tuned to a merchant is worth more than any competitor's cold intelligence. Merchants don't leave signals they use every morning to make decisions.

### 15.3 How does it improve every AI decision across Nex?

- Estimator uses regional pricing signals for better estimates
- Digital Twin uses forecast signals for prediction quality
- BOS advisor uses market intelligence for morning brief
- Trade Brains use adoption signals to prioritise Brain feature roadmap
- Autonomous agents use timing signals for when to act
- Business Intelligence uses regional peer sets for benchmarks

Every module gets sharper.

### 15.4 Does it move Nex beyond "construction software"?

Yes. Phase 29 is where the Twin makes Nex an "operating system for the built environment." Phase 30 is where the market intelligence layer makes Nex an "intelligence utility for the construction economy." Both together = category-redefining.

### 15.5 Breakthrough ideas that make this impossible to match

Beyond the core V0-V3 shape:

1. **Regulation-change causation index.** When a regulation moves, which materials + labour rates + demand patterns respond, and with what lag? Nex measures this. A public quarterly report becomes a citation source in trade press.
2. **Merchant-clustering demand map.** Not "trade demand by region" but "trade demand by *merchant peer cluster*." Two merchants of similar size and mix in similar regions face similar futures; cluster-level intelligence is more actionable than regional averages.
3. **Consent-first micro-forecasts.** Every merchant can share their own micro-forecast — "here's what I think will happen in my niche" — anonymised, aggregated. Wisdom-of-crowds signal that pure statistics don't capture.
4. **Cross-country compliance-drift detection.** Which regulations are ignored in practice? Where? Highly sensitive; potentially valuable to regulators; requires deep consent framework.
5. **Anti-fraud signal detection.** Because Nex owns quote-to-completion signal, patterns of quote-inflation or shell-project activity become visible. Insurance and public-body value here is substantial.
6. **Real-time policy simulation.** "If the government changes X grant, N merchants in regions Y qualify for £Z of new work." Sold to policymakers as a decision-support tool.

Each of these needs Phase 26 + 27 + 29 substrate + years of consent-first accumulation. Each is a defensible strategic asset in its own right.

---

## 16. Data Model

### 16.1 Tables (V0)

- `hammerex_nex_market_signals` — the signal store. One row per observation. Envelope inherits from Phase 26 memory + adds `source_kind`, `source_id`.
- `hammerex_nex_market_forecasts` — derived forecasts, one row per (subject, region, horizon, computed_at). Rebuildable.
- `hammerex_nex_market_ingest_feeds` — registry of external feeds + their last-ingest state + failure count.
- `hammerex_nex_market_wholesale_consumers` — API + report subscribers.

### 16.2 Crons

- Daily: public feeds ingest (planning, weather, gov stats, Land Registry)
- Weekly: subscribed feeds ingest (Glenigan-equivalents when in scope)
- Nightly: signal aggregation + forecast recomputation
- Weekly: wholesale reports generation + delivery
- Ad-hoc: alerting triggers on threshold events

---

## 17. Development Roadmap

- **V0 · signal store + platform-native + free public feeds + regional dashboard (5 regions)** — 12 weeks
- **V1 · material advisor + labour advisor + opportunity feed + benchmark suite** — 10 weeks after V0
- **V2 · AI market advisor Q&A + Twin prediction integration + monthly Market Report PDF** — 12 weeks after V1
- **V3 · wholesale API + supplier / manufacturer subscription products + published Nex indices** — 16 weeks after V2
- **V4 · advanced forecasting (ML-enhanced where honest), international expansion, breakthrough features from §15.5** — rolling

Nothing in V0-V2 requires ML. Everything can be deterministic composition + statistics. This keeps V0 shippable in 3 months and honest by design.

---

## 18. Risk Assessment

| Risk                                                                                | Severity | Mitigation                                                                       |
| ----------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------- |
| Overpromising Bloomberg-scale coverage while data is thin                            | High     | Confidence badges + honest "no signal" surface + only publish what's cited        |
| Fabrication temptation in forecasts                                                  | High     | Deterministic-first; every merchant-facing number links to signal chain           |
| Cross-tenant privacy breach through inference                                        | High     | K-anonymity + region granularity gate + differential privacy on high-risk metrics |
| Wholesale monetisation raises DPA / regulatory scrutiny                             | High     | Consent-first data-sharing agreements; opt-in with rev-share incentives            |
| Public-feed rate limiting                                                            | Medium   | Distributed scrape schedule + LA-friendly (respect robots.txt) + cache            |
| Public-feed schema drift                                                             | Medium   | Feed adapters with monitoring; alarms on ingest failure count                     |
| Forecast accuracy degrades over time without notice                                  | Medium   | Realised-vs-predicted delta tracking + auto-demote poorly-performing classes      |
| Merchant fatigue from too many recommendations                                       | Medium   | Rank + limit to top-3 per morning (per user rule)                                 |
| Wholesale customers demand exclusivity we cannot provide                             | Low      | Non-exclusive terms + tiered access                                              |
| Merchant coalitions opt-out en masse if trust breaks                                 | Critical | Everything hinges on the trust story; over-communicate; never surprise merchants |

---

## 19. Final Recommendation

Phase 30 is the phase where Nex converts platform-scale data into industry-scale value. Its economic ceiling is the highest of any phase — every category above (merchant tools, homeowner tools, Twins) generates ARPU per merchant; Phase 30 unlocks wholesale revenue that can rival the entire merchant side.

**Sequencing:** Phase 30 V0 requires Phase 26 rollups at V1 minimum, Phase 27 Brains for regional Brain rollups, and Phase 25 BOS `industry.ts` (already shipped) as the base. It can be built in parallel with Phase 29 Twin work; it does not block or get blocked by the Twin, though Twin outcomes make Phase 30 richer.

**Non-negotiables:**

1. Consent-first for every merchant-contribution flow
2. K-anonymity K≥5 for every cross-tenant surface
3. Every merchant-facing number cites its signal chain
4. Regional granularity gate ONS-region / AU-state / IE-province
5. No wholesale sale until platform-native signal quality is validated
6. Deterministic-first; ML only when a determinstic baseline exists to beat

**Recommended immediate steps:**

1. Ratify the wholesale data-sharing terms and consent UX as an ADR before shipping V0
2. Build the signal store + ingest for 3 free public feeds (planning applications one LA, weather, ONS)
3. Wire Phase 26 memory rollups into the signal store
4. Ship regional dashboard for 2 UK regions as proof-of-value
5. Only then propose wholesale conversations to prospective supplier / manufacturer / government subscribers

**Sequencing this correctly is what makes the moat real. Rushing it is what makes the moat leaky. Consent trust is a one-shot resource. Spend it deliberately.**

---

**End of Phase 30 blueprint.**

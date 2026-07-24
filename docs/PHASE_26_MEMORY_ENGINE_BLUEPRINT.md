# Phase 26 — Nex Construction Memory Engine

**Blueprint · 2026-07-23**
**Status:** Design document. Not yet built. Grounded in Phases 1–25 already shipped.

---

## Executive Summary

Phases 1–25 gave Nex two things:

1. **Understanding.** Forty specialist agents (Phase 24), predictive risk scoring, decision engine, digital twin simulations, region-aware regulations, morning intelligence report (Phase 25 BOS).
2. **Answers with evidence.** Every fact carries an Evidence chain and country-scoped confidence.

What Nex does not have yet is **permanence**. Every conversation starts cold. Every quote is priced against static heuristics. Every merchant's hard-won knowledge stays trapped in their own head. When merchant A discovers that a specific supplier delivers Wolseley MDPE 25mm at 8am reliably, merchant B in the same city has to learn the same thing the hard way.

Phase 26 fixes that. It adds a **seven-layer memory substrate** underneath the existing engines. Every observation the platform already produces (Phase 5 BI cash summaries, Phase 7 est costs, Phase 8 CX customer patterns, Phase 10 FI health scores, Phase 17 MP price observations, Phase 24 orch consultations) becomes a durable, retrievable, evidence-bearing memory. The memory is scoped by owner, gated by k-anonymity for cross-tenant reads, aged with confidence decay, and always attributable.

The strategic result is a **data network effect**. The 100th merchant on the platform gets a fundamentally better product than the 10th because collective memory (with consent, with k-anonymity) has learnt from 90 businesses worth of construction outcomes. The moat is not the algorithms — those are portable. The moat is the memory a merchant loses if they leave.

Phase 26 delivers the substrate. Phase 27+ will build on it (self-improvement, global scaling).

---

## 1. Memory Architecture

### 1.1 Seven layers

| Layer                | Owner scope       | Write cadence                       | Read scope                                              | Table (proposed)         |
| -------------------- | ----------------- | ----------------------------------- | ------------------------------------------------------- | ------------------------ |
| **User memory**      | one user          | Every session · manual + inferred   | Owner only                                              | `nex_memory_user`        |
| **Company memory**   | one merchant      | Every business event                | Owner + delegated staff                                 | `nex_memory_company`     |
| **Project memory**   | one project       | Every project-scoped event          | Project owner + assigned trades + homeowner (if shared) | `nex_memory_project`     |
| **Trade memory**     | one trade slug    | Nightly rollup                      | Anyone in that trade (K≥5)                              | `nex_memory_trade`       |
| **Regional memory**  | one region / city | Nightly rollup                      | Anyone operating in region (K≥5)                        | `nex_memory_region`      |
| **Industry memory**  | cross-trade       | Weekly rollup                       | Any paying subscriber                                   | `nex_memory_industry`    |
| **Market memory**    | supplier + spec   | Daily rollup                        | Any paying subscriber                                   | `nex_memory_market`      |

**Ownership + scope are enforced at the row level.** Every write records `owner_kind`, `owner_id`, `visible_to` (an enum: `owner_only` | `owner_and_delegates` | `trade_k5` | `region_k5` | `industry_paid` | `market_paid`). Reads are filtered by the same RLS pattern already used in `xp` (Phase 18) — k-anonymity gating already lives in `src/lib/nex/xp/anonymise.ts`.

### 1.2 Common row shape

Every memory row shares this envelope so the retrieval APIs stay uniform:

```
id                uuid PK
layer             text  (user | company | project | trade | region | industry | market)
owner_kind        text  (user | merchant | project | trade | region | industry | market)
owner_id          text
subject           text  ("supplier.wolseley.mdpe25mm.lead_time_days")
predicate         text  ("=" | ">" | "<" | "avg" | "median" | "p95" | ...)
value_json        jsonb  (typed by predicate)
unit              text | null  ("days" | "£/m2" | "%" | ...)
observed_at       timestamptz
window_start      timestamptz | null
window_end        timestamptz | null
sample_size       int         (1 for atomic; >1 for rollup)
confidence        text        ("low" | "medium" | "high")
is_official       bool
is_verified       bool        (dual-source verification passed)
visible_to        text        (owner_only | ... | market_paid)
source_engine     text        ("bi" | "fi" | "orch:regulations" | ...)
evidence_tables   text[]
computed_at       timestamptz
decays_at         timestamptz | null
correction_of     uuid | null (previous row this correction supersedes)
```

Every value in this table can be:

- **Read back with citation** — `retrieveMemory(subject, viewer)` returns the row + evidence chain
- **Updated by correction** — `correction_of` chains supersede prior rows (never destructive)
- **Decayed by time** — `decays_at` marks the row as stale; queries prefer non-decayed rows
- **Rolled up** — nightly cron aggregates atomic rows (user/company/project) into higher layers (trade/region/industry/market) once K-min is met

### 1.3 Cross-layer flow (the Australian kitchen example)

A builder in Sydney completes 50 kitchen renovations over 18 months. How does Nex learn?

1. **Every project** (Phase 6 PI) emits a project memory row on completion. Subjects: `project.duration_days`, `project.labour_hours`, `project.materials_pence`, `project.snags_count`, `project.customer_review_score`.
2. **Every quote** (Phase 7 est) emits a company memory row: `merchant.pricing.kitchen.total_pence_per_m2`.
3. **Every customer** (Phase 8 CX) emits a company memory row: `customer.payment_days_from_invoice`.
4. **Every supplier order** (Phase 11 SC) emits a company memory row: `supplier.wolseley.lead_time_days`, `supplier.wolseley.on_time_pct`.
5. **Nightly rollup cron** aggregates 50 project rows into a trade memory row **only when K≥5 merchants have contributed similar rows in the same region**. The trade row records:
   - `trade.kitchen.au.median_duration_days = 12`
   - `trade.kitchen.au.p50_labour_hours = 88`
   - `trade.kitchen.au.p50_materials_pct = 42`
   - `trade.kitchen.au.top_supplier = "Bunnings Trade"` (weighted by on-time delivery)
   - sample_size, confidence, decays_at (usually 6 months)
6. When another Sydney builder asks "how long does a kitchen usually take?", Nex reads:
   - **Their own** company memory first (if present) — highest fidelity
   - **Trade + regional** memory next — cross-tenant benchmark
   - **Explicit citation** in the reply: "Your last 8 kitchens: 11 days. Regional median across 5+ builders in Sydney: 12 days."

### 1.4 Why not just a big vector DB?

We already have `hammerex_knowledge_entries` with pgvector (Phase 4 knowledge engine). The memory engine is different:

- **Structured predicates** beat semantic search for numeric benchmarks
- **Row-level scoping** enforces owner/visibility rules simply
- **Correction chains** need deterministic supersession
- **K-anonymity** is a row-level check, not a vector-similarity check

Memory rows *may* also carry an embedding for semantic retrieval (e.g. "who has done a similar job?"), but the structured shape is primary. Vector search complements, doesn't replace.

---

## 2. Construction Knowledge Graph Integration

Phase 25 shipped a static seed graph in `src/lib/nex/bos/graph.ts` — eight trades with tools, materials, regulations, suppliers, skills, common problems, adjacent trades. Phase 26 turns that seed into a **living graph fed by memory writes**.

### 2.1 Edge kinds

```
Trade ─ requires ─▶ Skill
Trade ─ uses ─▶ Tool
Trade ─ consumes ─▶ Material
Material ─ sold_by ─▶ Supplier
Supplier ─ delivers_to ─▶ Region
Trade ─ regulated_by ─▶ Regulation
Regulation ─ scoped_to ─▶ Region
Project ─ instance_of ─▶ Trade
Project ─ uses ─▶ Material
Project ─ produces ─▶ Customer_review
Customer ─ pays ─▶ Merchant  (weight = median days)
Merchant ─ operates_in ─▶ Region
Trade ─ adjacent_to ─▶ Trade
```

Edges carry weights derived from memory. `Trade ─uses─▶ Tool` gets a frequency count. `Material ─sold_by─▶ Supplier` gets an on-time-pct weight. `Customer ─pays─▶ Merchant` gets a payment_days weight.

### 2.2 Why the seed matters

Cold-start problem: on day one, the graph is empty. The static seed (Phase 25) bootstraps enough structural knowledge that the first merchant sees a useful graph. As memory writes accumulate, seed edges get supplemented (never overwritten) with observed weights.

### 2.3 Why this is a moat

Three reasons a competitor cannot easily copy this:

1. **Every edge weight is earned, not scraped.** ServiceTitan's trade knowledge base is authored. Nex's edge weights are observed from real completed jobs. Authored knowledge is portable; observed knowledge is not.
2. **The graph is bidirectional and multi-trade.** Most vertical tools (Buildertrend, Procore) segregate by trade or project type. Nex crosses trades intentionally so plumbing insights inform HVAC, and roofing insights inform solar_pv.
3. **Regional weight decays cleanly.** A material-price signal in London decays over 90 days; the same signal in Perth might decay over 60 days. Weight-per-region-per-time is the shape competitors don't build because they don't have the cross-tenant substrate.

---

## 3. AI Learning System

### 3.1 What Nex learns automatically

**Auto-writable memory (no approval required):**

- Aggregate statistics with `sample_size >= K_MIN` (K_MIN = 5)
- Merchant's own atomic project/quote/supplier data (their own writes, their own reads)
- Time-based signals derived from platform-native events (payment days, quote-to-accept days, delivery lead times)
- Reconciled financial signals from `fi.buildFinancialSnapshot`

**Approval required:**

- Any statement of opinion or judgment ("this supplier is bad") — Nex will draft, merchant approves
- Any cross-tenant *personally identifying* fact ("customer Jane Smith at 42 Elm St paid late") — never rolled up cross-tenant
- Any regulation claim without an official source cite (Phase 21 global regulation cites are auto-writable; unofficial "advice" is not)
- Any statement the merchant may want to correct later (drafted as `is_verified = false` and requires a merchant confirm before flipping)

### 3.2 Privacy — five hard rules

1. **PII never crosses tenants.** Customer names, addresses, invoice numbers, review text stay in company or project layers. Only anonymised aggregates roll up.
2. **K-anonymity (K_MIN = 5) for cross-tenant reads.** Same as Phase 18 XP. Any rollup with fewer than 5 contributing merchants is not exposed.
3. **Region granularity gate.** Regional rollups happen at ONS UK region / AU state / IE province level, never post-code. Post-code granularity can be gamed to de-anonymise a single merchant.
4. **Merchant opt-out on cross-tenant contribution.** Every merchant can opt out of contributing to trade/regional/industry/market layers without losing access to READ those layers (net-buyer, not seller). This is a deliberate business decision: the network needs contributors, but coercion breaks trust.
5. **Explicit "your data helped" surface.** Merchants can see anonymised examples of where their data contributed. Transparency is the tradeoff for consent.

### 3.3 Preventing incorrect information

Four layers of protection:

1. **Confidence decay.** Every row has a `decays_at`. Old rows lose weight in retrieval unless re-verified.
2. **Dual-source verification.** A memory row flips from `is_verified = false` to `true` only after ≥2 independent merchants (or one merchant + one official source) confirm it.
3. **Conflict detection.** Reuse `orch/confidence.ts::detectConflicts` — when two memory rows on the same subject disagree, the reader gets both surfaced with reasoning. Never silent overwrite.
4. **Correction chain.** Corrections don't delete. They append with `correction_of = previous_id`. The retrieval API returns the newest un-superseded row. Full audit trail retained.

### 3.4 Confidence scoring

Every memory row's confidence is derived, not asserted:

| Signal                                                | Adjustment          |
| ----------------------------------------------------- | ------------------- |
| `sample_size >= 20`                                   | +1 tier (up to high) |
| `is_official` (from Phase 24 regulations family)      | +1 tier              |
| Dual-source verified                                  | +1 tier              |
| Not decayed (age < half of `decays_at` window)        | +1 tier              |
| Fresh conflict flagged                                | -1 tier              |
| Only one contributor + not official                   | -1 tier              |

Starting tier = `low`. Clamped to `low | medium | high` (matches existing `orch/confidence.ts` scale).

---

## 4. Real Business Examples

### 4.1 A small electrician business joins Nex

**Month 1** — Nex writes user memory (preferred day rate, van tools list, WhatsApp routing) and company memory (business name, region, trade). Cross-tenant reads: 0.

**Month 3** — 12 completed jobs. Project memory rows exist. Nex now knows this electrician's actual materials mix (Contactum consumer units, T&E ratio, average cable run per socket install), average job duration by scope, customer type mix (65% residential, 35% commercial), payment behaviour (median 21 days). "Ask Nex how long a socket install usually takes" returns 42 mins with sample = 12.

**Month 6** — Trade memory rollups now exist because there are ≥5 electricians in the region. "How does my day rate compare?" returns "regional median £320/day across 6 contributors. You're at £310. In-band." "Which consumer unit brand should I keep in the van?" returns "You use Contactum 63% of the time. The regional median is Wylex 41% / Contactum 38%. Neither dominates."

**Month 12** — Company memory is dense. 47 projects, 210 customers, 8 suppliers, 620 material lines. Nex now runs the electrician's morning briefing (Phase 25 BOS) with real signals: "Two overdue invoices, £1,200. Cash horizon covers this month. Marge Petersen quote is 21 days stale — soft nudge?"

### 4.2 A construction company completes 100 projects

Nex has enough signal to answer:

- "Which type of project earns us the most profit?" — margin_analysis by trade + scope, sample = 100
- "Which customers pay late?" — CX ranked by median payment days, own-tenant only
- "Which suppliers are actually the cheapest?" — supplier rollup normalising for delivery-time and defect rate, not just headline price
- "What mistakes do we repeat?" — snag_type frequency across projects, clustered by phase
- "Where does most of our time go per m²?" — labour_hours per m² by trade
- "What's our real gross margin by project type?" — realised profit not planned

Every answer carries citation of the underlying rows and a confidence badge. Every answer can be drilled into: "show me the 3 projects driving that number." Trust is engineered, not asserted.

### 4.3 A new tradesperson joins Nex

Collective intelligence kicks in on day one:

- **Regional pricing benchmark** — "Median day rate for plumbing in your region is £280 across 12 businesses"
- **Common material list** — "80% of plumbers in your region carry these 22 SKUs"
- **Common problems + fixes** — pulled from the trade memory layer, sourced from Phase 24 orch consultations that flagged repeated failure modes
- **Suggested suppliers** — top-ranked by regional on-time-pct, not lowest headline price
- **Regulation checklist** — Phase 21 global regulation cites scoped to their region
- **Customer expectation baseline** — "Homeowners in your region expect quote turnaround within 4 days"

The new merchant does not have to earn every insight from scratch. They inherit the platform's memory on their first day. Their contribution back begins when they complete their first job.

---

## 5. AI Memory Features

Core query verbs on top of the memory API:

| Ask                                                     | Layer(s) hit                          | Backing engine                                        |
| ------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------- |
| "How did we price similar jobs before?"                 | Company + Project                     | Phase 7 est + memory recall                           |
| "How does that compare to my region?"                   | Trade + Regional                      | Cross-tenant K-anonymised rollup                      |
| "Which customers usually pay late?"                     | Company only                          | Phase 8 CX + memory scan                              |
| "Which suppliers give me the best value?"               | Company + Trade                       | Phase 11 SC + market memory                           |
| "What mistakes do we repeat?"                           | Company                               | Snag clustering                                       |
| "What jobs make us the most profit?"                    | Company                               | Phase 10 FI margin_analysis                           |
| "Am I charging enough?"                                 | Company + Regional                    | Regional day-rate benchmark                           |
| "Who else has installed this exact boiler model?"       | Trade                                 | Product-linked project memory                         |
| "What's a fair completion time for this scope?"         | Company + Trade                       | Weighted median from project rollups                  |
| "Which regulations changed for me this week?"           | Regional + Industry                   | Diff over Phase 21 global regulation cites            |
| "What are homeowners searching for near me?"            | Regional                              | Anonymised MP search rollup                           |
| "Show me a builder who's done this kind of job well"    | Trade                                 | Referral graph over Phase 14 network + reviews        |
| "Why did that project overrun?"                         | Project                               | Timeline replay + Phase 25 BOS post-mortem            |

Every feature above is **grounded in memory rows**. No hallucination surface. Every reply carries evidence.

---

## 6. Business Value

### 6.1 User retention

Twelve months in, a merchant on Nex has thousands of memory rows that describe their business more truthfully than any spreadsheet they could rebuild. Leaving means abandoning:

- Their own quote-price history (Phase 7)
- Their customer payment patterns (Phase 8)
- Their supplier lead-time truths (Phase 11)
- Their morning briefing patterns (Phase 25 BOS)
- Their cross-tenant benchmark access (Trade + Regional)

Portable export must still be offered (data-portability rules require it), but a memory export is a JSON dump — it becomes a static artefact the moment it's downloaded. On Nex it stays live, learning, and layered into every conversation. That gap is the retention.

### 6.2 Subscription value

Memory maps cleanly onto the existing tier ladder in `src/lib/tierCatalog.ts`:

| Tier             | Memory access                                                                 |
| ---------------- | ----------------------------------------------------------------------------- |
| Free             | User + own Project memory (write + read own only). No trade/regional access.  |
| Starter £9.99    | + own Company memory queries · own history retrieval                          |
| Professional £14.99 | + Trade memory reads (K≥5) · own-trade benchmark                           |
| Business £24.99  | + Regional memory reads · pricing benchmarks · suggested-supplier reads       |
| The Works £39.99 | + Industry + Market memory · monthly benchmark PDF · "your data helped" trace |

The value ladder is honest: paying more unlocks broader read scope, never higher-quality reads on your own data. Free users still get truthful answers about their own business; they don't get free access to the collective substrate. This preserves the rule from ADR-0004 (free tier is a viral loop, not a loss leader).

### 6.3 Competitive advantage

Explained in section 9 in detail. Short version: the memory substrate is the only thing that gets *better* as more merchants join. Feature parity is one release away for any competitor. Memory density is years of contributors away.

### 6.4 Marketplace activity

Memory feeds directly back into the marketplace:

- Supplier memory drives the Phase 17 MP ranking (on-time-pct, price stability)
- Trade memory improves Phase 24 orch procurement agent's supplier recommendations
- Regional demand rollups make Phase 25 BOS growth suggestions region-specific

Every marketplace interaction that already happens now also feeds memory; every memory read now improves marketplace decisions. It's a closed loop.

### 6.5 Data network effects

The 100th merchant onboarding gets:

- Real regional day rate benchmark (not "typical UK £250-£350")
- Real supplier on-time-pct rankings for their post-code area
- Real regulation change alerts scoped to their trade
- Real "what does a good customer look like" median payment behaviour

The 10th merchant onboarded doesn't get those. The gap is the network effect. It's not linear either — read-quality scales with contributors squared once you start crossing trade × region axes.

---

## 7. Monetisation Strategy

Layered against the existing pricing structure. New revenue lines Phase 26 unlocks:

### 7.1 Existing tier lift

The tier value story from section 6.2. Users move up because higher tiers unlock better cross-tenant reads. Empirically this only lifts ARPU if the memory reads are actually good — that's an engineering ambition, not a marketing promise.

### 7.2 Premium AI intelligence packages

Optional add-ons, honestly priced under the Stripe-margin-safe rule (ADR-0010):

| Product                                | Monthly | What                                                                       |
| -------------------------------------- | ------- | -------------------------------------------------------------------------- |
| Regional Pricing Report                | £4.99   | Monthly PDF: day rates, materials index, quote-to-accept ratios, per trade |
| Supplier Intelligence                  | £9.99   | Weekly leaderboard: on-time-pct, defect rate, price stability, per region  |
| Custom Benchmark Query                 | £4.99/query | One-shot ask: "how does my margin compare to the regional top quartile?" |
| Weekly "your business vs. peers" digest | £9.99  | Anonymised diff report                                                    |

Everything is opt-in and unbundled. No mandatory data-sharing for report access; contributors get a discount, non-contributors pay full.

### 7.3 Enterprise construction intelligence

For large contractors, chain merchants, insurers, government infrastructure programmes:

- Regional trade capacity signal ("how many roofers in Manchester have open bandwidth in Q4?")
- Material price index API (region × spec × 90 days)
- Regulation change alert API (per country × trade × week)

Priced by API-call volume + a licensing floor. This tier requires legal review (aggregation of merchant data for third-party sale needs bulletproof consent). Section 3.2 covers the consent framework.

### 7.4 Supplier intelligence products (sold TO suppliers)

Suppliers pay to see:

- Anonymised demand signal for their SKUs by region
- Their on-time-pct rank vs. peers in the region
- Which merchants are most-likely-to-switch based on service score decay

This is the second-side of the network — the merchants and homeowners have been paying so far; suppliers become a third paying side. Guardrail: suppliers see aggregates, never individual merchant activity.

### 7.5 Industry reports

Quarterly published reports (free with brand attribution, paid for CSV/API):

- "State of UK Trades 2027" — anonymised aggregates on pricing, wait times, project mix
- Regional deep dives

These build the brand and become inbound-marketing artefacts. The reports themselves aren't the revenue line; they're the demand-generation engine for the paid tiers.

---

## 8. Implementation Roadmap

### V0 — MVP · 3–4 weeks

**Goal:** Memory substrate exists. Merchants can write, read their own data, ask basic recall questions. No cross-tenant reads yet.

**Scope:**

- Schema: `nex_memory_user`, `nex_memory_company`, `nex_memory_project` tables (three of seven layers)
- Write API: `writeMemory(row)` with RLS enforcement
- Read API: `retrieveMemory({ owner, subject, viewer })` with evidence + confidence attached
- Correction chain support
- Auto-writers wired into: Phase 6 PI project completion event, Phase 7 est quote-write event, Phase 8 CX payment event, Phase 10 FI daily snapshot
- Chat surface: "Ask Nex how did we price X last time?" retrieves prior est.buildEstimate outputs by scope similarity
- One migration file
- Vitest coverage: writer, reader, correction supersession, evidence attachment

**Explicit out-of-scope:**

- Cross-tenant reads
- Trade/regional/industry/market layers
- K-anonymity gating (not needed for V0 — owner-only reads)
- Rollup crons
- Vector embeddings on memory rows

### V1 — Cross-tenant substrate · 6 weeks after V0

**Goal:** Trade + regional memory work. Merchants can benchmark against anonymised peers.

**Scope:**

- Tables: `nex_memory_trade`, `nex_memory_region`
- Nightly rollup cron: reads atomic company/project rows, produces trade/region rollups, gates by K_MIN
- K-anonymity check reused from `src/lib/nex/xp/anonymise.ts`
- Read scope enforcement (paid tier gate)
- Chat surface: "How do I compare to my region?"
- Merchant opt-out mechanism (contribute vs. read-only)
- "Your data helped" transparency surface — anonymised examples

### V2 — Industry + market + verification · 8 weeks after V1

**Goal:** Industry-wide aggregates. Dual-source verification. Confidence decay live.

**Scope:**

- Tables: `nex_memory_industry`, `nex_memory_market`
- Weekly + daily rollup crons
- Dual-source verification pipeline
- Confidence decay: automatic re-scoring cron
- Conflict detection UI (uses `orch/confidence.ts`)
- Premium products: Regional Pricing Report, Supplier Intelligence, Custom Benchmark Query
- Stripe SKU wiring per ADR-0010

### V3 — Advanced · 12+ weeks after V2

**Goal:** Semantic memory recall, autonomous learning loops, third-side suppliers.

**Scope:**

- Vector embeddings on memory rows for semantic retrieval ("who else has done a similar job?")
- Autonomous learning: memory-writes trigger Phase 25 BOS growth suggestions
- Enterprise API for third-party licensing (rate-limited, JWT-authed)
- Supplier portal (second-side revenue)
- Industry report generation cron

### Technical requirements per version

| Requirement                    | V0        | V1        | V2         | V3          |
| ------------------------------ | --------- | --------- | ---------- | ----------- |
| Supabase migrations            | 1         | 1         | 2          | 2           |
| pg_cron jobs (rollup + decay)  | 0         | 2         | 4          | 6           |
| Vercel cron (verification)     | 0         | 0         | 1          | 2           |
| AI models                      | None new  | None new  | Embedding model (Voyage or OpenAI ada-3)  | Fine-tuned reranker |
| Third-party APIs               | None      | None      | Stripe SKU updates | Enterprise auth (JWT signing) |
| Development complexity         | Low       | Medium    | High       | High        |
| Legal/DPA review               | No        | Yes       | Yes        | Yes (third-party)  |

---

## 9. Competitor Analysis

Structural comparison — not performance benchmarking. Every claim below is about **product shape**, not fabricated market share.

### 9.1 ServiceTitan · $9B+ private construction/trades platform

**What it is:** Workflow OS for large service trades (HVAC, plumbing, electrical). CRM, dispatch, invoicing, marketing.

**What it lacks vs. Nex Phase 26:** Single-tenant. Every ServiceTitan customer's data stays theirs. There is no cross-tenant benchmark surface. When merchant A learns supplier X is late, merchant B has to learn it too.

**Why they don't do it:** Their customers are large ($1M+ ARR) enterprises who negotiate individual data-sharing terms. Aggregating across them is a legal and commercial minefield they've historically avoided. Their moat is workflow lock-in, not shared intelligence.

**Nex advantage:** Nex's smaller-merchant footprint means shared intelligence is a value delivered *back* to the merchant, not a compliance risk. Free/Starter tier merchants gain benchmark access their competitors could never offer them.

### 9.2 Procore · public construction ERP

**What it is:** Project + finance + safety software for large construction firms.

**What it lacks vs. Nex Phase 26:** Deep single-project focus. Cross-project intelligence exists in reporting; cross-firm intelligence does not. Procore Analytics is per-customer analytics on your own data.

**Why they don't do it:** Enterprise sales motion. Large GC customers explicitly do not want their pricing exposed to peers.

**Nex advantage:** Small merchants explicitly *do* want to know what the regional median day rate is. Different customer, different game.

### 9.3 Buildertrend · residential-builder tool

**What it is:** Project management, scheduling, client portal for small/mid residential builders.

**What it lacks vs. Nex Phase 26:** Buildertrend has some community features. It doesn't have a memory substrate feeding structured cross-tenant benchmarks. Community threads are opinion; memory rows are observations.

**Why they don't have it yet:** Feature focus has been workflow, not intelligence. Historically Buildertrend competes on ease-of-use. AI memory is a category shift, not a next-release feature.

**Nex advantage:** Nex's AI layer (25 phases) already produces the structured events the memory substrate needs. Buildertrend would need to build that first before it could benefit.

### 9.4 Monday.com · horizontal work OS

**What it is:** Configurable dashboards, workflows, project boards. Not construction-specific.

**What it lacks vs. Nex Phase 26:** No construction knowledge, no trade-scoped memory, no regulation cites, no supplier intelligence.

**Why they don't have it:** Horizontal by design. They'd need a construction vertical to justify the specialisation.

**Nex advantage:** Vertical depth. Phase 24 already ships a 40-agent construction workforce. Monday would need to buy that or build it.

### 9.5 Salesforce Construction Cloud

**What it is:** CRM adapted for construction sales.

**What it lacks vs. Nex Phase 26:** Sales-oriented. Not project-execution intelligence. No trade-craft memory (materials, tools, common problems).

**Why they don't have it:** Their DNA is sales pipeline, not project delivery. Building a memory substrate over sales-facing data misses the operational half of a construction business.

**Nex advantage:** Nex covers both sides (sales via Phase 8 CX + Phase 5 BI, delivery via Phases 6, 11, 12, 13). The memory substrate reads from both.

### 9.6 The uncopyable moat

Two structural features that make Phase 26 hard to replicate:

1. **Data density prerequisite.** The memory engine only produces good rollups once K≥5 merchants have contributed similar rows. A competitor starting today needs to acquire that first wave of contributors before their first rollup is legal to expose. Nex already has the wave (Phase 22 seed script, plus real merchants onboarding).
2. **Vertical-integrated event feed.** The rows arrive automatically from Phases 5-25 events. A competitor needs to build the equivalent event feed (25 phases of specialised construction AI) *before* the memory substrate has anything to eat. That's a multi-year path.

The moat isn't "we have AI" (portable) or "we have memory" (portable). It's "we have vertically-integrated construction AI producing memory rows for years before you shipped V1."

---

## 10. Final Strategic Assessment

### 10.1 Is Phase 26 a category-defining feature?

**Yes, conditionally.** It becomes category-defining if — and only if — three things are true:

1. **Merchants choose to contribute.** If everyone opts out of cross-tenant contribution, the substrate never fills and the moat never forms. Consent UX must be excellent. Section 3.2 is the gating spec.
2. **The reads are good.** If the K=5 benchmark says "median day rate £275" and the real median is £320, trust collapses. Statistical rigour (percentile ranges, sample sizes surfaced, decay honesty) is not optional.
3. **The privacy story holds under adversarial scrutiny.** Any single-merchant de-anonymisation event ruins the substrate. K-anonymity + regional granularity + no PII crossing tenants must be enforced at the query layer, not the UI layer.

If those three hold, Phase 26 is genuinely category-defining. If any one wobbles, it becomes a good-but-not-moat feature.

### 10.2 Does it strengthen "The AI OS for Construction"?

Directly and specifically. The OS metaphor implies persistence, learning, cross-app coherence. Without Phase 26, Nex is 25 impressive engines that forget. With it, Nex remembers, learns, and layers accumulated intelligence into every future conversation.

### 10.3 What would make it more revolutionary

Four upgrades that are out of scope for the V0-V3 roadmap but worth flagging for Phase 27+:

1. **Homeowner memory contribution.** SiteBook already exists (per memory notes). Homeowners are a second source of ground truth (job durations, defect experience, warranty claims). Two-sided memory contribution roughly doubles the substrate quality.
2. **Cross-region calibration.** A plumbing insight in the UK should probabilistically inform a plumbing question in Ireland. Right now regions are siloed. A calibrated transfer-learning model over regions unlocks day-one insight for merchants in low-density regions.
3. **Reverse regulation feed.** Nex writes memory. Nex should also *close the loop* by feeding anonymised patterns back to regulators, insurers, and standards bodies. This turns Nex from a memory consumer into an intelligence supplier of last resort. Big revenue line, big regulatory upside.
4. **Merchant-controlled memory shares.** A merchant chooses to share their pricing memory with a specific subcontractor. Selective sharing at the row level unlocks B2B trust models Nex could later monetise.

### 10.4 Recommended next steps

1. **Ratify Section 3.2 privacy rules as an ADR** before writing code. Trust is set on paper first.
2. **Write the V0 migration + writer + reader.** Ship inside 4 weeks. Do not gold-plate. V0 must prove the substrate works with real merchant data before we invest in cross-tenant.
3. **Wire Phase 6 PI + Phase 7 est + Phase 8 CX + Phase 10 FI events into the writer during V0.** Every event that already exists must produce a memory row from day one. Retroactive backfill is easier if the writer exists first.
4. **Run V0 in shadow mode for 2 weeks.** Write memory, don't yet expose reads to the merchant. Let the substrate accumulate a real corpus before UX judgement.
5. **Merchant advisory panel review before V1 goes live.** Pick 5 pilot merchants. Show them what memory rows have been written from their business. Confirm nothing surprises or offends. Adjust.
6. **Legal review before V1 goes live.** Cross-tenant aggregation touches DPA / GDPR / AU Privacy Act. Do this once, do it properly.
7. **Do not build V3 features (semantic recall, third-party APIs) until V2 is measurably valuable to merchants.** Measure retention lift and query volume against the memory features before scaling up.

---

## Appendix A · Schema summary

Full column list per table in Section 1.2. All memory tables share the same envelope. Row Level Security policies enforce owner + visible_to rules.

## Appendix B · Integration surface with existing engines

| Engine (phase) | Writes to memory                                                    | Reads from memory                                          |
| -------------- | ------------------------------------------------------------------- | ---------------------------------------------------------- |
| BI (5)         | Revenue snapshots, social post outcomes                             | Prior campaign performance                                 |
| PI (6)         | Project completion, snags, review scores                            | "Similar project" retrieval                                |
| est (7)        | Every quote generated (scope + total)                               | Prior pricing on similar scope                             |
| CX (8)         | Customer payment behaviour, review scores                           | Customer risk scoring                                      |
| MD (9)         | Workforce utilisation stats                                         | Hiring benchmarks                                          |
| FI (10)        | Daily health scores, VAT windows                                    | Regional margin comparators                                |
| SC (11)        | Supplier lead times, on-time-pct, delivery outcomes                 | Supplier ranking                                           |
| PM (12)        | Project timeline variance                                           | Realistic scheduling benchmarks                            |
| CV (13)        | Vision analysis outcomes                                            | Prior defect patterns                                      |
| NET (14)       | Referral graph edges                                                | Trust benchmarking                                         |
| AB (15)        | Approval decisions (accepted / declined)                            | Autonomy calibration                                       |
| CC (16)        | Property state changes                                              | Property history                                           |
| MP (17)        | Search queries, listing performance                                 | Demand signals                                             |
| XP (18)        | Experience benchmarks                                               | (already reads memory in spirit)                           |
| orch (19, 24)  | Agent consultations, conflict outcomes                              | Agent confidence memory                                    |
| world (20)     | Region-scoped observations                                          | Regional dispatch                                          |
| global (21)    | Country-scoped regulation cites                                     | Country dispatch                                           |
| ops (22)       | Morning briefing salience data                                      | Personalisation                                            |
| twin (23)      | Scenario outcomes (when merchant acts on a simulation)              | Prior scenario accuracy                                    |
| bos (25)       | Risk-signal outcomes (did the predicted risk actually manifest?)    | Prior risk calibration                                     |

Every phase already produces the events. Phase 26 is the substrate that catches them.

## Appendix C · Explicit non-goals

To keep the phase disciplined:

- **Not** replacing the knowledge engine (`hammerex_knowledge_entries` + pgvector). Memory is structured; knowledge is semantic. They cite each other.
- **Not** replacing the digital twin (Phase 23). Twin simulates hypotheticals; memory records actuals. Twin can read memory for baselines.
- **Not** building a chat UI change. All memory reads happen through existing chat + engine surfaces. The substrate is invisible to the merchant until the reply gets better.
- **Not** an ML model. Phase 26 is deterministic aggregation + retrieval. AI models come in V3 (embeddings for semantic recall).

---

**End of blueprint.**

Prepared 2026-07-23. Every fact in this document either references a shipped phase in `src/lib/nex/` or is labelled as design speculation. No fabricated stats. No hallucinated competitor claims. Any inaccuracy is a design bug to be corrected before code is written.

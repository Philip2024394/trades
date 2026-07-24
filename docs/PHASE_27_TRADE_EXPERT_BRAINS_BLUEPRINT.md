# Phase 27 — Nex Trade Expert Brains

**Blueprint · 2026-07-23**
**Status:** Design document. Not yet built. Extends Phase 24 (`src/lib/nex/orch/`, the 40-agent multi-agent mesh) and Phase 26 (`src/lib/nex/memory/`, the memory substrate).

---

## Executive Summary

Phase 24 shipped forty specialist agents behind the Nex mesh, including a "trades" family (`timber`, `steel`, `concrete`, `masonry`, `roofing`, `plumbing`, `electrical`, `hvac`, `renewable_energy`, `heat_pump`) — see `src/lib/nex/orch/catalog.ts`. Each of those agents today is a thin knowledge-backed stub: it retrieves knowledge-entry hits, formats them, and hands them to the mesh voice unifier. That's enough to consult, not enough to *be* the trade.

Phase 27 upgrades every trade agent from a stub into a **Trade Expert Brain**: a deep, structured, region-aware, learning knowledge model that thinks like a 30-year master tradesperson. Every Brain has its own vocabulary, workflow, regulation graph, materials library, tools, pricing intuition, defect library, and business voice. Every Brain writes into and reads from the Phase 26 Memory Engine, so it gets smarter with every project.

The strategic result is that Nex stops being a general construction AI and becomes an **assembly of master specialists that happen to share a face**. When a plumber asks about airlocks, the Plumber Brain answers with correct terminology, correct diagnostic sequence, and correct regulatory citation for the merchant's region. When an electrician asks about consumer-unit sizing, the Electrician Brain hands back a 18th-Edition-aware answer. Neither ever sees the other's internals; both are stitched into one Nex reply by the existing mesh.

The moat is not the number of brains. It's the fact that each brain compounds by owning a slice of memory. A competitor could ship 500 stub agents in a week. Shipping 500 brains that have each read 10,000 real completed projects takes years.

---

## 1. Overall Architecture

### 1.1 Three concentric layers

```
┌───────────────────────────────────────────────────────────────┐
│  Global Nex Brain                                             │
│  · Voice + tone + safety rails (orch/voice.ts)                │
│  · Confidence rollup + conflict resolution (orch/confidence)  │
│  · Ensemble planner (orch/planner.ts) + mesh (orch/mesh.ts)   │
│  · Regional intelligence (world/, global/) + memory (memory/) │
└─────────────────────────────────────────┬─────────────────────┘
                                          │ contract via
                                          │ Agent + AgentResult
                                          ▼
┌───────────────────────────────────────────────────────────────┐
│  Trade Expert Brains  (Phase 27 — this document)              │
│  For each trade: 10 modules                                   │
│  ┌──────────────┬───────────────┬────────────────────────┐    │
│  │ Craft        │ Regs graph    │ Materials library      │    │
│  │ Tools + PPE  │ Pricing model │ Defect library         │    │
│  │ Workflow     │ Business tone │ Sub-specialisations    │    │
│  └──────────────┴───────────────┴────────────────────────┘    │
└─────────────────────────────────────────┬─────────────────────┘
                                          │ evidence-typed
                                          │ writes + reads
                                          ▼
┌───────────────────────────────────────────────────────────────┐
│  Memory Engine (Phase 26)                                     │
│  · Per-merchant company memory                                │
│  · Per-project project memory                                 │
│  · Cross-tenant trade + region rollups (from V1 forward)      │
└───────────────────────────────────────────────────────────────┘
```

### 1.2 Contract with the global brain

Every Trade Brain still implements the Phase 24 `Agent` contract in `src/lib/nex/orch/types.ts`:

```typescript
export type Agent = {
  id, name, role, speciality, category,
  permissions, version, tools,
  country_support, expertise_keywords, boundaries,
  invoke: (ctx: AgentInvocationContext) => Promise<AgentResult>;
};
```

**Nothing about the mesh has to change.** Phase 27 rebuilds the *inside* of `invoke()` for each trade. The mesh keeps orchestrating, voicing, and resolving conflicts.

### 1.3 What lives inside every Brain (the 10 modules)

Every Brain declares these ten modules. Modules are optional — a new trade can ship with three and grow. The mesh treats any missing module as "no evidence" rather than a hallucination surface.

| Module              | Contract                                                       | Backed by                                        |
| ------------------- | -------------------------------------------------------------- | ------------------------------------------------ |
| **Craft**           | Core techniques, sequence, terminology                          | `hammerex_nex_knowledge_entries` + memory rollups |
| **Regulations**     | Region-scoped citations (Phase 21 global regs)                  | `world/region.ts` + `global/`                     |
| **Materials**       | Species, grades, pack sizes, defect risk per SKU                | Structured trade material tables                 |
| **Tools + PPE**     | Kit list per scope, safety kit                                  | Static seed + merchant-taught extensions          |
| **Workflow**        | The standard sequence for common jobs                           | Trade-authored playbooks                          |
| **Defect library**  | Common faults, causes, fixes                                    | Memory rollups from `snags.count` observations   |
| **Pricing model**   | Trade-specific unit rates + regional multipliers                | Phase 7 `est/` + Phase 26 memory (`pricing.*.total_pence`) |
| **Business tone**   | How a master tradesperson from that trade speaks               | Voice pack                                        |
| **Sub-specialisations** | Domestic / commercial / industrial / heritage etc.          | Enum + module overrides                           |
| **Regional variants** | Local vocabulary, local suppliers, climate rules              | `world/region.ts` overrides                       |

### 1.4 Regional split

A trade Brain in `en-GB` differs from the same trade in `en-AU`, `en-IE`, or `en-US` on at least these axes:

- Regulation citations (Approved Documents UK / TGDs IE / NCC AU / IBC US)
- Vocabulary (drywall / plasterboard / gib board — already handled by Phase 24 translation agent)
- Materials (cavity wall UK; brick veneer AU)
- Weather assumptions (frost cycle north UK; humidity Queensland)
- Supplier network

Phase 27's regional split reuses `src/lib/nex/world/region.ts` and `src/lib/nex/global/answer.ts` (Phase 21). Each Brain declares a `RegionalOverride` map. If no override is declared for a country, the Brain returns "no regional expertise on file" rather than guessing.

### 1.5 How updates propagate

Three propagation paths, each with different velocity and trust:

1. **Regulation update (fast, official)** — Phase 21 already retrieves + caches official regulation cites. When a new one arrives (e.g., new Part L revision), the Regulations module rebuilds its citation set on the next request. No merchant approval needed because the source is official.
2. **Craft/defect update (slow, verified)** — Memory rows with `sample_size >= K_MIN` roll up into the trade layer nightly. Craft advice inherited from a rollup is tagged `verified_source: aggregate`. A merchant can see it, use it, and correct it — the correction lives on their own company row without polluting the trade rollup.
3. **Manufacturer/product update (opt-in, paid)** — Manufacturer partners can push structured product data (from Phase 28's monetisation model — see that blueprint). The Brain surfaces this data with an "official manufacturer note" evidence tag. Merchants can accept, reject, or corrections stay merchant-local.

### 1.6 Cross-trade learning

A discovery in one Brain sometimes applies to another. Two examples:

- **Roofing → Solar PV**: rafter spacing patterns learned by Roofing predict mounting complexity for Solar PV.
- **Heating → Heat Pump**: buffer-tank sizing intuition from Heating informs Heat Pump COP conversations.

Cross-trade learning happens via **adjacency edges** on the knowledge graph (`src/lib/nex/bos/graph.ts`). Every trade node declares `adjacent_trades`. The mesh planner (`orch/planner.ts`) can invoke an adjacent Brain when the primary Brain's confidence is below `medium`. The adjacent Brain contributes as a specialist, not a substitute — its output is tagged so the merchant knows it's a bridge, not the primary source.

---

## 2. Trade Knowledge Structure

### 2.1 Worked example: Electrician Brain

Following the user brief, every Brain is structured as an internal knowledge tree. The Electrician Brain's tree:

```
electrician/
├── domain
│   ├── domestic/
│   │   ├── consumer_units      (ring/radial, RCBOs, MCBs, DP sensors)
│   │   ├── lighting            (single-way, two-way, dimmer compat, MR16 rules)
│   │   ├── sockets             (BS 1363, ring main topology, spurs)
│   │   ├── smoke_alarms        (BS 5839-6 grade + category)
│   │   └── bathroom_zones      (Zone 0/1/2 IP ratings)
│   ├── commercial/
│   │   ├── three_phase         (star/delta, load balancing)
│   │   ├── emergency_lighting  (BS 5266)
│   │   └── fire_alarm          (BS 5839-1)
│   ├── industrial/
│   │   ├── motor_control       (DOL, star-delta, VFD)
│   │   ├── PLCs                (ladder logic vocabulary)
│   │   └── explosion_zones     (ATEX, DSEAR)
│   └── modern/
│       ├── solar_pv            (DC isolators, string sizing, G98/G99)
│       ├── ev_charging         (Mode 3, OZEV grant flow)
│       ├── battery_storage     (fire zoning, thermal runaway rules)
│       └── smart_homes         (KNX, Loxone, Home Assistant patterns)
├── testing_and_inspection      (EICR, PIR, initial verification)
├── fault_finding               (diagnostic sequence patterns)
├── load_calculations           (max demand, diversity factors)
├── regulations                 (BS 7671:2022 A2, Part P, EAWR 1989)
├── safety                      (LOTO, permit-to-work, live-work rules)
├── certification               (NIC, ELECSA, NAPIT, Stroma)
├── tools                       (Fluke 1663 vs Kewtech KT65DL etc.)
├── materials                   (T&E vs XLPE, tri-rated, SWA)
├── pricing_model               (day rate + per-point + testing packs)
├── customer_advice             (what to explain to homeowners)
└── business_growth             (moving into commercial, adding EV)
```

### 2.2 The generalized schema

Every trade uses the same nine top-level headings. This is deliberate — it's what makes the architecture scalable to 500+ trades without bespoke code per trade.

```
<trade>/
  ├── domain/            <- sub-specialisations (domestic, commercial, ...)
  ├── testing/           <- inspection + testing routines
  ├── fault_finding/     <- diagnostic decision trees
  ├── calculations/      <- trade-specific engineering maths
  ├── regulations/       <- region-scoped official cites
  ├── safety/            <- PPE, LOTO, working-at-height, permits
  ├── certification/     <- pathway + regulatory bodies
  ├── tools_and_materials/ <- gear + spec-grade lookup
  ├── pricing_and_business/ <- rates + growth playbook
  └── customer_communication/ <- tone + explaining the invisible
```

Every leaf is either a **fact** (regulation cite, standard rate, spec number) or a **playbook** (decision tree, sequence, checklist). Facts carry evidence chains. Playbooks carry version + author (usually the trade itself, either static seed or memory-derived).

### 2.3 Why this scales to 500+ trades

Adding a new trade equals:

1. One new spec in `src/lib/nex/orch/catalog.ts` (already the pattern for Phase 24)
2. One knowledge-tree JSON (see Section 10 for storage)
3. Optional: regional variant overrides
4. Zero code changes to the mesh, voice, or memory layers

The 40-agent Phase 24 catalog is the proof the pattern holds at low scale. Phase 27 extends the same pattern to depth-per-trade + volume.

---

## 3. AI Behaviour

### 3.1 Terminology

Every Brain has a **vocabulary layer** — the words the trade actually uses, sorted by region.

- Plumber Brain UK: "compression fitting", "cistern", "combi", "wet room"
- Plumber Brain US: "compression coupling", "toilet tank", "combi boiler is rare", "wet room is called a tiled shower"

The vocabulary is not decoration. When the Brain reads the merchant's ask, the terminology layer pattern-matches trade-specific words so the ask routes to the right specialist even when the mesh planner would be ambiguous.

### 3.2 Sequence

Every trade has canonical sequences. A Plumber Brain diagnosing a leak follows:

1. **Isolate** — where's the stopcock? Any local isolator?
2. **Identify** — pipe material (copper, PEX, MDPE, LLDPE), joint type, age
3. **Assess** — visible or hidden, pressurised or gravity, hot or cold
4. **Fix** — chosen technique (repair coupler, section replacement, resolder)
5. **Test** — pressure hold, visible dry
6. **Certify** — G3 unvented notification, water bylaws compliance if applicable

The Roofer Brain does not use that sequence. It uses:

1. **Access** — safe scaffold, harness, or MEWP
2. **Diagnose** — nail sickness, tile slip, valley failure, flashing pull
3. **Weatherproof** — temporary cover if job is multi-day
4. **Repair** — like-for-like or upgrade
5. **Water-test** — hose or wait-for-rain
6. **Warranty** — record photos + BS 5534 compliance note

Each Brain's sequence lives in a structured JSON. The mesh formatter (`orch/voice.ts`) can render sequences as ordered lists without adding language — the sequence is the answer.

### 3.3 Reasoning + risk

Trade-specific reasoning ships as **weighted risk rules**. A rule is `(if condition, then risk, mitigation)`. A few examples per trade:

- Roofer: `if pitch < 22° and using slate → risk: capillary; mitigate: increase headlap by 15mm`
- Electrician: `if outbuilding + underground SWA → risk: earth path; mitigate: separate TT with driven rod + RCD`
- Plumber: `if unvented hot water > 15L → risk: G3 compliance; mitigate: G3 approved installer + Building Control notify`

Rules are readable, testable, and correctable. When a merchant corrects a rule outcome, it's logged as a memory correction (Phase 26) and the mesh's confidence engine can later re-weight the rule.

### 3.4 Estimating hooks

Each Brain owns a **pricing_model** module — trade-specific unit rates. Phase 28's Estimator Engine invokes the relevant Brain's pricing model. The Estimator does NOT re-estimate — it delegates trade-specific pricing to the trade Brain, then composes. This preserves the Phase 27 boundary: Brains own the truth; the Estimator composes.

### 3.5 Trade-native troubleshooting

Every Brain ships a **fault_finding** decision tree in structured JSON. Example (Electrician, RCD tripping):

```json
{
  "root": "RCD tripping",
  "branches": [
    { "test": "Does it trip immediately at power-on?", "yes": "cable_short", "no": "load_test" },
    { "test": "load_test: unplug all appliances, reset. Does it hold?", "yes": "faulty_appliance", "no": "circuit_earth_leak" },
    { "test": "circuit_earth_leak: split ring at joint. Does the fault follow one leg?", "yes": "leg_fault_location", "no": "shared_neutral" }
  ]
}
```

The mesh can walk the tree in a conversation (each branch is one clarifying question). The Brain never guesses at the merchant's answer. This is high-trust because every leaf is authored by trade expertise, not generated on the fly.

---

## 4. Multi-Trade Collaboration

Phase 24 already assembles multi-agent teams. Phase 27 makes those teams composed of *master* specialists rather than *stub* specialists.

### 4.1 House extension worked example

Merchant ask: "I'm quoting a rear extension in Cardiff. 4m × 5m, single-storey, glazed rear elevation, existing kitchen relocated."

Mesh planner routes to eleven brains in parallel where independent, sequential where dependent:

**Level 0 (parallel):**
- Planning Brain → PD rules for extension in Cardiff (Wales specific)
- Building Control Brain → notify triggers for size + structural work
- Structural Brain → beam + foundation risk indicators
- Heritage Brain → conservation area check for the postcode

**Level 1 (needs level 0):**
- Groundworker Brain → foundation depth given soil + tree proximity
- Bricklayer Brain → cavity spec + wall tie schedule
- Carpenter Brain → joist + rafter schedule (parallel with above)
- Roofer Brain → tie-in detail with existing roof

**Level 2 (needs level 1):**
- Electrician Brain → circuit additions given kitchen relocation
- Plumber Brain → hot/cold + waste re-routing
- Plasterer Brain → area + finish grade

Each Brain's contribution is confidence-scored. The mesh voice unifier composes one Nex-voiced reply. The homeowner sees one answer; behind it, eleven master tradespeople contributed.

### 4.2 Sequencing intelligence

Multi-trade projects have a trade sequence: groundwork → bricklayer → carpenter → roofer → plumber first fix → electrician first fix → plasterer → tiler → carpenter second fix → electrician second fix → decorator. Each trade brain declares which trades depend on it (`depends_on`) and which it depends on (`waits_for`). The mesh assembles a dependency graph and the Scheduling Agent (Phase 24) reads it to build a Gantt.

### 4.3 Conflict resolution

When two Brains disagree, Phase 24's existing conflict detection kicks in (`orch/confidence.ts::detectConflicts`). Trade Brain conflicts are usually a good sign — the specialist Building Control cite outweighs the generalist Craft advice. Resolution priorities:

1. Official > craft
2. Higher region-support > lower
3. Higher sample_size (from memory) > lower
4. Tie: surface both, let the merchant decide

---

## 5. Learning System

### 5.1 Auto-learnable per Brain

Every Brain receives structured learning events from Phase 26 memory:

- **Completed projects** → `duration.days`, `labour.hours`, `materials.total_pence`, `snags.count` per project. Rolled up nightly at K≥5 into trade layer.
- **Successful quotations** → `pricing.<trade>.total_pence` rows written by Phase 7 est
- **Customer reviews** → `review.score` rolled into satisfaction weights
- **Installation photos** → Phase 13 CV extracts observable defects; adds to defect library on merchant approval
- **Common defects** → `snags.<type>.frequency` — the Defect Library's most-actionable signal
- **Supplier performance** → `supplier.<slug>.on_time_pct`, `supplier.<slug>.defect_rate`
- **Warranty claims** → merchant-tagged; sensitive so stays merchant-local unless K≥5 warranty rows converge on the same cause
- **Regional methods** → geographic distribution of technique choices per subject
- **New products** → SKU appearance in `mp.searches` + manufacturer feeds
- **New regulations** → Phase 21 regulation-diff cron flags changed cites

### 5.2 Approval-required per Brain

- Any change to a Brain's authored playbook (adding a new sequence step, changing a defect fix)
- Any addition to the regulation citation set that isn't an official cite
- Any statement of opinion about a supplier or manufacturer

Merchant corrections are always accepted and stored as their own memory (never destroyed). Cross-tenant impact requires K-anonymity threshold.

### 5.3 Privacy

Same five hard rules from the Phase 26 blueprint apply:

1. PII never crosses tenants
2. K_MIN = 5 for cross-tenant reads
3. Region granularity gate (ONS UK region / AU state / IE province)
4. Merchant opt-out on cross-tenant contribution
5. "Your data helped" transparency surface

Every Brain inherits these — none can bypass memory's privacy layer.

### 5.4 Preventing bad knowledge

Every Brain uses Phase 26's four-layer protection:
- Confidence decay (`decays_at`)
- Dual-source verification
- Conflict detection
- Correction chain (append-only, never overwrite)

Plus one Brain-specific rule: **every playbook change is versioned**. A merchant reverts to a prior version if a new one produces worse outcomes. Rollback is a memory-write, not a schema change.

---

## 6. Trade Expert Features

Ten user-facing capabilities per Brain:

| Capability                       | Backed by                                    | Merchant-facing surface                          |
| -------------------------------- | -------------------------------------------- | ------------------------------------------------ |
| Expert troubleshooting           | Fault-finding decision tree                  | Chat: "why is the RCD tripping?"                 |
| Installation guidance            | Workflow + sequence                          | Chat + SiteBook step-by-step                     |
| Photo analysis                   | Phase 13 CV + defect library                 | SiteBook photo tap → issues identified           |
| Drawing interpretation           | Phase 13 CV (drawings mode) + trade schema   | Upload plan → wall schedule + fixture list       |
| Specification review             | Regs + materials modules                     | Paste spec → red flags + missing items           |
| Material recommendations         | Materials module + Phase 17 MP               | Chat: "what for a wet room floor?"              |
| Tool recommendations             | Tools module                                 | Chat + Trade Centre linkouts                     |
| Method statements                | Workflow + safety modules                    | One-tap MS/RA generator for the trade + job      |
| Risk assessments                 | Weighted risk rules                          | Auto-drafted RAMS per project                    |
| Quality control                  | Testing + defect library                     | Snag detection in Phase 13 CV + checklists       |
| Pricing guidance                 | Pricing model                                | Phase 28 Estimator integration                   |
| Labour estimation                | Sequence + regional productivity             | Phase 28 Estimator                               |
| Customer communication           | Business tone module                         | Auto-drafted quote copy + email replies          |
| Training + apprenticeship        | Playbook decomposition                       | Apprentice-facing "walk me through this" mode    |
| Certification support            | Certification module                         | Curated resources per trade                      |
| CPD                              | Regulation-diff cron + curated feeds         | Weekly digest per Brain the merchant follows     |

---

## 7. Integration with the Nex Platform

Every Brain is a first-class participant across the platform. Because Phase 24's mesh is the single dispatch layer, integration is inherited rather than rebuilt.

| Platform surface           | Brain hook                                                                   |
| -------------------------- | ---------------------------------------------------------------------------- |
| Studio (merchant editor)   | Brain-suggested copy: services, portfolios, spec sheets                       |
| SiteBook (homeowner)       | Trade-specific step-by-step + Brain-authored FAQ                              |
| Trade Centre (marketplace) | Brain suggests category/spec on listing creation                              |
| Marketplace (`mp/`)        | Brain-scored supplier ranking (Phase 26 memory + Brain trust weights)         |
| CRM (Phase 8 `cx/`)        | Brain-authored customer-facing replies for the merchant to approve            |
| Quoting (Phase 28)         | Brain owns pricing model + scope generator input                              |
| Scheduling (Phase 24)      | Brain declares trade sequence dependencies                                    |
| Project management (`pm/`) | Brain flags risk-rule triggers on new project shape                           |
| Marketing (`bi/social`)    | Brain writes trade-native social posts                                        |
| Finance (`fi/`)            | Brain-aware margin analysis                                                   |
| Business Intelligence      | Brain feeds trade rollups for benchmarks                                      |
| Knowledge Graph (`bos/`)   | Brain owns nodes + edges for its trade                                        |
| Memory Engine (`memory/`)  | Brain is both writer + reader                                                 |
| Digital Twin (`twin/`)     | Twin scenarios can be Brain-scoped ("if I hire another carpenter")            |
| Autonomous agents (`ab/`)  | Brain drafts, autonomy engine gates                                           |

---

## 8. Revenue Opportunities

Four tiers per Brain, priced consistently with `src/lib/tierCatalog.ts`:

| Tier                          | Content                                                                            | Suggested price                        |
| ----------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------- |
| Basic Expert Brain            | Craft + regulations + tools + defect library (read-only)                           | Included in Starter £9.99/mo           |
| Professional Expert Brain     | + Pricing model + labour estimation + method statement drafting                    | Included in Professional £14.99/mo     |
| Master Trade Brain            | + Regional variants + cross-trade collaboration + rollup benchmark reads          | Included in Business £24.99/mo         |
| Enterprise Trade Intelligence | + Bespoke playbook edits + API access + custom regulation feed                     | Enterprise plan (bespoke)              |

**Add-ons (opt-in, per Brain):**
- Manufacturer product pack (e.g., Baxi boiler cert flow inside Heating Brain) — £2.99/mo per pack
- Regulation change alerts (weekly PDF, per Brain) — £1.99/mo
- Certification prep pack (18th Edition mock, Gas Safe module) — £9.99 one-off
- Training subscription (10 CPD hours/year, Brain-curated) — £29.99/year
- Construction consultancy referral fee (Brain refers to a human expert for edge cases) — commission per referral

**Second-side revenue (suppliers + manufacturers):**
- Manufacturer pays for premium placement inside the Materials module (visible cite, merchant can decline)
- Trade-tool retailer pays for sponsored Tool of the Month (clear ad label)
- Certification body pays for pipeline data on merchant readiness (opt-in only)

**Third-side revenue (adjacencies):**
- Insurance underwriters license anonymised trade-risk data for pricing models
- Regulators license anonymised regional aggregate data
- Training organisations license Brain-authored curricula

---

## 9. Competitive Analysis

### 9.1 vs. ChatGPT / Claude / Gemini (general LLMs)

**Their strength:** breadth of knowledge, natural language quality, general reasoning.

**Their weakness:** no ground truth per trade, no regional regulation citations, no memory of what worked for THIS merchant, no ability to cite Part L specific to a Cardiff extension in July 2026. When they're wrong they sound just as confident as when they're right.

**Nex advantage:** every claim carries an evidence chain. Every regulation cite is real. Every pricing hint is drawn from either the merchant's own history or K-anonymised regional aggregates. Trade Brains never invent — they surface or say "nothing on file."

### 9.2 vs. ServiceTitan / Procore / Buildertrend / Housecall Pro

**Their strength:** deep workflow, deep CRM, deep dispatch, deep invoicing.

**Their weakness:** no trade-specific expertise inside their AI (where any exists). Their assistants are generic and route to their workflow features. They cannot answer "why is my RCD tripping" with sequence + citation.

**Nex advantage:** Nex ships the workflow features (Studio, SiteBook, Trade Centre, memory, agents) AND the trade expertise. The Brain is not a replacement for the workflow — it's on top of it.

### 9.3 vs. Copilot (Microsoft)

**Their strength:** deep enterprise integration.

**Their weakness:** construction is a rounding error in their attention. There is no Roofer Copilot, no Bricklayer Copilot.

**Nex advantage:** we specialise where they generalise. A specialist beats a generalist at the specialist's task.

### 9.4 The moat

Three durable advantages:

1. **Depth × width × regionality × memory.** Any competitor can copy one axis. Copying all four simultaneously requires (a) construction expertise, (b) regional regulatory partnerships, (c) a multi-tenant memory substrate with consent, (d) time to accumulate.
2. **Every project deepens every Brain that participated.** A competitor starting today has zero project depth.
3. **Trade authorship.** Playbooks written by tradespeople (either directly or through corrections) accrete over years. Authored knowledge is much harder to displace than generated knowledge.

---

## 10. Scalability

### 10.1 Storage

Each Brain's structured knowledge lives as a JSON pack in `src/lib/nex/brains/<trade_slug>/` — one folder per trade, each containing:

```
craft.json
regulations.<country>.json    (one per supported country)
materials.json
tools.json
workflow.json
defects.json
pricing_model.json
business_tone.json
```

Every JSON validates against a shared TypeScript schema at build time. Invalid pack = boot audit warning (same pattern as the Phase 24 registry audit).

### 10.2 500+ trades

The pattern above scales linearly. 500 brains × 8 JSON files each = 4,000 files. Not a problem. Loading is lazy — a Brain's JSON packs are loaded only when the mesh picks it, then cached.

### 10.3 Sub-specialisations

Sub-specs live inside the Brain (`domain/` subtree). A Heat Pump Installer Brain has sub-specs `air_source`, `ground_source`, `retrofit`, `new_build`. Sub-specs override craft + pricing_model when the mesh picks up an ask specifically about that sub-spec.

### 10.4 Regional methods + country-specific regulations

Handled by the `regulations.<country>.json` fanout + `world/region.ts` overrides. Adding a new country = adding one file per Brain that supports it.

### 10.5 Manufacturer expertise

Manufacturers can license their product-specific knowledge via a Manufacturer Pack (Section 8 add-on). Structurally, a pack is a JSON module that plugs into the Materials + Regulations subtrees of the relevant Brain. The Brain surfaces manufacturer-authored content with a clear "manufacturer cite" evidence tag.

### 10.6 Language localisation

Brain vocabulary layer stores content in one canonical language per country pack. A translation layer (Phase 24 `translation` agent) handles cross-language reads. Adding a new language = updating each Brain's vocabulary lookups for that language, not rewriting the Brain.

---

## 11. Final Strategic Review

### 11.1 Is this a defensible moat?

Yes, on the four dimensions in Section 9.4. It's especially defensible because:

- Trade knowledge is not evenly authoritative online. Some trades (electrical, plumbing) have deep public standards; others (traditional bricklaying, heritage roofing) have expertise held by individuals and small trade bodies. Nex earns access to the latter via merchant contributions.
- The mesh + memory substrate — already shipped in Phase 24 and Phase 26 — are prerequisites a competitor would need to build first.

### 11.2 Does this make Nex "the AI OS for construction"?

Phase 24 made the OS metaphor start to work. Phase 27 completes it. An OS runs applications; a construction OS runs expertise per trade. Without Phase 27, Nex is an OS with only generic apps. With it, Nex ships a purpose-built app for every trade a merchant might run.

### 11.3 What makes this revolutionary for many years?

Three improvements beyond the core V0-V2 shape below:

1. **Merchant-authored playbook publishing.** A master trade with 40 years of experience should be able to publish (with attribution) a playbook that other merchants can subscribe to. Nex takes a modest platform fee. This turns Nex into a two-sided marketplace for trade expertise, not just a consumer of it.
2. **Cross-Brain analogical reasoning.** When the Roofer Brain has 10× more data than the Solar PV Brain, teach the Solar PV Brain to draw calibrated inferences from Roofing where they overlap. Requires care: analogies fail; every cross-Brain inference must be low-confidence + labelled.
3. **Local craft preservation partnerships.** Team with heritage bodies (Historic England, Historic Environment Scotland, Cadw) to encode regional traditional-craft knowledge. This is community + commercial: preservation + revenue via consultancy tier.

### 11.4 Recommended next steps

Grounded in the shipped code:

1. **Ratify the Brain module contract as an ADR** — the 10-module schema needs to be locked before any Brain is authored, or corrections will be schema migrations.
2. **Author the Electrician Brain end-to-end as reference implementation.** Six weeks. Includes the JSON pack format, the runtime loader, the mesh integration, and full Vitest coverage.
3. **Migrate the existing Phase 24 trade agents to the new Brain contract.** Their invoke functions swap from knowledge-retrieval stub to Brain-loader. Two weeks.
4. **Ship the boot audit that checks every Brain's JSON pack.** One week. Prevents drift.
5. **Author Plumber + Roofer + Bricklayer Brains** as second wave. Six weeks each in parallel — authored by domain experts, not engineers.
6. **Only then unlock manufacturer packs + third-side APIs.** These are revenue-generating but need the substrate solid first.

### 11.5 Development phases

- **V0 · reference implementation (Electrician)** — 6 weeks
- **V1 · migrate Phase 24 trades (10 total) to Brain contract** — 2 weeks
- **V2 · second wave of authored Brains (Plumber, Roofer, Bricklayer, Carpenter, Plasterer)** — 12 weeks
- **V3 · manufacturer packs + certification prep packs** — 8 weeks
- **V4 · cross-Brain analogical reasoning + published playbooks marketplace** — 16 weeks

### 11.6 Risk assessment

| Risk                                                             | Severity | Mitigation                                                                          |
| ---------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------- |
| Author quality drift (Brains only as good as their author)       | High     | Trade advisory panel per Brain, versioned playbooks, merchant correction chain      |
| Regulation lag (regs change; Brains don't update fast enough)    | High     | Phase 21 diff cron per country, alert workflow for authors                          |
| Cross-Brain conflicts confusing merchants                        | Medium   | Existing `orch/confidence.ts` handles it, but UX must surface not hide              |
| Manufacturer bias in materials cites                             | Medium   | Clear "manufacturer cite" tag, merchant can filter out sponsored content            |
| Vocabulary drift (regional slang the Brain doesn't know)         | Low      | Merchant additions to vocabulary layer, K-anonymised roll-up                        |

### 11.7 Final recommendation

Ship Phase 27 in the sequence above. Do not skip the reference-Brain build — the Electrician Brain must be authored fully before migration so the pattern is proven on hard mode. Do not commercialise manufacturer packs until at least five second-wave Brains are live and stable. Do not open the playbook marketplace until authorship attribution and revenue-share economics are ratified.

Phase 27 is where Nex earns the "AI OS for construction" tagline in fact rather than aspiration.

---

**End of Phase 27 blueprint.**

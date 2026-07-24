# Nex Master Architecture v1.0

**Consolidated blueprint · 2026-07-23**
**Purpose:** turn 33 phase designs into one coherent roadmap. Answer: what to build, in what order, for which revenue, against which moat. This is the decision document — every other blueprint is a reference for the phase it covers.

---

## 1. Executive Summary

Nex is 33 phases of construction-industry AI, of which 25 are shipped (Phases 1-25) plus a Memory Engine V0 substrate (Phase 26 in code), and 7 blueprinted (Phases 27-33). The vision is a construction operating system that spans understanding, memory, prediction, autonomous workforce, and ecosystem-scale intelligence.

The strategic reality this document captures:

- **11 phases are foundational.** Nothing else works without them. All are already built or in code today.
- **7 phases are commercial multipliers.** Each meaningfully changes ARPU or acquisition rate. Six of the seven are still in blueprint form.
- **6 phases are moat compounders.** Each takes years of merchant density to matter. Two are shipped, four are blueprints.
- **9 phases are enhancers.** Useful, non-blocking, buildable at any point.

The right order to build over the next 3-5 years:

- **Year 1** — finish Phase 26 memory to V1 · ship Phase 27 (Trade Brains) V1 · ship Phase 28 (Estimator) V0-V1 · pilot Phase 33 (Workforce Economy) hiring UX for the Phase 32 agents already existing. Revenue focus.
- **Year 2** — ship Phase 32 (Autonomous Workforce) V0-V2 · Phase 29 (Digital Twin) V0-V1 · Phase 31 (Business Builder) V0-V1. Category shift.
- **Year 3** — ship Phase 30 (Market Intelligence) V0-V2 · Phase 29 V2-V3 · Phase 33 V2-V3. Wholesale opens.
- **Year 5** — long-tail phases · international expansion · playbook marketplaces · homeowner Twin subscriptions · civic-scale intelligence deals.

Every year is a stepping stone. Every stone lands on the one before. The single most important discipline is **not skipping ahead** — the phases depend on each other in ways that cannot be brute-forced.

---

## 2. The 33 phases in one page

Grouped by their strategic role, not by order shipped:

### Foundational substrate (already shipped or nearly)

| Phase | Name                         | Shipped | Substrate role                                                     |
| ----- | ---------------------------- | ------- | ------------------------------------------------------------------ |
| 1-4   | Nex Brain foundations        | Yes     | Voice, intent, chat, character, knowledge retrieval                 |
| 5     | Business Intelligence        | Yes     | Merchant business dashboard signals                                 |
| 6     | Project Intelligence (SiteBook AI) | Yes | Per-project snapshot + events                                        |
| 7     | Estimating Intelligence      | Yes     | Deterministic estimating engine                                     |
| 8     | Customer Intelligence        | Yes     | CRM + payment behaviour                                             |
| 10    | Financial Intelligence       | Yes     | Cash horizon + margin + VAT                                         |
| 15    | Autonomous Business          | Yes     | Approval-gated action framework + autonomy modes                     |
| 24    | Multi-Agent Mesh             | Yes     | 40 specialist agents + voice unifier + conflict resolution           |
| 26    | Memory Engine (V0)           | Yes     | Persistent, evidence-typed knowledge substrate                       |
| 27    | Trade Expert Brains          | Blueprint | Deep trade expertise per trade                                     |

### Commercial multipliers (revenue-critical)

| Phase | Name                     | Shipped   | Commercial role                                                    |
| ----- | ------------------------ | --------- | ------------------------------------------------------------------ |
| 28    | AI Estimator Engine      | Blueprint | Highest commercial delta per engineering hour                        |
| 31    | AI Business Builder      | Blueprint | Customer acquisition experience — one-hour business launch          |
| 32    | Autonomous AI Workforce  | Blueprint | Always-on employees for each merchant                                |
| 33    | AI Workforce Economy     | Blueprint | Employment Centre + hiring UX + pricing that shifts category         |
| 30    | Market Intelligence      | Blueprint | Wholesale revenue channel (suppliers, insurers, gov, developers)     |
| 25    | Business Operating System| Yes       | Morning intelligence report + growth advisor                        |
| 22    | Ops (morning briefing)   | Yes       | Personalised owner-facing morning briefing                          |

### Moat compounders (network + time effects)

| Phase | Name                     | Shipped   | Moat role                                                          |
| ----- | ------------------------ | --------- | ------------------------------------------------------------------ |
| 29    | Digital Construction Twin| Blueprint | Event-sourced project record spanning lifetime                       |
| 26    | Memory Engine            | Yes (V0)  | Cross-tenant knowledge substrate                                    |
| 27    | Trade Expert Brains      | Blueprint | Vertical construction depth per trade                                |
| 30    | Market Intelligence      | Blueprint | Cross-region signal density                                         |
| 14    | Network Intelligence     | Yes       | Referral graph                                                     |
| 24    | Multi-Agent Mesh         | Yes       | Compound specialist coordination                                    |

### Enhancers (useful, non-blocking)

| Phase | Name                              | Shipped |
| ----- | --------------------------------- | ------- |
| 9     | Managing Director (workforce briefing) | Yes |
| 11    | Supply Chain                      | Yes     |
| 12    | Project Manager                   | Yes     |
| 13    | Construction Vision               | Yes     |
| 16    | Construction Cloud (property)     | Yes     |
| 17    | Marketplace Intelligence          | Yes     |
| 18    | Construction Experience Intelligence | Yes  |
| 20    | Construction World Model          | Yes     |
| 21    | Global Intelligence Platform      | Yes     |
| 23    | Digital Twin (scenario simulator) | Yes     |

The 25 shipped phases are the platform's actual foundation. The 7 blueprints are where the strategic bets sit.

---

## 3. Foundational vs optional — the clear line

### 3.1 Foundational (cannot skip)

- Phase 1-4 — the Nex conversational surface. Everything is chat-first.
- Phase 26 (Memory Engine) — the substrate every other phase writes to and reads from. **The single most important phase in the platform**. V0 is shipped; V1 cross-tenant unlock is Year 1 priority.
- Phase 27 (Trade Brains) — construction depth per trade. Blocks Phase 28, 29, 31, 32.
- Phase 24 (Multi-Agent Mesh) — the coordination layer. Already shipped.
- Phase 15 (Autonomous Business) — approval-gated action framework. Every downstream autonomous phase respects this.

If any of these fail, everything fails. Every other phase is composition on top.

### 3.2 High-value non-foundational (commercial or moat)

- Phase 28 (Estimator) — highest ARPU driver per engineering hour. Blueprint-ready. Priority-1 Year 1.
- Phase 31 (Business Builder) — highest acquisition-friction remover. Priority-1 Year 2.
- Phase 32 + 33 (Workforce + Economy) — category shift. Priority-1 Year 2.
- Phase 29 (Twin) — greatest long-term moat. Priority-2 Year 2.
- Phase 30 (Market Intelligence) — wholesale revenue ceiling. Priority-1 Year 3.

### 3.3 Optional / defer

- Phase 18 (XP) — buildable, not critical for the near-term roadmap.
- Phase 20-21 (World / Global) — already shipped; expansion is when merchants demand it.
- Phase 16 (CC property) — property-side use cases can wait for Phase 29 Twin maturity.

**Never build the optional phases before the foundational + commercial multipliers are healthy.** Optionality is a distraction until the core is compounding.

---

## 4. Dependency map — what blocks what

```
Legend: A → B  means A must reach the noted state before B can begin.

Phase 26 memory V1 (cross-tenant) ─┬─→ Phase 27 Brains V1 (3 authored)
Phase 26 memory V0 (own-only) ─────┘

Phase 27 Brains V1 ─┬─→ Phase 28 Estimator V0
Phase 26 V0 ────────┘

Phase 27 Brains V1 ─┬─→ Phase 32 Workforce V0
Phase 15 AB ────────┤   (Phase 15 already shipped)
Phase 24 mesh ──────┘   (Phase 24 already shipped)

Phase 32 V0 ────────→ Phase 33 Workforce Economy V0

Phase 27 Brains V1 ─┬
Phase 28 V0 ────────┼→ Phase 29 Digital Twin V0
Phase 26 V0 ────────┘

Phase 27 Brains V1 ─┬
Phase 28 V0 ────────┼→ Phase 31 Business Builder V0
Phase 26 V0 ────────┤
Studio App Store ───┘   (already shipped)

Phase 26 V1 ────────┬→ Phase 30 Market Intelligence V0
Phase 25 BOS ───────┤   (Phase 25 already shipped)
Phase 27 Brains V1 ─┘
```

**The critical path is:**

```
Phase 26 V1  →  Phase 27 V1  →  Phase 28 V0  →  everything else
```

Everything downstream unlocks in a cascade once these three complete. That's why they anchor Year 1.

---

## 5. Year-by-year roadmap

### 5.1 Year 1 (2026-Q3 to 2027-Q3) — revenue + substrate

**Objective:** get to a compounding revenue base with a genuinely-differentiated Estimator.

**Ship:**

1. **Phase 26 Memory V1** (Q3 2026) — cross-tenant rollups + K-anonymity gate. 6 weeks after V0 stabilises.
2. **Phase 27 Trade Brains V0** (Q3-Q4 2026) — Electrician reference brain end-to-end. 6 weeks. Author the 10-module contract.
3. **Phase 27 Trade Brains V1** (Q4 2026) — migrate existing Phase 24 trade agents to the Brain contract, author Plumber + Roofer + Carpenter to depth. 12 weeks in parallel.
4. **Phase 28 Estimator V0** (Q1 2027) — kitchen + bathroom scope, single-trade end-to-end. 6 weeks.
5. **Phase 28 Estimator V1** (Q1-Q2 2027) — multi-trade composition. 6 weeks.
6. **Phase 33 Workforce Economy V0** (Q2 2027, in parallel with Phase 32 pilot) — Employment Centre browsable, 5 core roles. 10 weeks.
7. **Phase 32 Workforce V0** (Q2-Q3 2027) — 5 always-on agents with approval inbox + emergency stop. 12 weeks. Depends on Phase 27 V1.

**Revenue outcome:** Estimator becomes the primary conversion feature. ARPU rises as merchants graduate to Professional/Business tiers to unlock full Trade Brain depth + multi-trade Estimator + first hired AI colleagues.

**Merchant story:** by mid-Year 1, a plumber on Nex quotes bathroom refits 10× faster than on any competitor, gets predictive risk alerts on live jobs, and has a Bookkeeper AI + Estimator AI on staff.

### 5.2 Year 2 (2027-Q3 to 2028-Q3) — workforce + acquisition + twin

**Objective:** category shift. Nex stops being "construction software" and becomes "the construction operating system with a workforce."

**Ship:**

1. **Phase 32 Workforce V1-V2** — full 25-agent workforce. 22 weeks.
2. **Phase 33 Workforce Economy V1-V2** — Department Manager + Culture Layer + Career Progression. 18 weeks.
3. **Phase 31 Business Builder V0-V1** — Electrician + Plumber + Roofer + Bricklayer + Carpenter one-hour onboarding. 18 weeks.
4. **Phase 29 Digital Twin V0-V1** — event log + Vision reconciler + basic handover pack. 22 weeks. Runs partly in parallel.
5. **Phase 27 Trade Brains V2** — second-wave Brains (Bricklayer, Plasterer, Roofer, Painter, Landscaper). 12 weeks in parallel.

**Revenue outcome:** onboarding conversion doubles because the Business Builder removes the biggest acquisition friction. Merchant retention improves because retiring an AI colleague is heavier than disabling a feature. Twin V1 unlocks the Business tier upgrade path.

**Merchant story:** by mid-Year 2, a new plumber signs up over a Sunday lunch, has a full business live by tea time, and by Christmas has 3 AI colleagues on the team plus 4 live project Twins.

### 5.3 Year 3 (2028-Q3 to 2029-Q3) — market intelligence + wholesale

**Objective:** open wholesale revenue channels. Convert platform-native data density into industry-scale intelligence products.

**Ship:**

1. **Phase 30 Market Intelligence V0** — signal store + platform-native + free public feeds + regional dashboard (5 UK regions + 2 IE + 2 AU). 12 weeks.
2. **Phase 30 V1** — material advisor + labour advisor + opportunity feed + benchmark suite. 10 weeks.
3. **Phase 30 V2** — AI Market Advisor Q&A + monthly Regional Market Report PDF. 12 weeks.
4. **Phase 29 Twin V2** — homeowner portal + drone/LiDAR ingest + warranty vault. 12 weeks.
5. **Phase 33 V3** — Specialist Marketplace + Department Bundles + Cross-Merchant Referrals. 10 weeks.
6. **Wholesale channel pilots** — supplier subscription pilots · manufacturer intelligence pilots · developer analytics pilot. Rolling.

**Revenue outcome:** wholesale side becomes real revenue. Regional Market Reports sell to suppliers. Manufacturer partnerships fund materials-module depth. Twin homeowner subscriptions add long-tail post-handover ARPU.

**Merchant story:** by mid-Year 3, merchants make strategic decisions (hiring, expansion, service additions) with regional peer benchmark evidence, not gut feel.

### 5.4 Year 5 (2030-Q3+) — civic-scale intelligence + international expansion + long-tail

**Objective:** cross from platform to infrastructure.

**Ship:**

1. **Phase 29 Twin V3-V4** — cross-project pattern lending + insurance/FM revenue + civic dataset opt-in.
2. **Phase 30 V3-V4** — wholesale API + supplier/manufacturer subscription products + published Nex indices + advanced forecasting.
3. **Phase 32 V3-V4** — progressive autonomy + agent apprenticeship + selective Level-6 whitelisting + cross-border agent teams.
4. **Phase 31 V3-V4** — non-trade personas (supplier, manufacturer, developer, architect) + advanced generation.
5. **Phase 33 V4** — cross-merchant shadowing + Employee-of-the-Year + Trade Association co-branding.
6. **International rollout** — expand across US · Canada · New Zealand · UAE · Ireland deeper · Australia deeper.
7. **Homeowner Twin subscriptions** — post-handover ARPU stream matures.

**Revenue outcome:** wholesale + subscription + international layered. Nex is compared to "hiring a team," not to competitors. Category permanently shifted.

---

## 6. Revenue analysis — which phases pay first

### 6.1 Fast payback (revenue in weeks to months)

- **Phase 28 Estimator** — merchants pay for tier upgrades to unlock multi-trade estimator + Vision AI. Every quote generated pays for a month of subscription. Fastest payback in the roadmap.
- **Phase 33 Workforce Economy** — 14-day trial converts merchants who otherwise wouldn't upgrade. Every specialist hire adds ARPU.
- **Phase 31 Business Builder** — improves acquisition conversion; every new merchant is a subscription plus lifetime value.

### 6.2 Medium payback (months to a year)

- **Phase 32 Workforce** — merchants graduate to higher tiers as they hire more of the workforce.
- **Phase 29 Twin V1-V2** — Business + Works tier upgrades unlock the interactive proposal + homeowner portal.
- **Phase 27 Trade Brains** — depth per trade unlocks Professional-tier upgrade path.

### 6.3 Long payback (year+) — but biggest ceiling

- **Phase 30 Market Intelligence** — wholesale channels take year+ to convert but eventually rival merchant-side revenue. Highest economic ceiling of any phase.
- **Phase 29 Twin V3+** — homeowner subscriptions + insurance data channels take years to build density.
- **Phase 26 Memory V2+** — industry reports + regional pricing intelligence packaged as PDF products.

### 6.4 The revenue-to-effort table

Sorted by revenue impact per unit of engineering effort. Priority order for planning:

1. Phase 28 Estimator V0-V1
2. Phase 33 Workforce Economy V0-V1
3. Phase 32 Workforce V0-V1
4. Phase 31 Business Builder V0-V1
5. Phase 27 Trade Brains V1-V2
6. Phase 26 Memory V1
7. Phase 29 Twin V0-V1
8. Phase 30 Market Intelligence V0-V1
9. Phase 32 Workforce V2+
10. Phase 30 V2+ + wholesale

Everything above position 5 pays back in Year 1. Everything below pays back later but compounds harder.

---

## 7. Moat analysis — which phases are hardest to copy

Ranked by durability of competitive advantage, not by size of user-facing feature:

### 7.1 Tier 1 — impossible to replicate quickly

- **Phase 26 Memory Engine** — the substrate. Every downstream moat depends on it. Cross-tenant density × time is the moat.
- **Phase 29 Digital Twin** — event-sourced project records surviving handover. Homeowner-transferable ownership. Requires Phases 27 + 28 + 26 to be interesting; requires years of density to be defensible.
- **Phase 30 Market Intelligence** — platform-native signal density × regional density × time. No shortcut.

### 7.2 Tier 2 — hard to replicate without construction focus

- **Phase 27 Trade Brains** — trade specificity. Authored by trades over years. Portable knowledge is easy; earned depth is not.
- **Phase 24 Multi-Agent Mesh + Phase 32 Workforce** — coordination + always-on execution requires the substrate underneath.

### 7.3 Tier 3 — replicable in a year but network-locked

- **Phase 31 Business Builder** — the flow is buildable; the substrate that makes generated content credible is not.
- **Phase 33 Workforce Economy** — the UX is buildable; the workforce it wraps is not.
- **Phase 14 Network Intelligence** — referral graph value grows with density.

### 7.4 The strategic play

Build in this order to compound moat:

1. Finish the substrate (26, 27, 24, 15) — foundational.
2. Ship the multipliers on top (28, 31, 32, 33) — commercial + acquisition.
3. Layer the network moats (29, 30) — long-tail defensible.

Every phase from 3 onwards adds to Tier 1 moat. Every year of merchant density widens the gap. The moat is not any one phase; it's the compound interest on all of them together.

---

## 8. How the 33 phases connect technically

### 8.1 The layered stack

```
┌──────────────────────────────────────────────────────────────┐
│  Presentation                                                │
│  Studio · SiteBook · Employment Centre · Twin Timeline       │
│  · Approval Inbox · Homeowner Portal · Regional Dashboards   │
└─────────────────────────────┬────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────┐
│  Interaction                                                  │
│  Phase 1-4 Nex Brain · Phase 24 Mesh · Phase 33 Employment    │
│  Phase 33 Culture Layer · Phase 32 Standing Briefs            │
└─────────────────────────────┬────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────┐
│  Specialist Intelligence                                      │
│  Phase 27 Trade Brains · Phase 32 Role Manifests              │
│  Phase 25 BOS · Phase 22 Ops Briefing · Phase 15 AB           │
└─────────────────────────────┬────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────┐
│  Composition Engines                                          │
│  Phase 28 Estimator · Phase 31 Business Builder               │
│  Phase 29 Twin · Phase 23 Scenario Twin                       │
└─────────────────────────────┬────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────┐
│  Domain Engines                                               │
│  BI(5) · PI(6) · Est(7) · CX(8) · MD(9) · FI(10) · SC(11)     │
│  PM(12) · CV(13) · NET(14) · CC(16) · MP(17) · XP(18)         │
│  World(20) · Global(21)                                       │
└─────────────────────────────┬────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────┐
│  Substrate                                                    │
│  Phase 26 Memory Engine · Phase 30 Signal Store               │
│  Knowledge Engine (Phase 4) · Twin Event Log (Phase 29)        │
└─────────────────────────────┬────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────┐
│  Infrastructure                                               │
│  Supabase (Postgres + Storage + Auth + RLS)                   │
│  Next.js 16 · Vercel · Stripe · Companies House               │
│  Anthropic API · Weather APIs · Public government feeds       │
└──────────────────────────────────────────────────────────────┘
```

### 8.2 Data flow — how signals move

```
Merchant event (quote issued, invoice sent, delivery received, photo uploaded)
       │
       ├──→ Domain engine handles the operational side (BI, FI, PI, etc.)
       │
       ├──→ Phase 26 Memory writer captures atomic observation
       │
       ├──→ Phase 29 Twin event log appends event (if project-scoped)
       │
       ├──→ Phase 32 Workforce agent notified via subscription
       │       │
       │       └──→ Standing brief runs · draft prepared · approval inbox
       │
       ├──→ Phase 30 Market Intelligence signal store observes (if signal-worthy)
       │
       └──→ Phase 24 Mesh + Phase 27 Brains available for consultation
```

Every event feeds every downstream phase without direct coupling. The substrate is the wire.

### 8.3 Cross-phase reads

Every phase reads what every other phase writes:

- Phase 27 Trade Brains read Phase 26 Memory for merchant-specific pricing calibration
- Phase 28 Estimator reads Phase 27 Brains + Phase 30 signals + Phase 26 memory
- Phase 29 Twin reads Phase 27 Brains for anomaly detection + Phase 26 for pattern lending
- Phase 30 reads platform-native signals from all domain engines + Phase 26 rollups
- Phase 31 Business Builder reads Phase 27 Brains for voice + Phase 30 for regional prioritisation
- Phase 32 Workforce reads everything relevant to each agent's role
- Phase 33 UI reads Phase 32 audit log

There are no isolated phases. Everything is composition.

---

## 9. Technical stack per phase

### 9.1 Databases

- **All phases** — Supabase Postgres. Tables prefixed `hammerex_nex_*` (per shipped convention).
- **Phase 26** — `hammerex_nex_memory_{user,company,project,trade,region,industry,market}`
- **Phase 29** — `hammerex_nex_twin_events` (event log, append-only) + snapshots + perspectives
- **Phase 30** — `hammerex_nex_market_{signals,forecasts,ingest_feeds,wholesale_consumers}`
- **Phase 32** — `hammerex_nex_workforce_{roles,tasks,approvals,kpis,audit_log}`
- **Phase 33** — `hammerex_nex_workforce_{hires,employee_profiles,departments,promotions,reviews}`

### 9.2 Storage

- **All large binaries** (photos, videos, drawings, BIM, PDF reports) — Supabase Storage. URIs written to event logs.

### 9.3 AI models

- **Language** — Claude Opus 4.7 (per merchant memory pin) for all merchant-facing voice + long-form drafts + agent reasoning.
- **Vision (Phase 13, 28, 29)** — GPT-4-Vision or equivalent multimodal model for photo + drawing analysis.
- **Embeddings (Phase 4 knowledge, Phase 26 V3+)** — Voyage AI or OpenAI text-embedding-3 for semantic retrieval.
- **Design generation (Phase 31)** — image-generation model for logo concepts, brand-guarded.
- **OCR (Phase 28 doc analysis)** — Google Document AI or Amazon Textract for PDF spec extraction.
- **Fine-tuned models** — none V0-V2. Reserved for V3+ when calibrated real data justifies training.

### 9.4 Third-party services

- **Payments** — Stripe (subscriptions + one-off; ADR-0010 margin discipline).
- **Auth** — Supabase Auth.
- **Public registers** — Companies House (UK), Gas Safe register (UK), NICEIC register, MCS register, ONS statistics.
- **Weather + climate** — Met Office / OpenWeatherMap.
- **Planning apps** — UK Planning Portal + LA scrapers.
- **Financial** — Bank of England rates API + Open Banking for merchant bank connections.
- **Comms** — WhatsApp Business API (per platform default), email via existing infra.
- **Voice AI** — none on customer purchasing path (constitutional rule). Local browser transcription only, merchant-side.

### 9.5 Runtime + infrastructure

- **Next.js 16** on Vercel (per shipped stack).
- **Serverless functions** for standing briefs (Phase 32).
- **pg_cron** for signal aggregation + memory rollups + market forecast recomputation.
- **Vercel Cron** for external feed ingest + verification workflows.

### 9.6 Frontend surfaces

- **Studio** — merchant primary interface. Already shipped.
- **SiteBook** — homeowner + merchant project workspace. Already shipped.
- **Employment Centre** — new Phase 33 UI on top of existing App Store pattern.
- **Twin Timeline** — new Phase 29 UI.
- **Approval Inbox** — new Phase 32 UI.
- **Homeowner Portal** — new Phase 29 UI (extending SiteBook).
- **Regional Dashboards** — new Phase 30 UI.

Every UI reuses the existing Studio design system.

---

## 10. Development priority + sequencing recommendations

### 10.1 The five golden rules

1. **Never skip a foundational phase to chase a commercial multiplier.** Phase 28 Estimator without Phase 27 Brains V1 is a form-filler. Ship the substrate first.
2. **Never delay the substrate for optional enhancements.** Phase 26 Memory V1 is a Year-1 priority even though it doesn't ship a merchant-facing feature by itself. It unlocks every downstream phase's cross-tenant value.
3. **Parallelise where dependencies allow.** Phase 30 (Market Intelligence) can run parallel with Phase 29 (Twin) in Year 3. Neither blocks the other.
4. **Consent + honesty is non-negotiable across every phase.** Every cross-tenant surface goes through K≥5 gate. Every AI draft is approved before external send. Every stat has an evidence chain.
5. **Shadow mode before live.** V0 of substrates (Memory, Twin, Market Intelligence) runs in shadow mode collecting data before exposing reads to merchants. Two weeks minimum before UX judgement.

### 10.2 The near-term critical path (18 months)

1. Finish Phase 26 Memory V1 (cross-tenant rollups + K≥5 gate)
2. Ship Phase 27 Trade Brains V0 (Electrician reference implementation)
3. Migrate Phase 24 trade agents to Phase 27 Brain contract
4. Author Phase 27 second-wave (Plumber, Roofer, Carpenter) to V1 depth
5. Ship Phase 28 Estimator V0 (single-trade end-to-end)
6. Ship Phase 32 Workforce V0 (5 core agents, approval inbox, emergency stop)
7. Ship Phase 33 Workforce Economy V0 (Employment Centre + hire conversation)
8. Ship Phase 28 Estimator V1 (multi-trade composition)
9. Ship Phase 31 Business Builder V0 (Electrician one-hour onboarding)

Everything from step 5 onwards has direct ARPU impact. Steps 1-4 are the infrastructure that makes steps 5+ meaningfully better than competitor offerings.

### 10.3 What to defer (deliberately)

- Homeowner Twin subscription monetisation until Twin V2 ships.
- Wholesale Market Intelligence deals until Phase 30 V2 has statistical rigour.
- Cross-merchant agent shadowing (Phase 32 V4) until Phase 32 has legal + trust maturity.
- International expansion beyond UK + IE + AU until product-market fit in the launch markets.
- ML models across the platform until deterministic baselines exist to beat.

### 10.4 What to be careful about

- **Fake feature parity temptation.** When competitors ship AI features, do not respond by shipping a shallow version of the same feature. Respond by making the substrate deeper so Nex's version is meaningfully better.
- **Manufacturer bias temptation.** Manufacturer partnerships are lucrative but easy to abuse. Every sponsored placement must carry a clear label.
- **Fabrication temptation.** Every forecast, every benchmark, every "your data helped" surface must trace to real data. No confidence badges masking hollow numbers.
- **Over-autonomy temptation.** The 7-level trust ladder is not a marketing feature. It is the safety architecture. Never open Level 6 auto-execute for new agents.

---

## 11. Risks + dependencies at platform scale

| Risk                                                              | Severity | Which phase most exposed                                    | Mitigation                                                                             |
| ----------------------------------------------------------------- | -------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Substrate schema drift breaks downstream phases                    | Critical | Phase 26 memory schema                                       | Ratify schemas as ADR before code; version everything; test cross-phase                 |
| Consent framework fails and cross-tenant rollups pause              | Critical | Phase 26, Phase 29, Phase 30                                | Consent is one-shot trust; over-communicate; never surprise merchants                   |
| Trade Brain authorship drift (Brains only as good as authors)       | High     | Phase 27                                                    | Trade advisory panel per Brain; versioned playbooks; correction chain                   |
| Vision AI misinterpretation cascades into Twin state drift          | High     | Phase 29                                                    | Merchant approval on medium-confidence events; append-only means no silent overwrite    |
| Autonomous agent action causes external harm                        | Critical | Phase 32                                                    | Draft-not-execute default; Level 6 opt-in only; emergency stop always available          |
| Wholesale data channel raises DPA/regulatory scrutiny               | High     | Phase 30                                                    | Consent-first data-sharing agreements; opt-in with rev-share incentives                  |
| Merchant burnout from too many approval inbox items                 | Medium   | Phase 32, Phase 33                                          | Employee graduation reduces approval burden; batch-approve UI                            |
| Fabrication in Business Builder generated content                   | Critical | Phase 31                                                    | Schema-level guardrails against fake reviews/credentials/portfolio/stats                 |
| Competitor with deep pockets releases lookalike feature             | Medium   | Any commercial multiplier phase                              | Substrate depth × merchant density is the moat, not any single feature                  |
| International regulation change (e.g. AI Act) restricts capabilities | High     | All autonomous phases                                       | Design for compliance-first; graceful degradation of features per jurisdiction           |
| Pricing perception (workforce feels expensive)                      | Medium   | Phase 33                                                    | 14-day trial + tier-included core + honest add-on prices                                 |
| Substrate quality gap (Nex better than competitors' shallow AI)     | Positive | All phases                                                  | Widen the gap year over year; never compete on feature parity                            |

---

## 12. Concrete next steps (next 90 days)

Ranked by strategic value + immediate actionability:

1. **Ratify these ADRs** before writing any Year-1 code:
   - Phase 26 Memory Engine cross-tenant privacy rules (Section 3.2 of Phase 26 blueprint)
   - Phase 27 Trade Brain 10-module contract (Section 1.3 of Phase 27 blueprint)
   - Phase 29 Twin event log schema (before Twin V0 begins)
   - Phase 32 Workforce trust ladder (Section 5 of Phase 32 blueprint)
   - Phase 33 Workforce Economy honesty non-negotiables (Section 14.7 of Phase 33 blueprint)

2. **Complete Phase 26 Memory V1** — the cross-tenant rollup crons + K-anonymity gate. Six weeks. Highest-leverage engineering time on the roadmap.

3. **Begin Phase 27 Electrician Brain V0** — author the 10 modules in JSON, build the runtime loader, wire the boot audit, write full Vitest coverage. Six weeks in parallel with Memory V1.

4. **Recruit Trade Brain advisory panel** — one master tradesperson per initial trade (Electrician + Plumber + Roofer + Carpenter). They author the playbooks, not engineers. This starts now because their availability is the blocker.

5. **Pilot Phase 33 Workforce Economy hire conversation** with existing Phase 32 agents. Ten weeks. Use the existing agents as the workforce V0 to prove the hire-conversation UX before Phase 32 V0 formally ships.

6. **Legal review before V1 goes cross-tenant.** Cross-tenant aggregation touches DPA + GDPR + AU Privacy Act. Do it once, do it properly.

7. **Merchant advisory panel review** for the Trade Brain, Estimator, and Workforce V0s. Five pilot merchants each. Their feedback shapes V1.

---

## 13. Long-term strategic vision (5-10 years)

If Years 1-5 land, Nex is:

- The **default construction operating system** for small-to-mid businesses in UK · IE · AU · US · CA · NZ · AE, with growing traction in adjacent markets.
- Home to **millions of live merchant workforces** — each with a hybrid AI-human team, tenant-scoped memory, and cross-tenant K-anonymised intelligence.
- Owner of the **largest continuous construction signal set** globally — quotes, deliveries, projects, labour, materials, regulations, outcomes.
- Publisher of **Nex Construction Indices** — regional pricing, labour availability, demand signals — cited in trade press and government analysis.
- The **infrastructure** insurers use for construction quality signals, that local authorities consult for retrofit programmes, that manufacturers plan production against.
- The **place tradespeople launch businesses** — not because Nex is the only option, but because starting anywhere else is deliberately slower + lonelier.

The industry-level effect: small-construction-business mortality rate drops materially. Operational competence gap between best-run and struggling firms narrows. Nex is not the biggest AI company, not the biggest SaaS company, but the **most trusted construction infrastructure** of its era.

---

## 14. What this document is NOT

- **Not a promise.** Every phase blueprint is a design intent. Reality is what merchants use, what pays, what compounds. Roadmaps adjust.
- **Not a moat guarantee.** Composition moat needs execution. Any of the 33 phases done badly leaks the moat.
- **Not an excuse to defer shipping.** Reading blueprints does not build product. Ship, measure, iterate.
- **Not a commitment to build all 33 phases.** Nine phases are marked as enhancers or optional. Do not build them without merchant demand evidence.

---

## 15. Final synthesis

Nex's strategic position over the next 5 years is defined by three compounding advantages:

1. **Vertical depth.** Everything is construction. No horizontal AI platform matches vertical specialisation.
2. **Substrate compounding.** Every merchant strengthens every other merchant's experience through consented K-anonymised rollups.
3. **Category shift.** "Hire an AI Bookkeeper" is not the same product as "Enable Accounting Automation."

The critical path is:

```
Memory V1  →  Brains V1  →  Estimator V0  →  Workforce V0  →  Twin V0  →  Market Intel V0  →  everything else
```

Execute this order. Ship each with rigour. Respect the substrate. Never chase competitor feature parity. Compound.

That is the plan.

---

**End of Master Architecture v1.0.**

*Every prior phase blueprint remains authoritative for its phase. This document is authoritative for how they fit together and when to build each. Update this document rather than issuing conflicting new blueprints when the roadmap adjusts.*

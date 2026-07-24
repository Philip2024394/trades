# Nex Engineering Execution Bible v1.0

**CTO-level engineering blueprint · 2026-07-23**
**Purpose:** answer HOW every architectural decision is built and WHY it's built that way. Where the Build Execution Playbook is the working document for engineering managers, this is the reference for architects, staff engineers, and technical decision-makers. It supersedes assumptions with engineering certainty and challenges weak decisions from prior blueprints where they exist.

**Relationship to other documents:**
- Individual phase blueprints (26-33) — authoritative for phase functionality
- `NEX_MASTER_ARCHITECTURE_V1.md` — authoritative for WHAT/WHY at product level
- `NEX_BUILD_EXECUTION_PLAYBOOK_V1.md` — authoritative for HOW/WHEN at execution level
- **This document** — authoritative for HOW/WHY at engineering level

Where any of these disagree with prior blueprints on engineering matters, this document wins. Every recommendation is justified with the reasoning behind it.

---

## Section 1 — Executive Engineering Review

Honest assessment. The CTO speaks first.

### 1.1 Is the architecture realistic?

**Mostly yes, with three important corrections.**

The 25 shipped phases plus Phase 26 V0 already prove the platform substrate works. The 7 remaining blueprints are technically feasible without breakthrough research. This is composition engineering, not novel-AI engineering.

Three corrections to the Master Architecture that must be made before large-scale investment:

1. **The one-hour business creation promise (Phase 31)** — misleading. Real merchant onboarding is not sixty consecutive minutes; it's fifteen minutes of guided conversation + twenty minutes of review + edits + a coffee break + fifteen more minutes of publish. Reframe as "one hour of active user time, spread over the merchant's day." The blueprint is fine; the marketing is not.
2. **The "microservice" framing implicit in Phase 32 workforce discussion** — reject it. Small-scale merchants need low operational overhead. See §4 for the modular monolith recommendation.
3. **Cross-tenant K=5 for all metrics** — insufficient for sensitive pricing metrics. See §6 for the tiered K threshold recommendation.

### 1.2 Is it scalable?

Yes to 100,000 merchants on the Supabase + Vercel stack with the modular-monolith approach. Beyond 100k merchants requires infrastructure investments called out in §6 (partitioning, event log archival, regional deployments). **Do not build for 1M merchants on day one.** That's the mistake that kills platform startups. Build for 100k, plan for 1M, migrate when you cross 50k.

### 1.3 Is it commercially viable?

Yes, with the pricing discipline from ADR-0010 (min £4.99, .99 suffix, ≥95% net after Stripe) and ADR-0003 (no lead-sale, no commission on merchant revenue). Steady-state per-merchant ARPU of £30-£60/mo is honest and achievable. Wholesale channels (Phase 30) will take longer than the roadmap suggests; do not underwrite Year 3 revenue targets on wholesale conversion.

### 1.4 Weak assumptions

Six assumptions that carry material risk:

- **"Trade Brain Authors are recruitable at scale."** Master tradespeople willing to author authoritative playbooks are rare and expensive. Test the recruitment pipeline before committing to full Phase 27 V2 timeline.
- **"K=5 anonymity holds under adversarial de-anonymisation."** In small trades × small regions, K=5 pricing rows may be attributable to a single merchant. Statistical review required before publication.
- **"Merchant advisory panel scales."** 5 pilot merchants per V0 is fine. 5 for every quarterly release across 10 concurrent slices is not. Formalise the panel program with paid honoraria if merchant time matters.
- **"Wholesale revenue materialises in Y3."** Enterprise/wholesale sales cycles are 6-18 months. Real wholesale revenue is more likely Y4.
- **"LLM API costs stay manageable at 100k merchants."** Model costs are a linear function of active merchant work. Budget for £5-15/merchant/mo LLM cost against £30-60/mo ARPU; a squeeze is possible.
- **"Vision AI accuracy sustains through diverse UK/IE/AU regions."** Vision was validated on UK photos. Regional accuracy varies. Budget for regional model fine-tuning at V2+.

### 1.5 Over-engineered areas

- **Phase 29 Twin V0 with full BIM ingest.** BIM is enterprise territory; small merchants don't have IFC files. Ship Twin V0 without BIM; add it when Enterprise tier customers demand it.
- **Phase 27 Trade Brains with 10 modules per trade in V1.** Too much for authors to complete in 6 weeks per Brain. Recommend 6 modules for V1 (craft · regulations · materials · workflow · defects · pricing_model), 10 for V2.
- **Phase 32 "always-on" agents.** Cloud compute cost of standing briefs running 24×7 per agent per merchant is prohibitive at scale. Recommend event-triggered agent activation. Details in §7.

### 1.6 Under-designed areas

- **Data portability + right-to-be-forgotten workflows.** Multiple blueprints reference the requirement; no phase has a concrete implementation. GDPR is not optional. Design this as a first-class engineering feature by end Q1 2027.
- **Multi-user teams inside a merchant.** Most Phase 32 discussion assumes solo merchant. Reality: mid-tier merchants have 2-10 staff. Team RBAC needs to be first-class from Workforce V0.
- **Model outage handling.** The blueprints assume Anthropic API is always available. Design fallback paths (both graceful degradation and vendor swap) as a first-class engineering concern.
- **Merchant onboarding retention flow.** Free tier is designed as a viral loop, but the mechanisms are underspecified. Concrete retention triggers must ship with Business Builder V0.

### 1.7 Systems that should be simplified

- **Phase 32 workforce trust ladder.** Seven levels is more than merchants can meaningfully distinguish. Simplify to four: Observe · Draft · Prepare · Auto-execute (whitelisted). Everything above Draft requires explicit merchant configuration.
- **Multi-perspective Twin views (Phase 29).** V0 should have exactly two perspectives — Merchant + Homeowner. Brain perspectives arrive in V2.
- **Phase 30 signal fusion complexity.** V0 should aggregate signals per subject × region without cross-signal causation graphs. Add causation in V2 once V0 baseline exists.

### 1.8 Systems that should be postponed

- Phase 29 Twin V3 cross-project pattern lending — postponed to Year 4
- Phase 30 wholesale API + Nex-published indices — postponed to Year 4
- Phase 32 cross-national agent teams (V4) — postponed until international expansion proves out
- Phase 33 employee transfer on business sale — legal complexity outweighs early value
- Phase 33 cross-merchant AI shadowing — postponed until Phase 26 rollups mature

### 1.9 CTO summary

The architecture is buildable, ambitious, and defensible. Three assumptions need immediate testing (Brain Authors, K-anonymity strength, LLM cost model). Two systems need concrete first-class engineering work not yet specified (data portability, multi-user RBAC). Several V0 slices should ship simpler than blueprints suggest.

**Approved for engineering, subject to the corrections above.**

---

## Section 2 — Complete System Dependency Map

### 2.1 The definitive graph

```
Level 0 · Infrastructure (already shipped)
  Supabase (Postgres, Storage, Auth, RLS, Realtime) · Vercel · Next.js 16 · Stripe

Level 1 · Platform Core (already shipped, Phases 1-4)
  Nex Chat surface · Intent router · Character library · Knowledge Engine

Level 2 · Domain Engines (already shipped, Phases 5-14, 16-18, 20-25)
  BI · PI · Est · CX · MD · FI · SC · PM · CV · NET · CC · MP · XP · World · Global · Ops · BOS

Level 3 · Mesh + Approvals (already shipped, Phases 15, 24)
  Mesh Runtime · Voice Unifier · Confidence Engine · Autonomy Modes · Approval Flow

Level 4 · Memory Substrate (Phase 26)
  V0 Own-only (shipped) → V1 Cross-tenant (NEXT) → V2 Industry + Market

Level 5 · Trade Expert Brains (Phase 27)
  V0 Electrician Reference → V1 Four Brains → V2 Ten Brains

Level 6 · Compositional Products
  Phase 28 Estimator ← requires Level 5 V1 + Level 4 V1
  Phase 32 Workforce ← requires Level 5 V1 + Level 3
  Phase 33 Workforce Economy ← requires Phase 32 V0

Level 7 · Ecosystem Products
  Phase 31 Business Builder ← requires Phase 28 V0 + Phase 27 V1 + Level 4 V0
  Phase 29 Digital Twin ← requires Phase 27 V1 + Phase 28 V0 + Level 4 V0
  Phase 30 Market Intelligence ← requires Level 4 V1 + Phase 27 V1

Level 8 · Future Expansion (Year 4+)
  International · Wholesale channels · Insurance / FM / homeowner subscriptions · ML-enhanced forecasts
```

### 2.2 Critical path (identical to Playbook §2 but with justifications)

```
Level 4 V1 (Memory cross-tenant)  →  Level 5 V1 (Brains)  →  Level 6 (Estimator V0 · Workforce V0)  →  cascade
```

**Why Memory V1 first, not Brains V0 first?**

The Brain V0 reference implementation depends on Memory V0 (already shipped) — Brains write and read memory rows. But Brain V1 and beyond depend on Memory V1's cross-tenant rollups for regional calibration. Since Memory V1 is 6 weeks and Brain V0 is 6 weeks, run them in parallel. If forced to choose, Memory V1 wins because it's the substrate every downstream phase depends on.

### 2.3 What unlocks what

- **Memory V1 unlocks:** Trade Brain regional calibration · Market Intelligence V0 · Twin cross-project pattern lending
- **Brain V1 unlocks:** Estimator V0 · Workforce V0 · Business Builder V0 · Twin V0
- **Estimator V0 unlocks:** Business Builder V0 (blueprint reads Estimator output as scaffolding) · Twin V0 (initial Twin state seeded from Estimator)
- **Workforce V0 unlocks:** Workforce Economy V0
- **Twin V0 unlocks:** Twin V1-V4 pipeline
- **Market Intelligence V0 unlocks:** Wholesale revenue channels

### 2.4 What can be parallelised

- Memory V1 backend work + Brain V0 authoring (different teams, no code interaction)
- Second-wave Brains (Plumber, Roofer, Carpenter) authored in parallel by 3 humans
- Workforce V0 backend + Workforce Economy V0 frontend
- Twin V0 + Market Intelligence V0 (after critical path completes)

### 2.5 What blocks another system

- Data-portability infrastructure blocks any V1 that touches cross-tenant data (needed for merchant deletion)
- Multi-user RBAC blocks Workforce V0 (agents need to know which team member approved what)
- Model fallback strategy blocks any autonomous-action feature going live
- Legal review blocks Memory V1 cross-tenant read

### 2.6 Risk bottlenecks

- **Trade Brain Author availability** — the biggest single-point-of-failure. If we can't recruit 4 masters in 12 weeks, Y1 plan slides. **Mitigation:** start recruitment week 1; pay well; multiple candidates per trade.
- **Legal counsel bandwidth** — cross-tenant consent framework requires senior counsel review. **Mitigation:** engage retained counsel week 1.
- **Merchant advisory panel fatigue** — 5 merchants can only review so much per quarter. **Mitigation:** grow panel to 15-20 by end Y1; rotate reviewers.

---

## Section 3 — Production Implementation Slices

Simplified from the Playbook §3. See Playbook for the full 20-slice table. Here I emphasise the engineering-material corrections.

### 3.1 Corrections to Blueprint slice definitions

**Trade Brain V1 correction** — ship 6 modules per Brain, not 10:

Ship: craft · regulations · materials · workflow · defects · pricing_model.
Defer: tools · business_tone · sub-specialisations · regional variants (arrive in V2).

Rationale: authoring 10 modules per Brain in 6 weeks is unrealistic. 6 modules is the minimum viable expert. Users notice the missing depth (business tone, regional variants) less than missing core competence.

**Twin V0 correction** — ship without BIM ingest:

Ship: event log · state reducer · timeline UI · Vision reconciler · basic PDF handover.
Defer to V1: BIM ingest (IFC 4.3 · Forge · iTwin.js).

Rationale: BIM is enterprise-scale territory. Small merchants don't have IFC files. Save 6 weeks by deferring.

**Workforce V0 correction** — event-triggered, not always-on:

Ship: 5 agents that wake on event, run standing brief when triggered, sleep afterwards.
Defer: continuous standing brief scheduling (Workforce V1).

Rationale: cloud compute cost of 5 agents × 100k merchants × always-on is prohibitive. Event-triggered agents cost 90% less to run and deliver identical user value.

**Estimator V0 correction** — single Vision AI innovation, not 8:

Ship: Vision reads photos to extract room + fixtures + rough dimensions (baseline).
Defer to V2: substrate detection · age dating · owner-hint · cross-photo consistency · standards flags · warranty serials · sequence-planning · progression scoring.

Rationale: 8 Vision AI innovations in V0 is a research project. Baseline extraction is proven from Phase 13 CV. Ship the value; add innovations one at a time.

### 3.2 Slice acceptance criteria template

Every slice ships when:

1. All Vitest tests pass with 80%+ coverage (90% for substrate)
2. Zero TypeScript errors from `tsc --noEmit`
3. All API endpoints documented in OpenAPI
4. All new tables have RLS policies + at least one policy test
5. All merchant-facing text passes: no em dashes · Nex voice · evidence chain · 12px floor · WCAG contrast
6. Feature flag defaults to off
7. Merchant advisory panel signs off
8. Two weeks of shadow-mode data captured before enabling reads
9. Rollback plan documented and tested in staging

Miss any → slice does not ship.

### 3.3 Deployment risk classification

- **Low risk** — no schema changes · no external API changes · additive UI: Memory rollup enhancements, Brain content updates, UI polish
- **Medium risk** — additive schema · new API endpoints · new UI screens: most V0/V1 slices
- **High risk** — schema migrations · cross-tenant surfaces · autonomous actions: Memory V1, Workforce V0/V1, Twin V0
- **Critical risk** — external partner integrations · payment flow changes · legal-review-required: Wholesale channel V0, international expansion

Every High/Critical risk slice requires: staged rollout · pause button · comprehensive rollback plan · executive sign-off.

---

## Section 4 — System Architecture

### 4.1 Architectural decision: modular monolith, not microservices

**Recommendation: reject the microservice architecture implied by "every service" prompts. Build a modular monolith with strict internal boundaries.**

**Rationale:**

- Nex is a single-application platform serving merchants who see one product
- Microservices multiply operational cost (deployment · monitoring · debugging · testing) by 5-10× at merchant scale
- Splitting later is possible; splitting early is expensive
- The current shipped code (Next.js + Supabase + Anthropic API + modular `src/lib/nex/*` folders) is already the modular-monolith pattern working well
- Companies at Nex's stage (Linear · Stripe · Vercel · Supabase itself) built modular monoliths for their first 3-5 years and only extracted services when specific scalability signals demanded it

**What modular monolith means concretely:**

- Single Next.js codebase
- Modules under `src/lib/nex/<module>/` (matches existing convention)
- Each module exports through a barrel `index.ts` and interacts only through that barrel
- Cross-module calls go through typed contracts; no reaching into internals
- Database is shared (multi-tenant Postgres with RLS enforcement)
- Deployment is one Vercel deploy target

**When to extract into services:**

- Signal for extraction: a module's load pattern is 10× different from the rest (e.g. Vision AI inference on demand vs. Memory reads); handle by moving that module to Vercel Edge Functions or Supabase Edge Functions.
- Signal for extraction: a module's scaling requirement is fundamentally different (e.g. Twin event log at 1B events).
- **Rule: extract when scaling data proves it, never before.**

### 4.2 Module boundaries + responsibilities

Every merchant-facing capability is a module under `src/lib/nex/`. The boundaries below are the source of truth for engineering ownership.

| Module            | Responsibility                                                | Shipped? |
| ----------------- | ------------------------------------------------------------- | -------- |
| `bi/`             | Business intelligence signals                                 | Yes      |
| `pi/`             | Project intelligence per-project                              | Yes      |
| `est/`            | Deterministic estimating math                                 | Yes      |
| `cx/`             | Customer intelligence + CRM signal                            | Yes      |
| `md/`             | Managing Director / workforce briefing                        | Yes      |
| `fi/`             | Financial intelligence                                        | Yes      |
| `sc/`             | Supply chain                                                  | Yes      |
| `pm/`             | Project manager                                               | Yes      |
| `cv/`             | Construction vision                                           | Yes      |
| `net/`            | Network intelligence                                          | Yes      |
| `ab/`             | Autonomous business + approval framework                      | Yes      |
| `cc/`             | Construction cloud (property)                                 | Yes      |
| `mp/`             | Marketplace intelligence                                      | Yes      |
| `xp/`             | Experience intelligence (K-anonymity utilities live here)      | Yes      |
| `orch/`           | Multi-agent mesh + voice unifier + confidence                  | Yes      |
| `world/`          | Construction world model + region                             | Yes      |
| `global/`         | Country-scoped regulations                                    | Yes      |
| `ops/`            | Morning briefing composer                                     | Yes      |
| `twin/`           | Scenario simulator                                            | Yes      |
| `bos/`            | Business Operating System composition                         | Yes      |
| `memory/`         | Memory Engine (V0 shipped)                                    | Partial  |
| `brains/`         | Trade Expert Brains (V0-V2 in progress)                       | No       |
| `estimator/`      | Composed Estimator (Phase 28)                                 | No       |
| `workforce/`      | Workforce runtime (Phase 32)                                  | No       |
| `employment/`     | Employment Centre (Phase 33)                                  | No       |
| `builder/`        | Business Builder (Phase 31)                                   | No       |
| `twin-live/`      | Live event-sourced Twin (Phase 29) — separate from `twin/`     | No       |
| `market/`         | Market Intelligence (Phase 30)                                | No       |

### 4.3 Cross-module communication contract

Every module exports:

- Types (T)
- Pure functions (F)
- Async operations (A)

Cross-module rules:

- **T** — freely imported anywhere
- **F** — freely called anywhere
- **A** — called only through a module's public barrel; never reach into internal files

Enforced by ESLint config forbidding relative imports across module boundaries.

### 4.4 Communication in the runtime

Three communication patterns:

1. **Direct function call** (in-process) — for synchronous cross-module reads within a request. Cheapest, fastest.
2. **Postgres LISTEN/NOTIFY** — for cross-module async events within a merchant session. Realtime-ish.
3. **Task queue table** — for cross-module async events that need durable delivery and retry. Slower but reliable.

**Reject: any full message-broker infrastructure (Kafka, RabbitMQ, SQS).** Not needed at this scale. When needed later, migrate the task queue table to a proper queue service.

### 4.5 Failure handling

Every async operation must be:

- **Idempotent** (safe to retry)
- **Bounded** (has a timeout)
- **Observable** (logs trace ID)
- **Recoverable** (has a dead-letter queue for manual review)

Failed operations write to `hammerex_nex_platform_errors` with full context. Merchant sees nothing except a gentle "we hit a snag" message; engineering sees a rich trace.

---

## Section 5 — Event-Driven Architecture

### 5.1 Recommendation: reject full CQRS/Event-Sourcing except for Twin

Event-sourcing is powerful but expensive. Adopt it only where the benefit (time travel, correction transparency, perspective folding) is worth the cost.

**Adopt event-sourcing for:**

- Phase 29 Twin event log — the benefit is fundamental to the product
- Phase 32 Workforce audit log — legal and safety require append-only

**Reject event-sourcing for:**

- Phase 26 Memory Engine — mutable rows with correction chain is sufficient
- Every other domain module — Postgres CRUD is fine

### 5.2 Event catalog

Events every module can emit + subscribe to:

| Event                        | Emitter        | Typical subscribers                                        | Payload                                              |
| ---------------------------- | -------------- | ---------------------------------------------------------- | ---------------------------------------------------- |
| `project.created`            | pi             | memory · twin-live · workforce · builder · market          | project_id · merchant_slug · trade · region          |
| `quote.issued`               | est · estimator| memory · fi · cx · workforce · market                      | quote_id · scope · total_pence · trade · region      |
| `quote.accepted`             | cx             | memory · fi · workforce · twin-live · bi                   | quote_id · customer_id                               |
| `photo.uploaded`             | sitebook       | cv · twin-live · workforce · memory                        | photo_url · project_id · uploader_id                 |
| `payment.received`           | fi             | memory · cx · workforce                                    | invoice_id · amount_pence                            |
| `delivery.received`          | sc · mp        | memory · twin-live · workforce                             | supplier_slug · sku · on_time_pct · defect           |
| `snag.opened`                | pi · sitebook  | memory · twin-live · workforce · qa                        | project_id · trade · severity                        |
| `merchant.opted_out`         | user           | memory · market · workforce                                | merchant_slug · scope                                |
| `regulation.published`       | global         | brains · workforce · market                                | country · reg_id · trade                             |
| `vision.detected`            | cv             | twin-live · workforce · memory                             | project_id · finding · confidence                    |
| `approval.requested`         | workforce      | ui-approval-inbox                                          | task_id · agent_id · action_class                    |
| `approval.granted`           | user           | workforce · audit_log                                      | task_id                                              |
| `agent.action.executed`      | workforce      | audit_log · market · memory                                | agent_id · action_class · outcome                    |
| `hire.completed`             | employment     | workforce · billing                                        | merchant_slug · agent_id · tier                      |
| `emergency.stop.triggered`   | user           | workforce (halts all)                                      | merchant_slug · timestamp                            |

### 5.3 Publisher / subscriber pattern

- Publishers write events to `hammerex_nex_platform_events` (persistent record) AND emit via Postgres NOTIFY for realtime subscribers
- Subscribers subscribe to specific event kinds and register a handler
- Handler execution is durable (task queue) or in-process (NOTIFY only) depending on kind
- Idempotency guaranteed by unique event_id + subscriber deduplication

### 5.4 Retry strategy

- 3 immediate retries with exponential backoff
- Dead-letter queue after 3 failures
- Alert on dead-letter accumulation

### 5.5 Failure recovery

- Every event is durably persisted before delivery
- Failed subscribers are replayed on service restart
- Manual replay tool for the dead-letter queue

### 5.6 Idempotency

- Every event has a unique event_id
- Every subscriber records processed event_ids
- Re-delivery is safe

---

## Section 6 — Database Strategy

### 6.1 Single Postgres, multi-tenant, RLS-enforced

Reject: separate databases per merchant. Reject: separate schemas per merchant.

Accept: single Postgres · multi-tenant · Row-Level Security policies at row level.

**Rationale:** Supabase RLS is production-grade at merchant scale. Multi-tenant single-DB is the operational standard at every SMB platform (Stripe · Linear · Notion). Splitting per tenant is a 100× operational overhead multiplier without commensurate benefit.

**When to reconsider:** if a merchant tier (Enterprise) requires physically isolated data for compliance, offer dedicated Supabase project as a premium tier deployment option. Do not build this until Enterprise contracts require it.

### 6.2 Table inventory summary

Complete inventory in `NEX_BUILD_EXECUTION_PLAYBOOK_V1.md` §6. Engineering-material additions:

**Add to Memory V1:**
- `hammerex_nex_memory_optout` — merchant opt-out registry
- `hammerex_nex_memory_transparency_log` — "your data helped" reveals

**Add to Twin V0:**
- `hammerex_nex_twin_events` (partitioned by month, indexed on project_id + observed_at)
- `hammerex_nex_twin_snapshots` (cache; regeneratable)

**Add to Workforce V0:**
- `hammerex_nex_workforce_audit_log` (append-only, partitioned by month)
- `hammerex_nex_workforce_dead_letter_queue` (failed agent actions)

**Add for platform-wide:**
- `hammerex_nex_platform_events` (event log)
- `hammerex_nex_platform_errors` (error records)
- `hammerex_nex_platform_feature_flags` (per merchant + per feature)
- `hammerex_nex_platform_gdpr_requests` (data portability + deletion requests)

### 6.3 Indexing strategy (concrete)

- Every tenant table: composite index on `(merchant_slug, created_at DESC)` for range queries
- Every memory/signal table: `(owner_id, subject)` + `(subject, region, observed_at DESC)`
- Twin events: `(project_id, kind, observed_at DESC)` + partitioned by month
- Correction chains: partial index `WHERE correction_of IS NOT NULL`
- Full-text search: tsvector generated columns per already-shipped Phase 4 knowledge pattern
- Vector search: pgvector HNSW indexes on embedding columns

### 6.4 Partitioning strategy

Partition when a table crosses 100M rows OR 50GB.

**Immediate partitioning candidates:**

- `hammerex_nex_twin_events` — partition by month, expected to reach 100M rows in Y2
- `hammerex_nex_platform_events` — partition by month
- `hammerex_nex_workforce_audit_log` — partition by month
- `hammerex_nex_memory_project` — expected to grow fastest; partition by merchant_slug hash (avoid hot-partitioning)

Native Postgres declarative partitioning; no third-party tooling.

### 6.5 K-anonymity threshold refinement (CTO challenge)

**Blueprint says K=5 for all cross-tenant.**

**CTO recommendation: tiered K-thresholds by sensitivity.**

| Metric sensitivity                            | K threshold |
| --------------------------------------------- | ----------- |
| Non-pricing signals (search demand, count-of) | K ≥ 5       |
| Pricing signals (day rate, materials cost)    | K ≥ 10      |
| Margin / profitability signals                | K ≥ 20      |
| Individual customer + payment behaviour        | Never crosses tenant boundary |

**Rationale:** small trade × small region × K=5 pricing rows can be attributed to a specific merchant by anyone with local knowledge. Higher K for pricing preserves anonymity under adversarial de-anonymisation.

### 6.6 Scaling checkpoints

- **100k merchants:** current stack holds; no changes needed
- **500k merchants:** consider dedicated pg replicas for read-heavy queries · consider partitioning strategy review
- **1M merchants:** consider regional Supabase deployments · consider extracting Twin event log to purpose-built store (e.g., ClickHouse) if analytics workloads dominate · consider archival tier for cold data

### 6.7 Archival strategy

- Events + audit logs older than 24 months move to cold storage (Supabase Storage cold tier)
- Memory rows never expire but decay confidence over time (already in Phase 26)
- Photos + videos: hot for 90 days · warm for 12 months · cold thereafter

### 6.8 Backup strategy

- Supabase point-in-time recovery (default)
- Daily snapshots to independent storage (Supabase Storage cross-region bucket)
- Weekly encrypted backup exported to independent S3-compatible provider
- Quarterly restore test to prove backup viability

### 6.9 Cache strategy

- **Vercel Edge Cache** for public-facing marketing pages
- **Redis** (Upstash · low ops cost) for:
  - Twin state snapshots (rebuild from event log takes seconds; cache saves user time)
  - Regional benchmark reads (Memory V1 rollups) — 5-minute TTL
  - LLM prompt cache (Anthropic API responses for identical prompts) — 30-day TTL
- **Postgres materialized views** for expensive cross-table aggregates

Never cache anything without explicit invalidation strategy. Every cache write has a documented TTL and invalidation trigger.

---

## Section 7 — AI Orchestration

### 7.1 Model provider strategy — pragmatic multi-vendor without lock-in

Requirements:
- Primary language model = Claude Opus 4.7 (per merchant memory pin)
- Vision + OCR + Embeddings = OpenAI or Google Document AI (best-in-class per capability)
- Never depend on a single vendor for platform survival

Architecture:

```
Every AI call goes through an ai/ orchestration layer.
  ├─ Router     · picks provider based on capability + fallback rules
  ├─ Adapter    · normalises provider APIs to a common interface
  ├─ Cache      · deduplicates identical prompts (30-day TTL)
  ├─ Budget     · enforces per-merchant daily spend caps
  ├─ Fallback   · if primary fails, degrade gracefully or swap provider
  └─ Audit      · logs every AI call for cost + accuracy analysis
```

Providers are swappable. If Anthropic goes down or prices change, we swap to another Claude-quality provider by updating the router config, not by rewriting business logic.

### 7.2 Responsibility mapping

- **Claude Opus 4.7:** all merchant-facing voice · long-form drafts · agent reasoning · knowledge synthesis · complex reasoning
- **Claude Haiku:** high-volume low-stakes classification · summarisation of already-structured content
- **OpenAI GPT-4-Vision (or equivalent):** photo analysis · drawing interpretation · defect detection
- **OpenAI text-embedding-3 (or Voyage):** embeddings for semantic retrieval
- **Google Document AI:** OCR of PDF specs and drawings

### 7.3 Prompt template management

Every prompt lives in a versioned file: `src/lib/nex/ai/prompts/<domain>/<version>.ts`.

Prompts are:
- Type-safe (variables are typed)
- Testable (rendering is a pure function)
- Versioned (rollback is one config change)
- Documented (every prompt has a description of intent)

Prompt changes go through code review; they are code.

### 7.4 Reasoning + memory retrieval

- Long-context reasoning: Claude Opus 4.7 with structured system prompt + retrieved memory
- Memory retrieval: Phase 26 `retrieveMemory()` returns typed rows; prompt template injects them
- Vector search: pgvector HNSW; retrieved snippets injected into prompt with citation format

### 7.5 Trade Brain integration

Every Trade Brain becomes a prompt template pack:

- Brain JSON (structured data) is loaded once per session
- Brain vocabulary layer applied to output post-processing
- Brain-specific citation format guaranteed
- Brain output is validated against schema before returning to caller

### 7.6 Agent communication

Phase 32 workforce agents use the mesh (Phase 24) — already shipped. No new AI infrastructure required.

Every agent-to-agent message goes through the mesh voice unifier + confidence engine.

### 7.7 Confidence scoring

- Every AI output tagged with confidence: low / medium / high
- Confidence is derived, not asserted
- Formula: sample size × source authority × recency × conflict absence
- Low-confidence outputs shown with prominent visual treatment
- Below a threshold, output is refused with "I don't know" — not fabricated

### 7.8 Human approval integration

- Every AI-drafted action outside the approved auto-execute whitelist requires human approval
- Approval queue is durable and observable
- Batch approval + reject supported

### 7.9 Future model replacement

Prerequisites for painless model swap:

- Every model call is behind an interface
- Every prompt is versioned + testable
- Model-specific quirks (max tokens, function-calling format) are handled in the adapter
- Historical model outputs are stored so A/B comparison is possible

Estimated effort to swap primary language provider: 1 sprint.

---

## Section 8 — Security Architecture

### 8.1 Authentication

- Supabase Auth for merchants + team members
- Email + password + magic link + OAuth (Google + Microsoft for enterprise later)
- 2FA required for Business tier and above (opt-in Starter/Professional)
- Session tokens rotate; long-lived tokens forbidden except for signed API tokens

### 8.2 Authorization (RBAC)

Every merchant has a role hierarchy:

- Owner (root, all permissions)
- Admin (all except billing + team membership changes)
- Manager (department-scoped: Finance manager sees finance; Site manager sees site)
- Member (task-scoped: assigned tasks only)
- Auditor (read-only, no writes)

Permissions are scoped per Studio module + per Workforce agent. Auto-approval limits apply per role.

### 8.3 Encryption

- In transit: TLS 1.3 minimum
- At rest: Supabase default encryption (AES-256)
- Sensitive PII columns: additional application-layer encryption (customer names, addresses, phone numbers). Key management via Supabase secrets.

### 8.4 Secrets management

- All secrets in Vercel + Supabase secrets managers
- Zero secrets in code or config files
- Rotation policy: 90 days for API keys · 24 hours for temporary tokens · annually for encryption keys

### 8.5 API security

- Every merchant-facing endpoint requires authentication
- Every endpoint enforces tenant scope (RLS at DB layer + application-layer double-check)
- Rate limiting per merchant per endpoint (see Playbook §7)
- CSRF protection via SameSite cookies + double-submit tokens
- OWASP Top 10 checklist required before every high/critical-risk slice ships

### 8.6 Prompt injection protection

- Every merchant-provided text that reaches an LLM prompt is sanitised
- Structured prompt templates keep user text in `{{user_input}}` slot; system-level instructions are compiled-in
- Prompt injection attempts logged + rate-limited by merchant
- Adversarial evaluation suite: red-team prompts run against every Brain + agent quarterly

### 8.7 Tenant isolation

- Row-Level Security policies on every tenant table
- Application-layer scope check on every DB call (belt + braces)
- Automated tests verify tenant isolation on every PR
- Cross-tenant read via Memory V1+ / Market Intel is the ONLY exception, gated by K-anonymity

### 8.8 Audit logs

- Every significant action logged to `hammerex_nex_platform_audit_log`
- Immutable · exportable · legally admissible
- Merchant can view their audit trail; export as JSON or CSV

### 8.9 Backups + DR

- Point-in-time recovery via Supabase (24h retention default; extended to 90 days for Business+ tiers)
- Cross-region backup daily
- DR runbook tested quarterly
- RTO 4 hours · RPO 15 minutes (SLA)

### 8.10 GDPR + regional privacy

- Right to be forgotten: cascade deletion across all tables (implemented as `hammerex_nex_platform_gdpr_requests` orchestrator)
- Data portability: full export in machine-readable format
- Consent management: separate table for each consent category with timestamp + version
- Cross-tenant contribution: explicit opt-in required; opt-out immediate

### 8.11 SOC2 readiness

- Structured logs · immutable audit · principle of least privilege · secrets management · encryption everywhere
- Aim for Type 1 by end Y2 · Type 2 by end Y3
- Requires ongoing operations discipline, not just architecture

### 8.12 Construction-specific compliance

- Data retention rules for construction contracts (typically 6-12 years depending on jurisdiction) — implemented as archival policy per Phase 29 Twin
- Insurance-safe evidence chain — every Twin event has a merchant-authenticated timestamp
- Regulator-safe data export — cover for Building Control audits

### 8.13 AI-specific security

- Every AI-generated output tagged with `is_ai_generated: true` in metadata
- Merchant-facing surfaces show provenance
- Every AI action recorded with the prompt version + model version used
- Adversarial testing against known jailbreak techniques quarterly

---

## Section 9 — UI Implementation Order

Per Playbook §8 — same recommended order. Engineering-material additions:

### 9.1 Platform constraints (all devices)

- 12px text floor · 44px tap targets · 4.5:1 contrast
- Lucide icons only
- No em dashes in hero copy
- Object-contain images unless full-bleed hero
- No footers on app surfaces (Facebook-style flow)
- WCAG typography enforced by Studio design system tokens

### 9.2 Device priority

- **Desktop primary** — merchants edit + approve on desktop
- **iPad primary** — merchants use on-site for read + light editing
- **Mobile read-only** — homeowners consume + merchants glance
- Do not build parallel mobile-first interfaces

### 9.3 First-cut screen priority per major feature

Match Playbook §8 for the ordered list. Engineering must:

- Ship desktop first, iPad breakpoints second, mobile last
- Every screen gets keyboard navigation + screen-reader labels
- Every screen has a loading state, error state, empty state, and success state
- Every form has explicit success + error paths

### 9.4 Why this order

- Approval Inbox before Workforce Dashboard: nothing runs without approval; the inbox is the merchant's first Workforce experience
- Estimator wizard before Estimator PDF: value in the flow, not the artefact
- Employment Centre browsable before individual candidate profiles: browsing is the discovery act
- Twin timeline before Twin perspective engine: chronology is the merchant's mental model

---

## Section 10 — Testing Strategy

Reinforced from Playbook §9 with additional CTO-level rigour.

### 10.1 Unit tests

- Vitest, 80% minimum, 90% for substrate modules
- Every PR includes test additions
- Tests co-located with code (`*.test.ts` alongside `*.ts`)

### 10.2 Integration tests

- Real Postgres test instance (Testcontainers)
- Every mesh interaction + every API endpoint + every RLS policy tested
- Run in CI on every PR

### 10.3 AI evaluation

- Every Trade Brain: 100+ scenario tests, human-authored
- Every agent: golden-path scenarios + adversarial scenarios
- LLM output regression: fixed prompt bank rerun on every model change
- Semantic drift detection: sample outputs weekly and compare to baseline

### 10.4 Construction accuracy

- Trade Brain outputs sampled quarterly by human trade advisor (paid honorarium)
- Estimator accuracy tracked against actual project outcomes
- Vision AI ground-truth annotation dataset maintained (500+ images across trades)
- Quarterly accuracy report to CTO + Product

### 10.5 Performance tests

- k6 load-testing infrastructure
- Chat SLA: p95 <5s · p99 <10s
- Estimator generation: p95 <3 minutes
- Twin timeline reconstruction: p95 <500ms
- Load test at 10× current merchant density on every major release

### 10.6 Security tests

- SAST via Semgrep on every PR
- DAST via OWASP ZAP quarterly
- Penetration test annually
- Adversarial AI evaluation quarterly

### 10.7 Regression tests

- Every fixed bug becomes a regression test
- Full regression suite runs on every deploy
- Zero-tolerance on regression failures

### 10.8 Accessibility

- Automated axe-core on every PR
- Manual keyboard navigation review quarterly
- Screen reader review quarterly

### 10.9 Load + chaos

- Chaos test on Twin event log (event storm scenarios) monthly
- Chaos test on Anthropic API outage (fallback behaviour) monthly
- Chaos test on Supabase failure (RLS bypass detection) monthly

### 10.10 User acceptance

- Merchant advisory panel signs off every V0
- KPI capture pre + post rollout

---

## Section 11 — Commercial Readiness

Match Playbook §11. Engineering-material additions:

### 11.1 Revenue events

Every commercial event fires a platform event:

- `subscription.upgraded` → analytics + retention pipeline
- `add_on.purchased` → billing + delivery pipeline
- `trial.started` → onboarding pipeline
- `trial.converted` → analytics
- `trial.expired` → downgrade pipeline

### 11.2 Billing infrastructure

- Stripe subscriptions + one-off charges (per ADR-0010)
- Merchant billing portal via Stripe Customer Portal
- Automatic invoice generation
- Failed payment recovery: 3 retries + email dunning

### 11.3 Feature gating

- Feature flags per tier live in `hammerex_nex_platform_feature_flags`
- Application-layer + UI-layer double-gate
- Downgrade is graceful: feature disappears, data preserved for 90 days

---

## Section 12 — Team Structure

Deeper detail than Playbook §13.

### 12.1 Founding engineering team (Y1 · 5 engineers)

Roles per Playbook. Engineering-material additions:

- Every engineer has secondary competence: primary role + at least one adjacent capability
- Full-stack default; specialists only for AI Engineer + QA
- One-week rotation through every module in first month — no engineer owns a module they haven't touched

### 12.2 Y2 team growth (10 engineers)

- Second backend for Twin event log
- Second AI engineer for Estimator Vision
- Frontend for Business Builder + Twin
- SRE / DevOps
- Security engineer

### 12.3 Y3 team growth (15 engineers)

- Data engineer for Market Intelligence pipelines
- Third frontend for regional dashboards + wholesale portal
- Third AI engineer for cross-project pattern lending
- ML engineer (first) for Phase 30 V3 + Twin V4
- International PM

### 12.4 Non-engineering headcount

- **Trade Brain Authors:** 4 in Y1 · 10 in Y2 · 15 in Y3 (part-time contractors)
- **Legal counsel:** retained engagement (not headcount)
- **Product managers:** 1 in Y1 · 2 in Y2 · 3 in Y3
- **Design:** 1 in Y1 · 2 in Y2 · 3 in Y3
- **Customer Success:** 1 in Y2 · 3 in Y3
- **Data analyst:** 1 in Y2 · 2 in Y3

### 12.5 Engineering culture rules

- Code review required, no exceptions
- Every deploy has an owner-on-call for 24h post-deploy
- Post-mortem blameless within 48h of any Sev-2 incident
- Feature flags: default off, opt-in per merchant, sunset within 90 days of GA
- No unmerged branches over 5 days

### 12.6 Hiring priority (the definitive order)

1. Retain Legal Counsel (week 1)
2. Contract 4 Trade Brain Authors (weeks 1-4)
3. Hire 1st Backend/Full-stack (week 2)
4. Hire 1st AI Engineer (week 4)
5. Hire 1st Product Designer (week 6)
6. Hire 1st QA Engineer (week 8)
7. Hire 1st Frontend Engineer (week 12)
8. Hire 1st Product Manager (week 16)

Everything after is demand-driven.

---

## Section 13 — Implementation Calendar

Match Playbook §14 for the quarter-by-quarter table. Engineering-material additions:

### 13.1 Risk checkpoints per quarter

Every quarter closes with a risk review chaired by CTO. Any red-status risk moves to executive review the following week.

### 13.2 Success metrics per quarter

Per quarter, capture:

- Slice completion rate (delivered / planned)
- Bug bar violations (open Sev-1 count)
- Merchant advisory panel NPS
- ARPU delta vs quarter baseline
- New merchant acquisition rate
- LLM cost per merchant
- Uptime SLA (99.9% target)

### 13.3 Platform maturity milestones

- End Y1: substrate + Estimator + Workforce + Employment Centre live for pilot cohort
- End Y2: full workforce · Business Builder · Twin V0 in Commercial GA
- End Y3: Market Intelligence · wholesale pilots · international pilots
- End Y4: international expansion · wholesale steady revenue
- End Y5: category-defining · default platform for construction merchants in launch markets

---

## Section 14 — Final CTO Sign-Off

### 14.1 Architectural decisions I would change from prior blueprints

1. **Reject full microservice architecture. Adopt modular monolith.** Fewer moving parts. Easier deployment. Extract services later when scaling data demands. See §4.
2. **Reject full CQRS/Event Sourcing except for Twin + Audit Log.** Complexity cost is not justified for domain modules. See §5.
3. **Change K-anonymity threshold to tiered (K≥10 for pricing, K≥20 for margin, K≥5 for demand signals).** K=5 for pricing is insufficient. See §6.5.
4. **Ship Trade Brain V1 with 6 modules, not 10.** Author capacity is limited. See §3.1.
5. **Ship Estimator V0 with 1 Vision AI innovation, not 8.** Ship value now, add innovations one at a time. See §3.1.
6. **Ship Twin V0 without BIM ingest.** Defer to V1. See §3.1.
7. **Ship Workforce V0 as event-triggered, not always-on.** Compute cost prohibitive at scale. See §3.1.
8. **Simplify Workforce trust ladder from 7 levels to 4.** Merchants cannot distinguish 7 levels. Observe / Draft / Prepare / Auto (whitelisted).
9. **Reject Kafka / RabbitMQ / SQS. Use Postgres LISTEN/NOTIFY + task queue tables.** Scale-appropriate. Extract when data demands it.
10. **Reject separate databases per merchant. Multi-tenant with RLS.** Operational overhead of tenant DBs is not justified until Enterprise contracts require it.
11. **Reframe "one-hour business creation" as "one hour of active user time".** Honest marketing.
12. **Add data portability + right-to-be-forgotten workflows as first-class engineering.** GDPR is not optional.
13. **Add multi-user team RBAC as first-class from Workforce V0.** Mid-tier merchants have teams.
14. **Add model outage handling as first-class.** Anthropic API is not always available.

### 14.2 Simplifications applied

- Workforce trust ladder: 7 → 4 levels
- Trade Brain modules: 10 → 6 for V1
- Estimator Vision AI: 8 innovations → 1 baseline for V0
- Twin V0 scope: BIM ingest deferred
- Multi-perspective Twin: full Brain perspectives → merchant + homeowner only for V0

### 14.3 Weak architecture identified + fixed

- Missing data portability infrastructure → added to Y1 scope (§8.10)
- Missing multi-user RBAC → added to Workforce V0 (§8.2)
- Missing model outage handling → added to AI orchestration (§7.9)
- Insufficient K-anonymity threshold for pricing → tiered thresholds (§6.5)
- Missing archival + partitioning strategy → concrete plan (§6.4)
- Over-optimistic "always-on" agent model → event-triggered (§3.1)

### 14.4 Technical debt risks

- **Feature-flag proliferation** — mitigate with mandatory sunset within 90 days of GA
- **Schema migrations without downtime** — every migration must be online-safe (add columns → dual-write → cutover → drop old)
- **Prompt-template versioning drift** — every prompt in code, versioned, tested
- **Model API contract changes** — abstract adapter layer, monitored contract tests
- **Tenant table growth** — partitioning strategy per §6.4

### 14.5 Commercial risks

- **Trade Brain Author availability** — recruit continuously, pay honoraria
- **Merchant advisory panel scale** — grow to 15-20 by end Y1
- **Wholesale revenue timing** — do not underwrite Y3 on wholesale conversion
- **LLM cost inflation** — budget £5-15/merchant/mo · monitor closely · cache aggressively

### 14.6 Scaling risks

- **Twin event log at 100M+ events** — partition by month · archive to cold storage · cache snapshots
- **Vision AI throughput at 10k+ photos/day** — parallelise · batch · throttle
- **Realtime channel load at 100k+ concurrent users** — Supabase Realtime evaluation Q4 2027
- **Regional deployments for latency** — plan for regional Vercel + Supabase after 500k merchants

### 14.7 Security risks

- **AI-generated content misrepresentation** — provenance always visible
- **Cross-tenant PII leak via inference** — K-thresholds tiered per §6.5
- **Prompt injection via merchant text** — sanitisation + monitoring
- **Autonomous agent overreach** — draft-not-execute default · Level 4 (previously Level 6) whitelist only

### 14.8 AI risks

- **Model provider vendor lock-in** — abstraction layer · fallback provider ready
- **Model regression on version upgrade** — regression test suite
- **Hallucination in high-stakes surfaces** — confidence thresholds + human approval
- **Model cost explosion** — per-merchant budget caps · caching · Haiku for low-stakes

### 14.9 Construction-specific risks

- **Regulation lag** — Phase 21 diff cron · alert workflow
- **Trade Brain accuracy under real conditions** — quarterly accuracy audits with paid trade advisors
- **Regional vocabulary drift** — merchant contribution loop
- **Vision AI regional accuracy** — expand ground-truth dataset regionally

### 14.10 CTO sign-off

**Approved subject to the 14 architectural corrections in §14.1.** Every correction reduces complexity, cost, or risk without reducing merchant value. Engineering may proceed under the following conditions:

1. All 5 ADRs ratified in week 1 (per Playbook §15)
2. Legal counsel retained in week 1
3. Trade Brain Authors under contract by week 4
4. Data portability workflow specified by end of Q3 2026
5. Multi-user RBAC in Workforce V0 scope
6. Model outage handling in AI orchestration V0 scope
7. Tiered K-anonymity in Memory V1 scope
8. First quarterly CTO risk review at end of Q3 2026

---

## Section 15 — Engineering Backlog (Reference Pattern)

Placed last as a reference. Full backlog will live in Jira / Linear once engineering starts.

### 15.1 The backlog structure

- **Epic** → owned by a Staff Engineer + Product Manager
- **Feature** → owned by a Senior Engineer + Designer
- **Story** → owned by an engineer
- **Task** → estimated in Fibonacci (1/2/3/5/8/13)

### 15.2 Definition-of-Done per task

- Code shipped
- Vitest coverage ≥ 80%
- Zero TS errors
- API documented in OpenAPI
- RLS policy tested (if new table)
- Merchant-facing text passes platform rules
- Feature flag defaulted off
- Rollback plan documented

### 15.3 Two reference epics fully decomposed

See `NEX_BUILD_EXECUTION_PLAYBOOK_V1.md` §4 for the worked examples on Memory V1 K-anonymity gate + Workforce Economy Hire Conversation. This document does not duplicate; refer to the Playbook.

---

## Appendix A — Documents in the Nex canon

Ordered by authority for engineering decision-making:

1. **This document** — engineering execution decisions (HOW · WHY)
2. **NEX_BUILD_EXECUTION_PLAYBOOK_V1.md** — engineering execution manual (HOW · WHEN)
3. **NEX_MASTER_ARCHITECTURE_V1.md** — product roadmap (WHAT · WHY)
4. **Individual Phase Blueprints (26-33)** — phase-specific functionality
5. **CLAUDE.md** — repository conventions
6. **ADR-0001 through ADR-0015** — architectural decision records
7. **MEMORY.md** — persistent context

When any two disagree on engineering matters, this document wins. When any two disagree on product functionality, the individual blueprint wins. When any two disagree on roadmap sequencing, the Master Architecture wins.

---

## Appendix B — The definitive engineering principles

The five principles every engineering decision at Nex must uphold:

1. **Substrate before surface.** The layer below is more important than the layer above. Do not skip foundations.
2. **Modular monolith by default.** Extract services only when data forces it.
3. **Evidence-or-silence.** Every displayed number cites its source or is hidden.
4. **Draft-not-execute default.** Autonomous action is opt-in with hard caps + audit.
5. **Consent + honesty are non-negotiable.** No fake data, no hidden inference, no unauthorised cross-tenant reads.

Every architectural decision is checked against these five. When a decision fails one, the decision changes, not the principle.

---

**End of Nex Engineering Execution Bible v1.0.**

*This document is the reference. The Playbook is the manual. The Master Architecture is the plan. The Blueprints are the specifications. Together they are enough to build Nex. Ship.*

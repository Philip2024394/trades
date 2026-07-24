# Nex Build Execution Playbook v1.0

**Execution manual · 2026-07-23**
**Purpose:** turn `NEX_MASTER_ARCHITECTURE_V1.md` into actual buildable work. This is the engineering bible — every developer, AI engineer, UI designer, QA engineer, and product manager works from this document. Every feature already exists in a phase blueprint; this playbook is how they get built.

---

## Section 1 — Executive Build Strategy

Nex has 25 phases shipped and 8 phases (26 V0 + 7 blueprints) in progressing state. The next 18 months turn seven blueprints into shipped product following one non-negotiable critical path:

```
Memory V1  →  Trade Brains V1  →  Estimator V0  →  Workforce V0  →  everything else
```

Every commercial multiplier phase (28, 31, 32, 33) sits on top of the substrate phases (26, 27). Substrate first is not a preference — it is the physical dependency structure of the platform.

The strategy in five bullets:

1. **Substrate before surface.** Memory V1 + Trade Brains V1 authored before any consumer-facing multi-trade feature ships. Six weeks each.
2. **Ship in vertical slices.** Every V0 covers one trade, one region, one currency, one language, end-to-end. Then widen.
3. **Shadow mode before live.** Every substrate slice runs writes-only for 2 weeks before merchants see reads.
4. **Merchant advisory panel gates every V0.** Five pilot merchants review each new slice before broad rollout.
5. **Revenue closes each quarter.** Every quarter ends with at least one shipped feature that lifts ARPU or acquisition rate.

Team size assumptions for this plan: **5 engineers Year 1, 10 engineers Year 2, 15 engineers Year 3.** Sizing detail in Section 13. Every slice's complexity assumes this staffing.

Non-negotiables that override any timeline pressure:

- Draft-not-execute default on every autonomous action (Phase 15/32 rule)
- Evidence-or-silence on every displayed number
- K-anonymity K≥5 for every cross-tenant surface
- No voice AI on customer purchasing path
- Every schema ratified as ADR before code
- Every ADR-0010 add-on price passes the ≥95% Stripe margin gate
- Merchant memory rules apply platform-wide (see MEMORY.md)

---

## Section 2 — System Dependency Graph

### 2.1 The graph

```
FOUNDATIONAL (all shipped)
  Phase 1-4 · Nex conversational surface
  Phase 5-14 · Domain engines (BI, PI, Est, CX, MD, FI, SC, PM, CV, NET)
  Phase 15 · Autonomous Business (approval framework)
  Phase 24 · Multi-Agent Mesh
  Phase 25 · BOS morning brief
  Phase 26 · Memory Engine V0
  Studio + SiteBook + Trade Centre + Marketplace

CRITICAL PATH (in flight)
  Memory V1 (cross-tenant rollups) ─┬─→ Trade Brains V1 ─┬─→ Estimator V0
  Memory V0 ────────────────────────┘                    │
                                                          │
                                          Trade Brains V1 ┤
                                                          ├─→ Workforce V0 (Phase 32)
                                            Mesh (Ph 24) ─┤
                                                AB (Ph15) ─┘

  Workforce V0 ─→ Workforce Economy V0 (Phase 33)
  Estimator V0 ─→ Business Builder V0 (Phase 31)
  Estimator V0 ─→ Twin V0 (Phase 29)
  Trade Brains V1 ─→ Twin V0
  Memory V1 ─→ Market Intelligence V0 (Phase 30, parallel with Twin)

DOWNSTREAM (Year 3+)
  Twin V0 ─→ Twin V1-V4
  Market Intel V0 ─→ Wholesale channels
  Business Builder V0 ─→ V1-V4
  Workforce V0 ─→ V1-V4
```

### 2.2 What must exist first

Before any Year-1 work begins:
- Phase 26 Memory V0 code (already shipped)
- Phase 24 mesh (already shipped)
- Phase 15 AB (already shipped)
- Phase 25 BOS (already shipped)
- Studio App Store manifest system (already shipped)

### 2.3 What can be parallelised

- Memory V1 + Trade Brain V0 (different teams, no interaction)
- Trade Brains V2 second wave (5 Brains in parallel with 5 different authors)
- Twin V0 + Market Intelligence V0 (once critical path completes)
- Workforce V0 + Workforce Economy V0 (frontend vs backend split)
- Business Builder V0 + Twin V0 (different consumer surfaces)

### 2.4 What blocks another system

- Trade Brain contract ADR blocks all Brain authoring
- Twin event log schema ADR blocks Twin V0 (once ratified, no more schema changes)
- Workforce trust ladder ADR blocks Workforce V0 code
- Memory V1 privacy rules ADR blocks any cross-tenant surface

### 2.5 Critical path (18 months)

Sequenced with weeks-to-complete:

| Step | Work                                                          | Weeks | Team    |
| ---- | ------------------------------------------------------------- | ----- | ------- |
| 1    | Ratify 5 ADRs (Memory privacy · Brain contract · Twin schema · Workforce ladder · Workforce Economy honesty) | 2 | Product + Legal |
| 2    | Memory V1 (cross-tenant rollups + K-anonymity gate)            | 6     | Backend |
| 3    | Trade Brain V0 (Electrician reference implementation)          | 6     | AI Eng + Brain Author (parallel with step 2) |
| 4    | Migrate Phase 24 trade agents to Brain contract               | 2     | AI Eng  |
| 5    | Trade Brain V1 (Plumber + Roofer + Carpenter authored)         | 12    | 3 Authors in parallel |
| 6    | Estimator V0 (kitchen + bathroom, single trade end-to-end)     | 6     | Full stack |
| 7    | Estimator V1 (multi-trade composition)                         | 6     | Full stack |
| 8    | Workforce V0 (5 core agents + approval inbox + emergency stop) | 12    | Backend + Frontend |
| 9    | Workforce Economy V0 (Employment Centre + hire conversation)   | 10    | Frontend (parallel with step 8) |

At step 9 completion, Year 1 exits with revenue-critical infrastructure live.

---

## Section 3 — Slice Planning

Every slice has eight fields: Purpose · Deliverables · Exit criteria · Technical requirements · User value · Commercial value · Complexity · Dependencies.

### 3.1 Memory V0 (SHIPPED · reference only)

- **Purpose** — persistent owner-scoped memory substrate
- **Deliverables** — 3 tables (user, company, project) · writer · reader · correction chain · adapters (PI/est/CX/FI) · answer classifier
- **Exit** — 41 tests pass · zero TS errors · chat wired
- **Tech** — Supabase · RLS · `hammerex_nex_memory_*`
- **User value** — "how did I price a kitchen last time?" recall
- **Commercial value** — foundation only (no direct revenue)
- **Complexity** — Medium
- **Dependencies** — Phase 4 knowledge already shipped

### 3.2 Memory V1 (NEXT · Q3 2026)

- **Purpose** — cross-tenant rollups + K-anonymity gate
- **Deliverables** — 2 new tables (trade, region) · nightly rollup cron · K-anonymity gate · read scope enforcement (paid tier) · "how do I compare to my region?" chat surface · merchant opt-out UI · "your data helped" transparency surface
- **Exit** — 5+ contributing merchants per rollup slice · K≥5 gate enforced at query layer · rollup crons run nightly with monitoring · opt-out toggle live in Studio
- **Tech** — pg_cron for nightly rollup · reuse `xp/anonymise.ts` for K-check · new `memory/rollup.ts`
- **User value** — regional peer benchmarks in chat
- **Commercial value** — Professional tier upgrade driver (regional benchmark reads gate to £14.99/mo)
- **Complexity** — High (privacy + rollup math + UI surfaces)
- **Dependencies** — Memory V0 · Memory privacy ADR ratified · legal review

### 3.3 Memory V2 (Year 2 · Q2 2028)

- **Purpose** — industry + market layers · verification + decay
- **Deliverables** — 2 new tables (industry, market) · weekly + daily rollup crons · dual-source verification pipeline · confidence decay cron · conflict detection UI · Regional Pricing Report PDF · Supplier Intelligence pack · Custom Benchmark Query
- **Exit** — automated verification passing >80% · confidence decay applied nightly · first paying customer for Regional Pricing Report
- **Tech** — additional crons · Stripe SKU wiring per ADR-0010 · PDF generation
- **User value** — cross-trade + market signal surfaces
- **Commercial value** — first premium add-on revenue (£4.99-£9.99/mo)
- **Complexity** — High
- **Dependencies** — Memory V1 · Phase 30 Market Intelligence V0

### 3.4 Trade Brain V0 (Electrician reference · Q3-Q4 2026)

- **Purpose** — prove the 10-module Brain contract end-to-end for one trade
- **Deliverables** — Brain JSON pack schema · runtime loader · boot audit · Electrician Brain fully authored (craft, regulations, materials, tools, workflow, defects, pricing_model, business_tone, sub-specialisations, regional variants) · mesh integration · full Vitest coverage
- **Exit** — Brain replaces Phase 24 `electrician` agent · registry audit passes · 40+ tests · merchant advisory panel validates authenticity
- **Tech** — JSON schema + Zod validation · new `src/lib/nex/brains/electrician/*` folder · `brainLoader.ts`
- **User value** — expert answers for electrical questions
- **Commercial value** — Professional tier depth (electrician merchants)
- **Complexity** — Medium (framework) · High (authoring quality)
- **Dependencies** — Brain contract ADR ratified · Electrician Master (human trade advisor) recruited

### 3.5 Trade Brain V1 (5 total · Q4 2026 → Q1 2027)

- **Purpose** — critical mass of trades + Phase 24 migration
- **Deliverables** — Plumber Brain · Roofer Brain · Carpenter Brain (Bricklayer as stretch) · migrated Phase 24 trade agents to Brain contract
- **Exit** — 4 Brains authored · all Phase 24 trade agents migrated · registry audit passes · merchant advisory validates each
- **Tech** — same pattern per Brain
- **User value** — 4 major trades fully supported
- **Commercial value** — unlocks Phase 28 Estimator V0 (blocker cleared)
- **Complexity** — Medium per Brain (framework proven at V0)
- **Dependencies** — V0 · 3 Brain Authors recruited

### 3.6 Trade Brain V2 (Second wave · Year 2)

- **Purpose** — cover 10+ trades total
- **Deliverables** — Plasterer · Painter · Tiler · Landscaper · Bricklayer (if not in V1) authored
- **Exit** — 10 Brains total · every existing merchant has a full Brain match
- **Complexity** — Medium per Brain
- **Dependencies** — V1

### 3.7 Estimator V0 (kitchen + bathroom · Q1 2027)

- **Purpose** — single-trade end-to-end estimating with photo + brief inputs
- **Deliverables** — Input Router · Scope Assembler · Trade Brain fan-out (kitchen + bathroom trades) · Composition Layer · Material + Labour Intelligence · Profit Optimiser · basic PDF quote generator
- **Exit** — merchant uploads photos + brief · receives 3-price quote in <5 minutes · merchant approves before customer send · at least 3 pilot merchants issue real quotes
- **Tech** — reuse Phase 7 est · new `estimator/pipeline.ts` · reuse Phase 13 CV
- **User value** — 10× faster quotes
- **Commercial value** — HIGHEST commercial delta of any slice
- **Complexity** — High
- **Dependencies** — Trade Brain V1 · Phase 13 CV shipped · Phase 26 V1 (for regional defaults)

### 3.8 Estimator V1 (multi-trade · Q1-Q2 2027)

- **Purpose** — full kitchen + bathroom + extension composition
- **Deliverables** — multi-trade sequencing · shared-scaffold + skip-hire dedup · interactive proposal (web-native) · digital approval · alternate finish preview
- **Exit** — merchant issues multi-trade quotes · interactive proposal in browser · 10+ pilot merchants live
- **Commercial value** — quote-to-close rate uplift
- **Complexity** — High
- **Dependencies** — V0

### 3.9 Estimator V2 (Vision AI innovations · Year 2)

- **Purpose** — 8 unique Vision features from Phase 28 blueprint §8.2
- **Deliverables** — substrate detection · age dating · owner-hint · progression · cross-photo consistency · standards flags · warranty serial extraction · sequence-planning
- **Complexity** — Very high (multiple Vision prompts + Trade Brain calibration)
- **Dependencies** — V1 · Phase 29 Twin V0 (for progression feature)

### 3.10 Workforce V0 (5 agents · Q2-Q3 2027)

- **Purpose** — always-on core team + approval inbox + emergency stop
- **Deliverables** — Role Manifest Runtime · Standing-brief Scheduler · Approval Inbox UI · Emergency Stop controller · 5 agents (CEO/Estimator/Finance/CRM/Marketing) as Draft-level employees · KPI tracking
- **Exit** — 5 agents active for pilot merchants · daily draft output · zero merchant complaints about autonomous overreach · emergency stop tested
- **Tech** — serverless functions per agent · new `hammerex_nex_workforce_*` tables · reuse Phase 32 agent contracts
- **User value** — first "colleagues did work overnight" experience
- **Commercial value** — Professional/Business tier upgrade driver
- **Complexity** — Very high
- **Dependencies** — Trade Brain V1 · Workforce trust ladder ADR · Phase 24 mesh · Phase 25 BOS actions

### 3.11 Workforce V1 (Full mid-tier team · Year 2)

- **Purpose** — 15 agents total, Prepare-level authority
- **Deliverables** — Site Mgr · Project Mgr · Procurement Mgr · Customer Success · Trade Expert agents · KPI dashboards
- **Complexity** — High
- **Dependencies** — V0

### 3.12 Workforce V2 (Full 25+ workforce · Year 2)

- **Purpose** — full org chart + selective Level 6 whitelisting
- **Deliverables** — Ops · Scheduler · Inventory · Supplier · H&S · QA · Compliance · Market Intel · Knowledge · Memory · Doc Controller · Training agents · Level 6 opt-in flow
- **Complexity** — Very high
- **Dependencies** — V1

### 3.13 Workforce Economy V0 (Employment Centre · Q2 2027)

- **Purpose** — hire conversation + browsable candidate profiles for the 5 core V0 agents
- **Deliverables** — Employment Centre browsable page · candidate profile pages · hire conversation flow · 14-day trial infrastructure · Employee Profile Manager (living profiles once hired)
- **Exit** — merchant hires an agent via conversation · sees agent's first-morning report next day · 20+ pilot merchants complete a hire
- **Tech** — new `src/apps/employment-centre/` · reuse Studio App Store manifest patterns
- **User value** — category-shift moment
- **Commercial value** — trial-to-paid conversion driver
- **Complexity** — High (UX-heavy)
- **Dependencies** — Workforce V0 · Workforce Economy honesty ADR · 14-day trial billing plumbed

### 3.14 Business Builder V0 (Electrician · Year 2 Q1)

- **Purpose** — one-hour business launch for electrician merchants
- **Deliverables** — 5-step onboarding conversation · Business Blueprint Generator · Draft Preview Renderer · Public Register Verifier (Companies House + Gas Safe) · Assumption Ledger · complete tradesite generation
- **Exit** — new merchant onboards in <60 minutes · publishes tradesite · zero fabrications caught in QA
- **Tech** — new `src/apps/business-builder/` · reuse Studio manifest emission · new verification-service adapters
- **Commercial value** — acquisition friction removed
- **Complexity** — Very high
- **Dependencies** — Trade Brain V1 · Estimator V0 · Memory V0 (all shipped by then)

### 3.15 Twin V0 (event log + timeline · Year 2)

- **Purpose** — event-sourced project state for live projects
- **Deliverables** — `hammerex_nex_twin_events` table · state reducer per layer · timeline UI · Vision reconciler · basic handover PDF
- **Exit** — 10 pilot projects with active Twins · time-travel to any prior date works · handover PDF generates correctly
- **Tech** — append-only event log · snapshot cache · reuse Phase 13 CV for reconciler
- **Complexity** — Very high
- **Dependencies** — Twin event log schema ADR · Trade Brain V1 · Estimator V0

### 3.16 Twin V1 (perspective + prediction + BIM · Year 2)

- **Purpose** — Brain perspectives + predictive dashboard + BIM ingest
- **Deliverables** — Perspective Engine · Predictive Engine (reuses Phase 25 BOS) · IFC 4.3 ingest · Forge/iTwin.js embed
- **Complexity** — High
- **Dependencies** — V0

### 3.17 Twin V2 (Homeowner portal + drone/LiDAR · Year 3)

- **Purpose** — homeowner-facing surface + advanced ingest
- **Deliverables** — Homeowner Portal · Drone photogrammetry pipeline · LiDAR ingest · post-completion warranty vault
- **Complexity** — Very high
- **Dependencies** — V1

### 3.18 Market Intelligence V0 (Q1-Q2 2029)

- **Purpose** — signal store + regional dashboard for 5 UK regions
- **Deliverables** — `hammerex_nex_market_signals` table · public feed ingest crons (planning apps · weather · ONS · Land Registry · Companies House) · 5-region dashboard · forecast composition (deterministic only)
- **Exit** — 5 regional dashboards live · every displayed number has signal chain · monthly merchant usage metric
- **Tech** — new `src/lib/nex/market/*` · adapter per feed · pg_cron nightly · Vercel Cron for external ingest
- **Complexity** — High
- **Dependencies** — Memory V1 · Phase 25 BOS · Phase 27 Brains V1

### 3.19 Market Intelligence V1 (Advisors + benchmarks · Year 3)

- **Purpose** — merchant-facing advisor + opportunity feed
- **Deliverables** — Material Advisor · Labour Advisor · Opportunity Feed · Benchmark Suite
- **Complexity** — Medium
- **Dependencies** — V0

### 3.20 Market Intelligence V2 (AI Advisor + wholesale channel · Year 3)

- **Purpose** — AI Market Advisor Q&A + first wholesale product
- **Deliverables** — AI Advisor Q&A · Regional Market Report PDF (paid £4.99/mo) · Supplier Intelligence pack (£9.99/mo) · Custom Benchmark Query
- **Commercial value** — first wholesale-adjacent revenue
- **Complexity** — High
- **Dependencies** — V1

---

## Section 4 — Developer Backlog (Epic → Feature → Story → Task)

Pattern illustrated with two representative epics. The full backlog follows this shape; import into Jira/Linear as needed.

### 4.1 Epic — Memory V1 · cross-tenant rollups

**Features:**

1. Trade + Region tables + migrations
2. Nightly rollup cron
3. K-anonymity gate at read layer
4. Merchant opt-out UI
5. "Your data helped" transparency surface
6. "How do I compare to my region?" chat handler

**Stories under Feature 3 (K-anonymity gate):**

- As a merchant on Professional tier, I can read regional benchmarks only when K≥5 contributing merchants exist
- As a merchant, I never see PII from other merchants in my regional read
- As a developer, I can call `retrieveRegionalRollup()` and receive a K-checked result or an honest "not enough peers yet" response

**Tasks under story 3.1:**

- Add `min_contributor_count` field to rollup rows (schema migration, complexity 1)
- Extend `retrieveMemory()` reader to enforce K-min on trade/region layer reads (complexity 3)
- Write Vitest coverage for K-min gating with edge cases (complexity 2)
- Add UI copy "not enough peers yet" state to regional dashboard (complexity 1)
- Add integration test for cross-tenant read with 4 vs 5 contributor scenarios (complexity 2)

**Complexity legend** — 1 = <1 day · 2 = 1-3 days · 3 = 3-5 days · 5 = 1-2 weeks · 8 = 2-4 weeks · 13 = >4 weeks.

### 4.2 Epic — Workforce Economy V0 · Employment Centre + Hire Conversation

**Features:**

1. Employment Centre browsable UI
2. Candidate profile pages
3. Hire conversation runtime
4. 14-day trial billing infrastructure
5. Employee Profile Manager
6. First-morning report generator

**Stories under Feature 3 (Hire Conversation):**

- As a merchant, I can start a hire from an EC candidate profile
- As a merchant, I answer role-specific onboarding questions in chat
- As a merchant, the AI employee proposes a first-week focus and I approve or edit
- As a merchant, I see the employee join my Workforce dashboard within 60 seconds
- As a developer, hire conversations resume if merchant closes the tab

**Tasks under story 3.1:**

- Add "Hire" action to candidate profile page CTA (complexity 1)
- Route to new hire conversation runtime with candidate context (complexity 2)
- Persist hire session state in `hammerex_nex_workforce_hires` (complexity 2)
- Add Vitest coverage for hire session start (complexity 1)

### 4.3 Backlog structure principles

- Every task carries complexity in Fibonacci (1/2/3/5/8/13)
- Every task has an owner + reviewer + tests + docs checkbox
- Every epic has an ADR reference (Section 1's 5 ADRs listed)
- Every feature has acceptance criteria + evidence-chain notes
- Every epic ships to shadow mode 2 weeks before live

---

## Section 5 — Architecture Diagram

### 5.1 Complete service architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js 16)                             │
│  ┌─────────────┬───────────────┬────────────────┬──────────────────┐   │
│  │  Studio     │ SiteBook      │ Employment     │ Nex Chat         │   │
│  │  (merchant) │ (homeowner +  │ Centre         │ (embedded across │   │
│  │             │  merchant)    │ (Phase 33)     │  every surface)  │   │
│  └─────────────┴───────────────┴────────────────┴──────────────────┘   │
│  ┌─────────────┬───────────────┬────────────────┬──────────────────┐   │
│  │ Trade Centre│ Twin Timeline │ Approval Inbox │ Regional         │   │
│  │             │ (Phase 29)    │ (Phase 32)     │ Dashboards       │   │
│  │             │               │                │ (Phase 30)       │   │
│  └─────────────┴───────────────┴────────────────┴──────────────────┘   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │  React Server Components
                                   │  + tRPC / REST + Realtime channels
┌──────────────────────────────────▼─────────────────────────────────────┐
│                      API Gateway (Next.js Route Handlers)              │
│  · Auth middleware (Supabase Auth)                                     │
│  · Rate limiter (per merchant · per API class)                         │
│  · Approval gate injection (for Phase 32 workforce actions)             │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
     ┌─────────────────────────────┼─────────────────────────────┐
     │                             │                             │
     ▼                             ▼                             ▼
┌──────────┐                ┌────────────┐               ┌──────────────┐
│  Domain  │                │ AI Runtime │               │ Background   │
│  Engines │◀───────────────│ · Mesh     │──────────────▶│  Workers     │
│  (5-25)  │                │ · Brains   │               │ · Standing   │
│          │                │ · Anthropic│               │   briefs     │
│          │                │   API      │               │ · Ingest     │
│          │                │            │               │   crons      │
└─────┬────┘                └──────┬─────┘               └──────┬───────┘
      │                             │                            │
      └──────────────┬──────────────┴────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                Substrate Layer                                          │
│  ┌─────────────┬───────────────┬────────────────┬──────────────────┐   │
│  │  Postgres   │  Storage      │ Vector store   │ Event log        │   │
│  │  (Supabase) │  (Supabase)   │ (pgvector)     │ (Twin events)    │   │
│  │             │               │                │                  │   │
│  └─────────────┴───────────────┴────────────────┴──────────────────┘   │
│  ┌─────────────┬───────────────┬────────────────┬──────────────────┐   │
│  │  Memory     │ Signal store  │ Audit log      │ Approval queue   │   │
│  │  substrate  │ (Ph 30)       │ (per merchant) │ (Ph 32)          │   │
│  └─────────────┴───────────────┴────────────────┴──────────────────┘   │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
              ┌──────────┐   ┌─────────────┐   ┌──────────────┐
              │ Anthropic│   │ OpenAI      │   │ Public APIs  │
              │ (Claude  │   │ (Vision +   │   │ (Companies   │
              │  Opus    │   │  Embeddings)│   │  House,      │
              │  4.7)    │   │             │   │  Gas Safe,   │
              │          │   │             │   │  Met Office, │
              │          │   │             │   │  ONS)        │
              └──────────┘   └─────────────┘   └──────────────┘
```

### 5.2 Key infrastructure components

- **Frontend** — Next.js 16 · React Server Components · Tailwind · deployed to Vercel
- **Backend** — Next.js Route Handlers · TypeScript · Vitest · deployed to Vercel
- **Database** — Supabase Postgres (row-level security enabled on all tenant tables)
- **Queues** — Postgres-backed job queue for Workforce standing briefs
- **Workers** — Serverless functions on Vercel · pg_cron for periodic aggregations
- **Events** — Postgres NOTIFY/LISTEN for realtime + Supabase Realtime for browser subscriptions
- **Storage** — Supabase Storage buckets (photos, videos, drawings, BIM, PDFs)
- **AI providers** — Anthropic API (Claude Opus 4.7) · OpenAI (Vision + embeddings)
- **Caching** — Vercel Edge Cache + Redis for expensive computations (Twin state snapshots)
- **Authentication** — Supabase Auth (email + OAuth + magic link)
- **Permissions** — Postgres RLS + application-layer scope checks
- **Cron jobs** — pg_cron for DB-native aggregations · Vercel Cron for external ingest
- **Realtime** — Supabase Realtime for approval inbox + Workforce dashboard live updates
- **Monitoring** — Vercel Analytics + Sentry for errors + custom KPI dashboards
- **Observability** — structured logs · trace IDs across mesh + agents · agent audit log per merchant
- **API Gateway** — Next.js Route Handlers with typed OpenAPI + tRPC hybrid

---

## Section 6 — Data Architecture

### 6.1 Database inventory (V0 through V3)

Every table is prefixed `hammerex_nex_*` per shipped convention.

**Already shipped (25 phases):**

- Phase 1-25 tables (per `docs/DB_SCHEMA.md` — 334 tables · 4459 cols · 444 FKs · 1215 indexes)

**Shipped in Phase 26 V0:**

- `hammerex_nex_memory_user`
- `hammerex_nex_memory_company`
- `hammerex_nex_memory_project`

**Add in Memory V1:**

- `hammerex_nex_memory_trade`
- `hammerex_nex_memory_region`

**Add in Memory V2:**

- `hammerex_nex_memory_industry`
- `hammerex_nex_memory_market`

**Add in Twin V0:**

- `hammerex_nex_twin_events` (append-only event log)
- `hammerex_nex_twin_snapshots` (weekly-cached state reductions)
- `hammerex_nex_twin_perspectives` (per-Brain projections cache)

**Add in Workforce V0:**

- `hammerex_nex_workforce_roles`
- `hammerex_nex_workforce_tasks`
- `hammerex_nex_workforce_approvals`
- `hammerex_nex_workforce_kpis`
- `hammerex_nex_workforce_audit_log`

**Add in Workforce Economy V0:**

- `hammerex_nex_workforce_hires`
- `hammerex_nex_workforce_employee_profiles`
- `hammerex_nex_workforce_departments`
- `hammerex_nex_workforce_promotions`
- `hammerex_nex_workforce_reviews`

**Add in Business Builder V0:**

- `hammerex_nex_builder_sessions`
- `hammerex_nex_builder_assumptions`
- `hammerex_nex_verified_claims`

**Add in Market Intel V0:**

- `hammerex_nex_market_signals`
- `hammerex_nex_market_forecasts`
- `hammerex_nex_market_ingest_feeds`

**Add in Market Intel V2:**

- `hammerex_nex_market_wholesale_consumers`

### 6.2 Indexing strategy

- Every tenant-scoped table has `(merchant_slug, created_at DESC)` index
- Every memory/signal table has `(owner_id, subject)` for retrieval + `(observed_at DESC)` for temporal
- Twin events indexed on `(project_id, kind, observed_at DESC)` and partitioned by `project_id`
- Correction chains indexed on `correction_of WHERE correction_of IS NOT NULL`
- Signal store partitioned by observed_at month for time-series queries

### 6.3 Vector store

- pgvector for semantic retrieval on:
  - `hammerex_nex_knowledge_entries` (already shipped)
  - Memory rows at V3 (semantic recall over structured facts)

### 6.4 Audit log

- Immutable per-merchant workforce audit log (`hammerex_nex_workforce_audit_log`)
- Twin events append-only (never deleted)
- Memory corrections chain (never destructive)
- All exportable as JSON/CSV for data portability

### 6.5 Storage buckets

- `photos` — SiteBook + Twin photo uploads
- `videos` — SiteBook video uploads
- `drawings` — CAD + PDF drawings
- `bim` — IFC + Revit files
- `documents` — merchant + customer document uploads
- `reports` — generated Regional Market Report PDFs + handover packs
- `avatars` — AI employee avatars (generated once + cached)

---

## Section 7 — API Architecture

### 7.1 REST endpoints (canonical shape)

Every merchant-facing API endpoint lives under `/api/nex/*`. Every endpoint returns:

```
{
  ok: boolean,
  data: <typed payload>,
  evidence?: { source, tables[], computed_at },
  errors?: [{ code, message, field? }]
}
```

**Core surfaces:**

- `/api/nex/chat` — the merchant chat entry point (already shipped)
- `/api/nex/memory/*` — Memory writer/reader/correction
- `/api/nex/estimator/*` — Estimator pipeline
- `/api/nex/twin/*` — Twin events + snapshots + timeline
- `/api/nex/workforce/*` — Workforce agents + approvals + KPIs
- `/api/nex/employment-centre/*` — Candidate browsing + hire conversations
- `/api/nex/business-builder/*` — Onboarding conversation + business generation
- `/api/nex/market-intelligence/*` — Signal reads + forecasts + reports

### 7.2 Realtime channels

Supabase Realtime channels per merchant:

- `approval_inbox_<merchant_slug>` — new approval events
- `workforce_dashboard_<merchant_slug>` — agent status changes
- `twin_timeline_<project_id>` — new Twin events for live projects

### 7.3 Streaming

- Chat responses stream via Server-Sent Events from `/api/nex/chat`
- Long-running generation (Estimator quotes, Business Builder full generation) returns a job ID + streams progress

### 7.4 Background jobs

- Workforce standing briefs run on schedule (per-agent, per-merchant)
- Market Intelligence ingest crons daily
- Memory rollups nightly (pg_cron)
- Twin reconciler triggered by photo upload event

### 7.5 Permissions

- Merchant identity from Supabase Auth
- Multi-user team support: role-based access per Studio module + workforce agent
- RLS policies on every tenant table
- Application-layer scope check before every mesh invocation

### 7.6 Versioning

- Path-based versioning at major-version boundaries: `/api/v1/...` when a breaking change ships
- Minor versions communicated via response headers
- Deprecation notices sent 90 days before removal

### 7.7 Rate limits

- Per merchant: 60 chat requests/minute (Free), 120/min (Starter), 300/min (Professional+), 600/min (Business+)
- Per merchant: unlimited memory reads within tier; writes rate-limited to prevent spam
- Global: Anthropic API budget capped per merchant per day (soft cap surfaced in UI)

### 7.8 Public API (V3+)

- Wholesale customers get a JWT-authed API with per-consumer rate limits
- Documented via OpenAPI + Swagger UI
- SLA per consumer contract

---

## Section 8 — UI Build Order

Priority order across the 18-month critical path:

### 8.1 Q3-Q4 2026 (Substrate)

1. **Memory V1 UI surfaces**
   - Regional benchmark card in Studio (Desktop → Tablet → Mobile)
   - Opt-out toggle in Studio Settings
   - "Your data helped" transparency page
2. **Trade Brain admin surface** (internal only — merchant sees Brains through chat)

### 8.2 Q1 2027 (Estimator V0)

3. **Estimator wizard** — multi-input intake (photos, brief, floor plan) on Desktop + iPad first
4. **Estimator draft view** — 3-price tier selector, merchant edits
5. **Estimate PDF preview**
6. **Approval-to-send flow**

### 8.3 Q2 2027 (Workforce launch)

7. **Approval Inbox** — Desktop + iPad first (approval-heavy workflow, mobile is view-only)
8. **Workforce Dashboard** — 12 tiles from Phase 32 §7
9. **Emergency Stop button** — persistent across every dashboard
10. **Agent chat surfaces** — chat with any hired agent from their profile

### 8.4 Q2 2027 (Workforce Economy V0)

11. **Employment Centre browsable page** — Desktop + Tablet primary; Mobile browse-only
12. **Candidate profile pages**
13. **Hire conversation flow** — chat-based, all devices
14. **Employee profile pages** (post-hire)
15. **Department dashboards**

### 8.5 Year 2 (Business Builder + Twin)

16. **Business Builder 5-step conversation** — Desktop primary
17. **Business preview page** (draft state)
18. **Publish confirmation**
19. **Twin timeline scrubber** — Desktop + iPad primary
20. **Twin event feed**
21. **Handover pack preview**
22. **Homeowner portal** (SiteBook extension)

### 8.6 Year 3 (Market Intelligence)

23. **Regional dashboards** — Desktop primary
24. **Market Advisor Q&A** — chat
25. **Opportunity feed**
26. **Monthly Regional Report subscription flow**

### 8.7 UI platform principles

- Desktop + iPad are the source of truth (per merchant memory rule — mobile is read-only preview)
- 12px text floor + 44px tap targets + 4.5:1 contrast (WCAG per platform standard)
- Lucide icons only (per merchant memory rule)
- No em dashes in hero copy (per merchant memory rule)
- Object-contain images unless full-bleed hero (per merchant memory rule)

---

## Section 9 — Testing Strategy

### 9.1 Unit tests (per module)

- **Framework** — Vitest (already standardised)
- **Coverage target** — 80% for shipped modules · 90% for substrate modules (Memory, Twin, Workforce)
- **Written alongside code** — no PR merges without new unit tests

### 9.2 Integration tests

- Every mesh + memory + agent interaction has a full-stack test
- Test database is a real Postgres instance (not mocked) for accurate RLS behaviour
- Every API endpoint has a route-handler integration test

### 9.3 AI evaluation

- Every Trade Brain module has a scenario test suite (100+ scenarios per Brain covering trade-specific questions)
- Every mesh reply scored against a rubric: evidence chain present · country-scoped · confidence surfaced · no fabrication
- Estimator accuracy tracked: actual vs estimated deltas fed into regression tests
- LLM output regression tests run on every deploy against fixed prompt bank

### 9.4 Performance tests

- Chat SLA: p95 <5s for standard replies · <15s for compound mesh replies
- Estimator V0 SLA: full quote generation <3 minutes for kitchen scope
- Twin timeline SLA: any date reconstruction <500ms
- Load test at 10× current merchant density on every major release

### 9.5 Security tests

- Static analysis on every PR (Semgrep)
- Dependency scanning (Renovate + Snyk)
- Penetration test annually + before Enterprise tier launches
- RLS policy tests for every new tenant table

### 9.6 Construction accuracy tests

- Trade Brain outputs sampled quarterly by human trade advisor for accuracy
- Estimator outputs benchmarked against 20+ real completed projects per quarter
- Vision AI outputs sampled monthly against ground-truth annotations
- Failures logged, root-caused, added to regression suite

### 9.7 Regression tests

- Every bug fix generates a regression test
- Full regression suite runs on every deploy
- Zero-tolerance policy: no failing regression tests merge

### 9.8 Load tests

- k6 load-test infrastructure
- Simulate 10× traffic on every major release
- Chaos test on Twin event log (event storm scenarios)

### 9.9 Acceptance tests

- Merchant advisory panel (5 pilot merchants) sign off before broad rollout
- Structured feedback captured; blockers must be fixed before broad rollout

---

## Section 10 — Release Strategy

Five stages per major slice. No slice skips stages.

### 10.1 Alpha (internal · 1-2 weeks)

- Feature-complete on staging
- Internal team dogfoods
- Bug bar: any critical bugs block progression

### 10.2 Internal (2 weeks)

- 5-10 internal merchants (staff who use the platform for real work)
- Feedback captured in structured surveys
- 100% of internal blockers fixed

### 10.3 Pilot (2 weeks)

- 5 merchant advisory panel members
- Direct 1:1 with product team
- Feature-flagged, off by default for everyone else

### 10.4 Closed Beta (4 weeks)

- 50-100 handpicked merchants
- Beta feedback surface in Studio
- KPIs measured against baseline

### 10.5 Open Beta (4 weeks)

- All merchants opt-in
- Feature-flagged toggle in Studio Settings
- Public documentation live

### 10.6 Commercial GA

- Default-on for new merchants
- Existing merchants receive migration announcement
- Marketing site updated
- Tier + pricing surfaces updated per ADR-0010

### 10.7 Enterprise (V3+)

- Bespoke onboarding
- Contract-based SLAs
- Custom integrations

### 10.8 International (Year 3+)

- One country at a time (Ireland first · then Australia)
- Country-specific pilot cohort
- Regulation + language + currency validated before Commercial GA in that country

---

## Section 11 — Commercial Readiness

### 11.1 Revenue-per-slice mapping

| Slice                          | ARPU contribution      | Tier attach                                | Revenue starts       |
| ------------------------------ | ---------------------- | ------------------------------------------ | -------------------- |
| Memory V1                      | Indirect               | Professional+ (unlocks regional reads)     | Q3 2026 upgrade lift |
| Trade Brain V0                 | Indirect               | Professional (Brain depth)                 | Q3 2026 upgrade lift |
| Trade Brain V1                 | +£5/merchant/mo est.   | Professional                                | Q4 2026              |
| Estimator V0                   | +£5/merchant/mo est.   | Professional                                | Q1 2027              |
| Estimator V1                   | +£8/merchant/mo est.   | Professional + Business                     | Q2 2027              |
| Workforce V0                   | +£8/merchant/mo est.   | Professional                                | Q2 2027              |
| Workforce Economy V0           | +£12/merchant/mo est.  | All paid tiers                              | Q2 2027              |
| Business Builder V0            | +25% new merchant conversion | New merchants                          | Q1 2028              |
| Twin V0                        | +£8/merchant/mo est.   | Business                                    | Q2 2028              |
| Twin V2 homeowner portal       | + long-tail post-handover £3.99/mo | Homeowner subscriptions          | Q4 2028              |
| Market Intelligence V0         | Indirect               | Business+                                   | Q2 2029              |
| Market Intelligence V2         | Wholesale + £4.99-£9.99 add-ons | Regional Market Report / Supplier Intel | Q4 2029      |
| Workforce Economy V3 specialists | +£14.99-£29.99/mo per specialist | Add-ons                            | Q4 2029             |

### 11.2 ROI ranking (revenue impact / engineering effort)

1. Workforce Economy V0 — modest engineering effort · category-shifting revenue impact
2. Estimator V0 — moderate effort · direct ARPU driver
3. Business Builder V0 — high effort · high acquisition impact
4. Workforce V0 — high effort · high ARPU
5. Memory V1 — moderate effort · indirect but foundational
6. Twin V0 — very high effort · long-tail revenue
7. Market Intelligence V0 — moderate effort · wholesale ceiling long-term

### 11.3 Subscription mapping

Reuses existing `src/lib/tierCatalog.ts`. Every new slice's unlocks map to a tier per Section 3 slice's Commercial Value.

---

## Section 12 — Risk Register

Each risk carries owner + review cadence.

| Category      | Risk                                                             | Severity | Owner    | Review     |
| ------------- | ---------------------------------------------------------------- | -------- | -------- | ---------- |
| Technical     | Substrate schema drift breaks downstream phases                   | Critical | CTO      | Weekly     |
| Technical     | Standing-brief scheduler misses events                            | High     | Backend  | Bi-weekly  |
| Technical     | Vision AI misinterpretation cascades Twin state drift             | High     | AI Eng   | Weekly     |
| Technical     | LLM API outage during business-critical flow                      | High     | DevOps   | Monthly    |
| Commercial    | Free tier abuse (fake business creation)                          | Medium   | Product  | Monthly    |
| Commercial    | Add-on pricing confuses merchants                                 | Medium   | Product  | Monthly    |
| Commercial    | Wholesale revenue takes longer than modelled                      | Medium   | Comm Dir | Quarterly  |
| Legal         | Generated legal templates cause harm                              | Critical | Legal    | Continuous |
| Legal         | Cross-tenant aggregation raises DPA/GDPR/AU privacy issues        | Critical | Legal    | Continuous |
| Legal         | Wholesale data channel treated as data brokerage                  | High     | Legal    | Quarterly  |
| Legal         | AI-employment language raises regulatory scrutiny                 | Medium   | Legal    | Quarterly  |
| AI            | Trade Brain author drift produces wrong advice                    | High     | AI Eng   | Monthly    |
| AI            | Estimator hallucinates prices without evidence                    | Critical | AI Eng   | Continuous |
| AI            | Business Builder fabricates reviews/credentials                   | Critical | AI Eng   | Continuous |
| AI            | Agent action causes external harm without approval                | Critical | Sec Eng  | Continuous |
| Data          | Consent framework failure pauses cross-tenant rollups              | Critical | Product  | Weekly     |
| Data          | Merchant PII leaks across tenant boundary                          | Critical | Sec Eng  | Continuous |
| Data          | Twin event log grows unmanageably large                            | Medium   | Backend  | Quarterly  |
| Construction  | Regional regulation lag (regs change; Brains stale)                | High     | AI Eng   | Monthly    |
| Construction  | Brain vocabulary drift (regional slang unrecognised)              | Low      | AI Eng   | Quarterly  |
| Scaling       | Chat SLA degrades at 10× merchant density                          | High     | DevOps   | Continuous |
| Scaling       | Supabase / Anthropic API rate limits hit                           | High     | DevOps   | Monthly    |
| Scaling       | Storage costs grow faster than revenue (photo/video uploads)       | Medium   | DevOps   | Quarterly  |

Every risk has an ADR-linked mitigation. Weekly critical-risk review chaired by CTO.

---

## Section 13 — Hiring Plan

### 13.1 Year 1 (5 engineers)

- **1 Backend/Full-stack lead** — Memory V1 substrate work
- **1 AI Engineer** — Trade Brain runtime + mesh integration
- **1 Product Designer** — Estimator + Workforce Economy UX
- **1 Frontend Engineer** — Estimator + Employment Centre surfaces
- **1 QA / Testing Engineer** — automated test suite + AI evaluation infrastructure

### 13.2 Additional Year 1 non-engineering hires

- **4 Trade Brain Authors** — human master tradespeople (Electrician, Plumber, Roofer, Carpenter) contracted to author playbooks. Not full-time engineering; part-time contractor arrangement.
- **1 Legal Counsel** — cross-tenant consent framework, terms of use, wholesale data agreements
- **1 Product Manager** — coordination + advisory panel management

### 13.3 Year 2 additional hires (bringing team to ~10 engineers)

- **1 Second Backend Engineer** — Twin event log + reducer
- **1 Second AI Engineer** — Estimator Vision AI features
- **1 Frontend Engineer** — Business Builder + Twin Timeline
- **1 Site Reliability / DevOps** — scaling infrastructure
- **1 Security Engineer** — RLS + audit log + workforce autonomy safety

### 13.4 Year 2 non-engineering hires

- **6 more Trade Brain Authors** — 2nd wave trades
- **1 Data Analyst** — Market Intelligence signal fusion + forecast accuracy
- **1 Customer Success Lead** — merchant onboarding + advisory panel

### 13.5 Year 3 additional hires (bringing team to ~15 engineers)

- **1 Data Engineer** — Market Intelligence pipelines + wholesale channel APIs
- **1 Third Frontend Engineer** — Regional dashboards + wholesale-consumer portal
- **1 Third AI Engineer** — Twin cross-project pattern lending
- **1 Machine Learning Engineer** — first ML-enhanced models (Phase 30 V3, Twin V4)
- **1 International Product Manager** — country-by-country expansion

### 13.6 Hiring priority rules

1. Hire the Trade Brain Authors BEFORE the AI engineers who will build the runtime. Content is the blocker.
2. Hire Legal BEFORE cross-tenant memory goes live. Consent framework must be reviewed by qualified counsel.
3. Never hire ahead of the ability to onboard properly. 1 hire per month max per engineering team.
4. Prefer construction domain experience for Product roles.
5. Prefer prior AI-safety background for Security Engineer role.

---

## Section 14 — Five-Year Delivery Roadmap

Quarter-by-quarter with milestones + revenue targets + team growth.

### 14.1 Year 1 (2026-Q3 → 2027-Q3)

| Quarter | Milestone                                                     | Team size | Revenue target        |
| ------- | ------------------------------------------------------------- | --------- | --------------------- |
| Q3 2026 | Memory V1 shipped · Electrician Brain V0                      | 5         | Baseline ARPU held    |
| Q4 2026 | Trade Brains V1 (4 authored) · Phase 24 migration              | 5         | +5% ARPU              |
| Q1 2027 | Estimator V0 + V1 · Workforce V0 spec locked                    | 6         | +10% ARPU (Estimator) |
| Q2 2027 | Workforce V0 + Workforce Economy V0 shipped · Estimator V2 begins | 7      | +20% ARPU             |

### 14.2 Year 2 (2027-Q3 → 2028-Q3)

| Quarter | Milestone                                                          | Team size | Revenue target             |
| ------- | ------------------------------------------------------------------ | --------- | -------------------------- |
| Q3 2027 | Workforce V1 shipped · Business Builder V0 spec locked · Trade Brains V2 second wave | 8 | Retention improvement metric |
| Q4 2027 | Business Builder V0 (Electrician) shipped · Workforce V2 begins    | 9         | +25% new merchant conversion |
| Q1 2028 | Business Builder V1 (5 trades) · Workforce V2 shipped · Twin V0 spec locked | 10 | Sustained retention lift |
| Q2 2028 | Twin V0 shipped · Twin V1 begins · Workforce Economy V2 shipped     | 10        | Business-tier upgrade lift  |

### 14.3 Year 3 (2028-Q3 → 2029-Q3)

| Quarter | Milestone                                                       | Team size | Revenue target                 |
| ------- | --------------------------------------------------------------- | --------- | ------------------------------ |
| Q3 2028 | Twin V1 shipped · Market Intelligence V0 spec locked            | 12        | Twin ARPU lift                 |
| Q4 2028 | Market Intelligence V0 shipped · Twin V2 shipped                | 13        | First wholesale pilot revenue  |
| Q1 2029 | Market Intelligence V1 · Homeowner Twin subscriptions launch    | 14        | Homeowner subscription revenue |
| Q2 2029 | Market Intelligence V2 · First paying wholesale customer · Workforce V3 begins | 15 | Wholesale revenue > £X/mo |

### 14.4 Year 4 (2029-Q3 → 2030-Q3)

| Quarter | Milestone                                                              | Team size | Revenue target        |
| ------- | ---------------------------------------------------------------------- | --------- | --------------------- |
| Q3 2029 | Ireland Commercial GA · Workforce V3 shipped                            | 16        | Ireland ARPU baseline |
| Q4 2029 | Australia Commercial GA · Twin V3 shipped                              | 17        | Australia ARPU baseline |
| Q1 2030 | Business Builder V3 non-trade personas · Market Intelligence V3        | 18        | Enterprise revenue baseline |
| Q2 2030 | Workforce Economy V4 (cross-merchant shadowing) · Advanced Twin        | 20        | International ARPU >£X/mo   |

### 14.5 Year 5 (2030-Q3+)

- Long-tail phases · civic-scale intelligence deals · playbook marketplaces · US expansion · CA + NZ + AE
- Team 25+ engineers
- Nex is the default construction OS in launch markets

### 14.6 Technology upgrades along the path

- Q2 2027 — first embedding infrastructure (for Memory semantic search groundwork)
- Q4 2027 — realtime infrastructure scaled (Supabase Realtime alternatives evaluated)
- Q2 2028 — event log partitioning + archival tier
- Q4 2028 — vector store scaling review
- Q2 2029 — first ML model training pipeline for Phase 30 V3
- Q4 2029 — international infrastructure (regional Vercel + Supabase deployments where required)

---

## Section 15 — The Complete Build Order

The definitive sequence. No ambiguity. Follow this order.

**Pre-code prerequisites (weeks 1-2)**

1. Ratify Memory Engine cross-tenant privacy ADR (from Phase 26 blueprint §3.2)
2. Ratify Trade Brain 10-module contract ADR (from Phase 27 blueprint §1.3)
3. Ratify Twin event log schema ADR (before Twin V0 begins)
4. Ratify Workforce trust ladder ADR (from Phase 32 blueprint §5)
5. Ratify Workforce Economy honesty non-negotiables ADR (from Phase 33 blueprint §14.7)
6. Recruit Trade Brain Advisory Panel (Electrician + Plumber + Roofer + Carpenter human masters)
7. Legal Counsel begins consent framework work in parallel

**Year 1 build order (weeks 3-52)**

8. Memory V1 (weeks 3-8)
9. Trade Brain V0 · Electrician reference (weeks 3-8, parallel)
10. Trade Brain V1 · migrate Phase 24 agents (weeks 9-10)
11. Trade Brain V1 · 3 additional Brains authored (weeks 9-20, parallel)
12. Estimator V0 · kitchen + bathroom single-trade (weeks 21-26)
13. Estimator V1 · multi-trade composition (weeks 27-32)
14. Workforce V0 · 5 agents + approval inbox + emergency stop (weeks 27-38, parallel)
15. Workforce Economy V0 · Employment Centre + hire conversation (weeks 33-42, parallel)
16. Merchant advisory panel + closed beta on all Year-1 slices (weeks 43-52)

**Year 2 build order (weeks 53-104)**

17. Workforce V1 · full mid-tier team (weeks 53-62)
18. Workforce V2 · full 25+ workforce (weeks 63-74)
19. Trade Brain V2 · second wave 5 Brains (weeks 53-64, parallel)
20. Business Builder V0 · Electrician one-hour flow (weeks 65-82)
21. Business Builder V1 · 5 trades UK-wide (weeks 83-92)
22. Twin V0 · event log + timeline + Vision reconciler + basic handover (weeks 65-86, parallel)
23. Twin V1 · perspective + prediction + BIM ingest (weeks 87-96)
24. Workforce Economy V1 + V2 · Department Manager + Culture Layer + Career Progression (weeks 53-88, rolling)

**Year 3 build order (weeks 105-156)**

25. Market Intelligence V0 · signal store + 5-region dashboard (weeks 105-116)
26. Market Intelligence V1 · advisors + benchmarks (weeks 117-126)
27. Twin V2 · homeowner portal + drone/LiDAR + warranty vault (weeks 105-116, parallel)
28. Market Intelligence V2 · AI Advisor + monthly PDF report + first wholesale pilot (weeks 127-138)
29. Workforce Economy V3 · Specialist Marketplace + Department Bundles (weeks 127-136, parallel)

**Year 4-5 build order**

30. International expansion begins (Ireland Q3 2029)
31. Twin V3-V4 · cross-project pattern lending + insurance/FM channel
32. Market Intelligence V3-V4 · wholesale API + published Nex indices
33. Workforce V3-V4 · progressive autonomy + agent apprenticeship + selective Level-6
34. Business Builder V3-V4 · non-trade personas + advanced generation
35. Workforce Economy V4 · cross-merchant shadowing + trade association co-branding
36. Long-tail enhancer phases as merchant demand justifies

**End state (Year 5)**

Nex is the default construction operating system across UK · IE · AU with expanding US · CA · NZ · AE footprint. Every phase from 1-33 is at production quality. Wholesale revenue rivals merchant subscription revenue. The industry has changed.

---

**End of Nex Build Execution Playbook v1.0.**

*Follow this order. Ship each slice with the exit criteria. Respect the substrate. Never chase competitor feature parity. Compound.*

*Update this document (not the Master Architecture, not individual blueprints) when the execution reality diverges from this plan. This is the working document for the engineering organisation.*

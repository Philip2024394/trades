# Nex Implementation Roadmap v2

**Post-Phase-0-Week-1 synthesis · 2026-07-23**
**Purpose:** the definitive engineering execution sequence following ADR-0016-0020 drafting. Supersedes Build Execution Playbook v1.0 for delivery sequencing. Integrates: 33 phase blueprints · Master Architecture v1.0 · ES-01/02/03/04/05/06/10 · Pre-Launch Validation Report · Pre-Launch Implementation Plan · V2 specs · Build Readiness Report · 5 drafted ADRs.

**Difference from Build Execution Playbook v1.0:**
- v1 was pre-ADR · assumed ratification would happen inline with build
- v2 is post-ADR-draft · treats ADR ratification as an explicit Phase 0 milestone
- v2 incorporates ES-01 corrections (14 architectural changes)
- v2 integrates V2 specs (Business Builder · Chat · SiteBook · Memory) delivered post-Playbook
- v2 aligns with Build Readiness Report's 30-day preparation phase requirement

**This document supersedes Playbook v1 for scheduling. Individual phase blueprints, ES documents, and ADRs remain authoritative for their domains.**

---

## Section 1 · Dependency Graph (Definitive)

Reading order: top depends on nothing · every level depends on levels above.

```
LEVEL 0 · INFRASTRUCTURE (SHIPPED)
  Supabase Postgres + Storage + Auth + RLS + Realtime
  Vercel + Next.js 16
  Stripe · Anthropic API · Companies House API
  Upstash Redis (to be added Phase 0 Week 3)

LEVEL 1 · PLATFORM CORE (SHIPPED · Phases 1-4)
  Nex Chat surface · Intent router · Character library · Knowledge Engine
  Studio App Store · Tenancy · User accounts · Trade Centre substrate

LEVEL 2 · DOMAIN ENGINES (SHIPPED · Phases 5-25)
  BI · PI · Est · CX · MD · FI · SC · PM · CV · NET · CC · MP · XP · World · Global · Ops · Twin scenario · BOS

LEVEL 3 · MESH + APPROVALS (SHIPPED · Phases 15 · 24)
  Multi-Agent Mesh · Voice Unifier · Confidence Engine · Autonomy Modes · Approval Flow

LEVEL 4 · SUBSTRATE (Phase 0 → Phase 1)
  Memory V0 (SHIPPED)
  ↓ blocked by ADR-0016 ratification
  Memory V1 · cross-tenant rollups + K-anonymity gate + opt-out UI

LEVEL 5 · KNOWLEDGE AUTHORING (Phase 1)
  ↓ blocked by ADR-0017 ratification + Trade Brain Author under contract
  Trade Brain V0 (Electrician reference)
  ↓
  Trade Brain V1 (Plumber + Roofer + Carpenter authored) + migrate Phase 24 agents

LEVEL 6 · COMPOSITIONAL FEATURES (Phase 2)
  ↓ blocked by Level 4 V1 + Level 5 V1
  Phase 28 Estimator V0-V1
  ↓ blocked by ADR-0019 ratification + Multi-user RBAC
  Phase 32 Workforce V0 (5 core agents)
  ↓ blocked by ADR-0020 ratification + Verification adapters
  Phase 33 Workforce Economy V0 (Employment Centre)

LEVEL 7 · RETENTION FEATURES (Phase 3)
  ↓ blocked by Level 6 completion + ADR-0018 ratification
  Chat V2 · SiteBook V2 · Memory V2
  Phase 29 Twin V0 (event log · timeline · Vision reconciler)
  Additional Trade Brains at V1 depth

LEVEL 8 · ECOSYSTEM EXPANSION (Phase 4 · Y2+)
  Phase 31 Business Builder V2 international forks (Ireland · Australia)
  Phase 30 Market Intelligence V0-V2
  Phase 32 Workforce V1-V2 (full 25-agent roster)
  Phase 33 Workforce Economy V1-V2 (career progression · specialist marketplace)

LEVEL 9 · MOAT COMPOUNDING (Y3+)
  Phase 29 Twin V2-V4 (homeowner portal · drone/LiDAR · pattern lending)
  Phase 30 Market Intelligence V3-V4 (wholesale channels · published Nex indices)
  Phase 32 Workforce V3-V4 (progressive autonomy · agent apprenticeship)
```

**Critical path (18 months):** Level 4 V1 → Level 5 V1 → Level 6 → Level 7. Everything else compounds behind this.

---

## Section 2 · Engineering Sequence

Four phases replacing the earlier "5-sprint" framing. Each phase has a distinct engineering character.

### Phase 0 · Preparation (Weeks 1-4)

**Character:** architecture ratification · human recruitment · foundation shipping. No production feature development.

**Deliverables:**

- **Week 1** ✅ DONE
  - 5 ADRs drafted (ADR-0016 through ADR-0020)
  - ES-04 outline
  - ES-05 outline
  - Trade Brain Author Recruitment Package
- **Week 2**
  - ES-04 full document produced (with Legal Counsel input)
  - ES-05 full document produced (with QA Lead input)
  - ADR-0016 through ADR-0020 signoff cycles begin
  - Trade Brain Author application review · reference checks · public register verification
  - Design data portability + right-to-be-forgotten workflows (per ADR-0016 §5)
  - Design Trade Brain editing tool (structured JSON editor with schema validation + pack preview)
- **Week 3**
  - ADR-0016 through ADR-0020 all Accepted (target by end of Week 3)
  - Ship data portability + RTBF workflows to staging
  - Ship multi-user RBAC V0 (3-role simplified · Owner/Manager/Member per ES-01 correction)
  - Ship model outage graceful degradation (per ES-01 correction)
  - Trade Brain Author trade authenticity interviews (Electrician + Plumber candidates)
  - Merchant advisory panel formalised (5 pilots under paid honorarium contract)
  - Sample authoring tasks distributed (£300 per candidate regardless of hire outcome)
- **Week 4**
  - Ship the 6 foundation-blocking Critical improvements from Pre-Launch Implementation Plan §1
  - Contract first 2 Trade Brain Authors (Electrician + Plumber)
  - Trade Brain editing tool available for Authors
  - Run 100 simulation scenarios against V2 designs (Business Builder V2 · Chat V2 · SiteBook V2 · Memory V2)
  - Re-audit against 7 unlock conditions from Build Readiness Report §17.2

**Phase 0 exit criteria:**
- All 5 ADRs Accepted status
- ES-04 and ES-05 published
- 2+ Trade Brain Authors under contract
- Data portability + RBAC + model outage handling shipped to production
- Merchant advisory panel formalised
- Architecture Score ≥88/100 per Build Readiness Report

**Phase 0 does not exit until all criteria met. Do not accelerate.**

### Phase 1 · Substrate Completion (Weeks 5-10)

**Character:** substrate authoring · memory rollup mechanics · Trade Brain V0 reference implementation.

**Deliverables:**

- **Week 5-6**
  - Begin Memory V1 backend implementation (cross-tenant rollup crons · K-anonymity gate at reader · opt-out UI)
  - Begin Electrician Brain V0 authoring (Author working with editing tool)
  - Continue Roofer + Carpenter Author interviews
  - AI evaluation framework infrastructure begins (per ES-05)
- **Week 7-8**
  - Memory V1 shipped to staging
  - Electrician Brain V0 pack complete (6 required modules per ADR-0017)
  - Merchant advisory panel reviews Electrician Brain V0 outputs
  - Contract remaining Authors (Roofer + Carpenter)
  - Vision AI ground-truth annotation dataset seeded (100+ images)
- **Week 9-10**
  - Migrate Phase 24 trade agents to Brain contract (Plumber Brain begins authoring in parallel)
  - Memory V1 shipped to production (feature-flagged for pilot merchants)
  - Chat V2 message engine begins (independent of Trade Brain content · shared context substrate)
  - Advisory panel signs off Electrician Brain V0

**Phase 1 exit criteria:**
- Memory V1 in production for pilot merchants
- Electrician Brain V0 shipped
- Phase 24 agents migrated to Brain contract
- 4 Trade Brain Authors all under contract with V1 authoring in flight

### Phase 2 · Revenue Engine (Weeks 11-16)

**Character:** commercially valuable feature composition on top of complete substrate.

**Deliverables:**

- **Week 11-12**
  - Plumber Brain V1 complete
  - Roofer Brain V0 authoring in flight
  - Carpenter Brain V0 authoring in flight
  - Phase 28 Estimator V0 begins (single-trade end-to-end · kitchen or bathroom scope)
- **Week 13-14**
  - Estimator V0 shipped to staging · advisory panel testing
  - Roofer Brain V0 complete
  - Carpenter Brain V0 complete
  - Business Builder V2 begins (per V2 spec · Sprint 3 slot per Implementation Plan)
- **Week 15-16**
  - Estimator V1 shipped (multi-trade composition)
  - Business Builder V2 shipped to staging
  - Phase 32 Workforce V0 begins (5 core agents · approval inbox · Emergency Stop)
  - Phase 33 Workforce Economy V0 begins (Employment Centre browsable · hire conversation)

**Phase 2 exit criteria:**
- 4 Trade Brains at V1 depth
- Estimator V0-V1 in production
- Business Builder V2 shipped for pilot cohort
- Workforce V0 substrate live

### Phase 3 · Retention Features (Weeks 17-22)

**Character:** engagement + retention surfaces + honest Twin substrate.

**Deliverables:**

- **Week 17-18**
  - Workforce V0 shipped to production
  - Workforce Economy V0 shipped to production (14-day trial infrastructure live)
  - Chat V2 shipped (SSE streaming · multi-agent coordination · Nex home screen)
- **Week 19-20**
  - SiteBook V2 shipped (mobile-first PWA · offline capable · camera-first · voice-first)
  - Memory V2 shipped (correction UX · dashboard · confidence surfaces)
- **Week 21-22**
  - Phase 29 Twin V0 shipped (event log · timeline · Vision reconciler · basic PDF handover)
  - Closed beta opens for 50-100 merchants
  - Advisory panel reviews all V2 surfaces + Twin V0

**Phase 3 exit criteria:**
- Closed beta cohort onboarded and active
- Advisory panel NPS ≥40 across V2 surfaces
- All 14 Critical Validation improvements shipped
- 10 launch gates from Build Readiness Report all Ready

### Phase 4 · Commercial GA + Expansion (Weeks 23-30 + Y2+)

**Character:** commercial readiness · international pilots · full workforce catalog.

**Deliverables:**

- **Weeks 23-26 · Bugfix + polish**
  - Address closed beta feedback
  - Advisory panel signoff on Commercial GA readiness
  - Legal review of merchant-facing terms
- **Weeks 27-30 · Commercial GA**
  - Public GA in UK
  - Marketing site + tradesite templates finalised
  - Trade Centre + Marketplace fully live
- **Y2+ (Weeks 31+)**
  - Ireland pilot cohort
  - Australia pilot cohort
  - Phase 32 Workforce V1-V2 (full workforce catalog)
  - Phase 33 Workforce Economy V1-V2 (career progression)
  - Additional Trade Brains at V1 (target 10 by end Y2)
  - Phase 30 Market Intelligence V0 begins

---

## Section 3 · Database Impacts (Per Migration)

Every new table with its dependency and target migration week.

### Phase 0 · Week 2-4

| Table | Depends on | Purpose |
|-------|-----------|---------|
| `hammerex_nex_memory_optout` | ADR-0016 | Merchant opt-out registry per memory category |
| `hammerex_nex_memory_transparency_log` | ADR-0016 | "Your data helped" contribution reveals |
| `hammerex_nex_platform_gdpr_requests` | ADR-0016 | Portability + RTBF orchestrator |
| `hammerex_nex_team_members` | RBAC design | Multi-user tenant team support |
| `hammerex_nex_permissions` | RBAC design | Permission matrix |
| `hammerex_nex_role_grants` | RBAC design | Custom role overrides (V1+) |
| `hammerex_nex_platform_ai_provider_status` | Model outage handling | Provider health tracking |
| `hammerex_nex_platform_feature_flags` | Feature flag admin | Merchant + tier + global flags |
| `hammerex_nex_brain_corrections` | ADR-0017 | Merchant corrections chain |
| `hammerex_nex_brain_versions` | ADR-0017 | Brain semantic versioning |

### Phase 1 · Week 5-10

| Table | Depends on | Purpose |
|-------|-----------|---------|
| `hammerex_nex_memory_trade` | ADR-0016 + Memory V1 | Trade-scoped rollups (K≥5 demand · K≥10 pricing) |
| `hammerex_nex_memory_region` | ADR-0016 + Memory V1 | Region-scoped rollups |
| `hammerex_nex_brain_registry` | Brain contract | Registry of active Brains per merchant |

### Phase 2 · Week 11-16

| Table | Depends on | Purpose |
|-------|-----------|---------|
| `hammerex_nex_estimator_sessions_v2` | Phase 28 Estimator | Merchant-facing estimator session state |
| `hammerex_nex_estimator_bands` | Phase 28 Estimator sanity bands | Per-trade × region typical measurement bands |
| `hammerex_nex_builder_sessions_v2` | Business Builder V2 | Onboarding conversation state |
| `hammerex_nex_workforce_roles` | ADR-0019 Workforce | Role manifest per merchant |
| `hammerex_nex_workforce_agent_levels` | ADR-0019 | Level per agent per merchant per action class |
| `hammerex_nex_workforce_tasks` | Workforce V0 | Task queue |
| `hammerex_nex_workforce_approvals` | Workforce V0 | Approval inbox |
| `hammerex_nex_workforce_pauses` | ADR-0019 Emergency Stop | Granular pause registry |
| `hammerex_nex_workforce_audit_log` | ADR-0019 | Immutable per-merchant workforce log |
| `hammerex_nex_workforce_kpis` | Workforce V0 | Per-agent metrics |
| `hammerex_nex_workforce_hires` | Workforce Economy V0 | Hire event log |
| `hammerex_nex_workforce_employee_profiles` | Workforce Economy V0 | Living profiles post-hire |
| `hammerex_nex_verified_claims` | ADR-0020 Honesty | Verification registry |

### Phase 3 · Week 17-22

| Table | Depends on | Purpose |
|-------|-----------|---------|
| `hammerex_nex_chat_sessions_v2` | Chat V2 | Chat message history |
| `hammerex_nex_chat_messages_v2` | Chat V2 | Individual messages |
| `hammerex_nex_sitebook_entries_v2` | SiteBook V2 | On-site captures |
| `hammerex_nex_sitebook_offline_queue` | SiteBook V2 | Offline sync queue |
| `hammerex_nex_memory_corrections_v2` | Memory V2 | Correction chain (extends Phase 26) |
| `hammerex_nex_memory_visual_index` | Memory V2 | Photo embedding index |
| `hammerex_nex_memory_health_scores` | Memory V2 | Health Score computed |
| `hammerex_nex_twin_events` | ADR-0018 + Twin V0 | Append-only event log (partitioned by month) |
| `hammerex_nex_twin_snapshots` | Twin V0 | Weekly cache |

### Phase 4 · Week 23+

Additional tables per feature roadmap (Market Intelligence · Twin V1+ · Enterprise · International).

**Total new tables Phase 0-3: ~35.** Every schema referenced back to its ratifying ADR.

---

## Section 4 · AI System Dependencies

Which AI capability depends on which prior AI capability.

```
Claude Opus 4.7 (via ai/ orchestration layer)
  ├── Chat V2 message generation
  ├── Trade Brain reasoning
  ├── Business Builder V2 magic moment composition
  ├── Estimator profit optimiser
  ├── Workforce agent drafts

Claude Haiku (fallback + high-volume classification)
  ├── Intent classification
  ├── Memory context assembly
  ├── High-volume evaluation tasks

OpenAI GPT-4-Vision (or equivalent)
  ├── Phase 13 CV (shipped)
  ├── SiteBook V2 photo analysis
  ├── Estimator V0 Vision AI innovation (baseline only per ES-01 correction)
  ├── Twin Vision reconciler

OpenAI text-embedding-3 (or Voyage)
  ├── Phase 4 knowledge (shipped)
  ├── Memory V2 semantic recall (V3+)
  ├── Documents search
  ├── Estimator similar-quote retrieval
  ├── SiteBook cross-project search

Google Document AI
  ├── Estimator PDF spec extraction
  ├── Document classification
```

### AI capability dependency chain

```
Trade Brain V1 authored content
  ↓
Estimator V0 uses Brain pricing_model + regulations
  ↓
Estimator V1 composes multi-Brain scope
  ↓
Business Builder V2 magic moment loads Brain content
  ↓
Workforce V0 agents consult Brains for their scope
  ↓
Twin V0 Vision reconciler uses Brain expected-state checklists
  ↓
Chat V2 mesh dispatches queries to right Brain
```

**No AI feature that depends on a Brain ships before that Brain reaches V1 depth.**

---

## Section 5 · Testing Requirements per Phase

Per ES-05 framework.

### Phase 0 · Preparation

- ES-05 outline delivered ✅
- AI evaluation framework infrastructure specified
- Vitest coverage floor confirmed per module (80% general · 90% substrate)
- Adversarial prompt bank seeded (initial 500+ prompts)

### Phase 1 · Substrate

- Memory V1 · Vitest unit tests · integration tests with real Postgres · RLS policy verification
- Trade Brain V0 · schema validation tests · Author-provided scenario suite (100+ per Brain)
- Vision AI ground-truth dataset expanded to 300+ images
- Chaos test on Anthropic API outage (monthly per ES-06)

### Phase 2 · Revenue Engine

- Estimator V0 · sanity band tests · accuracy against advisory panel actuals
- Business Builder V2 · Playwright E2E · advisory panel field testing
- Workforce V0 · agent action test suite · approval flow tests · Emergency Stop SLA test
- Load test at 1000 concurrent sessions
- Trade Brain V1 accuracy validated by Author quarterly

### Phase 3 · Retention

- Chat V2 · SSE streaming stability · load test 1000 concurrent
- SiteBook V2 · offline scenarios · real-device testing (iOS Safari + Android Chrome) · advisory panel field trials
- Memory V2 · correction UX tests · Health Score computation tests
- Twin V0 · event log integrity · time-travel reconstruction · Vision reconciler accuracy
- Regression suite full sweep

### Phase 4 · Commercial GA

- End-to-end merchant journey tests
- Chaos test on Supabase failure (staging)
- Penetration test (per ES-06 §29.2)
- WCAG 2.2 AA compliance verified
- Advisory panel NPS ≥40 target

---

## Section 6 · Release Milestones

Concrete week-numbered milestones with success criteria.

| Milestone | Week | Success criteria |
|-----------|------|------------------|
| Phase 0 Week 1 complete | End W1 | 5 ADRs drafted · ES-04/05 outlined · Recruitment package · Zero prod code changes ✅ DONE |
| Phase 0 Week 2 complete | End W2 | ES-04/05 full docs · ADR signoffs in flight · 2 Author interviews complete |
| Phase 0 Week 3 complete | End W3 | ADRs Accepted · GDPR + RBAC + model outage shipped · Advisory panel formalised |
| Phase 0 Week 4 complete · **Unlock gate** | End W4 | 2 Authors under contract · 100 simulations validated · Architecture Score ≥88 |
| Phase 1 Electrician Brain V0 | End W8 | Advisory panel signoff · schema valid · in production feature-flagged |
| Phase 1 Memory V1 in production | End W10 | Cross-tenant rollups running · K-anonymity gate enforced · opt-out UI live |
| Phase 2 Estimator V0 shipped | End W14 | Advisory panel testing · sanity bands live · 4 Brains at V1 |
| Phase 2 Business Builder V2 shipped | End W16 | First cohort onboards via 60-second magic moment |
| Phase 2 Workforce V0 + Employment Centre V0 shipped | End W16 | 5 core agents · Emergency Stop tested · trial infrastructure live |
| Phase 3 Chat V2 shipped | End W18 | Home screen live · SSE streaming stable |
| Phase 3 SiteBook V2 + Memory V2 shipped | End W20 | Offline sync verified · correction UX live |
| Phase 3 Twin V0 shipped + Closed Beta opens | End W22 | 50-100 merchants onboarded |
| Phase 4 Commercial GA | End W30 | Advisory panel signoff · legal review complete · public GA |
| Y2 Ireland pilot | W40+ | Country-specific onboarding · IE Trade Brain regional variants · CRO verification |
| Y2 Australia pilot | W44+ | ASIC verification · AU regional variants |

---

## Section 7 · Non-Negotiables (Repeated for Emphasis)

These apply to every phase. Any deviation requires explicit CTO override + documented reason.

1. **Substrate before surface** — every commercial feature waits for its substrate dependency to complete
2. **Draft-not-execute default** — no autonomous action outside whitelisted opt-in classes (per ADR-0019)
3. **Zero fabrication at schema level** — reviews · credentials · portfolio · statistics all require source (per ADR-0020)
4. **Evidence-or-silence** — every displayed number cites source or is hidden
5. **K-anonymity tiered** — K≥5 demand · K≥10 pricing · K≥20 margin · never PII (per ADR-0016)
6. **Consent-first cross-tenant contribution** — opt-in per category · opt-out immediate (per ADR-0016)
7. **Every schema is an ADR before code** — no unratified data models in production
8. **Every merchant-facing surface passes advisory panel signoff** before Commercial GA
9. **Every AI-drafted external communication requires merchant approval** — no exceptions at Levels 1-3
10. **Emergency Stop non-negotiable** — persistent 2s SLA halt on every merchant surface (per ADR-0019)
11. **No voice on customer purchasing path** — permanent constitutional NO
12. **Data portability + RTBF operational before cross-tenant reads ship** — GDPR is not optional

---

## Section 8 · Cost + Team Assumptions

Per Build Execution Playbook §13 with adjustments post-ADR:

- **Year 1 team:** 5 engineers + 4 Trade Brain Authors (contract) + 1 PM + Legal Counsel (retained) + 1 designer + 1 QA
- **Y1 Author budget:** £45k-£85k (per Trade Brain Author Recruitment Package)
- **Y1 Legal Counsel budget:** ~£30k-£60k (retained · GDPR + wholesale + AI framework)
- **Y1 Infrastructure:** approximately £2k-£12k per merchant per month at scale (per ES-06 §27)
- **Y1 Advisory panel:** £50k-£100k (5-15 merchants under paid honorarium)
- **Total Y1 team + author + advisory + legal budget:** approximately £400k-£600k excluding engineering salaries

Engineering headcount grows Y2 → Y3 per Build Execution Playbook §13.

---

## Section 9 · What This Roadmap Does Not Do

- Does not change the phase blueprints (26-33) · they remain authoritative for feature scope
- Does not supersede ES-01 · ES-01 remains authoritative for architectural decisions
- Does not change the Master Architecture · it clarifies execution sequence within it
- Does not defer any launch gate from Build Readiness Report §17.2
- Does not skip Phase 0 preparation regardless of pressure

---

## Section 10 · Delivery Cadence

**Weekly:** engineering standup · advisory panel review of prior week · CTO risk review

**Bi-weekly:** advisory panel field session (paid attendance)

**Monthly:** executive review of milestone progress · budget variance · Author retention

**Quarterly:** Trade Brain accuracy audit by respective Authors · KPI review against roadmap · risk register update

---

## Section 11 · When This Roadmap Changes

Version bump this document (not the phase blueprints) when:

- ADR ratification reveals a scope adjustment
- Merchant advisory panel identifies blocking issue
- Legal Counsel adjusts a compliance requirement
- Trade Brain Author availability shifts timeline
- External vendor change (LLM provider · pricing) affects budget

Never version bump this to accelerate. Only to reflect reality.

---

**End of Nex Implementation Roadmap v2.**

*Working document. Update as Phase 0 progresses. Full re-write only if 3+ material changes accumulate.*

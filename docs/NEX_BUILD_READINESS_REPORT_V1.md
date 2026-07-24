# Nex Build Readiness Report v1.0

**Pre-autonomous-development audit · 2026-07-23**
**Purpose:** determine honestly whether Nex is ready for autonomous implementation. Not a strategy document. An audit.

**Reviewed:** Master Architecture v1.0 · ES-01/02/03/06/10 · Build Execution Playbook v1.0 · Pre-Launch Validation Report v1.0 · Pre-Launch Implementation Plan v1.0 · All 33 phase blueprints · Business Builder V2 · Chat V2 · SiteBook V2 · Memory V2 · IS-06-14 Crosswalk · Current codebase (25 shipped phases + Memory V0).

**A note on document canon:** the prompt references "IS-01 to IS-14". IS-01 through IS-05 were never produced as standalone documents. The intelligence they would cover is embedded in existing phase blueprints (Memory Engine · Trade Brains · Estimator · Twin · Workforce). IS-06 through IS-14 exist as the Crosswalk document mapping to existing phases without duplication. This is called out here for honesty; the audit proceeds against what actually exists.

---

## Executive Summary

**Verdict: Nex is NOT ready for autonomous implementation. Nex IS ready for structured supervised implementation.**

**Current Architecture Score: 74/100.**

The gap between "structured supervised" and "autonomous" is 6 blocking dependencies. Every dependency is under management control and achievable inside 30 days. This report specifies exactly what those dependencies are, what to build in the first 30 days to close them, and what NOT to build until the substrate is solid.

**The trap to avoid:** treating the 33 phase blueprints as buildable-in-parallel. They are not. Substrate before surface (per ES-01). Every attempt to build downstream features before their upstream dependencies creates architectural debt that compounds.

**Top-line recommendation:** ratify 5 ADRs · retain legal counsel · recruit 4 Trade Brain authors · complete Memory V1 · run 100 simulation scenarios against V2 designs · then begin autonomous implementation. Not before.

---

## 1 · Current Architecture Score /100

Scored across 12 dimensions. Each dimension 0-10. Total 120 raw · normalised to 100.

| Dimension | Raw score | Rationale |
|-----------|-----------|-----------|
| Substrate depth (Phases 1-25 + Memory V0 shipped) | 10/10 | Real code · 856+ tests · production-tested substrate |
| Architectural decisions documented (ES-01) | 10/10 | 14 material corrections applied · defensible choices |
| Data + event architecture (ES-02) | 9/10 | Complete except needs ES-04 security depth |
| API contract specification (ES-03) | 9/10 | 33 endpoint categories specified · OpenAPI-ready |
| DevOps + infrastructure (ES-06) | 8/10 | Vercel + Supabase pattern documented · missing SRE runbooks |
| Master Architecture cohesion | 10/10 | Dependency graph explicit · sequencing sound |
| Blueprint depth for critical features (Phases 27-33) | 8/10 | Blueprints complete · authoring work not started |
| Validation Report honesty | 10/10 | Brutal-honest simulation · 100 ranked improvements |
| Implementation Plan practicality | 9/10 | Sprint plan realistic · CTO cuts applied |
| V2 specs execution-ready (Chat, SiteBook, Memory, Business Builder) | 8/10 | Production specs delivered · dependencies flagged |
| Legal + compliance foundation | 4/10 | Not yet engaged · GDPR/RTBF workflows underspecified · consent framework not ratified |
| Human resources readiness | 4/10 | Trade Brain Authors not recruited · advisory panel not formalised · SRE not hired |

**Raw total: 99/120 = normalised 82.5/100 · adjusted down to 74/100 to weight the two 4/10 dimensions as blocking.**

Why the adjustment: legal + human resources gaps are foundation-level. They cannot be fixed later without rework. A 9/10 in every technical dimension paired with a 4/10 in legal = a real 74/100 platform, not 82.

---

## 2 · What is Production-Ready

Explicit inventory of what exists as real code today.

### 2.1 Shipped substrate (25 phases + Memory V0)

Every module under `src/lib/nex/`:

- bi (5) · pi (6) · est (7) · cx (8) · md (9) · fi (10) · sc (11) · pm (12) · cv (13) · net (14)
- ab (15) · cc (16) · mp (17) · xp (18) · orch (19 · 24) · world (20) · global (21)
- ops (22) · twin scenario simulator (23) · bos (25) · memory V0 (26)

**Real evidence:** 856+ tests passing in shipped Vitest suite · zero TypeScript errors on `tsc --noEmit` · production Supabase deployment · Stripe integration live · WhatsApp integration live.

### 2.2 Infrastructure

- Vercel account + deployment pipeline
- Supabase Postgres (production tenancy per current merchant memory)
- Stripe live keys
- Companies House API integration (per merchant memory · shadow-profile scraper)
- Anthropic API integration (Claude Opus 4.7 per merchant memory pin)
- Trade Centre + Marketplace + Studio surfaces in production

### 2.3 Documentation authority

- Master Architecture v1.0 (product roadmap)
- ES-01 Engineering Bible (architectural decisions)
- ES-02 Data & Event Architecture
- ES-03 API & Service Architecture
- ES-06 DevOps & Infrastructure
- ES-10 Enterprise Scale Blueprint
- Build Execution Playbook v1.0
- Pre-Launch Validation Report v1.0
- Pre-Launch Implementation Plan v1.0
- 33 phase blueprints (individual)
- 4 V2 specs (Business Builder · Chat · SiteBook · Memory)

**Everything above is real, versioned, referenced in MEMORY.md · retrievable for engineering execution.**

---

## 3 · What is Still Conceptual

Explicit inventory of what does NOT exist as real code.

### 3.1 Blueprinted but not built

- **Phase 27 Trade Brains** — framework specified, JSON pack format defined, but zero Brains authored beyond Phase 24's thin stubs
- **Phase 28 AI Estimator Engine** — pipeline blueprinted, Vision AI innovations specified, but no `estimator/` composition layer in code
- **Phase 29 Digital Construction Twin** — event-sourced Twin blueprinted, but no `twin-live/` module in code (only Phase 23 scenario simulator)
- **Phase 30 Market Intelligence** — signal store + fusion + wholesale channel blueprinted, no `market/` module
- **Phase 31 Business Builder** — original V1 blueprint superseded by V2 spec, neither built
- **Phase 32 Autonomous Workforce** — role manifest system blueprinted, no `workforce/` module in code
- **Phase 33 Workforce Economy** — Employment Centre + hire conversation UX specified, no `employment/` module

### 3.2 V2 redesigns awaiting implementation

- Business Builder V2 (Sprint 3 target)
- Chat V2 (Sprint 4 target)
- SiteBook V2 (Sprint 4 target)
- Memory V2 (Sprint 4 target)

### 3.3 ES documents not yet produced

- **ES-04 Security & Compliance Deep-Dive** — reserved slot, not written
- **ES-05 Testing & AI Evaluation Framework** — reserved slot, not written
- **ES-07 Analytics & Business Intelligence Infrastructure** — reserved slot
- **ES-08 Partner Integration Framework** — reserved slot
- **ES-09 Enterprise Governance** — reserved slot

Some of these should be produced before autonomous implementation (ES-04, ES-05).

### 3.4 IS-01 to IS-05 status

Never produced as standalone documents. The intelligence layer they would cover exists distributed across shipped phases + Phase 27/28 blueprints. Do not treat "IS-01 to IS-05" as gaps requiring documentation; treat the phase blueprints as authoritative.

---

## 4 · Missing Dependencies

Six blocking dependencies. None can be built around.

### 4.1 Five ADRs unratified

Per ES-01 §14.10 · Build Execution Playbook §15 · Implementation Plan §12:

1. **Memory Engine cross-tenant privacy ADR** — governs Phase 26 V1 K-anonymity thresholds
2. **Trade Brain 10-module contract ADR** — locks Brain JSON schema before authors write against it
3. **Twin event log schema ADR** — locks Phase 29 event log before code diverges
4. **Workforce trust ladder ADR** — locks 4-level (simplified from 7) trust ladder per ES-01 correction
5. **Workforce Economy honesty non-negotiables ADR** — locks Phase 33 fake-content prevention rules

**Blocking impact:** any code written against unratified schemas will need reversal when ADRs land. Unratified = do not build.

### 4.2 Trade Brain Authors not recruited

Per Build Execution Playbook §13.6 (hiring priority rule #1): **contract Trade Brain Authors BEFORE hiring the second AI engineer.**

Current state: zero authors under contract.

Required for autonomous implementation: 4 authors (Electrician + Plumber + Roofer + Carpenter) under written contract with honorarium structure.

Estimated time: 4 weeks to identify + contract.

### 4.3 Legal counsel not retained

Per Build Execution Playbook §13.6 hiring rule #2: **hire Legal BEFORE cross-tenant memory ships.**

Current state: no legal counsel retained.

Required for autonomous implementation:
- GDPR / UK Data Protection Act review of Memory Engine cross-tenant contribution
- Terms of use draft for AI-employment framing (Phase 33)
- Wholesale data channel agreement templates
- Right-to-be-forgotten workflow legal validation

Estimated time: 4 weeks to engage and complete first review pass.

### 4.4 Data portability + right-to-be-forgotten workflows undesigned

Per ES-01 §14.1 correction #12: flagged as first-class engineering requirement.

Current state: high-level requirement in Phase 26 blueprint; concrete implementation not specified.

Required for autonomous implementation: ES-04-equivalent spec covering:
- Cascade delete algorithm across all tenant tables
- Media asset deletion from storage
- Cross-tenant rollup regeneration on merchant deletion
- Audit log retention floor per jurisdiction
- Export format for portability + import compatibility

Estimated time: 3 weeks (specification + review + prototype).

### 4.5 Multi-user team RBAC undesigned in detail

Per ES-01 §14.1 correction #13: flagged as first-class engineering.

Current state: role hierarchy specified conceptually (Owner/Admin/Manager/Member/Auditor), simplified to 3 roles in ES-01 (Owner/Manager/Member for V0). Concrete permission matrix + RLS policy design not complete.

Required for autonomous implementation: permission matrix specification + RLS policy template per tenant table.

Estimated time: 2 weeks.

### 4.6 Model outage handling undesigned

Per ES-01 §14.1 correction #14: flagged as first-class engineering.

Current state: `ai/` orchestration layer specified conceptually. Concrete fallback ladder per capability not defined.

Required for autonomous implementation: per-capability fallback specification (Claude Opus → Haiku → cached similar → canned response) + chaos test suite.

Estimated time: 2 weeks.

**Total blocking dependency work: ~11 weeks parallelised into 4 weeks with concurrent execution.**

---

## 5 · Technical Foundations to Complete First

Concrete list of what must be built before autonomous implementation begins.

### 5.1 Substrate completions

1. **Memory V1** (cross-tenant rollups + K-anonymity gate + opt-out UI) — 6 weeks per Build Execution Playbook §5.1
2. **Trade Brain V0** (Electrician reference implementation) — 6 weeks parallel with Memory V1
3. **Migrate Phase 24 trade agents to Brain contract** — 2 weeks after V0

### 5.2 Infrastructure completions

1. Feature flag admin UI (currently DB-only per Implementation Plan §7)
2. Admin diagnostic tools (per Validation Report C-17)
3. Retry queue viewer for task queue debugging
4. Structured logging + monitoring for Workforce actions

### 5.3 Missing ES documents

1. **ES-04 Security & Compliance Deep-Dive** — must be produced before Workforce V0 goes live (autonomous agent framework needs security review)
2. **ES-05 Testing & AI Evaluation Framework** — must be produced before Trade Brain V1 authoring begins (test criteria drive authoring quality)

### 5.4 Pre-launch validations from Validation Report

The 14 Critical improvements from Pre-Launch Implementation Plan §2 must ship before Commercial GA, but the top 6 are foundation-blocking:

1. C-11 Payment failure recovery (blocks any paid tier reliability)
2. C-16 Multi-user RBAC (blocks mid-tier merchant onboarding)
3. C-17 Admin diagnostic tools (blocks operational support)
4. H-24 GDPR export usability (blocks legal compliance)
5. H-25 Right-to-be-forgotten workflow (blocks legal compliance)
6. H-30 Model outage graceful degradation (blocks reliability SLA)

Build these before Sprint 1 completes, not after.

---

## 6 · First 30 Days · Recommended Actions

Concrete execution list for the next 30 days. Every action is directly enabling or unblocking.

### Week 1

- **Ratify 5 ADRs** (Product + Engineering + Legal signoff)
- **Retain legal counsel** on written engagement letter
- **Begin Trade Brain Author recruitment** (identify candidates via trade unions + colleges + advisory panel)
- **Design ES-04 spec outline** (Security & Compliance)
- **Design ES-05 spec outline** (Testing & AI Evaluation)

### Week 2

- **Finalise ES-04 Security & Compliance Deep-Dive**
- **Finalise ES-05 Testing & AI Evaluation Framework**
- **Begin Memory V1 implementation** (cross-tenant rollup crons + K-anonymity gate)
- **Contract first 2 Trade Brain Authors** (Electrician + Plumber)
- **Design data-portability workflow** (cascade delete spec + export format)

### Week 3

- **Begin Electrician Brain V0 authoring** (with recruited author)
- **Ship data-portability + right-to-be-forgotten workflows** (per legal review)
- **Ship multi-user RBAC V0** (3-role · Owner/Manager/Member)
- **Ship model outage graceful degradation** (fallback ladder per capability)
- **Merchant advisory panel formalisation** (5 pilot merchants under paid honorarium contract)

### Week 4

- **Complete Memory V1** (6-week timeline started Week 2 · in flight)
- **Complete Electrician Brain V0** (6-week timeline started Week 3 · in flight)
- **Contract remaining 2 Trade Brain Authors** (Roofer + Carpenter)
- **Ship the 6 foundation-blocking Critical improvements** from Validation Report
- **Run 100 simulation scenarios against V2 designs** (validate Business Builder V2, Chat V2, SiteBook V2, Memory V2 in synthetic environment before autonomous build begins)

### End of month 1

Nex has:

- 5 ADRs ratified
- Legal counsel retained
- 4 Trade Brain Authors under contract
- ES-04 + ES-05 specifications complete
- Memory V1 progressing
- Data portability + RBAC + model outage handling shipped
- Simulation validation of V2 designs complete
- Merchant advisory panel formalised

**Only then does autonomous implementation of Sprint 1 through Sprint 5 begin per Implementation Plan.**

---

## 7 · What Should NOT Be Built Yet

Explicit "do not build" list. Every item is deferred by architectural or commercial reason.

### 7.1 Deferred by architectural dependency

- **Phase 28 Estimator V0** — blocked by Trade Brain V1 · do not start before Sprint 3
- **Phase 29 Twin V0** — blocked by Trade Brain V1 + Estimator V0 · do not start before Sprint 4
- **Phase 30 Market Intelligence V0** — blocked by Memory V1 · do not start before Sprint 5 minimum
- **Phase 31 Business Builder V0** — replaced by V2 spec; V2 blocked by Trade Brain V1 · do not start before Sprint 3
- **Phase 32 Workforce V1-V2** — blocked by Workforce V0 substrate · do not start Full 25-agent expansion before Sprint 5 onwards
- **Phase 33 Workforce Economy V2-V4** — blocked by V0-V1 substrate · do not start career progression or specialist marketplace before Y2

### 7.2 Deferred by commercial readiness

- **Wholesale API for third-party licensing** (Phase 30 V3) — no paying customer signals yet · defer to Y3
- **International expansion beyond UK pilot** (Phase 31 country forks) — no proven UK playbook · defer to Y2 after UK Commercial GA
- **Enterprise SSO + SAML** (Phase 32 enterprise) — no enterprise contract in hand · defer until first enterprise pilot
- **Native mobile app** (iOS/Android) — PWA suffices for V0 · defer to Y2+
- **Homeowner Twin subscription monetisation** — requires Twin V2 · defer to Y3

### 7.3 Deferred by trust readiness

- **Level 6 auto-execute for any Workforce agent** — requires 100 approved Draft events per agent per merchant · never at V0
- **Cross-merchant AI shadowing** (Phase 33 V4) — requires trust framework mature · defer until Y3
- **Wholesale data licensing agreements** — requires legal + consent framework proven at scale · defer to Y3

### 7.4 Deferred as constitutional violation

- **Voice on customer purchasing path** — permanent NO per merchant memory rule
- **Auto-send customer-facing communications without merchant approval** — permanent NO per approval discipline
- **AI-generated legal advice** — permanent NO
- **Fake reviews or testimonials generation** — permanent NO per Business Builder V2 §14.7

### 7.5 Should probably never be built

- Voice-facing SEO schema (per feedback_no_voice_seo_at_all.md)
- Speakable SpecificationSchema in any form
- Any feature that fabricates statistics for merchant-facing display
- Any dark pattern (forced tours, countdown timers, dark unsubscribe)

---

## 8 · Fastest Commercial Validation

What proves the platform's value fastest with real merchants.

### 8.1 First revenue signals

**Rank ordered by time-to-revenue:**

1. **Business Builder V2 · Sprint 3** — new merchant sign-ups (Free tier + immediate conversion pressure). Time to first paying merchant: 60 days from V2 launch.
2. **Estimator V0 · Sprint 3** — merchants upgrade to Professional (£14.99/mo) to unlock multi-trade estimates. Time to observable ARPU lift: 30 days from launch.
3. **Employment Centre V0 · Sprint 5** — 14-day trial converts to paid Employment Centre subscribers. Time to conversion measurement: 45 days from launch.
4. **Regional Market Reports · Sprint 5+** — first paying wholesale customer (supplier or manufacturer). Time to first wholesale £: 6-12 months from Market Intelligence V0.

### 8.2 First engagement signals

**What proves merchants love the product (not just pay):**

1. Chat V2 as home screen · daily active use (per Validation Report simulated finding: chat became primary UI)
2. Memory V2 correction UX · low correction rate = high trust
3. SiteBook V2 photo diary · sustained daily uploads
4. Twin timeline scrubbing · homeowner engagement

### 8.3 First moat signals

**What proves competitors cannot catch up:**

1. Memory V1 rollups at K≥5 for 3 UK regions × 5 trades (30-90 days of contributor density)
2. Trade Brain corrections accumulating per merchant per Brain
3. Twin event log accumulating per project
4. First cross-project pattern lending observation validated

---

## 9 · Strongest Long-Term Moat

Per Master Architecture §7 · ES-10 §15.

### 9.1 The four durable advantages

1. **Composition depth × time** — 33 phases interdependent · years of substrate
2. **Cross-tenant memory density** — K-anonymised regional rollups years-deep
3. **Trade Brain authorship** — human masters authoring playbooks over years
4. **Twin persistence** — event-sourced project records surviving handover · homeowner-transferable

### 9.2 What to invest in for moat compounding

Build order to maximise moat compound:

1. Memory V1 (cross-tenant substrate — everything else builds on this)
2. Trade Brains V1 (authorship depth compounds year over year)
3. Twin V0-V1 (event log accumulating per project · years to matter · start now)
4. Market Intelligence V0-V1 (signal density × time · start Y2 to compound by Y5)

### 9.3 What to invest in for commercial velocity

Build order to maximise immediate revenue:

1. Business Builder V2 (acquisition removed friction)
2. Estimator V0-V1 (ARPU driver #1)
3. Workforce V0 + Employment Centre V0 (category shift · higher ARPU)
4. Weekly digest + approval fatigue solutions (retention)

**These two orderings are compatible.** The Implementation Plan already sequences them correctly. The 30-day preparation phase enables both.

---

## 10 · MVP Definition

The minimum shippable product to Commercial GA.

### 10.1 MVP scope

- Phase 1-25 substrate (already shipped)
- Memory V0 (already shipped) + Memory V1 (Sprint 1-2 delivery)
- Trade Brain V0-V1 (4 Brains: Electrician + Plumber + Roofer + Carpenter authored)
- Business Builder V2 (Sprint 3 delivery)
- Estimator V0-V1 (Sprint 3 delivery)
- Chat V2 (Sprint 4 delivery)
- SiteBook V2 (Sprint 4 delivery)
- Memory V2 (Sprint 4 delivery)
- Workforce V0 · 5 core agents (Sprint 1-2 delivery)
- Workforce Economy V0 · Employment Centre (Sprint 2 delivery)
- All 14 Critical Validation Report improvements shipped
- 10 launch gates from Implementation Plan §9 all Ready

### 10.2 MVP explicitly excludes

- Full Phase 32 workforce (25+ agents) · MVP has 5
- Full Trade Brain roster (40 trades) · MVP has 4
- Phase 29 Twin V1+ (event log substrate only for MVP)
- Phase 30 Market Intelligence
- International markets
- Enterprise features
- Homeowner-facing product
- Wholesale channels
- BIM ingest
- Native mobile app

### 10.3 MVP timeline

**14 weeks from ratification of blocking dependencies:**

- Weeks 1-4: dependency removal (30-day plan above)
- Weeks 5-6: Sprint 1 (Trust Foundation)
- Weeks 7-8: Sprint 2 (Approval Sanity)
- Weeks 9-10: Sprint 3 (Onboarding + Estimator)
- Weeks 11-12: Sprint 4 (On-Site + Memory + Twin V0)
- Weeks 13-14: Sprint 5 (Commercial + Enterprise base)
- Weeks 15-18: Bugfix + polish + closed beta
- Weeks 19-22: Commercial GA readiness

**Total: ~22 weeks (5.5 months) from today to Commercial GA.**

---

## 11 · Phase Roadmap

Aligned with Master Architecture v1.0. Simplified for build readiness.

### Phase Alpha · Days 1-30 · Preparation

- ADR ratification · legal engagement · author recruitment · ES-04/05 · foundation fixes

### Phase Beta · Weeks 5-14 · MVP Build

- Sprints 1-5 per Implementation Plan
- All Critical Validation improvements
- Trade Brain V1 authoring (4 Brains complete)
- Memory V1 + Memory V2 UX

### Phase Gamma · Weeks 15-22 · Beta + GA

- Closed beta with 50-100 merchants
- Bugfix + polish
- Commercial GA at week 22

### Phase Delta · Months 6-12 · Y1 Growth

- Grow to 100+ merchants
- Full Trade Brain V2 (10 total)
- Twin V0 → V1
- Workforce V0 → V1-V2

### Phase Epsilon · Y2+ · Category Shift

- Ireland + Australia expansion
- Business Builder V1 (5 trades UK-wide)
- Full workforce catalog
- Market Intelligence V0-V2 begins

Per Master Architecture § 5.1-5.5 and ES-10 §10.

---

## 12 · Engineering Task Priorities

Top-priority engineering tasks for the next 30 days.

### 12.1 Substrate

1. Memory V1 · cross-tenant rollup crons (P0)
2. Memory V1 · K-anonymity gate at reader (P0)
3. Memory V1 · opt-out UI (P1)
4. Trade Brain runtime loader (P0)
5. Brain boot audit (P0)

### 12.2 Foundation

1. Multi-user RBAC data model + migrations (P0)
2. Data portability export flow (P0)
3. Right-to-be-forgotten cascade delete (P0)
4. Model outage fallback ladder (P0)
5. Feature flag admin UI (P1)
6. Admin diagnostic tools (P1)

### 12.3 Reliability

1. Payment failure recovery (P0)
2. Chat V2 SSE streaming stability (P1)
3. Vision approval queue (P1)

### 12.4 Testing infrastructure

1. AI evaluation suite skeleton (P0)
2. Construction accuracy test framework (P0)
3. Chaos test harness (P1)
4. Load test infrastructure (P1)

---

## 13 · Database Priorities

Top-priority database work for the next 30 days.

### 13.1 New tables required for foundation

- `hammerex_nex_memory_trade` (Memory V1)
- `hammerex_nex_memory_region` (Memory V1)
- `hammerex_nex_memory_optout` (Memory V1 opt-out registry)
- `hammerex_nex_team_members` (multi-user RBAC)
- `hammerex_nex_permissions` (RBAC permission matrix)
- `hammerex_nex_platform_gdpr_requests` (portability + deletion)
- `hammerex_nex_platform_ai_provider_status` (model outage tracking)
- `hammerex_nex_platform_feature_flags` (V0 already exists · extend)

### 13.2 RLS policies

Every new tenant table needs RLS policy documented + tested. Templated per Section 8.7 of ES-01.

### 13.3 Migration order

1. Memory V1 tables (Weeks 2-8)
2. RBAC tables (Weeks 3-4)
3. GDPR tables (Weeks 3-4)
4. Provider status (Week 4)
5. Feature flag extension (Week 1)

No dependency conflicts if executed in this order.

---

## 14 · AI Priorities

Top-priority AI infrastructure work for the next 30 days.

### 14.1 Orchestration layer

1. `ai/` module refactor to enforce provider abstraction (per ES-01 §7)
2. Router with fallback ladder
3. Adapter per provider (Claude Opus · Haiku · OpenAI Vision · OpenAI Embed · Google Doc AI)
4. Budget enforcement per merchant per day
5. Cache with 30-day TTL on identical prompts

### 14.2 Trade Brain framework

1. JSON pack schema Zod validation
2. Runtime loader with hot reload
3. Boot audit for pack validity
4. Prompt template versioning per Brain
5. Brain voice unifier integration with mesh

### 14.3 Prompt safety

1. Prompt injection sanitisation on merchant-provided text
2. Structured prompt templates with slot filling
3. Adversarial evaluation suite (500+ red-team prompts)
4. Content safety filter on merchant-facing outputs

### 14.4 Model outage handling

1. Per-capability fallback specification
2. Circuit breaker per provider
3. Chaos test suite simulating provider outages
4. Graceful degradation UX

---

## 15 · UI Priorities

Top-priority UI work for the next 30 days.

### 15.1 Design system extensions

1. Confidence indicator component (used across every AI output surface)
2. Evidence popover component (used across every displayed fact)
3. Voice input button + transcription review UI
4. Camera capture with Vision AI integration
5. Approval inbox with batch actions

### 15.2 New surfaces required

1. Feature flag admin console (internal · foundation)
2. Admin diagnostic tools (support · foundation)
3. GDPR request handling (compliance · foundation)
4. Multi-user team management (foundation)
5. Memory Dashboard (Memory V2 · required to precede Chat V2 · SiteBook V2)

### 15.3 Mobile-first foundations

1. PWA installation + service worker
2. Offline queue infrastructure (SiteBook V2 foundation)
3. Web Speech API wrapper (Chat V2 + SiteBook V2 shared component)
4. Direct-to-storage media upload flow

---

## 16 · Revenue Priorities

Ranked by fastest revenue impact per engineering hour.

### 16.1 Immediate

1. Payment failure recovery (protects existing revenue · Sprint 1)
2. Business Builder V2 (acquisition · Sprint 3)
3. Estimator V0 (ARPU · Sprint 3)
4. Workforce Economy V0 (trial conversion · Sprint 5)

### 16.2 Near-term

5. Chat V2 (engagement + retention · Sprint 4)
6. SiteBook V2 (retention + engagement · Sprint 4)
7. Memory V2 (trust · Sprint 4)
8. Multi-user RBAC (mid-tier segment · Sprint 1-2)

### 16.3 Medium-term

9. Twin V0 (unique value proposition · Sprint 4+)
10. Full 4 Trade Brains authored (Professional tier value · Sprint 2-3)

### 16.4 Long-term

11. Market Intelligence V0 (wholesale ceiling · Y3)
12. Enterprise features (enterprise tier · Y2-Y3)
13. Homeowner subscriptions (post-handover ARPU · Y3)

**Priorities 1-4 combined generate the vast majority of Y1 revenue lift.**

---

## 17 · Final Verdict

### 17.1 Is Nex ready for autonomous implementation?

**No, not today. Yes, in 30 days.**

The gap is 6 blocking dependencies + 6 foundation shipments. All achievable in 30 days with focused execution. None require breakthrough capability.

### 17.2 What must be true to unlock autonomous implementation

1. All 5 ADRs ratified
2. Legal counsel retained + first review complete
3. Trade Brain Authors under contract (minimum 2, ideally 4)
4. ES-04 + ES-05 specifications produced
5. Data portability + RBAC + model outage handling shipped
6. Merchant advisory panel formalised
7. 100 simulation scenarios validated against V2 designs

Complete these seven · autonomous implementation begins Week 5.

### 17.3 Architecture Score adjustment path

Current: 74/100.

After 30-day preparation phase: 88/100 (both 4/10 dimensions reach 8/10 with the actions above).

After Sprint 5 completion: 92/100 (all major surfaces built to V0 quality).

After Closed Beta advisory panel signoff: 95/100 (validated with real merchants).

**Commercial GA readiness threshold: 90/100.**

### 17.4 The trap to avoid

Do NOT begin building Sprints 1-5 before completing the 30-day preparation phase. Every attempt to accelerate past the foundation stage creates architectural debt that costs 3× more to unwind than the sprint time saved.

**Substrate before surface. This principle is documented across every ES document for a reason.**

### 17.5 Recommendation

**Approve Nex for structured supervised implementation starting today, subject to the 30-day preparation phase completing before autonomous mode.**

Structured supervised = work happens against the specified sprint plan with weekly CTO review + advisory panel checkpoints. This is what starts Monday.

Autonomous = engineering executes multiple sprints in parallel without weekly CTO gates. This begins Week 5 after preparation completes.

The distinction matters. Structured supervised catches architectural drift early. Autonomous relies on the foundation being solid.

---

## Appendix · Document Canon Post-Audit

Authoritative order for engineering decisions:

1. **This document (Build Readiness Report v1.0)** — gates entry to autonomous implementation
2. ES-01 Engineering Bible — WHY architecturally
3. ES-02 Data & Event Architecture — HOW data flows
4. ES-03 API & Service Architecture — HOW modules communicate
5. ES-06 DevOps & Infrastructure — HOW production runs
6. ES-10 Enterprise Scale Blueprint — WHERE Nex goes long-term
7. Master Architecture v1.0 — WHAT product
8. Build Execution Playbook v1.0 — WHEN sprint plan
9. Pre-Launch Validation Report v1.0 — findings
10. Pre-Launch Implementation Plan v1.0 — Critical/High resolution
11. Business Builder V2 · Chat V2 · SiteBook V2 · Memory V2 · specs
12. IS-06-14 Crosswalk — mapping to existing phases
13. Individual phase blueprints (Phases 1-33)
14. CLAUDE.md — repository conventions
15. MEMORY.md — persistent context

**End of Nex Build Readiness Report v1.0.**

*Re-audit at end of 30-day preparation phase. If Architecture Score >88/100 and 7 conditions in §17.2 met · unlock autonomous implementation for Sprint 1.*

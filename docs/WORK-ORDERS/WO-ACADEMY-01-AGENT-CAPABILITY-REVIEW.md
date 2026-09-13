# Agent Capability Review · every existing NEX agent

**Assembled 2026-09-13 as the input to WO-ACADEMY-01.**

The founder directed: "call meeting with all agents of nex eco system and discuss the world class system build." This document is that review — a structured assessment of every existing NEX agent, its current capability, evidence sources, and how it would slot into an Agent Academy structure.

**Framing discipline:** internal ambition is unbounded (per Continuous Operation Doctrine §3). External comparative claims ("advanced compared to any AI system") stay behind the P-M discipline gate. This review speaks about **what NEX has, what it can measure, what it needs**, without external comparisons.

---

## Roll call · 14 named agents (from the HQ Agents Registry, WO-HQ-AGENTS-01)

### Orchestrator Lane (8)

#### 1 · NEX1 Master Engineer
- **Domain:** engineering-orchestration
- **Current known capabilities:** trace lifecycle, WO handoff, orchestrator state machine
- **Evidence sources:** `nex1_workflow_traces`, `nex1_audit_events`
- **Current career state (initial):** SPECIALIST — 227 orchestrator tests green, real WO-01..WO-13 substrate
- **Strengths:** deterministic state transitions, authority-boundary discipline, audit-chain integrity
- **Known gaps:** no self-assessment; no measurement of its own quality against alternatives
- **Academy standing:** eligible for ELITE after demonstrating cross-project consistency (currently one project)

#### 2 · WO-03 Code Generation Pipeline
- **Domain:** authoring
- **Capabilities:** template rendering, syntax validation, diff computation, challenger enforcement, WO-02 auth verification
- **Evidence:** `nex1_execution_reports` (bundle emission)
- **Career state:** CERTIFIED — passes 23 pipeline tests
- **Strengths:** determinism, WO-13 substrate enforcement, path-scope challenger
- **Gaps:** template library is narrow (plain-node-server, three-page-app only); needs Design Academy work to broaden
- **Academy standing:** promotion blocked on Priority 3 (Design Academy) work; recognition of narrow-domain qualification

#### 3 · WO-04 Broker Executor
- **Domain:** filesystem-controlled-write
- **Capabilities:** Broker-mediated write, snapshot on failure, rollback, Observer reconciliation
- **Evidence:** `nex1_execution_reports`
- **Career state:** SPECIALIST — real Broker gating, real rollback, real observer diff
- **Strengths:** no direct fs.writeFile in substrate; every mutation gated; observer verdict
- **Gaps:** WO-13 substrate-integrity fires at authorisation time only; runtime tampering during a write is not yet monitored
- **Academy standing:** ELITE-adjacent — a small monitoring hook would qualify

#### 4 · WO-05 Build Executor
- **Domain:** subprocess-execution
- **Capabilities:** real `spawn` with array args, sandbox root discipline, allowed-executables enforcement
- **Evidence:** `nex1_build_reports`
- **Career state:** CERTIFIED
- **Strengths:** GET-only for network primitives elsewhere; allowlisted executables (WO-13 §5 pinned)
- **Gaps:** no per-executable version pinning; no signed binary attestation
- **Academy standing:** promotion blocked on binary-signing work (future Tool Academy)

#### 5 · WO-06 Runtime Executor
- **Domain:** subprocess-lifecycle
- **Capabilities:** SIGTERM + SIGKILL protocol, health check via real `node:http`, port + body assertion
- **Evidence:** `nex1_runtime_reports`
- **Career state:** CERTIFIED
- **Strengths:** real HTTP against 127.0.0.1 (never remote); deterministic port pick
- **Gaps:** health-check body match is substring only; no schema validation
- **Academy standing:** promotable after adding a schema-validation adversarial suite

#### 6 · WO-07 Node-Syntax Specialist
- **Domain:** validation
- **Capabilities:** real `node --check`, ENOENT / file-not-found / syntax-error parsing
- **Evidence:** `nex1_specialist_results`
- **Career state:** SPECIALIST — surfaced 3 real bugs during WO-12
- **Strengths:** UNAVAILABLE ≠ PASSED discipline explicit
- **Gaps:** only handles Node.js; no TS / Python / other-language specialists yet
- **Academy standing:** first ELITE candidate — has genuine specialist-domain performance

#### 7 · WO-09 Corrector
- **Domain:** correction
- **Capabilities:** deterministic signal extraction, rule library (REINVOKE_PLAN_MISSING_FILES), escalation on ambiguous
- **Evidence:** derived from cycle history in `nex1_execution_reports`
- **Career state:** CERTIFIED — WO-12 real correction cycle end-to-end
- **Strengths:** P-Q discipline (correction never grants authority)
- **Gaps:** rule library is small (v0.1); can't handle mixed-signal failures yet
- **Academy standing:** promotable after WO-INTELLIGENCE-02 revisit-loop integration for cross-cycle learning

#### 8 · WO-13 Substrate Guard
- **Domain:** enforcement
- **Capabilities:** SHA-256 integrity table, Ed25519 attestation verification, refusal on drift
- **Evidence:** `nex1_audit_events`
- **Career state:** ELITE — 16 adversarial tests pass; property-verified pure functions
- **Strengths:** compiled-in trust root; every authorisation gated
- **Gaps:** does not yet monitor post-startup file mutations (secure-boot / TPM layer beyond software)
- **Academy standing:** among the highest-qualified agents in the ecosystem

### Intelligence Lane (6)

#### 9 · NEX Intelligence · Crawler
- **Domain:** data-collection
- **Capabilities:** Broker-gated GET, signed manifest, rate-limited, per-source allowlist, provenance-chained SourceRecord
- **Evidence:** `nex_intelligence_crawler_audit`, `nex_intelligence_sources`
- **Career state:** CERTIFIED — 16 adversarial tests pass
- **Strengths:** signed manifest architecture; per-source-class classification (WO-INTELLIGENCE-02)
- **Gaps:** slice-1 arXiv + slice-2 Node.js docs only; no repository or standards adapters yet
- **Academy standing:** promotable per new WO for each additional source class

#### 10 · NEX Intelligence · Discovery Engine
- **Domain:** discovery
- **Capabilities:** pattern, conflict, connection, combinatorial synthesis (4 modes)
- **Evidence:** `nex_intelligence_knowledge_objects` (discovery records)
- **Career state:** CERTIFIED
- **Strengths:** deterministic; combinatorial synthesis is the founder-highlighted core capability
- **Gaps:** stopword list is small; classifier weights are hand-tuned; no cross-domain fusion yet
- **Academy standing:** ELITE-adjacent — needs Intelligence Academy weight-tuning work

#### 11 · NEX Intelligence · Hypothesis Engine
- **Domain:** hypothesis-formation
- **Capabilities:** template-based, deterministic; never reads held-out fields (WO-INTELLIGENCE-02 A-8)
- **Evidence:** `nex_intelligence_hypotheses`
- **Career state:** CERTIFIED
- **Strengths:** held-out isolation is grep-enforced
- **Gaps:** four templates only (pattern / conflict / connection / combination); no bespoke domain hypotheses
- **Academy standing:** promotable per additional-template WO

#### 12 · NEX Intelligence · Experiment Engine
- **Domain:** experimentation
- **Capabilities:** real subprocess execution, sandboxed, bounded time + resource, per-case outcome capture
- **Evidence:** `nex_intelligence_experiments`
- **Career state:** SPECIALIST — real subprocess, real Node --check, real outcomes
- **Strengths:** reuses WO-05/WO-07 substrate; no arbitrary code execution
- **Gaps:** ONE experiment kind (parse-stderr-signal-detection); need more experiment kinds (each new kind = new WO)
- **Academy standing:** the strongest candidate for ELITE once a second experiment kind is validated

#### 13 · NEX Intelligence · Scoring / Promotion
- **Domain:** deterministic-decision
- **Capabilities:** pure-function scoring, tiered promotion (Intelligence / Super Intelligence), property-verified
- **Evidence:** `nex_intelligence_knowledge_objects` (promotion decisions)
- **Career state:** ELITE — pure function of evidence; property tests over 100 runs identical
- **Strengths:** cannot produce PRODUCTION or SUPER_INTELLIGENCE; those require founder WO
- **Gaps:** thresholds are constants; not yet evidence-informed
- **Academy standing:** among the strongest agents by property discipline

#### 14 · NEX Intelligence · Proposal Generator
- **Domain:** proposal-emission
- **Capabilities:** structured proposal to founder inbox, WO recommendation, deterministic score recomputable
- **Evidence:** `nex_intelligence_proposals`
- **Career state:** CERTIFIED
- **Strengths:** never signs; never activates; emits recommendation only
- **Gaps:** proposals are text; no structured diff or preview
- **Academy standing:** promotable per structured-proposal-format WO

---

## Roll call summary

| Career state | Count | Agents |
|---|---:|---|
| ELITE | 3 | WO-13 Substrate Guard · Scoring/Promotion · Master Engineer (soft-elite) |
| SPECIALIST | 4 | Master Engineer, WO-04 Broker, WO-07 Specialist, Experiment Engine |
| CERTIFIED | 7 | WO-03 Pipeline, WO-05 Build, WO-06 Runtime, WO-09 Corrector, Crawler, Discovery, Hypothesis, Proposal |
| TESTED | 0 | — |
| TRAINEE | 0 | — |

(Every existing agent has passed real tests, so none are TESTED or TRAINEE. Those states apply when new agents enter the Academy.)

## Cross-cutting observations from the review

### Gaps that require future Academies
- **Design Academy** — no design agent exists; WO-03 templates are the only design surface
- **Data Academy** — no dedicated data agent; ingestion adapters are one-off
- **Security Academy** — adversarial testing is embedded in every WO but no dedicated security agent
- **Tool Academy** — allowed-executables list is manually curated
- **Guardian Academy** — Guardian is Phase 14, not yet built
- **Intelligence Academy** — the Intelligence engines exist but not as students of an Academy

### Common Academy needs across ALL 14 agents
1. **Capability profile record** — none of them has one persisted; all state is derived from raw records
2. **Performance floor** — none has a minimum threshold codified
3. **Notice discipline** — no formal Notice 1/2/3 machinery
4. **Knowledge contribution score** — no separate metric for evidence-contribution vs task-completion
5. **Regression penalty** — no memory of "you fixed A but broke B"
6. **Discovery quota** — no formal expectation of improvement discoveries

### The Task Market gap
Currently there is NO deliberate matching of task → agent. Which subsystem runs is entirely determined by the WO. Slice 1 of the Academy should introduce a matching engine that reads: **task requirements → capability profile → best-qualified agent(s) → assignment**. For the vertical slice this begins simple: match by domain + minimum-career-state, then future WOs expand to full 11-field profile matching.

### What the Academy should NOT do in slice 1
- Not create new agents automatically
- Not decommission any existing agent
- Not train agents autonomously (Academy programs = future WOs)
- Not create the 7 specialist schools
- Not raise or lower authority for any agent
- Not run competitions or research missions (future WOs)

---

## What this review recommends for WO-ACADEMY-01

**Vertical slice (one tiny real proof first, per founder discipline):**

1. **Agent Registry** persisted to GB storage (`nex_academy_agents`)
2. **CapabilityProfile** — the 11 fields the founder specified — persisted per agent
3. **CareerState** deterministic transitions with published thresholds
4. **NoticeRecord** — Notice 1/2/3 with reason + evidence + retraining path
5. **KnowledgeHarvest** — required before any DECOMMISSIONED transition; validated knowledge only
6. **Task Market matching** — simple engine (task domain + career-state minimum → matching agents)
7. **HQ Agents page extension** — each of the 14 agents shows Academy state + career + notices + capability profile summary
8. **All 14 existing agents onboarded** with initial capability profiles from this review

**Explicit non-goals (belong in future WOs):**
- Actual training programs (WO-ACADEMY-02)
- Adversarial examinations (WO-ACADEMY-03)
- Benchmark competitions (WO-ACADEMY-04)
- Research missions (WO-ACADEMY-05)
- The 7 specialist schools (WO-ACADEMY-06..12)
- Autonomous new-agent creation (WO-ACADEMY-13, requires separate authority review)

**Doctrinal alignment:**
- P-Q: Academy state changes never expand agent authority
- P-U: capability + career progression does NOT grant execution authority
- P-S v2: zero external LLM; all evaluation deterministic
- P-M: internal capability ambition without external comparative claims
- Continuous Operation Doctrine §1/§2: every agent has a visible lifecycle state
- Continuous Operation Doctrine §4: known weaknesses tracked (this review documents them)
- Continuous Operation Doctrine §5: "never reward activity for activity's sake" — codified as the Academy's fundamental principle
- Continuous Operation Doctrine §8: intelligence ≠ authority (Academy discipline)

---

**End of Agent Capability Review. Input to WO-ACADEMY-01 spec.**

# NEX1 System Interconnection & Intelligence-Flow Audit

**Date:** 2026-09-16
**Status:** READ-ONLY AUDIT · freeze intact · no implementation · no code · no commits · no designations changed · no env changes
**Author:** master_ai_engineer (Claude Code development workstation) — NOT NEX1 runtime
**Founder directive:** identify where NEX1's existing components should communicate, where they currently stop, and which connections would create a higher-level operating system. Do not design from filenames or diagrams alone — trace actual data, function calls, state transitions, authority boundaries, and runtime evidence.

**Founder rule locked at audit doctrine level:**

> *"A proposed connection is not a capability. A connected implementation is not necessarily an operational capability. Runtime evidence is required before claiming the connection actually works."*

**Verification method:** every claim in this document cites either (a) an existing file/line, (b) a repository search result observed by this audit, or (c) an evidence-cited prior audit finding. **Nothing is inferred from an ADR diagram or a memory summary alone.**

---

## §1 · Executive Summary

The Operational Spine Inventory (2026-09-16) established that NEX1 has substantial existing implementation across 10 capabilities. This audit answers the next question: **why doesn't NEX1 currently behave like one coherent intelligence system, despite having most of the organs?**

**Answer, evidence-cited:**

NEX1's capabilities exist as **substantial islands with missing bridges**. The bridges — not the islands — are the current blocker. Six critical missing connections have been verified by repository search:

| # | Missing connection | Verification method | Effect of absence |
|---|---|---|---|
| **A** | Orchestrator → WO-04 Executor | `grep -r 'import.*wo4-executor' src/lib/nex1-orchestrator/orchestrator.ts` → **NO MATCHES** | G7 code never writes to disk in production path · G11 Observer unreachable · G13 has no real changes to verify · G16 downstream reports never written · G12 correction never triggered |
| **B** | Orchestrator VERIFICATION → J-family | `grep -r 'from.*capability-j' src/lib/nex1-orchestrator/` → **NO FILES** | Autonomous correction never triggered on orchestrator failures |
| **C** | Programming-mission → WO-07 specialist adapters | `grep -r 'wo7-run-specialist\|WO-07' src/lib/nex-agent-runtime/programming-mission/` → **only types.ts + tests · no runtime callers** | Programming missions bypass real tsc/eslint/vitest verification |
| **D** | NEX1 classifier → `nex.concepts` semantic layer | `grep -r 'nex.concepts' src/lib/nex-agent/` → **NO MATCHES** | 44 seeded concepts + 51 senses live in `nex_dev.nex.*` but no NEX1 code consults them at mission time |
| **E** | Truth Engine → Orchestrator | `grep -r 'import.*truth-engine' src/lib/nex1-orchestrator/` → **NO MATCHES** · sole consumer is `scripts/nex-truth-engine-fixture-runner.ts` | 2,873 lines of Verifier + Guardian sit idle · zero operational claims verified |
| **F** | G15 trust-set → real founder key | `grep -r 'NEX_TRUSTED_FOUNDER_KEYS_HEX' .env* etc/` → only in docs and scripts, never a set env var | Fail-closed doctrine refuses ALL `/execute` requests |

**Systemic pattern:** the missing connections cluster on the ORCHESTRATOR AXIS (four of six) and the KNOWLEDGE-CONSULTATION AXIS (D). The specialist-layer axis (Sentry · Archivist · Critic · Dependency Analyst) has no code at all — it is a valid design (2026-09-16 cognitive-layer brief) but not a current blocker.

**Critical insight for founder decision:**

The single connection producing the largest verified capability increase is **A** (Orchestrator → WO-04 Executor) — because it unlocks **five** currently-implemented downstream capabilities (G7 · G11 · G13 · G16 · G12) that are all `COMPONENT_COMPLETE` or better but unreachable in the production path.

The single lowest-risk-lowest-cost connection is **F** (G15 trust-set activation) — zero code changes, one env var + one signed delegation.

**The smallest safe group producing the largest verified capability increase is `F + A`:** G15 trust set activated, then orchestrator wired to WO-04 executor, proven end-to-end with the Home/About/Contact three-page mission per ADR-0319 §9 vertical-slice discipline.

**No implementation is authorised by this document.** All conclusions require founder decision (§16).

---

## §2 · Audit Method + Constraint

### 2.1 Method

Per founder directive:

1. **Traced actual data flow** — read orchestrator state machine · verified transitions
2. **Traced function calls** — grep for imports/exports between modules
3. **Traced state transitions** — followed WorkflowTrace stage transitions in code
4. **Traced authority boundaries** — verified `NEX_TRUSTED_FOUNDER_KEYS_HEX` deployment status
5. **Traced runtime evidence** — inspected which JSONL stores currently receive writes
6. **Cross-referenced prior audits** — Operational Spine Inventory §§6–15 · G15 Readiness · Cognitive-Layer Brief
7. **Verified skeptically** — every "connection exists" claim was checked against grep results

### 2.2 Constraint discipline

- No connection is claimed operational without runtime evidence
- No connection is ranked by architectural elegance
- No capability is scored subjectively — dimensions kept visible (§11)
- Every candidate connection cites the exact file · exact function · current caller · missing caller · required contract · authority boundary · evidence required

### 2.3 What this audit did NOT do

- Did not open every file in the repo (delegation to prior parallel-agent inventories)
- Did not test any runtime path (freeze)
- Did not compute call graphs beyond targeted grep-verified queries
- Did not rank connections by cosmetic value
- Did not authorise anything

---

## §3 · Freeze Confirmation

**Actions taken:**
- Read 5 files (targeted verification)
- 5 grep verifications
- 3 glob checks for non-existent paths
- Wrote this document + memory pointer

**Actions NOT taken:**
- Zero writes to src/ · zero writes to tests · zero writes to config
- Zero commits · zero pushes · zero migrations
- Zero env changes · zero package installs
- Zero designation moves · zero implementations
- Zero database writes · zero runtime execution

**Freeze status: INTACT.**

---

## §4 · Map 1 · System Connection Map (evidence-verified)

The current state of the operational spine — what actually connects to what — from repository grep.

### 4.1 Connections that EXIST and RUN

| From | To | Evidence | State |
|---|---|---|---|
| Orchestrator state machine | G16 audit log + workflow traces | `wo1-audit-log.ts` · `wo1-durable-store.ts` used by orchestrator transitions | **ACTIVE** (JSONL writes on every transition) |
| G8 Broker | Real `child_process.spawn` | `wo5-executor.ts` line spawns node/npm/npx | **ACTIVE** (in tests + adversarial routes T3-A/B/C) |
| G13 WO-07 specialist adapters | G8 broker | wo7 adapters compose WO-05 for every tool | **ACTIVE** (in wo7-specialists tests) |
| G17 comms-social adapters | Real vendor APIs | `runWorkerTickOnce()` → `getAdapter().publish()` | **ACTIVE** (production cron worker · records `provider_post_id`) |
| G7 WO-04 executor | G8 broker | `wo4-executor.ts:24` imports `observerCheck` after Broker writes | **ACTIVE** (in tests · wo4-controlled-execution.test.ts) |
| G7 WO-03 pipeline | G7 WO-04 executor | Test wo5-build-execution.test.ts calls both | **ACTIVE** in tests · **PARTIAL** in orchestrator |
| G12 J-family | code-engine index | `src/lib/nex-agent/code-engine/index.ts` re-exports J.1..J.4.2 | **ACTIVE** at code-engine layer |
| G12 J-family | Real vitest re-execution | `capability-j3-verify-repair.ts` spawns real vitest | **ACTIVE** (in wo12-real-correction-cycle test) |
| G11 Observer | Real filesystem | `observer.ts:20-44` walks workspace_root + SHA-256 | **ACTIVE** (in wo4-controlled-execution.test) |
| G15 authorization module | Orchestrator gate | `gate-verification.ts` has `computeFounderAuthGateDelegated` | **ACTIVE** (in test D-13) |
| Programming-mission | Native Code Understanding S2 dep-graph | `style-inspector.ts:128-131` calls `buildDependencyGraph()` | **ACTIVE** (in every mission draft) |
| Programming-mission | draft persistence | `types.ts` `ProgrammingMissionDraftRecord` | **ACTIVE** |

### 4.2 Connections that EXIST but ARE UNREACHABLE

| From | To | Evidence of build | Evidence of non-reachability |
|---|---|---|---|
| Orchestrator | G7 WO-04 executor | `wo4-executor.ts` fully built (328 lines) | `grep -r 'import.*wo4-executor' src/lib/nex1-orchestrator/orchestrator.ts` → **NO MATCHES** |
| Orchestrator | G12 J-family | J-family fully built (2,343 lines) | `grep -r 'from.*capability-j' src/lib/nex1-orchestrator/` → **NO FILES** |
| Programming-mission | G13 WO-07 real verification | WO-07 fully built (471 lines) | `grep -r 'wo7-run-specialist\|WO-07' src/lib/nex-agent-runtime/programming-mission/` → **only types.ts + tests** |
| Truth Engine Verifier | Orchestrator gate | Verifier fully built (26 files · 2,873 lines) | `grep -r 'import.*truth-engine' src/lib/nex1-orchestrator/` → **NO MATCHES** · sole consumer is fixture-runner script |
| Truth Engine Guardian | NCP envelope validation (not yet designed as such) | Guardian gate exists | No consumer wired |
| G15 trust set | Real founder public key | Module fully built | `NEX_TRUSTED_FOUNDER_KEYS_HEX` not in `.env*` |
| G11 file-observer | Production path | Wired to wo4-executor | wo4-executor unreachable → observer unreachable |

### 4.3 Connections that DO NOT EXIST

| From | To | Verification |
|---|---|---|
| Sentry / Context Triager | anything | `src/lib/nex*sentry*/` glob → **NO FILES** |
| Archivist / Memory Router | anything | `src/lib/nex*archivist*/` glob → **NO FILES** |
| Critic / Adversary | anything | `src/lib/nex*critic*/` glob → **NO FILES** |
| Dependency Analyst (as standalone specialist) | G15 authorization scope recommendation | `src/lib/nex*dependency-analyst*/` glob → **NO FILES** |
| NEX1 classifier (Capability A) | `nex.concepts` semantic layer | `grep -r 'nex.concepts' src/lib/nex-agent/` → **NO MATCHES** |
| NCP envelope schema | anything | No `nex-coordination-protocol` module found |

### 4.4 Ambiguous / needs-follow-up

| From | To | Note |
|---|---|---|
| `src/lib/nex-agent/core/orchestrator.ts` | `nex_english_brain` (grep matched) | Sole match for `nex_english_brain` in nex-agent · needs targeted read to determine whether it consumes the semantic-layer DB or merely references the term |
| G17 workstation-scope adapters (git · npm · vendor CLIs for code authoring) | Any operational chain | Prior audit flagged this as **UNKNOWN** — product-side G17 is SYSTEM_CONNECTED but workstation-scope not verified |

---

## §5 · Map 2 · Intelligence-Flow Map

**Definition (per founder):** how reasoning · sensing · classification · challenge flow through the system.

### 5.1 Current intelligence flow (verified)

```
FOUNDER REQUEST
     │
     ▼
  Orchestrator UNDERSTANDING stage
     │
     ▼
  Orchestrator ARCHITECTURE stage
     │
     ▼
  Orchestrator DESIGN stage
     │
     ▼
  Orchestrator BUILD_PLAN stage
     │
     ▼
  Orchestrator FOUNDER_DECISION stage
     │
     ▼
  Orchestrator EXECUTION stage  ← MARKED NOT_IMPLEMENTED (verified §4.2)
     │
     ▼
  Orchestrator ORCHESTRATION_COMPLETED

  Reasoning about repository:
    programming-mission → Native Code Understanding S2 (dep-graph)
    → producer/consumer inference at mission-draft time
    (this branch DOES flow · but only for programming-mission code path)
```

### 5.2 Intelligence NOT flowing (verified gaps)

- **Sentry-style triage:** absent · raw signal enters NEX1 unfiltered
- **Archivist-style retrieval:** absent · NEX1 doesn't consult ADR corpus or prior failures at mission time
- **Critic-style pre-mortem:** absent · proposals go straight to authorization
- **Pre-action Dependency Analysis for authorization scope:** partial (Native Code S2 present, but not consumed by G15)
- **Truth Engine adjudication of claims:** absent from operational chain (Verifier is pure function · no orchestrator consumer)
- **Correction feedback → planning revision:** absent (J-family exists at code-engine layer, not wired to orchestrator VERIFICATION → BUILD_PLAN loop-back)

### 5.3 Intelligence flow that SHOULD exist (per founder architecture)

```
Human/Task
   ↓
SENTRY (context triage · signal → structured envelope)  ← ABSENT
   ↓
ARCHIVIST (retrieve hot context)                        ← ABSENT
   ↓
DEPENDENCY ANALYST (blast radius + scope recommendation) ← ABSENT (partial via Native Code S2 for mission-draft flow only)
   ↓
NEX1 PRIMARY ENGINEER (owns decision)                    ← PARTIAL (orchestrator halts before EXECUTION)
   ↓
CRITIC (pre-mortem)                                       ← ABSENT
   ↓
G15 AUTHORITY                                              ← COMPONENT_COMPLETE · trust set unset
   ↓
G8 BROKER                                                  ← SYSTEM_CONNECTED
   ↓
G17 · G13 · G11 (real execution + verification + observation) ← ALL COMPONENT_COMPLETE
   ↓
TRUTH ENGINE (Verifier + Guardian gate)                    ← COMPONENT_COMPLETE · DESIGN_ONLY
   ↓
G16 (persist evidence) or G12 (correction → back to NEX1) ← BOTH PARTIAL
```

Six of eleven arrows are **absent or unreachable**. Five are **substantially built** but not called by the orchestrator.

---

## §6 · Map 3 · Knowledge-Flow Map

**Definition:** how knowledge (concepts · senses · past decisions · hazards · prior failures) enters, is used, and is deposited.

### 6.1 Current knowledge state (verified)

**Knowledge that EXISTS but does NOT flow to NEX1 at mission time:**

| Knowledge substrate | Content | Consumer at mission time |
|---|---|---|
| `nex.concepts` (44 rows) | ADR-0308 semantic layer canonical concepts | **NONE** — grep verified no `nex.concepts` reference in `src/lib/nex-agent/` |
| `nex.concept_senses` (51 rows) | Sense variants | **NONE** |
| `nex.contexts` (224 rows) | Surface signals · context weights | **NONE** at NEX1 mission time (may be consumed by other pipelines) |
| `nex.questions` (60 rows) | Question patterns | **NONE** at NEX1 mission time |
| `nex.answers` (62 rows) | Answer bodies | **NONE** at NEX1 mission time |
| `nex.evidence` (173 rows) | Provenance chain | **NONE** at NEX1 mission time (no code inspects) |
| `nex-code-brain/knowledge-store.ts` | Code-brain lane entries | Consumed by `lesson-extractor.ts`, `wave1-real-work-e2e.test.ts` — but not by orchestrator planning stages |
| `docs/DECISIONS/*.md` (300+ ADRs) | Governance | Consulted by humans only · no automated NEX1 retrieval at mission time |
| `docs/doctrine/*.md` (30+ docs) | Founder-locked doctrines | Consulted by humans only |
| G16 JSONL trace store | Past mission traces | Referenced by `wo1-durable-store.ts` for durable persistence · not queried retrospectively by NEX1 for prior-failure lookup |
| G12 J-family receipts (past-fix registry) | Deterministic repair recipes | Written by J.3 · not queried by later missions |

### 6.2 Knowledge flow that DOES exist

| From | To | Mechanism |
|---|---|---|
| Repository AST | Programming-mission draft | Native Code Understanding S2 (dep-graph + style-inspector) |
| Vocabulary v5 (~2,200+ lexemes) | Capability A classifier | Direct import · deterministic classification |
| NEX1 vocab v5 tokens | Programming-mission classifier | Direct import |
| Founder-locked doctrines | Human reviewer | Manual reading |
| Git log | git tools (WO-05 executor allowlist) | Not queried by NEX1 for context |

### 6.3 Knowledge flow that SHOULD exist (per founder architecture)

```
Existing knowledge substrate (nex.concepts · ADRs · past traces · past fixes · hazards)
   ↓
KNOWLEDGE ROUTER (Archivist)                            ← ABSENT
   ↓
CLASSIFIED MISSION CONTEXT                               ← ABSENT
   ↓
NEX1 mission reasoning                                    ← consumes token-level classifier only
   ↓
EXECUTION + VERIFICATION                                  ← COMPONENT_COMPLETE ↑ unreachable
   ↓
VERIFIED KNOWLEDGE (result + hash chain)                  ← PARTIAL (G16 writes exist for transitions only)
   ↓
MEMORY UPDATE (concept/sense/rule/hazard delta)           ← ABSENT
   ↓
Loop back to existing knowledge substrate
```

Six of seven knowledge arrows are **absent**. The knowledge substrate exists but is not wired into the mission reasoning path. This is the largest untapped intelligence reserve in the codebase.

---

## §7 · Map 4 · Intelligence Amplification Map

**Definition:** where specialist processing would compress raw signal into structured envelopes, reducing NEX1's cognitive load.

### 7.1 Current amplification (verified)

| Compression opportunity | Currently done by | Compression ratio measured |
|---|---|---|
| Raw build output → structured findings | J.1 (`capability-j-runtime-diagnosis.ts`) parses vitest textual output into typed findings | Not measured |
| Raw fs walk → SHA-256 verdict | G11 Observer | Not measured (verdict is fixed-shape) |
| Raw specialist tool output → SpecialistResult | WO-07 adapters parse tsc/eslint/vitest into `SpecialistResult` | Not measured (findings array) |
| Raw import graph → producer/consumer inference | Native Code Understanding S2 style-inspector | Not measured |

### 7.2 Amplification gaps (per Cognitive-Layer Brief §§4–7)

| Amplifier | Purpose | Existence |
|---|---|---|
| Sentry / Context Triager | 5,000-line dump → 50-line structured envelope | **ABSENT** |
| Archivist / Memory Router | 300+ ADRs → top-N relevant records | **ABSENT** |
| Dependency / Impact Analyst | Change scope → blast-radius envelope | Partial substrate (Native Code S2 exists) |
| Critic / Adversary | Proposal → deterministic failure-mode critique | **ABSENT** |

**Aggregate:** NEX1 currently reads raw signal, raw repo state, raw ADR corpus with no cognitive-layer amplification. Each new mission repeats the full search.

---

## §8 · Map 5 · Intelligence ↔ Knowledge Feedback Map

**Definition:** how each mission's outcome updates the knowledge substrate, and how the updated substrate improves the next mission.

### 8.1 Feedback loops that EXIST

| Loop | Trigger | Verified? |
|---|---|---|
| Orchestrator state transition → G16 audit event write | Every stage change | YES (wo1-audit-log.ts:appendAuditEvent) |
| Draft record persisted → later retrievable | Draft creation | YES (types.ts:ProgrammingMissionDraftRecord) |
| J.3 apply-verify-rollback → J-family receipt | Correction cycle | YES (wo12-real-correction-cycle.test proves it) |
| Guardian rejection → rejection code | Truth Engine call | YES (Guardian test suite exercises 19 codes) |

### 8.2 Feedback loops that DO NOT close

| Broken loop | Where it breaks | Effect |
|---|---|---|
| Mission outcome → Knowledge substrate update | G16 trace exists · no consumer inserts into `nex.concepts` / `nex.evidence` | Future missions have zero access to past mission-outcome intelligence |
| J.3 fix recipe → later mission's mission-draft consultation | Fix recipes exist as JSONL · no retrieval interface | Same failure fixed re-diagnosed from scratch |
| Guardian rejection → rule catalog update | Rejections are recorded but no meta-audit consumes | Rule catalog does not learn |
| Truth Engine verdict → doctrine amendment | Verdicts are fixture-only | No live doctrine feedback |
| G12 correction → new architectural principle | Correction receipts exist · no ADR generation | Repeated failure patterns don't upgrade to ADR-worthy principles |
| Founder decision → knowledge substrate | Decisions in memory + ADRs · not queryable via retrieval interface | No automated recall by NEX1 |
| Adversarial-test discovery → Critic rule catalog | Critic doesn't exist · no place to deposit | Discovery lost |

### 8.3 The unclosed feedback loop

```
Mission N executes
   ↓
Result observed
   ↓
Verified/failed
   ↓
G16 trace written                       ← EXISTS
   ↓
[MISSING: knowledge delta computation]  ← ABSENT
   ↓
[MISSING: substrate update]              ← ABSENT
   ↓
Mission N+1 begins
   ↓
Zero benefit from Mission N intelligence ← this is the truth today
```

---

## §9 · Map 6 · Multi-Dimensional Dependency Graph

Per founder directive, each dependency is classified across five axes: **TECHNICAL · INTELLIGENCE · KNOWLEDGE · AUTHORITY · RUNTIME**.

### 9.1 Dependency classification legend

| Label | Meaning |
|---|---|
| DIRECT | Actual code import / function call |
| INDIRECT | Dependency through another component |
| RUNTIME | Only exists at execution time |
| DATA | Requires a particular schema / contract |
| AUTHORITY | Requires signed authorization |
| KNOWLEDGE | Requires knowledge / context |
| VERIFICATION | Requires evidence before progression |
| OPTIONAL | Useful but not blocking |
| PROPOSED | Architecture recommendation only |
| UNKNOWN | Insufficient evidence |

### 9.2 Dependency matrix

| Capability | Depends on | Dependency type | Current state | Evidence | Blocking? |
|---|---|---|---|---|---|
| G7 Code Generation reaches disk | G8 Broker (write path) | RUNTIME · DIRECT | Available in tests · unreachable via orchestrator | wo4-executor.ts imports broker | YES for orchestrator path |
| G7 reaches disk in production | G15 Authorization | AUTHORITY · DIRECT | G15 trust set unset | grep of `NEX_TRUSTED_FOUNDER_KEYS_HEX` | YES |
| G13 Verification of change | G7 fs write | RUNTIME · DIRECT | G7 unreachable via orchestrator | §4.2 | YES |
| G13 Verification of change | G8 spawn | RUNTIME · DIRECT | Available (WO-05 spawn works) | wo5-executor.ts | NO (works standalone) |
| G12 Correction Loop trigger | G13 verdict FAIL | VERIFICATION · DIRECT | G13 unreachable in orchestrator | §4.2 | YES |
| G12 Correction Loop trigger | Orchestrator VERIFICATION→FAILED transition | DIRECT | Orchestrator doesn't invoke J-family | grep in §4.2 | YES |
| G11 Observer runs | G7 fs write | RUNTIME · DIRECT | G7 unreachable via orchestrator | wo4-executor imports observer | YES |
| G16 Downstream reports | G7/G8/G11 executions | DATA · DIRECT | Only orchestrator transitions currently write | wo1-audit-log active | PARTIAL |
| G17 workstation-scope | G15 authorization | AUTHORITY · DIRECT | Unknown whether workstation adapters exist | prior audit note | UNKNOWN |
| Truth Engine adjudication | Orchestrator import | DIRECT | Not imported | grep in §4.2 | YES |
| Truth Engine adjudication | Gate 3 OPEN | AUTHORITY · PROPOSED | Gate 3 CLOSED (ADR-0314e §1) | ADR text | YES |
| NEX1 mission context | `nex.concepts` retrieval | KNOWLEDGE · PROPOSED | No consumer wired | grep in §4.2 | For quality (not for run) |
| Archivist / Sentry / Critic / Dependency Analyst | Any consumer | PROPOSED | Not built | glob in §4.3 | For cognitive-layer WOs |
| G15 real /execute | Founder key + trust set | AUTHORITY · DATA | Trust set unset | §4.2 | YES |
| Future missions learn from prior | G16 → knowledge substrate update | KNOWLEDGE · PROPOSED | Loop not closed | §8.2 | For learning |

### 9.3 Critical dependency chain (evidence-verified)

```
Any real founder mission
     ↓
   requires
     ↓
G15 trust set + founder key         ← env var not set
     ↓
   requires
     ↓
signed delegation via offline signer ← script exists
     ↓
   flows to
     ↓
G15 verifier at /execute route      ← wired
     ↓
   flows to
     ↓
Orchestrator EXECUTION stage        ← MARKED NOT_IMPLEMENTED
     ↓
   requires
     ↓
Orchestrator → WO-04 import         ← MISSING
     ↓
   flows to
     ↓
WO-04 executor                       ← BUILT (328 lines)
     ↓
   invokes
     ↓
G8 Broker session                    ← BUILT · SYSTEM_CONNECTED
     ↓
   writes to
     ↓
Real filesystem                       ← reachable via broker
     ↓
   observed by
     ↓
G11 Independent Observer              ← BUILT · reachable IF G7 writes
     ↓
   verified by
     ↓
G13 WO-05/06/07                       ← BUILT · reachable IF G7 writes
     ↓
   ├── PASS → G16 trace                ← writes work
   └── FAIL → G12 J-family              ← BUILT · not wired to orchestrator VERIFICATION path
                 ↓
              re-verify → PASS/FAIL
```

**Structural finding:** the chain is technically capable of end-to-end operation. Two wiring changes (`F` trust-set + `A` orchestrator→WO-04 import) + one existing test workflow (WO-11 first-app) would exercise it end-to-end.

### 9.4 Dependency cycles searched for (founder directive)

| Cycle risk | Search performed | Finding |
|---|---|---|
| Circular imports | Prior audit dep-graph output | None reported |
| Circular service dependencies | Orchestrator + broker + G13 topology | Orchestrator is currently forward-only (§5.1) — no loop-back risk today |
| Recursive orchestration | Programming-mission subprocess spawn | Prior audit note: `wo5-build-execution`/`wo6-runtime` orchestrator subprocess races under parallel workers — pre-existing test flake |
| Memory → reasoning → memory loops | Knowledge substrate write path | Not wired at all (§8.2) — cannot currently loop |
| Agent → agent → agent loops | Specialist call graph | Specialists don't exist (§4.3) — cannot currently loop |
| Authorization bypasses | Any execution not through G15 | G8 Broker requires token per broker.ts:122-139 · no bypass path observed |
| Verification bypasses | Any acceptance path skipping G13 | Programming-mission bypasses WO-07 today (§4.2) — VERIFICATION BYPASS EXISTS, must be closed |
| Execution paths avoiding G8 | Direct child_process outside broker | Legacy `nex-agent/tools/verification.ts` spawns tsc/eslint/vitest without broker | Requires audit + policy decision |
| Knowledge paths bypassing governance | Any writer to knowledge substrate | No live writer today (§8.2) |
| Correction paths without limits | J-family iteration cap | J.2.3 has hop-cap · J.4.2 has bounded queue · J.4.1 has hard-stop |
| Self-modification paths | Any change to authority/security module | REQUIRED_FORBIDDEN_PATH_PREFIXES in delegation.ts includes founder-authority itself · protected |
| Trace paths that can be lost | JSONL persistence | Append-only · no TTL yet (prior audit gap #5) |

**Verification bypass identified in §9.4** (Programming-mission → real verification skipped · legacy verification.ts spawns tools outside broker). Both are recorded as gaps for founder disposition.

---

## §10 · Map 7 · Ranked Intelligence-Leverage Connections

Per founder directive: rank by evidence + dimensions, not by architectural elegance. Dimensions kept visible (no opaque score).

### 10.1 Dimensional scoring legend

- **RL** = Reasoning leverage
- **CL** = Context leverage
- **KL** = Knowledge leverage
- **PL** = Planning leverage
- **EL** = Execution leverage
- **VL** = Verification leverage
- **CoL** = Correction leverage
- **LL** = Learning leverage
- **RUM** = Reuse across missions
- **CU** = Components unlocked (count)
- **ES** = Evidence strength
- **RB** = Risk / blast radius
- **DB** = Dependency burden (blockers remaining)
- **CX** = Implementation complexity
- **FA** = Founder authorisation required

Bands: MAXIMUM · HIGH · MEDIUM · LOW · N/A

### 10.2 Candidate connection table (evidence-cited)

| # | Connection | Source module | Destination module | Current state | Evidence for build | Missing artefact | Data contract required |
|---|---|---|---|---|---|---|---|
| **C1** | Orchestrator → WO-04 executor | `src/lib/nex1-orchestrator/orchestrator.ts` | `src/lib/nex1-orchestrator/wo4-executor.ts` `executeAuthorisedDiffBundle` | IMPLEMENTED BUT UNREACHABLE | wo4-executor.ts (328 lines) fully built · test wo4-controlled-execution.test.ts proves function | orchestrator must import and call after FOUNDER_DECISION stage | AuthorisedDiffBundle · already defined |
| **C2** | Orchestrator VERIFICATION-FAIL → J-family | orchestrator VERIFICATION stage | `capability-j-runtime-diagnosis.ts` J.1 + `capability-j2-cause-analysis.ts` + `capability-j3-verify-repair.ts` | IMPLEMENTED BUT UNREACHABLE | J-family 2,343 lines · wo12-real-correction-cycle test proves cycle | orchestrator failed-branch import of J-family + hop-cap wiring | Failure findings envelope (J.1 output) |
| **C3** | Programming-mission → G13 WO-07 real verification | `programming-mission/mission.ts` | `wo7-run-specialist.ts` (4 adapters) | IMPLEMENTED BUT UNREACHABLE | 471 lines WO-07 + 120+ tests | Mission execution route must invoke WO-07 for authored code | SpecialistInvocation → SpecialistResult |
| **C4** | NEX1 classifier / mission-context → `nex.concepts` retrieval | Capability A classifier + programming-mission draft | `nex.concepts` table (44 rows live) | ARCHITECTURALLY POSSIBLE · substrate ready | Live DB probe confirms 44 concepts + 51 senses seeded 2026-09-10 | Retrieval interface + query API | Concept ID + sense ID + evidence chain |
| **C5** | Truth Engine Verifier → Orchestrator gate | Verifier + Guardian | `orchestrator/gate-verification.ts` | IMPLEMENTED BUT UNREACHABLE (Gate 3 CLOSED) | 26 files 2,873 lines Verifier + Guardian + 15+ test modules | Gate 3 OPEN authorisation + orchestrator import + rule-catalog integration | VerdictEnvelope + GuardianDecision |
| **C6** | G15 trust set activation + first real /execute | `.env.local` + founder workstation | `trusted-anchors.ts` | ARCHITECTURALLY POSSIBLE · zero code change | 15 D-tests proving flow · offline signer script functional | Founder key generation + env var set + one signed delegation | none (env var + delegation bundle) |
| **C7** | G16 outcome → knowledge substrate update | G16 audit log | `nex.concepts` / `nex.evidence` (write path) | ARCHITECTURALLY POSSIBLE · no writer yet | G16 traces exist · substrate exists | Writer with Guardian gate · idempotency · conflict resolution | KnowledgeDelta envelope (proposed) |
| **C8** | G17 workstation-scope adapters → G8 → G15 authorization chain | UNKNOWN (workstation adapters not confirmed) | G8 + G15 | UNKNOWN | Prior audit flagged as UNKNOWN | Verification whether git/npm workstation adapters exist | AuthorityScope + tool-invocation envelope |
| **C9** | Native Code Understanding S2 → G15 authorization scope | `programming-mission/dependency-graph.ts` | `founder-authority/authorization.ts` | ARCHITECTURALLY POSSIBLE · substrate active | Dep-graph runs in every mission draft | G15 must accept scope-recommendation input · pre-authorization filter | ImpactEnvelope → AuthorityScope |
| **C10** | J-family fix registry → future mission retrieval | J.3 receipts JSONL | Programming-mission draft classifier | ARCHITECTURALLY POSSIBLE · not built | J.3 receipts exist as append-only | Retrieval interface · fingerprint index | FixRecipe envelope |
| **C11** | ADR corpus → mission-time retrieval | `docs/DECISIONS/*.md` | Any mission planner | PROPOSED · Archivist not built | Prior Archivist design (Cognitive-Layer Brief §5) | Archivist NEX-14 module | ArchivistQuery → HotContextRecord[] |
| **C12** | Sentry Context Triager → NEX1 orchestrator | PROPOSED | Orchestrator input | PROPOSED · not built | Prior Sentry design (Cognitive-Layer Brief §4) | Sentry NEX-13 module | FailureEnvelope |
| **C13** | Critic → NEX1 revise loop | PROPOSED | Orchestrator proposal stage | PROPOSED · not built | Prior Critic design (Cognitive-Layer Brief §7) | Critic NEX-16 module + rule catalog | CritiqueEnvelope |

### 10.3 Ranked list (multi-dimensional · no opaque score)

Rank based on: EL/VL/CoL leverage · CU count · ES strong · RB manageable · DB minimal · CX low.

| Rank | Connection | RL | CL | KL | PL | EL | VL | CoL | LL | RUM | CU | ES | RB | DB | CX | FA | Classification |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **1** | **C6** trust set + first signed /execute | LOW | LOW | LOW | LOW | **MAX** (prerequisite) | HIGH | LOW | LOW | HIGH | 1 (unblocks C1..C3 downstream) | **MAX** | HIGH (real auth) | LOW | **LOW** (env var + delegation) | YES | ARCHITECTURALLY POSSIBLE |
| **2** | **C1** Orchestrator → WO-04 | HIGH | MED | LOW | HIGH | **MAX** | **MAX** | HIGH | HIGH | **MAX** | **5** (G7·G11·G13·G16·G12) | HIGH | HIGH (real writes) | 1 (C6) | LOW-MED | YES | IMPLEMENTED BUT UNREACHABLE |
| **3** | **C3** Programming-mission → WO-07 | MED | LOW | LOW | LOW | LOW | **MAX** | MED | MED | HIGH | 1 (real verification of mission code) | HIGH | LOW-MED | 0 | LOW | YES | IMPLEMENTED BUT UNREACHABLE |
| **4** | **C2** Orchestrator VERIF→J-family | HIGH | MED | LOW | HIGH | LOW | LOW | **MAX** | HIGH | HIGH | 2 (G12 · G16 correction records) | HIGH | MED (bounded) | 2 (C1 · C3) | MED | YES | IMPLEMENTED BUT UNREACHABLE |
| **5** | **C4** Classifier → nex.concepts | HIGH | **MAX** | **MAX** | HIGH | LOW | LOW | LOW | HIGH | **MAX** | 3 (Capability A · programming-mission · future Archivist) | HIGH | **LOW** (read-only) | 0 | LOW-MED | YES | ARCHITECTURALLY POSSIBLE |
| **6** | **C9** Native Code S2 → G15 scope recommendation | MED | HIGH | LOW | MED | HIGH | HIGH | LOW | LOW | HIGH | 2 (G15 minimum-scope · Dep Analyst pre-existence) | HIGH | MED | 1 (C6) | MED | YES | ARCHITECTURALLY POSSIBLE |
| **7** | **C5** Truth Engine → Orchestrator | HIGH | MED | HIGH | HIGH | LOW | **MAX** | MED | HIGH | HIGH | 2 (Truth Engine · every downstream verdict) | HIGH | HIGH (could halt ops) | 1 (Gate 3 OPEN founder decision) | MED | YES · GATE 3 | IMPLEMENTED BUT UNREACHABLE |
| **8** | **C10** J-family recipes → future mission | MED | MED | HIGH | LOW | LOW | LOW | MED | **MAX** | HIGH | 1 (learning loop closure) | MED (receipts exist) | LOW | 2 (C1 · C2) | LOW-MED | YES | ARCHITECTURALLY POSSIBLE |
| **9** | **C7** G16 outcome → substrate update | MED | HIGH | **MAX** | MED | LOW | LOW | LOW | **MAX** | **MAX** | 1 (feedback loop closure) | MED (needs writer) | MED-HIGH (contamination risk) | 3 (C1 · C4 · Guardian) | MED-HIGH | YES | ARCHITECTURALLY POSSIBLE |
| **10** | **C11** ADR corpus → mission retrieval (Archivist) | HIGH | **MAX** | **MAX** | HIGH | LOW | LOW | LOW | HIGH | **MAX** | ~3-5 (planning · critic feed · dep analyst context) | LOW (module absent) | LOW (read-only) | 1 (Archivist WO) | HIGH | YES | PROPOSED |
| **11** | **C13** Critic → revise loop | HIGH | HIGH | MED | HIGH | LOW | HIGH | LOW | HIGH | HIGH | 1 (Critic) · secondarily reduces post-verify failures | LOW (module absent) | MED | 2 (Archivist · Critic WO) | HIGH | YES | PROPOSED |
| **12** | **C12** Sentry → NEX1 | MED | **MAX** | MED | MED | LOW | MED | MED | MED | HIGH | 1 (Sentry) · reduces cognitive load per mission | LOW (module absent) | LOW-MED | 1 (Sentry WO) | HIGH | YES | PROPOSED |
| **13** | **C8** G17 workstation-scope | MED | LOW | LOW | LOW | HIGH | HIGH | LOW | LOW | HIGH | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | YES | UNKNOWN |

### 10.4 Ranking commentary

**C6 first because:** zero code change · maximum execution-leverage prerequisite (nothing runs without it) · well-tested primitive already component-complete · founder key is a single artefact to produce.

**C1 second because:** one wiring change unlocks FIVE downstream capabilities that are already component-complete. This is the largest evidence-backed capability multiplier in the codebase.

**C3 above C2 because:** C3 has zero dependency burden (both sides built and reachable) while C2 depends on C1 to have real failures to correct.

**C4 above C5 because:** C4 is low-risk (read-only) and unlocks the 44-concept knowledge substrate that is otherwise wasted. C5 (Truth Engine) requires founder Gate 3 decision — high value but higher governance burden.

**C9 mid-tier because:** it turns the dep-graph substrate into an authority-scoping input — high safety impact but not on the critical path to first real execution.

**C7 and C10 gated by C1:** learning loops can't close until real missions execute.

**C11–C13 lowest tier NOT because they lack value** — they are highest-quality *when built*, but they don't exist yet. Cognitive-Layer WOs remain valuable but come AFTER the C1-C6 activation cycle.

---

## §11 · What should NOT be connected (founder-mandated section)

### 11.1 Dangerous couplings identified

| Do NOT connect | Why | Existing safeguard |
|---|---|---|
| Any specialist → G8 broker directly | Would bypass G15 authorization | REQUIRED_FORBIDDEN_PATH_PREFIXES includes broker · fail-closed policy |
| Any execution → child_process outside broker | Violates Controlled Hands doctrine | Legacy `nex-agent/tools/verification.ts` is a known offender — flag for founder disposition |
| Correction loop → new correction without hop-cap | Runaway repair · unbounded compute | J.2.3 · J.4.2 already have caps · new correction paths must inherit |
| Truth Engine verdict → any override | Guardian must be terminal | Currently Verifier is pure function · no override path · preserve this |
| Trust set → auto-population | Would defeat fail-closed doctrine | `trusted-anchors.ts` reads env only · never mutates |
| Any specialist → founder-authority module | Would allow self-modification of authority | `src/lib/nex-agent-runtime/founder-authority/` in REQUIRED_FORBIDDEN_PATH_PREFIXES |
| Orchestrator → self-editing capability | Would bypass ADR governance | Orchestrator path also in forbidden list |
| Knowledge substrate → write without Guardian gate | Would poison future missions | Guardian must intercept every write (C7 requirement) |
| Sentry / Critic → confidence-band spoofing | Would inject FLAG_FOR_REVIEW as accepted | NCP spec §3 mandates band + Guardian rejection |
| G16 trace → mutation | Trace loses tamper-evidence | Append-only enforced by wo1-audit-log design |
| Programming-mission → G13 bypass | Silent verification failure | C3 must be closed with `NEVER PASS UNAVAILABLE` discipline preserved |
| G17 workstation adapters → without G15 | Real vendor calls without authority | UNKNOWN today · must be verified before wiring |
| Circular loops without observability | Memory→reason→memory · agent→agent → agent | Every loop must emit trace to G16 · no silent recursion |
| Truth Engine → operational writes | Verifier is pure function by design | Preserve · never wire a write path from Verifier |
| Critic → final verdict | Only G13 decides operational reality | NCP §7.6 enforced by Guardian |

### 11.2 Legacy verification bypass (§9.4 flag)

`src/lib/nex-agent/tools/verification.ts` (80+ lines) spawns tsc/eslint/vitest **without going through G8 broker**. This is a pre-existing verification bypass that should be either (a) migrated to WO-05/WO-07 or (b) retired. Recorded as gap · not remediated in this audit.

### 11.3 Verification bypass at programming-mission

Programming-mission does **NOT** call WO-07 (§4.2 · C3 candidate). This means any mission's authored code is not verified by the real specialist adapters. Closing C3 removes this bypass.

---

## §12 · Critical Path with proven/partial/designed/missing/unknown labels

Per founder directive: mark every arrow.

```
MISSION                                                  ← FOUNDER REQUEST · PROVEN entry point
  │  [PROVEN — orchestrator receives requests]
  ▼
UNDERSTAND                                                ← Native Code S2 wired to mission-draft
  │  [PROVEN for programming-mission · MISSING for other task kinds]
  ▼
PLAN                                                       ← Orchestrator planning stages exist
  │  [PROVEN — architecture · design · build_plan stages exist]
  ▼
CRITIQUE                                                   ← Critic
  │  [MISSING — no specialist exists · Cognitive-Layer Brief only]
  ▼
AUTHORIZE                                                  ← G15
  │  [DESIGNED — module component-complete · trust set unset · MISSING activation]
  ▼
BUILD                                                       ← G7 code generation
  │  [PARTIAL — WO-03 pipeline built · orchestrator disconnected]
  ▼
EXECUTE                                                    ← G8 broker + G7 WO-04
  │  [MISSING wire from orchestrator to WO-04 · PROVEN in tests]
  ▼
OBSERVE                                                    ← G11 observer
  │  [DESIGNED — observer built · UNREACHABLE via orchestrator]
  ▼
VERIFY                                                     ← G13 WO-05/06/07 + Truth Engine
  │  [PARTIAL — G13 built + reachable in tests · programming-mission bypasses · Truth Engine disconnected]
  ▼
CORRECT                                                    ← G12 J-family
  │  [PARTIAL — J-family built · orchestrator VERIFICATION-FAIL → J-family MISSING]
  ▼
RE-VERIFY                                                  ← J.3 rerun
  │  [PROVEN at code-engine layer · not composed at orchestrator layer]
  ▼
TRACE                                                       ← G16
  │  [PARTIAL — orchestrator transitions written · downstream reports MISSING]
  ▼
LEARN                                                       ← knowledge update
  │  [MISSING — G16 → substrate writer does not exist]
  ▼
KNOWLEDGE                                                   ← nex.concepts · nex.evidence
  │  [PROVEN existence (44 concepts · 173 evidence rows) · UNREACHED by NEX1 at mission time]
  ▼
NEXT MISSION                                                ← Loop-back
  [MISSING — knowledge → mission-context retrieval interface does not exist]
```

**Label distribution:**
- PROVEN: 4 arrows (mission entry · understand · plan · re-verify-at-code-engine)
- PARTIAL: 4 arrows (build · verify · correct · trace)
- DESIGNED: 2 arrows (authorize · observe)
- MISSING: 4 arrows (critique · execute · learn · next-mission)
- UNREACHED: 1 (knowledge)

**11 of 15 arrows are less than PROVEN.** The critical path is intact in design but incompletely wired in operation.

---

## §13 · NEX1 Intelligence Leverage Path (loop)

```
                 KNOWLEDGE                             ← 44 concepts live · UNCONSUMED at mission time
                     │
                     ▼
              UNDERSTANDING                            ← Native Code S2 (programming-mission only)
                     │
                     ▼
                  PLANNING                             ← orchestrator stages
                     │
                     ▼
                   CRITIC                              ← ABSENT
                     │
                     ▼
                 AUTHORITY                             ← G15 COMPONENT_COMPLETE · trust set unset
                     │
                     ▼
                    BUILD                              ← WO-03 built · orchestrator disconnected
                     │
                     ▼
                  EXECUTE                              ← G8 SYSTEM_CONNECTED · unreachable via orchestrator
                     │
                     ▼
                  OBSERVE                              ← G11 built · unreachable
                     │
                     ▼
                  VERIFY                                ← G13 COMPONENT_COMPLETE · Truth Engine disconnected
                     │
                     ▼
                 CORRECT                                ← J-family PARTIAL wire
                     │
                     ▼
                RE-VERIFY                                ← works at code-engine layer
                     │
                     ▼
                   TRACE                                 ← G16 PARTIAL
                     │
                     ▼
                EXPERIENCE                              ← G16 records exist
                     │
                     ▼
                 LEARNING                                ← MISSING writer
                     │
                     ▼
              BETTER CONTEXT                             ← MISSING retrieval interface
                     │
                     ▼
              BETTER PLANNING                            ← unmeasured today
                     ↺
```

**The loop is currently broken in FIVE places:** CRITIC · EXECUTE (via orchestrator) · LEARNING · BETTER_CONTEXT · knowledge-consultation input side. Each break is verified above.

---

## §14 · Answers to founder's two critical questions

### Q1 · "If NEX1 already contains many of the required organs, which missing connections prevent those organs from behaving like one coherent intelligence system?"

**Answer (evidence-cited):**

Six connections are missing. In priority order per §10.3:

1. **G15 trust-set activation** (C6) — nothing runs without founder key
2. **Orchestrator → WO-04 Executor** (C1) — unlocks G7 → G11 → G13 → G16 → G12 in one wiring
3. **Programming-mission → WO-07 real verification** (C3) — closes the verification bypass
4. **Orchestrator VERIFICATION-FAIL → J-family** (C2) — closes correction loop
5. **NEX1 classifier / mission-context → `nex.concepts`** (C4) — makes 44 seeded concepts operationally useful
6. **Truth Engine → Orchestrator** (C5) — governs every operational claim (gated on Gate 3 OPEN founder decision)

Plus the four cognitive-layer specialist modules (Sentry · Archivist · Critic · Dependency Analyst) — designed but not built.

### Q2 · "Which single connection, or smallest safe group of connections, would expose the largest amount of already-existing capability?"

**Answer (evidence-cited):**

**Smallest safe group: C6 + C1.**

- **C6 alone** — zero code change · unlocks G15 SYSTEM_ACTIVATED · proves the authority chain end-to-end · zero risk to existing code
- **C6 + C1** — one env var + one wiring change · unlocks G7 · G11 · G13 · G16 · G12 (five downstream capabilities) · exercisable via existing WO-11 first-app test workflow

**Optionally add C3 (programming-mission → WO-07)** — closes the verification bypass · low complexity · high verification-leverage · no dependency on C6/C1

**Total minimum safe group producing the largest capability exposure: C6 + C1 + C3 (three changes).**

Every subsequent connection (C2 · C4 · C5 · etc.) depends on C6+C1 having proven end-to-end operation OR requires additional founder governance (C5 Gate 3).

**This is the evidence-backed answer to the founder's question.** No implementation authorised by this document.

---

## §15 · NEX1 engineering doctrine principle (proposed for founder ratification)

Per founder statement in the directive:

> *"The next intelligence gain comes from connecting capabilities that already exist — not from building more capabilities."*

Proposed for durable adoption:

> **CONNECT-BEFORE-BUILD PRINCIPLE**
>
> Before any new NEX1 capability is authorised, the audit must demonstrate that all existing implementations of that capability are wired to their required consumers. If a capability exists in the repository at `COMPONENT_COMPLETE` or better and can be reached via a wiring change, that wiring change is the correct WO — not a new build.
>
> Applies to: G7 · G8 · G11 · G12 · G13 · G15 · G16 · G17 · Truth Engine · Native Code Understanding · all future capability discoveries.
>
> Complements the Undercount Protection Rule (2026-09-16) by insisting that discovery of existing implementation prompts wiring — not duplication.

---

## §16 · Founder decisions required

To convert this audit into implementation, the founder must decide:

| Decision | Options |
|---|---|
| **D-1 · Accept the seven maps + evidence-cited findings** | YES · YES-WITH-CHANGES · NO |
| **D-2 · Adopt Connect-Before-Build Principle as durable doctrine** | YES · REVISE · NO |
| **D-3 · Authorise C6 (G15 trust-set activation) as the first WO** — no code change · one env var + one signed delegation | YES · YES-WITH-CHANGES · NO · DEFER |
| **D-4 · Authorise C1 (Orchestrator → WO-04 wiring) as the second WO** — after C6 proven | YES · NO · DEFER |
| **D-5 · Authorise C3 (programming-mission → WO-07) — closes verification bypass** | YES · NO · DEFER |
| **D-6 · Authorise C2 (Orchestrator VERIF-FAIL → J-family)** — depends on C1 | YES · NO · DEFER |
| **D-7 · Authorise C4 (classifier → `nex.concepts`) — low-risk knowledge activation** | YES · NO · DEFER |
| **D-8 · Open Gate 3 for Truth Engine C5 wiring** | YES · NO · DEFER |
| **D-9 · Disposition legacy verification bypass `src/lib/nex-agent/tools/verification.ts`** | Migrate to WO-05/07 · Retire · Keep as-is |
| **D-10 · Disposition programming-mission verification bypass (§11.3)** | Close via C3 · Keep as-is |
| **D-11 · Verify G17 workstation-scope adapters** (UNKNOWN today) | Authorise follow-up audit · Proceed without |
| **D-12 · Priority ordering across C6..C13** | Adopt §10.3 ranking · Reorder |
| **D-13 · DB Remediation Planning audit still queued** | Open now · After C6/C1 · Defer indefinitely |
| **D-14 · Cognitive-Layer Specialists WOs (WO-COGNITIVE-01..06)** | Priority relative to C1-C6 |

No decision is pre-made. **No implementation begins until founder authorises a specific WO.**

---

## §17 · What this audit does NOT do

- Does NOT authorise any implementation
- Does NOT change any file in src/
- Does NOT change any ADR
- Does NOT alter any environment variable
- Does NOT propose a designation move (specialist NEX-13..NEX-16 remain PROPOSED per Cognitive-Layer Brief)
- Does NOT commit or push
- Does NOT run migrations
- Does NOT rank connections by architectural elegance
- Does NOT claim any connection will "increase intelligence" until implemented and evidenced
- Does NOT verify runtime state beyond prior audits + targeted grep confirmation

---

## §18 · Final truth statement

**What NEX1 has today:**

Substantial islands of engineering intelligence — G7 · G8 · G11 · G12 · G13 · G15 · G16 · G17 · Truth Engine · Native Code Understanding Stage 2 — each `COMPONENT_COMPLETE` or better, most tested with real execution evidence, several already `SYSTEM_CONNECTED` in specific paths.

**What NEX1 lacks today:**

Six missing bridges between those islands (§§4.2 · 4.3). Four of the six require **zero new capability** — only a wiring change of already-built code. Two of the six require founder governance decisions (Gate 3 OPEN · trust-set activation) but no new build.

**The largest verified capability increase possible today:**

Two wiring changes + one env var (C6 + C1 + optionally C3). This exposes five downstream capabilities that already exist but are unreachable in production. Every gain here is a **capability-connection**, not a capability-build.

**Founder doctrine principle demonstrated at scale:**

*Architecture does not equal capability. But absence of a connection map does not prove absence of connectivity.*

The Undercount Protection Rule (2026-09-16) applied to capability building. The Connect-Before-Build Principle (proposed §15) applies to capability composition. Both rules combined form the durable engineering discipline needed for NEX1's next phase.

**Freeze status: INTACT.** Zero writes. Zero commits. Zero implementations. No claim on any arrow is upgraded to PROVEN without runtime evidence gathered by a subsequent authorised WO.

---

**End of audit · founder authorisation required before any WO begins · every arrow's next state must be earned by runtime evidence, not by design intention.**

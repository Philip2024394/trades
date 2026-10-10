# NEX1 · Operational Spine · Phase 0 Read-Only Audit + Evidence-Backed Build Order

**Founder-directed 2026-09-16 · READ-ONLY audit · FREEZE remains in force**

**No code changes. No commits. No pushes. No implementation. No `APPLY MIGRATION`. No wiring. No consolidation. No deletion. No new NEX designations.**

Founder critical rule (Section 32 of master prompt): *"NEX1 must never claim an operational capability that it cannot demonstrate with evidence."*

This audit executes Phases 0-6 of the founder's master engineering prompt. It does NOT execute Phase 7+ (implementation). It does NOT assume the founder's suggested build order is correct — it derives an evidence-backed order from ADR text + code inspection.

---

## §0 · Preamble · why this audit exists before any building

**FACT** — The founder's master prompt (Section 2, Section 6, Section 24) explicitly prohibits jumping into implementation. Section 24: *"Do not assume this order is correct. Validate it against ADR-0318 · G7 · G8 · G11 · G12 · G13 · G15 · G16 · G17 · existing architecture · existing tests · existing implementation. If evidence produces a different dependency order, use the evidence-backed order."*

**FACT** — ADR-0318 (line 154) declares the governance rule for every gap closure: *"GAP → FOUNDER AUTHORISATION → WORK ORDER → NEX1 → CONTROLLED HANDS → TEST → OBSERVE → VERIFY. No compound 'close all gaps' authorisations. Founder reviews this register and separately authorises Work Orders for individual gaps."*

This audit produces the evidence-backed build order + agent-team proposal. Implementation of any capability requires a separate founder-approved Work Order per gap.

---

## §1 · Phase 0 · Read-only baseline · verified facts

**FACT · Where NEX1 terminates today** (per ADR-0318 line 13-40):

The founder-authorised capability chain has 14 stages. **NEX1 currently terminates at Stage 11 (NEX3_ARBITRATION)**. Stages 8, 9, 10, 11-visual-inspection, 12, 13, 14 are architecturally `NOT_IMPLEMENTED`.

The 14-stage chain:
```
 1  Founder prompt input surface   ✅ RUNTIME VERIFIED
 2  Requirements extraction        ✅ RUNTIME VERIFIED (fixture-level)
 3  Project model / Work Order     ✅ RUNTIME VERIFIED (in-memory only)
 4  Page specifications            ⚠️ UNVERIFIED
 5  Design/layout representation   ⚠️ UNVERIFIED
 6  Implementation plan            ✅ RUNTIME VERIFIED (plan-and-propose only)
 7  Code generation                ❌ MISSING (G7)
 8  Real filesystem changes        ❌ MISSING (G8 · EXECUTION = NOT_IMPLEMENTED)
 9  Build                          ❌ MISSING (G9 · RELEASE = NOT_IMPLEMENTED)
10  Runtime                        ❌ MISSING (G10)
11  Visual inspection              ❌ ORPHANED (G11 · Phase 9 not built)
12  Correction loop                ❌ MISSING (G12 · state machine forward-only)
13  Verification                   ❌ MISSING (G13 · NOT_IMPLEMENTED)
14  Completed application state    ❌ DISCONNECTED (G14 · depends on 8-13)
```

**FACT** — NEX1 today: *"The system is currently a planning and advisory system, not a code-generation or execution system, at v0.1.0"* (ADR-0318 line 15).

---

## §2 · Phase 1 · G7-G17 detailed capability audit

Per-gap decomposition with code evidence, hard prerequisites, soft dependencies, and authorization/verification status.

### G7 · Native Code Generation Engine

- **Current state**: MISSING
- **Evidence**: `src/lib/nex1-orchestrator/orchestrator.ts:150-200` · `src/lib/nex1-builder/engine.ts:92` explicitly declares "plan-and-propose only · candidate diffs are NOT applied"
- **What exists today**: Plan skeletons + `candidate_diff_ref` advisory link
- **What is missing**: AST construction · template evaluation · file writes · framework-agnostic authoring engine
- **Hard prerequisite for**: G8 (nothing to write) · G11 (nothing to observe) · G13 (nothing to verify)
- **Hard prerequisite ON**: G8 (writing needs the broker) · G15 (privileged action needs authorization)
- **Soft dependency**: Native Code Understanding (Stage 2 · would improve generation quality but not required for basic operation)
- **Can operate independently**: NO — writes require broker (G8) + auth (G15)
- **Authorization status**: N/A · not implemented
- **Verification status**: N/A · not implemented

### G8 · Real Filesystem Execution Broker

- **Current state**: MISSING
- **Evidence**: `src/lib/nex-controlled-hands/types.ts:1-50` — types only, no execution logic · orchestrator EXECUTION returns NOT_IMPLEMENTED
- **What exists today**: Type-only capability manifest · T3-B/48.a-c adversarial test fixtures that spawn child processes to prove ACL enforcement (but these are proofs of concept, not the broker itself)
- **What is missing**: OS-process-based execution broker · sandbox · policy engine · resource limits · artifact capture
- **Hard prerequisite for**: G7 (writes need broker) · G11 (screenshots need runtime) · G13 (verification tools need to be shelled out via broker) · G17 (vendor tools need broker to invoke)
- **Hard prerequisite ON**: G15 (privileged execution needs authorization)
- **Soft dependency**: G16 (trace persistence · so execution events are recorded)
- **Can operate independently**: PARTIALLY — could be built + tested against T3-B harness before G15 is production-ready, but must not be exposed to real workloads without G15
- **Authorization status**: types define capability manifest but no enforcement in code path

### G11 · Real Eyes / Visual Inspection

- **Current state**: MISSING · orphaned
- **Evidence**: `src/app/nex1/workstation/page.tsx:166` — "Live preview is NOT_IMPLEMENTED" · Phase 9 (Independent Observer / Real Eyes) not referenced anywhere in codebase
- **What exists today**: Nothing
- **What is missing**: Screenshot capture · rendering · visual diff · layout inspection · component detection · accessibility overlay
- **Hard prerequisite for**: Full visual verification demonstrations (per master prompt Section 14)
- **Hard prerequisite ON**: G7 + G8 (need built app to see) + runtime execution (need something running)
- **Terminal capability**: Nothing else depends on Real Eyes existing
- **Soft dependency**: G17 (browser automation tools like Playwright)
- **Can operate independently**: NO — needs a running app

### G12 · Correction Loop

- **Current state**: MISSING
- **Evidence**: `src/lib/nex1-orchestrator/state-machine.ts` — no loop-back logic · forward-only state transitions (REQUEST_RECEIVED → ORCHESTRATION_COMPLETED)
- **What exists today**: Terminal state machine
- **What is missing**: Backward transitions from VERIFICATION/FAILED to ARCHITECTURE or BUILD_PLAN · correction budget enforcement · escalation trigger
- **Hard prerequisite for**: Iterative refinement · human escalation on repeated failure
- **Hard prerequisite ON**: G13 (need verification failure signal) + G16 (need history of prior attempts) + G7 (need to regenerate corrected code)
- **Soft dependency**: Truth Engine (for failure classification)
- **Can operate independently**: NO

### G13 · Verification Stage

- **Current state**: MISSING · fixture-only
- **Evidence**: `src/lib/nex1-orchestrator/orchestrator.ts:175` — VERIFICATION marked NOT_IMPLEMENTED · specialists return LIMITED_V0 fixtures
- **What exists today**: Fixture stubs returning deterministic PASS verdicts
- **What is missing**: Real test execution · real lint · real typecheck · real security scan · comparison against acceptance criteria
- **Hard prerequisite for**: G12 (correction needs failure signal) · trustworthy PASS verdicts · Two-Proof Rule enforcement
- **Hard prerequisite ON**: G7 + G8 (something to verify) + G17 (real tools to invoke)
- **Soft dependency**: G16 (verification receipts persistence · for audit trail)
- **Can operate independently**: NO — needs code, filesystem, and tools

### G15 · Ed25519 Founder Authorization

- **Current state**: MISSING · CRITICAL SECURITY GAP
- **Evidence**: `src/lib/nex1-orchestrator/orchestrator.ts:45-46` (`authorisation: false`) · `src/app/nex1/workstation/page.tsx:46` — client-side generates `FA-WORKSTATION-${Date.now().toString(36)}` · zero cryptographic verification
- **What exists today**: Plain-text advisory tokens
- **What is missing**: Ed25519 keypair management · signing · verification · nonce/replay protection · timestamp/expiry · operation binding · scope binding · key rotation
- **Hard prerequisite for**: G8 (privileged execution) · G7 (privileged code writes) · G11 (privileged runtime) · anything with side effects
- **Hard prerequisite ON**: NONE — foundational
- **Soft dependency**: G16 (audit trail of authorisations)
- **Can operate independently**: YES — can be designed + tested standalone (key management + signature verification are pure crypto)

### G16 · Workflow Trace Persistence

- **Current state**: MISSING
- **Evidence**: `.nex/workspaces-t3b/` empty except test artifacts · no Supabase sink · no `saveTrace` implementation in orchestrator
- **What exists today**: In-memory traces during request lifetime only
- **What is missing**: Durable database sink · trace correlation · replay analysis · trace query API
- **Hard prerequisite for**: G12 (correction needs history) · audit compliance · founder review beyond same-request window · G17 (verification receipts recorded)
- **Hard prerequisite ON**: NONE — foundational (needs some persistence substrate but Postgres exists per prior migrations 001-005)
- **Soft dependency**: Truth Engine (for immutable audit records per ADR-0308 Rule 10)
- **Can operate independently**: YES — persistence layer can be built + tested against schema alone

### G17 · Specialist Agents · Real Vendor-Tool Bindings

- **Current state**: MISSING · fixture-only
- **Evidence**: `src/lib/nex1-orchestrator/orchestrator.ts:13-22` — imports declare specialists but implementations return LIMITED_V0 fixtures · no eslint / jest / npm-audit / tsc invocations found
- **What exists today**: Deterministic fixture verdicts
- **What is missing**: Actual invocations of eslint · biome · prettier · tsc · vitest · jest · npm audit · gitleaks · trufflehog · playwright · lighthouse · axe · TypeDoc · etc.
- **Hard prerequisite for**: G13 (real verification requires real tools)
- **Hard prerequisite ON**: G8 (needs execution broker to shell out safely)
- **Soft dependency**: G16 (tool output recorded as verification receipts)
- **Can operate independently**: NO — needs broker

---

## §3 · Phase 2 · Ten target capabilities against current implementation

Mapping the founder's 10 capabilities (master prompt Section 6) to ADR-0318 gaps + current state:

| # | Founder Capability | Corresponds to | Current State per Section 4 rubric |
|---|---|---|---|
| 1 | Native Code Generation Engine | G7 | **NOT_STARTED** — plans only |
| 2 | Ed25519 Authorization | G15 | **NOT_STARTED** — advisory-only tokens |
| 3 | Execution Broker | G8 | **DESIGNED** (Controlled-Hands types exist) — NOT operational |
| 4 | Trace Persistence | G16 | **NOT_STARTED** — in-memory only |
| 5 | Real Verification | G13 + G17 | **DESIGNED** (specialist scaffolding) — NOT operational (fixtures) |
| 6 | Correction Loop | G12 | **NOT_STARTED** — forward-only |
| 7 | Truth Engine | ADR-0314 (separate from G-series) | **PROPOSED** — ADR authored, not built |
| 8 | Native Code Understanding | Stage 2 of founder's 7-stage progression | **PARTIAL** — AST Semantic adapter exists (912 lines) but not wired to NEX1 reasoning |
| 9 | Real Eyes | G11 | **NOT_STARTED** — orphaned |
| 10 | Real Vendor Tools | G17 | **NOT_STARTED** — fixture stubs |

**FACT** — Nine of ten capabilities are in NOT_STARTED, DESIGNED, or PARTIAL state. Zero are OPERATIONAL. Zero are VERIFIED. Zero are AUTHORIZED. Zero are PRODUCTION_READY.

---

## §4 · Phase 3 · Dependency Graph

### §4.1 · Human-readable graph

```
FOUNDATION LAYER (no upstream prerequisites)
├── G15 · Ed25519 Authorization       [independent · pure crypto]
├── G16 · Trace Persistence           [independent · needs Postgres substrate that exists]
└── Truth Engine (parallel workstream)[independent · governance layer]

BROKER LAYER
└── G8 · Execution Broker             [requires: G15]

WRITE LAYER
├── G7 · Code Generation Engine       [requires: G8, G15]
└── G17 · Real Vendor Tool Bindings   [requires: G8]

VERIFICATION LAYER
├── G13 · Real Verification           [requires: G7, G8, G17]
└── Native Code Understanding (Stage 2) [parallel · benefits G7 · needs no prerequisites of its own]

FEEDBACK LAYER
└── G12 · Correction Loop             [requires: G13, G16, G7]

OBSERVER LAYER
└── G11 · Real Eyes (Visual QA)       [requires: G7, G8 + runtime execution]

INTEGRATION
└── Complete UNDERSTAND→PLAN→AUTHORIZE→BUILD→EXECUTE→VERIFY→CORRECT→REVERIFY→TRACE→REPORT
    [requires: ALL above]
```

### §4.2 · Machine-readable graph (JSON)

```json
{
  "nodes": [
    {"id": "G15", "name": "Ed25519 Authorization", "layer": "foundation"},
    {"id": "G16", "name": "Trace Persistence", "layer": "foundation"},
    {"id": "TE",  "name": "Truth Engine",       "layer": "foundation"},
    {"id": "G8",  "name": "Execution Broker",   "layer": "broker"},
    {"id": "G7",  "name": "Code Generation",    "layer": "write"},
    {"id": "G17", "name": "Real Vendor Tools",  "layer": "write"},
    {"id": "G13", "name": "Real Verification",  "layer": "verify"},
    {"id": "NCU", "name": "Native Code Understanding (Stage 2)", "layer": "verify"},
    {"id": "G12", "name": "Correction Loop",    "layer": "feedback"},
    {"id": "G11", "name": "Real Eyes",          "layer": "observer"}
  ],
  "hard_dependencies": [
    {"from": "G15", "to": "G8"},
    {"from": "G8",  "to": "G7"},
    {"from": "G15", "to": "G7"},
    {"from": "G8",  "to": "G17"},
    {"from": "G7",  "to": "G13"},
    {"from": "G8",  "to": "G13"},
    {"from": "G17", "to": "G13"},
    {"from": "G13", "to": "G12"},
    {"from": "G16", "to": "G12"},
    {"from": "G7",  "to": "G12"},
    {"from": "G7",  "to": "G11"},
    {"from": "G8",  "to": "G11"}
  ],
  "soft_dependencies": [
    {"from": "G16", "to": "G8"},
    {"from": "G16", "to": "G13"},
    {"from": "TE",  "to": "G12"},
    {"from": "NCU", "to": "G7"},
    {"from": "G17", "to": "G11"},
    {"from": "G16", "to": "G15"}
  ],
  "cycles": []
}
```

**FACT · No cycles.** The graph is a DAG. Build order is derivable via topological sort.

---

## §5 · Phase 4 · Hard prerequisites

For each capability, evidence-backed hard prerequisites (must exist before this can meaningfully ship):

| Capability | Hard prerequisites | Rationale |
|---|---|---|
| G15 Ed25519 | (none) | Pure cryptography · no dependencies |
| G16 Trace Persistence | (existing Postgres) | Uses existing DB substrate from migrations 001-005 |
| Truth Engine | ADR-0308 tables (semantic layer) | Governance layer needs semantic substrate to govern |
| G8 Execution Broker | G15 | Privileged execution MUST NOT operate without cryptographic authorisation |
| G17 Real Vendor Tools | G8 | Tools must be invoked through the broker for security containment |
| G7 Code Generation | G8, G15 | File writes require broker (G8) which requires auth (G15) |
| G13 Real Verification | G7, G8, G17 | Nothing to verify without code (G7) written to disk (G8) with real tools (G17) |
| Native Code Understanding | (none for basic AST) | AST Semantic adapter exists; can extend independently |
| G12 Correction Loop | G13, G16, G7 | Need failure signal (G13) + history (G16) + regenerate (G7) |
| G11 Real Eyes | G7, G8 + runtime | Need built app running to see |

---

## §6 · Phase 5 · Contradictions with founder's suggested order

Founder's suggested "likely operational spine" (master prompt Section 24):
```
AUTHORITY → CONTROLLED EXECUTION → TRACE PERSISTENCE → REAL VERIFICATION
→ CORRECTION LOOP → CODE GENERATION → NATIVE CODE UNDERSTANDING → REAL EYES
→ PROFESSIONAL TOOL ORCHESTRATION
```

**FACT · Contradiction 1**: Founder placed **REAL VERIFICATION** before **CODE GENERATION**. Evidence contradicts:
- Real Verification (G13) HARD-requires G7 (something to verify), G8 (built to disk), G17 (real tools)
- Without G7, verification has nothing to run against
- **UNLESS** "REAL VERIFICATION" is interpreted as "verification INFRASTRUCTURE" (how to invoke tests, propagate signals, record receipts) — that infrastructure CAN be built before G7 lands
- **Disambiguation needed**: does founder mean the infrastructure or the operating verification pipeline?

**FACT · Contradiction 2**: Founder placed **CORRECTION LOOP** before **CODE GENERATION**. Evidence contradicts:
- Correction Loop (G12) HARD-requires G13 (failure signal) which HARD-requires G7 (something built) which HARD-requires G8 (broker)
- Correction cannot precede the thing being corrected
- Same infrastructure-vs-operational ambiguity as Contradiction 1

**FACT · Contradiction 3**: Founder placed **PROFESSIONAL TOOL ORCHESTRATION** last. Evidence contradicts:
- Real Vendor Tools (G17) HARD-required by Real Verification (G13)
- Cannot verify without real tools
- G17 must precede G13, not follow all others

**FACT · Contradiction 4**: Founder placed **NATIVE CODE UNDERSTANDING** after **CODE GENERATION**. Evidence-neutral:
- Native Code Understanding (Stage 2) is a parallel workstream · no hard dependency on G7
- Can begin at any time · improves G7's context-awareness when both exist
- Either order works · no contradiction · flag as PARALLEL

**FACT · Alignment 1**: Founder placed **AUTHORITY** first. Evidence supports.
**FACT · Alignment 2**: Founder placed **REAL EYES** near the end. Evidence supports (needs built app running).

**INFERENCE** — The founder's suggested order is **directionally correct but has three structural contradictions with hard dependencies**. Founder's own rule (Section 24): *"If evidence produces a different dependency order, use the evidence-backed order."* Applying that rule now.

---

## §7 · Phase 6 · Evidence-backed build order

Derived from topological sort of the DAG in §4.2, with parallel-track opportunities identified.

### Recommended build order (10 phases · each independently founder-authorised per ADR-0318 line 154):

**PHASE 6.1 · Foundation Layer (parallel-safe · no dependencies)**
- **Track A**: G15 Ed25519 Authorization
- **Track B**: G16 Trace Persistence
- **Track C**: Native Code Understanding (Stage 2) — begin AST tooling independently
- All three can proceed in parallel. All three are prerequisite for later layers.

**PHASE 6.2 · Broker Layer**
- G8 Execution Broker (requires PHASE 6.1 Track A · G15)
- Cannot proceed until G15 is OPERATIONAL and VERIFIED

**PHASE 6.3 · Write Layer (parallel-safe once PHASE 6.2 complete)**
- **Track A**: G17 Real Vendor Tool Bindings (requires G8)
- **Track B**: G7 Code Generation Engine (requires G8 + G15)
- Both benefit from PHASE 6.1 Track C · Native Code Understanding when available

**PHASE 6.4 · Verification Layer**
- G13 Real Verification (requires G7 + G8 + G17)
- Cannot proceed until PHASE 6.3 complete

**PHASE 6.5 · Feedback Layer**
- G12 Correction Loop (requires G13 + G16 + G7)
- Cannot proceed until PHASE 6.4 complete

**PHASE 6.6 · Observer Layer**
- G11 Real Eyes (requires G7 + G8 + runtime; can begin once G7 produces something runnable)

**PHASE 6.7 · Truth Engine Integration**
- Truth Engine (ADR-0314) — governance layer applied across all preceding layers
- Can begin design in parallel with any phase; enforcement requires the layers to exist

**PHASE 6.8 · End-to-End Integration**
- Complete UNDERSTAND → PLAN → AUTHORIZE → BUILD → EXECUTE → VERIFY → CORRECT → REVERIFY → TRACE → REPORT loop

**PHASE 6.9 · Golden Demonstration (master prompt Section 21)**
- Real engineering task end-to-end demonstration

**PHASE 6.10 · Adversarial Verification (master prompt Section 20)**
- Attempt to bypass auth, execute unauthorized commands, forge identity, corrupt traces · demonstrate safe failure

**FACT** — This is the **evidence-backed order**. Not the founder's suggested order. Founder invited this correction in Section 24.

---

## §8 · Agent team plan · skill-set mapping to existing 48 NEX agents

Founder ask: *"we must build the team that supports and honour with name status and number along with these."*

Per NEX Designation Governance: **no new NEX-nn number is issued without founder approval**. All proposals below are PROPOSED status only.

### §8.1 · Skill-set → existing agent mapping

For each new capability, the existing NEX-48 agent inventory has natural collaborators:

| Capability | Existing agents (skill match) | Skill gap · would need new agent |
|---|---|---|
| G15 Ed25519 Auth | Security Agent (`nex/security-agent/security-agent.ts`) · SecOps (Coding Team) | Ed25519-specific tooling · key management |
| G16 Trace Persistence | Master AI M3 (Observation module) · Coding Team Telemetry | Trace schema + query API |
| G8 Execution Broker | Controlled-Hands (types-only, existing) · WO-04 Broker Executor · WO-05 Build Executor · WO-06 Runtime Executor | Real broker implementation (currently orphaned types) |
| G17 Real Vendor Tools | Coding Team: Tester · Types-Guard · Reviewer · Migration-Reviewer · Accessibility-Reviewer · Contract-Reviewer · SecOps | Vendor-tool integration adapters |
| G7 Code Generation | Coding Team: Builder · Architect · Technical-Writer · AST Semantic adapter | Diff generation + patch-applier |
| G13 Real Verification | Coding Team: Tester · Debugger · Forensics · Types-Guard · Accessibility-Reviewer | Verification receipt aggregator |
| G12 Correction Loop | Coding Team: Debugger · Reviewer · Forensics | Correction budget enforcer · escalation router |
| Truth Engine | Guardian (`nex/language/guardian.ts`) · existing truth-engine module · unified per ADR-0314 | Cross-substrate reconciler |
| Native Code Understanding | AST Semantic adapter · Coding Team Architect | Symbol graph · call graph · data-flow builders |
| G11 Real Eyes | (no existing agent) | New agent · visual QA specialist |

**FACT** — Most capabilities have skill-adjacent existing agents. The primary gaps are:
1. **Visual QA agent** — no existing agent has this role
2. **Ed25519 tooling** — needs dedicated key-management module
3. **Real broker implementation** — types exist, engine does not

### §8.2 · Proposed NEX-nn designations (all PROPOSED · none authorised)

Per Designation Governance rule (from `agent-designation.ts`): number is IDENTITY, not capability. Every proposal requires founder approval to become OFFICIAL. Intelligence status (NI level) is a separate axis · UNKNOWN until proven.

**Proposed designations** (founder approves individually):

| Proposed NEX-nn | Proposed Purpose | Existing agent(s) it would formalise | Prerequisite for |
|---|---|---|---|
| **NEX-03** (PROPOSED) | Authority Intelligence · cryptographic authorisation | Security Agent + new Ed25519 module | G15 |
| **NEX-04** (PROPOSED) | Execution Broker Intelligence · controlled OS-process execution | Controlled-Hands types + new broker engine | G8 |
| **NEX-05** (PROPOSED) | Persistence Intelligence · durable trace + audit record store | Master AI M3 + new trace schema | G16 |
| **NEX-06** (PROPOSED) | Vendor-Tool Orchestration Intelligence · real tool bindings | Coding Team specialists + tool adapters | G17 |
| **NEX-07** (PROPOSED) | Code Generation Intelligence · deterministic patch authoring | Coding Team Builder + AST Semantic adapter | G7 |
| **NEX-08** (PROPOSED) | Verification Intelligence · real test/lint/type/security execution | Coding Team Tester + Debugger + Forensics | G13 |
| **NEX-09** (PROPOSED) | Correction Intelligence · failure→correction→re-verify loop | Coding Team Debugger + Reviewer | G12 |
| **NEX-10** (PROPOSED) | Truth Engine Intelligence · governance + evidence-linking | Guardian + ADR-0314 module | Truth Engine |
| **NEX-11** (PROPOSED) | Native Code Understanding Intelligence · AST + symbol + call + data flow | AST Semantic adapter (existing) | Stage 2 |
| **NEX-12** (PROPOSED) | Visual QA Intelligence · Real Eyes · screenshot/render/diff | NEW agent · no existing counterpart | G11 |

**Existing (unchanged)**:
- **NEX-01 OFFICIAL** · Native Code Intelligence (the code brain · already OFFICIAL)
- **NEX-02 PROPOSED** · Context Intelligence (CEG + shared context provider · still PROPOSED)

**FACT · Governance rule preserved**: All 10 new proposals stay PROPOSED. Founder authorises each individually. Number assignment is claim-first, evidence-earned per Designation Governance §2.

---

## §9 · Deliverables A-L (from master prompt Section 30)

### A · Current Capability Matrix (§2 above · one row per gap)

| Gap | Current | Evidence | Missing | Blocked by | ADR | Risk |
|---|---|---|---|---|---|---|
| G7 | NOT_STARTED | orchestrator.ts:150-200 | AST + writes | G8+G15 | 0318 | Critical |
| G8 | DESIGNED | types.ts:1-50 | Broker engine | G15 | 0318 | Critical |
| G11 | NOT_STARTED | page.tsx:166 | Visual capture | G7+G8+runtime | 0318 | Critical/orphaned |
| G12 | NOT_STARTED | state-machine.ts | Loop-back | G13+G16+G7 | 0318 | High |
| G13 | NOT_STARTED | orchestrator.ts:175 | Real tools | G7+G8+G17 | 0318 | High |
| G15 | NOT_STARTED | page.tsx:46 | Ed25519 | (none) | 0318 | Critical/security |
| G16 | NOT_STARTED | .nex/workspaces/ | DB sink | (none) | 0318 | High |
| G17 | NOT_STARTED | orchestrator.ts:13-22 | Tool adapters | G8 | 0318 | High |

### B · Dependency Graph (§4 above · machine-readable JSON + diagram)

Provided in §4.

### C · Prerequisite Matrix (§5 above)

Provided in §5.

### D · Build Order (§7 above)

10 phases with parallel-track opportunities. Evidence-backed. Contradicts founder's suggested order on three specific ordering decisions (Real Verification before Code Gen · Correction Loop before Code Gen · Real Tools last) — founder's Section 24 rule directs use of evidence-backed order in such cases.

### E · Architecture

**DEFERRED** — updates only justified after founder authorises Phase 6.1 Track A/B/C. Not this audit.

### F · Implementation Plan (broken into independently testable phases)

**DEFERRED** — each phase requires a separate Work Order per ADR-0318 line 154. Not this audit.

### G · Security Model

**DEFERRED** — full threat model + authorization + execution isolation belongs to G15 + G8 Work Orders. Preliminary framing:
- Threat model must include: token replay · broker bypass · key exfiltration · sandbox escape · resource exhaustion · secret leak
- Auth model must satisfy Safety Doctrine §3 (permission-check-then-action)
- Isolation must satisfy: least privilege · capability-based · immutable audit

### H · Trace Model

**DEFERRED to G16 Work Order.** Preliminary schema per master prompt Section 9:
- trace_id, operation_id, request_id, parent_operation_id
- actor, authority, intent, plan, authorization
- files_read, files_created, files_modified
- commands_executed, execution_results
- tests_run, verification_results, visual_results
- corrections, final_state, timestamps, errors, warnings, artifacts, final_decision

### I · Verification Model

**DEFERRED to G13 Work Order.** Preliminary levels per master prompt Section 10: L1 Structural · L2 Static · L3 Test · L4 Runtime · L5 Visual · L6 Security. Each level must produce recorded evidence, not fixture pass.

### J · Correction Model

**DEFERRED to G12 Work Order.** Preliminary constraints per master prompt Section 11:
- Maximum correction attempts (proposed: 3 · founder decision)
- Correction budget · failure classification · evidence-driven correction · regression protection · authorisation for privileged corrections · complete trace · human escalation · terminal failure state

### K · End-to-End Test Harness

**DEFERRED to PHASE 6.9 golden demonstration + PHASE 6.10 adversarial verification.**

### L · Final Capability Report

**DEFERRED** — produced after PHASE 6.8 completion. Each of 10 capabilities reports: CURRENT STATE · IMPLEMENTATION · EVIDENCE · TEST RESULTS · LIMITATIONS · AUTHORIZATION · DEPENDENCIES · NEXT STEP.

---

## §10 · Contradictions surfaced (Phase 5 output · full list)

| # | Contradiction | Founder text | Evidence | Recommended resolution |
|---|---|---|---|---|
| 1 | Real Verification before Code Generation | Master prompt Section 24 order | G13 hard-requires G7 | Interpret "REAL VERIFICATION" as verification INFRASTRUCTURE (Level 1-2 · syntactic + static · can precede G7). Operational G13 (Level 3-6) requires G7. |
| 2 | Correction Loop before Code Generation | Master prompt Section 24 order | G12 hard-requires G13 which hard-requires G7 | Correction infrastructure can be scaffolded before G7. Operational correction requires G7+G13. |
| 3 | Professional Tool Orchestration last | Master prompt Section 24 order | G17 hard-required by G13 | Move G17 earlier · into PHASE 6.3 Track A (parallel with G7) |
| 4 | Native Code Understanding after Code Generation | Master prompt Section 24 order | No hard dependency · parallel | Move to PHASE 6.1 Track C (parallel foundation work) |
| 5 | ADR-0308 migration held vs `db/migrations/006` exists | ADR-0308 line 281 vs repo | Documented in prior audit `nex-adr-database-state-verification-2026-09-16.md` · UNKNOWN | Live DB inspection required before decision |
| 6 | 10 target capabilities scope vs Mode 2 REPAIR doctrine | Master prompt implies broad scope · ADR-0318 requires per-gap Work Orders | ADR-0318 line 154 | Each phase requires separate founder Work Order. No compound authorisation. |

---

## §11 · Truthful state per capability (per master prompt Section 4)

Never collapse EXISTS / OPERATIONAL / VERIFIED / AUTHORISED / PROPOSED.

| Capability | EXISTS | OPERATIONAL | VERIFIED | AUTHORISED | PRODUCTION_READY |
|---|---|---|---|---|---|
| G7 | NO | NO | NO | NO | NO |
| G8 | PARTIAL (types) | NO | NO | NO | NO |
| G11 | NO | NO | NO | NO | NO |
| G12 | NO | NO | NO | NO | NO |
| G13 | PARTIAL (fixtures) | NO | NO | NO | NO |
| G15 | NO (advisory-only) | NO | NO | NO | NO |
| G16 | NO | NO | NO | NO | NO |
| G17 | PARTIAL (fixtures) | NO | NO | NO | NO |
| Truth Engine | DESIGNED (ADR-0314) | NO | NO | NO | NO |
| Native Code Understanding | PARTIAL (AST adapter) | PARTIAL | NO | NO | NO |
| Real Eyes | NO | NO | NO | NO | NO |
| NEX-02 CEG | DESIGNED (alpha.10) | PARTIAL | PARTIAL | NO (PROPOSED) | NO |

**FACT** — Zero capabilities are PRODUCTION_READY. Two are PARTIAL. Rest are NOT_STARTED or DESIGNED-only.

---

## §12 · Founder decisions required (before Phase 7 implementation)

Per ADR-0318 line 154, each of the following requires an individual founder Work Order:

1. **Phase 6.1 Track A** — authorise G15 Ed25519 build
2. **Phase 6.1 Track B** — authorise G16 Trace Persistence build
3. **Phase 6.1 Track C** — authorise Native Code Understanding Stage 2 build
4. **Phase 6.2** — authorise G8 Execution Broker build (after 6.1 Track A verified)
5. **Phase 6.3 Track A** — authorise G17 Real Vendor Tool Bindings build (after 6.2 verified)
6. **Phase 6.3 Track B** — authorise G7 Code Generation Engine build (after 6.2 verified)
7. **Phase 6.4** — authorise G13 Real Verification build (after 6.3 both tracks verified)
8. **Phase 6.5** — authorise G12 Correction Loop build (after 6.4 verified)
9. **Phase 6.6** — authorise G11 Real Eyes build (after 6.3 Track B verified)
10. **Phase 6.7** — authorise Truth Engine unification (after preceding layers exist)
11. **Phase 6.8** — authorise end-to-end integration
12. **Phase 6.9** — authorise golden demonstration
13. **Phase 6.10** — authorise adversarial verification

**AND** per Designation Governance, each proposed NEX-nn number (NEX-03 through NEX-12) requires a separate founder approval to become OFFICIAL. Number assignment is founder-only per ADR governance.

**AND** the prior contradictions with ADR-0308 (migration state · Capability A disposition · Universal Intent Rule 1) remain open founder decisions from prior audits · listed in `nex-adr-migration-readiness-and-capability-a-disposition-2026-09-16.md`.

---

## §13 · What this audit does NOT do

- Does NOT implement any capability
- Does NOT authorise any Work Order
- Does NOT commit or push
- Does NOT decide founder-only questions
- Does NOT issue new NEX designations
- Does NOT modify any ADR
- Does NOT propose NEX2/NEX-02 promotion
- Does NOT bypass the freeze
- Does NOT claim readiness that evidence does not support

---

## §14 · The absolute rule (Section 32 · self-check)

*"NEX1 must never claim an operational capability that it cannot demonstrate with evidence."*

**FACT · Nothing in this audit claims an operational capability.** Every capability is honestly labelled per §11. All ten target capabilities are NOT PRODUCTION_READY. Two are PARTIAL. The rest are NOT_STARTED or DESIGNED-only.

**FACT · This audit is Phase 0.** It produces the evidence + build order. Implementation (Phase 7+) requires separate founder Work Order per phase per ADR-0318 line 154.

---

**SEALED · 2026-09-16 · v1.0 · append-only · founder-directed Phase 0 read-only audit + evidence-backed build order**

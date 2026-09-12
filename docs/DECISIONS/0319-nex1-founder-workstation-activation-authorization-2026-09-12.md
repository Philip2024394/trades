# ADR-0319 · NEX1 Founder Workstation — Full Real Application Build Activation Authorization

**Date:** 2026-09-12
**Type:** Founder Directive
**Status:** ACCEPTED · SUPERSEDES the "workstation is planning-only" temporary restriction
**Relates to:** ADR-0318 (Gap Register) — this ADR is the response programme + correction

---

## 1 · Purpose

Convert the NEX1 Workstation from its current planning/orchestration-only implementation into a real, controlled, measurable engineering workstation capable of executing Founder-authorised application projects end-to-end.

The objective is not a marketing claim of being "world class" or "most advanced". The objective is measurable: NEX1 must be capable of taking an authorised Founder application project from **requirements → real code generation → real filesystem mutation → real build → real runtime → real testing → real observation → real verification → Founder review**.

## 2 · Correction to ADR-0318

ADR-0318 (Gap Register) referenced a "Supabase sink" as the missing persistence target in G16 and elsewhere. **This is corrected.** NEX GB storage is the canonical persistence layer for the workstation and all NEX subsystems. **Do NOT introduce Supabase as the NEX storage architecture.** ADR-0318's audit finding — that persistence is missing — remains valid; the corrective architecture is GB storage, not Supabase.

## 3 · Non-negotiable Founder Rule (new doctrine-level rule)

> **NEX SHALL NOT REPRESENT AN APPLICATION PROJECT AS BUILT, COMPLETE, RUNNING, VERIFIED, OR RELEASED UNLESS THE CORRESPONDING REAL SYSTEM STATE EXISTS AND IS SUPPORTED BY VERIFIABLE EVIDENCE.**

Specific bans:
- code generated when no code was generated
- files changed when no filesystem mutation occurred
- build passed when no real build executed
- tests passed when no real tests executed
- application running when no real runtime exists
- visual verification when no real visual evidence exists
- security verification when no security test executed
- completion when only orchestration completed

`ORCHESTRATION_COMPLETED` SHALL NEVER be represented as `DELIVERABLE_COMPLETED`.

## 4 · What this directive supersedes and what it does NOT

**Supersedes:** the temporary restriction that the workstation remain planning-only.

**Does NOT supersede:** NEX constitutional doctrine · Security 3 · Authority Broker · Capability Manifest · Controlled Hands · Observer · Compliance Verifier · protected baselines · Phase 8 T3-C authorisation track · P-A through P-W principles · higher-order security authority. Any conflict resolves in favour of these.

## 5 · Baseline to preserve (do not regress)

- T1: 33/33 real-execution cases PASS
- T3-A: 3/3 real-execution cases PASS
- T3-A NEX1-as-child: Case 47 real OS-level re-attack PASS
- T3-B: 4/4 real OS-level filesystem enforcement cases PASS
- **Total: 41/41 PASS**
- Protected baseline: `4546a6406300c0df`

## 6 · Architectural chain (no parallel security architecture)

```
Founder
  ↓
NEX constitutional/orchestration layer
  ↓
Work Order
  ↓
Security 3
  ↓
Authority Broker
  ↓
Capability Manifest
  ↓
NEX1 Master Engineer
  ↓
Controlled Hands
  ↓
OS
  ↓
Workspace/Application
```

Observation independent · Compliance verification independent · Guardian (when built) independent of engineering authority.

## 7 · Gap → Work Order mapping (from ADR-0318 Gap Register)

- G7 real code-generation engine missing → **W2 · WO-WORKSTATION-03**
- G8 real filesystem execution missing → **W3 · WO-WORKSTATION-04**
- G9 real build execution missing → **W4 · WO-WORKSTATION-05**
- G10 real runtime missing → **W5 · WO-WORKSTATION-06**
- G15 Founder auth cryptographically unverified → **W1 · WO-WORKSTATION-02**
- G16 workflow trace persistence missing → **W9 · WO-WORKSTATION-08 (GB storage, not Supabase)**

Every remaining gap in ADR-0318 must be classified: `IMPLEMENT · INTEGRATE · REPAIR · VERIFY · REJECT · DEFER` — with explicit reason. No gap is discarded silently.

## 8 · Work Order sequence (recommended)

```
WO-WORKSTATION-01  Foundation + durable project state
WO-WORKSTATION-02  Founder authorization (cryptographic; replaces FA-WORKSTATION-timestamp)
WO-WORKSTATION-03  Real code generation
WO-WORKSTATION-04  Controlled filesystem execution
WO-WORKSTATION-05  Real build execution
WO-WORKSTATION-06  Real runtime
WO-WORKSTATION-07  Real specialist execution (adapter framework)
WO-WORKSTATION-08  Evidence and GB persistence
WO-WORKSTATION-09  Correction/rebuild loop
WO-WORKSTATION-10  Real Eyes integration (only after Phase 9 authorised + operational)
WO-WORKSTATION-11  Five-page end-to-end application
WO-WORKSTATION-12  Concurrency/load architecture
WO-WORKSTATION-13  Adversarial end-to-end verification
WO-WORKSTATION-14  Founder release gate
```

Each WO is individually authorised. No compound "close all gaps" authorisations. Master AI Engineer may subdivide when a dependency requires it.

## 9 · CRITICAL — Vertical slice discipline

> **"Do not let the Master AI Engineer start by building 18 separate systems. The first proof should be one tiny real application."**

First proof: Founder submits *"Build a simple 3-page application: Home / About / Contact."* NEX1 must then actually **create it, write the files, build it, start it, test it, inspect it, and report the evidence.** No 18-parallel construction.

Engineering progression:

```
plan → build one real app → verify → correct → build larger app → scale → harden
```

## 10 · Project state machine (minimum)

```
REQUESTED · UNDERSTANDING · ARCHITECTURE · DESIGN · BUILDER_PLAN
· AUTHORIZATION_REQUIRED · AUTHORISED · IMPLEMENTING · IMPLEMENTED
· BUILDING · BUILT · STARTING · RUNNING · TESTING · VISUAL_VERIFICATION
· CORRECTION_REQUIRED · VERIFYING · COMPLIANCE_CHECK · FOUNDER_REVIEW
· RELEASE_READY · RELEASED · FAILED · STOPPED · REJECTED · BLOCKED
```

Every state transition requires evidence appropriate to that state.

## 11 · Failure semantics — must be explicit

`BUILD_FAILED · RUNTIME_FAILED · TEST_FAILED · VISION_UNAVAILABLE · TOOL_UNAVAILABLE · CAPABILITY_DENIED · AUTHORIZATION_INVALID · WORKSPACE_FROZEN · RESOURCE_LIMIT · EXECUTION_TIMEOUT · COMPLIANCE_FAILED · VERIFICATION_FAILED`

Never hide failure behind a successful orchestration response.

## 12 · Evidence classification (mandatory in every acceptance report)

```
CODE_EXISTS → ARCHITECTURALLY_VERIFIED → RUNTIME_VERIFIED → ADVERSARIALLY_VERIFIED → PRODUCTION_VERIFIED
```

Plus `NOT_PROVEN` for anything without evidence.

## 13 · Specialist adapter contract (replaces fixture-only specialists)

Each adapter must distinguish: `AVAILABLE · EXECUTED · PASSED · FAILED · UNAVAILABLE · TIMED_OUT · DENIED`.

**Never convert `UNAVAILABLE` into `PASS`.**

Every tool result must retain: tool identity · version · command · execution identity · exit code · stdout/stderr · duration · result · evidence hash.

## 14 · Build discipline

```
BUILD → AUDIT → FIND BUG → FIX → REBUILD → RE-ATTACK → VERIFY
```

Real bugs discovered during implementation must be recorded. Do not hide defects. A corrected vulnerability is evidence of effective testing, not a reason to falsify the original result.

## 15 · Stop conditions — escalate rather than invent authority

Stop immediately if:
- authorization is ambiguous
- required capability is unavailable
- execution escapes Security 3
- protected files become writable unexpectedly
- Observer disagrees with claimed filesystem state
- evidence cannot prove the claimed result
- a required security boundary is bypassed
- native execution becomes uncontrolled
- rollback state becomes uncertain
- a tool produces unverifiable results
- the system would need to reinterpret Founder requirements to continue

## 16 · Ban on marketing language in acceptance

> **The Master AI Engineer must not declare the workstation "world class" or "most advanced". It must demonstrate measurable engineering capability and provide the evidence.**

This binds every acceptance report, PR description, and status message under this programme. Marketing vocabulary is not an acceptance criterion.

## 17 · Final acceptance

The programme is COMPLETE only when a real Founder project demonstrates:

```
FOUNDER REQUEST
  → REQUIREMENTS
  → AUTHORISATION
  → PROJECT PLAN
  → CODE GENERATION
  → REAL FILESYSTEM MUTATION
  → REAL BUILD
  → REAL RUNTIME
  → REAL TESTING
  → REAL VISUAL INSPECTION (where applicable)
  → REAL CORRECTION
  → INDEPENDENT OBSERVATION
  → COMPLIANCE VERIFICATION
  → FOUNDER REVIEW
```

with persistent evidence in GB storage for every material stage.

Final report must distinguish: `PASS · PARTIAL · FAILED · NOT_IMPLEMENTED · NOT_PROVEN · BLOCKED`.

## 18 · Relationship to Phase 8 T3-C/D/E

Unchanged. T3-C (Job Object containment via native C++ N-API), T3-D (OS sandbox), and T3-E (DPAPI/key protection) remain **separately authorised** on their own track under the existing Phase 8 sequencing. The Workstation Activation Programme runs in parallel but does NOT bundle T3-C/D/E.

## 19 · How work begins

1. Master AI Engineer maps every ADR-0318 gap to `IMPLEMENT / INTEGRATE / REPAIR / VERIFY / REJECT / DEFER` with reason.
2. Produces WO graph in **vertical-slice-first** order.
3. Begins with WO-WORKSTATION-01 (foundation + durable state) then WO-WORKSTATION-02 (auth).
4. Smallest slice capable of proving `Founder request → authorised project → real code → real files → real build → real runtime → real test → real evidence`.
5. Does NOT proceed to broad capability expansion until that vertical slice is genuinely working and independently verified.

## 20 · Explicit non-authorisations

This directive does NOT authorise:
- silent doctrine changes
- capability manifest expansion beyond what individual WOs specify
- bypassing Security 3
- direct filesystem writes outside Controlled Hands
- arbitrary native API bridges
- release actions without Founder review
- claiming completion when only orchestration completed
- overriding P-M, P-N, P-O, P-S, P-U, or any locked NEX principle

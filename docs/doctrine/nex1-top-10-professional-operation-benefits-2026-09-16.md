# NEX1 · Top 10 Candidates for Professional Operation Uplift

**Founder-directed 2026-09-16 · READ-ONLY evidence-derived proposal · FREEZE remains in force**

**No code changes. No commits. No pushes. No implementation. No new NEX designations. No `APPLY MIGRATION`.**

---

## §1 · Honest preamble · who authored this list

Founder ask: *"Ask NEX1 what 10 new features or choice of builds or other would highly benefit NEX1 to operate on a higher more professional level of system operations."*

**FACT · NEX1 cannot produce this list natively.** Verified 2026-09-16 by direct probe of `classifyFounderIntent` with four phrasings of the question:

- *"what 10 features would improve your professional operation"* → **refused_no_verb_recognised**
- *"investigate what capabilities would benefit nex1 most"* → classified INVESTIGATE, but only surfaces `capabilities` as a concept token · no substantive answer
- *"build a list of ten improvements for nex1 native operation"* → classified BUILD, but only domain-token echoes · no substantive answer
- *"explain what nex1 needs to reach a higher level of system operation"* → **refused_no_verb_recognised**

**This matches the prior Agent Identity Recognition Audit finding**: NEX1 has no self-reflection capability (0 KNOWN, 8 UNKNOWN across the 10 identity questions).

**FACT · This document is authored by master_ai_engineer**, not by NEX1. Every candidate below is derived from founder-authored evidence: **ADR-0318 workstation gap register**, **ADR-0320 gap reclassification**, and the 7-stage progression established in `project_nex_founder_locked_review_principles_2026_09_16.md`.

**No candidate is fabricated. Every candidate cites its evidence source.** UNKNOWN is preserved where founder judgment is required.

---

## §2 · Ranking framework

The founder's phrase *"higher more professional level of system operations"* implies a full engineering operations lifecycle:

```
UNDERSTAND → PLAN → EXECUTE → VERIFY → CORRECT
     │                                        │
     └──────────── AUDIT · AUTH · TRUTH ──────┘
```

Each candidate below is ranked on:
- **Severity** from ADR-0318 gap register
- **Foundational unlock value** (how many downstream stages it enables)
- **Governance impact** (audit trail · authorisation · truth verification)
- **Alignment with the 7-stage progression** (Language → Code Understanding → Recognition → Identity → Designation → Capability → NI)

**No numerical scores.** Verdicts are FACT / INFERENCE / PROPOSAL only.

---

## §3 · Top 10 candidates (ranked)

### #1 · Native Code Generation Engine (unlocks the primary purpose)

**FACT** — ADR-0318 Gap G7 (CRITICAL): *"No framework-agnostic code authoring engine exists; NEX1 produces plans only. No AST construction, no template evaluation, no file writes."*

**Evidence**: `src/lib/nex1-orchestrator/orchestrator.ts:150-200` (BUILD_PLAN stage) · `src/lib/nex1-builder/engine.ts:59-77`

**What it enables**: Every stage 8-14 of the capability chain. Turns NEX1 from "planning + advisory" into "planning + execution + verification". This is the single largest professional-operation uplift.

**How honest implementation would proceed** (per ADR-0318 · not a build authorisation):
- AST-based authoring for TypeScript/React (extending AST Semantic adapter already in `nex-agent/code-engine/adapters/ast-semantic.ts`)
- Template evaluation for canonical page/route/component patterns
- Diff-driven output that the existing FOUNDER_DECISION gate can approve before it hits disk

**PROPOSAL · Not authorised without founder go-ahead.**

---

### #2 · Ed25519 Founder Authorization (security foundation for everything else)

**FACT** — ADR-0318 Gap G15 (CRITICAL SECURITY GAP): *"Founder authorization tokens are generated client-side in workstation UI (`FA-WORKSTATION-` + timestamp) with no cryptographic signing or verification. Founder authorisation is advisory-only."*

**Evidence**: `src/lib/nex1-orchestrator/orchestrator.ts:45-46` (authorisation: false) · `src/app/nex1/workstation/page.tsx:46` (token generation)

**What it enables**: Every subsequent capability that involves filesystem mutations, external calls, or credential-adjacent action. Without cryptographic authorisation, ADR-0308 Rule 10 (Guardian → Truth Engine gate) and Safety Doctrine §3 (permission-check-then-action) cannot be safely realised.

**Why this MUST come before #1**: An unauthenticated code-generation engine on someone's machine is a founder-authority-spoofing surface. Ed25519 signing closes that surface.

**PROPOSAL · Precondition for candidates #1, #3, #6, #9.**

---

### #3 · Real Filesystem Execution Broker + Controlled-Hands wiring

**FACT** — ADR-0318 Gap G8 (CRITICAL): *"EXECUTION stage is NOT_IMPLEMENTED; no mutations reach disk. Controlled-Hands defines the security manifest (type-only); no actual OS-process-based execution broker exists."*

**Evidence**: `src/lib/nex-controlled-hands/types.ts:1-50` (type-only) · `src/lib/nex1-orchestrator/orchestrator.ts:150-200`

**What it enables**: Actually applying diffs to the filesystem, under founder-authorised security boundaries. Depends on #2.

**Non-negotiable safety envelope** (per Safety Doctrine §3):
- Every file write logged with source diff hash + founder authorisation ID
- All writes reversible (git-based rollback point before each write)
- Explicit path-scope allow-list (never touch protected layers per Safety Doctrine §4 without re-certification)

**PROPOSAL · Cannot ship without #2.**

---

### #4 · Workflow Trace Persistence (audit trail foundation)

**FACT** — ADR-0318 Gap G16 (HIGH): *"Workflow traces exist only in-memory during request lifetime. No database sink to Supabase, PostgreSQL, or durable storage."*

**Evidence**: `.nex/workspaces-t3b/` (empty except test artifacts)

**What it enables**:
- Founder can review a trace hours or days after the request
- Correction loop (#7) can consult prior traces
- Truth Engine (#10) has historical record to enforce Wave Immutability
- NEX1 has memory of what it has actually done · not just what it planned

**Alignment**: Directly implements ADR-0308 Rule 11 storage segregation (`nex_agent.*` competency records) and Historical Wave Receipt Immutability doctrine.

**PROPOSAL · Enables audit-driven quality gates for #5 and #7.**

---

### #5 · Verification Stage · Real Test/Lint/Typecheck Execution

**FACT** — ADR-0318 Gap G13 (HIGH): *"VERIFICATION stage is NOT_IMPLEMENTED; no automated test execution, no compliance check beyond stub fixtures."*

**Evidence**: `src/lib/nex1-orchestrator/orchestrator.ts:175` (VERIFICATION marked NOT_IMPLEMENTED)

**What it enables**:
- Real `vitest run`, `tsc --noEmit`, `eslint`, `prettier --check` after every code write
- Two-Proof Rule Proof 1 (Component Proof) becomes automatic for every NEX1 output
- Professional CI-grade quality gates before founder approval

**Depends on**: #3 (something to verify) and #4 (persistence for verification receipts).

**PROPOSAL · Direct enabler of professional-grade quality.**

---

### #6 · Correction Loop / Bidirectional State Machine

**FACT** — ADR-0318 Gap G12 (HIGH): *"State machine is forward-only (REQUEST → ORCHESTRATION_COMPLETED). No re-entry from VERIFICATION/FAILED back to ARCHITECTURE or BUILD_PLAN. Feedback loop does not close."*

**Evidence**: `src/lib/nex1-orchestrator/state-machine.ts` (no loop-back logic)

**What it enables**:
- When verification fails, orchestrator returns to the plan/build stage with the failure evidence
- Iterative refinement · the hallmark of professional engineering
- Failure evidence becomes part of the trace (#4) so patterns can be learned

**Alignment**: Aligns with NEX Safety Doctrine §3 (verification → correction → re-execute cycle). Requires #4 (persistence) and #5 (real verification).

**PROPOSAL · Closes the operational loop.**

---

### #7 · Truth Engine Verifier (governance completion)

**FACT** — ADR-0320 reclassification (ACTIVE): *"Truth Engine verifier does not exist. Source Registry Guardian is one piece · full Truth Engine still owed."* Cross-references ADR-0314 (Unified Truth Engine).

**Evidence**: ADR-0314 · `docs/DECISIONS/0314-nex-unified-truth-engine.md` · currently "Proposed"

**What it enables**:
- Every knowledge write to `nex.*` gates through evidence validation (ADR-0308 Rule 10)
- Contradictions detected before authoritative promotion
- The full Guardian → Truth Engine → authoritative pipeline that ADR-0308 Rule 10 declares mandatory

**Alignment**: Prerequisite for `APPLY MIGRATION` to be fully realised (ADR-0308 Rule 10 requires the pipeline to be enforceable).

**PROPOSAL · Governance-layer completion.**

---

### #8 · Native Code Understanding (Stage 2 of 7-stage progression)

**FACT** — Founder-locked 7-stage progression (per `project_nex_founder_locked_review_principles_2026_09_16.md`): *"Stage 2 · Native Code Understanding · Teach NEX1 to actually inspect and understand source code."*

**Evidence**: Currently no ADR authorises Stage 2. Foundation exists: `src/lib/nex-agent/code-engine/adapters/ast-semantic.ts` (912 lines · TypeScript Compiler API integration). Would extend to symbol graph + control-flow + data-flow.

**What it enables**:
- NEX1 can answer "what does this file do?" from AST evidence, not from filename guessing
- Test-20 comprehension questions become answerable at partial-evidence level
- Stage 3 (Agent Recognition) becomes possible
- Directly addresses Section 8 audit findings on context-blindness

**FACT · Not yet founder-authorised.** Would require a new ADR authorising Stage 2 scope + Two-Proof Rule enforcement.

**PROPOSAL · Foundation for identity and reasoning work.**

---

### #9 · Independent Observer / Real Eyes · Visual Inspection

**FACT** — ADR-0318 Gap G11 (CRITICAL · ORPHANED): *"Phase 9 (Independent Observer / Real Eyes) is not referenced in current NEX1 codebase. No screenshot, rendering, or visual diff capability exists post-build."*

**Evidence**: `src/app/nex1/workstation/page.tsx:166` · "Live preview is NOT_IMPLEMENTED"

**What it enables**:
- Post-build visual verification (does the UI actually look right?)
- Visual-diff regression detection · professional QA layer
- Human-inspection surface for founder review before merge

**Depends on**: #1 (something built) + #3 (built to disk) + #5 (verified). Sequential dependency chain.

**PROPOSAL · Completes the "what got built matches intent" verification loop.**

---

### #10 · Specialist Agents Runtime · Real Vendor-Tool Bindings

**FACT** — ADR-0318 Gap G17 (HIGH): *"Specialist engine imports are placeholders. `performTestEngineerAnalysis`, `performSecurityAnalysis`, etc. are deterministic fixtures returning LIMITED_V0 markers, not real vendor-tool integrations (eslint, jest, npm audit, etc.)."*

**Evidence**: `src/lib/nex1-orchestrator/orchestrator.ts:13-22`

**What it enables**:
- Real linting (eslint · biome · prettier)
- Real security scanning (npm audit · gitleaks · trufflehog · snyk)
- Real performance profiling
- Real accessibility auditing
- Real type-checking (tsc)

**Alignment**: Closes the "professional-grade static analysis" gap. Currently NEX1's coding-team pipeline (15 agents from prior inventory) uses fixture stubs; real tool integration transforms this from theater into actual QA.

**PROPOSAL · Turns the 15-agent Coding Team pipeline from advisory to authoritative.**

---

## §4 · Deferred candidates (worthwhile · not in top 10)

For transparency, these evidence-backed candidates also matter but were ranked below the top 10:

- **APPLY MIGRATION + resolveConcept wiring** (ADR-0308 Gate 5+6) — foundational language work already in-progress per prior audits. Its blockers are documented in `nex-adr-migration-pre-apply-safety-audit-2026-09-16.md`.
- **Capability A migration to `nex.concepts`** (ADR-0308 Rule 6/11) — depends on APPLY MIGRATION.
- **Universal Intent Rule 1 conformance** — depends on `nex/language/` becoming canonical.
- **Standards Feed persistence** (ADR-0318 G18) — MEDIUM severity.
- **R-10 promotion gate** (ADR-0320 ACTIVE) — governance layer.
- **Category taxonomy per Domain** (ADR-0320 ACTIVE).
- **Stage 3 · Agent Recognition** — cannot ship before Stage 2.
- **Ed25519 protected-layer signature verification** (Safety Doctrine §5 future work).
- **Cryptographic release manifests** (Safety Doctrine §10 · future work).
- **Down-migration authoring** (per Migration Safety Audit).

---

## §5 · Cross-cutting themes

**FACT** — The top 10 cluster into three architectural themes:

**Theme A · Operational Lifecycle Completion** (#1, #3, #5, #6, #9)
Turns NEX1 from "planning + advisory" (v0.1.0) into an actual UNDERSTAND → PLAN → EXECUTE → VERIFY → CORRECT engineering system.

**Theme B · Governance Foundation** (#2, #4, #7)
Cryptographic authorisation + persistent audit trail + Truth Engine. These are the safety spine that makes autonomy defensible.

**Theme C · Capability Foundation** (#8, #10)
Native Code Understanding as prerequisite for future stages + real vendor-tool integration for professional QA.

**INFERENCE** — If the founder authorised ONLY Theme B, NEX1 becomes safer but not more capable. If ONLY Theme A, more capable but less safe. If ONLY Theme C, more capable at understanding but not at doing. Balanced progress across all three is likely what "professional operation" implies.

---

## §6 · What this list is NOT

- **NOT NEX1's opinion.** NEX1 cannot form opinions. This list is master_ai_engineer's evidence-derived proposal.
- **NOT a fabricated wish-list.** Every entry cites ADR-0318, ADR-0320, or founder-locked doctrine as evidence source.
- **NOT a build authorisation.** Every entry is PROPOSAL. Nothing is authorised until founder approves.
- **NOT a replacement for founder judgment.** Ranking is evidence-based, but "highest professional-operation lift" is ultimately a founder decision.
- **NOT complete.** Deferred candidates in §4 are also worthwhile · a top 10 by definition excludes worthy items.

---

## §7 · Founder decision required

For each of the ten candidates, the founder decides:

1. **Authorise / defer / reject** — no build proceeds without explicit founder approval.
2. **Sequencing** — which candidates must precede which. Two dependency chains are already visible:
   - #2 (Ed25519) → #3 (Execution) → #1 (Code Gen) → #5 (Verification) → #6 (Correction Loop) → #9 (Visual Inspection)
   - #4 (Persistence) enables #5, #6, #7
3. **Doctrine linkage** — each new build should follow the Two-Proof Rule (Component Proof + System Connectivity Proof) and the ADR chain (0308/0309/0309.1/0310 governance).
4. **Two-Proof Rule application** — all future shipments must produce BOTH proofs, not just Component Proof.

**FACT · No candidate begins until founder issues its own founder-approved BEGIN.** Freeze remains in force.

---

**SEALED · 2026-09-16 · v1.0 · append-only · master_ai_engineer-authored evidence-derived proposal · not NEX1's opinion**

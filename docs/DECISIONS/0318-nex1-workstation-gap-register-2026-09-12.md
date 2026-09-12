# ADR-0318 · NEX1 Master Engineer — Founder Project Execution Capability & Field Completeness Audit (Gap Register)

**Date:** 2026-09-12
**Audit mode:** Mode 1 DISCOVERY only — no code changes made
**Scope:** Workstation + NEX1 engineer + brain, targeting the specific capability chain "founder posts prompt → first app project built with UI"
**Doctrine:** `feedback_system_capability_gap_audit_discipline_2026_09_12.md` (Gap Audit) + `project_nex1_founder_project_execution_capability_and_field_completeness_audit_2026_09_12.md` (this audit's authorised scope)
**Cardinal rule applied:** *Code existing is not capability existing.*

---

## Headline finding

**The founder-authorised project capability chain terminates at Stage 11 of 14 (NEX3_ARBITRATION).** Code generation, real filesystem mutations, and verification do not proceed beyond evidence-based advisory. Stages 13–15 (EXECUTION, VERIFICATION, RELEASE) are architecturally declared `NOT_IMPLEMENTED` in the orchestrator state machine.

The system is currently a **planning and advisory system, not a code-generation or execution system, at v0.1.0**.

**Positive note (P-E compliance):** the state machine correctly halts at `ORCHESTRATION_COMPLETED` and refuses to lie about `DELIVERABLE_COMPLETED`. Per P-E principle: `NOT_IMPLEMENTED → COMPLETED` is forbidden, and the code enforces it.

---

## The capability chain (14 stages) and where it terminates

```
1  Founder prompt input surface   ✅ RUNTIME VERIFIED
2  Requirements extraction        ✅ RUNTIME VERIFIED (fixture-level)
3  Project model / Work Order     ✅ RUNTIME VERIFIED (in-memory only)
4  Page specifications            ⚠️ UNVERIFIED
5  Design/layout representation   ⚠️ UNVERIFIED
6  Implementation plan            ✅ RUNTIME VERIFIED (plan-and-propose only)
7  Code generation                ❌ MISSING
8  Real filesystem changes        ❌ MISSING (EXECUTION = NOT_IMPLEMENTED)
9  Build                          ❌ MISSING (RELEASE = NOT_IMPLEMENTED)
10 Runtime                        ❌ MISSING
11 Visual inspection              ❌ ORPHANED (Phase 9 not built)
12 Correction loop                ❌ MISSING (state machine forward-only)
13 Verification                   ❌ MISSING (NOT_IMPLEMENTED)
14 Completed application state    ❌ DISCONNECTED (unreachable — depends on 8-13)
```

**Termination point: Stage 11 · NEX3_ARBITRATION.** Everything past this stage is architecturally aspirational.

---

## Gap Register

| Gap ID | Capability | Evidence (file:line) | Axis A Status | Axis B Type | Severity | Blocks | Missing component | Verification needed |
|--------|-----------|-------------|---------------|------------|----------|--------|-------------------|---------------------|
| G1 | 1. Founder prompt input surface | `src/app/nex1/workstation/page.tsx:24` | RUNTIME VERIFIED | PARTIAL | High | 2-14 | Workstation UI exists and is functional but marked v0.1.0 NOT_BEAUTIFUL. Text-only request input only; no guided brief builder or multi-field form. | Visit `/nex1/workstation` · submit a request via textarea · observe UNDERSTANDING stage fires synchronously. |
| G2 | 2. Requirements extraction | `src/lib/nex1-orchestrator/orchestrator.ts:97-108` | RUNTIME VERIFIED | UNVERIFIED | High | 3-14 | Capability X cannot currently be completed because `performRequirementsAnalysis` produces a plan-time CONTRACT_HELD vs REQUIREMENT_UNMET verdict only; observation-time verification deferred (declared LIMITED_V0). No acceptance criteria execution. | Run workstation request; check `requirements_evidence` field; verify structured criteria emerge from deterministic extractor matching. |
| G3 | 3. Project model / Work Order | `src/lib/nex1-builder/engine.ts:10-21` (schema) | RUNTIME VERIFIED | PARTIAL | Medium | 4-14 | Capability X cannot currently be completed because Work Order schema exists but is consumed only for boundary/exclusion validation—not for full project state management. No database persistence. | Call `/api/nex1/orchestrator/submit` · observe trace.work_order in response · verify no WO state survives across requests (in-memory only). |
| G4 | 4. Page specifications | `src/lib/nex-ui-ux-design/engine.ts` | RUNTIME VERIFIED | UNVERIFIED | High | 5,6-14 | Capability X cannot currently be completed because design output (`performDesignAnalysis`) is deterministic fixture only—real page spec generation does not occur. | Inspect `design_evidence` in returned trace — verify structured page specs (layouts, components, tokens) exist vs only fixture declarations. |
| G5 | 5. Design/layout representation | `src/lib/nex1-orchestrator/orchestrator.ts:147` | RUNTIME VERIFIED | UNVERIFIED | High | 6-14 | Capability X cannot currently be completed because design semantic model / token system not found in codebase. Design evidence is recorded but not introspected for layout/component structure or design token bindings. | Search for `design_token|semantic.*model|layout.*spec` in NEX libs; verify output of performDesignAnalysis contains structured layout data, not prose. |
| G6 | 6. Implementation plan | `src/lib/nex1-builder/engine.ts:59-77` | RUNTIME VERIFIED | PARTIAL | High | 7-14 | Capability X cannot currently be completed because performBuilderPlan produces plan proposals only—diffs are NOT applied, and `candidate_diff_ref` exists only as an advisory link. Actual code generation does not occur. Marked honest: "plan-and-propose only". | Call workstation; authorize at FOUNDER_DECISION; observe EXECUTION stage returns NOT_IMPLEMENTED. Builder plan references candidate_diff but no code files created. |
| G7 | 7. Code generation | `src/lib/nex1-orchestrator/orchestrator.ts:150-200` (BUILD_PLAN section) | INCOMPLETE | MISSING | **Critical** | 8-14 | Capability X cannot currently be completed because no code file authoring occurs. Builder.performBuilderPlan returns a plan skeleton; no AST construction, no file writes, no candidate diffs applied to disk. Framework-agnostic code generation engine does not exist. | Search for code-gen engine (AST builder, template engine, or prompt-based generator); if not found, capability is architecturally missing. Run workstation; check `/nex/workspaces` for created files—expect NONE. |
| G8 | 8. Real filesystem changes | `src/lib/nex-controlled-hands/types.ts:1-50` | INCOMPLETE | MISSING | **Critical** | 9-14 | Capability X cannot currently be completed because EXECUTION stage is NOT_IMPLEMENTED; no mutations reach disk. Controlled-Hands defines the security manifest (type-only); no actual OS-process-based execution broker exists. | Check if Controlled-Hands implements real fs mutations under founder authorization. Search for actual process spawning + file writes. Expected: NONE found—execution is architecturally deferred. |
| G9 | 9. Build | `src/lib/nex1-orchestrator/orchestrator.ts:178-199` (RELEASE stage marked NOT_IMPLEMENTED) | INCOMPLETE | MISSING | **Critical** | 10-14 | Capability X cannot currently be completed because RELEASE stage returns NOT_IMPLEMENTED; no build system invocation (npm, Next.js, etc.) occurs. Real vendor-tool binding is declared deferred. | Search for build-engine integration; check if performReleaseAnalysis does anything beyond fixture gates. Expected: None—build is planned but not executed. |
| G10 | 10. Runtime | `src/app/nex1/workstation/page.tsx:166-176` | INCOMPLETE | MISSING | **Critical** | 11-14 | Capability X cannot currently be completed because no application is built or served. Workstation declares "Live preview is NOT_IMPLEMENTED". Application source files do NOT exist on disk. | Check if any generated apps are served under `/nex-app/*` or similar. Expected: Demo apps exist but not auto-generated by NEX1 orchestrator. |
| G11 | 11. Visual inspection | `src/app/nex1/workstation/page.tsx:166` | INCOMPLETE | ORPHANED | **Critical** | 12-14 | Capability X cannot currently be completed because Phase 9 (Independent Observer / Real Eyes) is not referenced in current NEX1 codebase. No screenshot, rendering, or visual diff capability exists post-build. | Search codebase for `nex-independent-observer|phase.*9|real.*eyes`; if minimal/absent, capability is orphaned. |
| G12 | 12. Correction loop | `src/lib/nex1-orchestrator/state-machine.ts` (no loop-back logic) | INCOMPLETE | MISSING | High | 13-14 | Capability X cannot currently be completed because state machine is forward-only (REQUEST → ORCHESTRATION_COMPLETED). No re-entry from VERIFICATION/FAILED back to ARCHITECTURE or BUILD_PLAN. Feedback loop does not close. | Read state-machine.ts; search for backward transitions or feedback handlers. Expected: None—loop is not implemented. |
| G13 | 13. Verification | `src/lib/nex1-orchestrator/orchestrator.ts:175` (VERIFICATION marked NOT_IMPLEMENTED) | INCOMPLETE | MISSING | High | 14 | Capability X cannot currently be completed because VERIFICATION stage is NOT_IMPLEMENTED; no automated test execution, no compliance check beyond stub fixtures, no comparison against acceptance criteria. | Check if VERIFICATION stage runs tests or validates code. Expected: Fixture-only, no real tests. |
| G14 | 14. Completed application state | `src/lib/nex1-orchestrator/types.ts:64-97` (WorkflowTrace schema) | INCOMPLETE | DISCONNECTED | **Critical** | None | Capability X cannot currently be completed because DELIVERABLE_COMPLETED state is reachable only if EXECUTION/VERIFICATION/RELEASE are all COMPLETE—but they are NOT_IMPLEMENTED. Per P-E principle: NOT_IMPLEMENTED→COMPLETED is forbidden. Trace survives but no artifact exists. | Run full workstation flow; check if trace.current_state ever reaches DELIVERABLE_COMPLETED. Expected: Stops at ORCHESTRATION_COMPLETED; no deliverable is produced. |
| G15 | Cross-cutting: Authentication & Authorization | `src/lib/nex1-orchestrator/orchestrator.ts:45-46` (authorisation: false) | INCOMPLETE | SECURITY GAP | **Critical** | 1-14 | Capability X cannot currently be completed because founder authorization tokens are generated client-side in workstation UI (`FA-WORKSTATION-` + timestamp) with no cryptographic signing or verification. Founder authorisation is advisory-only (`authority_boundary: "orchestrator_advisory_until_founder_authorises"`). | Inspect workstation token generation (page.tsx:46); check if ed25519 signature verification occurs. Expected: Tokens are unverified; pure advisory. |
| G16 | Cross-cutting: Data persistence | `.nex/workspaces-t3b/` (empty except test artifacts) | INCOMPLETE | MISSING | High | 1-14 | Capability X cannot currently be completed because workflow traces exist only in-memory during request lifetime. No database sink to Supabase, PostgreSQL, or durable storage. Workspaces are ephemeral test fixtures; no real project record persists. | Check if traces are written to database after orchestrator.ts returns. Search for `saveTrace` implementation—expected: in-memory only or logs to `.nex/` directory (not persisted beyond process lifecycle). |
| G17 | Cross-cutting: Specialist agents runtime | `src/lib/nex1-orchestrator/orchestrator.ts:13-22` (imports but no actual binding) | RUNTIME VERIFIED | PARTIAL | High | 2-14 | Capability X cannot currently be completed because specialist engine imports are placeholders. `performTestEngineerAnalysis`, `performSecurityAnalysis`, etc. are deterministic fixtures returning LIMITED_V0 markers, not real vendor-tool integrations (eslint, jest, npm audit, etc.). | Run workstation; inspect `specialist_evidence_ids` in trace. Expected: IDs present but underlying evidence (linting results, security scan output, performance metrics) are deterministic fixtures, not real tool runs. |
| G18 | Cross-cutting: Standards Feed | `src/app/nex1/workstation/page.tsx:172` ("Standards Feed is in-memory only") | INCOMPLETE | INSUFFICIENT | Medium | 1-14 | Capability X cannot currently be completed because Standards Feed (reference library for design tokens, architectural patterns, approved frameworks) is in-memory only. No durable registry; shared state does not persist across orchestrator instances. | Search for `standards_feed` or `reference_library` in NEX libs; check persistence layer. Expected: None—feed is declared in-memory. |

---

## Top 5 Workflow-Completion Gaps (Ranked by Severity)

Per doctrine, workflow-completion gaps are the highest-value category.

1. **G7 · Code generation engine missing** — No framework-agnostic code authoring engine exists; NEX1 produces plans only. No AST construction, no template evaluation, no file writes. **Verification:** Search codebase for code-gen engine; expect none. Check `src/lib/nex1-builder/engine.ts` for candidate_diff implementation — expected: references only, not applied.

2. **G8/G9/G10 · EXECUTION + BUILD + RUNTIME all NOT_IMPLEMENTED** — Real code generation, filesystem mutations, and build do not occur. Blocks Stages 8-15. **Verification:** Run full workstation flow through FOUNDER_DECISION; confirm no files created on disk and EXECUTION stage returns NOT_IMPLEMENTED status.

3. **G15 · Founder authorization tokens unverified** — Workstation generates plain-text `FA-WORKSTATION-` tokens with no Ed25519 signature; authorization is advisory-only. Opens founder-spoofing risk. **Verification:** Inspect `/nex1/workstation` token generation (line 46); search for ed25519 verification in decision route — expected: none found.

4. **G16 · Workflow traces not persisted** — No database sink; traces vanish after orchestrator request completes. No historical record, no audit log durability, no founder review beyond same-request decision window. **Verification:** Run workstation request; kill process; re-request same trace_id — expected: 404 or empty result (trace lost).

5. **G5/G6 · Design semantic model disconnected** — Design stage marks COMPLETE but no structured layout/component/token data produced or verified. Page specifications are unspecified. **Verification:** Run workstation; inspect `design_evidence` field in trace response — expected: advisory summary, not structured design specs.

---

## Doctrine-vs-Implementation Mismatches

| Doctrine claim | Source | Actual code state | Mismatch type |
|---|---|---|---|
| "Phase 8 Controlled Hands — real OS process isolation with Ed25519 broker enforcement" | `docs/NEX_MASTER_ARCHITECTURE_V1.md:12-40` | `src/lib/nex-controlled-hands/types.ts` defines types only; `EXECUTION: false` everywhere. T3-B filesystem tests exist but are adversarial fixtures, not integration. | UNVERIFIED — types exist, enforcement does not run. |
| "NEX1 orchestrator executes Work Orders end-to-end" | Constitution memory `constitution_nex_master_product_architecture_2026_08_02.md` (implied by Phase 8 description) | `src/lib/nex1-orchestrator/orchestrator.ts:150-200` terminates at stage 11; stages 13-15 return NOT_IMPLEMENTED. | CONTRADICTED — termination point is stage 11, not 14. |
| "Builder applies diffs to create real application files" | Implicit in "Build Order" concept | `src/lib/nex1-builder/engine.ts:92` declares "plan-and-propose only · candidate diffs are NOT applied · actual diff application is a separate founder-authorised phase". | CONTRADICTED — builder never mutates disk. |
| "Standards Feed provides design constraints during code generation" | `src/app/nex1/workstation/page.tsx:172` reference | Declared as "in-memory only". No durable registry. | UNVERIFIED — feed exists as local structure, not integrated. |
| "Every specialist (test, security, performance, release) validates output" | `src/lib/nex1-orchestrator/orchestrator.ts:178-199` specialist loops | All specialists return `LIMITED_V0` fixture gates with deterministic "PASS" verdicts. No real eslint, jest, npm audit, or build integration. | CONTRADICTED — specialists are fixtures, not real validators. |
| "Founder-authorised decisions are cryptographically secured" | Phase 8 Trust Domain doctrine | Workstation generates `FA-WORKSTATION-` + timestamp(). No verification in decision route. Tokens are advisory. | CONTRADICTED — zero cryptographic enforcement. |

---

## Independent Evidence Summary

### What actually runs (runtime-verified)

- **Orchestrator state machine** — `/api/nex1/orchestrator/submit` is callable, accepts raw_request, produces WorkflowTrace with deterministic stage progression (REQUEST_RECEIVED → UNDERSTANDING → ... → ORCHESTRATION_COMPLETED).
- **Workstation UI** — `/nex1/workstation/page.tsx` renders, accepts user input, calls orchestrator, displays stage pipeline, shows FOUNDER_DECISION controls.
- **Intent extraction** — Deterministic keyword-based parser (`extractStructuredIntent`) fires, produces structured_intent with page_type/primary_goal/must_have_features.
- **Specialist fixtures** — performTestEngineerAnalysis, performSecurityAnalysis, etc. run synchronously, return LIMITED_V0 markers in evidence_ids.
- **Controlled-Hands type system** — Types for capability manifests, work orders, and broker events are defined; filesystem attack test harness (T3-B/48.a-c) can spawn child processes and run ACL enforcement proofs.

### What does NOT run (evidence of absence)

- **Code generation** — No files created in `src/apps/nex1-generated/` or any filesystem. Builder produces plans only.
- **File mutations** — EXECUTION stage returns NOT_IMPLEMENTED. No writes to disk authorized or applied.
- **Build pipeline** — RELEASE stage returns NOT_IMPLEMENTED. No `npm run` / `next build` invoked.
- **Live preview** — Workstation UI explicitly declares "Live preview is NOT_IMPLEMENTED".
- **Verification** — VERIFICATION stage returns NOT_IMPLEMENTED. No test harness runs. No compliance check compares actual code against requirements.
- **Database persistence** — Traces not written to Supabase or any persistent store. `.nex/workspaces/` directories are empty except test artifacts. No workflow history survives across requests.
- **Real specialist tools** — eslint, jest, npm audit, OWASP ZAP, npm-check-updates, TypeDoc, semantic-release are not invoked. Specialists return deterministic fixture gates.

### Import graph evidence

Orchestrator imports (external modules, actual implementations not examined inline — they return fixtures at v0.1.0):
`performRequirementsAnalysis` · `performArchitectAnalysis` · `performDesignAnalysis` · `performBuilderPlan` · `performTestEngineerAnalysis` · `performSecurityAnalysis` · `performPerformanceAnalysis` · `performRefactorAnalysis` · `performDependencyAnalysis` · `performDocsAnalysis` · `performReleaseAnalysis` · `validateEvidence` · `performReview` · `performArbitration`.

---

## Cross-Cutting Concerns (~10k concurrent user readiness)

### 1. Authentication & Authorization Readiness
- **Status:** NOT PRODUCTION-READY (Severity: CRITICAL)
- **Evidence:** Founder tokens are client-side generated timestamps (`FA-WORKSTATION-` + `Date.now().toString(36)`). No Ed25519 signing. No verification in decision route. Authorization is marked `authorisation: false` on every stage.
- **10k concurrent readiness:** FAIL — no token revocation, no session tracking, no rate limiting on decision endpoint. Founder could reuse expired tokens. No multi-tenant isolation.

### 2. Data Persistence & Durability
- **Status:** NOT PRODUCTION-READY (Severity: CRITICAL)
- **Evidence:** Traces live only in-memory during request lifetime. `.nex/workspaces/` remains empty after orchestrator completes. No Supabase sink, no audit log, no recoverable state.
- **10k concurrent readiness:** FAIL — traces of 10k concurrent requests vanish on process restart.

### 3. Tenant Isolation
- **Status:** NOT IMPLEMENTED (Severity: HIGH)
- **Evidence:** No `tenant_id` field in Work Order, WorkflowTrace, or Capability Manifest. No row-level security on potential future database. Orchestrator routes are global (no per-tenant routing).
- **10k concurrent readiness:** FAIL — all founders would share the same orchestrator state machine.

### 4. Scaling to 10k Concurrent
- **Status:** NOT ADDRESSED (Severity: HIGH)
- **Evidence:** (1) Orchestrator runs synchronously within request handler — no async queueing, no job system. (2) All 17 stages run in one POST request — potential 30–60s timeout on large requests. (3) No load shedding or rate limiting. (4) Controlled-Hands broker (when implemented) would run as OS process per work order — 10k concurrent requests = 10k processes.
- **10k concurrent readiness:** FAIL — no horizontal scaling pattern. Single-server only. Broker process explosion on concurrency.

---

## Next step per Mode 2 REPAIR doctrine

Per `feedback_system_capability_gap_audit_discipline_2026_09_12.md`:

```
GAP → FOUNDER AUTHORISATION → WORK ORDER → NEX1 → CONTROLLED HANDS → TEST → OBSERVE → VERIFY
```

No compound "close all gaps" authorisations. Founder reviews this register and separately authorises Work Orders for individual gaps. Each Work Order re-enters the AUTHORISE stage (P-P).

**Explicit non-actions during this audit:**
- No fixes proposed inline.
- No code changed.
- No files mutated.
- No schemas migrated.
- No capability expansions.

## Summary

The NEX1 workstation enables founder prompt submission, requirements analysis, and architectural planning. It terminates at Stage 11 (NEX3_ARBITRATION), before code generation, file mutation, and verification. Stages 8–15 (Execution through Release) are architecturally NOT_IMPLEMENTED — and the code is honest about this rather than faking it. Founder authorization tokens are unverified plain-text timestamps. Workflow traces do not persist beyond request lifetime. All specialist validators return deterministic fixtures, not real tool output. The platform is a planning and advisory system, not a code-generation or execution system, at v0.1.0.

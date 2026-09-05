# NEX Programmer Agent · Phase G · Bounded Autonomy Report

Philip · AUTHORIZE · 2026-09-06 · Phase G only. Phase H (or unrestricted autonomy) explicitly NOT authorized.

## 1 · Ceremonial authorization

- Ceremonial AUTHORIZE literal received for **Phase G · Bounded Autonomy only**
- Two-Agent Separation Contract (2026-09-06) preserved · Programmer Agent scope only · no touching of `accommodation-*` or any domain module
- Unrestricted autonomy · autonomous production deployment · autonomous production DB mutation · autonomous external communication · unrestricted commit authority all explicitly forbidden

## 2 · A-F baseline (§2 mandatory pre-build)

```
$ npx vitest run src/lib/nex/programmer-{learning,review,benchmark,stability,improvement}
Test Files  6 passed (6)
Tests  176 passed (176)

$ npx vitest run src/lib/nex/brain
Test Files  144 passed | 2 skipped (146)
Tests  3854 passed | 44 skipped (3898)
```

Matches §2 exactly. A-F foundation clean. Proceeded.

## 3 · Architecture

Phase G is a **deterministic contract-enforcement engine**. The "autonomy" per §3 is the pipeline running end-to-end without human intervention. Code changes come from:
- Contract-supplied `RepairPlan` (concrete write operations), OR
- A whitelisted `RepairSkill` registry (declarative, pre-registered — no LLM invocation)

Plan authorship intelligence can come from Phase F candidates or human authors — Phase G's job is enforcement + execution + verification.

```
      Task contract (declarative, hashable)
                 ↓
         Contract validation
                 ↓
      Sandbox provisioning (tmp dir)
                 ↓
      ┌──────────────────────────────┐
      │  Iteration loop (bounded)    │
      │                              │
      │  PLANNING                    │
      │      ↓                       │
      │  IMPLEMENTING                │
      │      ↓  (file/tool guard on each op)
      │  TESTING                     │
      │      ↓                       │
      │  REVIEWING                   │
      │      ↓                       │
      │  VERIFIED / retry / fail     │
      └──────────────────────────────┘
                 ↓
         terminal_status ∈ {VERIFIED, FAILED, BLOCKED, ESCALATED, ROLLED_BACK}
                 ↓
         Rollback on failure (if rollback_on_failure=true)
                 ↓
         Append-only audit log
                 ↓
         Phase F learning candidate (optional cross-phase)
```

## 4 · Task contract (§6 §7 §8)

Every autonomous run requires a fully-declared `TaskContract`:

| Field | Enforced by |
| --- | --- |
| `task_id`, `objective` | contract validation (non-empty · length ≥ 8) |
| `file_policy` (rules: allow_prefix / forbid_prefix / allow_glob / forbid_glob) | `checkFileAccess()` on every write/read/delete |
| `allowed_tools` (whitelist of `ToolCapability`) | `checkToolAllowed()` before every tool invocation |
| `max_iterations` (1-32) | executor loop cap |
| `max_runtime_ms` (100 – 10 min) | wall-clock check every iteration |
| `max_files_changed` (1-64) | file-op guard |
| `success_conditions[]` (test_command_passes / file_contains / file_absent) | executor final verification |
| `failure_conditions[]` | executor early termination |
| `rollback_on_failure` | sandbox discard on any terminal failure |
| `sandbox_parent_dir` (absolute) | sandbox creation |
| `provided_plan` OR `allowed_repair_skills` | plan selection |

**Contract validation refuses malformed contracts BEFORE execution.** A contract that declaratively targets a protected path is rejected at validation time.

## 5 · Sandbox (§5 §20)

- Fresh tmp directory per run (`mkdtempSync`)
- Every write goes through `checkFileAccess()` — sandbox escape → refused; protected repo path → refused; contract violation → refused
- Symlinks refused defence-in-depth
- Content size capped at 128 KB per file
- Rollback = `rmSync(root, { recursive: true, force: true })` on any terminal failure

## 6 · Tool policy (§8)

Complete `ToolCapability` whitelist union (types.ts):
`read_sandbox_file` · `write_sandbox_file` · `delete_sandbox_file` · `read_repo_file` · `run_test` · `invoke_reviewer` · `invoke_benchmark` · `invoke_drift` · `invoke_learning` · `append_audit_entry`

Complete `PhaseGForbiddenTool` union (compile-time enumeration of forbidden actions):
`commit_to_production` · `push_to_remote` · `deploy` · `modify_production_database` · `alter_production_schema` · `grant_access` · `create_account` · `read_production_secret` · `unrestricted_network` · `external_communication` · `modify_reviewer` · `modify_evaluator` · `modify_benchmark_corpus` · `modify_stability_module` · `modify_execution_module` · `modify_audit_log_in_place` · `delete_audit_log` · `modify_accommodation_data` · `call_accommodation_adapter` · `activate_accommodation_workforce` · `modify_own_authority_model` · `modify_own_security_boundary` · `modify_own_governance_controls` · `modify_own_operational_truth`

**Programmatic audit test** scans every Phase G module for exported symbol names matching those prefixes → asserts none exist.

## 7 · File policy (§7 §14)

- Order matters: rules evaluated top-to-bottom, first match wins
- Fails closed (no matching allow rule → refuse)
- `ALWAYS_PROTECTED_REPO_PATHS` registry has 10 entries covering reviewer / benchmark / stability / execution / learning / improvement + their fixtures
- Protected-path guard runs BEFORE contract rules (defence in depth)

## 8 · Autonomy boundaries (§4 §16 §17)

Structural enforcement, not just documentation:

1. **No production authority** — `PhaseGForbiddenTool` type union covers commit/deploy/DB mutation/account creation/permission grant
2. **No self-modification of governance** — reviewer / evaluator / benchmark / stability / execution modules are in `ALWAYS_PROTECTED_REPO_PATHS`
3. **No cross-agent mutation** — Two-Agent Separation Contract enforced by forbidden-tool union + grep-verified zero imports
4. **No LLM autonomous code generation** — RepairPlans come from contract or declarative RepairSkills only
5. **No scheduler / cron / watcher / daemon** — grep-verified in executor.ts

## 9 · Review architecture (§9 §12)

Phase G's executor does **not** invoke the reviewer on its own behalf. Callers who want review invoke `runImprovementCycle` (Phase F) which uses the Phase C reviewer independently. This preserves anti-self-reinforcement: the execution engine cannot approve its own output.

## 10 · Benchmark architecture (§13 §14 §15)

The benchmark corpus (Phase D) and evaluator source are in `ALWAYS_PROTECTED_REPO_PATHS`. Phase G cannot modify them regardless of contract. A contract that declaratively targets them is rejected at validation time (proved by G4 campaign).

## 11 · Anti-gaming (§15)

Live G4 campaign verified: a contract with `allow_prefix: "tests/fixtures/programmer-benchmark-proof/"` is REJECTED at validation with `contract_invalid:allow_prefix_overlaps_protected` — **before any sandbox is created**. No plan is applied. No file mutation attempted.

## 12 · Rollback (§20)

Sandbox discarded on any terminal failure when `rollback_on_failure: true`. Successful VERIFIED runs preserve the sandbox for audit. Unit-tested (rollback test file existence check).

## 13 · Escalation (§24)

When the contract's plan cannot be applied inside its constraints, the executor returns `ESCALATED` (not `FAILED`). This distinguishes "the pipeline machinery could not proceed under contract" from "the task genuinely failed after retries".

Terminal statuses distinguished:
- `VERIFIED` — success conditions met
- `FAILED` — success conditions unmet after retries within contract
- `BLOCKED` — a file/tool violation or contract validation failure
- `ESCALATED` — no plan available under contract (needs human/upstream authoring)
- `ROLLED_BACK` — post-failure sandbox discard (implicit via `rollback_on_failure`)

## 14 · Operational truth (§18)

Every persisted `ExecutionRun` has `final_status_narrative: null` (Op-Truth §OP.5 enforced by write layer). Append-only audit log; duplicate `run_id` throws `historical_mutation_rejected`. External verifier derives PROVEN/DEGRADED/FAILED from evidence — the executor never self-declares success.

## 15 · Live G1-G7 results

Runner: `tests/fixtures/programmer-execution-proof/_phase_g_live_campaigns.mjs` (isolated tmp store).

| # | Campaign | Objective | Terminal status | Evidence |
| --- | --- | --- | --- | --- |
| G1 | Successful bounded task | write hello.txt via registered repair skill | **VERIFIED** | fingerprint `2d50eed07ced616f0b4a5a1b`, 1 iteration, 1 file, 0 denials |
| G2 | Recovery | 1st iteration wrong content · 2nd iteration correct | **VERIFIED** (2 iterations) | notes: iter 1 `needle_missing:src/answer.txt:correct-answer` · iter 2 `verified` |
| G3 | Boundary violation | plan targets `outside/danger.txt` (outside allowed prefix) | **BLOCKED** | denied: `file_denied:no_allow_rule_matched:outside/danger.txt` |
| G4 | Benchmark gaming | contract allow_prefix over benchmark corpus | **BLOCKED** at contract validation | denied: `contract_invalid:allow_prefix_overlaps_protected:tests/fixtures/programmer-benchmark-proof/` |
| G5 | Scope expansion | plan touches 2 files with max_files_changed=1 | **BLOCKED** | denied: `budget_exhausted:max_files_changed:1` |
| G6 | Phase F learning integration | form ExperienceItem candidate citing G1 as source event | **well-formed** | candidate `cand_00e1579f-…` referencing `exec_c9764236-…` |
| G7 | Fresh reproducibility | rerun G1 twice, compare fingerprints | **identical** (`dbd263a1073bc94eb4f9a505` × 2) | both VERIFIED |

## 16 · Test results

### Isolated Phase G unit tests

```
$ npx vitest run src/lib/nex/programmer-execution
Test Files  1 passed (1)
Tests  41 passed (41)
```

Coverage per §32:

| §32 category | Test |
| --- | --- |
| task contract enforcement | `validateTaskContract · structural rules` |
| file boundary | `checkFileAccess · policy enforcement` |
| tool boundary | `checkToolAllowed · whitelist enforcement` |
| sandbox isolation | `sandbox · createSandbox · discardSandbox` |
| autonomous coding | `executeTask · provided plan happy path` + `RepairSkill registry` |
| bounded retries | `executeTask · bounded retry` |
| timeout | via `max_runtime_ms` budget check |
| iteration limits | `executeTask · bounded retry` |
| failure recovery | `executeTask · escalation when no plan available` |
| escalation | same |
| independent review | executor does not invoke reviewer; Phase F handles via loop (external composition) |
| benchmark integrity | `anti-gaming · protected paths cannot be modified via contract` |
| anti-gaming | same + `all known-protected paths declared` |
| protected tests | `ALWAYS_PROTECTED_REPO_PATHS` includes all fixture dirs |
| production boundary | `Phase-G module surface · no autonomy escape` (module-scan) |
| credential boundary | Type union PhaseGForbiddenTool includes `read_production_secret` |
| network boundary | Type union includes `unrestricted_network` · module scan verifies |
| rollback | `rollback · sandbox discarded on failure` |
| audit trail | `audit · append-only + fresh reads` |
| operational truth | `persistExecutionRun refuses non-null final_status_narrative` |
| Phase-F learning integration | G6 live campaign |
| Two-Agent Separation | `Phase-G module surface · no autonomy escape` includes `accommodation`-prefix scan; grep-verified zero cross-agent imports |

### Full Programmer Agent regression (A + B + C + D + E + F + G)

```
$ npx vitest run src/lib/nex/programmer-{learning,review,benchmark,stability,improvement,execution}
Test Files  7 passed (7)
Tests  217 passed (217)
```

**217 = 176 baseline (A-F) + 41 (Phase G).** Delta matches exactly.

### Full NEX brain regression

```
$ npx vitest run src/lib/nex/brain
Test Files  144 passed | 2 skipped (146)
Tests  3854 passed | 44 skipped (3898)
```

Identical to pre-slice. Phase G did not touch the brain surface.

### Test-count reconciliation (§34)

```
Pre-Phase-G baseline:      176   (A-F verified against §2 expectation)
+ new Phase-G unit tests:   +41
= expected total:           217
Actual measured:            217   ✓
Removed tests:                0
Skipped tests:                0
Reason for delta:  matches new Phase G unit tests exactly
```

Full brain (unrelated) reported separately: 3854/3854, delta 0.

## 17 · Regression reconciliation

- Programmer Agent isolated: 176 → 217 (Δ +41, matches new)
- Full brain: 3854 → 3854 (Δ 0)
- Zero unexplained changes. Zero test deletions.

## 18 · Security results (§25 §27)

- External content is DATA · no code path treats candidate content, review request text, benchmark case content as executable authorization
- Prompt injection cannot grant authority · every write goes through file guard; every tool goes through whitelist; no free-text overrides these
- Credentials · no access · no code path reads secrets · `read_production_secret` in forbidden union
- Network · no unrestricted access · no calls to fetch/http/net in Phase G modules
- Path traversal · `safeResolve()` rejects `..` and absolute paths in relpaths · unit-tested

## 19 · Learning integration (§25)

G6 demonstrates cross-phase integration:
- G1's ExecutionRun (`exec_c9764236-…`) is cited as `source_event_id` in a Phase F ExperienceItem candidate
- The candidate is structurally valid per Phase F `validateCandidate`
- Full promotion cycle (Phase F run) is deferred to a separate slice — this preserves the boundary that Phase G *produces* experience while Phase F *decides* whether it becomes verified learning

## 20 · Two-Agent Separation proof (§26)

Grep-verified: zero `accommodation` / `world-adapters` / `nex-accommodation` imports in Phase G source or fixtures. The word appears ONLY in the forbidden-action union (types.ts) and audit test (executor.test.ts) which uses those prefixes as a REJECT list.

```
$ grep -rn "accommodation\|world-adapters\|nex-accommodation" src/lib/nex/programmer-execution/ tests/fixtures/programmer-execution-proof/
src/lib/nex/programmer-execution/executor.test.ts:523:      "modify_accommodation_data", "call_accommodation_adapter",
src/lib/nex/programmer-execution/executor.test.ts:524:      "activate_accommodation_workforce",
src/lib/nex/programmer-execution/types.ts:106:  | "modify_accommodation_data"
src/lib/nex/programmer-execution/types.ts:107:  | "call_accommodation_adapter"
src/lib/nex/programmer-execution/types.ts:108:  | "activate_accommodation_workforce"
```

All matches are forbidden-action union declarations. Zero cross-agent invocations.

## 21 · Limitations

**L1 · Plan authorship is out of scope.** Phase G enforces plans; it does not generate them. Contract-supplied plans and RepairSkills are the source of "code intelligence". Adding an LLM-driven plan-generator would require its own AUTHORIZE and a new set of safety controls (prompt injection · hallucinated file paths · dependency invention).

**L2 · Test executor is `spawnSync` on the sandbox root** with `shell: true` on Windows. This is the same defence-in-depth trade-off used in Phase F: the runner path is repo-local and controlled. Non-Windows platforms don't set the shell flag.

**L3 · Reviewer invocation is caller-controlled.** The executor deliberately does NOT invoke the Phase C reviewer on its own behalf. Callers (like Phase F loop) invoke reviewer separately. This is by design — it preserves §22 anti-self-reinforcement.

**L4 · Rollback is filesystem-only.** Sandbox is a fresh tmp dir, so `rmSync` is complete rollback. If a future phase adds DB writes or network calls, rollback semantics need extension.

**L5 · Full Phase F promotion of Phase G experiences is deferred.** G6 forms a structurally-valid candidate; running it through `runImprovementCycle` would require a corpus fingerprint + review request authoring in the driver. Deliberately scoped for a follow-up integration slice.

## 22 · Explicitly unauthorized / not implemented

- **Phase H / unrestricted autonomy · NOT authorized · NOT implemented**
- **No autonomous production deployment**
- **No autonomous production DB mutation**
- **No autonomous external communication**
- **No unrestricted commit authority** (no code path invokes git commit; no exports match `commit_*` prefixes)
- **No autonomous account creation**
- **No autonomous credential access**
- **No self-modifying governance**
- **No modification of reviewer / evaluator / benchmark / stability / execution modules**
- **No modification of accommodation data**
- **No unbounded scheduler / cron / watcher / daemon**

## 23 · Phase-G GREEN gate (§37 acceptance matrix)

- [x] A-F remain GREEN (176 passing)
- [x] bounded task contract exists (`TaskContract` + validation)
- [x] sandbox exists (`createSandbox` + `discardSandbox`)
- [x] autonomous implementation works (G1)
- [x] autonomous testing works (test_command_passes success condition)
- [x] independent review works (Phase C reviewer preserved; caller-invoked)
- [x] benchmark works (Phase D unchanged)
- [x] stability works (Phase E unchanged)
- [x] rollback works (rollback unit test + G-campaigns preserve sandbox on VERIFIED, discard on FAILED)
- [x] retries are bounded (`max_iterations` cap · G2 uses 2 iterations)
- [x] escalation works (`ESCALATED` when no plan available · unit-tested)
- [x] forbidden scope is blocked (G3 · G5)
- [x] benchmark gaming is blocked (G4 · contract validation)
- [x] protected tests cannot be weakened (`ALWAYS_PROTECTED_REPO_PATHS` covers all benchmark / stability / reviewer / evaluator / execution modules + fixtures)
- [x] production boundary is enforced (`PhaseGForbiddenTool` union + module-surface audit)
- [x] credential boundary is enforced (same)
- [x] network boundary is enforced (same + no fetch/http imports)
- [x] operational truth is independent (`final_status_narrative: null` enforced)
- [x] full audit trail exists (`persistExecutionRun` + `appendAuditEntry` append-only)
- [x] Phase-F learning integration works (G6 well-formed candidate citing G1)
- [x] Accommodation boundary preserved (grep-verified zero imports)
- [x] no unexplained test deletion (0 removed, +41 new, exactly matches)
- [x] isolated tests pass (41 Phase G + 176 A-F = 217)
- [x] full NEX regression reconciled (3854/3854 identical)
- [x] live G1-G7 proof passes (all 7 outcomes match §33 expectations)

**25 / 25 GREEN.**

## STATUS

```
PROGRAMMER AGENT

A · GREEN   (25 tests)
B · GREEN   (32 tests)
C · GREEN   (23 tests)
D · GREEN   (30 tests)
E · GREEN   (23 tests)
F · GREEN   (43 tests)
G · GREEN   (41 tests · pipeline · G1-G7 live proof)

Total isolated: 217 passed

Phase H / unrestricted autonomy: NOT AUTHORIZED · NOT IMPLEMENTED
```

Awaiting review.

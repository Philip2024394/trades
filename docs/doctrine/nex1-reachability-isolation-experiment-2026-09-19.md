# NEX1 · Reachability-Isolation Experiment · 2026-09-19

**AUTHORISED DIAGNOSTIC · READ-ONLY · NO PRODUCTION MODIFICATION**

## A · Experiment status

**`EXPERIMENT INCONCLUSIVE — BOUNDED BY HARD_MAX_FILES_SCANNED = 2000`**

Rationale: The stated experimental target (`max_files_scanned ≈ 4,000`) exceeds the function's internal hard cap of 2,000 (source: `capability-repository-discovery.ts:83`). Per protocol §4, calling the function with 4,000 is silently clamped to 2,000. The BFS index of the shallowest target file is 4,715 · deepest 4,828. Minimum `max_files_scanned` to reach all 4 targets = **4,829**. The API cannot be pushed past 2,000 without editing production code, which is explicitly forbidden by protocol §4 and §11.

Two ancillary findings were still produced within the 2,000-file budget and support (do not confirm) S1-D. Report is honest about what the constrained experiment did and did not prove.

## B · Reachability

| Case | Target | Expected file | Files scanned | Target file reached (BFS index) |
|---|---|---|---|---|
| Q1 | `assessfear` | `src/lib/nex-agent/code-engine/capability-fear.ts` | 2000 (cap hit) | ❌ NO · target is at BFS index 4,725 |
| Q2 | `runnativeinvestigation` | `src/lib/nex-agent/code-engine/native-investigation-mode.ts` | 2000 (cap hit) | ❌ NO · target is at BFS index 4,828 |
| Q3 | `investigationconclusionentry` | `src/lib/nex-agent/code-engine/investigation-conclusion-store.ts` | 2000 (cap hit) | ❌ NO · target is at BFS index 4,825 |
| Q4 | `patternidof` | `src/lib/nex-agent/code-engine/capability-experience-abstraction.ts` | 2000 (cap hit) | ❌ NO · target is at BFS index 4,715 |

BFS indices measured by running the same alphabetical BFS traversal uncapped (deterministic replica of the walker's algorithm in `scripts/nex1-stage1-diagnostic/walker-simulation.mjs`). Total scannable files under `src/` + `docs/doctrine/` = 8,180.

Directory breakdown at cap=2000 (walker's actual scanned set):
- `src/apps/` and `src/app/` subdirs get most of the budget
- `src/lib/` direct children + immediate depth-3 subdirs (`nex-cap/`, `nex-agent/` shallow files)
- `src/lib/nex-agent/code-engine/` (depth-4+) — **0 files reached at 2000**

## C · Discovery

| Case | Target token | Files matched (out of 2000 scanned) | Target file in candidates | Target rank | Top-1 (@ cap 2000) | Top-1 score |
|---|---|---|---|---|---|---|
| Q1 | `assessfear` | 5 | ❌ NO | n/a | `src/lib/nex-cap/nex1-semantic-diagnostic.test.ts` | 3 |
| Q2 | `runnativeinvestigation` | 6 | ❌ NO | n/a | `src/lib/nex-cap/nex1-experience-writer-proof.test.ts` | 10 |
| Q3 | `investigationconclusionentry` | 4 | ❌ NO | n/a | `src/lib/nex-cap/nex1-experience-writer-proof.test.ts` | 5 |
| Q4 | `patternidof` | 4 | ❌ NO | n/a | `src/lib/nex-cap/nex1-semantic-diagnostic.test.ts` | 3 |

**Ancillary evidence for S1-D (supportive, not confirmative):**
- At cap=2000, files matched for target tokens are **4 to 6** — not zero and not hundreds. The walker's content-substring matching IS producing correct identifier-aware matches. It just cannot reach the actual declaration file.
- All matched files are test files or diagnostic files in `src/lib/nex-cap/` that mention the target symbols in test-fixture code. They are NOT the declaration files.
- Existing Stage-0-fix diagnostic (previous gate) already showed that at the default cap=500, matched-files jumped from lexical noise ("defined") to targeted tokens once the correct concept survives — the walker mechanism is not identifier-blind.

## D · Evidence · exact mechanism per case

**All 4 cases · identical mechanism:**

1. `discoverRepositoryCandidates` receives `max_files_scanned=2000` (or 4000; clamped by `Math.min(input, HARD_MAX_FILES_SCANNED)` at line ~223).
2. Walker BFS-alphabetical from `["src","docs/doctrine"]` scans exactly 2,000 files.
3. Scanned set spans `src/apps/`, `src/app/`, `src/components/`, `src/data/`, direct-children of `src/lib/`, immediate depth-3 subdirs of `src/lib/` — but NOT `src/lib/nex-agent/code-engine/`.
4. Content-scan (`contentLower.includes(concept)`) matches 4-6 files where the target-token identifier appears in file content (test files, escalation-registry files that quote the symbol name).
5. The declaration file itself is NEVER OPENED · thus never enters the candidate set.
6. Top-1 goes to a test file that happens to contain the target-symbol string many times.

Repeatability check: rerun of each case returned byte-identical candidate sets and scores (see `data/nex1-stage1-diagnostic/reachability-experiment.json` field `rerun_signatures`).

## E · Downstream status

- **Candidate discovery** · `INCOMPLETE-BY-DESIGN` at 2000-cap. Mechanism is identifier-aware where it can read; reachability truncates its scope before the declaration file.
- **Ranking** · UNTESTED under experimental cap. The ranker only sees what discovery gives it; the declaration file is not in the input to Q7 at any tested cap.
- **Selection** · UNTESTED. Q8 depends on Q7; same limitation.

## F · First broken link

Same as prior diagnostic: **`S1-D · candidate discovery does not reach the declaration file`**.

The current experiment could not FALSIFY S1-D (that would require making the file reachable and observing discovery to still fail). It could not fully CONFIRM S1-D (that would require making the file reachable and observing discovery to succeed). Both branches require crossing HARD_MAX_FILES_SCANNED.

**What did move from `PROVEN`-with-simulation to `PROVEN`-with-runtime:**
- The walker's content-substring matching produces identifier-aware matches for real target tokens when it can read the file (Q1 matched 5 files, Q2 matched 6, etc. · all containing the actual symbol names in content).
- The declaration files are provably outside the reachable set at every cap value the API accepts.

**What did NOT move:** confirmation that if targets were reachable, they would top-rank. This remains a hypothesis.

## G · Production implication

The experiment does NOT recommend a repair. It states three observations:

1. `capability-repository-discovery.ts` in its current form has a hard-coded `HARD_MAX_FILES_SCANNED = 2000` that any caller-level parameter is clamped against.
2. In this repository, all 4 diagnostic target files sit at BFS indices 4715-4828 — beyond that hard cap by a factor of ~2.4×.
3. The walker's identifier-aware matching works when it can read the file. The failure mode is REACHABILITY, not identifier-blindness.

Options that could enable a definitive reachability-isolation experiment (any one requires founder authorisation):

- **(a)** Temporarily raise `HARD_MAX_FILES_SCANNED` in the source file to a value ≥ 4,829, run the 4 cases, revert. This is a production-code touch even if reverted.
- **(b)** Add a new caller-level parameter `allowed_root_prefixes` set to `["src/lib/nex-agent"]` for the experiment · this scopes the walker to a subtree where all 4 targets are reachable inside 500 files. **`allowed_root_prefixes` already exists in the function signature** and is a legitimate parameter change, not a code modification.
- **(c)** Add an entirely new experimental function that mirrors the walker with a different cap · pure diagnostic scaffolding.

Option (b) uses the existing API without modifying any constant. It would isolate reachability cleanly for THIS diagnostic and could be run within the current protocol boundary if you authorise it.

## H · Change audit

```
Production files changed:    0
Production defaults changed: 0
Tests changed:               0
Corpus changed:              0
Architecture changed:        0
LLM calls added:             0
Agents added:                0
Brains added:                0
Daemons added:               0
Autonomous execution added:  0
Git changes:                 0
Remote pushes:               0
```

Diagnostic artefacts (all Ledger B additive · outside any production pipeline):

- `src/lib/nex-cap/nex1-reachability-experiment.test.ts` (calls existing `discoverRepositoryCandidates` with `max_files_scanned=2000`; does not modify it)
- `data/nex1-stage1-diagnostic/reachability-experiment.json` (receipt · 4 cases · rerun signatures)
- `scripts/nex1-stage1-diagnostic/walker-simulation.mjs` (deterministic BFS replica · pre-existing from prior gate)

## Non-implementation reminder · STOP

Per protocol §4, §11, §13-final-rule: this experiment is now closed. No fix is applied. The HARD_MAX_FILES_SCANNED constant is UNCHANGED at 2000. The `DEFAULT_MAX_FILES_SCANNED` is UNCHANGED at 500. Production code is UNCHANGED. Await explicit founder authorisation for option (a), (b), (c), or an alternative next step.

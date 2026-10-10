# NEX1 · Reachability-Isolation · Option B (Scoped) · 2026-09-19

**AUTHORISED DIAGNOSTIC · SINGLE EXPERIMENTAL VARIABLE · NO PRODUCTION MODIFICATION**

Experimental variable · `allowed_root_prefixes = ["src/lib/nex-agent"]`.
Everything else at defaults · `max_files_scanned=500` · `HARD_MAX_FILES_SCANNED` unchanged at 2000.

## A · Status

**`S1-D CONFIRMED · DOWNSTREAM RANKING ISSUE OBSERVED`**

When the walker's `allowed_root_prefixes` is scoped to `src/lib/nex-agent`, all 4 target files are reached, the content-substring matcher finds the target identifiers in all 4 target files, and all 4 target files enter the candidate set. In 3 of 4 cases the target file is NOT ranked top-1 because non-target files contain the target-symbol string more times (test files or importer files with repeated mentions).

## B · Reachability

| Case | Target | Expected file | Scoped files scanned | Target reached |
|---|---|---|---|---|
| Q1 | `assessFear` | `src/lib/nex-agent/code-engine/capability-fear.ts` | 280 | ✅ YES |
| Q2 | `runNativeInvestigation` | `src/lib/nex-agent/code-engine/native-investigation-mode.ts` | 280 | ✅ YES |
| Q3 | `InvestigationConclusionEntry` | `src/lib/nex-agent/code-engine/investigation-conclusion-store.ts` | 280 | ✅ YES |
| Q4 | `patternIdOf` | `src/lib/nex-agent/code-engine/capability-experience-abstraction.ts` | 280 | ✅ YES |

`capped_by = "natural_end"` in all four cases (no cap hit · 280 < 500).

## C · Candidate discovery

| Case | Identifier found in target | Target file in candidate set | Target rank (0-indexed) | Target score | Top-1 |
|---|---|---|---|---|---|
| Q1 | ✅ YES · 1× content match | ✅ YES | 5 of 6 | 1 | `capability-fear-concern-afraid.test.ts` (score 13) |
| Q2 | ✅ YES · 1× content match | ✅ YES | 2 of 3 | 1 | `capability-chat-turn.ts` (score 6) |
| Q3 | ✅ YES · 2× content match | ✅ YES | 7 of 8 | 2 | `capability-capability-discovery.ts` (score 6) |
| Q4 | ✅ YES · 2× content match | ✅ YES · **top-1** | 0 of 3 | 2 | **`capability-experience-abstraction.ts` · IS the target** |

## D · Whole vs scoped comparison

| Case | Whole-repo target reached | Whole-repo top-1 | Scoped target reached | Scoped top-1 |
|---|---|---|---|---|
| Q1 | ❌ NO (at cap=2000) | `nex1-semantic-diagnostic.test.ts` (score 3) | ✅ YES | `capability-fear-concern-afraid.test.ts` (score 13) — target at rank 5 |
| Q2 | ❌ NO (at cap=2000) | `nex1-experience-writer-proof.test.ts` (score 10) | ✅ YES | `capability-chat-turn.ts` (score 6) — target at rank 2 |
| Q3 | ❌ NO (at cap=2000) | `nex1-experience-writer-proof.test.ts` (score 5) | ✅ YES | `capability-capability-discovery.ts` (score 6) — target at rank 7 |
| Q4 | ❌ NO (at cap=2000) | `nex1-semantic-diagnostic.test.ts` (score 3) | ✅ YES · **top-1** | **`capability-experience-abstraction.ts` · target** |

Changing ONLY `allowed_root_prefixes` changed the outcome from "target-file-never-in-candidate-set" (0/4) to "target-file-in-candidate-set" (4/4) and from "correct-top-1" (0/4) to "correct-top-1" (1/4 + 3 further-down-in-set).

## E · Information flow

Same for all 4 cases (differing only in identifier tokens and file counts):

```
Question ("investigate where the assessFear function is defined")
   ↓
Stage 0        trigger=PRIMARY_INVESTIGATE · verb_family=INVESTIGATE (Fix S0)
   ↓
Target repr   concepts=[{token:"assessfear",...},{token:"defined",...}]
              search_terms=["assessfear","defined"]
   ↓
Scoped walker allowed_root_prefixes=["src/lib/nex-agent"] · max_files_scanned=500
              files_scanned=280 · capped_by=natural_end
   ↓
Target reach  target file capability-fear.ts REACHED (BFS index 83 · well within budget)
   ↓
Identifier    contentLower.includes("assessfear") in capability-fear.ts → 1 match
match         (declaration site only)
   ↓
Candidate     capability-fear.ts enters set at rank 5 (score 1)
set           other files score higher because their content mentions
              "assessfear" more times (test files: 13× · consultation files: 3×)
   ↓
Ranking       score = 2 * filename_matches + content_matches
              filename_matches=0 for all candidates
              → ordering is purely content-match count
   ↓
Selection     out of scope (this experiment did not run Q7/Q8)
```

## F · First broken link

**REACHABILITY (S1-D) · CONFIRMED as first blocker in production configuration** — proven by the fact that changing ONLY scope makes all 4 target files enter the candidate set.

**RANKING · NOW OBSERVABLE as a downstream issue** — when target files reach the candidate set, 3 of 4 rank below other files. Root cause (observation only):
- Scoring function is `2 * filename_matches + content_matches` (source: `capability-repository-discovery.ts:321`)
- All 4 target tokens have filename_matches=0 (symbol names are not in filenames)
- Ranking reduces to raw content-substring count
- **A file that USES the symbol many times outranks a file that DEFINES it once** — the declaration site is typically the shortest match; test files and importer files have many more mentions.

This is an OBSERVATION, not a proof of a ranking-mechanism defect. The founder-approved V1 ranking policy is doing exactly what it says. Whether "raw occurrence count" is the right signal for "declaration search" is a design question.

## G · What this experiment PROVES

- `PROVEN` · The walker's `allowed_root_prefixes` parameter is a working API surface that can accept experimental values without production-code modification.
- `PROVEN` · When scoped to `src/lib/nex-agent`, all 4 target files are reachable within the default cap of 500.
- `PROVEN` · The walker's content-substring matcher successfully identifies the target identifier in ALL 4 target files (Q1: 1×, Q2: 1×, Q3: 2×, Q4: 2×).
- `PROVEN` · All 4 target files enter the candidate set under scoped invocation.
- `PROVEN` · Reachability (S1-D) was the previously-blocking link — scoping removes it and downstream mechanisms proceed.
- `PROVEN` · The current scoring formula ranks files by RAW-COUNT-OF-MENTIONS, which favours files that USE a symbol over the file that DEFINES it (`OBSERVED` mechanism; `PROVEN` from source-line 321 read).
- `PROVEN` · Byte-identical determinism across two consecutive scoped invocations (byte_identical_across_passes=true in receipt).

## H · What this experiment DOES NOT prove

- Does **not** prove that scoping to `src/lib/nex-agent` is the correct production strategy. That is a scope-selection question, not a diagnostic finding.
- Does **not** prove broad semantic understanding.
- Does **not** prove domain understanding.
- Does **not** prove AGI or general intelligence.
- Does **not** prove production suitability of any new scan strategy or ranking formula.
- Does **not** prove correctness outside this repository.
- Does **not** prove that the ranker's occurrence-count heuristic is wrong — only that it doesn't align with "find the declaration" for the 3 non-top-1 cases.
- Does **not** falsify the possibility that a different concept-set (adding "defined" or "function" as concepts alongside "assessfear") would rerank the results.

## I · Required next experiment (NOT authorised without founder gate)

Recommend the smallest next diagnostic experiment: **Ranking-Discrimination Isolation**.

Given that all 4 target files now enter the candidate set, the next question is: does the existing ranking mechanism have signals that could distinguish "declaration site" from "usage site"? Concrete hypotheses to falsify:
- Adding filename similarity (`capability-fear.ts` vs `capability-fear-concern-afraid.test.ts`) as a scoring dimension
- Excluding `*.test.ts` files from the "declaration lookup" scenario
- Weighting the FIRST occurrence of a symbol above subsequent mentions
- Using proximity to `export function|const|interface|type` keywords

Diagnostic-only. Would use the existing candidate set from THIS experiment as input · re-score under alternative formulas · compare to Q4's naturally-correct result. No production ranking-code modification.

Do NOT implement without explicit authorisation.

## J · Change audit

```
Production files changed:                  0
Production defaults changed:               0
HARD_MAX_FILES_SCANNED changed:            0
allowed_root_prefixes default changed:     0
Tests changed:                             0
Corpus changed:                            0
Architecture changed:                      0
LLM calls added:                           0
Agents added:                              0
Brains added:                              0
Daemons added:                             0
Autonomous execution added:                0
Git changes:                               0
Remote pushes:                             0
```

Additive read-only artefacts (outside any production pipeline):
- `src/lib/nex-cap/nex1-reachability-scoped-experiment.test.ts` (calls existing `discoverRepositoryCandidates` with only `allowed_root_prefixes` changed at the call site)
- `data/nex1-stage1-diagnostic/reachability-scoped-experiment.json` (receipt · byte_identical_across_passes=true)

## Non-implementation reminder · STOP

Per protocol §14 · final rule · this diagnostic is closed. `capability-repository-discovery.ts` is UNCHANGED (SHA-256 will match pre-experiment baseline). `DEFAULT_ALLOWED_ROOTS` still `["src", "docs/doctrine"]`. `HARD_MAX_FILES_SCANNED` still 2000. `DEFAULT_MAX_FILES_SCANNED` still 500. Await explicit founder authorisation for the next diagnostic (Ranking-Discrimination Isolation) or a production repair.

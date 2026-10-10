# NEX1 · Stage 1 Candidate Discovery Diagnostic · 2026-09-19

**READ-ONLY · DIAGNOSTIC · NO FIX APPLIED**

## A · Stage 1 status

`STAGE 1 · NOT YET PROVEN`

The candidate-discovery pipeline does not reliably surface the correct target file. Mechanism-level evidence identifies exactly why. Recommendation deferred to founder authorisation.

## B · Four known-answer cases

| Case | Target symbol | Correct file | NEX top-1 candidate | Target reached candidate set? | First broken link | Confidence |
|---|---|---|---|---|---|---|
| Q1 | `assessFear` | `src/lib/nex-agent/code-engine/capability-fear.ts` (line 121) | `src/app/nexapp/NexAppShell.tsx` | ❌ NO | **S1-D** | PROVEN |
| Q2 | `runNativeInvestigation` | `src/lib/nex-agent/code-engine/native-investigation-mode.ts` (line 319) | `src/app/nexapp/NexAppShell.tsx` | ❌ NO | **S1-D** | PROVEN |
| Q3 | `InvestigationConclusionEntry` | `src/lib/nex-agent/code-engine/investigation-conclusion-store.ts` (line 38) | `src/app/nexapp/NexAppShell.tsx` | ❌ NO | **S1-D** | PROVEN |
| Q4 | `patternIdOf` | `src/lib/nex-agent/code-engine/capability-experience-abstraction.ts` (line 123) | `src/app/nexapp/NexAppShell.tsx` | ❌ NO | **S1-D** | PROVEN |

Ground truth: independently verified via grep of `^export (async function|function|interface)` — not via NEX.

## C · Information-preservation trace

Trace for Case Q1 (representative — Q2/Q3/Q4 identical mechanism):

```
Question:       "investigate where the assessFear function is defined"
   ↓
Stage 0:        trigger_kind=PRIMARY_INVESTIGATE · verb_family=INVESTIGATE
   ↓
Target repr:    concepts=[{token:"assessfear"},{token:"defined"}]
                search_terms=["assessfear","defined"]
                → target survived tokenisation + normalisation (S1-A: NO, S1-B: NO)
   ↓
Stage 1 input:  investigationConcepts=["assessfear","defined"]
                repo_root=".", allowed_roots=["src","docs/doctrine"]
                max_files_scanned=500 (constant · native-investigation-mode.ts:577)
   ↓
Candidate query:
                ACTION 2  · store.listFiles({tag:"assessfear"}) → 0 entries
                          · store.listFiles({tag:"defined"})    → 0 entries
                            (FileMemory index has only 10 files ·
                             none tagged with "defined" or "assessfear")
                ACTION 2.5 · fallback to discoverRepositoryCandidates()
                            = BFS walk of src/ + docs/doctrine/ · alphabetical
                            · cap = 500 files scanned
                            · content-scan: contentLower.includes(concept)
   ↓
Candidate set:  20 files · ALL tagged with "defined" only · NONE tagged with "assessfear"
                Top-1 = src/app/nexapp/NexAppShell.tsx (score 11.5)
                (contains the word "defined" many times as English prose)
   ↓
Filtering:      no filter removed the target · target never in the set (S1-E: NO)
   ↓
Ranking (Q7):   correctly ranks the set it received · target absent so ranking
                cannot recover it (S1-F: NO)
   ↓
Selection (Q8): correctly SELECTS src/lib/plantHire.ts under V1 policy on the
                (incorrect) candidate set it received.
```

**Target information is lost at Stage 1 · specifically at the discovery walker's file-scanning step. The walker never reads `src/lib/nex-agent/code-engine/capability-fear.ts` — its 500-file BFS budget is consumed before reaching that path.**

## D · False-positive mechanism

**Mechanism · Reachability × common-token drift:**

The walker (`capability-repository-discovery.ts:218`) walks `src/` + `docs/doctrine/` breadth-first with a hard cap of 500 files (line 82 · `DEFAULT_MAX_FILES_SCANNED`). Directory entries are sorted alphabetically per level. The BFS budget is exhausted on the shallow tree:

```
BFS-500 breakdown (empirical · walker-simulation.mjs receipt):
   183 files · src/apps/
   156 files · src/app/
   143 files · src/lib/    (direct children only)
     4 files · src/components/
     4 files · src/data/
     3 files · src/platform/
     ...
Total scanned: 500 · cap hit
```

`src/lib/nex-agent/code-engine/*.ts` is 3 directory levels below `src/lib/`. All 232 files under `src/lib/nex-agent/code-engine/` are **NEVER READ**. This is a REACHABILITY failure, not an identifier-awareness failure.

Content-substring probe on the target files (would match if reached):

```
capability-fear.ts:                 1 × "assessfear"        · 0 × "defined"
native-investigation-mode.ts:       1 × "runnativeinvestigation" · 0 × "defined"
```

So the walker's `contentLower.includes(concept)` mechanism WOULD find the target if the file were scanned. But the cap prevents scanning.

**Why plantHire.ts / seo.ts / tradeOffSocial.ts consistently appear at top:**
- They are direct children of `src/lib/` — reached within the first 500 files
- They contain the common English word "defined" (as prose, comments, or type annotations)
- The walker's concept extraction included the noise token "defined" (from "…the function is **defined**")
- content-scan matched "defined" in these files
- Q7 ranks them; Q8 selects.

## E · First broken link

**FIRST BROKEN LINK · S1-D · candidate discovery searches identifiers correctly but never reads the correct declaration file · reachability is capped at 500 files while target files are 3+ levels below the alphabetical BFS frontier.**

Sub-classification of S1-D exposed by this diagnostic:

- Discovery mechanism (`contentLower.includes`) is **identifier-aware** in the sense of matching lowercased symbol names as substrings of file content.
- Discovery mechanism is **reachability-bound** by `max_files_scanned=500` (hard cap, not configurable per-question).
- Discovery mechanism is **BFS-alphabetical**, which biases the reachable set toward shallow shallow files under alphabetically-early roots.

None of the below are the first broken link:
- S1-A · NO · symbol survives tokenisation
- S1-B · NO · symbol survives normalisation (case-fold to "assessfear")
- S1-C · NO · discovery DOES search identifiers via content-substring
- S1-E · NO · file is never in the set, so it can't be filtered out
- S1-F · NO · file is never in the set, so ranking can't demote it
- S0 · NO · Stage 0 now accepts the question correctly (Fix S0 · 2026-09-19)

## F · What is now proven

- `PROVEN` · Stage 0 is closed (14/14 diagnostic investigations, 1,871/1,871 classifier tests).
- `PROVEN` · The FileMemory tag index contains only 10 entries — none tagged with any diagnostic target token or "defined".
- `PROVEN` · When FileMemory yields 0 candidates, the fallback walker fires (source-verified in `native-investigation-mode.ts:566-604`).
- `PROVEN` · The walker uses BFS-alphabetical with a hard-coded cap of 500 files.
- `PROVEN` · Under the current cap, NONE of `src/lib/nex-agent/**` files are reached (walker-simulation.mjs receipt at `data/nex1-stage1-diagnostic/walker-simulation.json`).
- `PROVEN` · The walker's content-scan is case-insensitive substring; it WOULD locate `assessFear` / `runNativeInvestigation` / etc. if the file were in the scanned set (content-substring probe confirms 1 occurrence each in the correct file).
- `PROVEN` · The false-positive top candidates (`plantHire.ts`, `seo.ts`, `tradeOffSocial.ts`, `NexAppShell.tsx`) all contain the English word "defined" and are reached within 500 files.

## G · What remains unproven

- `UNPROVEN` · Whether raising the walker's cap alone would produce correct answers at scale. It would obviously make `capability-fear.ts` reachable for THIS repo but the mechanism at another repo depth is untested.
- `UNPROVEN` · Whether "identifier-aware" content-substring is sufficient once reachability is fixed. False positives from substring overlap (e.g., `assess` matching `reassess`) are theoretically possible; not empirically measured.
- `UNPROVEN` · Whether FileMemory could carry the load if pre-seeded with more paths + tags. FileMemory has only 10 entries today.
- `UNPROVEN` · Whether the concept-extraction pipeline preserves camelCase-derived tokens meaningfully. The token stored is lowercased `assessfear`; the file contains `assessFear`. Case-insensitive substring bridges this today but a future substring collision (e.g. a file mentioning `assessfearlessly`) could false-positive.
- `UNPROVEN` · Semantic correctness of NEX's answers on any domain outside this codebase.

## H · Required next experiment

**Recommended smallest experiment (author only · do not implement without further founder authorisation):**

**Experiment X · Reachability-Isolation:**
Run each of the 4 diagnostic questions through the existing `discoverRepositoryCandidates` capability with **exactly one changed parameter**: `max_files_scanned` set to a value that provably includes the target file (e.g. 4,000 · covers all of src/lib/nex-agent tree per uncapped count).

**Purpose:** falsify OR confirm that reachability alone is the first broken link. If raising the cap produces correct top candidates, S1-D is fully confirmed and the fix is a one-line change to the caller's `max_files_scanned` argument (or a new mechanism to route the walker into promising subtrees first).

If raising the cap does NOT produce correct top candidates, then a second broken link exists at the ranking/scoring level and the diagnostic must continue.

**Scope guardrails for the recommended experiment:**
- Diagnostic-only. No production code modified.
- Uses `discoverRepositoryCandidates` as-is with a different input parameter.
- Reports whether target file becomes top-1, top-5, or absent.
- Does not run through the full NEX pipeline (avoids corpus writes).
- Byte-identical determinism check across two invocations.

## I · Change audit

```
Production files changed:  0
Tests changed:             0
Corpus changed:            0
Architecture changed:      0
LLM calls added:           0
Agents added:              0
Brains added:              0
Daemons added:             0
Autonomous execution added: 0
Git changes:               0
Remote pushes:             0
```

Instrumentation added: 1 diagnostic script at `scripts/nex1-stage1-diagnostic/walker-simulation.mjs`. It does NOT modify production code · it REPLICATES the walker's traversal in isolation to prove reachability behaviour without instrumenting the real code path. Receipt at `data/nex1-stage1-diagnostic/walker-simulation.json`.

## Non-implementation reminder

Per the diagnostic gate rules — no fix is applied. STOP after this report. Await explicit founder authorisation for Experiment X or for a Stage-1 repair.

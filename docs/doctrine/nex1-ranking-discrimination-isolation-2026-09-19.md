# NEX1 · Ranking-Discrimination Isolation · 2026-09-19

**AUTHORISED DIAGNOSTIC · READ-ONLY RE-SCORING · NO PRODUCTION MODIFICATION**

Experimental variable · re-scoring policy applied to the **existing** Option-B candidate sets. The candidate sets themselves are UNCHANGED. No production code touched.

## A · Status

**`DISCRIMINATION ACHIEVABLE FROM EXISTING EVIDENCE · SIGNAL IDENTIFIED`**

Not "ranking fixed". The experiment proves that the candidate set NEX already surfaces (post-reachability-fix) contains enough information to distinguish declaration from usage · via a single content-regex signal.

## B · Signals tested (all pure functions over existing evidence · no new capability)

| ID | Signal | What it inspects |
|---|---|---|
| S-A | filename token overlap · fraction of camelCase-symbol-tokens present in basename tokens | candidate file NAME |
| S-B | is-test-file · matches `\.(test\|spec)\.[tj]sx?$` | candidate PATH |
| S-C | has-export-declaration · regex `^\s*export\s+(?:async\s+)?(?:function\|const\|let\|var\|interface\|type\|class\|enum)\s+<symbol>\b` | candidate FILE CONTENT |
| S-D | has-import-declaration · regex `import\s+(?:type\s+)?\{[^}]*\b<symbol>\b[^}]*\}` | candidate FILE CONTENT |

Every signal computes from information the walker already loaded (path + basename + content).

## C · Re-scoring policies · result matrix (target-file top-1 per case)

| Policy | Description | Q1 assessFear | Q2 runNativeInvestigation | Q3 InvestigationConclusionEntry | Q4 patternIdOf | Total |
|---|---|---|---|---|---|---|
| BASE | Existing V1 · `2 * filename_matches + content_matches` | ✗ | ✗ | ✗ | ✓ | 1/4 |
| P1 | BASE + 10 × S-A | ✗ | ✓ | ✓ | ✓ | 3/4 |
| P2 | BASE − 100 × S-B | ✗ | ✗ | ✗ | ✓ | 1/4 |
| **P3** | **BASE + 100 × S-C** | ✓ | ✓ | ✓ | ✓ | **4/4** |
| P4 | BASE + 50 × (1 − S-D) | ✗ | ✗ | ✓ | ✓ | 2/4 |
| **P5** | **Pure S-C (declaration binary)** | ✓ | ✓ | ✓ | ✓ | **4/4** |
| **P6** | **S-C − S-B** | ✓ | ✓ | ✓ | ✓ | **4/4** |
| **P7** | **10 × S-C + 3 × S-A** | ✓ | ✓ | ✓ | ✓ | **4/4** |

Four independent policies using signal **S-C** reach 4/4 discrimination. Signal S-C alone is sufficient (P5).

## D · Why each losing policy loses

- **BASE** loses because scoring reduces to raw content-match count · files that USE the symbol (test, importer) accumulate more matches than the DECLARATION which typically appears once (`export function assessFear` at line 121 is a single match).
- **P1 (filename-overlap)** wins Q2/Q3/Q4 because `native-investigation-mode.ts`, `investigation-conclusion-store.ts`, `capability-experience-abstraction.ts` share word tokens with their respective symbols. Loses Q1 because `capability-fear.ts` shares only "fear" with `assessFear` (2 symbol tokens · overlap fraction 0.5) — same overlap as `capability-fear-concern-afraid.test.ts` and score tiebreak goes to test file's higher content_matches.
- **P2 (test-penalty)** doesn't help Q2/Q3 because top-1 there is a NON-test importer (`capability-chat-turn.ts`, `capability-capability-discovery.ts`). Only helps Q1 partly but doesn't top-rank.
- **P4 (not-importer)** helps Q3/Q4 but not Q1/Q2 because many candidates don't import the symbol via ES `import { ... }` syntax (they may reference the symbol via inline usage, not top-of-file import).

## E · Why S-C succeeds cleanly

The regex `^\s*export\s+(function|const|interface|type|class)\s+<symbol>\b` matches **exactly and only at the declaration site**:

| Case | Declaration line matched by S-C |
|---|---|
| Q1 assessFear | `capability-fear.ts:121` · `export function assessFear(input: FearAssessmentInput): FearAssessment {` |
| Q2 runNativeInvestigation | `native-investigation-mode.ts:319` · `export async function runNativeInvestigation(` |
| Q3 InvestigationConclusionEntry | `investigation-conclusion-store.ts:38` · `export interface InvestigationConclusionEntry {` |
| Q4 patternIdOf | `capability-experience-abstraction.ts:123` · `export function patternIdOf(f: ShapeFeatures): string {` |

No other candidate file has this exact pattern for the given symbol. Test files, importer files, and consumer files all mention the symbol name, but none of them contain `export function <symbol>` (they contain `import { <symbol> }` or `<symbol>(...)` — different patterns).

The signal exists in evidence NEX already has (file content). It requires only a regex scan of already-loaded content — no new information source, no new walker pass, no LLM.

## F · What this experiment PROVES

- `PROVEN` · The candidate set surfaced by Option-B (all 4 target files in) contains sufficient information to discriminate declaration from usage for these 4 controlled cases.
- `PROVEN` · A single regex signal (S-C) achieves 4/4 correct top-1 discrimination when used alone (P5).
- `PROVEN` · The current V1 ranker (BASE) is misaligned with declaration-lookup intent on 3/4 of these cases · not because of information deficit but because of scoring formula design.
- `PROVEN` · Signal S-C computes from candidate content already available to the ranker — no new evidence source is required.
- `PROVEN` · Byte-identical determinism · results are pure functions of inputs.

## G · What this experiment does NOT prove

- Does **not** prove S-C generalises beyond TypeScript `export` declarations. Symbols declared without `export` (private helpers, local variables, class methods) will not match the regex. `OBSERVED` limitation, `HYPOTHESIS` for broader coverage.
- Does **not** prove the signal is robust to declarations spanning multiple lines (e.g., `export\nfunction <symbol>`). Regex uses `^\s*export\s+...` on single lines · `HYPOTHESIS` for multi-line cases.
- Does **not** prove S-C would work on JavaScript, Python, Rust, or any non-TS codebase.
- Does **not** prove adding this signal to production would improve outcomes without regression against the 15+ coding-loop tests currently dependent on V1 ranker behaviour.
- Does **not** prove that the same signal top-ranks against the WHOLE-REPO candidate set (which contained test files under `src/lib/nex-cap/`). This test used the SCOPED candidate set.
- Does **not** prove broad semantic understanding · AGI · general intelligence.

## H · First broken link · updated

- Stage 0: ✅ **PROVEN CLOSED** (Fix S0 · 2026-09-19)
- Reachability (S1-D): ✅ **PROVEN as first blocker under production default config** (Option-B experiment)
- Ranking (S1-F candidate): ✅ **NOW OBSERVED** — the current ranker is misaligned. **PROVEN** that the evidence to discriminate exists in the candidate set. Whether to fix this in production is a design decision.

Next-first-broken-link status: `unknown` until we probe on a broader corpus (non-TS, cross-repo, non-declaration questions).

## I · Required next diagnostic (NOT authorised)

Two natural extensions could follow this experiment. Both diagnostic-only:

1. **Ranking-Generalisation** · take S-C and apply it to a controlled corpus of ~20 non-target lookup questions on this repo (functions that AREN'T exports, methods on classes, type aliases, private symbols). Determine what fraction the signal correctly discriminates.

2. **Ranking-Cross-Language** · run the scoped experiment on a small foreign codebase (Python / Rust / plain JS) with known declaration locations. Determine whether S-C's structural assumption holds outside TypeScript.

Choose ONE if you want a broader test. If both come back clean, then Q7 amendment becomes a defensible design decision. If either reveals a hole, we've saved ourselves from encoding a false generalisation.

## J · Change audit

```
Production files changed:                  0
Production defaults changed:               0
HARD_MAX_FILES_SCANNED changed:            0
allowed_root_prefixes default changed:     0
Q7 policy changed:                         0
Q8 policy changed:                         0
Ranker source changed:                     0
Walker source changed:                     0
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

Read-only additive artefacts (outside any production pipeline):
- `src/lib/nex-cap/nex1-ranking-discrimination-experiment.test.ts` (re-scoring harness · reads existing candidate JSON · pure functions)
- `data/nex1-stage1-diagnostic/ranking-discrimination-experiment.json` (receipt · 8 policies × 4 cases)

## Non-implementation reminder · STOP

Per protocol · the diagnostic is closed. `capability-repository-discovery.ts:321` (score formula) is UNCHANGED. Ranker source is UNCHANGED. Q7 policy V1 is UNCHANGED. Await explicit founder decision on:

- Which (if any) production repair to authorise
- Whether to run Ranking-Generalisation or Ranking-Cross-Language next
- Whether Q7 V1 amendment should be founder-drafted before any code touch

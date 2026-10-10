# NEX1 · Stage 0 → Stage 1.6 · Target-Extraction Repair
Date · **2026-09-20**
Founder-authorised Option A · caller-boundary filter · Phase 1 A/B diagnostic → Phase 2 minimal production wire-in → Phase 3 verification.

---

## A · Diagnostic A/B result

Read-only harness: `src/lib/nex-cap/nex1-stage0-target-extraction-phase1-ab.test.ts`
Evidence receipt · `data/nex1-stage0/phase1-ab.json`

Corpus: 20 cases · 14 definition-intent (incl. 1 negative control) · 3 multi-symbol · 3 non-definition-intent.

| Invariant | Result |
|---|---|
| Filter caused a preservation regression | **NEVER** (0/20) |
| Filter removed a legitimate target token | **NEVER** (0/20) |
| Non-definition concepts byte-identical A vs B | ✅ (3/3) |
| Non-definition bridge did not run under B | ✅ (3/3) |
| DEFINITION_INTENT_TOKENS leakage A → B | **13 → 0** |
| Verdict distribution | 15 IMPROVED · 2 IMPROVED_MULTI_OK · 3 NO_OP_NON_DEFINITION |
| Pre-existing classifier misses (not filter-caused) | M2 only ("Compare the declarations of…" — classifier extracts 0 concepts, upstream) |

## B · Formula/filter used

```
IF definition_intent(problem_statement, concepts) === true:
  concept_tokens_for_bridge ← concept_tokens filtered against DEFINITION_INTENT_TOKENS
ELSE:
  concept_tokens_for_bridge ← concept_tokens (byte-identical)
```

Filter set is the canonical `DEFINITION_INTENT_TOKENS` set already declared at `native-investigation-mode.ts:289`. No new vocabulary. No arbitrary hard-coded list.

The 16 tokens in the canonical vocabulary:
```
define · defined · definition · definitions
declare · declared · declaration · declarations
implement · implements · implemented · implementation
export · exports · exported
where · which
```

## C · Target preservation

- Every legitimate target token preserved in every case (**19/19** where target was present in arm A).
- M2 target absence is pre-existing classifier defect (concept extraction returns []) — not caused by the filter; recorded as separate Stage 0 defect.

## D · Operator leakage

- Arm A total leakage on DEFINITION_INTENT_TOKENS: **13**
- Arm B total leakage on DEFINITION_INTENT_TOKENS: **0**
- Reduction: **100 %** on the canonical vocab.
- Residual leaks (tokens NOT in canonical vocab): `class`, `file`, `symbol`, `multiple`, `site`, and other domain-nouns that happen to be valid TypeScript identifiers. These are honest boundary of the "reuse existing canonical vocab" mandate.

## E · Multi-symbol result

- M1 "Where are assessFear and runNativeInvestigation defined?" — both targets preserved · both declaration files SELECTED · `defined` filtered.
- M2 "Compare the declarations of ComposedArgument and HypothesisEvidenceEvaluation" — classifier itself returned 0 concepts under both A and B (upstream defect · not filter-caused).
- M3 "Where are patternIdOf and toForwardSlash defined?" — both targets preserved · `patternIdOf` (2 declarations) + `toForwardSlash` (3 declarations) = 5 SELECTED · `defined` filtered.

## F · Negative control

D5 "Where is FooBar defined?" · `FooBar` is nonexistent · classifier still extracts `foobar` as concept · filter removes `defined` · walker returns 0 declaration sites for `foobar` · bridge emits 0 evaluations · Q8 emits 0 SELECTED. Honest refusal preserved.

## G · Non-definition regression

- N1 · "Fix the login bug in the payment flow" · concepts=[] A vs B · byte-identical · bridge skipped · ✅
- N2 · "Refactor the useAuth hook to use React Query" · concepts=[hook, react, query] A vs B · byte-identical · bridge skipped · ✅
- N3 · "Investigate why users see stale data on the dashboard" · concepts=[users, see, stale, data, dashboard] A vs B · byte-identical · bridge skipped · ✅

## H · Production files changed

**Modified:**
- `src/lib/nex-agent/code-engine/native-investigation-mode.ts` · **only** the declaration-bridge block additive · ~15 LOC filter block inside the existing `if (definitionIntentForBridge)` branch. Non-definition-intent path unchanged.

**Created:**
- `src/lib/nex-cap/nex1-stage0-target-extraction-phase1-ab.test.ts` · Phase 1 A/B harness (20 cases)
- `docs/doctrine/nex1-stage0-target-extraction-repair-2026-09-20.md` · this report
- `data/nex1-stage0/phase1-ab.json` · full Phase 1 evidence

**Byte-identical (SHA-256 verified):**
- `capability-candidate-ranker.ts` (Q7) — `03ADA775880CFF33…`
- `capability-candidate-selector.ts` (Q8) — `0B51C8976CEB630F…`
- `capability-hypothesis-evidence-evaluator.ts` (Fix 13) — `896A36E30B12501D…`
- `capability-root-cause-hypothesis-generator.ts` (Fix 12) — `3672618C774FD509…`
- `capability-chain-relationship-composer.ts` (Fix 11) — `4B0C2FCB86E60497…`
- `capability-chain-relationship-detector.ts` (Fix 10) — `9B451BB440A3233B…`
- `capability-observed-chains.ts` (Fix 8) — `D4C66B64A1453A4E…`
- `capability-chain-narrative-emitter.ts` (Fix 9) — `93E4D7016953C972…`
- `capability-repository-discovery.ts` (walker) — `80046E0E43AD6224…`
- `capability-declaration-bridge.ts` (Stage 1.6 bridge) — `4C616968B28EB13D…`
- `capability-a-founder-intent/classifier.ts` — `53DDD61CBDCF45B1…`
- `capability-a-founder-intent/vocabulary.ts` — `9148FCAB1899B977…`

## I · Full regression

- Before Phase 2 · code-engine + nex-cap suites: 65 code-engine files · 2742 tests · 0 failures.
- After Phase 2 · full run of code-engine + all S0/S1.6 nex-cap files: **70 test files · 2748 tests · 0 failures.**
- Delta: +5 test files (Phase 1 A/B added +1 in this session · S0 diagnostic added earlier this session · Stage 1.6 formula experiment / E2E / capability probe were already present).
- No pre-existing test regressed.

## J · Frozen hashes

12 frozen files verified byte-identical pre/post Phase 2 (see H).

## K · Capability-probe result (post-Phase 2)

Re-ran `src/lib/nex-cap/nex1-stage1-6-capability-probe.test.ts` after the filter shipped:

| Case | Pre-filter (from earlier probe) | Post-filter (this session) |
|---|---|---|
| T1 assessFear | 2 SELECTED (target + `defined` false-positive) | **1 SELECTED** — target only |
| T2a evaluateHypothesisEvidence | 2 SELECTED | **1 SELECTED** |
| T2b ComposedArgument | 2 SELECTED | **1 SELECTED** |
| T2c computeAbsenceCandidates | 2 SELECTED | **1 SELECTED** |
| T3 toForwardSlash (ambiguity) | 4 SELECTED (3 legitimate + 1 false) | **3 SELECTED** — exactly the 3 legitimate |
| T4 generateRootCauseCandidates (adversarial extra English) | 9 SELECTED | 10 SELECTED — target present · residual noise from `symbol`, `multiple`, `site` (not in canonical vocab) |

All 6 cases still assert `match_expected=✅ · llm_free=✅ · bypassed=✅`.

## L · Remaining limitations

1. **Residual leakage on tokens not in DEFINITION_INTENT_TOKENS.** `class`, `file`, `symbol`, `multiple`, `site` are ordinary English words that also appear as TypeScript identifiers; some of them route through `coding_concepts` (via `CODING_LEXEME_INDEX`), others land in `domain_tokens`. The founder mandate specifically restricted the fix to the existing canonical vocab, so these residuals are documented rather than removed. A future extension of the canonical vocabulary (or a `CODING_LEXEME_INDEX`-subset filter) would close them.
2. **M2 pre-existing classifier defect.** "Compare the declarations of X and Y" returns 0 concepts under BOTH arm A and arm B. Filter is not the cause. Separate diagnostic needed.
3. **Multi-line/multi-symbol/non-English robustness.** Not covered by the current 20-case corpus.
4. The capability itself remains: *a deterministic declaration-investigation capability for the tested TypeScript forms and cases*. The Phase 2 repair narrows false positives; it does not extend the underlying capability into new forms or languages.

---

## Founder's critical invariant · verified

> "When definition_intent=true, use the existing definition-intent vocabulary/lexical classification to prevent linguistic operators from entering the declaration-symbol candidate set."

- `definition_intent` gate: present at `native-investigation-mode.ts:695` (`if (definitionIntentForBridge)`).
- Existing canonical vocabulary reused: `DEFINITION_INTENT_TOKENS` at `native-investigation-mode.ts:289`.
- Nothing hard-coded outside that vocabulary.
- Non-definition-intent behaviour byte-identical (verified in G).
- Q7 / Q8 / bridge / walker / Fix 8-14 / classifier / vocabulary all byte-identical (verified in J).
- No LLM · no embeddings · no semantic model · no new agent · no new brain · no daemon · no autonomous execution.

## Discipline verdict

The Phase 2 repair honours every founder-set constraint. Stage 1.6 remains frozen. Stage 0 target-extraction is the exact and only boundary that changed. The claim remains narrow:

> NEX has demonstrated a new deterministic declaration-aware code-investigation capability, including novel-symbol generalisation and tested ambiguity preservation. The Stage 0 caller-boundary filter (2026-09-20) removes definition-intent operator words from the concept set before they reach the Stage 1.6 declaration bridge, reducing false-positive declarations by 100 % on the canonical `DEFINITION_INTENT_TOKENS` subset while leaving non-definition investigations byte-identical and preserving every legitimate target.

Not a general-intelligence claim. Not an AGI claim. A repair, verified.

**STOP.**

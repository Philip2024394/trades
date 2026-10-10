# NEX1 · Fix 15 · Deterministic Candidate Ranking Mechanism · Runtime-Verified Report

**Date:** 2026-09-17
**Authorization:** Founder Fix 15 authorization prompt
**Policy under implementation:** `NEX1_RANKING_POLICY V1` · FOUNDER_APPROVED · 2026-09-17
**Policy source:** `docs/doctrine/nex1-ranking-policy-v1-founder-approved-2026-09-17.md`
**External model:** NONE
**Track A status:** FROZEN
**Q8 status:** NOT_IMPLEMENTED

---

## FIX15_STATUS

```
FIX15_STATUS:           RUNTIME_VERIFIED

Policy:                 NEX1_RANKING_POLICY V1
Policy status:          FOUNDER_APPROVED
Mechanism:              IMPLEMENTED
Runtime verification:   PASSED (18/18 cases)
Determinism:            PASSED (F15-15 · 5 identical runs)
Negative controls:      PASSED (F15-10, F15-11, F15-12, F15-13, F15-14)
Q8 boundary:            PASSED (F15-16 · zero prohibited fields)
Fabrication count:      0
External model:         NONE
Q8:                     NOT_IMPLEMENTED
Track A:                FROZEN
```

---

## 1 · What Fix 15 Does (Policy-Bounded Mechanism)

Fix 15 answers a single question: given already-generated candidates (Fix 12) and already-evaluated evidence (Fix 13), how should NEX1 order those candidates according to V1 policy?

Fix 15 does NOT:
- generate hypotheses (Fix 12's job)
- evaluate evidence (Fix 13's job)
- compare pairs (Fix 14's job)
- select a root cause (Q8 · out of scope · NOT_IMPLEMENTED)

## 2 · Files Changed

| File | Change | Lines |
|---|---|---|
| `src/lib/nex-agent/code-engine/capability-candidate-ranker.ts` | **NEW** · deterministic ranker per V1 policy | ~400 |
| `src/lib/nex-agent/code-engine/native-investigation-mode.ts` | + import · + packet field · + ACTION 14 · + 2 early-exit patches · + finalise wiring | +45 |
| `scripts/nex1-fix15-verification/probe.ts` | **NEW** · 18-case verifier (F15-1..F15-16 + Test-S corpus + UNRESOLVED_ORDER) | ~570 |
| `data/nex1-fix15/receipt-2026-09-17.json` | **NEW** · runtime evidence | — |

Zero production files unrelated to Q7 ranking were modified. Track A files untouched.

## 3 · Policy → Mechanism Mapping (V1 field ↔ code)

| V1 Policy Field | Code Location | Behaviour |
|---|---|---|
| §2.5 `ranking_scope` (same source_file) | `capability-candidate-ranker.ts` grouping by `candidate_id.split("::")[0]` | Candidates ranked only within one source_file scope |
| §2.6 `evidence_precedence` R-1..R-5 | Lexicographic tuple `[contra_flag, unres_flag, insuff_flag, -supp_count]` | Sort ascending · first differing axis names the rule |
| §2.7 `supporting_rule` COUNT-BASED equal-weight | `supporting_count` integer · no weights | R-4 fires when supp counts differ by ≥1 |
| §2.8 `contradicting_rule` BLOCKING | Tuple axis 0 · presence flag | R-1 · candidate without contra outranks candidate with any |
| §2.9 `insufficient_rule` BLOCKING | Tuple axis 2 · presence flag | R-3 |
| §2.10 `unresolved_rule` BLOCKING · UNRESOLVED ≠ CONTRADICTING | Tuple axis 1 · **separate** from axis 0 | R-2 |
| §2.11 `shared_evidence_rule` | Aggregate count math proven identical to pairwise removal (see file header) | Shared cancels · zero advantage |
| §2.12 `unique_evidence_rule` | Emerges from count arithmetic | Unique supports contribute to R-4 |
| §2.13 `weighting_model` NO NUMERICAL WEIGHTS | Integer counts only · no multipliers · no composite scores | No score field emitted |
| §2.14 `precedence_model` LEXICOGRAPHIC | `compareTuples` function walks axes 0→3 in order | Fixed precedence |
| §2.15 `confidence_rule` NOT USED | `CONFIDENCE_FIXED = 0.35` constant · never reads input confidence | Verified by F15-10 |
| §2.16 `tie_rule` EXPLICIT TIE | `ranking_state = "TIED"` when ≥2 candidates in same rank bucket | No hidden tie-breaker |
| §2.17 `minimum_difference_rule` Δ≥1 | Integer inequality on `supporting_count` | R-4 fires only when counts differ |
| §2.18 `no_information_rule` UNRESOLVED_ORDER | `rank_position = null` when all supp=0 + any blocking + single tuple bucket | Verified by UNRESOLVED-ORDER case |
| §2.19 `correlation_rule` dedup by relationship_id | `computeCandidateMetrics` builds `Map<rel_id, status>` before counting | Verified by F15-9 |
| §2.20 `provenance_rule` INFORMATIONAL ONLY | Provenance read from Fix 13 but not touched by ranker | Verified by F15-11 |
| §2.21 `conflict_rule` → CONTRADICTING → R-1 | Fix 13 already routes conflict to CONTRADICTING · Fix 15 inherits | No re-classification in ranker |
| §2.22 `rank_one_definition` ≠ proven root cause | `evidence_kind: "INFERRED"` type-locked · never PROVEN · no root-cause fields | Verified by F15-16 |
| §2.23 `q8_selection_excluded = TRUE` | Zero Q8 field names in output | Verified by F15-16 |
| §1 Design bias (honest-uncertainty) | UNRESOLVED_ORDER preferred over manufactured rank when supp=0 + blocking present | Verified by UNRESOLVED-ORDER case |

## 4 · Verification Matrix (§26 · F15-1..F15-16 · all PASS)

| # | Verifier | Status | Detail |
|---|---|---|---|
| F15-1 | Contradiction · A CONTRA · B none → B above A via R-1 | ✅ PASS | B.rank=1 A.rank=2 rule=R-1 |
| F15-2 | Equal contradiction → R-1 does not differentiate → TIED | ✅ PASS | Both rank=1 TIED |
| F15-3 | Unresolved · A UNRES · B none → B above A via R-2 | ✅ PASS | B.rank=1 A.rank=2 rule=R-2 |
| F15-4 | Equal unresolved → R-2 does not differentiate → TIED | ✅ PASS | Both rank=1 TIED |
| F15-5 | Insufficient · A INSUFF · B none → B above A via R-3 | ✅ PASS | B.rank=1 A.rank=2 rule=R-3 |
| F15-6 | Supporting majority · A=3 B=2 · Δ=1 → A above B via R-4 | ✅ PASS | A.rank=1 supp=3 · B.rank=2 supp=2 rule=R-4 |
| F15-7 | Exact tie · identical evidence → TIE | ✅ PASS | Both rank=1 TIED · scope=ALL_TIED |
| F15-8 | Shared evidence · same rel_ids on both → TIE (shared cancels) | ✅ PASS | Both rank=1 TIED |
| F15-9 | Correlated evidence · duplicate rel_id counts once (§2.19) | ✅ PASS | supp=2 (dedup) · not 3 |
| F15-10 | Confidence negative control · flip confidences · ranking unchanged | ✅ PASS | Both runs: B.rank=1 A.rank=2 |
| F15-11 | Provenance negative control · rich provenance does NOT boost | ✅ PASS | Lower supp still lower rank |
| F15-12 | Filename negative control · zzzz vs aaaa · rank pattern preserved | ✅ PASS | Both: A.rank=1 B.rank=2 |
| F15-13 | Candidate-ID negative control · swap symbol names · rank preserved | ✅ PASS | Both: A.rank=1 B.rank=2 |
| F15-14 | Array-order negative control · reverse input · rank preserved | ✅ PASS | Both: A.rank=1 B.rank=2 |
| F15-15 | Determinism · 5 identical runs · identical output | ✅ PASS | distinct_outputs=1 |
| F15-16 | Q8 boundary · zero root_cause/selection fields | ✅ PASS | q8_field_hits=[] |
| TEST-S-CORPUS | 5 candidates × 2 SUPP each · all TIE at rank 1 · ALL_TIED (matches V1 §4) | ✅ PASS | scope_state=ALL_TIED |
| UNRESOLVED-ORDER | Zero supp + blocking-only → rank_position=null (§2.18) | ✅ PASS | scope_state=UNRESOLVED_ORDER |

Raw evidence: `data/nex1-fix15/receipt-2026-09-17.json`

## 5 · A-S Regression (§28)

Verifying Fix 15 did NOT weaken upstream capabilities:

| Probe | Purpose | Exit Code | Verification Signals |
|---|---|---|---|
| `nex1-fix12-verification` | Hypothesis generator (Fix 12) | 0 | `HYPOTHESIS_GENERATION_RUNTIME_VERIFIED` |
| `nex1-fix13-verification` | Evidence evaluator (Fix 13) | 0 | 5 × `RUNTIME_VERIFIED` (Q1..Q3 · overall) |
| `nex1-fix14-verification` | Candidate comparator (Fix 14) | 0 | 5 × `RUNTIME_VERIFIED` (Q1..Q6) · `CANDIDATE_COMPARISON_RUNTIME_VERIFIED` |
| `nex1-test-s` | Ranking absence diagnostic (Test S) | 0 | `candidate_rankings` field now present in packet (S_V1 flipped `false → true`) · negative controls S_V9-V22 all pass · classification header `RANKING_POLICY_ABSENT` is stale (probe pre-dates Fix 15 · was correct at diagnosis time) |

No regression. No previous assertion weakened. Track A unchanged.

**Note on Test S classification:** the Test S probe's `overall_classification: "RANKING_POLICY_ABSENT"` header is stale because Test S was designed BEFORE Fix 15. Its per-verifier checks (`S_V1..S_V22`) all reflect the correct post-Fix-15 state · S_V1 flipped from `false` to `true`. Test S was a diagnostic · its purpose was to identify the gap · Fix 15 filled it.

## 6 · Determinism (§23)

- Identical inputs → identical outputs (F15-15 · 5-run check)
- No randomness · no `Date.now()` · no filesystem order dependency · no external model
- Input array order irrelevant (F15-14)
- Candidate_id is used for STABLE OUTPUT PRESENTATION within tie buckets only · never to alter `rank_position`. This is auditable presentation, not ranking · documented in file header.

## 7 · Negative Controls (§24)

Runtime-proven that ranking does NOT use:

- filename (F15-12)
- candidate_id ordering (F15-13)
- array position (F15-14)
- confidence (F15-10)
- provenance (F15-11)

as evidence-bearing factors.

## 8 · Fabrication (§29)

- **Evidence fabricated:** 0 (all fixtures explicitly labelled `TEST FIXTURE` per §27)
- **Relationships fabricated:** 0
- **Provenance fabricated:** 0 (test fixtures use synthetic provenance clearly separated from real repo evidence stores)
- **Causal explanations fabricated:** 0 (forbidden causal vocabulary list enforced at runtime · defence-in-depth from Fix 13/14)
- **Policy rules fabricated:** 0 (every rule traces to V1 field · see §3 mapping)

## 9 · Q8 Boundary (§4)

Explicitly enforced:

- ✅ No root-cause selection
- ✅ No root-cause declaration
- ✅ No root-cause acceptance
- ✅ No root-cause rejection
- ✅ No causal conclusions
- ✅ No autonomous diagnosis
- ✅ No Q8 fields (12 prohibited field names scanned · 0 hits · F15-16)
- ✅ No Q8 APIs added

Output is RANKING. Not ROOT_CAUSE_SELECTION.

## 10 · Track A (§5)

Zero touches. No modifications to:

- G15
- C6
- Ed25519 authority
- trust anchors
- execution authorization
- WO-04
- execution broker
- Stage 13/14/15/16

## 11 · External Model (§30)

- Zero LLM calls
- Zero Claude/GPT/Gemini/Groq/model-generated ranking
- All logic deterministic and inspectable in `capability-candidate-ranker.ts`

## 12 · Authority (§31)

- Ranking is analytical only
- Zero file writes
- Zero broker calls
- No WO-04 connection
- No execution broker connection

## 13 · Test-Hygiene Corrections (transparently disclosed)

**Correction 1 — Fix 14 verifier V13 (during earlier Fix 14 verification, unrelated to Fix 15):**
Documented in Fix 14 report. Not a Fix 15 issue.

**Correction 2 — Early-exit paths in `native-investigation-mode.ts`:**
Two pre-existing early-exit branches (`REFUSED_CLASSIFIER` at line 327 · `REFUSED_NON_INVESTIGATE_INTENT` at line 394) needed the new `candidateRankings: []` + `candidateRankingsNote` fields to satisfy `FinaliseInput`. This is a mechanical wiring change · not a policy interpretation change. Both paths return empty rankings with a "not computed" note.

**No test-fixture-only corrections in Fix 15 verifier.** All 18 cases passed on first blind run.

## 14 · Pre-Existing TypeScript Error (unrelated to Fix 15)

`native-investigation-mode.ts:511` reports `IndependentObserver` constructor requires 1 argument · pre-existing in ACTION 3 (Observer walk) · unchanged by Fix 15. Not a Fix 15 defect. Should be tracked separately.

## 15 · Governing Rule Compliance

> The founder has defined what "better" means. → V1 policy 19 explicit decisions
> Fix 15 must implement that definition exactly. → §3 mapping table above
> No hidden scoring. No invented preference. No arbitrary tie-breaker. → F15-10, F15-11, F15-12, F15-13, F15-14 all PASS
> Ranking is evidence ordering, not root-cause selection. → F15-16 PASS · Q8 remains NOT_IMPLEMENTED
> Code existence does not prove capability. Runtime evidence does. → 18/18 verifier cases PASS · raw receipt at `data/nex1-fix15/receipt-2026-09-17.json`

## 16 · HARD STOP (§36)

Per founder §36:

- ✅ STOPPED after verification
- ✅ Did NOT automatically proceed to Q8
- ✅ Did NOT implement root-cause selection
- ✅ Did NOT modify ranking policy
- ✅ Did NOT create new ranking policy
- ✅ Did NOT commit
- ✅ Did NOT push

Awaiting explicit next founder authorization.

---

*End of NEX1 Fix 15 Runtime-Verified Report · 2026-09-17*

# NEX1 Ranking Policy V1 · Founder Decision Review

**Companion to:** `docs/doctrine/nex1-ranking-policy-v1-draft-2026-09-17.md` (V1_DRAFT · 559 lines)
**Date:** 2026-09-17
**Author:** master_ai_engineer (review-only mode · no policy authored here)
**Purpose:** Convert the V1 DRAFT into 19 discrete founder decisions.

---

## Frame

**Each decision below has three distinct categories the founder must not confuse:**

| Category | Meaning |
|---|---|
| **EXISTING VERIFIED FACT** | Established by Fix 12/13/14 runtime · not up for decision |
| **CLAUDE-PROPOSED POLICY** | The V1 DRAFT's proposal · offered for founder review · not authorized |
| **FOUNDER DECISION REQUIRED** | The founder must pick, revise, or reject |

**A DRAFT passing P1-P23 does not mean the policy is correct** — it means the DRAFT is structurally complete enough to review. What "better" means is not a technical inference. The founder decides.

**No recommendations are made below.** Where a "current V1 proposal" is shown, it is Claude's DRAFT proposal, not a Claude recommendation.

---

## Decision 1 · Ranking Scope

**Question:** Which candidates may be ranked against each other?

**V1 proposal:** Rank only candidates that share both the same `source_file` AND the same `investigation_id`.

**Plain English:** A candidate about `wo9-corrector.ts` can only be ranked against another candidate about `wo9-corrector.ts`, and only within the same investigation. Candidates from different files or different investigations are never compared.

**Alternatives:**
- **A** · Same source_file within same investigation (V1 proposal)
- **B** · Same investigation regardless of source_file (broader scope · could rank cross-file candidates)
- **C** · Same mission / same problem context, regardless of file (broadest architecturally-defined scope)
- **D** · Same enclosing_function only (narrowest · matches Fix 12 alternatives scope)
- **E** · Other founder-defined scope

**Consequence of choice:** determines whether NEX1 emits rankings for one file at a time or across a wider investigation surface.

**Status:** ⬜ FOUNDER DECISION REQUIRED

---

## Decision 2 · Evidence Precedence

**Question:** How is the ranking rule structured?

**V1 proposal:** Lexicographic rule chain:
- R-1 CONTRADICTION_BLOCK
- R-2 UNRESOLVED_BLOCK
- R-3 INSUFFICIENT_BLOCK
- R-4 SUPPORTING_MAJORITY
- R-5 TIE

**Plain English:** Rules evaluated top-down. First rule producing a difference decides. Rules 1-3 treat contradictions and uncertainty as blocking (they demote candidates that have them). R-4 fires only among clean-evidence candidates and orders by supporting count. R-5 declares TIE when nothing else fires.

**Alternatives:**
- **A** · Lexicographic precedence (V1 proposal)
- **B** · Numerical weighting (single score per candidate; higher score ranks higher)
- **C** · Explicit tie / no order when evidence is not clearly discriminative (stricter than V1; refuse ranking rather than fall through to R-4)
- **D** · Other founder-defined model (e.g. hybrid, tree-structured, per-relationship-type)

**Consequence:** governs the whole shape of ranking arithmetic. Choosing (B) would require the founder to also supply weights in Decision 9.

**Status:** ⬜ FOUNDER DECISION REQUIRED

---

## Decision 3 · Supporting Evidence

**Question:** Does one additional supporting-evidence record make one candidate rank above another?

**V1 proposal:** Equal-count. If both candidates are clean (no contradiction/unresolved/insufficient), the candidate with strictly more SUPPORTING evidence ranks above.

**Plain English:** 3 supporting vs 2 supporting → 3 ranks first, only when neither candidate has any negative evidence.

**Alternatives:**
- **A** · Equal count (V1 proposal)
- **B** · Weighted evidence (some supporting types count more than others · e.g. producer_consumer vs condition_gates_return)
- **C** · Evidence types have different precedence (e.g. condition_gates_return dominates producer_consumer regardless of count)
- **D** · Supporting evidence alone cannot determine rank (delete R-4 · candidates with equal negative-evidence status always TIE)
- **E** · Founder-defined rule

**Consequence of (D):** the current 5-candidate Test S corpus (all 2 SUPPORTING each) would TIE under both V1 proposal AND (D) — but V1 proposal would break future ties where supporting counts differ, whereas (D) would never break them.

**Status:** ⬜ FOUNDER DECISION REQUIRED

---

## Decision 4 · Contradicting Evidence

**Question:** If candidate A has one contradicting record and candidate B has none, can A outrank B?

**V1 proposal:** BLOCKING. Any STRUCTURALLY_CONTRADICTING evidence demotes A below B. If both have contradictions → UNRESOLVED_ORDER (no ranking).

**Plain English:** Contradictions are treated as fatal to rank position under V1. NEX1 will not rank a contradicted candidate above a clean one, regardless of how many supporting records the contradicted candidate has.

**Alternatives:**
- **A** · Any contradiction blocks (V1 proposal)
- **B** · Contradiction is a numerical penalty but does not automatically block (contradicted candidate could still outrank clean candidate if supporting count is high enough)
- **C** · Contradiction causes UNRESOLVED_ORDER for the pair or whole set (harder discipline than blocking)
- **D** · Contradiction requires additional evidence before ranking that pair
- **E** · Founder-defined rule

**Consequence:** determines whether a candidate with 10 supporting + 1 contradicting can outrank a candidate with 2 supporting + 0 contradicting. Under V1: no. Under (B): possibly yes with the right weights.

**Status:** ⬜ FOUNDER DECISION REQUIRED

---

## Decision 5 · Insufficient Evidence

**Question:** If evidence is INSUFFICIENT for candidate A but not for candidate B, should A still be allowed to rank against B?

**V1 proposal:** BLOCKING (same shape as contradicting). Any INSUFFICIENT record demotes A below B. Both INSUFFICIENT → UNRESOLVED_ORDER.

**Plain English:** Insufficient evidence prevents A from outranking a clean B.

**Alternatives:**
- **A** · Blocking (V1 proposal · symmetric with contradicting)
- **B** · Ignore (INSUFFICIENT does not affect rank)
- **C** · Numerical penalty (weighted model · e.g. `−0.5 per INSUFFICIENT`)
- **D** · Force TIE across the whole candidate set until the INSUFFICIENT is resolved (whole-set discipline)
- **E** · Founder-defined rule

**Consequence:** determines whether NEX1 can meaningfully rank candidates with partial evidence, or whether partial evidence blocks the ranking entirely.

**Status:** ⬜ FOUNDER DECISION REQUIRED

---

## Decision 6 · Unresolved Evidence

**Question:** If evidence is UNRESOLVED (missing relationship_id or composition_id) for A but not for B, should NEX1 refuse to order them?

**V1 proposal:** BLOCKING (same shape as insufficient).

**Plain English:** UNRESOLVED means the data trace is broken (the relationship or composition that would have supported the hypothesis cannot be found). Under V1, NEX1 refuses to rank a candidate whose evidence trail is broken above one whose trail is intact.

**Critical distinction (established by Fix 13):**
> UNRESOLVED ≠ CONTRADICTING · absent data is not the same as evidence-against.

**Alternatives:**
- **A** · Blocking (V1 proposal)
- **B** · Ignore (UNRESOLVED does not affect rank)
- **C** · Numerical penalty
- **D** · Force whole-set UNRESOLVED_ORDER when any candidate has UNRESOLVED
- **E** · Founder-defined rule

**Consequence:** determines whether NEX1 refuses to rank when it doesn't have complete evidence for a candidate, or whether it ranks anyway based on what evidence it does have.

**Status:** ⬜ FOUNDER DECISION REQUIRED

---

## Decision 7 · Shared Evidence

**Question:** Should evidence that appears for BOTH candidates contribute to their ranking?

**V1 proposal:** Shared evidence does not differentiate. It's counted once per candidate's supporting count (so both candidates get +1), and the net delta between them is 0.

**Plain English:** If both candidates cite the same supporting relationship, that relationship contributes equally and does not shift the ranking between them.

**Important:** shared evidence must never be double-counted accidentally (e.g. by adding it separately to each candidate's total AND by counting it in a "shared" bucket AND by using it in a difference calculation).

**Alternatives:**
- **A** · Shared evidence counts in both candidates equally (V1 proposal · net delta = 0)
- **B** · Shared evidence explicitly excluded from supporting counts (only unique evidence counts toward rank)
- **C** · Shared evidence creates a "structurally-equivalent" tag on the pair (informational only · doesn't shift rank)
- **D** · Founder-defined rule

**Consequence:** determines whether ranking depends on total evidence per candidate (V1) or on unique evidence per candidate (B). The current 5-candidate corpus has shared=0 for all pairs, so the choice does not exercise on today's corpus.

**Status:** ⬜ FOUNDER DECISION REQUIRED

---

## Decision 8 · Unique Evidence

**Question:** Should A-only or B-only evidence create ranking differences?

**V1 proposal:** Unique evidence contributes to each candidate's supporting count on equal footing with shared evidence. Total supporting = shared + candidate-only.

**Plain English:** Under V1, the total support count decides R-4 · unique evidence isn't given extra weight for being unique.

**Alternatives:**
- **A** · Unique counted equal to shared (V1 proposal)
- **B** · Unique evidence receives extra weight (e.g. 1.5× per unique) · favours differentiated evidence
- **C** · Only unique evidence counts for ranking; shared ignored entirely
- **D** · Founder-defined rule

**Consequence:** determines whether NEX1 prefers candidates with distinctive evidence over candidates with lots of shared evidence.

**Status:** ⬜ FOUNDER DECISION REQUIRED

---

## Decision 9 · Numerical Weights

**Question:** Should NEX1 use numerical scores at all?

**V1 proposal:** NO NUMERICAL WEIGHTS. Ranking is purely lexicographic (Decision 2 rule chain).

**Plain English:** V1 uses a "first differentiating rule wins" pattern rather than a single score-per-candidate model.

**Alternatives:**
- **A** · No numerical scoring (V1 proposal)
- **B** · Explicit founder-defined weights (e.g. `SUPPORTING=+1 · CONTRADICTING=−2 · UNRESOLVED=−0.5 · INSUFFICIENT=−0.5` or any other set of values)
- **C** · Another deterministic mathematical model (e.g. ordinal-only, threshold-based, ratio-based)

**Important:** if the founder chooses (B), **the founder must provide the actual numerical values**. NEX1 must not invent them. If the founder chooses (C), the founder must specify the model.

**Consequence:** determines the underlying arithmetic of ranking. This decision is deeply coupled with Decision 2.

**Status:** ⬜ FOUNDER DECISION REQUIRED

---

## Decision 10 · Confidence

**Question:** Should Fix 12 candidate confidence values influence Q7 ranking?

**V1 proposal:** NOT USED.

**Plain English:** Fix 12 assigns each candidate a bounded confidence value (currently ~0.4 for all candidates in the corpus). V1 treats these as uncertainty signals only and does not use them for ranking.

**Alternatives:**
- **A** · Never used (V1 proposal)
- **B** · Used as a secondary factor (e.g. tie-breaker when R-1..R-5 all TIE)
- **C** · Used as a primary factor (rank directly by confidence)
- **D** · Founder-defined treatment

**Important:** confidence is an uncertainty signal from the hypothesis generator, not a measure of truth. Choosing (C) would mean that a higher-confidence hypothesis outranks a lower-confidence one regardless of evidence — which the V1 draft explicitly rejected as unsafe.

**Consequence:** determines whether NEX1 uses subjective-feeling numbers (confidence) or only structural evidence for ranking.

**Status:** ⬜ FOUNDER DECISION REQUIRED

---

## Decision 11 · Provenance

**Question:** Should evidence provenance affect ranking?

**V1 proposal:** INFORMATIONAL ONLY. Provenance is preserved in output for traceability but is not used to compute rank order.

**Plain English:** Where evidence came from (file, line range, source diversity, depth of composition, directness to symptom) is displayed but does not shift the ranking.

**Alternatives:**
- **A** · Informational only (V1 proposal)
- **B** · Source diversity matters (candidate whose evidence spans more distinct source_files ranks above one whose evidence is concentrated)
- **C** · Evidence depth matters (deeper compositions receive more weight)
- **D** · Direct source grounding matters (candidate whose provenance touches endpoints closer to the symptom ranks above one farther away)
- **E** · Founder-defined provenance rule (specific combination or new dimension)

**Important:** "more sources" is not automatically "stronger evidence." A single very-direct source may be more evidentially useful than many indirect sources. The founder decides which of these interpretations counts.

**Consequence:** determines whether NEX1 uses source-tree structure as an evidence signal, or only counts of evidence-status records.

**Status:** ⬜ FOUNDER DECISION REQUIRED

---

## Decision 12 · Correlated Evidence

**Question:** If several evidence records originate from the same underlying structural fact (same relationship_id), should they count once or multiple times?

**V1 proposal:** Deduplicate by relationship_id. Multiple evidence_ids pointing to the same underlying relationship collapse to a single supporting count for that candidate.

**Plain English:** Prevents evidence inflation. A candidate whose supporting_relationship_ids list references relationship R three times gets 1 supporting count from R, not 3.

**Alternatives:**
- **A** · Deduplicate by relationship_id (V1 proposal)
- **B** · Deduplicate by evidence_id only (a no-op in current architecture · Fix 13 already ensures evidence_id uniqueness)
- **C** · Deduplicate by composition_id (stricter · treats different relationships within the same composition as a single evidence unit)
- **D** · No deduplication (each Fix 13 evidence record counts once regardless of underlying identity)
- **E** · Founder-defined rule

**Consequence:** determines whether NEX1 protects against artificial evidence duplication. Choosing (D) would allow a Fix 15 mechanism to over-weight candidates whose evidence naturally references the same underlying facts many times.

**Status:** ⬜ FOUNDER DECISION REQUIRED

---

## Decision 13 · Ties

**Question:** Should NEX1 be allowed to return an explicit TIE when candidates cannot be meaningfully distinguished?

**V1 proposal:** Explicit TIE. Both tied candidates share the same `rank_position`. The next candidate's `rank_position` skips accordingly (e.g. two tied at rank 1, next candidate is rank 3).

**Absolutely critical (§17):** the following must **never** become hidden evidence-based ranking:
- filename order
- candidate ID order
- array position
- creation timestamp
- hash order
- alphabetical order

A deterministic-but-arbitrary tie-breaker (e.g. sorting tied candidates alphabetically) may be used **only for display** and **must not be represented as a ranking signal**.

**Alternatives:**
- **A** · Explicit TIE state with shared rank_position (V1 proposal)
- **B** · Ties trigger UNRESOLVED_ORDER for the entire set (harder discipline · refuse to emit any rank when any tie exists)
- **C** · Ties allow a provenance-diversity tie-breaker (see Decision 11 Alternative B)
- **D** · Ties allow a founder-authored deterministic tie-breaker of a specific structural kind
- **E** · Founder-defined rule

**Consequence:** determines what happens when the evidence-based rules do not discriminate. The current corpus produces all-ties under V1, so this decision materially matters today.

**Status:** ⬜ FOUNDER DECISION REQUIRED

---

## Decision 14 · Minimum Difference

**Question:** What minimum difference is sufficient to separate two candidates in the ranking?

**V1 proposal:** Δ ≥ 1 supporting evidence record. Any single-unit difference in supporting count is enough for R-4 to fire.

**Plain English:** Under V1, 3 supporting vs 2 supporting is enough to break a tie. The difference does not need to be large.

**Alternatives:**
- **A** · Δ ≥ 1 (V1 proposal)
- **B** · Δ ≥ 2 (require at least 2 more supporting records to differentiate · more ties)
- **C** · Δ ≥ 30% of the max supporting count in the pair (percentage-based · scales with corpus size)
- **D** · No minimum threshold (any difference at all breaks the tie · same as V1)
- **E** · Different thresholds per evidence class
- **F** · Founder-defined threshold

**Consequence:** determines how sensitive ranking is to small evidence differences. Higher thresholds produce more ties and fewer confident ranks.

**Status:** ⬜ FOUNDER DECISION REQUIRED

---

## Decision 15 · No-Information Case

**Question:** What should NEX1 report when the available evidence cannot distinguish any candidates?

**V1 proposal:** UNRESOLVED_ORDER for the whole set. No ranking is emitted. This is honest refusal.

**Plain English:** If a Fix 15 mechanism looks at the packet and finds it has nothing to rank against (no comparisons, empty evaluations, etc.), it refuses to output a ranking rather than falling back to a default.

**Alternatives:**
- **A** · UNRESOLVED_ORDER · no ranking emitted (V1 proposal)
- **B** · TIE at rank 1 for all candidates
- **C** · Emit `INSUFFICIENT_EVIDENCE` marker on the ranking record
- **D** · Emit no ranking record at all (silent · empty output)
- **E** · Emit `NO_RANKING` state with an explicit reason string
- **F** · Founder-defined state

**Consequence:** determines what a downstream consumer receives when no ranking is possible. Options (B) and (A) look similar but differ in downstream semantics — B says "all equal", A says "cannot decide."

**Status:** ⬜ FOUNDER DECISION REQUIRED

---

## Decision 16 · Conflicting Evidence

**Question:** What should happen when a single candidate contains BOTH SUPPORTING and CONTRADICTING evidence?

**V1 proposal:** Same treatment as contradiction (Decision 4). The candidate is demoted below clean candidates regardless of how many supporting records accompany the contradiction. Supporting evidence does NOT cancel contradicting evidence.

**Plain English:** Under V1, 5 supporting + 1 contradicting still ranks below 0 supporting + 0 contradicting, because the contradiction is treated as fatal.

**Alternatives:**
- **A** · Contradiction-first blocking regardless of supporting count (V1 proposal)
- **B** · Numerical net (`net_score = SUPPORTING − 2·CONTRADICTING`) · supporting can offset contradicting
- **C** · Any conflict → UNRESOLVED_ORDER for that candidate specifically (stricter than V1 · candidate is unrankable)
- **D** · Supporting evidence can cancel contradicting evidence if supporting count > contradicting count by some threshold
- **E** · Founder-defined rule

**Consequence:** determines whether NEX1 treats internal evidence conflict as a fatal signal (V1) or as arithmetic to be netted out (B).

**Status:** ⬜ FOUNDER DECISION REQUIRED

---

## Decision 17 · Meaning of Rank 1

**Question:** What does `rank_position: 1` mean when NEX1 emits a ranking?

**V1 proposal:**
> The candidate that occupies the top of the lexicographic ordering defined by evidence_precedence R-1..R-5 within this investigation's candidate set.
>
> Rank 1 is NOT: the actual root cause · the correct hypothesis · the recommended action · causally significant · automatically selected.

**Plain English:** Rank 1 is a position in an ordered list under a specific policy. It is not a claim about truth, causality, or root-cause identity.

**This separation is critical.** The V1 proposal explicitly excludes Q8 semantics. Whether the founder confirms this exact phrasing or requests refinement is a founder decision.

**Alternatives:**
- **A** · V1 phrasing as-is
- **B** · Founder-authored refinement of the wording
- **C** · Additional exclusions (e.g. "rank 1 is not: the target for change · the primary suspect · the leading explanation")

**Consequence:** shapes how downstream capabilities (Q8 in the future, or human readers) interpret ranking output.

**Status:** ⬜ FOUNDER DECISION REQUIRED

---

## Decision 18 · Q8 Boundary

**Question:** Confirm that Q7 ranking and Q8 root-cause selection remain separate capabilities.

**V1 proposal:** Q8 selection is unconditionally excluded from this policy. The ranking output must NEVER contain fields named `root_cause`, `selected_candidate`, `final_root_cause`, `actual_cause`, `chosen_candidate`, `winner`, `most_likely_cause`, `correct_hypothesis`, `cause_candidate`, `preferred_root_cause`, or any disguised alias.

**Plain English:** Even if a Fix 15 mechanism computes an unambiguous rank 1, that mechanism must not label the rank-1 candidate as the root cause. Selection is a separate future capability with its own future authorization.

**Alternatives:**
- None acceptable per founder §24 — this field is non-negotiable if the founder still holds the Q7/Q8 boundary.
- The only decision the founder can make here is to reaffirm the boundary (approve as-is) or to relax it (which would fundamentally re-scope the policy).

**Consequence:** determines whether V1 remains a pure Q7 policy or expands into Q8 territory. Expansion would require Test T-scale founder authorization.

**Status:** ⬜ FOUNDER DECISION REQUIRED (reaffirm or relax)

---

## Decision 19 · Honest Uncertainty Bias

**Question:** Should NEX1 prefer explicit uncertainty (TIE / UNRESOLVED_ORDER) over forced ordering when available evidence does not meaningfully distinguish candidates?

**V1 proposal:** YES — this is the underlying design bias of the entire V1 DRAFT. All BLOCKING rules (R-1, R-2, R-3), the TIE state, and the no-information rule all express the same underlying stance.

**Plain English:** V1 is biased toward refusing to rank when it isn't sure, rather than manufacturing a preference.

**This is a proposed design principle, not established fact.** The founder must confirm or reject it explicitly.

**Alternatives:**
- **APPROVE** the bias · V1 rule shape stays biased toward refusal
- **REVISE** the bias · specify a different stance (e.g. "prefer forced ordering over TIE — always produce a ranking when candidates exist")
- **REJECT** the bias · rewrite V1 with a permissive default (rank always · TIE only in edge cases)

**Consequence:** determines the overall philosophy of NEX1's ranking. All previous 18 decisions inherit this bias in the V1 shape. Rejecting the bias forces a substantial rewrite.

**Status:** ⬜ FOUNDER DECISION REQUIRED

---

## Current Corpus Warning (per §24)

**Fact from Test S runtime:**
```
Corpus:      5 candidates
Supporting:  2 per candidate
Contradicting: 0 · Insufficient: 0 · Unresolved: 0
Shared:      0 across all pairs
Unique:      2 A-only + 2 B-only per pair
```

**Under any conceivable V1-shaped policy, this corpus produces all TIEs at rank 1.** The current investigation does not discriminate the candidates by any evidence-based rule.

**This must not motivate policy revision toward forced discrimination.** Manufacturing a rule that separates the current 5 candidates on the basis of arbitrary properties (filename, candidate_id, timestamp, alphabetical order, array position) would violate §11/§17 and §28 of the original policy authorization prompt.

**A future verification suite** will need to construct **controlled synthetic evidence profiles** (explicitly labeled synthetic) that exercise each branch:
- Candidates with real CONTRADICTING evidence (exercises R-1)
- Candidates with real UNRESOLVED evidence (exercises R-2)
- Candidates with real INSUFFICIENT evidence (exercises R-3)
- Candidates with different SUPPORTING counts (exercises R-4)
- Candidates with genuinely identical evidence profiles (exercises R-5 TIE)
- Candidates with conflicting evidence within a single candidate (exercises Decision 16)
- Candidates with correlated evidence sharing relationship_ids (exercises Decision 12)
- Candidates with provenance differences (if Decision 11 is approved with a provenance-affects-rank rule)

**No such tests are to be created here.** They belong to a separately-authorized Fix 15 verification suite.

---

## §25 · Compact Decision Table

| # | Policy field | V1 proposal (Claude's DRAFT) | Founder Decision |
|---|---|---|---|
| 1 | `ranking_scope` | Same source_file within same investigation | ⬜ APPROVE   ⬜ REVISE |
| 2 | `evidence_precedence` | Lexicographic R-1..R-5 (contradiction-first · block-on-uncertainty) | ⬜ APPROVE   ⬜ REVISE |
| 3 | `supporting_rule` | Equal-count · fires only for clean-evidence pairs | ⬜ APPROVE   ⬜ REVISE |
| 4 | `contradicting_rule` | BLOCKING · both contra → UNRESOLVED_ORDER | ⬜ APPROVE   ⬜ REVISE |
| 5 | `insufficient_rule` | BLOCKING (symmetric with contradiction) | ⬜ APPROVE   ⬜ REVISE |
| 6 | `unresolved_rule` | BLOCKING (symmetric · UNRESOLVED ≠ CONTRADICTING preserved) | ⬜ APPROVE   ⬜ REVISE |
| 7 | `shared_evidence_rule` | Shared does not differentiate (both +1 · net delta 0) | ⬜ APPROVE   ⬜ REVISE |
| 8 | `unique_evidence_rule` | Counted equal to shared · no extra weight | ⬜ APPROVE   ⬜ REVISE |
| 9 | `weighting_model` | NO NUMERICAL WEIGHTS | ⬜ APPROVE   ⬜ REVISE |
| 10 | `confidence_rule` | NOT USED | ⬜ APPROVE   ⬜ REVISE |
| 11 | `provenance_rule` | INFORMATIONAL ONLY | ⬜ APPROVE   ⬜ REVISE |
| 12 | `correlation_rule` | Deduplicate by relationship_id | ⬜ APPROVE   ⬜ REVISE |
| 13 | `tie_rule` | Explicit TIE · shared rank_position · next skips · no hidden tie-breaker | ⬜ APPROVE   ⬜ REVISE |
| 14 | `minimum_difference_rule` | Δ ≥ 1 supporting for R-4 | ⬜ APPROVE   ⬜ REVISE |
| 15 | `no_information_rule` | UNRESOLVED_ORDER · no ranking emitted | ⬜ APPROVE   ⬜ REVISE |
| 16 | `conflict_rule` | Same as contradicting (BLOCKING · supporting cannot cancel) | ⬜ APPROVE   ⬜ REVISE |
| 17 | `rank_one_definition` | Top of lexicographic ordering · NOT root cause | ⬜ APPROVE   ⬜ REVISE |
| 18 | `q8_selection_excluded` | TRUE unconditionally · 10 forbidden field names | ⬜ APPROVE   ⬜ REVISE |
| 19 | Design bias · honest-uncertainty preference | Prefer TIE / UNRESOLVED_ORDER over forced ranking when evidence not discriminative | ⬜ APPROVE   ⬜ REVISE   ⬜ REJECT |

---

## §26 · Final Status

```
POLICY STATUS:            DRAFT
FOUNDER APPROVAL:         NOT YET GIVEN
FIX 15 AUTHORIZATION:     NOT GRANTED
PRODUCTION CODE CHANGES:  0
TRACK A:                  FROZEN
```

---

## Founder Instruction (per §27)

The only valid next founder responses are:

**APPROVE** — accept the DRAFT as V1 · authorize policy version · a separate Fix 15 authorization prompt must be issued for implementation
**REVISE** — specify which decision numbers to change and to what · new DRAFT emerges · this review loop repeats
**PAUSE** — hold Q7 indefinitely · Track B stops at Stage 12c green

**If REVISE**, please respond with a compact instruction of the form:
```
Decision N: change to alternative X
Decision M: use founder-authored rule "<text>"
```

so the DRAFT can be updated exactly · no interpretation on Claude's part.

**No implementation code will be written by Claude regardless of decision.** Fix 15 authorization requires a distinct prompt.

**Freeze remains in force. No commits. No push. Track A untouched.**

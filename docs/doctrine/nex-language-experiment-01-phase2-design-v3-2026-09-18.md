# NEX-LANGUAGE-EXPERIMENT-01 · Phase 2 · v3 Design (post-audit)

**Date:** 2026-09-18
**Status:** v3 · pending re-audit and founder sign-off · zero implementation until re-audit passes
**Prior version:** v2 REVISED · audit found 17 amendments needed
**Amendments applied in v3:** 17/17 (3 CRITICAL · 6 HIGH · 3 MEDIUM · 5 LOW)
**Author:** master_ai_engineer (Claude Opus 4.7)

---

## §0 · Amendment log · 17/17 applied

| # | Severity | Amendment | v3 location |
|---|----------|-----------|-------------|
| 1 | CRITICAL | 01A scoped explicitly to wh-family morpheme (not "letters in general") | §5 · §12 |
| 2 | CRITICAL | Baseline B output→gold mapping table specified | §11.2 |
| 3 | CRITICAL | Letter-pair hypothesis (ss/ie) deferred to Experiment 01B (out of scope) | §5.4 · §12.4 |
| 4 | HIGH | Ablation A9 redesigned to produce nonces uniformly (no real English residuals) | §9.2 |
| 5 | HIGH | Mechanism behavior on unknown lexemes defined explicitly | §14.4 |
| 6 | HIGH | Contextual ablation dropped from Phase 2 (deferred to Phase 3) | §9.4 |
| 7 | HIGH | Subword decomposition source named (MorphoLex-en + Etymonline audit) | §8.3 |
| 8 | HIGH | Confound audit method specified per confound (12 methods) | §10.2 |
| 9 | HIGH | "Unseen combination" operationalised + verification procedure | §7.4 |
| 10 | MEDIUM | Statistical analysis plan formalised (bootstrap CIs · FDR · assumption checks) | §13 |
| 11 | MEDIUM | Pilot-gate → verdict outcome table added | §15.2 |
| 12 | MEDIUM | Central research question terms operationalised | §2.2 |
| 13 | LOW | Phonology fundamental limit disclosed | §17.1 |
| 14 | LOW | 11-outcome verdict taxonomy made explicit | §15.1 |
| 15 | LOW | Corpus sentences derived from Li & Roth 2002 TREC-10 (not free-written) | §7.1 |
| 16 | LOW | Multi-label / ambiguous gold handling protocol | §6.3 |
| 17 | LOW | Wh-class-vs-non-wh-class comparison limit disclosed | §17.2 |

---

## §1 · Hypotheses under test (unchanged from v2)

- **H0-weak** · closed-class / question operators may provide disproportionate information about utterance direction
- **H0-episodic** · some observations may carry disproportionate information in context
- **H0-structural** · direction is joint (word × structure × alternative-set × context)
- **H0-strong** · retained as falsifiable comparison null

---

## §2 · Central research question · operationalised (per amendment #12)

**Question:** At what representational level does reusable information about linguistic interpretation first become measurable: letter → letter-pair → subword → word → word+position → word+frame → word+context?

**Operational definitions:**

- **"First become measurable"** = the smallest level N (in order L1 → L7) such that:
  1. accuracy(L_N) − accuracy(L_{N−1}) ≥ **5 percentage points**, AND
  2. the 95% bootstrap CI on that difference **does not cross zero**, AND
  3. the effect **survives the 12-dimension confound audit** (§10).

- **"Reusable information"** = signal that predicts held-out unseen-combination sentences at accuracy ≥ **Baseline A + 10 percentage points** (chance-plus-margin).

A level that predicts training but fails on held-out is producing predictive-signal but NOT reusable-information. That distinction is load-bearing.

---

## §3 · Experimental scope · what's IN Phase 2 vs. deferred

**IN scope · Phase 2:**
- Main Experiment 01 · lexical / structural / positional information
- Experiment 01A · wh-family morpheme investigation (scoped narrowly per amendment #1)
- Comparison of 7 representation levels (L1 letter → L7 word+context) on the wh-family and immediate lexical neighbourhood

**OUT of scope · deferred:**
- **Experiment 01B** (per amendment #3): general letter-pair hypothesis (ss / ie / etc.). Requires a purpose-designed corpus that varies letter-pair presence orthogonally to word identity, syntactic function, morphology. Not testable with the current 150-sentence corpus.
- **Contextual ablation** (per amendment #6): requires context-embedded sentences that dilute primary signal for pilot N.
- **Cross-linguistic validation:** Japanese / Mandarin sentence-final particles etc. English only per your §1.2.

**Explicit non-goals:**
- Not attempting to prove letters have meaning
- Not attempting to prove NEX1 achieves general language understanding
- Not attempting to beat LLMs on question classification

---

## §4 · Independent + Dependent Variables (unchanged from v2)

**IVs:**
- IV1 · Leading lexical operator {why, what, where, when, how, which, not, if, because}
- IV2 · Syntactic frame {wh-fronted, polar, declarative, conditional, subordinate-because}
- IV3 · Ablation condition (§9)
- IV4 · Representation level (§8)
- IV5 · Comparison control (§8.4)

**DVs (6-dim gold):**
- DV1 · question_operator
- DV2 · expected_answer_type
- DV3 · polarity
- DV4 · conditional
- DV5 · target (NP head lemma)
- DV6 · event (verb lemma)

**Derived:**
- Δ_level(N) = accuracy(L_N) − accuracy(L_{N−1})
- δ_ablation-family(dim) = accuracy(A0) − mean-accuracy(A_family)

---

## §5 · 01A explicit scoping (per amendment #1)

**Experiment 01A is scoped to the wh-family morpheme investigation only.**

Its research question: **"Does the wh- prefix, as a morpheme, carry predictive information about question_operator and expected_answer_type beyond what the whole-word representation carries?"**

**What 01A can conclude:**
- Whether Δ_L3 (subword) > 0 for question dimensions when the wh- morpheme is the subword under test
- Whether that effect survives control for word-identity (matched-subset comparison: subword-only vs. subword+word)
- Whether the effect is confounded by (a) historical family, (b) morphology, (c) word frequency, (d) phonology (partially · see §17.1 limit)

**What 01A cannot conclude:**
- Whether arbitrary letter-pairs (ss, ie) carry information — that is Experiment 01B, out of scope
- Whether the effect is orthographic (letters) vs. phonological (sounds) — text-only mechanism cannot separate these, per §17.1
- Whether other morphemes in English carry similar information — 01A tests only the wh-family

### 5.4 · Explicit deferral of letter-pair hypothesis to Experiment 01B

Your original letter-pair hypothesis (ss / ie / arbitrary letter sequences carrying reusable signal) is NOT testable with the Phase 2 corpus. The 9-target-word corpus does not sample letter-pair distribution principled. A purpose-designed 01B corpus would require:
- Sentences using content words that share specific letter pairs orthogonally to their meaning/function
- Frequency-matched pairs across pair-present and pair-absent conditions
- Position-matched pairs (initial vs. medial vs. final)

01B is planned but not started. Phase 2 explicitly does NOT test the letter-pair hypothesis.

---

## §6 · Gold-label methodology (revised per amendments #15 · #16)

### 6.1 · Corpus derivation (per amendment #15)

**Corpus sentences are derived from published examples, not free-written.**

Primary source: **Li & Roth (2002) TREC-10 question corpus** (5,500 classified questions · publicly available at https://cogcomp.seas.upenn.edu/Data/QA/QC/).

Derivation procedure:
1. Filter Li & Roth to sentences ≤10 words that begin with one of the 9 target operators or matched frames.
2. Apply controlled subject/verb substitution from a documented table (e.g., swap TREC's "Nile" for "machine" in position-preserving fashion when semantic domain doesn't affect the classification).
3. Record provenance per sentence: `{source: "TREC-10", original_id: "1234", modifications: [{from: "Nile", to: "machine"}]}`.

**No free-written sentences** by the LLM-that-is-me. Any sentence I write from scratch is flagged as "author=me" and excluded from primary analysis (reserved for edge-case testing only).

### 6.2 · Gold taxonomy references (unchanged)

- Question operators + answer types: **Li & Roth (2002)** TREC-10 taxonomy (6 coarse + 50 fine classes)
- Semantic roles: **Dowty (1991)** proto-role framework (Proto-Agent / Proto-Patient · graded entailment clusters)
- Grammatical/semantic role split: **Payne** (UOregon) + **Van Valin RRG** consensus

### 6.3 · Multi-label / ambiguous gold protocol (per amendment #16)

Each sentence's gold entry supports three states:

```jsonc
{
  "gold": {
    "question_operator": {
      "primary": "WHY",
      "valid_alternatives": [],   // empty for unambiguous
      "ambiguity_reason": null
    }
  }
}
```

For genuinely ambiguous cases (e.g., "What is happening?" · answer_type could validly be ENTY or DESC):

```jsonc
{
  "gold": {
    "expected_answer_type": {
      "primary": "ENTY",
      "valid_alternatives": ["DESC"],
      "ambiguity_reason": "Li_Roth_2002_TREC10_classifies_this_frame_both_ways"
    }
  }
}
```

For UNKNOWN cases (taxonomy genuinely underdetermined):

```jsonc
{
  "gold": {
    "target": {
      "primary": "UNKNOWN",
      "valid_alternatives": [],
      "ambiguity_reason": "no_clear_NP_head_in_this_frame"
    }
  }
}
```

**Scoring rule:** the mechanism receives credit if its output matches `primary` OR any `valid_alternative`. Ambiguity rate is reported per dimension. UNKNOWN gold is scored only if the mechanism also outputs UNKNOWN (mechanism forced to guess loses points).

### 6.4 · Freeze protocol (unchanged)

- Gold file written and committed **before** mechanism implementation
- SHA-256 recorded in final report
- 10% random sample post-hoc audit re-derived from Li & Roth published examples independently · disagreement rate reported
- Single-annotator (me) disclosed as pilot bias throughout

---

## §7 · Corpus construction

### 7.1 · Sources

**Primary:** Li & Roth (2002) TREC-10 corpus · 5,500 items · CC-licensed academic release.
**Secondary (only if TREC is insufficient for a specific frame):** CHILDES adult-child transcripts · matched via lookup.
**Tertiary (edge cases only, flagged as author=me):** hand-crafted sentences for ablation edge cases · excluded from primary analysis.

### 7.2 · Size + composition

~150 sentences total (pilot per amendment #1 of v2):

| Category | Count | Source |
|----------|-------|--------|
| Wh-questions | 60 | TREC-10 (6 wh × 10 items) |
| Polar questions | 12 | TREC-10 |
| Negations | 12 | TREC-10 + CHILDES if needed |
| Conditionals | 12 | TREC-10 + hand-audited |
| Causal (because) | 12 | TREC-10 + hand-audited |
| Declaratives (non-question controls) | 24 | TREC-10 declarative subset |
| Paraphrase pairs | 18 | TREC-10 paraphrase pairs where documented |

### 7.3 · Held-out split

30% held-out (~45 sentences) selected by **stratified sampling** across each category to preserve category proportions.

### 7.4 · "Unseen combination" operational definition (per amendment #9)

A held-out sentence is **"unseen combination"** if the **lexical triple (wh-word, subject_NP_head_lemma, verb_lemma)** does not appear together in any training sentence.

**Verification procedure:**
1. Build the set of training triples: `T = {(wh, subj_lemma, verb_lemma) for s in training}`
2. Build held-out triples: `H = {(wh, subj_lemma, verb_lemma) for s in held-out}`
3. Compute intersection: `H ∩ T` must be empty.
4. If any held-out triple exists in T, **HARD STOP** — regenerate held-out with different triples.
5. Report the count of unique training triples and unique held-out triples.

This is stronger than "novel string" (trivially guaranteed by templates) and specifically prevents lexical-combination leakage.

---

## §8 · Representation levels · concrete definitions (per amendment #7)

Seven levels, each with a specific implementation and data source:

### L0 · Prior baseline (chance)
Chance rate = 1/K for K categorical classes per dimension.

### L1 · Letter (character bag)
Bag-of-characters feature vector. Naive-Bayes classifier over character frequency.
**No LLM. No embedding.** Just character histograms.

### L2 · Letter n-gram
Character bigrams + trigrams. Same naive-Bayes over these features.

### L3 · Subword / morpheme
**Source: MorphoLex-en (Sánchez-Gutiérrez et al. 2018) · https://osf.io/wxcvj/**
Fallback: hand-audit against **Etymonline** (https://www.etymonline.com) for the 9 target words + subject NPs + verbs · decomposition table committed to disk with source URLs cited per entry.

For each word, extract morpheme sequence (e.g., "why" → [wh-, -y] or [why] as monomorphemic per source; "because" → [be-, cause] per Etymonline).

L3 classifier: naive-Bayes over morpheme identity features.

### L4 · Whole word (lexeme)
Bag of lemmas. Lemmatisation via a simple deterministic table (no LLM).

### L5 · Word + position
Lemma + slot-index (1st token, 2nd token, ...). Feature is (lexeme, position) pairs.

### L6 · Word + syntactic frame
Lemma + frame-tag (wh-fronted / polar-inverted / declarative / conditional / subordinate). Frame extracted by a small hand-written parser (no LLM).

### L7 · Word + frame + context
Level 6 + preceding sentence lemmas (if any · in Phase 2 most sentences are standalone so L7 ≈ L6 for most).

**For every level, the classifier is deterministic and reversibly inspectable.** No parameters trained by gradient descent. No embeddings from pretrained models.

### 8.4 · Comparison controls (§8 of v2 · retained)

- Strategy A · Within-wh swap
- Strategy B · Paraphrase pairs in matched frames
- Strategy C · Position swap
- Strategy D · Content-word declarative parallel

Each strategy tests a NARROW claim (documented in v2 §10). No single strategy tests "wh-class vs. non-wh-class" — see §17.2 fundamental limit.

---

## §9 · Ablation matrix (revised per amendments #4, #5, #6)

### 9.1 · Lexical ablation family (Lex)

- **A1 · mask leading lex:** "Why did the machine stop?" → "[MASK] did the machine stop?"
- **A5 · matched-frequency content-word swap:** "Why" → "because" as leading (produces marginal grammaticality · flagged)
- **A6 · bare wh-word only:** "Why?" (minimal context)

### 9.2 · Orthographic ablation family (Ortho) · per amendment #4

- **A7 · scramble letters within lex:** "why" → "yhw" (nonce · same char set · scrambled)
- **A8 · matched-length nonce substitution:** "why" → "kob" (nonce · same length · random chars from unused inventory)
- **A9 · WH-MORPHEME REMOVAL WITH NONCE PADDING** (redesigned per amendment #4):
  - "why" → "xy" (2 nonce chars replace "wh-" prefix)
  - "what" → "xat"
  - "where" → "xere"
  - "when" → "xen"
  - "which" → "xich"
  - "how" → "xow" (note: "how" is historically wh- but orthographically not · included for symmetry)
  
  **All A9 outputs are guaranteed nonces** · verified against dictionary before use.
  
  This isolates "presence of wh- prefix" as a manipulable variable while producing consistent nonce outputs.

### 9.3 · Structural ablation family (Struct)

- **A2 · mask subject NP:** "Why did [MASK] stop?"
- **A3 · mask verb:** "Why did the machine [MASK]?"
- **A4 · reorder to non-canonical position:** "The machine stopped why?" (marginally grammatical · flagged)

### 9.4 · Contextual ablation family · DEFERRED per amendment #6

Contextual ablation (A10 · A11) is **dropped from Phase 2** because the 150-sentence corpus is standalone-only and adding context-embedded sentences dilutes primary lexical/structural signal at pilot N.

Deferred to Phase 3 or a future contextual experiment. Phase 2 report will state this explicitly and NOT claim to have measured contextual effects.

### 9.5 · δ measurement per family

- δ_Lex(dim) = accuracy(A0) − mean-accuracy over {A1, A5, A6} on dim
- δ_Ortho(dim) = accuracy(A0) − mean-accuracy over {A7, A8, A9} on dim
- δ_Struct(dim) = accuracy(A0) − mean-accuracy over {A2, A3, A4} on dim
- δ_Context: not measured (see §9.4)

Relative magnitudes across families answer the central research question §2.

---

## §10 · 12-confound matrix · methods per confound (per amendment #8)

For every observed effect, apply the specified control method. Effects that vanish under control are reported as confounded.

| # | Confound | Method for this experiment |
|---|---------|---------------------------|
| 1 | Word frequency (COCA tier) | **Stratified analysis** · report effect within each of {high, mid, low} frequency tier |
| 2 | Word length (chars) | **Matched-subset comparison** · effect within same-length subset when N permits · otherwise regression covariate |
| 3 | Character frequency in corpus | **Post-hoc regression covariate** · with under-power warning if residual d.f. thin |
| 4 | Letter position | **Stratified by position** · initial vs. medial vs. final |
| 5 | Phonology | **Not controlled · fundamental limit** · reported per §17.1 |
| 6 | Morphology (wh-family) | **Matched-subset critical method:** compare within wh-family vs. within non-wh-family control set (from 01A extended corpus). This is the load-bearing confound for 01A. |
| 7 | Syntactic frame | **Stratified by frame type** {wh-fronted, polar, declarative, ...} |
| 8 | Semantic relatedness | **Qualitative discussion only** · N too small for formal control · disclosed |
| 9 | Historical word family | **Same method as morphology** · wh-family etymology overlap addressed via matched-subset |
| 10 | Orthographic convention | **Reported not controlled** · flagged as limitation |
| 11 | Context | **Not applicable** · Phase 2 corpus is standalone |
| 12 | Training frequency in corpus | **Matched-subset** · high-training-count items vs. low-training-count items |

**Effect-survival criterion:** an effect is "survives confound audit" only if its point estimate + 95% CI remains outside the null after applying the corresponding control method for the relevant confound.

---

## §11 · Baselines (v3 · Baseline B mapping specified per amendment #2)

### 11.1 · Baseline definitions

- **Baseline A · Surface string matching.** First-token prefix check. Predict question_operator = FIRST_TOKEN if in wh-set, else NONE. Zero linguistic reasoning.
- **Baseline B · Existing NEX1 native interpretation stack.** 11-module reachable-path (§13 of v2 · unchanged inventory).
- **Baseline C · New compositional mechanism.** ~300 LOC deterministic module to be built in Slice 4.

### 11.2 · Baseline B output → gold mapping (per amendment #2)

**Load-bearing table.** Without this, Baseline B accuracy is not measurable.

| NEX1 module | Output field | Maps to gold dimension | Mapping rule |
|-------------|-------------|----------------------|--------------|
| `parseIntent` (nex/language/intent-parser) | `intent_slug` | question_operator (partial) | slug=`explain` → operator likely WHY/HOW/WHAT · slug=`small_talk` → operator=NONE · other slugs → operator=NONE (declarative) |
| `parseIntent` | `intent_slug` | expected_answer_type (partial) | slug=`explain` → REASON/DESC · slug=`fix_bug` → N/A · other slugs → N/A |
| `parseIntent` | `trigger_matches` | target (partial) | best-match noun in trigger_matches → target · if none → UNKNOWN |
| `classifyFounderIntent` (capability-a-founder-intent) | `verb_family` | question_operator (partial) | family=INVESTIGATE → WHY/HOW/WHAT · family=FIX → operator=NONE (declarative) · family=BUILD → operator=NONE |
| `classifyFounderIntent` | `deliverable_kind` | expected_answer_type (partial) | deliverable=`function` → ENTITY · deliverable=`documentation` → DESCRIPTION · else N/A |
| `classifyFounderIntent` | `file_references[]` | target (partial) | first file_reference.path.basename → target · else UNKNOWN |
| `isChatOnlyIntent` (capability-nex1-persona) | boolean | question_operator (partial) | true → operator=NONE (chat) · false → defer to other modules |
| `matchQuestion` (nex/language/question-resolver) | `question_type` (if returned) | question_operator (direct) | direct passthrough where the shape matches |
| `capability-conversation-detectors.detectPreference` | boolean | polarity | preference detected → POSITIVE · not detected → passthrough |
| `capability-conversation-detectors.detectCorrection` | boolean | polarity | correction detected → NEGATIVE (implicit) · else passthrough |
| `lookupParaphrase` (capability-paraphrase-library) | `target_slug` | question_operator + expected_answer_type | slug=`fix_bug` → operator=NONE + type=N/A · slug=`explain` → operator=WHY/HOW + type=REASON/DESC |

**Composition rule:** for each gold dimension, take the outputs of the relevant modules in the order listed above. First non-UNKNOWN output wins. If all output UNKNOWN, Baseline B outputs UNKNOWN for that dimension.

**Slice 0 will produce this exact mapping table as a runtime artefact** · verified against actual module output shapes before Slice 2 measurement.

**Comparison-fairness rule** (per amendment #2 concern):
- Baseline C vs. Baseline B compared dimension-by-dimension.
- Baseline C must exceed Baseline B on **at least 3 of 6 dimensions with effect size δ > 5pp and 95% CI not crossing zero** to be considered "measurably exceeds".
- Dimensions where Baseline B outputs UNKNOWN in ≥ 80% of cases are marked "no baseline signal" and Baseline C's performance is reported without comparison for that dimension.

---

## §12 · Experiment 01A · orthographic branch (revised per amendments #1 · #5)

### 12.1 · Scope (narrowed)

Research question 01A: **"Does the wh- prefix morpheme carry predictive information for question_operator and expected_answer_type beyond the whole-word representation?"**

### 12.2 · Corpus addition for 01A confound isolation

To break the wh-family confound (§10 confound #6), 01A uses an **augmented corpus** adding:

- **Non-wh interrogative-like structures:** polar questions ("Is the machine broken?") · imperative-style ("Tell me about the machine.")
- **Non-interrogative w-words (matched controls):** sentences using "way", "want", "work", "wander", "whip", "whisper" in declarative frames · 12 sentences
- **Non-w interrogative fronted words:** "how" (already in corpus · phonologically wh- but orthographically h-) · this becomes an orthography-vs-morphology dissociation test

Augmented corpus size: 150 + 12 additional = 162 sentences. All derived from Li & Roth or hand-audited controls (flagged accordingly).

### 12.3 · 01A specific tests

- **Test 12a:** L3 (subword) accuracy on wh-family vs. L4 (whole word) accuracy on wh-family. Δ_L3 measures marginal information from wh- morpheme.
- **Test 12b:** L3 accuracy on wh-family words vs. L3 accuracy on non-wh-family words (using non-interrogative w-words as control). If Δ_L3 is large for wh-family AND small for non-wh w-words, the effect is morpheme-specific not just letter-cluster-specific.
- **Test 12c:** L3 on "how" (phonologically wh-, orthographically h-) vs. L3 on "why" (orthographically wh-). If "how" and "why" pattern together, effect is phonological/morphological. If they diverge, effect is orthographic.

### 12.4 · What 01A cannot conclude (per amendment #3)

01A cannot answer the general letter-pair hypothesis (ss / ie / etc.). That is Experiment 01B, out of Phase 2 scope.

---

## §13 · Statistical analysis plan (per amendment #10)

### 13.1 · Descriptive statistics (primary)

For each cell (dimension × ablation × level × frame):
- N observations
- Accuracy point estimate
- 95% bootstrap CI (10,000 resamples · percentile method)
- False-interpretation rate
- Unknown-rate

### 13.2 · Effect sizes

- Categorical: **odds ratios** with 95% CI (Wilson score)
- Continuous (accuracy differences): **Cohen's d** with 95% CI
- CI method: **bootstrap** (nonparametric · handles small N and non-normal distributions)

### 13.3 · Inferential tests (secondary · under-power disclosed)

Mixed-effects logistic regression per gold dimension:
- Outcome: accuracy_i (binary correct/incorrect per sentence i)
- Fixed effects: lexeme · frame · ablation-family
- Random effect: sentence-id (repeated observations across ablations of same sentence)
- Model: `glmer(correct ~ lexeme * ablation + frame + (1|sentence_id), family=binomial)`

### 13.4 · Multiple-comparison correction

**Benjamini-Hochberg FDR at q=0.10** applied across the family of tests within each dimension. Less conservative than Bonferroni for exploratory research · reported as such.

Expected test family size: ~50 per dimension (9 lexemes × 3 ablation families + interactions) · 6 dimensions × 50 = ~300 tests. FDR essential.

### 13.5 · Assumption checks

Before running each regression:
- Check for perfect separation (perfect predictors)
- Check convergence
- Check residual degrees of freedom (≥ 10 events per predictor · rule-of-thumb)
- If any fails: **report descriptive-only** for that dimension, no inferential claim

### 13.6 · Under-power disclosure

The final report will state per dimension: number of observations, number of predictors, whether the analysis is under-powered by rule-of-thumb, and what claims can vs. cannot be made from the available N.

---

## §14 · Mechanism (Baseline C) specification (per amendment #5)

### 14.1 · Behavior on known lexemes

Look up lexeme in dictionary · retrieve declared properties · compose with frame parser output.

### 14.2 · Behavior on unknown lexemes (per amendment #5)

If the mechanism encounters a lexeme not in its dictionary:
- **question_operator** = UNKNOWN (unless frame parser gives structural evidence, e.g., polar-inversion)
- **expected_answer_type** = UNKNOWN
- **target** = extract from structural context if possible (subject NP typically), else UNKNOWN
- **event** = extract from structural context if possible (main verb typically), else UNKNOWN
- **polarity** = extract from negation particles if present, else POSITIVE default
- **conditional** = extract from conditional connectives if present, else UNCONDITIONAL default

**No guessing.** UNKNOWN is a first-class output.

### 14.3 · Behavior on nonces (per amendment #4 · #5 combined)

Nonces from ablation A7/A8/A9 are treated as unknown lexemes per §14.2. They receive UNKNOWN for lexical properties. Structural extraction proceeds normally.

### 14.4 · Deterministic invariant

Same input → same output every call. No randomness. No stateful memory of prior sentences (mechanism is stateless per-sentence).

### 14.5 · Zero-LLM invariant

No embedding lookup. No API. No pretrained model. Pure symbolic computation over the dictionary + frame parser.

Runtime audit per §16 of v2 verifies at implementation time.

---

## §15 · Outcomes taxonomy + verdict mapping (per amendments #11, #14)

### 15.1 · 11-outcome verdict taxonomy (per amendment #14)

- **SUPPORTED** · hypothesis has convincing evidence across multiple criteria
- **PARTIALLY_SUPPORTED** · some criteria met, some not
- **NOT_SUPPORTED** · mechanism did not exceed baseline on relevant dimensions
- **INSUFFICIENT_EVIDENCE** · N too small / CIs too wide to conclude
- **NO_GENERALISATION** · mechanism works on training only, fails held-out
- **MORPHOLOGY_EXPLAINS_EFFECT** · apparent letter/subword effect disappears when wh-family morphology is controlled
- **FREQUENCY_EXPLAINS_EFFECT** · apparent effect disappears when word frequency is controlled
- **STRUCTURE_EXPLAINS_EFFECT** · apparent lexical effect disappears when syntactic frame is controlled
- **CONTEXT_EXPLAINS_EFFECT** · not testable in Phase 2 (deferred)
- **ORTHOGRAPHIC_EFFECT_NOT_FOUND** · L1/L2 information contribution is null after controls
- **FUNDAMENTAL_LIMIT_HIT** · a limit like phonology-inseparability or wh-vs-non-wh comparison prevents the intended test

### 15.2 · Verdict mapping table (per amendment #11)

| Baseline C exceeds B? | δ_Lex > δ_Ortho > δ_Struct? | Δ_L3 (subword) > 0 with CI? | Confound audit: effects survive? | Held-out ≥ Baseline A + 10pp? | Verdict |
|----------------------|--------------------------|----------------------------|---------------------------------|-------------------------------|---------|
| Yes on ≥3 dims | Any order | Any | Yes | Yes | SUPPORTED (specify hypothesis form) |
| Yes on ≥3 dims | Any | Any | Yes | No | PARTIALLY_SUPPORTED (no generalisation) |
| Yes on ≥3 dims | Any | Any | No | Yes/No | *_EXPLAINS_EFFECT (specify which confound) |
| Yes on ≥3 dims | Any | Yes without controls / No with controls | No | Any | MORPHOLOGY_EXPLAINS_EFFECT (specific to 01A) |
| No | Any | Any | Any | Any | NOT_SUPPORTED |
| Any | Any | Any | Any | Any (CIs wide) | INSUFFICIENT_EVIDENCE |
| Held-out generalisation fails specifically | Any | Any | Any | Definite No | NO_GENERALISATION |
| L1/L2 accuracy ≤ chance + 5pp | — | Δ_L1/L2 ≤ 0 | — | — | ORTHOGRAPHIC_EFFECT_NOT_FOUND (for 01A) |
| Any | — | — | — | — | FUNDAMENTAL_LIMIT_HIT (if design limits prevent conclusion · specify) |

The verdict is derived mechanically from the evidence pattern · not from post-hoc interpretation.

---

## §16 · Hard-stop conditions (unchanged from v2)

Stop and report NOT_SUPPORTED / INSUFFICIENT_EVIDENCE / FUNDAMENTAL_LIMIT_HIT if:

1. Corpus fails ground-truth review after 10% audit
2. Gold and mechanism turn out circular after Slice 4 review
3. Held-out combinations turn out to be present in training (§7.4 verification fails)
4. Baseline C does not measurably exceed Baseline B per §11 comparison rule
5. Hidden LLM path detected in zero-LLM audit
6. Ablation effects vanish under §10 confound audit
7. Statistical evidence is genuinely insufficient (all CIs wide)

---

## §17 · Fundamental limits (per amendments #13, #17)

These are irreducible limits of the design. The final report will state them and NOT claim to have measured what they preclude.

### 17.1 · Phonology cannot be isolated (per amendment #13)

English orthography and phonology are correlated but not identical. A text-only mechanism with text-only inputs cannot distinguish them. Any apparent "letter-level effect" could reflect orthography, phonology, morphology, or lexical family. Test 12c ("how" vs. "why") provides partial dissociation but not complete.

The Phase 2 report WILL NOT claim to have measured phonological effects. Where phonology is a plausible alternative explanation, this is stated explicitly.

### 17.2 · Wh-class-vs-non-wh-class comparison is not possible in English (per amendment #17)

Wh-words occupy a syntactic slot that no non-wh-word can occupy grammatically without producing marginal or ungrammatical sentences. Therefore Phase 2 cannot cleanly compare "wh-word class as a whole vs. non-wh-word class as a whole" in the same syntactic slot.

Comparisons that appear to test this (control strategy D · content-word declarative parallel) actually test different speech acts (interrogative vs. declarative), which is a different question.

The Phase 2 report WILL NOT claim to have measured the wh-class-vs-non-wh-class contrast.

---

## §18 · Bias disclosures (retained + expanded)

1. Single-annotator gold labels (me) · pilot bias · mitigated by taxonomy derivation + freeze + 10% audit.
2. Fixture-based corpus · derived from Li & Roth (2002) TREC-10 · not free-written · sentences carry provenance IDs.
3. English-only · cross-linguistic generalisation not tested.
4. Small N (~150) · under-powered for population inference · pilot only.
5. I am mechanism designer AND gold-label author · circularity mitigated by freeze + published taxonomy + explicit UNKNOWN + audit · not eliminated.
6. Phase 2 does NOT test letter-pair hypothesis (ss/ie) · deferred to 01B.
7. Phase 2 does NOT test contextual effects · deferred to Phase 3.
8. Phonology inseparable from orthography · fundamental limit (§17.1).
9. Wh-class-vs-non-wh-class not testable in English · fundamental limit (§17.2).

All 9 are reported in the final report's Limitations section.

---

## §19 · Isolation from production NEX1

```
src/lib/nex-agent/experiments/language-01/
  README.md
  fixtures/
    corpus.jsonl                     (150 sentences · TREC-derived · SHA-256 committed)
    corpus-01a-augment.jsonl         (12 additional for 01A · flagged provenance)
    gold-labels.jsonl                (6-dim gold · frozen · SHA-256 committed)
    subword-decomposition.jsonl      (MorphoLex-en + Etymonline · sources cited per entry)
    held-out.jsonl                   (30% stratified · verified per §7.4)
  policy/
    slice0-baseline-b-mapping.jsonl  (produced by Slice 0 · output→gold table)
  lexical-dictionary-v1.ts
  representation-levels/
    l1-letter-bag.ts
    l2-letter-ngram.ts
    l3-subword.ts
    l4-lexeme.ts
    l5-lexeme-position.ts
    l6-lexeme-frame.ts
    l7-lexeme-frame-context.ts   (Phase 2 · effectively same as l6 · no context corpus)
  compositional-mechanism-v1.ts    (Baseline C)
  baseline-a-surface-match.ts
  baseline-b-wrapper.ts            (11-module reachable path · READS production, never mutates)
  ablation-runner.ts               (Lex · Ortho · Struct families · 9 conditions)
  confound-audit-runner.ts         (12 confounds · 12 methods per §10.2)
  statistical-analysis.ts          (per §13)
  run-experiment.ts                (harness · slices 0-7)
data/nex-language-experiment-01/
  results/
    slice-{N}-{timestamp}.jsonl    (append-only · never overwritten)
  reports/
    phase2-report-{date}.md        (per mission §25 · 32 items)
```

Nothing in production is modified. Only Baseline B READS 11 modules · never mutates.

---

## §20 · Slices · execution order (unchanged from v2)

- Slice 0 · Reachable-path audit + Baseline B mapping (READ-ONLY · produces §11.2 table as runtime artefact)
- Slice 1 · Corpus + gold-labels + subword-decomposition (SHA-256 committed · verification per §7.4)
- Slice 2 · Baseline A + B measured against gold
- Slice 3 · Lexical dictionary v1
- Slice 4 · Compositional mechanism v1 (Baseline C · §14 spec)
- Slice 5 · Ablation matrix run + δ measurement
- Slice 6 · Experiment 01A + confound audit (§10.2 methods applied)
- Slice 7 · Phase 2 final report (32 items per mission §25)

Each slice has hard-stop conditions from §16. Any slice may terminate the experiment early.

---

## §21 · What I have NOT done in v3

- Not written any code.
- Not created any fixture, corpus, gold-label file, or mechanism.
- Not modified any production NEX1 code.
- Not defended v1/v2 designs against the audit · applied all 17 amendments honestly.
- Not softened any amendment to look smaller · CRITICAL items remain CRITICAL.
- Not claimed the design is ready for implementation without re-audit.

---

## §22 · Ready for re-audit

v3 applies all 17 amendments. Founder's stated preference (path 1) is to iterate design→audit until READY. This document is the input to the second audit.

**Next step:** re-audit v3 against the 14-point framework. If it passes, sign-off · begin Slice 0. If further amendments needed, revise to v4.

Zero implementation until re-audit passes and founder signs off explicitly.

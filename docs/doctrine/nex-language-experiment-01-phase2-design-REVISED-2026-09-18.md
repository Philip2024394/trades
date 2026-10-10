# NEX-LANGUAGE-EXPERIMENT-01 · Phase 2 · REVISED Experimental Design

**Date:** 2026-09-18
**Status:** REVISED DESIGN · pending founder sign-off before ANY implementation
**Revision reason:** 12-point founder amendment · corpus-as-pilot · control-word validation · incremental-information measurement · orthographic branch · 4-way ablation split · confound matrix · widened Baseline B · pilot-gate thresholds · central research question · implementation gate
**Author:** master_ai_engineer (Claude Opus 4.7)
**What this document is not:** implementation. §12 of the amendment mandates STOP after this revision.

---

## §0 · Amendment log (12/12 applied)

| # | Amendment | Where in this doc |
|---|-----------|-------------------|
| 1 | Corpus size 150 = pilot only · four evidence tiers | §5 |
| 2 | Single-annotator disclosed as pilot bias · post-hoc audit of 10% | §6 |
| 3 | Control-word validation table with honest verdict per pair | §8 |
| 4 | Incremental information measurement across representation levels | §9 |
| 5 | Orthographic Experiment 01A as separate exploratory branch | §12 |
| 6 | Ablation matrix split 4 ways (lexical · orthographic · structural · contextual) | §10 |
| 7 | 12-dimension confound matrix per claimed effect | §11 |
| 8 | Baseline B widened via audit of reachable native interpretation path | §13 |
| 9 | Thresholds = pilot gates · not scientific proof | §14 |
| 10 | Falsification: NOT_SUPPORTED reported honestly even after implementation | §15 |
| 11 | Central research question added | §2 |
| 12 | Implementation gate: revise · show tables · STOP | §17 |

---

## §1 · Hypotheses (unchanged from v1)

- **H0-weak** · closed-class / question operators may provide disproportionate information about utterance direction
- **H0-episodic** · some observations may carry disproportionate information in context
- **H0-structural** · direction is joint (word × structure × alternative-set × context)
- **H0-strong** · retained as falsifiable comparison null

---

## §2 · Central research question (per amendment #11)

> **At what representational level does reusable information about linguistic interpretation first become measurable: letter · letter-pair · subword · word · word+position · word+structure · word+context?**

This question must remain open. The experiment is designed to *discover* the answer, not confirm a pre-supposed one. Any of the seven levels (or NONE reaching pilot-gate) is a valid answer.

---

## §3 · Experimental variables

Independent Variables:
- **IV1 · Leading lexical operator** {why, what, where, when, how, which, not, if, because}
- **IV2 · Syntactic frame** {wh-question fronted, polar question, declarative, conditional clause, subordinate because-clause}
- **IV3 · Ablation condition** — see §10 (4-way split)
- **IV4 · Representation level** — see §9 (seven levels)
- **IV5 · Content-word swap** — see §8 (validation-first)

Dependent Variables — six-dimensional gold-representation match:
- DV1 · question_operator (categorical)
- DV2 · expected_answer_type
- DV3 · polarity
- DV4 · conditional-tag
- DV5 · target NP extraction
- DV6 · event verb extraction
- DV7 · unseen-combination generalisation rate
- DV8 · paraphrase interpretation consistency
- DV9 · false-interpretation rate
- DV10 · unknown/uncertain rate

Derived:
- δ_ablation(condition, dimension) — see §10
- Δ_level(N) = accuracy(level N) − accuracy(level N−1) — see §9

---

## §4 · Ground truth methodology (per amendment #2)

- Gold labels derived from **published taxonomies** (Li & Roth 2002 TREC-10 answer-type schema · Dowty 1991 proto-roles) — not invented for this experiment.
- Gold labels **written and committed BEFORE mechanism implementation** · SHA-256 recorded in the final report.
- **10% independent post-hoc audit** re-derived from Li & Roth TREC-10 published examples · disagreement rate reported.
- **Single-annotator pilot bias explicitly disclosed** in the final report's Limitations section. Not hidden.
- Explicit **UNKNOWN** state permitted on both gold and mechanism outputs.

---

## §5 · Corpus size + evidence tier framing (per amendment #1)

**Corpus: ~150 sentences.**

**This is a pilot corpus.** The final Phase 2 report will distinguish four evidence tiers explicitly:

| Tier | Definition | What this pilot can produce |
|------|-----------|---------------------------|
| Pilot evidence | Descriptive · N ~150 · single annotator · single environment | **YES** |
| Effect-size evidence | Effect sizes with confidence intervals · appropriately powered | Effect sizes reported with **wide CIs · noted as underpowered** |
| Inferential statistical evidence | Population-level claims with adequate N, replications | **NO** · not attempted |
| Replication evidence | Independent re-run with fresh annotator, corpus, mechanism | **NO** · out of scope for Phase 2 |

The report **will not** describe 150 sentences as sufficient for strong population-level statistical inference. Where any inferential test is under-powered, that is stated explicitly.

---

## §6 · Corpus construction (revised)

Same template-based generation as v1 but with additions:

- 60 wh-questions (6 wh × 5 subject-verb combos + tense variants)
- 12 polar questions
- 12 negations
- 12 conditionals
- 12 causal (because)
- 24 declaratives (as non-question controls)
- 18 paraphrase pairs
- **Frequency-matched fillers** for the confound audit (per §11)

**Held-out proportion: 30%** (per amendment #4). Held-out combinations are systematically generated as the cross-product of {subject × wh-word × verb} minus training set. Verification that held-out cases are actually absent from training is a hard-stop check (§16.3).

---

## §7 · Ground truth per sentence · six-field structured representation

Each sentence's gold label has this shape (JSONL row):

```jsonc
{
  "sentence_id": "wh-q-001",
  "text": "Why did the machine stop?",
  "gold": {
    "question_operator": "WHY",
    "expected_answer_type": "REASON",   // Li & Roth: DESC:reason
    "polarity": "POSITIVE",
    "conditional": "UNCONDITIONAL",
    "target": "machine",                 // NP head lemma
    "event": "stop"                       // verb lemma
  },
  "gold_source_reference": "Li_Roth_2002_TREC10_taxonomy · Dowty_1991_proto_roles",
  "naturalness": "NATURAL",              // NATURAL | MARGINAL | UNNATURAL
  "confound_flags": {
    "word_length_chars": [3, 3, 3, 3, 7, 4, 5],  // per-token
    "surface_frequency_tier": "high",
    "shares_wh_prefix": true             // wh-family marker
  },
  "training_set": true,                  // vs held-out
  "gold_sha256_group": "..."             // hash of the gold block
}
```

The gold-labels file will be committed to `data/nex-language-experiment-01/fixtures/gold-labels.jsonl` and its SHA-256 published in the final report **before** any mechanism runs.

---

## §8 · Control-word validation table (per amendment #3 · MOST IMPORTANT REVISION)

The v1 proposal treated the 9 proposed content-word matches as controls by assumption. That was wrong. Here is the honest linguistic audit per pair:

| Wh-word | Proposed control | Grammatical category | Syntactic behaviour | Semantic role | Morphology | Length | Approx. frequency (COCA) | Ambiguity | Match verdict |
|---------|-----------------|---------------------|--------------------|--------------|-----------|--------|------------------------|-----------|--------------|
| why | reason | interrogative adverb vs. **common noun** | fronts + triggers inversion vs. requires determiner | scope operator (CAUSE) vs. lexical CAUSE noun | monomorphemic | 3 vs. 6 chars | ~2.0M vs. ~1.0M | low vs. high (multiple senses) | **NOT MATCHED · category + distribution mismatch** |
| what | thing | interrogative determiner/pronoun vs. **common noun** | multiple positions vs. NP position | scope operator (ENTITY/DESC) vs. generic entity | monomorphemic | 4 vs. 5 chars | ~4.5M vs. ~1.5M | high (int / rel / excl / indef) vs. low | **NOT MATCHED · distribution mismatch** |
| where | place | interrogative adverb vs. **common noun** | fronts vs. NP position | scope operator (LOC) vs. lexical LOC noun | monomorphemic | 5 vs. 5 chars | ~1.5M vs. ~0.9M | low vs. moderate | **NOT MATCHED · category mismatch** |
| when | time | interrogative adverb vs. **common noun** | fronts vs. NP position | scope operator (TIME) vs. lexical TIME noun | monomorphemic | 4 vs. 4 chars | ~2.5M vs. ~2.8M | low vs. moderate | **NOT MATCHED · category mismatch** |
| how | way | interrogative adverb vs. **common noun** (secondary: adverbial "way too much") | fronts vs. NP position | scope operator (MANNER) vs. lexical MANNER noun | monomorphemic | 3 vs. 3 chars | ~2.5M vs. ~1.9M | low vs. high | **NOT MATCHED · category mismatch** |
| which | choice | interrogative determiner/pronoun vs. **common noun** | fronts + selective vs. NP position | scope operator (SELECTION) vs. lexical CHOICE | monomorphemic | 5 vs. 6 chars | ~1.4M vs. ~0.6M | moderate vs. low | **NOT MATCHED · category mismatch** |
| not | no | **sentential negation** vs. **NP-level negation (determiner)** | post-auxiliary vs. pre-nominal | sentence-scope NEG vs. NP-scope NEG | monomorphemic | 3 vs. 2 chars | ~5.5M vs. ~1.2M | low vs. low | **NOT MATCHED · scope mismatch (this is a real semantic difference)** |
| if | suppose | **subordinating conjunction** vs. **verb** (imperative or matrix) | clause-fronting vs. verb position | conditional operator vs. hypothesis-introducing verb | mono vs. bi | 2 vs. 7 chars | ~2.9M vs. ~0.3M | low vs. high | **NOT MATCHED · category + frequency mismatch** |
| because | since | subordinating conjunction (causal) vs. subordinating conjunction (**causal OR temporal**) | clause-introducing vs. clause-introducing | CAUSE-op vs. CAUSE-op OR TIME-op | monomorphemic | 7 vs. 5 chars | ~1.0M vs. ~1.7M | low vs. **moderate (polysemy)** | **CLOSEST MATCH · but polysemy mismatch** |

**Honest verdict:** 8 of 9 proposed pairs are NOT distributionally-matched controls. 1 pair (because/since) is closest but has polysemy mismatch.

**Consequence:** the v1 content-word swap experiment (Exp 2G · "replace WH_INITIAL with CONTENT_NOUN_INITIAL") produces largely ungrammatical output ("Reason did the machine stop?") that cannot be interpreted as a clean effect of "the word is not a wh-word".

**Revised control strategy** (in place of v1's confounded content-word swap):

### Control strategy A · Within-wh-word swap (clean control · same syntactic slot)

Swap wh-words within canonical fronted position and measure interpretation change:
- "Why did the machine stop?" ↔ "How did the machine stop?" ↔ "Where did the machine stop?" ...

Tests: does the specific wh-word predict a specific answer-type? Same syntactic frame, same target, same verb — only the leading operator changes.

### Control strategy B · Paraphrase pairs in matched frames (H0-structural test)

Compare wh-word to a paraphrase content-word phrase in an equivalent-force interrogative:
- "Why did the machine stop?" ↔ "For what reason did the machine stop?"
- "When did X arrive?" ↔ "At what time did X arrive?"

Tests: is interpretation preserved when the semantic force is carried by a paraphrase phrase instead of the single wh-word?

### Control strategy C · Position swap (H0-strong falsification)

Move the wh-word to non-canonical position:
- "Why did the machine stop?" ↔ "The machine did stop why?" (marginal grammaticality)
- "Why?" (bare · minimal context)

Tests: does the wh-word alone predict interpretation, or does canonical position matter?

### Control strategy D · Content-word declarative parallel (transparent-force check)

Compare wh-question to declarative with same propositional content, marked NATURAL but not directly compared:
- "Why did the machine stop?" [interrogative frame]
- "The reason the machine stopped was ..." [declarative frame · same propositional content · not the same speech act]

Tests: is direction detection about SPEECH ACT (interrogative vs. declarative) or about LEXICAL SEMANTICS?

**Ungrammatical direct-swap experiment is REMOVED** because the v1 proposal to compare "Why did X stop?" vs. "Reason did X stop?" measures grammaticality more than lexical directional force.

---

## §9 · Incremental information measurement (per amendment #4)

Primary metric: **accuracy at each representational level**. Derived metric: **incremental information contribution per level**.

Seven representational levels tested for each gold dimension (DV1-DV6):

| Level | Representation | Concrete definition |
|-------|----------------|-------------------|
| L0 | Prior baseline | Chance rate = 1/K for K classes |
| L1 | Letter (bag of characters) | Vector of character-count features |
| L2 | Letter n-gram | Character bigrams + trigrams |
| L3 | Subword | Morphological / prefix (e.g., "wh-", "-body") — enumerated in advance from a documented decomposition list |
| L4 | Whole word (bag of words) | Lexeme-only, order-agnostic |
| L5 | Word + position | Lexeme + slot (1st token, 2nd token, ...) |
| L6 | Word + syntactic frame | Lexeme + parsed frame (interrogative-fronted vs. polar-inverted vs. declarative) |
| L7 | Word + frame + context | Level 6 + preceding sentence / topic |

For each dimension X ∈ {question_operator, answer_type, polarity, conditional, target, event}:
- Measure accuracy(L_N, X) on training and held-out corpus
- Compute **Δ_N(X) = accuracy(L_N, X) − accuracy(L_{N−1}, X)**
- Report as a table: rows = levels, columns = dimensions

**What this measures:** the marginal information contributed by each representational level for each dimension. If Δ_L4 (word) is large for question_operator but Δ_L3 (subword) is also large — that would show the wh- prefix carries information independently.

**Concrete example format** (illustrative · not a prediction):

```
Dimension: question_operator
  L0 (prior baseline)     : 11%  (1/9)
  L1 (letter bag)         : 34%  · Δ = +23pp
  L2 (letter n-gram)      : 58%  · Δ = +24pp
  L3 (subword: wh-family) : 74%  · Δ = +16pp
  L4 (whole word)         : 88%  · Δ = +14pp
  L5 (word + position)    : 90%  · Δ = +2pp
  L6 (word + frame)       : 94%  · Δ = +4pp
  L7 (word + context)     : 95%  · Δ = +1pp
```

The above is NOT a prediction — it is the **format** the final report will use per dimension. The actual answers are the empirical output of the experiment.

**The central research question (§2) is answered by identifying the levels where Δ is largest.**

---

## §10 · Ablation matrix · 4-way split (per amendment #6)

The v1 seven-condition matrix is retained, but grouped explicitly into four families so each ablation isolates one information source:

| Family | Ablations | What each isolates |
|--------|-----------|-------------------|
| **Lexical ablation** | A1: mask leading lex · A5: replace leading lex with matched-frequency content word · A6: bare wh-word only ("Why?") | Effect of the specific lexical item |
| **Orthographic ablation** | A7: scramble letters within lexical item (preserving length) · A8: replace lexical item with same-length nonce (e.g., "why" → "myw") · A9: strip wh- prefix (e.g., "why" → "y", "what" → "at") | Effect of letter-level / subword information — pipes into Experiment 01A |
| **Structural ablation** | A2: mask subject NP · A3: mask verb · A4: reorder to non-canonical position | Effect of syntactic frame |
| **Contextual ablation** | A10: strip preceding context · A11: swap topic context (put question in irrelevant preceding-sentence context) | Effect of context/alternative-set |

**Per-family δ measurement:**
- δ_lexical(dim) = accuracy(A0) − accuracy(A1..A6)
- δ_orthographic(dim) = accuracy(A0) − accuracy(A7..A9)
- δ_structural(dim) = accuracy(A0) − accuracy(A2..A4)
- δ_contextual(dim) = accuracy(A0) − accuracy(A10..A11)

**The relative magnitudes of the four δ families answer the central research question** (§2). If δ_lexical > δ_structural, the lexical item does most of the direction-carrying work. If δ_structural > δ_lexical, structure does. If δ_orthographic ≈ 0 after controlling for word-identity, letters carry no information beyond word-identity. Etc.

Ablation conditions never conflate two families in a single manipulation.

---

## §11 · Confound matrix (per amendment #7)

For every claimed effect, the final report will audit against all 12 confound dimensions:

| # | Confound | How I will audit |
|---|---------|------------------|
| 1 | Word frequency | Report frequency tier per lexeme (COCA-based · high/mid/low) · check if effects correlate with frequency |
| 2 | Word length | Report char length per lexeme · check length-effect correlation |
| 3 | Character frequency | Compute character-level frequency in the pilot corpus · check if letter-effects trace to shared characters |
| 4 | Letter position | Report initial-letter clusters · flag wh-family prefix explicitly |
| 5 | Phonology | Report initial phone per lexeme · flag /w/ + /h/ prefix class |
| 6 | Morphology | Report morphological decomposition · specifically the "wh-" family (why, what, where, when, which, who) all share Old English hw- root · this is a HUGE confound for letter-level hypotheses |
| 7 | Syntax | Report syntactic distribution per lexeme (fronting · inversion · clause-initial) |
| 8 | Semantic relatedness | Report semantic-role vocabulary overlap |
| 9 | Historical word family | Report etymological family (wh-cluster shares Proto-Germanic *hw-) |
| 10 | Orthographic convention | Report standard-spelling patterns |
| 11 | Context | Report which contexts each lexeme appears in |
| 12 | Training frequency in corpus | Report per-lexeme count in training corpus |

**Critical prior confound (per amendment #7 · founder emphasis):** six of the nine target words (why, what, where, when, which — and how derives from Proto-Germanic *hwō) share the historical wh- morpheme. Any "letter-level" effect must be audited against this. If the mechanism appears to detect information from initial letters, the honest conclusion may be: **"morphology explains the observed effect"** rather than "letters carry semantic meaning."

For each claimed effect, the report will present the observed δ AND explicitly state whether the effect survives controls for each of the 12 confounds. Effects that disappear under confound-controls are reported as confounded, not as evidence.

---

## §12 · Experiment 01A · Orthographic branch (per amendment #5)

**Explicitly separated from the main experiment.** Same corpus infrastructure, different research question.

**Research question 01A:** does letter-level or subword-level information carry measurable predictive signal about linguistic function beyond what whole-word information carries?

**Method:** for each dimension DV1-DV6, compare classifier accuracy at L1 (letters) and L3 (subword) against L4 (whole word). Compute Δ_L1(dim) and Δ_L3(dim). Report each per confound-audited effect.

**Success criteria:**
- If Δ_L3 (subword) is substantial for question_operator BUT disappears after controlling for wh-family morphology → **"morphology explains the observed effect"** — reported as NOT-INDEPENDENT.
- If Δ_L1 (letters) is substantial for any dimension AND survives confound audit → **letter-level information genuinely carries signal** — reported as SUPPORTED.
- If both are ≈ 0 → **letters/subwords do not carry information independent of whole-word** — reported as NOT_SUPPORTED for 01A.

**No assumption** that letters have intrinsic semantic meaning. The experiment measures **predictive information**, not meaning.

**Not merged** with the main experiment. Both use the same corpus but produce independent reports.

---

## §13 · Baseline B · widened via reachable-path audit (per amendment #8)

Baseline B (existing NEX1 interpretation capability) must reflect the **actual reachable native interpretation path**, not one isolated file.

**Reachable-path audit (READ-ONLY · to be performed as slice 0 · no code changes):**

| Module | Reachable from user turn? | Relevant to language interpretation? | Included in Baseline B? |
|--------|--------------------------|-------------------------------------|-------------------------|
| `capability-a-founder-intent/classifier.ts` | Yes | Yes | ✓ |
| `nex/language/intent-parser.ts` (`parseIntent`) | Yes | Yes | ✓ |
| `nex-agent/language/code-intent-registry.ts` | Yes | Yes | ✓ |
| `nex-agent/language/capability-nex1-persona.ts` (`isChatOnlyIntent`) | Yes | Yes (question vs. chat) | ✓ |
| `nex-agent/language/capability-ambiguity-resolver.ts` | Yes | Yes | ✓ |
| `nex-agent/language/capability-clarification-resolver.ts` | Yes | Partial | ✓ |
| `nex-agent/language/capability-paraphrase-library.ts` | Yes | Yes | ✓ |
| `nex-agent/code-engine/capability-conversation-detectors.ts` | Yes | Partial (preference/correction detection) | ✓ |
| `nex/language/concept-resolver.ts` | Yes | Yes | ✓ |
| `nex/language/question-resolver.ts` (`matchQuestion`) | Yes | **Directly** | ✓ · load-bearing |
| `nex/language/normaliser.ts` | Yes | Yes | ✓ |

**Baseline B implementation:** a read-only wrapper that runs each corpus sentence through the reachable path and captures the STRUCTURED OUTPUT (intent_slug from parseIntent · verb_family from classifier · chat_only from persona · ambiguity_options · paraphrase_hit · question resolution). Map those outputs to the six gold dimensions. Measure Baseline B accuracy against gold.

**Nothing in production NEX1 is modified.** Baseline B is a diagnostic read of what NEX1 already does.

**If Baseline C does not measurably exceed Baseline B** (the wider audit-based one), the experiment reports NOT_SUPPORTED per §15.

---

## §14 · Thresholds as pilot gates (per amendment #9)

The v1 thresholds (L1=85% · L2=70% · L3=60% · L4=memorisation-gap≤20pts) are **retained as pilot gates**, not scientific proof:

> "L1 threshold met under this experimental corpus and protocol."

They are **not** rewritten as: "L1 = 85% therefore language understanding is achieved."

The final scientific conclusion depends on the complete evidence per §15:
- accuracy · effect size · generalisation · ablation · controls · unseen combinations · replication where available · failure cases

Individual pilot gates being met does NOT constitute a proof claim. The complete pattern of evidence does.

---

## §15 · Falsification commitment (confirmed per amendment #10)

**Confirmed. NOT_SUPPORTED is a valid outcome.**

If any of the following is observed after implementation, the final report says NOT_SUPPORTED (or PARTIALLY_SUPPORTED as appropriate):

- Baseline C accuracy ≤ Baseline B accuracy on the same held-out set (mechanism produces no new signal)
- δ_lexical(question_operator) is not significantly greater than δ_orthographic OR δ_structural (i.e., the wh-word alone does not carry disproportionate information after controls)
- Held-out unseen-combination accuracy ≤ chance + baseline B (mechanism did not generalise)
- All observed effects disappear under the 12-dimension confound audit (§11)
- Any hidden LLM path is detected in the zero-LLM audit

I will NOT rescue the hypothesis by changing the evaluation after seeing the results. Gold labels are frozen (SHA-256 recorded) before mechanism runs.

---

## §16 · Hard-stop conditions (unchanged from v1 · re-verified)

Stop and report NOT_SUPPORTED or INSUFFICIENT_EVIDENCE if:

1. Corpus fails ground-truth review after 10% audit
2. Gold and mechanism turn out circular in structure
3. Held-out combinations turn out to be present in training after review
4. Baseline C does not measurably exceed Baseline B on same test set
5. Hidden LLM path detected
6. Ablation effects disappear under confound audit
7. All CIs cross zero / include baseline

---

## §17 · Implementation gate (per amendment #12)

**STOP here. Do not write implementation code until founder explicitly approves this revised design.**

Concretely, the founder needs to review and approve:

1. **§8 · Control-word validation table** — including the honest verdict that 8 of 9 pairs are NOT matched controls, and the revised control strategy A/B/C/D.
2. **§9 · Incremental information measurement** — the seven representation levels and the Δ-per-level reporting format.
3. **§10 · 4-way ablation split** — lexical · orthographic · structural · contextual as isolated families.
4. **§11 · 12-dimension confound matrix** — particularly the wh-family morphological confound that could explain "letter-level" effects.
5. **§12 · Experiment 01A orthographic branch** — separate report from main experiment.
6. **§13 · Baseline B widening** — 11-module reachable-path audit rather than single-file baseline.
7. **§14 · Pilot-gate framing** — thresholds are engineering gates, not scientific proof.
8. **§2 · Central research question** — at what level does reusable information first become measurable.

---

## §18 · What follows approval

If approved, implementation order (unchanged from v1 · numbered slices):

- **Slice 0 · Reachable-path audit for Baseline B** (per §13 · READ-ONLY · no code changes · produces module inventory)
- **Slice 1 · Corpus + frozen gold labels** (SHA-256 committed · 150 sentences · 6 gold dimensions each · plus confound_flags per sentence)
- **Slice 2 · Baseline A + Baseline B measured** (no new mechanism yet · numbers vs. gold)
- **Slice 3 · Lexical dictionary v1** (properties for the 9 target words per §8 audit)
- **Slice 4 · Compositional mechanism v1** (~300 LOC · deterministic · zero-LLM · Baseline C)
- **Slice 5 · Ablation matrix run** (four families · confound audit applied)
- **Slice 6 · Experiment 01A orthographic branch** (levels L1-L3 measurements)
- **Slice 7 · Phase 2 final report** per mission §25 (32 items)

Each slice is verifiable and reversible. Each slice may reach a hard-stop and terminate the experiment early.

---

## §19 · What has been demonstrated vs. what has not

**Demonstrated in this revision:**
- 8 of 9 proposed control pairs are NOT distributionally matched (§8 audit)
- Alternative control strategies A/B/C/D are available and are honest
- 7 representation levels give a decomposition that answers the central research question
- 4-way ablation split isolates information sources cleanly
- 12-confound matrix names the load-bearing risks (wh-family morphology being the biggest)
- Baseline B needs to be an 11-module audit not a single-file wrapper

**NOT yet demonstrated:**
- That the mechanism will exceed Baseline B (that is what the experiment measures)
- That letters do or do not carry measurable predictive information (that is 01A's question)
- That structure carries more information than words (that is what Δ per level measures)
- That NEX1 can generalise beyond memorisation (that is the unseen-combination test)

Zero implementation. Zero claim. All four questions are open.

---

## §20 · Ready for review

Waiting for founder approval of §17 items 1-8. If approved with amendments, further revision. If rejected, the experiment is abandoned or re-scoped.

**No code will be written until approval is explicit.**

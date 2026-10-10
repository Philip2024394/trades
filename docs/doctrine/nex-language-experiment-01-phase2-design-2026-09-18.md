# NEX-LANGUAGE-EXPERIMENT-01 · Phase 2 · Experimental Design Document

**Date:** 2026-09-18
**Status:** DESIGN DOC · pending founder sign-off before implementation
**Prerequisite:** Phase 1 research report (2026-09-18) already delivered
**Discipline:** §3 of Phase 2 brief · no code until this document is documented and approved
**Author:** master_ai_engineer (Claude Opus 4.7)

---

## §0 · What this document is

Per your Phase 2 §3:

> "No code should be written until this experimental design is documented."

This document specifies the 9 items §3 demands (variables · controls · ground truth · baselines · measurements · ablations · success · failure · falsification), plus the corpus design, statistical plan, bias disclosures, and the hard-stop conditions I've internalised from §26.

It does not propose an implementation. It specifies **what the implementation must satisfy** before I write it.

---

## §1 · Hypotheses under test (from §1 of your brief · verbatim + falsifiable comparison)

**H0-weak (probabilistic lexical privilege):**
Some linguistic items — particularly closed-class function words and question operators — may provide disproportionately useful information for identifying utterance direction or operation.

**H0-episodic (information concentration):**
Some observations/tokens may carry disproportionately large amounts of information in particular contexts.

**H0-structural (word + structure + context + alternatives):**
Interpretation direction is a joint property of (lexical item × syntactic frame × alternative set × context/prior) rather than an isolated property of the word.

**H0-strong (falsifiable comparison · retained as a null):**
A single word carries decisive direction independent of structure and context.

The experiment must produce evidence that supports, weakens, or is neutral toward each of these four. Any of the four outcomes (SUPPORTED · PARTIALLY_SUPPORTED · NOT_SUPPORTED · INSUFFICIENT_EVIDENCE) is a valid scientific result per §18.

---

## §2 · Central measurement question (from your addendum)

> **Test whether lexical items have measurable directional influence over interpretation.**

**Operationalisation** — "measurable directional influence" is defined here as:

> The presence of a specific lexical item L in position P of sentence S changes the predicted interpretation I by an amount δ > 0, where δ is measured against a baseline in which L is either masked, ablated, or replaced by a matched content-word control.

**δ is a change in structured-representation accuracy**, not a change in string output.

The five dimensions of "interpretation" I will measure per sentence:

| Dimension | Values (categorical) |
|-----------|---------------------|
| question_operator | WHO · WHAT · WHERE · WHEN · WHY · HOW · WHICH · POLAR · NONE (declarative) |
| expected_answer_type | HUM · ENTY · LOC · DATE/TIME · REASON · MANNER · SELECTION · YES/NO · DESCRIPTION · N/A |
| polarity | POSITIVE · NEGATIVE |
| conditional | UNCONDITIONAL · IF-CONDITIONAL · BECAUSE-CAUSAL |
| target | (the noun-phrase the question is about · e.g. "price" · "machine") |
| event | (the verb / action · e.g. "increase" · "stop") |

These six fields form the **gold representation** for each sentence. See §5 for how gold is authored to avoid circularity.

---

## §3 · Experimental variables

**Independent Variable 1 (IV1) — Leading lexical operator.** Values: the 9-item vocabulary from your §1.3 · plus content-word controls (see §7). Levels: {why, what, where, when, how, which, not, if, because, +content_controls}.

**Independent Variable 2 (IV2) — Syntactic frame.** Values: {wh-question-fronted, polar-question, declarative, conditional-clause, subordinate-because-clause}.

**Independent Variable 3 (IV3) — Ablation condition.** Values per §11 of your brief: {NONE (control), MASK_LEADING_LEX, MASK_CONTENT_WORD, MASK_SYNTACTIC_CUE, REORDER_STRUCTURE, REPLACE_ALT_SET, PARAPHRASE_REWORDING}.

**Independent Variable 4 (IV4) — Content-word swap condition** (for Experiment 2G). Values: {WH_INITIAL, CONTENT_NOUN_INITIAL, NEUTRAL_INITIAL}.

**Dependent Variables:**
- DV1: question_operator accuracy (categorical match)
- DV2: expected_answer_type accuracy
- DV3: polarity accuracy
- DV4: conditional-tag accuracy
- DV5: target extraction accuracy (exact-string or lemma match)
- DV6: event extraction accuracy
- DV7: unseen-combination generalisation rate
- DV8: paraphrase interpretation consistency
- DV9: false-interpretation rate (positive answer when input is ambiguous)
- DV10: unknown/uncertain rate (mechanism explicitly returns UNKNOWN)

**Derived measures:**
- δ_ablation(condition) = DV_X(no ablation) − DV_X(ablation) · per dimension
- If δ_ablation(MASK_LEADING_LEX) > δ_ablation(MASK_CONTENT_WORD) with p < 0.05 and effect size d ≥ 0.5 → weak support for H0-weak.
- If DV1 conditioned on IV2 (frame) shows interaction with IV1 (lexical) → support for H0-structural.

---

## §4 · Controls

**Control 1 · Content-word baseline** (for Exp 2G): 9 matched content-word variants (e.g., swap "why → reason", "what → thing", "where → place", "when → time", "how → way", "which → choice", "not → no", "if → suppose", "because → since"). Some of these will produce ungrammatical sentences · those cases are excluded and their exclusion is reported in the final report (§25.6 of your brief).

**Control 2 · Minimally-paired sentence pairs.** Every experimental sentence is paired with a version differing in exactly one word. "Why did the machine stop?" pairs with "How did the machine stop?" and with "Where did the machine stop?" · all 9 wh-word variants of each frame.

**Control 3 · Randomised presentation order.** Test items are shuffled deterministically via a seeded PRNG · seed committed to the fixture file · so ordering can be replayed.

**Control 4 · Gold-label freeze.** Gold labels are written and committed to disk **BEFORE** the mechanism is implemented. File hash captured in the design doc for tamper-detection. Mechanism cannot influence gold labels because gold exists first.

**Control 5 · Confound audit.** For every observed effect I will explicitly consider (per §5 of your brief) alternative explanations: grammaticality, sentence naturalness, word frequency, sentence length, ambiguity. These are reported alongside the effect · not silently ignored.

---

## §5 · Ground truth methodology · avoiding circularity

**Circularity risk:** I am writing the gold labels AND the mechanism. This is a genuine bias hazard the mission (§26) explicitly names as a hard-stop.

**Mitigations:**

1. **Gold labels are derived from published linguistic taxonomies**, not invented for this experiment. Primary references:
   - Li, X. & Roth, D. (2002). *Learning Question Classifiers* · COLING 2002 · https://aclanthology.org/C02-1150/ — for the answer_type coarse taxonomy (HUM · ENTY · LOC · NUM · DESC · ABBR)
   - Dowty, D. (1991). *Thematic Proto-Roles and Argument Selection* · Language 67 — for semantic role framework
   - Payne (semantic vs grammatical roles) · Van Valin RRG — for the split between roles

2. **Gold labels are written and committed BEFORE mechanism code.** SHA-256 of the labels file is recorded in the final report. Any post-hoc gold-label adjustment invalidates the run.

3. **Gold-label spot-check.** A 10% random sample of gold labels will be re-derived independently (from published paraphrase examples in Li & Roth's TREC-10 corpus) to validate consistency.

4. **Sentence naturalness screen.** Every corpus sentence will be marked with a naturalness flag (NATURAL · MARGINAL · UNNATURAL). Unnatural sentences are excluded from primary analysis and reported separately.

5. **Explicit UNKNOWN state.** The mechanism must be able to output UNKNOWN for underdetermined cases. Gold labels also carry UNKNOWN where linguistic taxonomy is genuinely uncertain (e.g., "What is happening?" · answer_type = ENTY OR DESC · both are valid per Li & Roth).

**What this does not eliminate:** I remain the sole gold-label author. That is a real limit; the final report will disclose it in §12 (limitations). A more rigorous version of this study would have a second linguistically-trained annotator. That is not available in this environment · disclosed honestly.

---

## §6 · Baselines (from §15 of your brief)

**Baseline A · Surface string matching.**
Predict `question_operator` = FIRST_TOKEN if the first token is in {why, what, where, when, how, which} else NONE. Zero linguistic reasoning · pure prefix check.

**Baseline B · Existing NEX1 deterministic classifier.**
Use `capability-a-founder-intent/classifier.ts` (existing zero-LLM) to classify each sentence. Compare its verb_family / deliverable_kind / etc. outputs against gold. This is the pre-experiment NEX1 capability level.

**Baseline C · New compositional mechanism (this experiment).**
The small deterministic module I will build in Phase 2 implementation · lexical dictionary + structural composer + explicit UNKNOWN.

**Ceiling reference (not a baseline · for scale):**
Li & Roth 2002 reported 91% coarse-class accuracy on their TREC-10 test set using SNoW classifier + hand-designed features. Any modern LLM would be higher. **NEX1 is not competing on that dimension** · the experiment is about *what specific evidence of directional influence can we detect*, not about beating LLMs.

**Comparison rule:** If Baseline C does not measurably exceed Baseline B on the same test set, the new mechanism has not demonstrated new capability and Phase 2 is a NOT_SUPPORTED result. This is a genuine risk · I am not committing that Baseline C will beat Baseline B.

---

## §7 · Corpus construction

**7.1 · Template-based systematic generation.**

Base template: `[Q_WORD] [AUX] [NP_SUBJECT] [VERB]?`
- Q_WORD ∈ {why, what, where, when, how, which} · plus polar-question frames (which use inversion, not fronting)
- NP_SUBJECT ∈ {the machine, the customer, the price, the project, John, the door}
- VERB ∈ {stop, leave, increase, work, open, arrive}
- Tense variants: past · present · perfect

**7.2 · Content-word control template.**

Same subject + verb but declarative or content-noun initial:
- "The reason [NP] [VERB] was ..."
- "The place where [NP] [VERB] was ..."
- "The [NP] did not [VERB]."

**7.3 · Negation + conditional + causal.**

- "[NP] did not [VERB]"
- "If [NP] [VERB], then ..."
- "[NP] [VERB] because ..."

**7.4 · Paraphrase families** (Exp 2I).

For "Why did the machine stop?":
- "What caused the machine to stop?"
- "For what reason did the machine stop?"
- "How come the machine stopped?"

These share the gold representation `{question_operator: WHY-equivalent, answer_type: REASON, target: machine, event: stop}`. Written into the gold set explicitly.

**7.5 · Held-out unseen combinations** (Exp 2F).

Training set contains: (why, machine, stop), (why, customer, leave), (how, machine, stop), (where, customer, leave), (when, price, increase).
Test set (unseen): (why, customer, stop), (how, customer, leave), (why, project, increase), (when, machine, arrive), (which, door, open).

The mechanism must **construct** the correct representation for held-out sentences from reusable components. If it succeeds only on training combinations, the result is MEMORIZATION not COMPOSITION.

**7.6 · Size.**

Initial corpus target: **~150 sentences** (small enough to hand-label rigorously · large enough for descriptive statistics · underpowered for strong inferential claims · disclosed in the final report per §17 of your brief).

Breakdown:
- 60 wh-questions across 6 wh-words × 5 subject-verb combos + 6 tense/aspect variants
- 12 polar questions
- 12 negations
- 12 conditionals
- 12 causal (because)
- 24 declaratives (as non-question controls)
- 18 paraphrase pairs (3 paraphrases × 6 seed questions)

**7.7 · Held-out fraction.**

70% training / 30% held-out unseen combinations for Exp 2F.

---

## §8 · Ablation matrix (from §11 of your brief)

For each sentence, produce these controlled variants:

| Ablation | Example |
|----------|---------|
| A0 · none (control) | "Why did the machine stop?" |
| A1 · mask leading lex | "[MASK] did the machine stop?" |
| A2 · mask content word (subject) | "Why did the [MASK] stop?" |
| A3 · mask content word (verb) | "Why did the machine [MASK]?" |
| A4 · syntactic reorder | "The machine stopped why?" |
| A5 · content-word replacement | "Reason did the machine stop?" (grammaticality flag = MARGINAL/UNNATURAL) |
| A6 · paraphrase | "What caused the machine to stop?" |

Each ablation is scored by:
- DV_X(A_i) for each dimension X
- δ_X(A_i) = DV_X(A0) − DV_X(A_i)
- Report δ per (lexeme, ablation) cell to see which words carry which information

**Statistical model** (per §17 of your brief · disclosed as descriptive-only for small N):
- Mixed-effects logistic regression: outcome = accuracy · fixed effects = {lexeme, ablation, frame} · random effect = sentence-id
- Effect sizes: Cohen's d for continuous · odds-ratio for binary
- No p < 0.05 → "proven" claims. Descriptive statistics primary.

---

## §9 · Success criteria (from §27 of your brief · applied here)

| Level | Definition | Concrete measurement |
|-------|-----------|---------------------|
| L1 · lexical function | Mechanism assigns correct question_operator to a bare wh-word in canonical position | DV1 accuracy on wh-initial questions ≥ 85% |
| L2 · lexical + structural | Mechanism correctly extracts target and event by combining wh-word + subject NP + verb | DV5 + DV6 accuracy ≥ 70% |
| L3 · unseen combination | Mechanism correctly represents held-out sentences that share components with training but the exact combination is novel | DV7 ≥ 60% on held-out set |
| L4 · generalisation beyond memorisation | Mechanism performance on held-out ≥ 80% of performance on training (memorisation gap ≤ 20 points) | measured directly |
| L5 · survive ablation/paraphrase | Mechanism accuracy remains > baseline A on paraphrase set; ablation degradation is > 0 for content masking (proves the mechanism is using the content, not memoising) | measured per §8 |
| L6 · zero-LLM internal | Verified zero LLM in the runtime path | audit output |

**I will report the HIGHEST LEVEL ACHIEVED, per §27 of your brief. Reaching L6 without L1-L5 counts as L6-only.**

**Any of the four outcomes is a valid scientific result:**
- SUPPORTED · Levels 1-4 all met and ablation shows lexical items carry measurable δ > 0
- PARTIALLY_SUPPORTED · some levels met · some not
- NOT_SUPPORTED · L4 fails (memorisation gap > 20 points) or ablation shows no measurable δ
- INSUFFICIENT_EVIDENCE · N too small · effect sizes with wide CIs

---

## §10 · Failure criteria (from §13 of your brief)

The mechanism produces one of the following failure classes on each error, recorded per-sentence:

| Class | When it fires |
|-------|---------------|
| LEXICAL | Wrong question_operator despite correct wh-word present |
| STRUCTURAL | Question type identified but wrong target/event · frame not parsed |
| COMPOSITION | Correct lexical + structural but wrong combined interpretation |
| CONTEXT | Right on isolated sentence, wrong when context changes |
| GENERALISATION | Right on training, wrong on held-out unseen combinations |
| REFERENCE | Right operator + target extraction, wrong resolution |
| AMBIGUITY | Two valid interpretations · mechanism collapsed to one |
| INSUFFICIENT_EVIDENCE | Mechanism honestly returned UNKNOWN (this is a successful safety outcome, not a failure) |

Per §13 of your brief: **do not patch individual failed sentences.** Aggregate errors by class · identify the underlying missing mechanism · report honestly.

---

## §11 · Falsification tests (from §18 of your brief)

The experiment must actively try to disprove each hypothesis. Adversarial cases:

**Against H0-weak** · sentences where the wh-word provides no measurable advantage:
- "The machine did WHY stop?" (wh-word in non-canonical position · should collapse the advantage)
- "It stopped, but why?" (wh-word in postponed elliptical position)
- Sentences where content-word alone predicts the answer type ("At what time did X happen?" → the answer type is time regardless of wh-word choice within {when, at what time, on what date})

**Against H0-episodic** · cases where an apparent "high-information token" fails to generalise:
- Take a wh-word that scored high on training and verify it fails on a novel structure it never appeared in

**Against H0-structural** · sentences where the lexical item alone predicts correctly without structural information:
- Bare wh-word as one-word utterance ("Why?") · does the mechanism produce a coherent operator?

**Against H0-strong** · sentences where the same wh-word produces different operations under different structure/context:
- "How are you?" (state · answer type = DESC or emotion)
- "How is the machine?" (state · answer type = STATUS)
- "How did you fix it?" (manner · answer type = MANNER)
- "How much did it cost?" (quantity · answer type = NUM)

If "how" produces the same operation across all four → H0-strong is unfalsified. If different → H0-strong falsified.

---

## §12 · Zero-LLM audit (from §14 of your brief)

Before and after implementation:
```
grep -rE '(openai|anthropic|ollama|claude-|gpt-[0-9]|fetch\()' src/lib/nex-agent/experiments/language-01/
```

Expected: zero hits.

The mechanism must be pure local computation over a lexical dictionary + composition rules. No embedding lookups. No pretrained models. No network calls.

---

## §13 · Bias disclosures (mandatory · not decorative)

1. **Single-annotator gold labels.** I write both the gold and the mechanism. Mitigated by (a) taxonomy derivation from published sources, (b) label file frozen before mechanism, (c) explicit UNKNOWN state.
2. **Fixture-based ground truth.** Sentences are constructed for the experiment, not sampled from natural corpora. Ecological validity is limited by design. A follow-up would use CHILDES or another natural corpus.
3. **English-only.** Cross-linguistic generalisation not tested. WALS shows the strong-word instantiation is language-specific · this is not tested here.
4. **Small N.** 150 sentences is underpowered for inferential claims. Descriptive statistics primary · effect sizes with CIs · no p < 0.05 → proven claims.
5. **I am the mechanism designer.** Any effect could be an artefact of my design choices matching my own gold labels. The zero-LLM audit + frozen gold + separate baseline mitigate but do not eliminate this.

All 5 will be reported verbatim in the final Phase 2 report §12 (Limitations).

---

## §14 · Hard-stop conditions (from §26 · internalised)

I will stop and report NOT_SUPPORTED or INSUFFICIENT_EVIDENCE if any of the following holds:

- The corpus does not establish objective ground truth after review.
- Gold labels and mechanism representations turn out to be circular (same shape · derived from same underlying assumption).
- Held-out unseen combinations turn out to be present in training after review.
- Baseline C fails to measurably exceed Baseline A on the same test set (mechanism produces no new signal).
- Any hidden LLM path is introduced (should be structurally impossible per design but will be re-verified).
- Ablation effects disappear under the confound audit (frequency, length, grammaticality).
- Statistical evidence is insufficient (all CIs cross zero or include the baseline).

---

## §15 · Corpus + mechanism will live in isolation

Per §21 of your brief · isolate from production NEX1 where practical:

```
src/lib/nex-agent/experiments/language-01/
  README.md                          (this design doc reference)
  fixtures/
    corpus.jsonl                     (150 sentences · frozen · SHA-256 recorded)
    gold-labels.jsonl                (frozen · SHA-256 recorded · written BEFORE mechanism)
    held-out.jsonl                   (30% unseen combinations)
  lexical-dictionary-v1.ts           (9-word properties + content-word controls · declarative)
  compositional-mechanism-v1.ts      (deterministic composer · zero LLM)
  baseline-a-surface-match.ts        (first-token prefix baseline)
  baseline-b-existing-classifier.ts  (wrapper around capability-a-founder-intent)
  run-experiment.ts                  (harness that runs 2A-2K · outputs JSONL of results)
  ablation-runner.ts                 (applies the ablation matrix per §8)
data/nex-language-experiment-01/
  results/
    run-{timestamp}.jsonl            (per-run raw results · never overwritten)
  reports/
    phase2-report-{date}.md          (final report per §25 of your brief)
```

Only `capability-a-founder-intent` is READ from production (Baseline B). Nothing in production imports from `experiments/`. Nothing in production is modified.

---

## §16 · What the Phase 2 implementation will and will not do

**Will do:**
- Write and freeze the corpus + gold labels (~150 sentences · ~6 dimensions of gold each)
- Write a lexical dictionary for the 9 target words + content-word controls
- Write a small deterministic compositional mechanism (target ~300 LOC · no LLM)
- Run baselines A + B + C over the corpus with the ablation matrix
- Produce the Phase 2 report per §25 (32 items)

**Will not do (out of scope for Phase 2):**
- Introduce numeric word_power scores (per §1.1 of your brief · not until evidence justifies it)
- Introduce 50 agents (per §21)
- Introduce cross-linguistic tests (per §1.2)
- Extend the vocabulary beyond the 9 target words + declared content controls (per §1.3)
- Any LLM path (per §14 · §22)
- Any modification to production NEX1 (per §24 regression protection)

---

## §17 · Founder decisions needed before I begin implementation

1. **Corpus size approval.** ~150 sentences is my recommendation given time/rigour trade-off. If you want a larger corpus (e.g., 500), that's more work but stronger inferential power. If you want smaller (e.g., 50), disclose as pilot only. **My recommendation: 150.**

2. **Gold-label author.** I have to do this alone in this environment. Confirm you accept the single-annotator disclosure and its mitigations (§5, §13).

3. **Content-word control set.** I've proposed the natural 9 (reason · thing · place · time · way · choice · no · suppose · since). Approve or adjust.

4. **Held-out proportion.** 30% (~45 sentences) as unseen combinations. Approve or adjust.

5. **Baseline B scope.** Use `capability-a-founder-intent/classifier.ts` as-is. If you'd rather I also include `capability-nex1-persona.ts` or `capability-paraphrase-library.ts` in the baseline B stack, tell me.

6. **Report thresholds.** L1 = 85% · L2 = 70% · L3 = 60% · L4 = memorisation-gap ≤ 20pts (§9). These are my recommendations. Approve or adjust — this is where the "success bar" lives.

7. **Falsification honesty commitment.** I will report the ACTUAL results even if they show the mechanism does not exceed Baseline B or that ablation δ is not measurable. NOT_SUPPORTED is a valid outcome per §18. Confirm you accept this before I run.

---

## §18 · What I have NOT done in this design phase

- No code written.
- No corpus generated yet.
- No gold labels written yet.
- No mechanism implemented.
- No claims made about NEX1's current or future language capability.
- No LLM used to produce any part of this design.

Every part of what happens next is contingent on your sign-off on §17.

---

## §19 · Ready state

Design is complete. Awaiting §17 decisions. Once received, order of work:

1. **Slice 1 · Corpus + frozen gold labels** (write · commit · SHA-256)
2. **Slice 2 · Baseline A + B measured on corpus** (numbers · zero mechanism yet)
3. **Slice 3 · Lexical dictionary v1** (declarative properties · reviewed against Phase 1 evidence)
4. **Slice 4 · Compositional mechanism v1** (~300 LOC · deterministic · no LLM)
5. **Slice 5 · Full 2A-2K experiment run** (with ablation matrix · statistical summary)
6. **Slice 6 · Phase 2 report** (32 items · SUPPORTED / PARTIALLY / NOT / INSUFFICIENT verdict)

Every slice is verifiable · reversible · reportable independently. If any slice hits a hard-stop condition (§14), I stop and report at that slice.

The mission is not "make NEX1 look intelligent." The mission is: **produce measurable evidence** that either supports, partially supports, does not support, or is insufficient for the four hypotheses under test.

Ready for your §17 decisions.

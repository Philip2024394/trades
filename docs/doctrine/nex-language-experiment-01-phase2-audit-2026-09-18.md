# NEX-LANGUAGE-EXPERIMENT-01 · Phase 2 REVISED Design · Pre-Sign-Off Audit

**Date:** 2026-09-18
**Auditor:** master_ai_engineer (Claude Opus 4.7) · adversarial read-only audit of own prior design
**Discipline:** Test the design · do not defend it. Truth before architecture.
**Method:** Read revised design · apply the 14-point audit framework · flag genuine weaknesses · return READY or AMEND.

---

## §1 · TL;DR verdict

**AMEND BEFORE SIGN-OFF.**

The revised design applied all 12 prior amendments correctly, but the adversarial audit surfaced **12 genuine weaknesses** the design does not currently address. Most are specification gaps (methods named but not operationalised), not conceptual failures. The design's structure is sound. The details need one more pass.

Full amendment list at §14. Ranked by severity at §14.1.

---

## §2 · §17 items 1-8 · audit table

Auditing whether each item is genuinely satisfied by the design, not merely stated.

### Item 1 · §8 Control-word validation table

- **EXACT REQUIREMENT:** Honest per-pair audit of all 9 wh↔content pairs · replacement strategy for the invalid ones.
- **WHY IT MATTERS:** Without valid controls, we cannot attribute effects to lexical identity vs. syntax vs. semantics.
- **DESIGN SATISFIES?** Partially. Per-pair table is present and honest. Replacement strategies A/B/C/D are named.
- **REMAINING WEAKNESS:** None of the four replacement strategies tests "wh-word class vs. non-wh-word class in the same syntactic slot" — because that comparison cannot exist in English (wh-words occupy a slot no non-wh-word can occupy). This is an **irreducible language limit**, not a design flaw. But it must be stated explicitly as a limit on what the experiment can conclude about the wh-class-vs-non-wh-class question.
- **VERDICT: AMEND** · add explicit disclosure that the "wh-class effect" (vs. non-wh-class content words) cannot be cleanly isolated in English · only within-wh and paraphrase-based comparisons are clean.

### Item 2 · §9 Incremental information measurement

- **EXACT REQUIREMENT:** 7 representation levels · Δ per level per dimension · answer central research question §2.
- **WHY IT MATTERS:** This is the primary decomposition that answers "at what level does information first appear".
- **DESIGN SATISFIES?** Partially.
- **REMAINING WEAKNESSES:**
  1. **Subword decomposition source unspecified.** The design says "enumerated in advance from a documented decomposition list" but does not name the list. Hand-writing it contaminates. Using an established resource (CELEX, Etymonline, MorphoLex) mitigates. Design must name the source.
  2. **Per-level classifier implementation unspecified.** Is L1 (letters) a nearest-neighbour lookup, a rule, a frequency table, a naive-Bayes bag-of-characters? Different implementations produce different Δ values. Design must specify.
  3. **Δ measures marginal information but does not decompose morpheme-explained vs. residual letter-explained variance.** The wh-family confound means Δ_L3 (subword) could be dominated by the wh- morpheme. Need hierarchical variance decomposition or matched-subset comparison to separate.
- **VERDICT: AMEND** on all three.

### Item 3 · §10 4-way ablation split

- **EXACT REQUIREMENT:** Isolate lexical · orthographic · structural · contextual ablations without conflation.
- **WHY IT MATTERS:** Confounded ablations invalidate the causal claims.
- **DESIGN SATISFIES?** Partially · but three of the eleven ablation conditions have concrete design flaws.
- **REMAINING WEAKNESSES:**
  1. **A8 (nonce substitution "why → myw") behavior undefined.** The mechanism will encounter an unknown lexeme. Does it return UNKNOWN? Compose from unknown lexeme with zero properties? Fall back to structural interpretation? Behavior must be specified before A8 is run.
  2. **A9 (wh-prefix strip) produces real English words for some cases.** "what" → "at" is a valid English preposition. The mechanism might interpret it correctly as a preposition, invalidating the manipulation. Only "wh" → "" for the remaining stem works cleanly for some (why → y, where → ere, when → en · these are nonces). For "what" → "at" and "which" → "ich", the residual is either a real word or a fragment. Must redesign A9 to produce nonces uniformly.
  3. **Contextual ablation A10/A11 has no corpus.** The 150-sentence corpus in §6 is standalone-sentence-only. Contextual ablation requires context-embedded sentences that don't exist yet. Either add context-embedded design to §6 or drop contextual ablation from Phase 2 (and disclose).
- **VERDICT: AMEND** on all three.

### Item 4 · §11 12-confound matrix

- **EXACT REQUIREMENT:** For every claimed effect, audit against 12 confounds · report survivors honestly.
- **WHY IT MATTERS:** Effects that vanish under proper controls are not evidence.
- **DESIGN SATISFIES?** Partially. Confound list is complete. Method per confound is not specified.
- **REMAINING WEAKNESSES:**
  1. **Audit method unspecified per confound.** For "word length", is the audit stratified analysis, regression covariate, matched-subset comparison, or exclusion? Different methods have different power and different assumptions. Design must specify.
  2. **N=150 with 12 covariates is under-powered for regression control.** If the audit method is regression, degrees of freedom get thin fast (residual d.f. ≈ 138, with heterogeneous distribution across confounds). Under-powered controls produce inconclusive audits. Design must acknowledge this and prefer stratification/matched-subsets where feasible.
  3. **Wh-family morphology confound — the biggest single risk — has no specific audit protocol.** The design names it in §11 line-item but doesn't say "audit method: compare within-wh-family vs. against a matched non-wh historical family". A specific protocol for THIS confound is critical because it's the one most likely to explain any letter-level effect.
- **VERDICT: AMEND** on all three.

### Item 5 · §12 Experiment 01A orthographic branch

- **EXACT REQUIREMENT:** Separate exploratory branch investigating letter/subword information · not merged with main experiment.
- **WHY IT MATTERS:** Prevents accidentally attributing morphological effects to individual letters.
- **DESIGN SATISFIES?** No — the branch exists but the corpus does not support the intended investigation.
- **REMAINING WEAKNESS:**
  - **The 150-sentence corpus is designed around 9 wh-words, 6 of which share the "wh-" prefix.** This means 01A's corpus is PRE-BIASED toward finding a letter-level effect (because 6/9 target-item-initial letters are "w-"). To honestly test whether letters carry information beyond the shared morpheme, 01A needs matched non-wh-family targets:
    - Non-wh interrogatives ("how" starts with h · but "how" is also wh-family etymologically)
    - Non-interrogative w-words (way, want, work) as controls in matched frames
    - Non-w interrogative-like structures for comparison
  - The current corpus does not include these. As written, 01A cannot cleanly distinguish "letters carry information" from "the shared wh-morpheme carries information".
- **VERDICT: AMEND** · either expand 01A corpus with matched non-wh items, or scope 01A explicitly to "the wh-family morpheme effect" (not "letter-level information in general").

### Item 6 · §13 Baseline B widening

- **EXACT REQUIREMENT:** Baseline B represents actual reachable native interpretation capability across all 11 modules.
- **WHY IT MATTERS:** A narrow Baseline B produces a strawman comparison that inflates the new mechanism's apparent gain.
- **DESIGN SATISFIES?** Partially · the module inventory is complete but the measurement is not.
- **REMAINING WEAKNESSES:**
  1. **Output-to-gold mapping unspecified.** `parseIntent` returns `intent_slug` (e.g., "fix_bug", "add_feature", "explain"). How does that map to my 6-dimensional gold (question_operator, expected_answer_type, polarity, conditional, target, event)? Without a mapping, Baseline B accuracy is not measurable.
  2. **Conditional reachability handling unspecified.** Some modules only fire under specific conditions (e.g., ambiguity resolver only when confidence < threshold). Does Baseline B include their outputs when they don't fire (missing), when they do fire (partial coverage), or unconditionally by simulating firing (unrealistic)?
  3. **Comparison-fairness rule unspecified.** "Baseline C must measurably exceed Baseline B" (§13 last paragraph) is only fair if both output the same dimensions. Baseline B may produce signal on some dimensions (question_operator) but not others (target, event). Comparison must be dimension-specific.
- **VERDICT: AMEND** on all three.

### Item 7 · §14 Pilot-gate framing

- **EXACT REQUIREMENT:** Thresholds are engineering gates, not scientific proof.
- **WHY IT MATTERS:** Prevents claiming linguistic understanding from a pilot number.
- **DESIGN SATISFIES?** Partially · framing is correct but the outcome table is missing.
- **REMAINING WEAKNESS:**
  - **No explicit evidence-pattern → verdict mapping.** The design correctly says "L1 threshold met under this protocol" is not "language understanding achieved". But what pattern of evidence yields SUPPORTED / PARTIALLY_SUPPORTED / NOT_SUPPORTED / INSUFFICIENT? The design lists possible verdicts but does not table the mapping. Ambiguity here invites confirmation bias when interpreting results.
- **VERDICT: AMEND** · add explicit verdict-mapping table (evidence pattern → verdict).

### Item 8 · §2 Central research question

- **EXACT REQUIREMENT:** "At what representational level does reusable information about linguistic interpretation first become measurable"
- **WHY IT MATTERS:** The question drives the whole design.
- **DESIGN SATISFIES?** Partially · question is stated but not operationalised.
- **REMAINING WEAKNESSES:**
  1. **"First become measurable" is ambiguous.** Smallest level with nonzero signal? Smallest level exceeding chance? Smallest level exceeding a threshold Δ? Different criteria give different answers.
  2. **"Reusable information" is not distinguished from "predictive information".** Overfit models produce predictive signal that does not reuse. The held-out test partly controls for this, but "reusable" needs explicit operationalisation (e.g., "signal that predicts held-out unseen combinations at accuracy > baseline A").
- **VERDICT: AMEND** · operationalise both terms.

---

## §3 · Item-by-item audit table

| # | Item | Verdict |
|---|------|---------|
| 1 | §8 Control-word validation | AMEND (disclose irreducible English limit) |
| 2 | §9 Incremental information measurement | AMEND (subword source · classifier impl · morpheme-vs-letter decomposition) |
| 3 | §10 4-way ablation | AMEND (A8 nonce behavior · A9 real-word residuals · A10/11 corpus missing) |
| 4 | §11 12-confound matrix | AMEND (audit method per confound · under-power warning · wh-family protocol) |
| 5 | §12 01A orthographic branch | AMEND (corpus can't distinguish letters vs. wh-morpheme) |
| 6 | §13 Baseline B widening | AMEND (output→gold mapping · conditional reachability · comparison-fairness rule) |
| 7 | §14 Pilot-gate framing | AMEND (evidence-pattern→verdict table missing) |
| 8 | §2 Central research question | AMEND ("first measurable" · "reusable" operationalisation) |

**Zero items PASS as-is.** All eight need amendment. Most are specification-gap amendments, not structural rewrites.

---

## §4 · Scientific validity audit (per §3 of the audit framework)

### A · Causal isolation

Can the experiment distinguish letter · pair · subword · word · position · syntactic-frame · contextual effects?

**Current answer: PARTIALLY.**

- Letter vs. pair vs. subword: cannot be distinguished cleanly because the wh-family morpheme confounds all three levels for 6 of the 9 target words. §12 amendment above must be applied.
- Word vs. position: partially distinguished by A4 (reorder) but reorder produces marginally-grammatical output which is a confound.
- Frame effect vs. context effect: cannot be distinguished because context is not in the corpus (§10 A10/A11 issue).
- Word vs. syntactic frame: distinguished by A2/A3/A4 · this works.

### B · Orthography vs. morphology — the critical audit

**Current design does NOT cleanly separate these for the wh-family.**

The wh-family shares:
- Initial letters "wh-" (except "how")
- Historical morpheme (Proto-Germanic *hw- / Old English hw-)
- Semantic function (interrogative operators)
- Phonology (all originally /hw/ or /w/)

Any effect observed at the letter level for the wh-family could be explained by ANY of the four. To separate orthography from morphology, the corpus needs:
- Words that share letters with wh- but not the morpheme (e.g., "whip", "whimper" — start with wh but are content words)
- Interrogative-like structures without wh- letters
- Non-interrogative words with morphological similarity

**None of these are in the current 150-sentence corpus.** Amendment required.

**Honest conclusion:** the current design can measure whether "wh- prefix predicts interrogative function" but cannot say whether the effect is orthographic, morphological, phonological, or lexical-family based. This limitation must be stated explicitly.

### C · Phonology

**Cannot be isolated in a text-only mechanism with text-only inputs.**

English orthography and phonology are heavily correlated but not identical (e.g., "know" starts with silent k). Without audio input and a phonological transcription, there is no way to test whether an apparent letter-level effect is really a phonological one.

**This is not a design flaw · it is a fundamental limit of the text-only mechanism.**

The design does not currently state this. It must, in the Limitations section of both the design and the final report.

### D · Frequency, length, character frequency, sequence frequency

**Named in §11 but audit methods not specified.** See item 4 above.

For length specifically: the 9 wh-words range 2-7 chars (if=2, no=2, how=3, why=3, not=3, what=4, when=4, place=5, which=5, since=5, when=4, because=7). Length is not matched. Any effect could partly reflect length.

---

## §5 · Baseline B audit

Verifying that Baseline B is a genuine baseline, not a strawman.

- **11 modules named.** Correct scope.
- **Reachability:** all 11 are reachable via `orchestrator.processTask()` on a user turn. Confirmed.
- **Output→gold mapping:** NOT SPECIFIED. Critical gap.
- **Hidden LLM path:** none of the 11 modules use LLMs (all are deterministic per prior audits). Confirmed clean.
- **Hidden fallback:** none of the 11 modules have LLM fallbacks. Confirmed.
- **Complete-reachable-path test:** the design does not yet include a test that verifies "when a corpus sentence enters the orchestrator, all 11 modules are consulted". Without this test, Baseline B may be under-representing NEX1's actual capability.

**VERDICT for Baseline B:** design is directionally correct · output mapping and reachability test must be added before implementation.

---

## §6 · Train/test separation audit

Operationalising "unseen combination":

- **Unseen at STRING level:** trivially guaranteed by template variation. Every held-out sentence is a novel string.
- **Unseen at LEXICAL-TRIPLE level:** the (wh-word, subject NP, verb) triple has never appeared in training. This is the intended sense.
- **Unseen at STRUCTURAL level:** frame types (wh-fronted, polar, declarative, etc.) are shared between train and held-out · not intended to be unseen.
- **Unseen at SEMANTIC level:** not well-defined for this experiment · not attempted.

**Design must:**
- Explicitly define "unseen combination" = "lexical triple absent from training"
- Verify this via set-difference before running (§16.3 mentions this but does not specify the verification procedure)
- Report the exact count of held-out triples that were absent from training vs. any that were accidentally leaked

**VERDICT:** AMEND · define "unseen combination" precisely and specify verification.

---

## §7 · Gold-label audit

- **Source taxonomies named** (Li & Roth 2002 · Dowty 1991). ✓
- **Freeze protocol** (SHA-256 committed before mechanism). ✓
- **UNKNOWN state permitted** on gold. ✓
- **Single-annotator bias disclosed.** ✓
- **10% post-hoc audit** against published examples. ✓
- **Ambiguity handling:** design mentions gold labels may include UNKNOWN, but does not specify handling for sentences where linguistic taxonomy genuinely gives multiple valid labels (e.g., "What is happening?" · answer_type = ENTY OR DESC). Need multi-label gold or explicit "ambiguous" tag.
- **Mechanism influence on gold:** the freeze protocol prevents this. ✓

**VERDICT:** AMEND minor · specify multi-label / ambiguous gold handling.

---

## §8 · Statistical audit

- **Small N acknowledged:** ✓ (pilot framing per §14)
- **Effect sizes with CIs:** mentioned, method unspecified.
- **Multiple-comparison correction:** NOT SPECIFIED. With 9 wh-words × 6 dimensions × 4 ablation families × 7 representation levels = ~1500 cells. Multiple-comparison correction is essential.
- **Under-powered claim disclosure:** ✓ (§17.1)
- **Repeated-measures structure:** mentioned via random effect on sentence-id · but not formalised (which random effects, which fixed effects, which interaction terms).
- **Assumption checks:** not specified (e.g., logistic regression assumes independence within observation, no perfect separation, appropriate link function).
- **What if assumptions fail:** not specified.

**VERDICT:** AMEND · specify effect-size + CI method (bootstrap? Wilson score? asymptotic?) · multiple-comparison correction strategy (Bonferroni? FDR? none · if descriptive only) · full statistical-analysis-plan section.

---

## §9 · Four-way ablation audit

Weaknesses per family:

**Lexical ablation family (A1/A5/A6):**
- What changes: leading lexical item.
- What remains constant: subject NP, verb, frame.
- Alternative explanations: A5 (matched-frequency content-word substitution) may produce ungrammatical sentences per §8 audit; grammaticality confound remains.

**Orthographic ablation family (A7/A8/A9):**
- What changes: character-level identity of leading lexical item.
- What remains constant: syntactic slot, subject NP, verb, frame.
- Alternative explanations:
  - A7 (scramble letters) may produce nonces that share NO recognisable morphological features · which could reflect nonce-handling, not letter effects.
  - A8 (matched-length nonces) same issue.
  - A9 (wh-prefix strip) produces mix of nonces AND real English words · confound.

**Structural ablation family (A2/A3/A4):**
- A2/A3 (mask subject/verb) is a completeness ablation not a frame ablation. Doesn't test what "frame" alone contributes.
- A4 (reorder) produces marginally-grammatical output.
- Genuine frame ablation would compare: same wh-word in wh-question frame vs. same wh-word in embedded/relative frame ("Why did X stop?" vs. "The reason why X stopped..."). This is not in the current design.

**Contextual ablation family (A10/A11):**
- No corpus exists to test this yet.

**VERDICT:** AMEND all four families with cleaner isolation OR document what remains confounded.

---

## §10 · Control strategy audit (A/B/C/D)

- **A · Within-wh swap:** grammatical · comparable · defensible for testing "does wh-word choice change interpretation". Does NOT test "wh-word class vs. non-wh-word class". **Valid for its narrow claim only.**
- **B · Paraphrase pairs in matched frames:** grammatical · comparable · valid for testing "is interpretation preserved under paraphrase". Does NOT test "does the single lexical item drive interpretation" (because the paraphrase is a phrase, not a single word). **Valid for its narrow claim only.**
- **C · Position swap:** grammatical MARGINAL · comparable partially · valid for testing "does canonical position matter". But marginality is itself an information-carrying signal that confounds interpretation.
- **D · Content-word declarative parallel:** grammatical · not directly comparable (different speech act) · valid for testing "does speech-act frame carry direction". Does NOT test "does the wh-word carry direction independently".

**Honest verdict:** each strategy tests a NARROWER claim than "does the wh-word carry direction". Combined, they cover more of the hypothesis space, but no single strategy tests the direct claim. This is a genuine limit of English.

**VERDICT:** AMEND · each strategy needs an explicit narrow-claim scope statement so we don't over-interpret its results.

---

## §11 · Letter-level hypothesis audit (per §10 of the audit framework)

Founder's original question:
- Do letters within a word contain reusable signal?
- Could "ss" carry reusable signal?
- Could "ie" carry reusable signal?

**Current design CANNOT ANSWER this cleanly.**

Reasons:
- 150-sentence corpus is built around 9 wh-words plus 4-6 subject NPs and 4-6 verbs.
- Total unique tokens: ~30-40. Distribution of "ss" and "ie" letter pairs in this corpus is a function of which words appear, not of any principled sampling of letter-pair distribution.
- "ss" appears in "stopped", "customer's", "process" — but these are correlated with specific words that are correlated with specific meanings.
- "ie" appears in "die", "field", "believe", "receive", "friend" — none of which are in the current corpus.

**To test letter-pair hypotheses cleanly, we would need:**
- A corpus specifically designed to vary letter-pair presence orthogonally to word identity, syntactic function, and morphology.
- Frequency-matched pairs.
- A separate experiment (call it 01B).

**VERDICT: AMEND** · explicitly state that Phase 2 as designed does NOT test arbitrary letter-pair hypotheses (ss/ie/etc.). Only tests the wh-family morpheme case. Founder's letter-pair question requires a differently-designed corpus (Experiment 01B, TBD).

---

## §12 · No-LLM audit

- Baseline C mechanism will be pure local computation. ✓
- Baseline B modules all deterministic per prior audits. ✓
- Corpus and gold labels are human-authored (me, the annotator). ⚠️ (this is not an LLM but is a source of bias · disclosed in §7 gold-label audit)
- No embedding lookups planned. ✓
- No API calls in the mechanism. ✓

**Concern:** the corpus was drafted by me (Claude Opus 4.7 · an LLM). Even though it's for the fixture, if I use my own linguistic intuitions to write it, my LLM training is influencing the experiment. Mitigation: derive sentences directly from Li & Roth 2002 TREC-10 example set + minimal template variation, rather than free-writing them.

**VERDICT: AMEND** · specify that corpus sentences must be derived from published examples (Li & Roth 2002 or CHILDES) with documented modifications, rather than free-written by the LLM-that-is-me.

---

## §13 · Falsification audit

Design commits to 8 negative outcomes explicitly (§15 of revised design). ✓

Add per audit framework §12:
- MORPHOLOGY_EXPLAINS_EFFECT ✓ (implied in §11 confound audit · make explicit)
- FREQUENCY_EXPLAINS_EFFECT ✓ (implied · make explicit)
- STRUCTURE_EXPLAINS_EFFECT ✓ (implied · make explicit)
- CONTEXT_EXPLAINS_EFFECT ✓ (implied · make explicit)
- ORTHOGRAPHIC_EFFECT_NOT_FOUND ✓ (implied · make explicit)

**VERDICT: AMEND minor** · make the 8-outcome list explicit in a dedicated verdict-taxonomy section.

---

## §14 · Required amendments · complete list

Ranked by severity (highest first):

### CRITICAL (blocks implementation)

1. **01A corpus cannot distinguish letter effects from wh-family morpheme effects.** Either add matched non-wh items to the corpus (whip, whimper, want, work + non-wh interrogative-like structures) OR scope 01A explicitly to "wh-family morpheme investigation" not "letters in general".

2. **Baseline B has no output→gold mapping.** Without a mapping from `intent_slug`/`verb_family`/`chat_only`/etc. to my 6-dim gold, Baseline B accuracy is not measurable and the comparison rule (§13) is inoperable.

3. **Founder's letter-pair hypothesis (ss / ie) cannot be answered by Phase 2 as designed.** Explicit statement required; Experiment 01B would be needed for that.

### HIGH (design gaps that must be filled before implementation)

4. **Ablation A9 (wh-prefix strip) produces real English words for some cases** ("what" → "at"). Redesign to produce nonces uniformly OR drop A9 and disclose.

5. **Ablation A8 (nonce substitution) behavior on unknown lexemes undefined.** Specify mechanism response before A8 is run.

6. **Contextual ablation family (A10/A11) has no corpus.** Add context-embedded sentences to §6 OR drop contextual ablation from Phase 2.

7. **Subword decomposition source unspecified** for level L3. Name CELEX, MorphoLex, Etymonline, or hand-audit with source. Not hand-write.

8. **Confound audit method per confound unspecified.** For each of 12 confounds, name method (stratification / regression covariate / matched-subset / exclusion). Wh-family morphology confound needs its own specific protocol.

9. **"Unseen combination" not operationalised.** Define as "lexical triple (wh, subject, verb) absent from training". Specify verification procedure and reporting.

### MEDIUM (specification gaps)

10. **Statistical analysis plan incomplete.** Effect-size method · CI method · multiple-comparison correction · assumption checks · under-power warnings per dimension. Formalise as a stat-plan sub-section.

11. **Pilot-gate → verdict mapping missing.** Add evidence-pattern → verdict outcome table.

12. **Central research question terms unoperationalised.** "First become measurable" and "reusable information" need concrete definitions.

### LOW (disclosure gaps)

- Phonology cannot be isolated in text-only mechanism · state explicitly.
- 8-outcome verdict taxonomy · make explicit in dedicated section.
- Corpus sentences should be derived from published examples not free-written by the LLM-that-is-me.
- Multi-label / ambiguous gold handling protocol.
- Wh-class vs. non-wh-class comparison is not possible in English · state explicitly.

---

## §14.1 · Severity summary

- 3 CRITICAL amendments (must block implementation until resolved)
- 6 HIGH amendments (design gaps that must be filled)
- 3 MEDIUM amendments (specification gaps)
- 5 LOW amendments (disclosure gaps)

**17 amendments total.** None require conceptual restructuring · all are specification fixes or additions. The design's structure is sound; the details need one more revision.

---

## §15 · Scientific risks that remain after amendments

- N=150 is small · effect sizes will have wide CIs · under-powered for population-level inference. Reported.
- Single annotator = pilot bias. Reported.
- Phonology inseparable from orthography in text mechanism. Reported as fundamental limit.
- Wh-class-vs-non-wh-class comparison not possible in English. Reported as fundamental limit.
- Corpus authored by me (LLM-that-is-me) = intuitions may leak into sentence choice. Mitigated by derivation from published examples.
- Ecological validity limited: template-generated sentences may not match natural language distributions.

---

## §16 · Engineering risks that remain after amendments

- Mechanism implementation may be more complex than 300 LOC once all ablation conditions are handled.
- Baseline B measurement requires 11-module wrapper · non-trivial engineering.
- JSONL corpus + gold + results structure needs versioning to prevent accidental overwrite.
- If the mechanism accidentally reads the gold labels file (Bayesian contamination), the entire experiment is invalid. Access control required.

---

## §17 · What must NEVER be implemented (per audit framework §14)

- Anything that reads gold labels from within the mechanism.
- Any LLM API call, embedding lookup, or external model inference.
- Any modification to production NEX1 code paths.
- Any modification to Truth Engine, safety gate, Q7/Q8 policies.
- Any modification to the mission's four hypothesis definitions.
- Any silent redefinition of "success" or "unseen combination" after seeing results.

---

## §18 · What must precede each implementation slice · evidence gates

- **Before Slice 0 (reachable-path audit for Baseline B):** none · read-only.
- **Before Slice 1 (corpus + gold):** 17 amendments resolved · founder sign-off · slice 0 output.
- **Before Slice 2 (Baseline A + B measurement):** slice 1 SHA-256 recorded · output→gold mapping specified · reachability test passed.
- **Before Slice 3 (lexical dictionary v1):** slice 2 baselines measured and documented.
- **Before Slice 4 (compositional mechanism v1):** slice 3 dictionary reviewed against Phase 1 evidence.
- **Before Slice 5 (ablation matrix run):** slice 4 mechanism producing valid outputs on training set.
- **Before Slice 6 (01A orthographic branch):** slice 5 main-experiment results in hand.
- **Before Slice 7 (Phase 2 report):** slices 0-6 complete · confound audit executed · verdict determined.

Each slice may reach a hard-stop and terminate the experiment early. That is a successful outcome per §15 of the revised design and §12 of the audit framework.

---

## §19 · Final decision

**AMEND BEFORE SIGN-OFF.**

Complete amendment list: §14 above · 17 items · ranked by severity.

Three CRITICAL amendments (§14 items 1-3) genuinely block implementation because they mean the current design cannot answer the questions it claims to answer:
- 01A cannot separate letters from morphology
- Baseline B is not measurable without an output mapping
- The founder's ss/ie letter-pair question is not testable by this design

The remaining 14 amendments are specification gaps that would introduce interpretation risk if unresolved.

**After the 17 amendments, one more revision + one more audit is honest before sign-off.**

I have NOT written any code. I have NOT modified any production file. I have NOT created any fixture or corpus.

Ready for founder decision on how to proceed with the 17 amendments.

---

## §20 · Core principle reiteration (per audit framework §15 principle)

We are not trying to make the experiment prove any hypothesis.

We are testing whether reusable information about linguistic interpretation first appears at the letter, letter-pair, subword, word, position, structure, or context level.

The current design can partially answer that question at the word / position / structure levels but cannot cleanly answer it at the letter / letter-pair / subword levels because of the wh-family confound and corpus design.

Fix the design, then test.

Not the other way round.

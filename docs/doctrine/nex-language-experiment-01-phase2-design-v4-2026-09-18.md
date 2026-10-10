# NEX-LANGUAGE-EXPERIMENT-01 · Phase 2 · v4 Design (post-second-audit)

**Date:** 2026-09-18
**Status:** v4 · pending fresh audit and founder sign-off · zero implementation until audit passes
**Prior version:** v3 · second-round audit found 8 amendments
**Amendments applied in v4:** 8/8 (2 CRITICAL · 4 HIGH · 1 MEDIUM · 1 LOW)
**Author:** master_ai_engineer (Claude Opus 4.7)
**Hard rule enforced:** do not weaken the experiment to reach READY. Where a question is not testable in this design, label it "NOT TESTABLE IN THIS EXPERIMENT" and preserve it as a known limitation.

---

## §0 · Amendment log · 8/8 applied

| # | Prior severity | Amendment | v4 location |
|---|---------------|-----------|-------------|
| N2 | CRITICAL | Baseline B mapping · UNREPRESENTABLE markers · exclude from "C exceeds B" comparison | §11 |
| N7 | CRITICAL | Verdict split · capability improvement vs. capability extension vs. neither vs. insufficient | §15 |
| N1 | HIGH | A9 nonces generated via Wuggy · frequency-matched parameters committed | §9.2 |
| N4 | HIGH | Subword source · MorphoLex-en → CELEX2 → Etymonline fallback chain · per-entry provenance | §8.3 |
| N5 | HIGH | Char-frequency confound marked REPORTED-NOT-CONTROLLED at pilot N · consistent with §13 power warnings | §10 |
| N6 | HIGH | Pre-registration commitment · statistical plan frozen before Slice 2 | §13.7 |
| N3 | MEDIUM | Experiment scope · 01 / 01A / 01B / 01C named per founder's brief · no overlap | §5.1 |
| N8 | LOW | TREC-10 coverage · hard-stop verification protocol in Slice 1 | §7.5 |

---

## §1 · Hypotheses under test (unchanged from v3)

- **H0-weak** · closed-class / question operators may provide disproportionate information about utterance direction
- **H0-episodic** · some observations may carry disproportionate information in context
- **H0-structural** · direction is joint (word × structure × alternative-set × context)
- **H0-strong** · retained as falsifiable comparison null

---

## §2 · Central research question · operationalised (unchanged from v3)

**Question:** At what representational level does reusable information about linguistic interpretation first become measurable: letter → letter-pair → subword → word → word+position → word+frame → word+context?

- **"First become measurable"** = smallest level N such that Δ_level(N) ≥ 5pp AND 95% bootstrap CI does not cross zero AND effect survives §10 confound audit
- **"Reusable information"** = accuracy on held-out unseen-combination sentences ≥ Baseline A + 10pp

---

## §3 · Independent + Dependent Variables (unchanged from v3)

- **IVs:** leading lexical operator · syntactic frame · ablation condition · representation level · comparison control
- **DVs:** question_operator · expected_answer_type · polarity · conditional · target · event
- **Derived:** Δ_level(N) · δ_ablation-family(dim)

---

## §4 · Falsification permitted outcomes (unchanged)

SUPPORTED · PARTIALLY_SUPPORTED · NOT_SUPPORTED · INSUFFICIENT_EVIDENCE · NO_GENERALISATION · MORPHOLOGY_EXPLAINS_EFFECT · FREQUENCY_EXPLAINS_EFFECT · STRUCTURE_EXPLAINS_EFFECT · CONTEXT_EXPLAINS_EFFECT · ORTHOGRAPHIC_EFFECT_NOT_FOUND · FUNDAMENTAL_LIMIT_HIT · **NOT_TESTABLE_IN_THIS_EXPERIMENT** (added per founder's hard rule)

---

## §5 · Experiment scope · four-experiment map (per amendment N3)

Founder-mandated scope for the language experimentation family:

| Experiment | Scope | Status in Phase 2 |
|-----------|-------|-------------------|
| **01** | Language composition + reusable interpretation | **In scope · this document** |
| **01A** | Orthographic signal · scoped to WH-family morpheme in Phase 2 | **In scope · this document** |
| **01B** | Affective / experiential / emotional word signal | Founder's new hypothesis · not yet designed · out of scope |
| **01C** | Arbitrary letter-pair signal (ss / ie / etc.) · corpus-specific | Deferred · requires a purpose-designed corpus that Phase 2 does not provide |

**No overlap.** Findings from one experiment may not become assumptions in another. Each requires its own corpus + gold + mechanism + audit.

**What Phase 2 explicitly does NOT test** (labelled NOT_TESTABLE_IN_THIS_EXPERIMENT per founder's hard rule):
- Arbitrary letter-pair hypothesis (ss / ie) — corpus does not sample letter-pair distribution principled
- Affective / emotional word signal — separate hypothesis, separate corpus
- Contextual effects — corpus is standalone
- Cross-linguistic generalisation — English only
- Phonology (see §17.1 fundamental limit)
- Wh-class-vs-non-wh-class contrast (see §17.2 fundamental limit)

---

## §6 · Gold-label methodology (unchanged from v3)

- Derived from Li & Roth (2002) TREC-10 taxonomy for answer types
- Dowty (1991) proto-roles for semantic roles
- Multi-label / ambiguous protocol per v3 §6.3
- Freeze protocol · SHA-256 recorded · 10% audit
- Single-annotator (me) pilot bias disclosed

---

## §7 · Corpus construction (revised per amendment N8)

### 7.1 · Sources

**Primary:** Li & Roth (2002) TREC-10 corpus · https://cogcomp.seas.upenn.edu/Data/QA/QC/
**Secondary:** CHILDES adult-child transcripts (only if TREC insufficient after coverage verification)
**Tertiary:** hand-audited sentences (flagged author=me · excluded from primary analysis)

### 7.2 · Composition (unchanged from v3)

~150 sentences · same category breakdown as v3 §7.2.

### 7.3 · Held-out split (unchanged from v3)

30% stratified · unseen-combination verified per §7.4.

### 7.4 · "Unseen combination" operational definition (unchanged from v3)

Lexical triple (wh-word, subject_NP_head, verb_lemma) absent from training · set-difference verification with hard-stop.

### 7.5 · TREC-10 coverage verification protocol (per amendment N8)

**Slice 1 first sub-task · before any sentence construction:**

For each target lexeme in {why, what, where, when, how, which, not, if, because}:
1. Query the TREC-10 filtered set (≤10 words, target-lexeme leading in canonical position where applicable).
2. Count usable items after applying the ≤10-word filter.
3. Report per-lexeme count in `data/nex-language-experiment-01/results/slice1-coverage-audit.jsonl`.

**Hard-stop condition:** if ANY target lexeme has < 10 usable TREC items after filtering, the experiment stops for founder decision:
- Option a · relax the ≤10-word filter for that lexeme (disclose)
- Option b · supplement from CHILDES with provenance recorded (disclose)
- Option c · reduce per-target N and disclose in the report
- Option d · abandon the experiment

No sentence construction proceeds until the coverage report is reviewed and one of a/b/c/d is chosen explicitly.

---

## §8 · Representation levels · concrete definitions (revised per amendment N4)

### 8.1 · Levels L0-L7 (unchanged from v3)

L0 chance · L1 letter bag · L2 letter n-gram · L3 subword · L4 whole word · L5 word+position · L6 word+frame · L7 word+frame+context (≈L6 in Phase 2 · standalone corpus).

### 8.3 · Subword decomposition source · fallback chain (per amendment N4)

For every lexeme in the corpus (target + subject NPs + verbs), decompose morphology using this fallback chain:

1. **Primary · MorphoLex-en** (Sánchez-Gutiérrez et al. 2018 · https://osf.io/wxcvj/)
2. **Fallback · CELEX2** (Baayen, Piepenbrock & Gulikers 1995 · covers monosyllabic function words)
3. **Fallback of fallback · Etymonline** (https://www.etymonline.com) · hand-audit with per-entry URL recorded

**Slice 1 sub-task · MorphoLex-en verification:**
- Query MorphoLex-en for each of the target lexemes and corpus content words
- Record per-lexeme coverage in `data/nex-language-experiment-01/fixtures/subword-decomposition.jsonl` with fields: `{lexeme, decomposition, source: "MorphoLex-en" | "CELEX2" | "Etymonline", source_url}`
- **Hard-stop condition:** if any lexeme is missing from all three sources, that lexeme is marked "morphology_unknown" and the L3 subword classifier reports UNKNOWN for that lexeme. This is a legitimate outcome per §14.2 unknown-lexeme handling.

**No hand-invented decompositions.** Where all three sources lack an entry, the lexeme is honestly marked morphology_unknown and no L3 signal is claimed for it.

---

## §9 · Ablation matrix (revised per amendment N1)

### 9.1 · Lexical ablation family (unchanged from v3)

A1 mask · A5 matched-frequency content-word swap · A6 bare wh-only.

### 9.2 · Orthographic ablation family (revised · N1)

- **A7 · scramble letters within lex** (unchanged): "why" → "yhw" (same char set, scrambled)
- **A8 · matched-length nonce substitution** (revised): use **Wuggy** (Keuleers & Brysbaert 2010 · https://crr.ugent.be/programs-data/wuggy) to generate 3 pseudo-word candidates per target lexeme with these parameters:
  - length match: exact
  - subsyllabic segmentation preservation
  - transition frequency: within 10% of source
  - orthographic legality: yes
  - phonotactic legality: yes
  - Wuggy output committed to `data/nex-language-experiment-01/fixtures/wuggy-nonces.jsonl` with parameters recorded
  - Where Wuggy is unavailable in the environment, use documented equivalents (nonword generator from Word Retriever · New & Grainger 2004) or hand-curated frequency-matched nonces sampled from a documented reference corpus (CELEX bigram frequencies).
- **A9 · WH-morpheme removal with frequency-matched nonce prefix** (revised per amendment N1):
  - Old v3 approach ("wh-" → "x") is REJECTED — "x" is a rare initial letter (~0.15% initial-letter frequency in English) which introduces a new confound.
  - Revised approach: use Wuggy to generate a replacement prefix whose initial bigram frequency in the CELEX reference corpus matches the average English initial-bigram frequency (approximately: "st", "co", "re", "pr" · initial bigram frequency in CELEX ~1.5-3%). Where the resulting substitution yields a real English word ("stat", "star", "stop"), reject and regenerate.
  - Commit 3 replacement candidates per wh-word to `data/nex-language-experiment-01/fixtures/wh-strip-nonces.jsonl` with source rationale.
  - **Disclosure:** even with frequency-matched replacements, A9 conflates "wh-morpheme removal" with "wh-morpheme replacement by a different frequency-matched bigram". The comparison isolates "presence of the wh- signal" but not "presence of any morpheme" absent additional controls. This is disclosed in the final report.

### 9.3 · Structural ablation family (unchanged from v3)

A2 · A3 · A4.

### 9.4 · Contextual ablation · deferred (unchanged from v3)

---

## §10 · 12-confound matrix (revised per amendment N5)

For every observed effect, apply the specified control method:

| # | Confound | Method for this experiment (v4) |
|---|---------|-------------------------------|
| 1 | Word frequency (COCA tier) | Stratified analysis (high / mid / low) |
| 2 | Word length (chars) | Matched-subset comparison |
| 3 | Character frequency in corpus | **REPORTED-NOT-CONTROLLED** at N=150 (per amendment N5 · consistent with §13 power warnings and #5 phonology treatment) |
| 4 | Letter position | Stratified by position |
| 5 | Phonology | **REPORTED-NOT-CONTROLLED** · fundamental limit (§17.1) |
| 6 | Morphology (wh-family) | Matched-subset (wh-family vs. non-wh 12-item control from §12.2) |
| 7 | Syntactic frame | Stratified by frame type |
| 8 | Semantic relatedness | Qualitative discussion only · N insufficient for formal control |
| 9 | Historical word family | Matched-subset · same as morphology |
| 10 | Orthographic convention | **REPORTED-NOT-CONTROLLED** · not testable at pilot N |
| 11 | Context | Not applicable · Phase 2 corpus standalone |
| 12 | Training frequency in corpus | Matched-subset · high-train vs. low-train items |

**REPORTED-NOT-CONTROLLED semantics** (used for #3, #5, #10):
- The confound is enumerated in the final report as a plausible alternative explanation for any observed effect
- No formal statistical control is attempted
- Any effect surviving formal controls on the OTHER 9 confounds is still qualified by "does not exclude confound #3/#5/#10 as an alternative explanation"
- This is honest disclosure, not effect-hiding

**Effect-survival criterion:** an effect "survives confound audit" only if survives all 9 formally-controlled confounds AND is reported with the 3 non-controlled confounds as caveats.

---

## §11 · Baselines (revised per amendment N2)

### 11.1 · Baseline definitions (unchanged)

- Baseline A · surface string matching
- Baseline B · existing NEX1 native interpretation stack (11-module reachable path)
- Baseline C · new compositional mechanism

### 11.2 · Baseline B output → gold mapping (revised · N2 · UNREPRESENTABLE markers)

Per founder's hard rule: "If any gold dimension cannot legitimately be derived from Baseline B, mark it UNREPRESENTABLE rather than inventing a mapping."

| Gold dimension | Baseline B representability | Source module (if representable) | Mapping rule |
|---------------|---------------------------|--------------------------------|--------------|
| **question_operator** | REPRESENTABLE (partial) | `parseIntent` + `classifyFounderIntent` + `matchQuestion` + `isChatOnlyIntent` | Composition rule per v3 §11.2 · confidence-weighted |
| **expected_answer_type** | REPRESENTABLE (partial) | `parseIntent` slug + `classifyFounderIntent` deliverable_kind | Composition rule per v3 §11.2 |
| **polarity** | REPRESENTABLE (partial) | `capability-conversation-detectors.detectPreference` + `detectCorrection` | If either detector fires: use detector output. Otherwise: **UNREPRESENTABLE for that sentence** (majority of corpus). |
| **conditional** | **UNREPRESENTABLE** | None of the 11 modules detects conditional/because structures | **No mapping invented.** Baseline B output = UNREPRESENTABLE for this dimension for the entire corpus. |
| **target** | REPRESENTABLE (partial) | `parseIntent.trigger_matches` + `classifyFounderIntent.file_references` | First noun-shaped match wins · UNREPRESENTABLE if none |
| **event** | **UNREPRESENTABLE** | None of the 11 modules explicitly extracts verb lemma as a first-class output | **No mapping invented.** Baseline B output = UNREPRESENTABLE for this dimension for the entire corpus. |

### 11.3 · Comparison rules (per amendment N7 · load-bearing)

**A · Capability-improvement comparison** — for dimensions where Baseline B is REPRESENTABLE:
- Baseline C's accuracy > Baseline B's accuracy + 5pp with 95% CI not crossing zero
- Restricted to sentences where Baseline B does not output UNREPRESENTABLE
- Reported as "C improves over B on X" · specific to dimension X

**B · Capability-extension comparison** — for dimensions where Baseline B is UNREPRESENTABLE for the sentence:
- Baseline C's accuracy vs. Baseline A + 10pp with 95% CI not crossing zero
- Restricted to UNREPRESENTABLE sentences per dimension
- Reported as "C produces measurable signal where B has none" · specific to dimension X
- **NOT counted as "C beats B"** · this distinction is load-bearing

**C · Aggregate verdict:**
- Baseline C must satisfy comparison A on ≥ 2 of the REPRESENTABLE dimensions (question_operator, expected_answer_type, target, partial polarity) OR
- Baseline C must satisfy comparison B on ≥ 2 of the UNREPRESENTABLE dimensions (conditional, event, majority-polarity)
- Both together = strongest evidence
- Either alone = partial evidence
- Neither = NOT_SUPPORTED

---

## §12 · Experiment 01A · orthographic (unchanged scope + N4 fallback)

- Research question 01A: wh-family morpheme information beyond whole-word
- Augmented corpus with matched non-wh w-words + non-w interrogative-like structures
- Test 12a/12b/12c per v3 §12.3
- What 01A cannot conclude: general letter-pair effects (deferred to 01C) · phonology (fundamental limit)

---

## §13 · Statistical analysis plan (revised per amendment N6)

### 13.1-13.6 · descriptive + effect sizes + inferential + FDR + assumption checks + under-power disclosure (unchanged from v3)

### 13.7 · Pre-registration commitment (per amendment N6)

**The statistical analysis plan is FROZEN before Slice 2 data collection begins.**

Concretely:
- End of Slice 1: commit `data/nex-language-experiment-01/stat-plan-v1.md` with SHA-256 recorded
- The frozen plan contains:
  - Primary outcomes: per-dimension accuracy of Baseline C vs. Baseline B (capability-improvement) and vs. Baseline A (capability-extension)
  - Secondary outcomes: Δ_level(N) per level per dimension · δ_ablation-family per dimension
  - Effect-size method: Cohen's d (continuous) · odds ratio (categorical) · bootstrap 95% CI (10,000 resamples · percentile method)
  - Multiple-comparison correction: Benjamini-Hochberg FDR at q=0.10 within each dimension's test family
  - Missing/ambiguous data: multi-label gold protocol per §6.3 · mechanism UNKNOWN scored per §14.2
  - UNREPRESENTABLE handling: exclude from capability-improvement · include in capability-extension per §11.3
  - Pilot-gate interpretation: engineering thresholds not scientific proof (§15)
  - Falsification criteria: 11-outcome verdict taxonomy per §15.1

**After Slice 2 begins:**
- Changes to the primary analysis are NOT permitted based on observed results
- Any exploratory analysis added after seeing results goes into a separate "Exploratory" section of the report · not the primary analysis
- Post-hoc analyses are labeled honestly and treated as hypothesis-generating not hypothesis-confirming

---

## §14 · Mechanism (Baseline C) specification (unchanged from v3)

### 14.1-14.5 · known/unknown/nonces/deterministic/zero-LLM (unchanged)

---

## §15 · Outcomes taxonomy + verdict mapping (revised per amendment N7)

### 15.1 · 12-outcome verdict taxonomy (per amendment · adds NOT_TESTABLE_IN_THIS_EXPERIMENT)

Full taxonomy:
- SUPPORTED
- PARTIALLY_SUPPORTED
- NOT_SUPPORTED
- INSUFFICIENT_EVIDENCE
- NO_GENERALISATION
- MORPHOLOGY_EXPLAINS_EFFECT
- FREQUENCY_EXPLAINS_EFFECT
- STRUCTURE_EXPLAINS_EFFECT
- CONTEXT_EXPLAINS_EFFECT (deferred to Phase 3 · not measurable here)
- ORTHOGRAPHIC_EFFECT_NOT_FOUND (specific to 01A)
- FUNDAMENTAL_LIMIT_HIT (phonology / wh-class-vs-non-wh)
- **NOT_TESTABLE_IN_THIS_EXPERIMENT** (added per founder's hard rule · e.g., letter-pair hypothesis deferred to 01C)

### 15.2 · Verdict mapping (revised per amendment N7)

Distinguishing capability-improvement vs. capability-extension per §11.3:

| Comparison A satisfied? (C > B where B is representable) | Comparison B satisfied? (C > A where B is UNREPRESENTABLE) | Δ_level shows structure > letters after confound audit? | Held-out ≥ Baseline A + 10pp? | Verdict |
|--|--|--|--|--|
| Yes on ≥ 2 dims | Yes on ≥ 2 dims | Yes | Yes | SUPPORTED · (specify which hypothesis form) |
| Yes on ≥ 2 dims | No | Yes | Yes | PARTIALLY_SUPPORTED (capability improvement without extension) |
| No | Yes on ≥ 2 dims | Yes | Yes | PARTIALLY_SUPPORTED (capability extension without improvement) |
| Yes | Yes | No · confound explains | Any | Specify: MORPHOLOGY / FREQUENCY / STRUCTURE _EXPLAINS_EFFECT |
| Yes | Yes | Yes | No | NO_GENERALISATION (memorised training) |
| No | No | — | — | NOT_SUPPORTED |
| CIs wide · N insufficient per §13.6 | — | — | — | INSUFFICIENT_EVIDENCE |
| L1/L2 accuracy ≤ chance + 5pp | — | Δ_L1/L2 ≤ 0 | — | ORTHOGRAPHIC_EFFECT_NOT_FOUND (for 01A) |
| Any · question addressed lies outside Phase 2 corpus/design | — | — | — | NOT_TESTABLE_IN_THIS_EXPERIMENT (specify which question) |
| Fundamental limit (§17) prevents conclusion | — | — | — | FUNDAMENTAL_LIMIT_HIT (specify which limit) |

**Load-bearing rule:** UNREPRESENTABLE Baseline B output does NOT count toward "C beats B". Only comparison B (capability extension against Baseline A) applies for those dimensions.

---

## §16 · Hard-stop conditions (revised · adds Slice 1 hard-stops)

Stop the experiment (report accordingly) if:

1. Corpus fails ground-truth review after 10% audit
2. Gold and mechanism turn out circular after Slice 4 review
3. Held-out combinations turn out to be in training after §7.4 verification
4. Baseline C does not satisfy any of comparison A or B in §11.3
5. Hidden LLM path detected in zero-LLM audit
6. Ablation effects vanish under §10 confound audit
7. Statistical evidence genuinely insufficient (all CIs wide)
8. **New** · TREC-10 coverage < 10 items per target after §7.5 verification (unless founder chooses a/b/c/d)
9. **New** · MorphoLex-en + CELEX2 + Etymonline all fail to cover a lexeme (marked morphology_unknown · Slice 3 must decide whether to proceed with reduced L3 coverage)
10. **New** · Wuggy or equivalent nonword generator inaccessible AND hand-curated frequency-matched nonces cannot be constructed defensibly (Slice 1 hard-stop before ablation runs)

---

## §17 · Fundamental limits (unchanged · all five visible)

Per founder's hard rule to keep all limitations explicitly visible:

- **§17.1 · Phonology cannot be isolated from orthography** in text-only mechanism · fundamental limit
- **§17.2 · Wh-class-vs-non-wh-class not testable in English** · fundamental limit
- **§17.3 · N=150 pilot** · under-powered for population inference
- **§17.4 · Single-annotator gold** · pilot bias
- **§17.5 · Mechanism-author + gold-author overlap** · circularity mitigated but not eliminated

All five reported in final report Limitations section verbatim.

---

## §18 · Bias disclosures (unchanged from v3)

9 disclosures per v3 §18 · all retained.

---

## §19 · Isolation from production NEX1 (revised · adds 01A augment file · Wuggy file · stat-plan file)

```
src/lib/nex-agent/experiments/language-01/
  README.md
  fixtures/
    corpus.jsonl                        (150 sentences · TREC-derived · SHA-256 committed)
    corpus-01a-augment.jsonl            (12 additional matched-control items · flagged provenance)
    gold-labels.jsonl                   (frozen · SHA-256 committed · 6-dim + ambiguity)
    subword-decomposition.jsonl         (MorphoLex-en → CELEX2 → Etymonline fallback chain · per-entry source)
    wuggy-nonces.jsonl                  (A8 pseudo-words with parameters)
    wh-strip-nonces.jsonl               (A9 wh-morpheme-strip nonces with frequency-matching rationale)
    held-out.jsonl                      (30% · lexical-triple verified per §7.4)
  policy/
    slice0-baseline-b-mapping.jsonl     (Baseline B module reachability · output-mapping table with UNREPRESENTABLE markers)
    stat-plan-v1.md                     (frozen pre-registration · SHA-256)
  lexical-dictionary-v1.ts
  representation-levels/
    l1-letter-bag.ts
    l2-letter-ngram.ts
    l3-subword.ts
    l4-lexeme.ts
    l5-lexeme-position.ts
    l6-lexeme-frame.ts
    l7-lexeme-frame-context.ts   (Phase 2 · effectively same as l6)
  compositional-mechanism-v1.ts        (Baseline C)
  baseline-a-surface-match.ts
  baseline-b-wrapper.ts                (11-module reachable path · READ ONLY)
  ablation-runner.ts
  confound-audit-runner.ts             (12 confounds · REPORTED-NOT-CONTROLLED handling)
  statistical-analysis.ts              (per §13)
  run-experiment.ts                    (slices 0-7)
data/nex-language-experiment-01/
  results/
    slice1-coverage-audit.jsonl        (TREC-10 coverage report · Slice 1)
    slice-{N}-{timestamp}.jsonl        (append-only)
  reports/
    phase2-report-{date}.md            (final · 32 items per mission §25)
```

Nothing in production modified. Baseline B READS 11 modules · never mutates.

---

## §20 · Slice execution order (revised · adds Slice 1 sub-tasks)

- **Slice 0** · Reachable-path audit + Baseline B mapping (READ-ONLY · produces §11.2 UNREPRESENTABLE-annotated table)
- **Slice 1** · Corpus + gold + subword-decomposition + Wuggy nonces + coverage audits
  - Sub-task 1a: TREC-10 coverage verification (§7.5) · hard-stop if <10 per target
  - Sub-task 1b: MorphoLex-en → CELEX2 → Etymonline decomposition (§8.3)
  - Sub-task 1c: Wuggy nonces for A8/A9 (§9.2)
  - Sub-task 1d: Gold labels written and SHA-256 committed
  - Sub-task 1e: Stat-plan-v1.md frozen and SHA-256 committed (per amendment N6)
  - Sub-task 1f: Held-out set verified for lexical-triple absence (§7.4)
- **Slice 2** · Baseline A + B measured against gold (using UNREPRESENTABLE-annotated mapping)
- **Slice 3** · Lexical dictionary v1
- **Slice 4** · Compositional mechanism v1 (Baseline C)
- **Slice 5** · Ablation matrix run
- **Slice 6** · Experiment 01A + confound audit (using REPORTED-NOT-CONTROLLED handling for #3/#5/#10)
- **Slice 7** · Phase 2 final report (32 items)

Each slice may reach hard-stop and terminate the experiment early. That is a successful outcome.

---

## §21 · What I have NOT done in v4

- Not written any code
- Not created any fixture / corpus / decomposition file / nonce file / mechanism file
- Not modified any production NEX1 code
- Not defended v3 · applied all 8 audit amendments honestly
- Not softened any amendment to look smaller
- Not weakened the experiment to reach READY (per founder's hard rule)

---

## §22 · Ready for third-round audit

v4 applies all 8 second-round audit amendments. Path 1 protocol continues.

**Next step:** third-round adversarial audit of v4. If it passes with zero outstanding issues → READY FOR FOUNDER SIGN-OFF. If further amendments needed → v5.

Zero implementation until an audit returns READY and founder signs off.

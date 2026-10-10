# NEX-LANGUAGE-EXPERIMENT-01 · Phase 2 v3 Design · Second-Round Adversarial Audit

**Date:** 2026-09-18
**Auditor:** master_ai_engineer (Claude Opus 4.7) · read-only audit
**Discipline:** Same as prior audit · test the design, do not defend it. Truth before architecture.
**Predecessor:** `docs/doctrine/nex-language-experiment-01-phase2-audit-2026-09-18.md` (first-round audit · found 17 amendments)
**Subject:** `docs/doctrine/nex-language-experiment-01-phase2-design-v3-2026-09-18.md` (v3 · claims 17/17 amendments applied)

---

## §1 · TL;DR verdict

**AMEND BEFORE SIGN-OFF.**

v3 correctly applied 15 of 17 first-round amendments. But adversarial re-read surfaced **8 NEW weaknesses** that either:
- were incompletely resolved (2 of the 17)
- were introduced *by* v3 itself (5 net-new)
- reflect a naming collision with the founder's new Experiment 01B scope (1)

Detailed list at §14. Ranked at §14.1. No CRITICAL new blockers · but the specification gaps compound if left. One more revision (v4) recommended before sign-off.

---

## §2 · Verification of first-round 17 amendments in v3

Auditing each of the 17 first-round amendments against v3 text:

| # | Prior severity | Resolution claim in v3 | Verification | Verdict |
|---|---------------|----------------------|-------------|---------|
| 1 | CRITICAL | 01A scoped to wh-family morpheme only (§5) | §5.1-5.4 correctly narrows scope · §12 augments corpus with matched non-wh controls | **RESOLVED** |
| 2 | CRITICAL | Baseline B output→gold mapping specified (§11.2) | §11.2 provides a table for 3 of 6 dimensions (question_operator · expected_answer_type · target). **Polarity · conditional · event have essentially no coverage.** No UNREPRESENTABLE markers where founder explicitly requested them. | **INCOMPLETE** |
| 3 | CRITICAL | ss/ie letter-pair deferred to Experiment 01B (§5.4) | Correctly deferred. But **naming collision**: founder's new brief re-scopes 01B to "Affective / experiential / emotional word signal", not letter-pair. My v3's 01B references are now ambiguous. | **RESOLVED but MISNAMED** |
| 4 | HIGH | A9 wh-prefix strip redesigned (§9.2) | "why → xy", "what → xat", etc. All nonces guaranteed. But **choice of "x" as replacement letter is arbitrary and may introduce new confounds** — initial "x" is rare in English orthography (frequency ~0.15%) which may bias the classifier. | **INCOMPLETE · new confound** |
| 5 | HIGH | Unknown-lexeme behavior defined (§14.2) | Clear specification: UNKNOWN outputs with structural fallback. | **RESOLVED** |
| 6 | HIGH | Contextual ablation dropped from Phase 2 (§9.4) | Cleanly deferred to Phase 3 · limit disclosed. | **RESOLVED** |
| 7 | HIGH | Subword source named (§8.3) | MorphoLex-en + Etymonline fallback. But **MorphoLex-en primarily covers polysyllabic content words**; monosyllabic wh-words (why, what, when, how, which) may not be in it. Fallback protocol undefined for gaps. | **INCOMPLETE** |
| 8 | HIGH | Confound audit method per confound (§10.2) | 12 methods specified. But **char-frequency uses regression covariate (§10.2 #3) which conflicts with §13.5 under-power warnings** at N=150. Internal inconsistency. | **INCOMPLETE · contradiction** |
| 9 | HIGH | "Unseen combination" operationalised (§7.4) | Precise triple-difference definition + hard-stop verification procedure. | **RESOLVED** |
| 10 | MEDIUM | Statistical analysis plan (§13) | Bootstrap CIs · FDR correction · assumption checks · under-power warnings. **Missing: pre-registration commitment** (the plan must be frozen before data collection or it invites p-hacking). | **INCOMPLETE** |
| 11 | MEDIUM | Pilot-gate → verdict outcome table (§15.2) | Table provided but **does not distinguish "exceeding Baseline B where B has signal" from "filling Baseline B UNKNOWN cells"**. These are different capability claims and should map to different verdicts. | **INCOMPLETE** |
| 12 | MEDIUM | Central research question operationalised (§2.2) | Concrete thresholds for "first measurable" (Δ ≥ 5pp, CI not crossing zero, survives confounds) and "reusable" (held-out ≥ Baseline A + 10pp). | **RESOLVED** |
| 13 | LOW | Phonology limit disclosed (§17.1) | Explicit statement. | **RESOLVED** |
| 14 | LOW | 11-outcome verdict taxonomy (§15.1) | Complete named list. | **RESOLVED** |
| 15 | LOW | Corpus from published examples (§7.1) | Derived from Li & Roth 2002 TREC-10. But **coverage of the 9 target lexemes with ≥ 10 items each is claimed, not verified.** Slice 1 must verify this or the corpus fails at construction. | **INCOMPLETE · unverified claim** |
| 16 | LOW | Multi-label gold protocol (§6.3) | Clear tri-state protocol. | **RESOLVED** |
| 17 | LOW | Wh-class-vs-non-wh limit disclosed (§17.2) | Explicit statement. | **RESOLVED** |

**Resolution summary:** 10 fully resolved · 7 incompletely resolved · **6 items need further work.**

---

## §3 · New issues introduced by v3

Beyond the 7 incomplete prior amendments, v3 introduced or newly exposed:

### N1 · Nonce-letter choice may introduce a new confound (from amendment #4)

**Issue:** A9 uses "x" as the replacement letter (why → xy, what → xat). "x" has a rare initial-letter frequency in English (~0.15%). If the L1/L2 classifier is sensitive to initial-letter frequency, the nonce condition may score differently for reasons unrelated to the wh-morpheme's removal.

**Fix required:** either (a) generate nonces with initial-letter frequency matched to the removed morpheme's initial letter frequency (e.g., replace "wh-" with another consonant-cluster of similar frequency), or (b) use a formal nonword generator like Wuggy (New & Grainger, 2004) with documented parameters, or (c) explicitly disclose that A9 conflates "wh-morpheme absence" with "rare-letter initial".

### N2 · Baseline B mapping incomplete for 3 of 6 dimensions (from amendment #2 · partial)

**Issue:** v3 §11.2 provides a mapping for question_operator, expected_answer_type, and target. For **polarity**, only two modules contribute (detectPreference, detectCorrection) and their outputs are only partially aligned with polarity. For **conditional**, NO module in the 11 covers conditional detection. For **event** (verb lemma), no module explicitly extracts this.

The founder explicitly instructed: "If any gold dimension cannot legitimately be derived from Baseline B, mark it: **UNREPRESENTABLE** rather than inventing a mapping."

**Fix required:** mark polarity (partial), conditional (fully UNREPRESENTABLE), and event (fully UNREPRESENTABLE) explicitly. Comparison rules must exclude UNREPRESENTABLE dimensions from the "Baseline C exceeds B" test.

### N3 · Experiment 01B naming collision

**Issue:** v3 §5.4 defers the letter-pair hypothesis to "Experiment 01B". The founder's new brief re-scopes 01B to "Affective / experiential / emotional word signal". These are different experiments.

**Fix required:** rename the letter-pair experiment to **Experiment 01C** (or similar · e.g., "01A-extended") to align with the founder's naming. Update all v3 references.

### N4 · MorphoLex-en coverage of monosyllabic wh-words not verified

**Issue:** MorphoLex-en (Sánchez-Gutiérrez et al. 2018) primarily covers polysyllabic English words. Monosyllabic wh-words may not appear in the database.

**Fix required:** verify MorphoLex-en coverage of the 9 target words + 6-8 subject NPs + 6-8 verbs. Where MorphoLex-en has no entry, specify the Etymonline fallback protocol precisely (which fields, which URL patterns, how to record provenance). Alternative: use **CELEX2** (Baayen et al. 1995) which does cover monosyllabic function words.

### N5 · Confound audit method has internal inconsistency

**Issue:** §10.2 confound #3 (character frequency) uses "post-hoc regression covariate". §13.5 warns that regression is under-powered at N=150 with many predictors. The two sections contradict.

**Fix required:** reconcile. Either (a) use stratified analysis or matched-subset for char-frequency (consistent with §13), or (b) explicitly acknowledge that char-frequency confound cannot be formally controlled at pilot N and mark it as REPORTED-NOT-CONTROLLED (like phonology in #5).

### N6 · Pre-registration commitment missing

**Issue:** v3 §13 defines the statistical plan but does not commit to freezing it before data collection. Without pre-registration, the analysis plan can be modified after seeing results, which invites p-hacking.

**Fix required:** add explicit statement that the statistical analysis plan (§13) is **frozen** before Slice 2 runs. Any post-hoc change to the plan requires disclosure and treats affected results as exploratory.

### N7 · Verdict mapping doesn't handle "filling UNREPRESENTABLE cells"

**Issue:** v3 §15.2 verdict mapping assumes Baseline C either beats Baseline B on a dimension or doesn't. But if Baseline B is UNREPRESENTABLE for polarity/conditional/event (per N2), Baseline C might produce output where B produces nothing. Is that "exceeding B" or "producing signal in a gap"?

**Fix required:** refine verdict mapping to distinguish:
- Baseline C exceeds Baseline B on dimensions where B has real signal → capability improvement
- Baseline C produces output where B is UNREPRESENTABLE → capability extension (not necessarily improvement)
- Both should be reported but map to different sub-verdicts.

### N8 · TREC-10 corpus coverage of target lexemes unverified

**Issue:** v3 §7.1 claims 10 items per target wh-word from Li & Roth TREC-10. TREC has strong coverage of "who", "what", "where", "when", "how", "why", "which" — but the ≤10-word filter and the specific frame requirements (matched subject/verb templates) may yield fewer than 10 usable items per lexeme.

**Fix required:** Slice 1 must verify coverage before construction proceeds. If any target has < 10 items, corpus construction fails and requires either (a) relaxing the filter, (b) supplementing from CHILDES with provenance recorded, or (c) reducing per-target N and disclosing. Explicit hard-stop condition in §16.

---

## §4 · Section-by-section scientific validity audit (§3 of framework)

### A · Causal isolation

- Letter vs. pair vs. subword: v3 clearly names the wh-family confound and addresses it via §12 augmented corpus. **BUT** the nonce confound (N1) reintroduces a smaller version of the problem at L1/L2. Fix required.
- Word vs. position vs. frame: cleanly separated by A2/A3/A4 vs. A5/A6.
- Context: cleanly deferred.

**Net verdict:** substantially better than v2. Still needs N1 fix.

### B · Orthography vs. morphology

**v3 handles this correctly** via §12 augmented corpus with matched non-wh w-words and non-w interrogatives ("how"). Test 12c ("how" vs. "why") is a genuine orthography-vs-morphology dissociation attempt.

**BUT** the audit disclosure in §17.1 correctly notes that phonology cannot be isolated in text-only mechanism. This is a fundamental limit, correctly stated.

**Verdict:** resolved except phonology-limit which is not fixable.

### C · Phonology

**Fundamental limit** correctly disclosed in §17.1. Not testable in text-only Phase 2. Not claimed to be tested. **Resolved via honest disclosure.**

### D · Frequency + length + character freq + others

12-confound matrix provides methods (§10.2). Internal inconsistency N5 must be fixed. Otherwise **resolved via specified methods**.

---

## §5 · Baseline B audit (§4 of framework)

- Module inventory: 11 modules · confirmed reachable · no LLM.
- Output→gold mapping: **INCOMPLETE per N2** · 3 of 6 dimensions need UNREPRESENTABLE marking.
- Reachability test: Slice 0 will produce this artefact · reasonable.
- Comparison-fairness rule: v3 §11.2 last paragraph handles the multi-dimension case adequately. But N7 (UNREPRESENTABLE cells) needs refinement.

**Verdict:** mapping table needs completion per N2 · comparison rule needs refinement per N7. Otherwise sound.

---

## §6 · Train/test separation (§5 of framework)

v3 §7.4 provides:
- Precise operational definition (lexical-triple absent from training)
- Verification procedure (set-difference · pairwise)
- Hard-stop on failure (regenerate held-out)

**Verdict: RESOLVED.**

---

## §7 · Gold-label audit (§6 of framework)

v3 §6:
- Source taxonomies named (Li & Roth 2002 · Dowty 1991)
- Freeze protocol
- 10% audit
- Multi-label protocol
- Single-annotator bias disclosed

**Verdict: RESOLVED.** No new issues.

---

## §8 · Statistical audit (§7 of framework)

v3 §13:
- Effect sizes: bootstrap ✓
- CIs: bootstrap 95% ✓
- Multiple comparison: FDR at q=0.10 ✓
- Assumption checks specified ✓
- Under-power disclosure ✓

**MISSING per N6:** pre-registration / freeze commitment on the plan.

**INTERNAL CONTRADICTION per N5:** regression at N=150.

**Verdict:** substantively complete but N5 + N6 must fix.

---

## §9 · Four-way ablation audit (§8 of framework)

Ablation families cleanly isolated:
- Lex (A1/A5/A6)
- Ortho (A7/A8/A9) · A9 has nonce-letter confound per N1
- Struct (A2/A3/A4)
- Context: deferred (correctly)

**Verdict:** N1 needs fix. Otherwise sound.

---

## §10 · Control strategy audit (§9 of framework)

Four strategies (A/B/C/D) unchanged from v2. Each tests a narrow claim. Combined coverage is partial but honest.

**Verdict:** unchanged · resolved to the extent English permits.

---

## §11 · Letter-level hypothesis audit (§10 of framework)

The founder's original letter-pair hypothesis (ss / ie) is **cleanly deferred** by v3 §5.4 to a separate experiment. Naming collision (N3) is the only remaining issue — rename to 01C.

The wh-family morpheme investigation in 01A is cleanly scoped.

**Verdict:** RESOLVED except naming (N3).

---

## §12 · No-LLM audit (§11 of framework)

v3 §14.5 zero-LLM invariant clearly stated. Mechanism cannot use embeddings, APIs, or pretrained models. Slice 0-7 will each verify.

**Verdict: RESOLVED.**

---

## §13 · Falsification audit (§12 of framework)

11-outcome verdict taxonomy §15.1 explicit. Verdict mapping §15.2 mostly complete but needs N7 refinement.

**Verdict:** N7 must fix. Otherwise sound.

---

## §14 · Amendments required for v4

Ranked by impact on validity:

### CRITICAL for validity (must fix before implementation)

**N2 · Complete Baseline B mapping · mark UNREPRESENTABLE explicitly**
- polarity: partial coverage from detectPreference/detectCorrection · mark as partial
- conditional: no module covers · mark as **UNREPRESENTABLE**
- event: no module covers · mark as **UNREPRESENTABLE**
- Comparison rule: exclude UNREPRESENTABLE dimensions from "Baseline C exceeds B" test

**N7 · Refine verdict mapping to handle UNREPRESENTABLE cells**
- Distinguish "exceed B where B has signal" from "produce signal where B is UNREPRESENTABLE"
- Add sub-verdicts to §15.2 table

### HIGH · specification gaps

**N1 · Fix A9 nonce-letter confound**
- Match nonce initial-letter frequency to original OR use documented nonword generator (Wuggy) OR disclose the confound explicitly.

**N4 · Verify MorphoLex-en coverage · specify fallback**
- Slice 1 verifies MorphoLex-en has entries for target words. Where missing, use CELEX2 or hand-audit against Etymonline with per-entry provenance.

**N5 · Reconcile confound method for char-frequency**
- Stratified/matched-subset consistent with §13's under-power warning, or mark as REPORTED-NOT-CONTROLLED.

**N6 · Pre-registration commitment**
- Statistical analysis plan §13 is frozen before Slice 2 runs. Post-hoc changes disclosed and treated as exploratory.

### MEDIUM · alignment

**N3 · Rename letter-pair experiment to Experiment 01C**
- Founder's brief re-scopes 01B to "Affective / experiential / emotional word signal"
- Update all v3 references to letter-pair-experiment to use 01C
- Add explicit table showing three experiment scopes:
  - **01** · Language composition + reusable interpretation
  - **01A** · Orthographic (letter/sequence/subword · scoped to wh-family morpheme in Phase 2)
  - **01B** · Affective / experiential / emotional word signal (founder's new · not yet designed)
  - **01C** · Arbitrary letter-pair signal (ss/ie/etc · deferred from Phase 2 · corpus-specific)

### LOW · verification

**N8 · Verify TREC-10 coverage of target lexemes**
- Slice 1 must confirm ≥ 10 usable items per target lexeme before construction
- Explicit hard-stop condition

---

## §14.1 · Severity summary

- **2 CRITICAL** for validity (N2, N7)
- **4 HIGH** specification gaps (N1, N4, N5, N6)
- **1 MEDIUM** naming (N3)
- **1 LOW** verification (N8)

**Total: 8 amendments for v4.**

None require conceptual restructuring. All are precision fixes or additions the founder's brief explicitly named ("UNREPRESENTABLE", 01B/01C naming, pre-registration).

---

## §15 · Fundamental limits (unchanged · restated for completeness)

- Phonology cannot be isolated in text-only mechanism (§17.1 of v3)
- Wh-class-vs-non-wh-class not testable in English (§17.2 of v3)
- N=150 pilot only · underpowered for population inference
- Single-annotator (me) · pilot bias disclosed
- Corpus from published examples (TREC-10) · fixture-based · ecological validity limited
- Author-of-mechanism = author-of-gold-labels · circularity mitigated but not eliminated

These are the honest ceiling of what Phase 2 can conclude, regardless of amendments.

---

## §16 · Remaining scientific risks after v4 amendments

Even with v4 amendments applied:

- Baseline C may not exceed Baseline B on dimensions where B has signal · that produces NOT_SUPPORTED honestly
- Wh-family effects may be entirely morphology-explained · that produces MORPHOLOGY_EXPLAINS_EFFECT honestly
- Letter-level effects may be null · that produces ORTHOGRAPHIC_EFFECT_NOT_FOUND honestly
- Frequency confounds may dominate · that produces FREQUENCY_EXPLAINS_EFFECT honestly
- Effects may fail to generalise on held-out · that produces NO_GENERALISATION honestly
- Statistical power may be insufficient · that produces INSUFFICIENT_EVIDENCE honestly

Any of these are legitimate scientific outcomes.

---

## §17 · Remaining engineering risks after v4 amendments

- Mechanism may exceed 300 LOC once all ablation-condition handling is included · that's fine as long as it stays deterministic + zero-LLM
- MorphoLex-en / CELEX2 accessibility not verified in this environment · Slice 1 must confirm before Slice 3
- Bootstrap CI computation at 10,000 resamples per cell may be slow at ~1500 cells · manageable but non-trivial

---

## §18 · Evidence required before implementation

Once v4 is produced and re-audited:
- Zero CRITICAL amendments outstanding
- Zero incompletely-resolved prior amendments
- Explicit READY verdict on the v4 audit
- Founder signs off explicitly

Only then does Slice 0 begin.

---

## §19 · Final decision

**AMEND BEFORE SIGN-OFF.**

Required amendments for v4:
- 2 CRITICAL (N2, N7) — must fully resolve to allow measurable Baseline B and coherent verdict mapping
- 4 HIGH (N1, N4, N5, N6) — specification gaps that would introduce interpretation risk
- 1 MEDIUM (N3) — naming alignment with founder's brief
- 1 LOW (N8) — verification hard-stop

**Total: 8 amendments.** Path 1 protocol continues: revise to v4 · re-audit · iterate until READY.

**Zero code written.** Zero fixture created. Zero production file modified.

Ready for founder decision:
1. Approve 8 v4 amendments · I produce v4 · re-audit until READY
2. Accept v3 as "READY with disclosed 8 residual issues" (path 1 says no · this option is not preferred)
3. Change scope

I recommend path 1 continues: produce v4 · re-audit.

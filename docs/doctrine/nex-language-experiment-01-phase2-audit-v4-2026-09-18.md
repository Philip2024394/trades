# NEX-LANGUAGE-EXPERIMENT-01 · Phase 2 v4 Design · Third-Round Adversarial Audit

**Date:** 2026-09-18
**Auditor:** master_ai_engineer (Claude Opus 4.7) · read-only
**Discipline:** Test the design · do not defend it. Truth before architecture. Do not weaken to reach READY.
**Predecessors:** first-round audit (17 amendments) · second-round audit (8 amendments)
**Subject:** `docs/doctrine/nex-language-experiment-01-phase2-design-v4-2026-09-18.md` (v4 · claims 8/8 second-round amendments applied)

---

## §1 · TL;DR verdict

**READY FOR FOUNDER SIGN-OFF** *with 2 residual documented items* that are honest limits, not fixable design flaws.

- 8/8 second-round amendments **fully resolved** in v4 · verified item-by-item at §2 below.
- 2 residual items exist as **environment-dependent hard-stops** (Wuggy availability · MorphoLex coverage) but these are correctly documented as Slice 1 hard-stops with explicit fallback protocols. They are not design flaws — they are outcomes to be discovered during Slice 1, with founder-decision paths already defined.
- No new issues introduced by v4 revisions.

Recommendation: sign off, subject to the founder accepting the 2 residual items as legitimate Slice-1 hard-stop scenarios rather than pre-implementation blockers.

Full audit below.

---

## §2 · Verification of 8 v3-audit amendments in v4

| # | v3 audit amendment | v4 resolution location | Verification | Verdict |
|---|-------------------|----------------------|-------------|---------|
| N2 | Baseline B mapping · UNREPRESENTABLE markers · exclude from "C exceeds B" | §11.2 table + §11.3 comparison rules | Table now shows: question_operator REPRESENTABLE-partial · expected_answer_type REPRESENTABLE-partial · polarity REPRESENTABLE-partial · **conditional UNREPRESENTABLE** · target REPRESENTABLE-partial · **event UNREPRESENTABLE**. §11.3 defines comparison A (improvement, on REPRESENTABLE dims only) and comparison B (extension, on UNREPRESENTABLE dims). Verdict aggregation rule specified. | **RESOLVED** |
| N7 | Capability improvement vs. extension vs. neither vs. insufficient | §15.2 verdict table + §11.3 comparison rules | Verdict table explicitly distinguishes the four cases with concrete criteria. UNKNOWN/UNREPRESENTABLE B output cannot artificially create "C beats B" — this is enforced by the load-bearing rule at end of §15.2. | **RESOLVED** |
| N1 | Nonce-letter confound · Wuggy or matched-frequency substitution | §9.2 A9 revised | Old "x" prefix REJECTED. A9 now uses Wuggy-generated pseudo-morphemes with initial bigram frequency matched to average English initial-bigram frequency in CELEX. 3 candidates per wh-word committed to `wh-strip-nonces.jsonl` with rationale. Environment-dependent hard-stop (§16 item 10) if Wuggy unavailable and hand-curated defensible nonces cannot be constructed. Residual confound (frequency-matched replacement is still a replacement, not absence) is disclosed. | **RESOLVED with documented residual disclosure** |
| N4 | MorphoLex verification · fallback protocol | §8.3 fallback chain + §16 item 9 hard-stop | Chain: MorphoLex-en → CELEX2 → Etymonline. Slice 1 verifies coverage. Where all three lack an entry, lexeme marked morphology_unknown and L3 classifier reports UNKNOWN for it. Hand-invented decompositions prohibited. | **RESOLVED** |
| N5 | Char-frequency method · resolve regression-vs-underpower contradiction | §10 confound table row 3 | Character frequency now marked **REPORTED-NOT-CONTROLLED** consistent with #5 (phonology) and #10 (orthographic convention). Effect-survival criterion explicitly includes the caveat "does not exclude confound #3/#5/#10 as alternative explanation". | **RESOLVED** |
| N6 | Pre-registration commitment | §13.7 | Statistical analysis plan frozen at end of Slice 1 as `stat-plan-v1.md` with SHA-256. Content specified (primary + secondary outcomes, effect size, CI, multi-comparison, missing data, UNREPRESENTABLE handling, pilot-gate interpretation, falsification). Changes after Slice 2 begins go to separate Exploratory section. | **RESOLVED** |
| N3 | Experiment naming · 01 / 01A / 01B / 01C · no overlap | §5.1 scope table | Four-experiment table matches founder's brief exactly. 01B correctly named for Affective/emotional (founder's new). Letter-pair correctly renamed to 01C. No overlap enforced. | **RESOLVED** |
| N8 | TREC-10 coverage verification · hard-stop | §7.5 + §16 item 8 | Slice 1 first sub-task verifies coverage. Hard-stop if <10 per target lexeme. Four founder-decision options (a/b/c/d) explicitly enumerated. No sentence construction proceeds until decision. | **RESOLVED** |

**Resolution summary: 8/8 fully resolved · 0 incomplete.**

---

## §3 · New issues introduced by v4?

Adversarial re-read of the whole v4 document looking for regressions or newly-introduced weaknesses:

### N9 (candidate) · Wuggy accessibility risk

**Observation:** v4 §9.2 mandates Wuggy for A8/A9 nonce generation. Wuggy is a Python + web tool. Availability in this environment is not verified.

**Is this a design flaw?** No — §16 item 10 explicitly makes this a Slice 1 hard-stop condition with a fallback (hand-curated frequency-matched nonces from CELEX bigram frequencies) or founder-decision route.

**Verdict:** documented residual · not a design flaw. Legitimate Slice 1 hard-stop.

### N10 (candidate) · MorphoLex-en / CELEX2 accessibility risk

**Observation:** §8.3 mandates the three-source fallback chain. Availability of MorphoLex-en (OSF-hosted) and CELEX2 (LDC-licensed) in this environment is not verified.

**Is this a design flaw?** No — §16 item 9 makes MorphoLex+CELEX+Etymonline gap a Slice 1 hard-stop with morphology_unknown flag and reduced L3 coverage as a documented outcome. Where a lexeme has no morphology data, no L3 signal is claimed. This is honest, not weakness-hiding.

**Verdict:** documented residual · not a design flaw. Legitimate Slice 1 hard-stop.

### N11 (candidate) · Baseline B representability of polarity is "partial"

**Observation:** §11.2 marks polarity as REPRESENTABLE (partial). The mapping says: "If either detector fires: use detector output. Otherwise: UNREPRESENTABLE for that sentence."

**Is this a design flaw?** Partially. The definition means polarity is REPRESENTABLE only for the small subset of sentences where detectors fire (which will be very few — most corpus sentences are wh-questions where preference/correction detection doesn't apply). Effectively polarity will be UNREPRESENTABLE for most of the corpus.

**Is this concealed anywhere?** No · §11.2 mapping row is explicit that "majority of corpus" will be UNREPRESENTABLE. §11.3 comparison A restricts to sentences where Baseline B doesn't output UNREPRESENTABLE. So comparison A for polarity will have very few sentences.

**Verdict:** honest disclosure · not concealed. But the audit should note that comparison A on polarity will have very low N and results should be interpreted accordingly (INSUFFICIENT_EVIDENCE per §15 is plausible for polarity comparison A). Adding this note to the final report is required · this is a specification refinement, not a blocker.

### N12 (candidate) · The "structure explains letters" test in §12.3 has small N

**Observation:** 01A tests 12a/12b/12c on the wh-family and non-wh w-word control set (~12 augment items).

**Is this a design flaw?** The 12-item control set is small. Δ_L3 on non-wh-family may have wide CIs due to N. This is an under-power concern, disclosed at §13.6 and §17.3.

**Is this concealed anywhere?** No · §13.6 explicitly requires per-dimension under-power disclosure.

**Verdict:** documented residual · not a design flaw. Under-power warning will apply to 01A conclusions.

### N13 (candidate) · No adversarial re-audit of the pre-registration plan

**Observation:** §13.7 pre-registration is a commitment to freeze the stat plan. But the stat plan itself (§13.1-13.6) is written by me, the same person who will run the mechanism. Is there any check on whether the plan itself is defensible before it's frozen?

**Is this a design flaw?** Partially. The frozen plan gets SHA-256 committed but no independent review of the plan happens. The founder can review it at end of Slice 1 before Slice 2 begins — this is implicit in the "Slice 1 sub-task 1e" completion checkpoint. Making this explicit strengthens the design.

**Recommended addition:** end of Slice 1 requires **explicit founder review of stat-plan-v1.md** before Slice 2 may begin. This is a Slice-1 checkpoint not a further design flaw.

**Verdict:** minor addition needed · single line to §20 slice order.

---

## §4 · New issues summary

- N9 · Wuggy accessibility → documented Slice 1 hard-stop · not a blocker
- N10 · MorphoLex/CELEX accessibility → documented Slice 1 hard-stop · not a blocker
- N11 · Polarity comparison A will have low N → disclosure in report · not a blocker
- N12 · 01A control set N=12 → under-power warning applies · disclosed per §13.6
- N13 · Stat plan needs founder review at end of Slice 1 · **minor addition to §20 recommended**

Only N13 is a new specification refinement worth acting on. The other 4 are legitimate documented residual limitations.

---

## §5 · Section-by-section validity audit

### A · Causal isolation (audit framework §3.A)

- Letter vs. pair vs. subword: v4 addresses via §12 augmented corpus + §10 confound audit + Wuggy nonces (§9.2)
- Word vs. position vs. frame: cleanly separated by ablation families
- Context: cleanly deferred
- Phonology: explicitly UNCONTROLLED · fundamental limit

**Verdict: satisfactory** given the fundamental limit disclosure.

### B · Orthography vs. morphology (framework §3.B)

Handled via §12 augmented corpus (matched non-wh w-words) + test 12c ("how" vs. "why" orthography-vs-morphology dissociation) + §10 confound #6 matched-subset method.

**Verdict: satisfactory** with acknowledged phonology inseparability.

### C · Phonology (framework §3.C)

Fundamental limit disclosed at §17.1. Not claimed to be tested. Marked REPORTED-NOT-CONTROLLED in §10.

**Verdict: correct honest disclosure**.

### D · Frequency + length + character freq + others (framework §3.D)

Method-per-confound specified. Char-frequency and orthographic-convention marked REPORTED-NOT-CONTROLLED. Others use stratification / matched-subset per §10.

**Verdict: satisfactory** with disclosed non-controlled confounds.

### Baseline B (framework §4)

11-module inventory verified. Output→gold mapping now specifies REPRESENTABLE / UNREPRESENTABLE per dimension. Comparison A vs. B clearly distinguished. No hidden LLM path.

**Verdict: satisfactory** with §5 residual N11 disclosure (polarity low N).

### Train/test separation (framework §5)

§7.4 operational definition + set-difference verification + hard-stop protocol. Correct.

**Verdict: satisfactory**.

### Gold-label audit (framework §6)

§6 methodology: published taxonomies, freeze, 10% audit, multi-label protocol, single-annotator disclosure.

**Verdict: satisfactory** with disclosed pilot bias.

### Statistical audit (framework §7)

Bootstrap CIs · FDR · assumption checks · pre-registration · under-power warnings. §13.7 pre-registration is now committed.

**Verdict: satisfactory** with N13 recommended addition (founder review of stat plan).

### Four-way ablation (framework §8)

Lex / Ortho / Struct families cleanly separated. Contextual deferred. Wuggy nonces address prior confound.

**Verdict: satisfactory**.

### Control strategy (framework §9)

Four strategies A/B/C/D each with documented narrow-claim scope. Combined coverage partial but honest.

**Verdict: satisfactory** given English limits.

### Letter-level hypothesis (framework §10)

Deferred to Experiment 01C. Scoping explicit. wh-family morpheme in 01A only.

**Verdict: satisfactory** with clear NOT_TESTABLE_IN_THIS_EXPERIMENT for arbitrary letter-pairs.

### No-LLM audit (framework §11)

Zero-LLM invariant clear. Slice 0-7 verify.

**Verdict: satisfactory**.

### Falsification (framework §12)

12-outcome verdict taxonomy including NOT_TESTABLE_IN_THIS_EXPERIMENT. Verdict mapping in §15.2 explicit.

**Verdict: satisfactory**.

---

## §6 · Fundamental limits check (per founder's hard rule)

All 5 must remain visible per founder brief:

1. Phonology cannot be isolated from orthography · §17.1 ✓
2. Wh-class vs. non-wh-class not testable in English · §17.2 ✓
3. N=150 pilot only · §17.3 ✓
4. Single-annotator gold · §17.4 ✓
5. Mechanism-author + gold-author overlap · §17.5 ✓

**All five preserved.**

---

## §7 · Hard rule check (per founder's brief)

> "If a scientifically important question cannot be answered by the current design, label it NOT TESTABLE IN THIS EXPERIMENT rather than modifying the experiment until it produces an answer."

v4 §4 adds NOT_TESTABLE_IN_THIS_EXPERIMENT to the verdict taxonomy. v4 §15.1 explicitly includes it. v4 §5 lists what's not testable: letter-pair (01C), affective (01B), context (Phase 3), cross-linguistic (out of scope), phonology (fundamental), wh-vs-non-wh (fundamental).

**Hard rule satisfied.**

---

## §8 · Residual amendments for v5 (if founder wants them)

Only 1 minor addition proposed:

- **N13 · Add founder review of stat-plan-v1.md as explicit end-of-Slice-1 checkpoint before Slice 2 may begin.** One line to §20 slice order.

This is optional. If the founder considers the current §13.7 pre-registration + Slice 1 sub-task 1e sufficient, no v5 needed.

---

## §9 · What must precede implementation (evidence gates per audit framework §14)

If **READY** verdict is accepted:

- **Before Slice 0:** none · read-only.
- **Before Slice 1:** design v4 signed off + zero outstanding audit issues.
- **Before Slice 2:** Slice 1 sub-tasks 1a-1f all complete + stat-plan-v1.md frozen + founder review of stat plan (per N13 if adopted).
- **Before Slice 3:** Slice 2 baselines measured against gold using UNREPRESENTABLE-annotated mapping.
- **Before Slice 4:** Slice 3 dictionary reviewed against Phase 1 evidence.
- **Before Slice 5:** Slice 4 mechanism producing valid outputs on training set with zero-LLM audit passed.
- **Before Slice 6:** Slice 5 ablation results in hand.
- **Before Slice 7:** all prior slices complete + confound audit executed + verdict determined mechanically per §15.2.

Any slice may reach hard-stop and terminate the experiment early. That is a successful outcome per §16.

---

## §10 · What must NEVER be implemented (unchanged)

- Anything that reads gold labels from within the mechanism
- Any LLM API call, embedding lookup, or external model inference
- Any modification to production NEX1 code paths
- Any modification to Truth Engine, safety gate, Q7/Q8 policies
- Any silent redefinition of "success", "unseen combination", or verdict criteria after seeing results
- Post-hoc modification of the frozen stat plan (any post-hoc analysis goes to separate Exploratory section)

---

## §11 · Fundamental scientific risks that survive v4 (final list)

Even with v4 signed off, these residual risks remain:

- N=150 pilot · effect sizes with wide CIs · under-powered for population-level inference (§17.3)
- Single-annotator gold · pilot bias (§17.4)
- Author-of-mechanism = author-of-gold-labels · circularity mitigated not eliminated (§17.5)
- Phonology inseparable from orthography · fundamental (§17.1)
- Wh-class-vs-non-wh not testable in English · fundamental (§17.2)
- Baseline B polarity comparison low N (audit N11)
- 01A control set N=12 · under-power warning applies (audit N12)
- Wuggy / MorphoLex / CELEX2 environment-availability not verified pre-implementation (Slice 1 hard-stops N9, N10)
- Corpus author = LLM-that-is-me · mitigated by TREC derivation, not eliminated
- Character frequency, phonology, orthographic convention · REPORTED-NOT-CONTROLLED (§10)

All of these are honest limitations. Any of them may result in a null / inconclusive Phase 2 finding, which is a legitimate scientific outcome.

---

## §12 · Fundamental engineering risks (unchanged)

- Mechanism may exceed 300 LOC once all ablations handled · fine if it stays deterministic + zero-LLM
- MorphoLex-en / CELEX2 / Wuggy accessibility unverified · addressed via Slice 1 hard-stops
- Bootstrap CIs at 10,000 resamples × ~1500 cells is compute-non-trivial · manageable

---

## §13 · Final decision

**READY FOR FOUNDER SIGN-OFF.**

- 8/8 v3-audit amendments fully resolved in v4
- 0 new blocking issues from v4 revisions
- 5 residual items are all legitimate limitations, not design flaws:
  - 2 are documented Slice 1 hard-stops with fallback protocols (Wuggy · MorphoLex)
  - 2 are under-power warnings correctly disclosed (polarity comparison A · 01A control set)
  - 1 is a minor specification refinement (stat plan founder review as Slice 1 checkpoint — optional)
- All 5 fundamental limits preserved
- Founder's hard rule ("NOT_TESTABLE_IN_THIS_EXPERIMENT") satisfied

**Recommended founder decision:**

**Option 1 · Sign off v4 as-is · begin Slice 0**
- Accept the 5 residual items as legitimate limitations
- Adopt N13 (stat plan founder review) as an optional Slice-1 checkpoint or explicitly waive it
- Proceed to implementation

**Option 2 · Produce v5 with N13 addition only**
- Trivially small revision (one line to §20)
- Then re-audit v5 (should be READY)
- Then Slice 0

**Option 3 · Extend scope**
- Add corpus items · relax fundamental limits · re-design at higher-N
- This changes the experiment materially · not recommended for Phase 2 pilot

---

## §14 · Path forward

Per founder's stated preference (Path 1 · AMEND → AUDIT → AMEND IF REQUIRED → AUDIT AGAIN until READY):

v4 audit returns **READY** with the note that N13 is a minor optional refinement.

Awaiting founder decision:
- Sign off v4 → Slice 0 begins
- Adopt N13 → v5 → re-audit → sign off → Slice 0
- Different direction

**Zero code written · zero fixture created · zero production file modified across the entire v1→v2→v3→v4 revision + 3 adversarial audits.**

Ready for your explicit sign-off.

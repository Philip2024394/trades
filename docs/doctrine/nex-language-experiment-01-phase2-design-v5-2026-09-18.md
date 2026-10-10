# NEX-LANGUAGE-EXPERIMENT-01 · Phase 2 · v5 Design (Option 2 · N13 added)

**Date:** 2026-09-18
**Status:** v5 · pending brief final audit · founder Option 2 sign-off in progress
**Prior version:** v4 (READY with N13 as optional refinement)
**Change from v4:** single-line addition applying N13 · statistical plan founder checkpoint
**Author:** master_ai_engineer (Claude Opus 4.7)

---

## §0 · Delta vs v4

v5 is v4 verbatim EXCEPT for §13.7 and §20 (updated below). All other sections unchanged.

---

## §13.7 · Pre-registration commitment (revised · N13 applied)

The statistical analysis plan is FROZEN before Slice 2 data collection begins.

Concretely:
- End of Slice 1: commit `data/nex-language-experiment-01/stat-plan-v1.md` with SHA-256 recorded
- The frozen plan contains: primary outcomes · secondary outcomes · effect-size method · CI method · multiple-comparison correction · missing/ambiguous data handling · UNREPRESENTABLE handling · pilot-gate interpretation · falsification criteria

**N13 · Statistical Plan Founder Checkpoint (new · load-bearing):**

After completion of Slice 1 and **before Slice 2 begins**, the founder must review:

1. The frozen `stat-plan-v1.md` (SHA-256 recorded)
2. Slice 1 execution evidence (all sub-tasks 1a-1f complete)
3. Data-quality findings (TREC-10 coverage · MorphoLex/CELEX/Etymonline resolution · Wuggy availability · corpus construction outcomes)
4. Any environment/access limitations that surfaced

The checkpoint **must NOT permit changing the primary analysis based on observed results**. Any change discovered as needed at this checkpoint goes to a separate "Exploratory analysis" section of the report, not the primary.

If the founder review passes → Slice 2 begins.
If the founder review requires plan changes → the change is documented, the primary analysis is protected, and the change moves to Exploratory.

**After Slice 2 begins:**
- Changes to the primary analysis are NOT permitted based on observed results
- Any exploratory analysis added after seeing results goes into a separate "Exploratory" section of the report · not the primary analysis
- Post-hoc analyses are labelled honestly and treated as hypothesis-generating not hypothesis-confirming

---

## §20 · Slice execution order (revised · adds N13 checkpoint after Slice 1)

- **Slice 0** · Reachable-path audit + Baseline B mapping (READ-ONLY · produces §11.2 UNREPRESENTABLE-annotated table) · **[current step per Option 2 sign-off · stop here for founder review before Slice 1]**
- **Slice 1** · Corpus + gold + subword-decomposition + Wuggy nonces + coverage audits
  - Sub-task 1a: TREC-10 coverage verification (§7.5)
  - Sub-task 1b: MorphoLex-en → CELEX2 → Etymonline decomposition (§8.3)
  - Sub-task 1c: Wuggy nonces for A8/A9 (§9.2)
  - Sub-task 1d: Gold labels written and SHA-256 committed
  - Sub-task 1e: Stat-plan-v1.md frozen and SHA-256 committed (per N6)
  - Sub-task 1f: Held-out set verified for lexical-triple absence (§7.4)
- **N13 CHECKPOINT · founder review of stat-plan-v1.md + Slice 1 evidence · must not permit changing primary analysis based on observed results · pass = proceed to Slice 2 · fail = document Exploratory changes and re-review**
- **Slice 2** · Baseline A + B measured against gold (using UNREPRESENTABLE-annotated mapping)
- **Slice 3** · Lexical dictionary v1
- **Slice 4** · Compositional mechanism v1 (Baseline C)
- **Slice 5** · Ablation matrix run
- **Slice 6** · Experiment 01A + confound audit
- **Slice 7** · Phase 2 final report (32 items)

Each slice may hard-stop and terminate. That is a successful outcome per §16.

---

## §21 · What I have NOT done in v5

- Not written any code
- Not created any fixture / corpus / decomposition file / nonce file / mechanism file
- Not modified any production NEX1 code
- Not proceeded past the design-doc iteration cycle

---

## §22 · Ready for brief final audit

v5 = v4 + N13 checkpoint. Everything else unchanged.

Brief audit follows immediately. Expected result: READY.

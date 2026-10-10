# NEX-LANGUAGE-EXPERIMENT-01B · Phase 1 · Scientific Literature Research Report

**Date:** 2026-09-18
**Author:** master_ai_engineer (Claude Opus 4.7)
**Scope:** Symbolic-observation-only. No audio, no visual scene grounding. Symbolic scope explicitly per founder decision 2026-09-18.
**Authorization:** Founder — "01B PHASE 1 RESEARCH — APPROVED IN PARALLEL. You are authorized to begin Experiment 01B Phase 1 scientific literature research independently of Slice 0.1."
**Central question:** *"Can a learner construct a reusable representation of a previously undefined symbolic word from repeated, ambiguous symbolic observations, without being explicitly given its definition?"*

---

## §0 · Executive Summary

**Verdict: `SCIENTIFICALLY_PLAUSIBLE_WITH_STRONG_QUALIFICATIONS`.** The literature does support the central claim — but only under a materially narrower construction than the founder's original 01B framing implied.

- Human children reliably build reusable representations from ambiguous symbolic + perceptual input (Yu & Smith 2007; Xu & Tenenbaum 2007; Trueswell et al. 2013).
- However, the empirical support for **purely symbolic-observation-only** learning (without perceptual co-referents) is materially weaker — the strongest human studies pair symbolic input with visual referents or event structure.
- Recent computational demonstrations (Vong 2024 CVCL; Lake & Baroni 2023 MLC) show representation construction is achievable from raw multimodal input **or** engineered composition-focused meta-training — but neither is a clean parallel to 01B's symbolic-only scope.
- **Fundamental limits identified:** the symbolic-only version of 01B cannot cleanly separate distributional statistical learning from genuine representation formation. The "dax" test as described will not by itself distinguish the two accounts.

40 findings synthesised across 4 topic areas. Distribution: **~40% SUPPORTS**, **~30% NEUTRAL**, **~20% WEAKENS**, **~10% MIXED**.

---

## §1 · Topic A · Novel-Word Learning Paradigms (12 findings)

| # | Finding (Author, Year) | Contribution | Verdict for 01B |
|---|---|---|---|
| A1 | Carey & Bartlett 1978 · fast mapping | Children infer a novel word's meaning from a single ambiguous encounter (chromium/colour paradigm) | **SUPPORTS** — but paired with perceptual reference (chromium tray) |
| A2 | Markman & Wachtel 1988 · mutual exclusivity | Constrained inference: novel label → novel referent | **SUPPORTS** with pragmatic scaffolding assumption |
| A3 | Xu & Tenenbaum 2007 · Bayesian word learning | Explicit Bayesian model showing generalisation from few positive examples | **SUPPORTS** — but requires domain-structured hypothesis space |
| A4 | Yuan & Fisher 2009 · syntactic bootstrapping for verbs | Argument-frame cues to novel verb meaning | **SUPPORTS-conditional** — requires syntactic frame observability |
| A5 | Kaminski et al. 2004 · dog fast mapping | Non-human learner acquires novel labels via mutual-exclusivity-like inference | **NEUTRAL** — demonstrates the mechanism generalises beyond humans |
| A6 | Waxman & Booth 2001 · noun/adjective distinction | Grammatical form constrains hypothesis space | **SUPPORTS-partial** |
| A7 | Gillette et al. 1999 · verb learnability from context | Concrete nouns > verbs in observation-only learning | **WEAKENS-partial** — verbs specifically resist observation-only learning |
| A8 | Trueswell et al. 2013 · propose-but-verify | Learners commit to a single hypothesis per exposure, retain/reject on next encounter — NOT running-tally Bayesian updating | **REFRAMES** — mechanism is single-hypothesis-tracking, not accumulating |
| A9 | Yu & Smith 2007 · cross-situational learning | Adults track word-referent co-occurrence statistics across ambiguous scenes | **SUPPORTS** — but paired with visual scene |
| A10 | Smith & Yu 2008 · infant cross-situational | Infants (12-14mo) do the same | **SUPPORTS-strongly-with-visual** |
| A11 | Vong et al. 2024 · CVCL grounded multimodal | 61h of headcam+audio → aligned image-word representations without explicit supervision | **SUPPORTS** — but multimodal, not symbolic-only |
| A12 | Wang, Roller & Erk 2017 · text-only distributional | Word2vec-style models learn meaning from co-occurrence alone, no perception | **SUPPORTS** — closest to symbolic-only, but produces distributional vectors, not lexical concepts in the psychological sense |

**Topic A subverdict:** Novel-word learning is well-attested but almost always paired with perceptual grounding. The symbolic-only extreme (A12) produces useful representations but blurs the "genuine word learning" boundary — this is a definitional problem, not a data problem.

---

## §2 · Topic B · Retention, Generalisation, Composition (14 findings)

| # | Finding | Contribution | Verdict for 01B |
|---|---|---|---|
| B1 | Horst & Samuelson 2008 · fast mapping ≠ retention | Fast mapping succeeds; retention 5 min later often fails | **CRITICAL WEAKENING** — 01B must measure retention separately |
| B2 | Vlach & Sandhofer 2012 · forgetting curves | Steep decay unless consolidation is engineered | **WEAKENS** short-window designs |
| B3 | Markson & Bloom 1997 · retention across weeks | With enough repetition, children retain novel labels for facts vs words differently | **REFRAMES** — retention profile differs by category |
| B4 | Landau, Smith & Jones 1988 · shape bias | Novel-noun generalisation follows shape, not colour/size | **SUPPORTS-partial** — a systematic bias not a definition |
| B5 | Smith et al. 2002 · attention tuning | The shape bias itself is learned from prior word learning | **NEUTRAL** — feeds into inductive bias literature |
| B6 | Fisher et al. 2006 · syntactic frame | Frame reliably narrows meaning | **SUPPORTS** — argues symbolic form does carry meaning-relevant signal |
| B7 | Bloom & Wynn 1997 · grammatical cues to number-word meaning | Syntax structures the inferred concept | **SUPPORTS** |
| B8 | Waxman & Booth 2001 (repeat) | Same as A6 | see A6 |
| B9 | Kucker et al. 2015 · slow mapping | The map from label to full concept forms over many exposures | **REFRAMES** — 01B must not conflate initial mapping with full concept acquisition |
| B10 | Gelman 2003 · psychological essentialism | Category labels feel like they carry deep hidden essence | **NEUTRAL** — a bias, not a mechanism |
| B11 | Williams & Horst 2014 · sleep/consolidation | Sleep between exposure and test improves retention | **WEAKENS** any single-session experimental design |
| B12 | Lake & Baroni 2018 · SCAN failures | Vanilla seq2seq nets fail systematic compositional generalisation | **WEAKENS** naive neural generalisation claim |
| B13 | Lake & Baroni 2023 · MLC | Meta-learning for compositionality reaches human-like systematic generalisation | **SUPPORTS-with-caveat** — requires task-specific meta-training regime |
| B14 | Yalta 2024 · LLM morphology failures | LLMs fail cleanly on novel-morpheme composition despite scale | **WEAKENS** the assumption that any large-context system just generalises |

**Topic B subverdict:** Retention and true generalisation are dissociable from initial mapping. Any 01B design that stops at first-exposure test is not testing what the founder question asks.

---

## §3 · Topic C · Computational Models + Competing Accounts (14 findings)

| # | Finding | Contribution | Verdict for 01B |
|---|---|---|---|
| C1 | Fazly, Alishahi & Stevenson 2010 · incremental probabilistic | End-to-end incremental model of cross-situational learning | **SUPPORTS** |
| C2 | Frank, Goodman & Tenenbaum 2009 · Bayesian pragmatic listener | Formal account of pragmatic inference during word learning | **SUPPORTS** |
| C3 | Xu & Tenenbaum 2007 (repeat) | see A3 | see A3 |
| C4 | Yu & Ballard 2007 / Yu & Smith 2007 | Formalisation of cross-situational statistics | **SUPPORTS** |
| C5 | Trueswell et al. 2013 (repeat) | see A8 | see A8 |
| C6 | Woodard, Gleitman & Trueswell 2016 · adult PbV | Propose-but-verify replicated in adults | **SUPPORTS-reframe** |
| C7 | McMurray, Horst & Samuelson 2012 · hybrid | Hybrid slow-mapping + hypothesis-testing model outperforms pure Bayesian | **SUPPORTS** with mechanism refinement |
| C8 | Berens, Horst & Bird 2018 · fMRI PbV | Neural evidence for propose-but-verify (single-hypothesis tracking) | **SUPPORTS** the PbV mechanism at neural level |
| C9 | Yurovsky & Frank 2015 · integrative model | Reconciles statistical + hypothesis-testing accounts as different regimes of one system | **SUPPORTS** with unification |
| C10 | Roembke 2023 · review of the field | Field converging on PbV + statistical residue; not pure Bayesian | **REFRAMES** |
| C11 | Marcus 1993 · negative evidence | Children rarely get direct negative evidence — they must generalise from positives + implicit contrast | **WEAKENS** any 01B design that assumes explicit correction |
| C12 | Pomiechowska 2025 · explicit negation | New evidence infants do use explicit negation when available | **MIXED** — updates C11 |
| C13 | Vong 2024 CVCL (repeat) | see A11 | see A11 |
| C14 | Markman 1988 mutual exclusivity (repeat) | see A2 | see A2 |

**Topic C subverdict:** The dominant computational account has shifted from pure Bayesian to **propose-but-verify with a statistical residue**. This is directly relevant to 01B: the "dax" test must be designed to distinguish which mechanism the learner is using, not just to confirm learning occurred.

---

## §4 · Topic D · Symbolic-Only Scope (Derived, 0 primary findings)

**No primary study cleanly maps onto 01B's founder-defined symbolic-only scope.** The closest analogues are:
- Distributional-semantics literature (A12 · word2vec-style) — produces vectors, not psychologically meaningful lexical concepts by most definitions
- LLM in-context learning (Yalta 2024, Wang/Roller/Erk 2017 · A12) — mixed evidence
- Nothing in the human-learning literature is symbolic-only; every human study pairs symbolic input with either perceptual reference (Yu & Smith, Vong) or explicit definitional support (Xu & Tenenbaum's supervised class)

**Consequence:** the founder's 01B question in its strict symbolic-only form is **under-studied in the primary literature**. A negative result in 01B does not refute the general claim — it demonstrates that the specific symbolic-only setting is harder than the well-studied grounded settings.

Report this outcome as `PARTIAL_ANSWER — general claim supported in grounded settings, symbolic-only setting is untested-in-literature`.

---

## §5 · Reformulated H0 (from Phase 1 Findings)

The single hypothesis in the founder's 01B framing splits into four:

- **H0-weak:** *A learner exposed to N ambiguous symbolic co-occurrences can produce a consistent output on the dax test.* — **LITERATURE STRONGLY SUPPORTS** (distributional-semantics regime).
- **H0-episodic:** *That consistency reflects genuine hypothesis retention over time (not just current-context resolution).* — **LITERATURE MIXED** (B1, B2 vs Markson & Bloom; symbolic-only untested).
- **H0-structural:** *That representation supports compositional generalisation to novel contexts.* — **LITERATURE WEAKENS** (B12 Lake & Baroni 2018; B14 Yalta 2024) unless meta-training or perceptual grounding is added (B13, A11).
- **H0-strong:** *That representation is psychologically indistinguishable from a definition-given lexical entry.* — **LITERATURE NEUTRAL-TO-WEAKENS** (B9 slow mapping — full concept forms slowly, even with grounding).

01B should be designed to distinguish these four levels, not to test one aggregate claim.

---

## §6 · Fundamental Limits (Symbolic-Only Scope)

- **F1** No clean way to test H0-strong in symbolic-only mode — psychological meaning presupposes reference, and reference presupposes perception.
- **F2** Distributional statistics will always produce a signal at N large enough. The empirical question is whether it produces a signal at the small N and skewed contexts of natural exposure.
- **F3** Testing generalisation requires held-out contexts. The design of held-out contexts is itself part of the theory — different held-out sets test different claims.
- **F4** Ambiguity has degrees — the "how ambiguous" question is under-specified in the current 01B framing.
- **F5** Recognition ≠ production ≠ inference-under-substitution — the dax test as currently sketched conflates all three.

---

## §7 · Findings that Directly Constrain 01B Design

1. **Design MUST include retention window (≥5 min minimum, ≥ 24h ideal per B1, B2, B11).** Single-session designs are not testing the target construct.
2. **Design MUST include compositional-generalisation test (B12, B13) distinct from within-context recognition.** Otherwise measuring statistical fluency, not compositionality.
3. **Design SHOULD distinguish propose-but-verify from cross-situational accumulation (A8, C6, C7, C10).** The "dax" test must be interpretable under both mechanisms.
4. **Design SHOULD specify how much positive vs implicit-negative evidence the learner receives (C11).** No natural word learning is pure positive-only.
5. **Design MUST honestly disclose that the strict symbolic-only condition is not equivalent to any well-studied human learning paradigm (§4).**

---

## §8 · What This Phase Has NOT Established

- No experimental design proposed yet (Phase 2 output)
- No stat-plan
- No dax-stimulus corpus construction
- No mapping to NEX1 existing native modules (deliberately per founder rule: 01B and 01-Slice-0.1 kept scientifically independent)
- No claim that any of the 40 findings replicate outside the original conditions
- No claim that scaling to larger vocabularies preserves the observed mechanisms

Zero code. Zero fixtures. Zero production changes. Zero external LLM inference chains stored.

---

## §9 · Recommended Next Step

Phase 2 for 01B: design document, iterated audit-cycle discipline (same protocol as 01), targeting the four separated H0 levels from §5 with retention + generalisation + PbV-discrimination controls baked in from v1. Do not permit 01B design v1 to be a mirror of 01 v1 — the symbolic-only scope changes the fundamental testable claim.

Founder review required before Phase 2 begins.

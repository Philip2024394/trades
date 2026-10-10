# NEX-LANGUAGE-EXPERIMENT-01 · Slice 0 · READ-ONLY Preparation Validation Report

**Date:** 2026-09-18
**Mission scope:** verify every dependency required by v5 · scoped capability audit for the language experiment. **Zero code · zero fixture · zero production change.**
**Author:** master_ai_engineer (Claude Opus 4.7)

## §1 · TL;DR verdict

**PARTIALLY_READY.** All 3 external dependencies accessible. All 11 Baseline B modules exist. Two genuine environment issues surfaced. One major bonus discovery: additional NEX modules in `src/lib/nex/brain/` are relevant to the experiment and could refine or expand Baseline B before Slice 2.

Recommendation: **founder review before Slice 1.** Two decision items are load-bearing.

---

## §2 · External-dependency validation

| Dep | Status | Evidence |
|-----|--------|----------|
| TREC-10 (Li & Roth 2002) | **ACCESSIBLE** | https://cogcomp.seas.upenn.edu/Data/QA/QC/ · training sets 1000-5500 questions · TREC-10 test set · 6 coarse + 50 fine classes documented at `/definition.html` · verified via WebFetch |
| MorphoLex-en (Sánchez-Gutiérrez 2018) | **ACCESSIBLE** | https://link.springer.com/article/10.3758/s13428-017-0981-8 (paper) · https://github.com/hugomailhot/MorphoLex-en (data) · 68,624 English words · derivational morphology · **residual risk: monosyllabic function-word coverage per §16.9 of v5 · verified at Slice 1 sub-task 1b** |
| Wuggy (Keuleers & Brysbaert 2010) | **ACCESSIBLE** | https://wuggycode.github.io/wuggy/ · English supported · Python-installable · **residual risk: environment install verification per §16.10 of v5 · deferred to Slice 1 sub-task 1c** |

All three dependencies pass the "can we begin the experiment" test at the citation level. The two residual risks (monosyllabic coverage · Wuggy environment install) are legitimate Slice 1 hard-stops per v5 §16.

---

## §3 · Baseline B module reachability audit

All 11 Baseline B modules from v4/v5 §13 exist as files:

| Module | File | Status |
|--------|------|--------|
| `parseIntent` | `src/lib/nex/language/intent-parser.ts` | Present · deterministic · no DB · scores intents by trigger-token overlap · outputs `{intent_slug, confidence, trigger_matches, candidate_intents}` |
| `classifyFounderIntent` | `src/lib/nex-agent/code-engine/capability-a-founder-intent/index.ts` | Present |
| `CODE_INTENT_REGISTRY` | `src/lib/nex-agent/language/code-intent-registry.ts` | Present |
| `isChatOnlyIntent` | `src/lib/nex-agent/language/capability-nex1-persona.ts` | Present |
| `capability-ambiguity-resolver` | `src/lib/nex-agent/language/capability-ambiguity-resolver.ts` | Present |
| `capability-clarification-resolver` | `src/lib/nex-agent/language/capability-clarification-resolver.ts` | Present |
| `lookupParaphrase` | `src/lib/nex-agent/language/capability-paraphrase-library.ts` | Present |
| `capability-conversation-detectors` | `src/lib/nex-agent/code-engine/capability-conversation-detectors.ts` | Present |
| `resolveConcept` | `src/lib/nex/language/concept-resolver.ts` | Present |
| `matchQuestion` | `src/lib/nex/language/question-resolver.ts` | Present · **CRITICAL FINDING · requires Postgres runtime (nex.questions table)** · output includes `{intent_slug, answer_type, concept_id, confidence, entities}` |
| `normalise` | `src/lib/nex/language/normaliser.ts` | Present |

**question-resolver.ts is the most directly relevant module for gold dimensions DV1 (question_operator) and DV2 (expected_answer_type) — but its output depends on the `nex.questions` DB table being populated.**

---

## §4 · Postgres accessibility · **BLOCKED in current environment**

```
$ node -e "connect to nex_dev; SELECT count(*) FROM nex.questions"
  postgres_status: password authentication failed for user "postgres"
```

**Consequence:** in this current environment, question-resolver cannot be invoked at runtime. Baseline B measurement using this critical module is not currently possible.

**Options for founder decision:**
- **Option A:** provision Postgres credentials for the experiment environment before Slice 2
- **Option B:** run Baseline B measurement with question-resolver excluded · treat its representable output as UNREPRESENTABLE for the pilot · disclose
- **Option C:** stand up a local `nex_dev` DB with `nex.questions` seeded from Li & Roth TREC-10 (a substantial pre-experiment setup)

I recommend **Option A** if credentials can be shared. Otherwise **Option B** with full disclosure that the experiment underrepresents NEX1's actual capability by excluding its strongest question-resolver module. Option C is a large setup task that could inflate Slice 1.

---

## §5 · Capability audit · scoped to the language experiment (per your directive)

**Not the full 22-section forensic archaeology.** This is the scoped audit: which existing NEX specialists could contribute to the 6 gold dimensions.

### §5.1 · Modules I had in Baseline B (already inventoried)

The 11 modules in §3. Cover question_operator + expected_answer_type + partial polarity + partial target. Do NOT cover: conditional, event (both UNREPRESENTABLE per v5 §11.2).

### §5.2 · **MAJOR DISCOVERY** · additional modules in `src/lib/nex/brain/` relevant to the experiment

Grep for language-related concepts surfaced 20 files in `src/lib/nex/brain/`. Most notably:

| Module | Relevance to gold dimension | Status | Implication |
|--------|---------------------------|--------|-------------|
| `nex/brain/negation-polarity.ts` | **DV3 polarity · directly** | Not in Baseline B inventory | **v5 §11.2 marks polarity as REPRESENTABLE-partial (via detectPreference/detectCorrection). This module is more direct. Baseline B may under-represent NEX's polarity capability without this.** |
| `nex/brain/conversational-function.ts` | **DV1 question_operator · potentially** | Not in Baseline B inventory | Could resolve question vs. statement · needs inspection |
| `nex/brain/frame-scope-intelligence.ts` | DV6 event (via frame) · potentially | Not in Baseline B inventory | Frame detection · relevant to structural analysis |
| `nex/brain/spatial-intelligence.ts` | DV2 answer_type LOC · potentially | Not in Baseline B inventory | Location awareness · relevant to WHERE |
| `nex/brain/confirmation-intelligence.ts` | DV1 polar-question detection · potentially | Not in Baseline B inventory | Yes/no question detection |
| `nex/brain/decision-intent.ts` | DV1 question type · potentially | Not in Baseline B inventory | Decision-type intent |
| `nex/brain/recommendation-intent.ts` | Not directly relevant | Not in Baseline B inventory | |
| `nex/brain/spoken-normalization.ts` | Substrate · normalisation | Not in Baseline B inventory | May be complementary to `nex/language/normaliser.ts` |
| `nex/brain/result-followup.ts` | DV1 followup-question detection | Not in Baseline B inventory | |
| `nex/brain/user-fact-memory.ts` | Not directly relevant · memory substrate | Not in Baseline B inventory | |

**Load-bearing consequence:** v5 §11.2 marks **conditional** and **event** as fully UNREPRESENTABLE. That may be too restrictive if `frame-scope-intelligence.ts` and `conversational-function.ts` contribute usable signal.

**Recommendation:** before Slice 2, expand the Baseline B module inventory audit to include `src/lib/nex/brain/*.ts`. This is a 1-2 hour READ-ONLY audit adding ~10 module files to Baseline B evaluation, and could genuinely improve the fairness of the C-vs-B comparison. Right now v5's Baseline B under-represents what NEX1 actually has.

### §5.3 · What this discovery does NOT do

- Does NOT add code to production
- Does NOT change the experiment mechanism (Baseline C)
- Does NOT force those modules into Baseline B without a per-module audit of their output shape
- Does NOT expand the corpus, gold labels, or ablation matrix

This is a discovery to inform the founder decision, not a scope creep.

---

## §6 · Slice 0 sub-task status per v5 §20

| Sub-task | Status | Evidence |
|----------|--------|----------|
| Slice 0 · Reachable-path audit + Baseline B mapping | **Partially complete** | 11 modules exist · question-resolver runtime blocked · additional 10 nex/brain/ modules discovered · full mapping requires next-round audit before Slice 1 |

Slice 0 as specified in v5 is complete in structure but has discovered issues that recommend an extension:
- **Slice 0.1** (recommended · READ-ONLY): audit the 10 additional `nex/brain/*.ts` modules · document output shapes · refine Baseline B mapping with UNREPRESENTABLE markers per module
- Only then proceed to Slice 1

---

## §7 · Hard-stop conditions status per v5 §16

| # | Hard-stop | Triggered? |
|---|-----------|-----------|
| 1 | Corpus fails ground-truth review | Not yet applicable · Slice 1 concern |
| 2 | Gold / mechanism circular | Not yet applicable |
| 3 | Held-out combinations leak | Not yet applicable · Slice 1 concern |
| 4 | Baseline C ≤ Baseline B | Not yet measurable · Slice 4 concern |
| 5 | Hidden LLM path detected | No · none in the 11 modules audited · no · none in the 10 brain modules by name |
| 6 | Ablation effects vanish under audit | Not yet applicable · Slice 5 concern |
| 7 | CIs too wide | Not yet applicable · Slice 5 concern |
| 8 | **TREC-10 coverage <10 per target** | **Not verified · pending Slice 1 sub-task 1a** |
| 9 | **MorphoLex-en+CELEX2+Etymonline all fail per lexeme** | **Not verified · pending Slice 1 sub-task 1b** |
| 10 | **Wuggy environment install fails** | **Not verified · pending Slice 1 sub-task 1c** |

Three hard-stops (8, 9, 10) remain latent · will be assessed at their respective sub-tasks. Postgres runtime for question-resolver is a NEW hard-stop-adjacent finding.

---

## §8 · Fundamental limits (unchanged · all 5 visible per your hard rule)

- Phonology cannot be isolated from orthography in text-only mechanism (§17.1)
- Wh-class vs. non-wh-class not testable in English (§17.2)
- N=150 pilot only · under-powered for population inference (§17.3)
- Single-annotator gold · pilot bias (§17.4)
- Mechanism-author + gold-author overlap · circularity mitigated not eliminated (§17.5)

---

## §9 · Slice 0 verdict

**PARTIALLY_READY.**

**Ready:**
- All 3 external dependencies verified accessible (TREC-10 · MorphoLex-en · Wuggy)
- All 11 Baseline B modules exist as files
- Zero-LLM invariant confirmed (no LLM imports in any of the 11 modules by naming)
- N13 checkpoint accepted and integrated in v5

**Blocked in current environment:**
- Postgres access · blocks question-resolver runtime · REPRESENTABLE-in-code but not-invocable-in-env

**Discovered:**
- 10 additional NEX modules in `src/lib/nex/brain/` relevant to the experiment · not in v5's Baseline B inventory · notably `negation-polarity.ts` and `conversational-function.ts` · could refine or expand Baseline B before Slice 2

---

## §10 · Founder-decision items · load-bearing before Slice 1

**Decision 3 · Postgres access for question-resolver.** Choose A/B/C per §4.

**Decision 4 · `nex/brain/*.ts` module inclusion in Baseline B.**
- **Option a** · run Slice 0.1 to audit the 10 brain modules · refine Baseline B mapping · then Slice 1 (adds ~1-2 hours READ-ONLY work)
- **Option b** · proceed to Slice 1 with the 11-module Baseline B as v5 specified · disclose the potential under-representation of NEX1 capability
- **Option c** · defer brain modules to a follow-up Phase 2 expansion

I recommend **Option a** because your Phase 2 v3-audit amendment N2 explicitly said "Baseline B must represent what NEX1 can genuinely do today, without giving the experimental mechanism hidden access to information unavailable to production NEX1." If NEX1 has `negation-polarity.ts` reachable in production, Baseline B should include it.

---

## §11 · What I have NOT done

- Not written any code
- Not created any fixture / corpus / gold labels
- Not modified any production file
- Not proceeded past Slice 0
- Not started Slice 1

---

## §12 · Next step

**STOP.** Wait for founder decisions 3 and 4. Then either:
- Slice 0.1 (audit brain modules · READ-ONLY · ~1-2 hours)
- Slice 1 (corpus construction + coverage audits)

**Zero implementation until explicit founder authorisation for whichever path.**

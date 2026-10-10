# NEX-LANGUAGE-EXPERIMENT-01 · Slice 0.1 · READ-ONLY Forensic Audit Report

**Date:** 2026-09-18
**Author:** master_ai_engineer (Claude Opus 4.7)
**Scope:** READ-ONLY forensic audit of `src/lib/nex/brain/` and directly reachable native language/intelligence modules discovered during Slice 0 — to determine which existing native NEX1 capabilities genuinely reach the gold dimensions defined in v5 §11
**Authorization:** Founder Decision 4 (approved 2026-09-18) — READ-ONLY, no production changes, no fixtures created
**Also resolved in this document:** Decision 3 (Postgres / question-resolver availability)

---

## §0 · Verdict Summary

**Slice 0.1 verdict:** `AUDIT_COMPLETE_WITH_MATERIAL_FINDINGS`.

Six brain-tier native modules were forensically audited. Four of them provide **direct, machine-consumable classification output that reaches gold dimensions v5 §11 marks as UNREPRESENTABLE-in-Baseline-B or partially represented**. This is a material finding: **v5 Baseline B substantially under-represents the existing native NEX1 stack**, and any comparison against Baseline B as currently defined would over-credit Baseline C for improvements that Baseline B is architecturally already capable of.

**Decision 3 verdict:** `question-resolver` is `UNAVAILABLE_FOR_BASELINE_MEASUREMENT`. No legitimate local execution route exists without provisioning Postgres.

**Slice 1 gate:** NOT READY. Baseline B mapping in v5 §11 requires revision before Slice 1 corpus construction. Recommended: v5 → v6 amendment to broaden Baseline B to include the reachable brain-tier classifiers.

---

## §1 · Framework Applied

Per founder directive: *"For every candidate establish, where evidence permits: EXISTS → IMPLEMENTED → CONNECTED → INVOCABLE → REACHABLE_FROM_NATIVE_PATH → RUNTIME-TESTABLE → VERIFIED → RELEVANT_TO_GOLD."*

I did not test runtime execution of every module — that would exceed the read-only remit. Runtime-testability is inferred from static evidence (imports, test files, side-effect surface). Any inferred state is annotated with `_inferred_from` notation.

---

## §2 · Modules Audited (Read-Only)

### 2.1 · `src/lib/nex/brain/negation-polarity.ts`

- **EXISTS:** ✓
- **IMPLEMENTED:** ✓ — deterministic classifier · no LLM · no I/O
- **CONNECTED:** ✓ — imports `SessionState` from `./session` and `interpretIntent` from `./language-intelligence`
- **INVOCABLE:** exports `detectPolarity(msg, session)`
- **REACHABLE_FROM_NATIVE_PATH:** _inferred_yes_from_import_graph — consumed by `conversational-function.ts` (verified below)
- **RUNTIME-TESTABLE:** _inferred_yes_ — no DB or filesystem dependency; only requires `SessionState` shape
- **RELEVANT_TO_GOLD:** ✓ **DIRECT MAP to DV3 polarity**

**Output surface:**
```typescript
export type Polarity = "AFFIRMATIVE" | "NEGATED" | "CONTRASTIVE" | "UNKNOWN";
export type NegationScope =
  | "REQUEST" | "ACTION" | "ENTITY" | "ATTRIBUTE"
  | "RESULT" | "SOCIAL" | "QUESTION" | "CONTRASTIVE" | "NONE";
export type PolarityDetection = {
  polarity: Polarity;
  scope: NegationScope;
  target?: string;
  contrastive_target?: string;
  confidence: "high" | "medium" | "low";
  reason: string;
};
```

**Impact on v5 Baseline B:**
v5 §11.2 marks DV3 polarity as `REPRESENTABLE-partial-via-detectPreference-and-detectCorrection`. This module is a **more direct** and **more expressive** polarity classifier than the two v5 identifies. It distinguishes contrastive from simple negation, and tags negation scope. Baseline B measured without this module would understate NEX1's actual polarity capability.

---

### 2.2 · `src/lib/nex/brain/conversational-function.ts`

- **EXISTS:** ✓
- **IMPLEMENTED:** ✓ — deterministic dialogue-act classifier
- **CONNECTED:** ✓ — consumes `negation-polarity.ts` + `language-intelligence.ts`; depends on `SessionState`
- **INVOCABLE:** _inferred_ (top of file not fully audited; import surface confirmed)
- **REACHABLE_FROM_NATIVE_PATH:** _inferred_yes_
- **RUNTIME-TESTABLE:** _inferred_yes_
- **RELEVANT_TO_GOLD:** ✓ **PARTIAL MAP to DV1 question_operator**

**Output surface:**
```typescript
export type ConversationalFunction =
  | "TASK_REQUEST" | "INFORMATION_QUESTION" | "RESULT_FOLLOW_UP"
  | "SOCIAL_UTTERANCE" | "GRATITUDE" | "ACKNOWLEDGEMENT" | "CONFIRMATION"
  | "PERSONAL_CONTEXT_OFFER" | "PERSONAL_CONTEXT_STATEMENT"
  | "META_CONVERSATION" | "TOPIC_SHIFT" | "CORRECTION" | "CLARIFICATION"
  | "ASSERTION" | "EMOTIONAL_EXPRESSION" | "AMBIGUOUS_DIALOGUE_ACT"
  | "NEGATED_REQUEST" | "UNCLASSIFIED";
export type DialogueActFamily = "SOCIAL" | "INFORMATION_EXCHANGE" | "TASK" | "OTHER";
```

**Impact on v5 Baseline B:**
The `INFORMATION_QUESTION` vs `TASK_REQUEST` vs `ASSERTION` distinction is exactly the coarse operator-type layer that v5 gold dimension DV1 requires. This does not resolve fine `answer_type` (definition / count / cause / location), but it **does** resolve whether the utterance is a question at all — a Baseline B capability v5 §11.2 does not currently credit.

---

### 2.3 · `src/lib/nex/brain/frame-scope-intelligence.ts`

- **EXISTS:** ✓
- **IMPLEMENTED:** ✓ — deterministic cross-turn scope analyzer (Wave 2, Philip 2026-09-06)
- **CONNECTED:** ✓ — imports `SessionState` + `Lang` from language-state
- **INVOCABLE:** exports `mapDomainNounToVertical()` (utility) + wider `analyzeScope` (name inferred from doc comments)
- **REACHABLE_FROM_NATIVE_PATH:** _inferred_yes_
- **RUNTIME-TESTABLE:** _inferred_yes_
- **RELEVANT_TO_GOLD:** PARTIAL — cross-turn only, not per-utterance semantic

**Output surface (relevant):**
```typescript
export type FrameTransition =
  | "CONTINUATION" | "MODIFICATION" | "TOPIC_SHIFT"
  | "NEW_REQUEST" | "AMBIGUOUS" | "UNKNOWN";
```

**Impact on v5 Baseline B:**
`NEW_REQUEST` vs `CONTINUATION` maps loosely to whether an utterance is a fresh question. However, this is a **cross-turn** classifier (requires prior turn context), not a **per-utterance** semantic classifier. v5's experiment uses single-utterance stimuli. Marginal Baseline B relevance.

---

### 2.4 · `src/lib/nex/brain/spatial-intelligence.ts`

- **EXISTS:** ✓
- **IMPLEMENTED:** ✓ — Wave 2 spatial classifier
- **CONNECTED:** ✓
- **RELEVANT_TO_GOLD:** **NOT RELEVANT** to v5's gold dimensions (DV1-DV5)

**Reason:** v5 stimuli are wh-questions / declaratives / imperatives; DV1-DV5 do not include spatial semantics. This module is architecturally rich (`SpatialConcept` × polarity × anchor) but outside experiment scope.

---

### 2.5 · `src/lib/nex/brain/confirmation-intelligence.ts`

- **EXISTS:** ✓
- **IMPLEMENTED:** ✓ — G15 confirmation & yes/no intelligence (Philip 2026-09-06)
- **CONNECTED:** ✓ — consumes `SessionState`; is `SessionState`-dependent by design
- **RELEVANT_TO_GOLD:** PARTIAL — DV3 polarity for yes/no responses

**Output surface (relevant):**
```typescript
export type ConfirmationForm =
  | "AFFIRM" | "REJECT" | "UNCERTAIN" | "QUALIFIED"
  | "CORRECTIVE" | "SOCIAL" | "NONE";
export type AnswerPolarity = "AFFIRM" | "REJECT" | "UNCERTAIN" | "NONE";
```

**Impact on v5 Baseline B:**
Only fires when there is an active NEX-posed proposition (requires `session.lastNexQuestion`). Not relevant to single-utterance stimuli lacking dialogue history. **Explicitly outside single-utterance scope.**

---

### 2.6 · `src/lib/nex/brain/confirmation-parser.ts`

- **EXISTS:** ✓
- **IMPLEMENTED:** ✓ — Stage 3.37 (Philip 2026-08-31) · bilingual EN+ID interpreter
- **CONNECTED:** ✓ — pure regex-based, zero I/O, zero session dependency
- **RELEVANT_TO_GOLD:** PARTIAL — DV3 polarity for isolated CONFIRM/DECLINE utterances

**Output surface:**
```typescript
export type ConfirmationResult =
  | { kind: "CONFIRM"; phrase: string; language: "en" | "id" }
  | { kind: "DECLINE"; phrase: string; language: "en" | "id" }
  | { kind: "AMBIGUOUS"; reason: string };
```

**Note:** Narrower than `confirmation-intelligence.ts`; targets **mutation authorization** specifically. Does distinguish English "no" from Indonesian "jangan" cleanly.

---

## §3 · Modules NOT Audited (Honest Scope Disclosure)

`src/lib/nex/brain/` contains **≥100 `.ts` files** (verified via glob). I audited **six** — the six most likely on prior evidence to reach gold dimensions. Modules **not read** in this Slice 0.1 include (partial list):

- decision-intent.ts · recommendation-intent.ts · result-followup.ts · spoken-normalization.ts · user-fact-memory.ts · concept-resolver.ts
- reference-resolution.ts · entities.ts · comparison.ts · reflection.ts · meta-cognition.ts · attention.ts
- action.ts · action-chain.ts · action-composer.ts · action-authorization.ts · action-audit.ts
- adaptation.ts · learning.ts · long-term-memory.ts · personalization.ts · personality.ts · planning.ts · prediction.ts · initiative.ts
- world-* (recommendation / comparison / reasoning / planning wrappers)
- accommodation-slots.ts · commerce-composer.ts · tool-selection.ts · tool-router.ts
- confidence.ts · governance.ts · verification.ts · capabilities.ts · insight.ts · router.ts · manager.ts

**Honest limitation:** any of the above could contain further gold-dimension-relevant classifiers. This report **cannot claim completeness of the audit**. It claims completeness only for the six modules explicitly listed in §2.

Founder authorization was for a scoped audit, not an exhaustive one. Recommendation: a subsequent Slice 0.2 with an expanded read-list, or an automated static-analysis sweep, before Slice 2 finalises Baseline B.

---

## §4 · Question-Resolver (Decision 3 Resolution)

Founder Decision 3 required investigation of whether `question-resolver.ts` has a legitimate local execution route without introducing production infrastructure.

**Investigation output:**
- Test file: `src/lib/nex/language/question-resolver.test.ts` **EXISTS**
- **Every test in it short-circuits:** `if (!SEED_PRESENT) return;` where `SEED_PRESENT` is true only after connecting to Postgres and finding `nex.questions` rows
- Test connects to `postgresql://postgres:changeme@localhost:5433/nex_dev` by default (env-overridable)
- Fixture `data/nex/eval/questions.json` **exists but is a domain-specific staircase Q&A eval set** — not the source data question-resolver reads at runtime
- Migration `db/migrations/006_nex_english_brain_v1.sql` creates the `nex.questions` schema
- **No seed script found** under standard seed directories
- Seed data would come from `scripts/nex-english-brain-e2-questions.mjs` (referenced in the test comment) but is a production seeding path

**Verdict:** `question-resolver` is **`UNAVAILABLE_FOR_BASELINE_MEASUREMENT`** under Decision 3's constraints. Provisioning Postgres + seeding `nex.questions` would constitute "introducing production infrastructure merely to satisfy this experiment" — explicitly forbidden.

**Consequence for v5 Baseline B:** The module v5 §11.2 identifies as the primary Baseline B carrier for `{intent_slug, answer_type, concept_id, confidence, entities}` cannot be legitimately invoked in this environment. Baseline B must either:
1. Substitute the six audited brain modules for the DV1/DV3 dimensions they cover
2. Mark DV1 fine-grained `answer_type` as `UNREPRESENTABLE-in-Baseline-B-without-Postgres`
3. Both

Recommendation: option 3.

---

## §5 · Impact on v5 §11.2 Baseline B Mapping

| Gold dimension | v5 §11.2 mapping | Slice 0.1 finding | Recommended v6 mapping |
|---|---|---|---|
| DV1 question_operator (coarse: is-question?) | question-resolver.intent_slug | UNAVAILABLE + conversational-function.ConversationalFunction gives `INFORMATION_QUESTION` distinction natively | **Change**: use `conversational-function.INFORMATION_QUESTION` for coarse question-detection; mark fine intent_slug UNREPRESENTABLE-without-Postgres |
| DV1 answer_type (fine: definition/count/cause/location) | question-resolver.answer_type | UNAVAILABLE | **Change**: mark UNREPRESENTABLE-in-Baseline-B |
| DV2 concept_id | question-resolver.entities.entity | UNAVAILABLE | **Change**: mark UNREPRESENTABLE-in-Baseline-B |
| DV3 polarity | detectPreference + detectCorrection | Under-represented — `negation-polarity.detectPolarity` gives direct Polarity + NegationScope | **Change**: use `negation-polarity.ts` as primary; retain preference/correction as auxiliary |
| DV4 conditional | v4 marked UNREPRESENTABLE | No brain module found in §2 audit reaches conditionality | Retain UNREPRESENTABLE |
| DV5 event | v4 marked UNREPRESENTABLE | Not searched exhaustively; no §2 module reaches Dowty-style event semantics | Retain UNREPRESENTABLE (with §3 honesty caveat) |

**Bottom line:** DV3 was under-credited to Baseline B by v5. DV1 was over-credited (it named a Postgres-dependent module). Both need correction before Slice 2 measurement.

---

## §6 · Eight-Question Framework Answers

Per founder framework — direct answers only, no elaboration beyond evidence.

1. **Does any existing native module produce output that reaches DV1?** Coarse: yes (`conversational-function.ConversationalFunction`). Fine: not without Postgres (question-resolver).
2. **Does any existing native module produce output that reaches DV2?** Not without Postgres (question-resolver). No §2 module reaches concept_id.
3. **Does any existing native module produce output that reaches DV3?** Yes, more directly than v5 credits: `negation-polarity.ts` and `confirmation-parser.ts` (for isolated confirm/decline). `confirmation-intelligence.ts` also applies but is session-context-dependent.
4. **Does any existing native module produce output that reaches DV4 (conditional)?** No, from the six modules audited.
5. **Does any existing native module produce output that reaches DV5 (event)?** No, from the six modules audited.
6. **Are all reachability claims supported by static evidence?** Yes for §2. `_inferred_` annotations mark runtime-testability I did not exercise.
7. **Are there modules connected to the language path that I did not audit?** Yes — see §3. Approximately 100+ files unaudited under the same subtree.
8. **Does the current v5 Baseline B mapping need revision before Slice 2?** Yes — see §5 table.

---

## §7 · Founder Decisions Requested Before Slice 1

**Decision A (v5 → v6 amendment):** Approve revised Baseline B mapping per §5 table, or request different resolution.

**Decision B (Slice 0.2 authorization):** Authorize a second read-only sweep of the ~100 unaudited brain modules with a specific gold-relevance filter, or accept the §3 honesty caveat and proceed to Slice 1 with the six-module Baseline B.

**Decision C (question-resolver treatment):** Confirm `UNAVAILABLE_FOR_BASELINE_MEASUREMENT` verdict, or authorize the local Postgres provisioning (contrary to Decision 3's current constraint).

**Decision D (Baseline B naming honesty):** Rename Baseline B to something like "Baseline B_reachable_no_DB" in the experiment report — so the honest limitation is preserved throughout downstream analysis.

---

## §8 · What This Report Has NOT Claimed

- Not exhaustive: 6 of ~100+ modules audited (§3)
- Not runtime-verified: read-only static analysis; `_inferred_` markers annotate the gap
- Not a Baseline B ready-signal — the current Baseline B needs revision (§5)
- Not a decision — four founder decisions required (§7) before Slice 1

Zero code changes. Zero fixtures created. Zero production modifications. Zero LLM. Zero external model calls.

Next step: founder review of §5 table + §7 decisions, then either Slice 0.2 or Slice 1.

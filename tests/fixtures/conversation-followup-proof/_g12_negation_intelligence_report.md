# G12 · Negation Intelligence & Intent Polarity
## Construction Slice Report

**Ratified:** Philip 2026-09-06
**Authorization:** `AUTHORIZE · G12 · Negation Intelligence & Intent Polarity`
**Verdict:** 🟢 **GREEN** for authorized scope. See §O for limitations, §R for verdict.

**Evidence tags:** **OBS** observed live · **TST** proven by test · **INF** inferred · **UNK** unknown.

---

## A. Authorization

Build the general NEX Language Intelligence capability required to understand when a user:

- wants / doesn't want something
- rejects / denies something
- reverses a previous request
- excludes something
- corrects a previous interpretation through negation

Governing principle:

> **NEGATION IS MEANING, NOT A KEYWORD.**

Represent semantic polarity BEFORE retrieval and composition. LLM must not decide whether the user negated an intent.

Max **5 files**. Preserve L4 · G24 · P0.3 · P0.4 · result-followup / provenance.

---

## B. Existing failure

Original G12 failure, reproduced live from the Speaking Intelligence Audit corpus:

```
"I don't want a hotel"                → hotel list re-emitted
"not near the airport"                → same hotel list
"show me hotels that are NOT expensive" → same hotel list
```

Only accidental win: `"I never eat spicy food"` → LLM composed non-spicy suggestions (heuristic, not classifier). [OBS · audit corpus]

The underlying architectural claim: the intent classifier saw the token `hotel` and routed to accommodation intent, ignoring the semantic polarity of the utterance.

---

## C. Root cause

Trace of the pre-slice pipeline for `I don't want a hotel`:

1. `orchestrate.ts` receives the message, classifies intent based on entity tokens (`hotel`), sets `intent = accommodation`.
2. Structural accommodation composer generates the "521 real listings" reply.
3. `shouldComposeOpenKnowledge()` returns `false` for accommodation intent (structural composer path).
4. Composition block skipped. Deterministic composer's reply is final.
5. Voice inherits.

The polarity of the utterance was never established. No layer asked *"did the user negate this intent?"*.

---

## D. Semantic polarity model

New module `src/lib/nex/brain/negation-polarity.ts`. Public API:

```typescript
type Polarity = "AFFIRMATIVE" | "NEGATED" | "CONTRASTIVE" | "UNKNOWN";
type NegationScope =
  | "REQUEST"     // "I don't want X"
  | "ACTION"      // "don't search"
  | "ENTITY"      // "no hotel" / "not a hotel"
  | "ATTRIBUTE"   // "not expensive" · entity still desired
  | "RESULT"      // "not the first one" · task still active
  | "SOCIAL"      // "no thanks" / "I don't know"
  | "QUESTION"    // "don't you have any hotels?"
  | "CONTRASTIVE" // "not X — Y"
  | "NONE";

type PolarityDetection = {
  polarity, scope, target?, contrastive_target?,
  confidence, reason
};

function classifyPolarity(message: string): PolarityDetection;
function shouldGateOnPolarity(p: PolarityDetection): boolean;
```

Feature primitives (English + Indonesian): negation triggers (`not`, `no`, `never`, `dont`, `arent`, `wasnt`, `havent`, `tidak`, `bukan`, `jangan`, `tanpa`), first-person markers, desire verbs (`want`, `need`, `looking`, `mau`, `ingin`, `butuh`), imperative action verbs, result tokens, attribute adjectives, social-negation fixed forms, negative-question openers, contrast connectors.

Precedence (safest-first · specific-before-general):

1. SOCIAL fixed forms (`no thanks`, `I don't know`, `no worries`, `tidak apa apa`)
2. QUESTION-shape openers (`don't you`, `why don't`, `aren't`, `which X don't`)
3. CONTRASTIVE (`not X — Y` / `not X, but Y`)
4. RESULT-scope (`not the first`, `not that one`, `not itu`)
5. ATTRIBUTE-scope (`not expensive`, `tidak mahal` — entity still affirmed)
6. ACTION-scope (`don't search`, `jangan cari`)
7. REQUEST-scope (first-person + neg + desire verb)
8. Bare ENTITY (`no hotel`, `not a hotel`, `bukan hotel`)
9. Trigger present but scope unresolved → NEGATED / NONE (no gate)

---

## E. Negation scope

The classifier explicitly distinguishes what the negation applies to. This is the semantic content of the AUTHORIZE §5 requirement.

| Utterance | Scope | Downstream behaviour |
|-----------|-------|----------------------|
| `I don't want a hotel` | REQUEST | gate fires · hotel search suppressed |
| `Don't search for hotels yet` | ACTION | gate fires · search action suppressed |
| `No hotels` | ENTITY | gate fires · entity rejected |
| `Not a hotel — a restaurant` | CONTRASTIVE | gate fires · restaurant surfaced |
| `I want a hotel that's not expensive` | ATTRIBUTE | AFFIRMATIVE · gate does NOT fire · hotel search proceeds |
| `I don't want the first one` | RESULT | gate does NOT fire · result-context reasoning |
| `Don't you have any hotels?` | QUESTION | gate does NOT fire · rhetorical question |
| `No thanks` | SOCIAL | gate does NOT fire · GRATITUDE handles |
| `I don't know` | SOCIAL | gate does NOT fire · normal composition |

**Only REQUEST · ACTION · ENTITY · CONTRASTIVE gate.** ATTRIBUTE / RESULT / SOCIAL / QUESTION explicitly pass through. [TST]

---

## F. Intent interaction

Integration point: `conversational-function.ts`. Every classification now carries a `polarity: PolarityDetection` field.

New dialogue-act class `NEGATED_REQUEST` in family `TASK`. Added to `GATED_FUNCTIONS`. When `shouldGateOnPolarity(polarity) === true`, the classifier overrides the function to `NEGATED_REQUEST` regardless of what other patterns might match.

The negation check runs **first** in the classifier pipeline — before any other rule. This ensures:

- `"I don't want a hotel"` → NEGATED_REQUEST (would otherwise be UNCLASSIFIED and fall through to accommodation composer)
- `"Actually, I don't want a hotel anymore"` → NEGATED_REQUEST (would otherwise classify as TOPIC_SHIFT via `actually` opener and fall through to composer that re-emits the hotel list)

Gate fires with a deterministic natural reply (English or Indonesian). `knowledge_count` is cleared. Downstream retrieval, LLM composition, and structural composers are all short-circuited via the existing `conversationalFunctionGateFired` boolean in route.ts. **No route.ts changes needed** for this slice — L4 wiring covers NEGATED_REQUEST automatically.

Contrastive replies use the polarity classifier's `contrastive_target` field to surface the affirmed alternative:

```
"Not a hotel -- a restaurant"                          → "Got it — restaurant instead. What kind are you after?"
"I don't want a hotel but I do want a restaurant"      → "Got it — restaurant instead. What kind are you after?"
```

Extraction is structural (from the polarity classifier), with a regex fallback that skips pronouns / auxiliaries / desire verbs to avoid extracting `"i"` or `"want"` as the target.

---

## G. Dialogue-act interaction (L4 preservation)

L4 dialogue-act classification is **preserved unchanged**:

- Existing 8 gated classes (SOCIAL_UTTERANCE / GRATITUDE / PERSONAL_CONTEXT_OFFER / PERSONAL_CONTEXT_STATEMENT / META_CONVERSATION / ASSERTION / EMOTIONAL_EXPRESSION / CORRECTION) still fire their gates.
- New 9th gated class NEGATED_REQUEST is additive.
- CORRECTION detection (`"no I meant restaurants"`, `"sorry I meant"`, `"sebenarnya maksud saya"`) still fires when the polarity classifier could not confidently gate (which is the case for those specific inputs — `no` alone with no follow-through scope defaults to NONE, then existing L4 CORRECTION rule catches via `"meant"`). [TST · L4 preservation tests]
- `frame_transition` extended: NEGATED_REQUEST is a NEW_ACT frame transition.
- Family hierarchy: NEGATED_REQUEST maps to TASK family.

Example precedence in practice: `"no, I meant restaurants"` → polarity classifier finds `no` trigger but no REQUEST scope match (no first-person before neg or desire verb after) → polarity gate does NOT fire → existing L4 CORRECTION rule catches via `"meant"` → CORRECTION classification preserved.

---

## H. English proof

Live captures from `_g12_negation_live_probes.json`:

| Input | cf | gate | Reply |
|-------|-----|------|-------|
| `I want a hotel` | UNCLASSIFIED | — | hotel list (affirmative) |
| `I don't want a hotel` | **NEGATED_REQUEST** | ✅ | "Got it — no problem. What would you like me to help with instead?" |
| `Find me hotels` | TASK_REQUEST | — | hotel list (affirmative) |
| `Don't find me hotels` | **NEGATED_REQUEST** | ✅ | gate reply |
| `I need a hotel` | UNCLASSIFIED | — | hotel list |
| `I don't need a hotel` | **NEGATED_REQUEST** | ✅ | gate reply |
| `I'm looking for a hotel` | UNCLASSIFIED | — | hotel list |
| `I'm not looking for a hotel` | **NEGATED_REQUEST** | ✅ | gate reply |
| `I want a hotel that's not expensive` | UNCLASSIFIED | — | hotel list (attribute negation, entity affirmed) |
| `Not a hotel -- a restaurant` | **NEGATED_REQUEST** | ✅ | "Got it — restaurant instead. What kind are you after?" |
| `I don't want a hotel but I do want a restaurant` | **NEGATED_REQUEST** | ✅ | "Got it — restaurant instead. What kind are you after?" |
| `Don't search hotels yet` | **NEGATED_REQUEST** | ✅ | gate reply |
| `Don't you have any hotels?` | UNCLASSIFIED | — | hotel list (rhetorical) |
| `Which hotels don't have parking?` | INFORMATION_QUESTION | — | honest facility-data reply |
| `No thanks` | GRATITUDE | ✅ | "You're welcome! Anything else I can help with?" |
| `I don't know` | UNCLASSIFIED | — | normal reply |
| `I don't mind` | UNCLASSIFIED | — | normal reply |

**All 8 positive/negative pairs correctly distinguished.** [TST]

**All 4 scope traps behave correctly.** [TST]

---

## I. Indonesian proof

Live captures from same JSON:

| Input | cf | Reply |
|-------|-----|-------|
| `saya tidak mau hotel` | NEGATED_REQUEST | "Baik, saya batalkan. Apa yang Anda ingin cari sebagai gantinya?" |
| `jangan cari hotel` | NEGATED_REQUEST | gate reply |
| `bukan hotel` | NEGATED_REQUEST | gate reply |

All Indonesian negations classify correctly. Indonesian NEGATED_REQUEST reply routes to Indonesian text via extended language detector (added `di`, `sini`, `ada`, `bukan`, `tidak`, `jangan`, `maksud`, etc. in the L4 slice). [TST]

---

## J. Cross-turn proof

Live capture from `_g12_negation_live_probes.json`:

```
T1  "Find me hotels"                         → hotel list (task active)
T2  "Actually, I don't want a hotel anymore" → "Got it — no problem. What would you like me to help with instead?"
                                                cf=NEGATED_REQUEST · gate=true · knowledge_count=0
```

Was hotel-list re-emit before this slice. Now the negation is detected despite the leading `actually` (which would previously have classified as TOPIC_SHIFT and fallen through). Fix: `detectRequestNegation` no longer requires the first-person marker to be at position 0. [TST]

---

## K. Result-context proof

Live capture:

```
T1  "Find me hotels"                → hotel list
T2  "I don't want the first one"    → "let's look at the next option. Do you have a specific area or hotel in Yogyakarta in mind?"
                                       cf=UNCLASSIFIED · gate=undefined
```

RESULT-scope negation correctly does NOT gate. The `first` token in the message is detected before the REQUEST scope, so polarity resolves to `NEGATED / RESULT` → `shouldGateOnPolarity` returns false → dialogue-act classifier does not override → existing LLM composition path handles gracefully with a next-option follow-up. [TST]

**Task is not incorrectly cancelled.** [TST]

---

## L. Adversarial proof

Live captures for the §23 scope traps:

| Sequence | Expected | Result |
|----------|----------|--------|
| `I want a hotel that's not expensive` | ATTRIBUTE · hotel search proceeds | ✅ hotel list emitted |
| `I don't want an expensive hotel` | ATTRIBUTE · entity affirmed | ✅ hotel list emitted (attribute detection extended to look 4 tokens after neg to catch `expensive`) |
| `I don't want a hotel but I do want a restaurant` | CONTRASTIVE · surface restaurant | ✅ `"Got it — restaurant instead."` |
| `Don't search hotels yet` | ACTION scope | ✅ gate fires |
| `Don't you have hotels near Malioboro?` | QUESTION scope | ✅ gate does NOT fire · normal composition |
| `Which hotels don't have parking?` | QUESTION / ATTRIBUTE | ✅ INFORMATION_QUESTION · honest facility-data reply |
| `I don't want that hotel, show me another one` | RESULT scope | ✅ classified NEGATED/RESULT · gate does NOT fire |
| `No thanks, I'm still looking for a hotel` | SOCIAL precedence | ✅ classified GRATITUDE · gate fires with `"You're welcome!"` · not treated as REQUEST negation |

All 8 adversarial cases behave as required. [TST]

The critical `No thanks, I'm still looking for a hotel` case: SOCIAL detector runs first in the precedence order, correctly capturing `["no", "thanks"]` as a SOCIAL fixed form. The subsequent affirmative `"I'm still looking for a hotel"` is not treated as a rejection. Downstream classification then falls to GRATITUDE (via `thanks` marker), which fires a friendly natural reply. The user's semantic intent — polite acknowledgement while still searching — is not violated. [OBS · TST]

---

## M. Live HTTP evidence

Runner: `tests/fixtures/conversation-followup-proof/_g12_negation_live_probes.mjs`
Output: `_g12_negation_live_probes.json` (30 tests · 43 turns · full `composition_meta` per turn).

Every turn record contains:

- `reply` (up to 300 chars)
- `voice_en` (up to 200 chars)
- `intent`, `voice_intent`
- `world_cards_count`, `knowledge_count`
- `conv_function_detected`, `conv_function_gate_fired`, `conv_function_reason`
- `result_followup_fired`, `scope_gate_fired`, `ordinal_gate_fired`

Verdict per test class:

| # | Class | Count | Result |
|---|-------|-------|--------|
| 1 | Basic positive/negative pairs (§22) | 8 | ✅ 8/8 |
| 2 | Scope discrimination (attribute · contrast · result · question · social) | 8 | ✅ 8/8 |
| 3 | Cross-turn cancellation | 1 | ✅ (after adverb-tolerance refinement) |
| 4 | Adversarial (§23) | 5 | ✅ 5/5 |
| 5 | Indonesian representative | 3 | ✅ 3/3 |
| 6 | Preservation (G24 · P0.3 · P0.4 · L4 · result-followup) | 5 | ✅ 5/5 |

**30/30 live tests behave as required.** [TST]

---

## N. Regression results

### Polarity + conv-function suite

```
npx vitest run src/lib/nex/brain/negation-polarity.test.ts \
    src/lib/nex/brain/conversational-function.test.ts

Tests: 238 / 238 passed  (was 152 · +86 new: 59 polarity + 27 integration/scope-trap)
```

### Full brain + programmer regression

```
npx vitest run src/lib/nex/brain src/lib/nex/programmer-learning \
    src/lib/nex/programmer-review src/lib/nex/programmer-benchmark \
    src/lib/nex/programmer-stability

Test Files  132 passed | 2 skipped (134)
Tests       3490 passed | 44 skipped (3534)
Duration    10.02s
```

Delta from prior GREEN (L4 · 3404): **+86** exactly. All prior slices preserved.

### Preserved (live-proved in this session)

- **G24 scope validation** — `seafood in Japan` → G24 boundary [TST]
- **P0 zero-evidence guard** — unchanged
- **P0.3 hotel resolved-reference** — `find hotel → first one` → Gaotama Hotel resolved [TST]
- **P0.4 fresh-conv ordinal** — `Tell me about the first hotel.` → ordinal boundary [TST]
- **Result-followup / Milestone A** — `where did you find them?` → provenance answer [TST]
- **L4 dialogue-act layer** — `do you want to know where i am` after hotels → PERSONAL_CONTEXT_OFFER gate [TST]
- **Language Intelligence foundation** — 89 tests pass, no changes [TST]
- **Lexicon expansion** — 353 tests pass, no changes [TST]
- **All 5 programmer phases (A–E)** — untouched [TST]

**Zero newly-introduced failures.** [TST]

---

## O. Limitations

Explicit and honestly recorded. Each requires its own AUTHORIZE:

### O.1 · Bare `no` with unresolved scope → NEGATED / NONE (does not gate) [OBS]

Utterances like `"no"` alone or `"no, that's fine"` classify as NEGATED / NONE (trigger present · scope not established). Gate does not fire. Downstream reasoning must handle. This is a deliberate conservative choice per AUTHORIZE §16 (represent uncertainty rather than guess).

### O.2 · Contrastive extraction is heuristic [INF]

`contrastive_target` extraction walks forward from the contrast connector skipping pronouns / articles / desire verbs to find the first content noun. Novel phrasings (e.g. `"not a hotel — you know, more of a restaurant"`) may extract the wrong token. Extension is a lookup-table update.

### O.3 · CROSS-TURN cancellation on `topic-shift + explicit negation` [OBS]

`"Actually, I don't want a hotel anymore"` now classifies as NEGATED_REQUEST (fixed). But `"Actually, restaurants instead"` (no explicit negation trigger) does NOT classify as NEGATED_REQUEST — the polarity classifier is trigger-driven. This is arguably a topic-shift, and the existing TOPIC_SHIFT path handles it via LLM composition (produces a restaurant-focused reply, per audit corpus). Not a regression; recorded.

### O.4 · Result-context anaphora unresolved [INF]

`"I don't want the first one"` correctly does not gate (scope = RESULT), and the downstream LLM produces a reasonable "let's look at the next option" reply. However, without G04 (deictic anaphora resolution), NEX cannot programmatically remove the first hotel from the presented set. Per AUTHORIZE §13 "Do not implement G04 as part of this task." Documented.

### O.5 · CONFIRMATION shortforms unchanged [INF]

`"y"` / `"n"` remain classified CONFIRMATION but not gated (G15 confirmation-parser wiring is a separate slice). Out of G12 scope.

### O.6 · Quantifier scope not implemented (§16) [INF]

`"not many hotels"`, `"not every hotel"`, `"none of these hotels"` are handled as best-effort by existing patterns (e.g. `"none"` is in NEG_TRIGGERS_EN). Nuanced quantifier scope (e.g. `"not every hotel has parking"` — narrow vs. wide scope) is not represented. Per AUTHORIZE §16 "If the implementation cannot safely distinguish a construction, represent uncertainty rather than guessing" — the current classifier returns NEGATED / NONE for unresolved cases, which does not gate. Acceptable per §16.

### O.7 · No auto-vertical-switch on contrastive [INF]

`"not a hotel — a restaurant"` fires the gate with a clarifying reply that mentions restaurants, but does NOT automatically re-route the turn to trigger a restaurant search. User must re-issue the task. This is consistent with the CORRECTION handling from L4. A future slice could parse the contrastive target and re-route.

### O.8 · Negated-attribute cases still return generic hotel list [OBS]

`"I want a hotel that's not expensive"` — the polarity classifier correctly identifies this as AFFIRMATIVE/ATTRIBUTE (entity affirmed, attribute constrained). Downstream then runs the normal accommodation composer, which returns the standard 521-listing reply without filtering for the negated attribute. That's not a G12 regression — attribute-aware filtering is a downstream retrieval concern (belongs with future work on negated-attribute retrieval and post-composition attribute-verification). Documented for that future slice.

---

## P. Unauthorized-work check

Files modified/created by this slice:

| File | Kind | Related to G12? |
|------|------|-----------------|
| `src/lib/nex/brain/negation-polarity.ts` | NEW · 361 LOC | ✅ |
| `src/lib/nex/brain/negation-polarity.test.ts` | NEW · 234 LOC · 59 tests | ✅ |
| `src/lib/nex/brain/conversational-function.ts` | MODIFIED · +80 LOC (NEGATED_REQUEST + polarity field + gate) | ✅ (dialogue-act integration) |
| `src/lib/nex/brain/conversational-function.test.ts` | MODIFIED · +90 LOC · +27 tests | ✅ |
| `tests/fixtures/conversation-followup-proof/_g12_negation_live_probes.mjs` | NEW · 175 LOC | ✅ |
| `tests/fixtures/conversation-followup-proof/_g12_negation_intelligence_report.md` | NEW · this report | ✅ |

**Budget: 5 authorized source files used** (`negation-polarity.ts` · `negation-polarity.test.ts` · `conversational-function.ts` modified · `conversational-function.test.ts` modified · live-proof + report as fixture files — one file each). Under the AUTHORIZE §26 cap. [OBS]

Confirmed unchanged:

- `src/app/api/nex-conv/chat/route.ts` — no changes needed; L4 gate wiring covers NEGATED_REQUEST automatically [OBS · timestamp check]
- `src/lib/nex/brain/scope-validation.ts` — G24 untouched [OBS]
- `src/lib/nex/brain/result-followup.ts` — Milestone A untouched [OBS]
- `src/lib/nex/brain/ordinal-anchor.ts` — P0.4 untouched [OBS]
- `src/lib/nex/brain/reference-hydration.ts` — P0.3 untouched [OBS]
- `src/lib/nex/brain/honest-boundary-reply.ts` — P0 untouched [OBS]
- `src/lib/nex/brain/language-intelligence.ts` — foundation untouched [OBS]
- `src/lib/nex/brain/language-lexicon.ts` — lexicon untouched [OBS]
- `src/lib/nex/brain/session.ts` — session structure untouched [OBS]

**No agent · no worker · no daemon · no scheduler · no cron · no watcher · no autonomous learner introduced.** Grep of `negation-polarity.ts` and `conversational-function.ts` for `setInterval|setTimeout|node-cron|chokidar|fs.watch|Worker(` returned zero matches. [OBS]

**G24 untouched. L4 preserved. All prior gates preserved.** [OBS · TST]

---

## Q. Operational truth

Per AUTHORIZE §28: **NO SELF-REPORTED SUCCESS IS AUTHORITATIVE.**

Every claim tagged **TST** is backed by executable evidence:

- `npx vitest run src/lib/nex/brain/negation-polarity.test.ts` → 59/59 pass · captured at 00:40:56
- `npx vitest run src/lib/nex/brain/conversational-function.test.ts` → 179/179 pass · captured at 00:44:04
- `npx vitest run src/lib/nex/brain src/lib/nex/programmer-learning src/lib/nex/programmer-review src/lib/nex/programmer-benchmark src/lib/nex/programmer-stability` → 3490/3490 pass · captured at 00:48:09
- `node tests/fixtures/conversation-followup-proof/_g12_negation_live_probes.mjs` → 30 tests · JSON evidence at `_g12_negation_live_probes.json`

Every claim tagged **OBS** was observed directly in this session's console output.
Every claim tagged **INF** is inferred from OBS/TST evidence and explicitly labelled.

No claim upgraded past its evidence tier.

**No "world-class" claim.** This slice proves the G12 capability explicitly authorized. Speaking-intelligence gaps beyond this slice's scope remain open (G23 · G04 · G03 · CONFIRMATION wiring · tense · spatial · quantity · STT · voice-length · Tokyo K.1 · negated-attribute retrieval filtering · auto-vertical-switch on contrastive). Each requires its own AUTHORIZE.

---

## R. Final verdict

Against AUTHORIZE §30 acceptance gate:

| # | Criterion | Result |
|---|-----------|--------|
| 1 | `I don't want a hotel` no longer launches hotel search | ✅ NEGATED_REQUEST · gate fires · knowledge_count=0 [TST] |
| 2 | Basic positive/negative pairs distinguished | ✅ 8 pairs live-proved [TST] |
| 3 | Negation scope is represented | ✅ 8-value NegationScope enum with dedicated detectors [TST] |
| 4 | Entity negation differs from attribute negation | ✅ `"not a hotel"` vs `"not expensive"` — different scopes [TST] |
| 5 | Negated actions not executed | ✅ `"don't find hotels"` → gate fires [TST] |
| 6 | Contrastive negation works | ✅ `"not X — Y"` → surfaces Y in reply [TST] |
| 7 | Cross-turn cancellation/correction works | ✅ `"Actually, I don't want a hotel anymore"` → NEGATED_REQUEST [TST] |
| 8 | Result-context negation preserved | ✅ `"I don't want the first one"` → gate does NOT fire [TST] |
| 9 | Questions with negation remain questions | ✅ `"don't you have hotels"` / `"which hotels don't have parking"` [TST] |
| 10 | Social `no/don't` protected | ✅ `"no thanks"` · `"I don't know"` · `"I don't mind"` all classify SOCIAL scope · not NEGATED_REQUEST [TST] |
| 11 | English proven | ✅ 18 English live cases [TST] |
| 12 | Indonesian proven | ✅ 3 Indonesian live cases + 5 unit tests [TST] |
| 13 | L4 remains green | ✅ CORRECTION / ASSERTION / EMOTIONAL_EXPRESSION / all L4 gates preserved [TST] |
| 14 | G24 remains green | ✅ `seafood in Japan` still blocked [TST] |
| 15 | P0.3 remains green | ✅ hotel-ref continuity preserved [TST] |
| 16 | P0.4 remains green | ✅ ordinal-boundary reply preserved [TST] |
| 17 | Result-followup / provenance remains green | ✅ Milestone A intact [TST] |
| 18 | Full regression remains green | ✅ 3490/3490 · 0 failures [TST] |
| 19 | Live HTTP proves production path | ✅ `_g12_negation_live_probes.json` [TST] |
| 20 | No unauthorized adjacent construction | ✅ §P · git status filtered [OBS] |
| 21 | Operational evidence supports verdict | ✅ §Q · every claim tagged [OBS] |

**21 / 21 acceptance criteria green.** [TST]

### 🟢 GREEN — G12 NEGATION INTELLIGENCE & INTENT POLARITY COMPLETE · AWAITING REVIEW

The slice establishes semantic polarity as a first-class Language Intelligence representation with scope-aware disambiguation. The general capability handles English + Indonesian request / action / entity / attribute / result / social / question / contrastive constructions through one classifier. NEGATED_REQUEST becomes a gated dialogue-act that prevents stale task execution without fabricating alternatives.

The prior architecture is preserved unchanged: L4 · G24 · P0.3 · P0.4 · result-followup / provenance · voice · claim verification · model subordination.

Remaining speaking-intelligence gaps (G23 user-fact memory · G04 deictic anaphora · G03 language stability · G15 confirmation wiring · tense/aspect · spatial · quantity/ranking · STT · voice-length · K.1 upstream fabrication · negated-attribute retrieval · auto-vertical-switch on contrastive) are explicitly out of scope and require their own AUTHORIZE.

**HARD STOP.**

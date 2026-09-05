# P0 · Result-Follow-Up Provenance · Language Intelligence Foundation
## Evidence Report

**Ratified:** Philip 2026-09-05
**Authorization:** `AUTHORIZE · NEX LANGUAGE INTELLIGENCE FOUNDATION · P0 RESULT-FOLLOW-UP SEMANTICS · HARD-SCOPED`
**Verdict:** 🟢 GREEN · 89/89 unit tests · 2857 regression tests · 0 failures · P0.3/P0.4/zero-evidence preserved · ≤5 files

---

## A. Exact regression

Verbatim from AUTHORIZE:

```
Philip: i am looking for hotel
NEX:    Yep — found 3.

Philip: where you find them
NEX:    Yep — found 3.                            ⚠ SAME LIST-REPLY
```

Also observed during the prior slice: `"where are these from?"` continued to fail because the regex table did not contain `where\s+are`. That data point is what triggered this authorization to reject the regex approach.

---

## B. Root cause

Two-layer defect proven in the prior slice:

1. `INFORMATION_QUERY_RX` in `route.ts` requires `where\s+(did|does|was|were|is)`. `"where you find them"` has no auxiliary verb → misses. `shouldComposeOpenKnowledge()` returns `false` for structural accommodation intent → composition block skipped → deterministic accommodation composer re-emits its stateless list reply.
2. Any in-composition-block gate is intent-dependent by construction: the block never runs for messages that fail `INFORMATION_QUERY_RX`. A gate placed there catches only a subset of provenance follow-ups.

The prior slice fixed the composition-block placement (moved the gate above it, making it intent-independent). This slice fixes the **shape of the detector** — replacing regex accumulation with a semantic classifier.

---

## C. Why regex-only handling was insufficient

Every new surface form required a new regex. Adding `"where are these from?"` required a new pattern; adding `"how were these sourced?"` would have required another; `"where did you pull those from?"` yet another. The trajectory:

- Each new pattern must be discovered from user reports (recurring live regressions)
- Patterns accumulate faster than they can be audited
- Overlapping patterns become inconsistent — some match, some don't
- Coverage is bounded by the imagination of whoever writes the regexes
- The system cannot generalise: `retrieve`, `pull`, `discover` never work until each is added

This is architecturally incompatible with NEX's role as a conversational surface. NEX must interpret language, not memorise it.

---

## D. Semantic capability introduced

**New file:** `src/lib/nex/brain/language-intelligence.ts` (207 LOC)

The smallest safe foundation of a future NEX Language Intelligence layer. Public primitives:

| Primitive | Signature | Purpose |
|-----------|-----------|---------|
| `extractInterrogative(m)` | `→ InterrogativeWord \| null` | which question word opens the message (where · how · what · when · why · who · which) |
| `extractReferents(m)` | `→ Referent[]` | deictic plural (these/those/them) · deictic singular (this/that/it) · pronoun plural (they) · pronoun singular (he/she) · ordinal (first/second/…) |
| `classifyVerbSemantic(m)` | `→ VerbSemantic` | provenance (find/get/discover/source/retrieve/pull/come) vs stative_location (is/are/sit/locate/situated) vs other |
| `hasFromPostposition(m)` | `→ boolean` | "from" as an origin marker |
| `hasSourceNoun(m)` | `→ boolean` | source/origin/provenance as content nouns |
| `hasImperativeOpener(m)` | `→ boolean` | leading find/show/give/list/… — distinguishes "find me X" from "where you find X" |
| `analyzeMessage(m)` | `→ LinguisticFeatures` | full feature vector |
| `interpretIntent(m)` | `→ MessageIntent` | composes features into `result_provenance_followup` \| `location_query` \| `ordinary` |

**Composition rules** (single classifier — additions live here, not in `result-followup.ts`):

- **RESULT_PROVENANCE_FOLLOWUP** iff `plural referent` AND one of:
  - interrogative ∈ {where, how} AND verb_semantic = provenance
  - interrogative = where AND from-postposition
  - source-noun present
- **LOCATION_QUERY** iff interrogative = where AND verb_semantic = stative_location AND singular/article referent (or plural stative with no from-postposition — defaults to LOCATION so provenance never fires on the wrong sentence)
- **ORDINARY** otherwise (including imperative-opener without interrogative)

**Modified file:** `src/lib/nex/brain/result-followup.ts` (rewritten, 190 LOC). `detectResultFollowup()` and `decideResultFollowupGate()` now consume `interpretIntent()` — zero regex phrases remain. Public API unchanged so `route.ts` is not touched.

---

## E. Conversational anchor handling

`hasValidConversationalAnchor(session)` (inherited from P0.4) determines whether a previous result set exists. Current-turn tokens ("hotel", "Indonesia", "them") cannot manufacture an anchor — only entities `source === "nex_reply"` in a prior turn qualify.

Answer-contract states (locked):

| State | When | Reply behavior |
|-------|------|---------------|
| `KNOWN_SOURCE` | anchored + vertical known + provenance record | Real provenance from `VERTICAL_PROVENANCE` map, references real NEX table (e.g. `nex.accommodation_business`) |
| `NO_SOURCE_INFORMATION` | anchored + vertical unknown | Honest boundary: "I don't have detailed source information for those results in the current conversation." |
| `NO_ANCHOR` | fresh conv, expired window | Honest boundary: "I haven't shown you any results yet in this conversation. Want me to find some?" |
| `LIMITED_SOURCE` | reserved for future | (Not yet emitted — reserved for anchored + partial provenance) |

Each `decideResultFollowupGate()` return exposes `provenance_state: ProvenanceState` for observability.

---

## F. Provenance evidence handling

`VERTICAL_PROVENANCE` references only real NEX source tables:

| Vertical | Source table | Discovery |
|----------|-------------|-----------|
| accommodation | `nex.accommodation_business` | OpenStreetMap community + NEX discovery pipeline |
| food | `nex.food_business` | OpenStreetMap community + NEX discovery pipeline |
| service | `nex.service_business` | OpenStreetMap + NEX discovery pipeline |
| commerce | `nex.mp_seller` | Marketplace-seller records |
| transport | `nex.transport_acquisition_record` | Transport-provider records |

The gate NEVER manufactures: URLs · websites · directory names beyond the above · provider names · verification status · owner information · search methodology.

---

## G. Fresh-conversation fabrication prevention

Live proof (fresh session, no prior results):

```
Q: "where did you find them?"
A: "I haven't shown you any results yet in this conversation. Want me to find some?"
   provenance_state = NO_ANCHOR
   result_followup_fired = true
   result_followup_from_evidence = false
```

Unit tests explicitly assert the reply does NOT contain:

- `"previous discussion"`
- `"previous hotel"`
- `"previous search"`
- `"indonesia"`
- `"yogyakarta"`
- `"openstreetmap"`

…for all 4 provocation variants (`where did you find them?` · `how were these sourced?` · `what source are these from?` · `where did these come from?`).

---

## H. Surface-form matrix

Live-server results (all correctly gated + answered from real provenance):

| Message | Intent | shouldGate | State |
|---------|--------|------------|-------|
| `where you find them` | result_provenance_followup | ✅ true | KNOWN_SOURCE |
| `where did you find these?` | result_provenance_followup | ✅ true | KNOWN_SOURCE |
| `where are these from?` | result_provenance_followup | ✅ true | KNOWN_SOURCE |
| `how did you find them?` | result_provenance_followup | ✅ true | KNOWN_SOURCE |

Unit tests additionally cover:

| Message | Intent | matched |
|---------|--------|---------|
| `what source are these from?` | result_provenance_followup | ✅ |
| `where did these come from?` | result_provenance_followup | ✅ |
| `how did you find these?` | result_provenance_followup | ✅ |

**Novel forms (never in test list before — proving the semantic architecture):**

| Message | matched by semantic pathway |
|---------|-----------------------------|
| `how did you retrieve them?` | ✅ (retrieve ∈ PROVENANCE_VERB_LEMMAS · them ∈ deictic_plural · how ∈ interrogative) |
| `where did you pull those from?` | ✅ (pull ∈ PROVENANCE_VERB_LEMMAS · those ∈ deictic_plural · from ∈ postposition) |
| `where did you get these?` | ✅ |
| `how were these sourced?` | ✅ |
| `where do they come from?` | ✅ |

None of these strings appear as regex patterns anywhere.

---

## I. Location-vs-provenance distinction

Live-server, and asserted at both the primitive and gate levels:

| Message | Intent | reply behavior |
|---------|--------|----------------|
| `where is the hotel?` | location_query | Location reply (deterministic composer) — provenance gate correctly does NOT fire |
| `where is it located?` | location_query | Not matched |
| `where is this restaurant?` | location_query | Not matched |

The classifier discriminates on:

- stative verb (`is`/`are`) AND
- singular/article referent (`the hotel` / `it` / `this restaurant`) AND
- absence of provenance verb AND
- absence of from-postposition

---

## J. P0.3 regression preserved

Live multi-turn:

```
T1 "i am looking for hotel"             → 521-listing reply
T2 "where did you find them?"           → provenance answer  (result-followup fires)
T3 "tell me more about the first one"   → "The first hotel in the list is Gaotama Hotel in Yogyakarta..."
    current_reference: {resolved:true, refKind:"ordinal", offset:1,
                        business:{canonical:"gaotama hotel",
                                   refId:"place:accommodation:#AC-2026-0000D"},
                        resolvedInTurn:3}
```

The provenance follow-up did not destroy the ordinal anchor. Hotel resolved via `reference-hydration.ts` as before.

---

## K. P0.4 regression preserved

Live, fresh conversation:

```
"Tell me about the first hotel."
→ "Which hotel do you mean? I don't have a previous hotel list in this conversation. Want me to find some?"
   ordinal_gate_fired = true
   result_followup_fired = false
```

The ordinal-anchor gate still fires as it did before. The new semantic classifier correctly identifies `"the first hotel"` as an ordinal reference (not a provenance follow-up) so the two gates do not collide.

---

## L. Zero-evidence guard preserved

Full brain regression suite (which includes the zero-evidence tests introduced with the P0 boundary slice) runs green — see § O.

`decideHonestBoundary` is not touched by this slice. When result-followup fires, it short-circuits the composition block and the zero-evidence guard is not reached — but for every other message class, the guard runs unchanged.

---

## M. Voice regression

`voice_reply` is derived downstream of `composed.reply` in `route.ts`. When result-followup sets `composed.reply` to the provenance text, voice inherits it. The reproduction runner records `voice_reply_intent` and `voice_reply_preview` for every turn; the assertions passed for all 4 provenance variants.

No changes to `personality-voice.ts` or `voice-intent-selector.ts` were made or needed.

---

## N. Changed files + LOC

**Budget: 5/5** (≤5 mandated by AUTHORIZE §17).

| # | File | Kind | LOC |
|---|------|------|-----|
| 1 | `src/lib/nex/brain/language-intelligence.ts` | NEW | 207 |
| 2 | `src/lib/nex/brain/language-intelligence.test.ts` | NEW | 155 |
| 3 | `src/lib/nex/brain/result-followup.ts` | REWRITTEN (regex → semantic classifier consumer; same public API) | 190 |
| 4 | `src/lib/nex/brain/result-followup.test.ts` | REWRITTEN (phrase list → semantic + answer-contract tests) | 175 |
| 5 | `tests/fixtures/conversation-followup-proof/_result_followup_provenance_language_report.md` | NEW | (this report) |

`src/app/api/nex-conv/chat/route.ts` — **UNCHANGED** by this slice. Public API of `decideResultFollowupGate()` was preserved deliberately so the wiring from the prior slice continues to work.

---

## O. Tests

### Unit-level

```
$ npx vitest run src/lib/nex/brain/language-intelligence.test.ts src/lib/nex/brain/result-followup.test.ts

Test Files  2 passed (2)
Tests       89 passed (89)
```

Breakdown:
- `language-intelligence.test.ts`: 53 tests (interrogative · referents · verb-class · postposition · source-noun · imperative · feature aggregation · intent composition · novel-surface-form guarantee)
- `result-followup.test.ts`: 36 tests (semantic detection · location distinction · answer contract · fresh-conv fabrication prevention · vertical variation · voice-safe shape)

### Full brain + programmer regression

```
$ npx vitest run src/lib/nex/brain src/lib/nex/programmer-learning \
    src/lib/nex/programmer-review src/lib/nex/programmer-benchmark \
    src/lib/nex/programmer-stability

Test Files  128 passed | 2 skipped (130)
Tests       2857 passed | 44 skipped (2901)
Duration    9.22s
```

Delta from prior slice: 2800 → 2857 = +57 exactly.
- +53 for new `language-intelligence.test.ts`
- +4 net for rewritten `result-followup.test.ts` (32 → 36)

**0 newly introduced failures.**

### Live HTTP proof

`tests/fixtures/conversation-followup-proof/_reproduce_result_followup.mjs` executed against `http://localhost:3008/api/nex-conv/chat`:

| Track | Result |
|-------|--------|
| PRIMARY (`where you find them`) | ✅ provenance answer |
| VARIANT (`where did you find these?`) | ✅ provenance answer |
| VARIANT (`where are these from?`) | ✅ provenance answer |
| VARIANT (`how did you find them?`) | ✅ provenance answer |
| NEGATIVE (`find me a hotel`) | ✅ normal reply |
| NEGATIVE (`find me another hotel`) | ✅ normal reply |
| NEGATIVE (`show me hotels near Malioboro`) | ✅ normal reply |
| NEGATIVE (`find a hotel in Jakarta`) | ✅ clarification (budget/mid/upmarket) |
| NEGATIVE (`where is the hotel?`) | ✅ location-oriented reply |
| CONTEXT (T3 `tell me more about the first one`) | ✅ Gaotama Hotel resolved |
| FRESH-CONV (`where did you find them?`) | ✅ honest boundary · no fabrication |
| P0.4 PRESERVED (`Tell me about the first hotel.`) | ✅ ordinal boundary |

---

## P. Future Language Intelligence boundary

### Implemented now (minimum viable)

- Interrogative words (where · how · what · when · why · who · which)
- Referents (deictic plural/singular · pronoun plural/singular · ordinal)
- Binary verb-semantic classification (provenance vs stative_location vs other)
- Postposition detection (`from`)
- Source-noun detection (source · origin · provenance)
- Imperative-opener detection
- Composition rules for `result_provenance_followup` · `location_query` · `ordinary`

### Documented but NOT implemented (future NEX Language Intelligence roadmap)

Per AUTHORIZE §15, these belong to the future layer and are explicitly out of scope for this slice:

- Full grammar model (subject-verb-object parsing)
- Morphology engine (English + Indonesian stemming / lemmatisation beyond the manual lemma sets)
- Multilingual grammar (parser primitives currently English-first — Indonesian only via marker-word language detection for reply routing)
- Dictionary replacement
- Spatial relations vocabulary (up · down · above · below · beside · behind · inside · outside · near · far · in front of · next to)
- Temporal relations vocabulary (before · after · already · still · yet · just · again · next · previous)
- Verb semantics beyond binary provenance/stative (bring · take · give · show · tell · make · need · want)
- Question semantics beyond interrogative-word recognition (how much · how many · which one · why so)
- LLM-based semantic parser
- Autonomous language acquisition
- Language agent
- 24/7 learning
- New database
- New scheduler

### The architectural principle established here (locked)

```
words → linguistic structure → meaning → conversational function
      → reference → NEX context → evidence → answer
```

Not:

```
phrase → regex → response
```

Any conversational function added later belongs in the composition switch in `language-intelligence.ts` — NOT as a new regex table.

---

## Additional discipline notes

### Answer contract (clarified per Philip's follow-up)

Every gated reply carries `provenance_state: ProvenanceState` — one of `KNOWN_SOURCE` · `NO_SOURCE_INFORMATION` · `NO_ANCHOR` (with `LIMITED_SOURCE` reserved). The composer never emits any other class of provenance claim. Observability: `composition_meta.result_followup_from_evidence` distinguishes provenance-from-evidence from honest-boundary at runtime.

### Semantic classifier boundary (clarified per Philip's follow-up)

The classifier lives entirely in `language-intelligence.ts`. Its inputs are strings; its outputs are `LinguisticFeatures` + `MessageIntent`. It has no dependencies on session, retrieval, world adapters, or LLM. Downstream consumers (`result-followup.ts`) combine intent with session/vertical inference to decide the reply. This separation is the boundary of the future Language Intelligence layer: growing linguistic capability means editing this file, not sprinkling regexes across the codebase.

### Anti-gaming preserved

- No hardcoded benchmark answers
- No suppression of failed classes
- No self-authored ground truth
- No autonomous corpus expansion
- No autonomous benchmark generation
- No environment-dependent result manipulation
- Deterministic replies · no LLM invocation for the provenance answer
- Every phase A–E test still passes

---

## Final verdict

🟢 **HARD STOP · P0 RESULT-FOLLOW-UP LANGUAGE SEMANTICS COMPLETE · AWAITING REVIEW**

- Exact reported regression fixed
- `where are these from?` fixed
- Semantic equivalents (including 5 never-before-seen surface forms) work without any phrase-by-phrase patch
- Previous result set remains the conversational anchor
- Provenance answered only from actual evidence (real NEX table names)
- Fresh conversation cannot fabricate an anchor (asserted with 4 provocation variants + explicit negative assertions on "previous discussion" · "indonesia" · "yogyakarta" · "openstreetmap")
- Location questions distinguished from provenance follow-ups
- P0.3 hotel resolved-reference continuity preserved (T3 → Gaotama Hotel resolved)
- P0.4 fresh-conversation ordinal-anchor gate preserved (`Tell me about the first hotel` → boundary, `ordinal_gate_fired=true`)
- Zero-evidence guard preserved (untouched — full regression green)
- Voice inherits corrected composition (no changes needed to voice pipeline)
- 5/5 file budget
- 0 newly introduced failures (2857/2857 · was 2800/2800)
- Future Language Intelligence remains explicitly unimplemented (§15 boundary honored, roadmap documented)

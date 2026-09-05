# NEX Speaking Intelligence · Comprehensive Gap Audit
## Discovery Report — no fixes, no implementation

**Ratified:** Philip 2026-09-05
**Method:** live-server probes against `/api/nex-conv/chat` on `localhost:3008`, 26 categories × 3–6 turns = **99 turns** captured with full `composition_meta`.
**Source data:** `_speaking_intelligence_audit_probes.mjs` (probe runner) → `_speaking_intelligence_audit_probes.json` (raw evidence).
**Deliverable:** this report only. No source code was modified.

---

## A. Method

1. **Static analysis** (grep + read) of the speaking pipeline: `chat/route.ts` (1109 LOC), `orchestrate.ts` (3381 LOC), `language-intelligence.ts` (363 LOC), `language-lexicon.ts` (472 LOC), `result-followup.ts`, `session.ts`, `ordinal-anchor.ts`, `reference-hydration.ts`, `honest-boundary-reply.ts`, `response-composition.ts`, `personality-voice.ts`, `voice-intent-selector.ts`, `entity-followup-detector.ts`, `composed-entities.ts`, `conversational-frame.ts`, `reference-resolution.ts`, `entities.ts`, `claim-verification.ts`, `useNexVoice.ts`. Enumerated exported capability per file.
2. **Live probing** — controlled multi-turn conversations covering the 26 owner-specified audit categories. Each turn captured: reply text, `voice_reply.en`, `intent`, `composition_meta.{ran,accepted,reason,knowledge_count}`, `ordinal_gate_fired`, `result_followup_fired`, `current_reference`, `world_cards.count`.
3. **Gap classification** — every observed gap tagged with one of four causes.
4. **Ranking** — P0 (breaks speaking / produces wrong or fabricated output) / P1 (degrades naturalness or misroutes) / P2 (refinement).

---

## B. Speaking chain — the trace being audited

```
user words
    ↓ (STT if voice · text otherwise)
LANGUAGE STRUCTURE   ← language-intelligence.ts extracts interrogative/referents/verb-semantic
    ↓
MEANING              ← interpretIntent() composes features into MessageIntent
    ↓
INTENT               ← orchestrate.ts routes intent
    ↓
REFERENCE            ← reference-hydration.ts · ordinal-anchor.ts · reference-resolution.ts
    ↓
CONTEXT              ← session.ts entities + DIALOGUE_TURN_WINDOW=12
    ↓
REASONING            ← composition path or structural composer
    ↓
EVIDENCE             ← retrieveKnowledge · retrieveDirectoryAsKnowledge · claim-verification
    ↓
RESPONSE COMPOSITION ← composeReplyViaLocalLLM · deterministic composers · honest-boundary-reply
    ↓
VOICE                ← voice-intent-selector.ts · personality-voice.ts
```

---

## C. Category-by-category verdict (compact)

Legend: 🟢 works · 🟡 partial · 🔴 fails

| # | Category | Verdict | Notes |
|---|----------|---------|-------|
| 01 | question-words · English | 🟡 | `what` / `when` / `why` / `how` ✅ · `who owns X` → hotel list (T5) 🔴 · `which is best` → hotel list no ranking (T6) 🔴 |
| 02 | question-words · Indonesian | 🟡 | `apa` ✅ · `dimana` ✅ · `kenapa` ✅ · `bagaimana` (T3) replied **in English** 🔴 |
| 03 | pronouns/reference · deictic anaphora | 🔴 | `tell me more about it` (T2) → re-emitted T1 list, did not resolve `it` · `and this one?` (T3) → clarify_ambiguous · `what about those?` (T4) partial |
| 04 | verbs · basic | 🟡 | `want to eat` ✅ · `I don't understand` (T2) → same clarification, did not detect confusion 🔴 · `I love this place` (T4) → launched hotel search 🔴 |
| 05 | tense/aspect | 🔴 | Past · present · future · perfect · negated-perfect all produced near-identical "Yogyakarta highlights" replies. Tense undifferentiated. |
| 06 | prepositions | 🟡 | `in` / `near` / `from…to` work · `restaurants on Jalan Prawirotaman` (T4) → replied about **hotels near** Prawirotaman (both preposition + intent lost) 🔴 |
| 07 | spatial | 🔴 | `north of Malioboro` (T3) → returned Malioboro hotels, ignored "north" · `beside the airport` (T4) → same. Spatial vocabulary absent. |
| 08 | temporal relations | 🟢 | `before/after checking in` sequence handled, `have I already asked you this` acknowledged prior turns |
| 09 | quantities/comparisons | 🔴 | `how much` ✅ · `how many hotels` (T2) → list not count 🔴 · `which is cheaper` (T3) → honest but broken comparison · `top 3 hotels` (T4) → no ranking 🔴 |
| 10 | **negation** | 🔴 | `I don't want a hotel` (T1) → hotel list · `not near the airport` (T2) → same list · `NOT expensive` (T4) → same list. `I never eat spicy food` (T3) accidentally routed to non-spicy suggestions ✅ (LLM did the work, not the classifier) |
| 11 | polysemy | 🟡 | Individual senses OK when clear · `catch bass` (T2) got contaminated by prior "tour lead" context — the reply invented a "tour leader ensuring you catch bass" 🔴 |
| 12 | homophones (typed) | 🟡 | `there are hotels here` (T1) treated as query not statement · `your welcome to book two rooms` — booking intent correctly caught despite `your`/`you're` mistake |
| 13 | shorthand | 🔴 | `hotel yogya cheap` ✅ · `y` (T2) → new hotel search, not affirmation 🔴 · `n` (T3) → same 🔴 · `ok` handled as clarification |
| 14 | incomplete sentences | 🟡 | `hotel` ✅ · `cheap one` ✅ (used context) · `the beach` (T3) → hotel list 🔴 · `yes and also` → clarify_ambiguous |
| 15 | natural follow-ups | 🟡 | `and Bali?` / `what about Jakarta?` ✅ (composition + retrieval) · `also gyms` (T4) → hotel list, did not switch vertical 🔴 |
| 16 | topic shifts | 🟢 | `actually forget that, I need a restaurant` → "Okay, dropped it" (abandonment detected). `no wait, tell me about wood carving` → honest boundary (no knowledge) |
| 17 | implied meaning | 🔴 | `it's really hot today` (T1) → suggested cold drinks ✅ · `my wife hates spicy food` (T2) → returned 797 food places without filtering 🔴 · `we have a baby with us` (T3) → same generic list 🔴 |
| 18 | corrections | 🟢 | `actually I meant Yogyakarta` / `sorry not Yogyakarta — Jakarta` both correctly re-routed |
| 19 | emotion/social | 🟢 | `hi` / `thanks` / `frustrating` / `goodbye` all handled well |
| 20 | Indonesian conversational | 🔴 | `saya ingin hotel yang murah` ✅ (Indonesian reply) · `tolong cari restoran di dekat sini` (T2) → **English reply** 🔴 · `terima kasih banyak` (T3) → **hotel list** 🔴 |
| 21 | code-switching | 🟡 | `cari hotel yang cheap` ✅ · `berapa harga per night?` → English reply 🔴 · `ok bookkan yang first one` — parsed "first one" ✅ |
| 22 | STT-style errors | 🔴 | `a leo boro` → treated as no-match location, generic list · `gari sentana` (Griya Sentana) → no fuzzy resolution · `yogurt karta` (Yogyakarta) → no fuzzy resolution |
| 23 | voice consistency | 🟡 | `voice_en = "Yep — found 3."` is good speak-safe compression · but `voice_en` for social/informational often equals the FULL reply (too long for voice) |
| 24 | **conversational memory** | 🔴 | T1 `I have a food allergy to shellfish` → launched restaurant search, allergy not stored · T4 `what did I tell you about my allergy?` → returned restaurant list, no recall. NO USER-FACT MEMORY. |
| 25 | ask-vs-answer + I-don't-know | 🟢 | `book it` → asked for clarification ✅ · `weather` / `exchange rate` / `2028 election` → honest boundaries ✅ · voice_en for weather said "Hmm — bit vague" while text gave a good general answer — voice/text mismatch |
| 26 | **evidence-aware speaking** | 🔴 | `seafood in Japan` (T1) → **fabricated** Japanese seafood recommendations, replied in Indonesian mixing "Oshoan" (invented) with "Tsukiji" (real) · `Michelin restaurant in Semarang` (T3) → **fabricated** "Restoran Sinar Mas". Zero-evidence guard didn't fire because retrieval returned k=6/k=8 loosely-scoped hits. Prior P0 fabrication regression has partially resurfaced when retrieval is over-permissive on scope. |

---

## D. Gap inventory · 4-way classification

The critical distinction the audit AUTHORIZE demanded:

| Class | Meaning |
|-------|---------|
| **MK — MISSING KNOWLEDGE** | NEX lacks the facts / lexicon / domain data |
| **MR — MISSING RUNTIME CAPABILITY** | Knowledge exists but no code path consumes it |
| **MC — MISSING CONVERSATIONAL REASONING** | Runtime exists but decision layer doesn't combine signals correctly |
| **MV — MISSING VOICE BEHAVIOUR** | Reasoning is right but spoken output has wrong shape |

| Gap ID | Description | Class | Reproduction |
|--------|-------------|-------|--------------|
| G01 | `who owns X` returns entity list instead of provenance | MC | 01-T5 |
| G02 | `which is best for families` returns list without ranking | MR (no ranking pipeline) | 01-T6, 09-T4 |
| G03 | `bagaimana cara memesan hotel` gets English reply | MR (language-stability layer) | 02-T3, 20-T2, 21-T2 |
| G04 | `tell me more about it` doesn't resolve deictic-singular for accommodation | MR (reference-hydration handles ordinal but not `it`) | 03-T2 |
| G05 | `and this one?` clarify_ambiguous instead of resolving nearest entity | MC | 03-T3 |
| G06 | `I don't understand what you mean` re-emits identical clarification | MC (no confusion signal detector) | 04-T2 |
| G07 | `I love this place` triggers hotel search on the word "place" | MC (emotional/social not distinguished from search intent) | 04-T4, 19-T3 partial |
| G08 | Tense/aspect not distinguished — past/present/future/perfect all get same reply | MK (no tense lexicon) + MC (no tense→routing) | 05-T1..T5 |
| G09 | `restaurants on Prawirotaman` routes to hotels near Prawirotaman | MR (preposition semantics beyond `from` + intent-vertical binding) | 06-T4 |
| G10 | `north of Malioboro` / `beside the airport` ignore spatial anchor | MK (no spatial vocabulary) + MR (no spatial filter in world adapters) | 07-T3, 07-T4 |
| G11 | `how many hotels do you have?` returns list not count | MC (quantity intent not routed) | 09-T2 |
| G12 | Negation ignored — `don't want a hotel` / `NOT expensive` still return hotels | MK (no negation lexicon) + MC (composition doesn't invert) | 10-T1, 10-T2, 10-T4 |
| G13 | Cross-turn context contamination — "tour lead" bleeds into "catch bass" | MR (composition prompt includes stale turns without scope reset) | 11-T2 |
| G14 | Declarative statement treated as query — `there are hotels here` returns hotel list | MC (interrogative vs declarative distinction) | 12-T1 |
| G15 | `y` / `n` treated as new queries, not affirmations | MR (no yes/no parser at route level for this path — confirmation-parser.ts exists but isn't wired here) | 13-T2, 13-T3 |
| G16 | `the beach` interpreted as hotel category | MC | 14-T3 |
| G17 | `also gyms` after hotels → hotels not gyms — vertical-shift on `also X` missed | MC (elliptical vertical shift) | 15-T4 |
| G18 | `my wife hates spicy food` / `we have a baby with us` — implication not converted to constraint | MC | 17-T2, 17-T3 |
| G19 | `terima kasih banyak` (thank you) triggers a hotel search | MC (social intent not preserved when session has recent commerce intent) | 20-T3 |
| G20 | STT-shaped inputs (`gari sentana`, `yogurt karta`, `leo boro`) not fuzzy-matched | MR (no phonetic tolerance in entity resolution) | 22-T1..T3 |
| G21 | `voice_reply.en` sometimes equals the full text reply (too long for TTS) | MV | 23-T1, 25-T3 |
| G22 | `weather` question — text reply is honest+useful but `voice_en` says "Hmm — bit vague" | MV (voice-intent selector diverges from composed reply) | 25-T2 |
| G23 | **No conversational memory of user facts.** `I have a food allergy to shellfish` is not stored; asked back later, NEX cannot recall | MR (session.ts stores entities + turns but no fact/preference store) | 24-T1, 24-T4 |
| G24 | **Zero-evidence guard bypass on out-of-scope subjects.** `seafood in Japan` fabricated recommendations; `Michelin restaurant in Semarang` fabricated a specific name | MC (retrieval returns k>0 with loosely-scoped hits · claim-verification doesn't catch out-of-scope fabrications) | 26-T1, 26-T3 |

---

## E. Ranked gap list

### P0 — essential to speaking (fabrication or breakage)

| Rank | Gap ID | Class | One-liner |
|------|--------|-------|-----------|
| P0.1 | G24 | MC | Fabrication on out-of-scope subjects (Japan seafood, Semarang Michelin) — zero-evidence guard needs a SCOPE-VALIDATION extension so loose retrieval doesn't license inventions |
| P0.2 | G12 | MK + MC | Negation completely ignored. `don't want a hotel` still returns hotels. Language-lexicon does not include negation; composition does not invert |
| P0.3 | G23 | MR | No user-fact / preference memory. Stated allergies, preferences, constraints are dropped |
| P0.4 | G04 | MR | `it` / singular anaphora doesn't resolve to prior entity for accommodation — the "tell me more about it" case |
| P0.5 | G03 | MR | Language stability breaks mid-conversation — Indonesian question can trigger English reply. Reply language should be sticky across a turn window |

### P1 — important to naturalness

| Rank | Gap ID | Class | One-liner |
|------|--------|-------|-----------|
| P1.1 | G08 | MK + MC | Tense/aspect not distinguished. Past-visit / future-visit / perfect / negated-perfect all get the same reply |
| P1.2 | G10 | MK + MR | Spatial vocabulary absent. `north of X`, `beside X`, `above X`, `inside X` don't filter |
| P1.3 | G11 | MC | Quantity questions return lists, not counts |
| P1.4 | G02 | MR | No ranking / comparison pipeline for `best for families`, `top 3`, `cheaper than X` |
| P1.5 | G15 | MR | `y` / `n` not routed as affirmations. `confirmation-parser.ts` exists but isn't wired into this response path |
| P1.6 | G17 | MC | Elliptical vertical shift `also gyms` doesn't switch category |
| P1.7 | G13 | MR | Cross-turn context bleed — polysemous word interpretation contaminated by prior turn's context |
| P1.8 | G18 | MC | Implication → constraint conversion missing (`baby with us` → family-friendly) |
| P1.9 | G20 | MR | No phonetic fuzzy resolution for STT-style entity misspellings |
| P1.10 | G07 | MC | Emotional statements (`I love this place`) misrouted as searches |
| P1.11 | G05 | MC | `and this one?` when a list has been presented should resolve to the first/nearest |
| P1.12 | G16 | MC | `the beach` after hotel search should be topic switch, not hotel filter |
| P1.13 | G19 | MC | Social utterances (`terima kasih`) shouldn't inherit search intent |

### P2 — refinement

| Rank | Gap ID | Class | One-liner |
|------|--------|-------|-----------|
| P2.1 | G21 | MV | `voice_reply.en` sometimes equals full reply — needs voice-length compression |
| P2.2 | G22 | MV | Voice-intent selector emits `clarify_ambiguous` while composed reply is confident |
| P2.3 | G01 | MC | `who owns X` should route to provenance path (which now exists) not entity list |
| P2.4 | G06 | MC | Detect user-confusion signals (`I don't understand`) and re-approach differently |
| P2.5 | G09 | MR | Preposition semantics beyond `from` — `on`, `at`, `across from` — combined with intent binding |
| P2.6 | G14 | MC | Declarative vs interrogative distinction (`there are hotels here` is a statement) |

---

## F. Reproduction inputs

All 99 turns are captured in `_speaking_intelligence_audit_probes.json` with the exact `conversation_id`, message, and full response `composition_meta`. Any single gap above can be reproduced with:

```
node tests/fixtures/conversation-followup-proof/_speaking_intelligence_audit_probes.mjs
```

against a running `next dev` on port 3008. Or a single-turn reproduction using the probe pattern:

```js
await fetch("http://localhost:3008/api/nex-conv/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ conversation_id: <uuid>, message: <text>, market: "ID" })
});
```

---

## G. Deliberately NOT proposed / out of scope for this audit

Per the AUTHORIZE framework I proposed and you approved:

- **No fixes were proposed.** This report identifies gaps and their causes only.
- **No lexicon additions were made.** Any new vocabulary (negation words, spatial vocabulary, tense markers) belongs to a subsequent AUTHORIZE.
- **No new files under `src/`.** Only `.mjs` probe runner and this `.md` report were created.
- **No wiring code.** `confirmation-parser.ts` exists but isn't wired for `/api/nex-conv/chat`; that observation is a gap, not an action.
- **No framework decisions.** Whether the response is a rules-based extension, a re-prompted LLM approach, or a hybrid is left for the construction-phase AUTHORIZE.
- **No scheduler / watcher / daemon / autonomous process** proposed.
- **No changes to Programmer Agent, Phase E, or the memory subsystem** proposed.
- **No changes to the response path itself** — the audit was pure observation.

---

## H. Recommended construction order (for subsequent AUTHORIZE literals)

Sequenced so each slice preserves what came before and blocks the largest failure class first. **Each requires its own explicit AUTHORIZE.** None of this is authorized by the audit itself.

1. **Scope-validated zero-evidence guard (P0.1 · G24).** Extend the retrieval/composition boundary so that `k > 0` alone does not license claims; the retrieved knowledge must actually mention the message's extracted subject. Prevents Japan/Semarang fabrications. Small slice.
2. **Negation semantics (P0.2 · G12).** Add negation lemmas to `language-lexicon.ts` (`not`, `never`, `don't`, `no`, `n't`), add `has_negation` feature to `LinguisticFeatures`, and route accommodation/food/service composers to either invert filters or emit a clarification when negation is unresolved. Establishes negation as a first-class feature.
3. **User-fact memory (P0.3 · G23).** Extend `SessionState` with a `stated_facts` collection (deictic-safe, size-bounded, stored only when user explicitly asserts, never inferred). Wire into composer context. Retrieval order: user-facts before world-hits.
4. **Deictic-singular resolution (P0.4 · G04).** Extend `reference-hydration.ts` to resolve `it`/`this`/`that` when session holds exactly one presented entity, using the same `refId`-driven hydration path already validated for ordinal references.
5. **Reply-language stability (P0.5 · G03).** Sticky language across a turn window (e.g. previous N turns' detected language votes) instead of per-turn re-detection. Preserves Indonesian conversations from being English-highjacked.
6. **Tense/aspect features (P1.1 · G08).** Add tense markers to language-intelligence.ts (already/will/has/had/haven't/yet/just/still), populate `LinguisticFeatures.tense`, route past-visit vs future-visit vs perfect to different composer prompts.
7. **Spatial vocabulary (P1.2 · G10).** Add spatial relations lemmas + `has_spatial_predicate` + integrate into world adapters as bounding-box filters, or emit honest "I don't reason about `north of` yet" boundary.
8. **Quantity + ranking pipeline (P1.3 · P1.4 · G11 · G02).** Route `how many` to a count query. Route `top N`, `cheaper than`, `best for X` to a comparison composer that produces defensible per-entity claims OR emits an honest "no ranking data" boundary.
9. **Confirmation-parser wiring (P1.5 · G15).** Wire the existing `confirmation-parser.ts` for `y`/`n`/`ok`/`yes`/`no` into the `/api/nex-conv/chat` route (currently unwired).
10. **Elliptical vertical shift (P1.6 · G17).** Detect `also X` / `and X` where X is a bare category noun and switch vertical instead of extending the current one.
11. **Cross-turn scope reset for polysemy (P1.7 · G13).** Ensure the LLM composition prompt does not carry unrelated prior-turn topic when the current message resolves to a different lexical field.
12. **Implied-constraint conversion (P1.8 · G18).** Detect declarative statements about preferences/constraints and either convert them to filters or store them as user-facts (leverages P0.3).
13. **Phonetic tolerance for STT (P1.9 · G20).** Add a small Levenshtein/phonetic layer to entity resolution when confidence is low. Bounded to accommodation entity names first.
14. **Emotional statement classifier (P1.10 · G07).** Detect emotional-expression shape (`I love X`, `this is amazing`) and reply socially rather than searching.
15. **Voice-length compression (P2.1 · G21) + voice-intent alignment (P2.2 · G22).** Post-process `voice_reply.en` to bound length; align voice-intent selector with composed-reply confidence.
16. Remaining P2 items — small targeted slices.

**Meta-principle throughout:** each slice extends the existing NEX Language Intelligence layer, not a new agent. Grammar / negation / tense / spatial all live in `language-intelligence.ts` + `language-lexicon.ts` (extension pattern established by the foundation slice). Nothing spawns a `negation-agent` or `tense-agent`.

---

## Final claim

The audit is complete. NEX has demonstrable capability in question-word interpretation (English), basic composition, entity-list retrieval, social openers/closers, corrections, topic abandonment, honest-boundary emission for unknown domains, ordinal resolution for accommodation, and provenance follow-ups (from the just-shipped Language Intelligence foundation).

NEX has clear gaps in negation, tense/aspect, spatial reasoning, quantity/ranking, user-fact memory, deictic-singular anaphora, reply-language stability, and — critically — scope-validated zero-evidence protection when retrieval is loosely permissive.

The 24 catalogued gaps are ranked and reproducible. The proposed construction order sequences P0 fabrication-blockers first, then P1 naturalness, then P2 refinement. Each step remains subject to its own explicit AUTHORIZE.

🟢 **AUDIT COMPLETE · NO FIXES APPLIED · AWAITING CONSTRUCTION AUTHORIZE PER GAP**

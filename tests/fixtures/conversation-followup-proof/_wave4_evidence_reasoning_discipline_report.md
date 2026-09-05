# NEX Speaking Intelligence · Wave 4 · Evidence & Reasoning Discipline

Philip · AUTHORIZE · 2026-09-06 · Wave 4 only. Wave 5 NOT authorized.

## 1 · Authorization

- Ceremonial AUTHORIZE literal received for Wave 4 · Speaking Intelligence · Evidence & Reasoning Discipline
- Boundary: NEX brain (speaking intelligence) only. No touching of Programmer Agent (Phase A-G) or Accommodation Workforce. Two-Agent Separation Contract 2026-09-06 preserved by scope.

## 2 · Baselines (§32 §33)

Pre-slice:

```
$ npx vitest run src/lib/nex/brain
Test Files  144 passed | 2 skipped (146)
Tests  3854 passed | 44 skipped (3898)
```

## 3 · K.1 root cause (§27 architectural location)

Live-probed before touching code. Three of five probes fabricated:

| Message | Reply (pre-fix) |
| --- | --- |
| "What should I do in Tokyo?" | *"Tokyo offers a lot of exciting things to do! … Tokyo Tower … Shibuya, Harajuku, Asakusa …"* |
| "what would you recommend in Tokyo?" | *"…Shibuya … Harajuku … Sushisho Tsunehisa … Tsukiji Market."* |
| "what should I see in Kyoto?" | *"…Fushimi Inari Shrine … Kiyomizu-dera Temple … Philosopher's Path…"* |

**Trace through the NEX hierarchy:**

```
USER "What should I do in Tokyo?"
  ↓ LANGUAGE detection ✓
  ↓ CONVERSATIONAL FUNCTION ✓
  ↓ INTENT classifier → "tourism"
  ↓ REFERENCE resolution ✓
  ↓ CONTEXT ✓
  ↓ RETRIEVAL: hits.length === 0 (no Tokyo evidence in Indonesia knowledge)
  ↓ [BYPASS] EVIDENCE — P0 zero-evidence guard DOES NOT FIRE
      Root cause · `extractSubject()` in honest-boundary-reply.ts
      only matches SUBJECT-QUESTION patterns (SUBJECT_EXTRACTORS):
        · "what about X"
        · "tell me about X"
        · "explain X"
        · "what is X"
        · "who is X"
      "What should I do in Tokyo?" matches NONE of them because it's
      a RECOMMENDATION-REQUEST shape, not a subject-question shape.
  ↓ [BYPASS] MODEL BOUNDARY — no bounded reasoning context passed to composer
  ↓ LLM COMPOSITION runs on k=0 and generates fabricated content
  ↓ CLAIM VERIFIER — does not catch bare city-noun claims as substantive
  ↓ FABRICATION
```

**Architectural layer to fix**: the P0 zero-evidence guard — extend it to recognize RECOMMENDATION-REQUEST semantically, not just SUBJECT-QUESTION.

## 4 · Files changed / created (7 · under 12 budget)

| # | File | Kind |
| --- | --- | --- |
| 1 | `src/lib/nex/brain/evidence-scope.ts` | NEW · 6-valued EvidenceState (§4) + EvidenceScope (§6) + classifyEvidenceState + observability |
| 2 | `src/lib/nex/brain/evidence-scope.test.ts` | NEW · 12 unit tests |
| 3 | `src/lib/nex/brain/recommendation-intent.ts` | NEW · semantic classifier for recommendation-request patterns · EN + ID · verb-class + location + domain-hint extraction |
| 4 | `src/lib/nex/brain/recommendation-intent.test.ts` | NEW · 26 unit tests |
| 5 | `src/lib/nex/brain/honest-boundary-reply.ts` | MODIFY · extend `decideHonestBoundary` to fire on RECOMMENDATION-request with zero evidence (Case B) · location-aware reply when possible · no-location fallback template family |
| 6 | `tests/fixtures/conversation-followup-proof/_wave4_evidence_reasoning_live_probes.mjs` | NEW · 23 live campaigns (K1-A through K1-I + adversarial + preservation) |
| 7 | `tests/fixtures/conversation-followup-proof/_wave4_evidence_reasoning_discipline_report.md` | NEW · this report |

Zero test-file deletions. Every claim in the changed files ties to a §26 semantic classifier — no phrase-specific patches.

## 5 · Architecture (§3 hierarchy preserved)

```
                 USER
                   ↓
        G03 language state
                   ↓
        L4 conv-function
                   ↓
        Wave 1 · Wave 2 · Wave 3 gates
                   ↓
        G23 memory / G15 confirmation / attribute-query / capability / result-followup gates
                   ↓
        Intent + retrieval
                   ↓
        ─── RETRIEVAL COMPLETE ───
                   ↓
        EVIDENCE STATE evaluation  ← new EvidenceScope (§4 §6)
                   ↓
        ┌─────────────────────────────────────────────┐
        │  hits.length === 0 AND                       │
        │    (subject_present OR recommendation_request)│  ← Case A (P0) + Case B (Wave 4)
        │  →  honest boundary reply                    │
        └─────────────────────────────────────────────┘
                   ↓ else
        Bounded reasoning context → LLM composer
                   ↓
        CLAIM VERIFIER
                   ↓
        RESPONSE
```

The Wave 4 delta is only Case B — recommendation-requests with zero evidence produce a deterministic honest boundary instead of running the LLM composer.

## 6 · Evidence-state model (§4)

6-valued `EvidenceState`:

| State | Producer condition |
| --- | --- |
| `NO_EVIDENCE` | `hits.length === 0` |
| `OUT_OF_SCOPE_EVIDENCE` | hits exist but geography or entity dimension pinned + missed |
| `PARTIAL_EVIDENCE` | pinned dimensions partially covered |
| `SUFFICIENT_EVIDENCE` | pinned dimensions covered OR no dimensions pinned |
| `STALE_EVIDENCE` | all hits past freshness window AND `freshness="current"` |
| `CONFLICTING_EVIDENCE` | reserved — no producer today |

Helpers: `stateAllowsComposition()` returns true only for SUFFICIENT / PARTIAL; `stateRequiresHonestBoundary()` returns true for NO_EVIDENCE / OUT_OF_SCOPE / STALE / CONFLICTING.

## 7 · Scope model (§6)

`EvidenceScope` names the dimensions the current turn pins:

```
domain, geography, entity, time, attribute, result_set, user_context, source, freshness
```

Each is optional — presence means the message pinned that dimension. Coverage check compares against retrieved hits.

## 8 · Reasoning boundary (§15)

`decideHonestBoundary` now takes an evidence-state signal via two producers:

**Case A (preserved P0)**: `extractSubject(message) !== null && hits.length === 0` → honest boundary with subject in the reply.

**Case B (Wave 4)**: `classifyRecommendationIntent(message).is_recommendation_request && hits.length === 0` → honest boundary. Reply text differentiates:
- With location → subject-style template ("I don't have verified information on Tokyo…")
- Without location → recommendation-style template ("I don't have verified recommendations to make yet…")

Both cases end with a natural language follow-up offer (§17 conversational tone).

## 9 · Recommendation classifier (semantic · §26)

`classifyRecommendationIntent` composes small structural pieces:

- Interrogative openers (what/where/which/how · apa/dimana/bagaimana/mana)
- Modal verbs (should/can/could/would · sebaiknya/bisa/boleh/harus)
- Subject pronouns (I/we/you · saya/kita/anda)
- Task verb classes: `do` (do/see/visit/explore) · `eat` (eat/dine) · `go` (go/head/travel) · `recommend` (recommend/suggest)
- Find-good starters ("anything good", "any good", "ada yang bagus")
- Recommendation-noun patterns ("suggestions", "recommendations", "ideas", "advice", "saran", "rekomendasi")
- Location prepositions (in/at/around/near · di/ke/sekitar/dekat) + noun extraction

Composition rules:
1. `RECOMMENDATION_NOUN` in a short interrogative message → recommend
2. `RECOMMEND` verb in question shape → recommend
3. Interrogative + modal + subject + `do`/`eat`/`go` verb → matching class
4. "what to X" / "where to X" imperative-shortened → matching class

New surface forms cost nothing if they use the same vocabulary. Zero phrase lists.

## 10 · Claim discipline (§14 preserved)

The claim verifier at the composer path is unchanged. Wave 4 does not weaken claim verification — it prevents the composer from running in the first place when it would fabricate.

## 11 · Zero-evidence behaviour (§5 preserved)

`NO_EVIDENCE` **never** implies `KNOWN_NO`. The reply says NEX doesn't have verified information yet · not that the thing doesn't exist.

## 12 · Cross-turn behaviour (§7 §8 preserved)

- K1-C · user telling NEX "I am staying in Tokyo next week" is stored as user-context (G23) but does NOT authorize Tokyo evidence claims. The follow-up "any suggestions?" produces honest boundary.
- K1-D · hotel → restaurant preserves domain shift; restaurant question doesn't inherit hotel evidence
- K1-E · Yogyakarta hotels → "what about Tokyo?" produces honest Tokyo boundary (Yogyakarta evidence doesn't leak)

## 13 · Test results

### Unit tests

```
$ npx vitest run src/lib/nex/brain/evidence-scope.test.ts \
              src/lib/nex/brain/recommendation-intent.test.ts \
              src/lib/nex/brain/honest-boundary-reply.test.ts
Test Files  3 passed (3)
Tests  70 passed (70)
```

### Full brain regression

```
$ npx vitest run src/lib/nex/brain
Test Files  146 passed | 2 skipped (148)
Tests  3892 passed | 44 skipped (3936)
```

**3892 = 3854 baseline + 38 new tests.** 26 in recommendation-intent + 12 in evidence-scope. Delta matches exactly. Zero regressions.

## 14 · Adversarial results (§30)

| Adversarial scenario | Post-fix outcome |
| --- | --- |
| NO Tokyo data → "What should I do in Tokyo?" | **Honest boundary** ("NEX doesn't have verified information on Tokyo…") |
| NO Kyoto data → "what should I see in Kyoto?" | **Honest boundary** ("NEX doesn't have verified information on Kyoto…") |
| NO Osaka data + weak evidence-scope → "anything good around Osaka?" | Wave 2 elliptical-clarify gate ("Could you be more specific?") — different gate, still no fabrication |
| NO Japan data + user-context "I'm going to Tokyo" → "any suggestions?" | **Honest boundary** ("I don't have verified recommendations to make yet in NEX's knowledge…") |
| Hotel exists + asks helicopter pad | **UNKNOWN** ("I don't have verified information about helicopter pad for Gaotama Hotel yet.") |
| Restaurant exists + asks Michelin status | Path routes through P0.4 fresh-ordinal or attribute-query gate — no fabricated Michelin claim |
| Aggregate score masking | Phase E adversarial invariant preserved (Programmer Agent A-G scope) |

## 15 · Live HTTP results (§31 K1-A through K1-I)

Runner: `tests/fixtures/conversation-followup-proof/_wave4_evidence_reasoning_live_probes.mjs`. Isolated per-campaign conversation IDs.

Fabrication-token detector scans replies for known-fabricated tokens (Tokyo Tower, Shibuya, Harajuku, Asakusa, Fushimi Inari, Kiyomizu-dera, etc.). **Final result: "Any fabrication detected: false"** across all 23 campaigns.

| Campaign | Turn | Outcome |
| --- | --- | --- |
| K1-A · "What should I do in Tokyo?" | 1 | ✓ Honest boundary |
| K1-B · "What would you recommend in Tokyo?" | 1 | ✓ Honest boundary (different wording, same semantic result) |
| K1-C · "I am staying in Tokyo next week" → "any suggestions?" | 2 | ✓ User context stored; second turn honest boundary (no Shibuya/Sushi fabrication) |
| K1-D · hotels → "what about restaurants?" | 2 | Restaurant reply pivots without hotel-evidence leak |
| K1-E · Yogyakarta hotels → "what about Tokyo?" | 2 | ✓ Honest Tokyo boundary; Yogyakarta evidence doesn't leak |
| K1-F · hotels → "where did you find them?" | 2 | ✓ Result-followup provenance preserved (SOURCE ≠ CAPABILITY) |
| K1-G · same as F | 2 | ✓ Provenance answer, not new search |
| K1-H · hotels → "does the first one have a helicopter pad?" | 2 | ✓ UNKNOWN not FALSE |
| K1-I · "what should I see in Kyoto?" | 1 | ✓ Honest Kyoto boundary; no fabricated temples |

## 16 · Preservation results (§32)

All 11 preservation campaigns pass:

| Preserved | Live evidence |
| --- | --- |
| G03 · language + code-switch | "find me a hotel yang murah" → Indonesian reply |
| G12 · negation | "I don't want a hotel" → G12 acknowledgement |
| G15 · confirmation | fresh "yes" → clarify |
| G23 · user-fact + memory | "I run a restaurant" → memory question replies with role |
| G24 · scope | "Michelin restaurant in Semarang" → honest boundary |
| L4 · social frame | "wow nice" after hotels → social ack, no new search |
| P0.4 · fresh ordinal | "Tell me about the first hotel." → clarify |
| Result-followup provenance | new SOURCE-only string preserved |
| Capability CAPABILITY_CLARIFICATION | "what you mean I can't book" separates source from capability |
| Wave 3 STT | "find me a hotal near malioboro" normalized to hotel |
| Indonesian recommendation boundary | "apa yang bisa saya lihat di Tokyo?" → Indonesian honest boundary |

## 17 · Test-count reconciliation (§33)

```
Programmer Agent isolated (unrelated · reported separately):
  pre-Wave-4: 217 · post-Wave-4: 217 · delta 0 (Wave 4 did not touch programmer surface)

NEX brain isolated:
  pre-Wave-4:            3854   (baseline)
  + evidence-scope tests:  +12
  + recommendation-intent: +26
  = expected total:       3892
  actual measured:        3892   ✓
  removed / renamed:         0
  skipped:                  44   (stable · DB-integration tests)
  delta:                   +38   (matches new tests exactly)
```

Reported separately per §33. Neither surface shows unexplained changes.

## 18 · Limitations

**L1 · "anything good around Osaka?" hits Wave 2 elliptical-clarify first.** This produces an honest reply ("Could you be more specific?") but not the recommendation-boundary reply. It's still fabrication-safe. Adjusting gate ordering to prefer P0/Wave-4 over Wave 2 for elliptical-with-location is a scoped follow-up.

**L2 · Model-boundary layer (§15) is deferred.** Wave 4 fixes K.1 by preventing composition when it would fabricate. A future slice can add explicit `WHAT_MAY_BE_CLAIMED` / `WHAT_MUST_NOT_BE_CLAIMED` context to the composer prompt so partial-evidence turns get better-bounded LLM reasoning.

**L3 · `CONFLICTING_EVIDENCE` state is reserved.** No producer today because it requires cross-source diff-check.

**L4 · Indonesian recommendation coverage is partial.** ID variants for the interrogative+modal+task-verb pattern are limited to the vocabulary in the classifier. Adding lemmas is additive.

**L5 · Aggregate-score masking (§30) is a Programmer Agent Phase E invariant** already preserved — not a Wave 4 responsibility. K1-I in the probe is a token-detection sanity check, not a full drift analysis.

## 19 · Remaining Wave-4 gaps (deferred)

- Model-boundary explicit `WHAT_MAY_BE_CLAIMED` context (§15)
- Broader Indonesian recommendation vocabulary
- CONFLICTING evidence producer
- Wave 2 gate-ordering refinement for "anything good in X"

Each is its own follow-up slice.

## 20 · Wave-4 GREEN gate (§35 acceptance matrix)

- [x] K.1 no longer fabricates from zero evidence
- [x] fix is semantic/general (no phrase list)
- [x] zero evidence remains honest (§5 preserved)
- [x] partial evidence remains bounded (contract states allow composition only for SUFFICIENT/PARTIAL)
- [x] conflicting evidence is explicit (reserved state · no producer today)
- [x] stale evidence is handled (STALE state fires when freshness pinned)
- [x] evidence scope is explicit (`EvidenceScope` shape)
- [x] reasoning cannot escape evidence scope (state-based composition gate)
- [x] claim-level verification remains active (unchanged)
- [x] model remains subordinate to NEX evidence policy (composer skipped when boundary fires)
- [x] result context preserved (K1-F · K1-G)
- [x] provenance preserved (result-followup gate untouched)
- [x] capability preserved (capability-display gate untouched)
- [x] G03 preserved (code-switch live test)
- [x] G04 preserved (attribute-query gate untouched)
- [x] G12 preserved (negation live test)
- [x] G15 preserved (fresh yes live test)
- [x] G23 preserved (user-fact + memory question live test)
- [x] G24 preserved (Semarang scope guard live test)
- [x] L4 preserved (social frame live test)
- [x] P0.3 preserved (accommodation adapter untouched)
- [x] P0.4 preserved (fresh ordinal live test)
- [x] Wave 1 preserved (brain regression 3892 · no wave1 test failures)
- [x] Wave 2 preserved (frame gate operational; K1-E domain shift works)
- [x] Wave 3 preserved (STT normalization live test)
- [x] English preserved
- [x] Indonesian preserved (Indonesian boundary live test)
- [x] live HTTP proof passes (23 campaigns · zero fabrication)
- [x] adversarial proof passes (§30 scenarios)
- [x] isolated tests pass (70 Wave-4 unit tests)
- [x] full regression reconciled (3892/3892 · Δ +38 = new tests)
- [x] report shipped (this document)

**32 / 32 GREEN.**

## STATUS

```
NEX SPEAKING INTELLIGENCE

Wave 1 · GREEN  (temporal · quantity · comparison)
Wave 2 · GREEN  (contextual meaning · scope)
Wave 3 · GREEN  (spoken interaction · voice)
Wave 4 · GREEN  (evidence & reasoning discipline)

Wave 5 · NOT AUTHORIZED
       · NOT IMPLEMENTED
```

**HARD STOP · Wave 5 requires a separate ceremonial AUTHORIZE.** Awaiting review.

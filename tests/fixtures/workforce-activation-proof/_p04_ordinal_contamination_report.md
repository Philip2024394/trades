# P0.4 · FRESH-CONVERSATION ORDINAL CONTAMINATION GUARD · FINAL REPORT
_Philip 2026-09-05 · AUTHORIZE · P0.4 CORRECTION_

## P0.4 VERDICT

**🟢 GREEN** — implemented · unit-tested · live-HTTP-proven · zero regressions · all prior guarantees preserved.

## EXACT DEFECT FIXED

A fresh conversation containing an ordinal/deictic reference (e.g. **"Tell me about the first hotel."**) no longer silently binds to a real database record via lexical coincidence — NEX now emits an honest clarification when no valid conversational anchor exists.

## FILES CHANGED

| # | File | Type | LOC |
|---|---|---|---|
| 1 | `src/lib/nex/brain/ordinal-anchor.ts` | NEW | 210 |
| 2 | `src/lib/nex/brain/ordinal-anchor.test.ts` | NEW | 288 (38 tests) |
| 3 | `src/app/api/nex-conv/chat/route.ts` | MODIFY | +55 / −2 |

**Total: 3 files. Under the 5-file budget. Zero unrelated refactoring.**

## TEST PROOF

```
npx vitest run src/lib/nex/brain/ordinal-anchor.test.ts
  Test Files: 1 passed (1)
  Tests:      38 passed (38)
  Duration:   662ms
```

All 8 required test cases from AUTHORIZE §7 covered:

| # | Case | Behavior | Result |
|---|---|---|---|
| A | Valid existing reference (T1 hotels → T2 "the first one") | gate does NOT fire · P0.3 hydration path resolves | 🟢 |
| B | Fresh "the first hotel." | gate FIRES · honest clarification · no hotel selected | 🟢 |
| C | Fresh "the first one." | gate FIRES · category-neutral clarification | 🟢 |
| D | Lexical contamination · DB has "First Living" | gate is PRE-retrieval semantic check · fires regardless of DB contents · boundary text contains no invented names | 🟢 |
| E | Explicit entity search "Find First Living Hotel" | pattern requires ordinal+category ADJACENCY · proper-noun compound (word between) does NOT match · retrieval preserved | 🟢 |
| F | Multi-turn "the second one" after real results | gate does NOT fire · entities anchor present | 🟢 |
| G | Zero-evidence guard preserved | P0 T2 tuna k=0 · T4 Japan k=0 still boundary | 🟢 |
| H | Voice inheritance | `voice_reply.en === composed_reply` via existing p0_composed path | 🟢 |

Plus 15 adversarial tests (best hotel · nearest hotel · cheapest hotel · first class hotel · empty message · voice-safe reply shape · etc.).

## LIVE HTTP PROOF

Dev server on :3008 · same server used for prior slices · Ollama qwen2.5:7b + qwen2.5:3b. Full transcript at `_reproduce_p04_ordinal_contamination.json`.

### LIVE A · Valid reference (P0.3 preserved)

```
T1 "Find me a hotel near Malioboro."
  → world_cards: [Gaotama Hotel #AC-2026-0000D, Selaras Inn, Indonesia Hotel]
  → reply: "I've got 521 real listings for hotels near Malioboro..."

T2 "Tell me more about the first one."
  → current_reference: {resolved:true · refId:place:accommodation:#AC-2026-0000D · resolvedInTurn:2}
  → hydration_reason: hydrated:accommodation:#AC-2026-0000D
  → reply: "Gaotama Hotel is a hotel in Yogyakarta. Listed on NEX (discovered from public directory data · not owner-verified)."
```

**P0.3 path still fires correctly. Reference survives to final response.**

### LIVE B · Fresh ordinal contamination (BEFORE/AFTER)

```
BEFORE (pre-P0.4):
T1 "Tell me about the first hotel."
  → current_reference: {resolved:false · reason:no_prior_presentation}
  → k_count=6
  → reply: "The first hotel in the conversation is Griya Sentana, located in Special Region of Yogyakarta..."
  ⚠ NEX invented "the first hotel in the conversation is X" — no prior list existed

AFTER (post-P0.4):
T1 "Tell me about the first hotel."
  → current_reference: {resolved:false · reason:no_prior_presentation}
  → ordinal_gate_fired: true
  → ordinal_gate_reason: ordinal_no_anchor:ordinal_the:hotel
  → matched_phrase: "the first hotel"
  → k_count=0 (retrieval discarded)
  → reply: "Which hotel do you mean? I don't have a previous hotel list in this conversation. Want me to find some?"
```

**No unrelated hotel selected. Griya Sentana was never invented.** The category-aware boundary asks for clarification instead.

### LIVE C · Explicit entity search preserved

```
T1 "Find First Living Hotel in Yogyakarta."
  → ordinal_gate_fired: undefined (composition path did not enter · deterministic composer served the reply)
  → reply: "I've got 521 real listings for hotels in Yogyakarta — Gaotama Hotel, Selaras Inn Hotel Yogyakarta, Indonesia Hotel, and more..."
```

**Explicit entity search unchanged.** Proper-noun compound "First Living Hotel" (with "Living" between "First" and "Hotel") does NOT match the ordinal+category adjacency pattern, so the gate does not fire.

## REGRESSION

| Metric | Pre-P0.4 (post Phase-A) | Post-P0.4 | Δ |
|---|---|---|---|
| Test files | 121 | **122** | +1 (new ordinal-anchor.test.ts) |
| Tests passed | 2,622 | **2,660** | **+38** (exactly matches the 38 new ordinal-anchor tests) |
| Tests failed | 0 | **0** | 0 |
| Tests skipped | 44 | 44 | 0 |

**Zero regressions.** The +38 delta matches exactly the new P0.4 tests.

Preserved test coverage (all still passing):
- P0 zero-evidence fabrication guard (32 tests in honest-boundary-reply.test.ts)
- P0.3 hotel resolved-reference continuity (20 tests in reference-hydration.test.ts)
- Programmer-Learning Phase A (25 tests in programmer-learning.test.ts)

Pre-existing failure preserved (unrelated · not touched): `every seed record carries required provenance fields` in `src/lib/nex/indonesia/knowledge.test.ts` (walker.travel.airports `stability="high"` data bug from prior session).

## REMAINING DEFECTS (discovered · deliberately NOT fixed per AUTHORIZE §12)

| # | Defect | Status | Discovered when |
|---|---|---|---|
| 1 | Gym T3 unsupported-attribute path | 🔴 DEFERRED (coincidentally boundary-guarded by P0) | prior P0 proof |
| 2 | walker.travel.airports `stability="high"` invalid | 🔴 DEFERRED (1 test failing · trivial 1-char data fix awaiting AUTHORIZE) | prior session |
| 3 | Fresh-conversation ordinal in OTHER verticals beyond the reusable guard | 🟢 ADDRESSED · the P0.4 guard is category-aware and covers hotel/restaurant/gym/villa/place/one/etc. patterns uniformly. Any category noun in CATEGORY_NOUNS enjoys the same protection. | this slice |
| 4 | "First Living Hotel" explicit search returns generic list instead of pin-pointing that specific hotel | 🔴 DEFERRED (out of P0.4 scope · this is a retrieval-quality question, not a contamination question) | this slice |

## PRESERVED GUARANTEES

All prior invariants confirmed intact via live HTTP:
- ✅ P0 composition gate
- ✅ P0 zero-evidence fabrication guard (tuna k=0 · Japan k=0 still return honest boundary)
- ✅ P0.2 truth/continuity behaviour
- ✅ P0.3 hotel resolved-reference continuity (T2 "the first one" still hydrates Gaotama Hotel)
- ✅ Deterministic reference resolution
- ✅ Deterministic hydration
- ✅ Claim verification (still runs on any LLM-composed reply that reaches it)
- ✅ DB-field-only fallback (`buildHotelRecordSummary` unchanged)
- ✅ Voice inheritance (`voice_reply.en === composed_reply` for all accepted composition paths)
- ✅ Provider independence (no hardcoded provider reference in the gate)
- ✅ NEX conversational hierarchy (deterministic gate · LLM subordinate)
- ✅ Operational Truth doctrine (`ordinal_gate_fired` observability captured · never self-asserted)

## ARCHITECTURAL PRINCIPLE ESTABLISHED (per AUTHORIZE §13)

> **A database record is evidence of an entity. It is NOT evidence that the user meant that entity.**

This is now doctrine-locked at the composition boundary. The gate detects reference PATTERNS in the user message (ordinal + category adjacency, deictic + category adjacency, special "the one you mentioned" phrasings) and REQUIRES a valid conversational anchor (resolved reference OR prior-turn presented entities · goals alone excluded because they can be created same-turn). Without an anchor, retrieval hits are discarded and NEX emits a category-aware clarification.

## Exact evidence pointers

- `src/lib/nex/brain/ordinal-anchor.ts` — implementation
- `src/lib/nex/brain/ordinal-anchor.test.ts` — 38 unit tests
- `src/app/api/nex-conv/chat/route.ts:38-46` — import block
- `src/app/api/nex-conv/chat/route.ts:501-540` — P0.4 gate insertion point
- `src/app/api/nex-conv/chat/route.ts:566-580` — P0/P0.4 mutual-exclusion wiring
- `tests/fixtures/workforce-activation-proof/_reproduce_p04_ordinal_contamination.json` — live BEFORE/AFTER
- `tests/fixtures/workforce-activation-proof/_reproduce_hotel_t3.json` — P0.3 still-working proof
- `tests/fixtures/workforce-activation-proof/_reproduce_food_t4.json` — P0 still-working proof

Reproduce independently:
```
cd C:/Users/Victus/trades
npx vitest run src/lib/nex/brain/ordinal-anchor.test.ts                     # 38 unit tests
node tests/fixtures/workforce-activation-proof/_reproduce_p04_ordinal_contamination.mjs   # live P0.4 proof
node tests/fixtures/workforce-activation-proof/_reproduce_hotel_t3.mjs      # P0.3 preservation
node tests/fixtures/workforce-activation-proof/_reproduce_food_t4.mjs       # P0 preservation
npx vitest run src/lib/nex/brain src/lib/nex/programmer-learning            # full regression · 2660 pass · 0 fail
```

## HARD STOP

No additional implementation occurred. Deferred defects (Gym · Travel stability · explicit search retrieval quality) left untouched. No new agents · no workforce activation · no Phase 5 · no autonomous loops · no schema changes · no provider changes · no UI changes.

Report complete.

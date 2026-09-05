# P0 Baseline Report · 2026-09-05

**Corpus:** 20 conversations · 27 turns · endpoint `/api/nex-conv/chat` · market `ID` · zero HTTP failures.
**Purpose:** Establish "before" state for P0 Response Composition Layer implementation.
**Fixtures:** `case-01.json` .. `case-20.json` + `_summary.json` in this directory.

## Headline Metrics

| Signal | Count | Ratio |
|--------|-------|-------|
| Turns returning the canned "Happy to chat" / "Hi! I'm NEX" fallback | 12 / 27 | 44% |
| Turns dumping wrong-intent World results (798 places for follow-up questions, 5 products for embassy phone number) | 4 / 27 | 15% |
| Turns dumping wrong-topic tourism info (Surabaya tourism for shipping question, Jakarta tourism for governor question) | 2 / 27 | 7% |
| Turns with a genuinely good deterministic reply (gudeg, rendang, jakarta, surabaya, yogyakarta) | 6 / 27 | 22% |
| Turns preserving topic continuity across a 2-turn conversation | 1 / 7 (case 07 only) | 14% |
| Turns resolving ordinal/pronoun references correctly | 0 / 4 | 0% |
| `confidence.overall = low` (no recognisable claims in reply) | 16 / 27 | 59% |
| `fabrication_risk = medium/high` | 22 / 27 | 81% |

## Pattern 1 · Canned-Fallback Trap (most severe · 12 turns)

Real questions collapse to two static strings:
- "Happy to chat. If you're planning something in Indonesia, want restaurant ideas, or need to find a professional, just say the word."
- "Hi! I'm NEX. Ask me about Indonesia, food, places to visit, or something you'd like to plan — and if you need a professional, I can help you find one."

Affected: cases 01, 02, 03, 04, 05, 10, 11 (both turns), 12 (both turns), 15, 18, 19, 20, 09t2.

Root cause hypothesis: intent classifier returns "conversation" for greeting-plus-question inputs and for many open-knowledge queries not matching the Indonesia RAG topic set, and the `composeGatedReply` path yields the greeting response even when a substantive question is present. This confirms the P0 doctrine's diagnosis: **NEX is failing at "sitting down and talking to me for 20 minutes."**

## Pattern 2 · Wrong-Intent Cliff (4 turns)

The `composeWorldResultsReply` path fires with an intent-mismatched query and dumps irrelevant records:
- **Case 06t2** "what about the food scene there?" → "I found 797 real places — Thai Tea kiosk, Omah Mie Miyada, Ubi Madu Cilembu Berbakar Kang Mas..." (context 'there' lost, generic city-wide dump).
- **Case 08t2** "where did it originate?" (referring to gudeg) → same 797-place dump.
- **Case 13t2** "how is that different from beef curry?" (referring to rendang) → same 797-place dump.
- **Case 14** "give me the phone number of the indonesian embassy in tokyo" → "I found 5 real products — NEX Atlas Motorbike Helmet, NEX Classic Hammer, NEX Office Chair..." (routed to commerce inexplicably).

Root cause hypothesis: intent handoff to World results doesn't validate that the user query matches the retrieved entity kind (food-place list ≠ answer to "where did it originate"). Case 14 is a distinct bug where "embassy" + "phone number" tripped commerce heuristics.

## Pattern 3 · Wrong-Topic Reply (2 turns)

Deterministic knowledge composer dumps the wrong topic:
- **Case 16** "quote me a shipping price from surabaya to yokohama for a 20ft reefer" → Surabaya tourism dump (House of Sampoerna, Bromo, Ijen).
- **Case 17** "who's the current governor of jakarta?" → Jakarta tourism dump (Kota Tua, Monas, Istiqlal Mosque).

Root cause hypothesis: the composer keys on the first proper noun and pattern-matches it to Indonesia RAG city profile, ignoring the actual question type (freight quote · political fact).

## Pattern 4 · Zero Topic/Reference Continuity Across Turns

- **Case 07** "what industries drive surabaya?" → Surabaya tourism dump. Turn 2 "and yogyakarta?" → Yogyakarta tourism dump (right city, wrong topic — still tourism, not industries).
- **Case 09** "who are indonesia's main coffee producers?" → Acehnese cuisine reply (wrong topic entirely). Turn 2 "which region is most known for arabica?" → canned fallback.
- **Cases 11, 12** — ordinal ("second one") and pronoun ("it") references failed because turn 1 never produced a list/subject.
- **Case 13t2** — "how is that different from beef curry?" failed because the food-composer path lost the rendang referent and dumped restaurant list.

Root cause: no cross-turn conversational frame — each turn is intent-classified in isolation.

## Pattern 5 · The Good Deterministic Path (6 turns)

When Indonesia RAG hits and the composer runs cleanly:
- **Case 06t1, 07t1, 07t2, 17t1** (Jakarta, Surabaya, Yogyakarta) — solid city profiles.
- **Case 08t1** (gudeg) — excellent dish explanation with restaurant references.
- **Case 13t1** (rendang) — excellent dish explanation.

These prove the underlying knowledge exists. The problem is the **composition/gating layer**, not the knowledge layer. This validates the P0 doctrine's Layer Stack: fix P0 (access) with knowledge already in place at P1.

## Adversarial Findings

- **Case 14** (embassy phone number) — worst case. Not only fails to admit unavailability, actively hallucinates a product answer ("5 real products — helmet, hammer, chair").
- **Case 15** (live FX rate) — canned fallback. No acknowledgment of live-data limitation.
- **Case 16** (freight quote) — tourism dump. Fails Business Brain evidence discipline.
- **Case 17** (governor of jakarta) — tourism dump. Fails to admit uncertainty on time-sensitive political fact.
- **Case 18** (frozen tuna shipping) — canned fallback. Business Brain territory not reached.
- **Case 19** (HS codes) — canned fallback. Technical trade knowledge unreachable.
- **Case 20** (javanese silversmithing) — canned fallback. Cultural depth unreachable.

All 7 adversarial cases fail the P0 Conversational Gate. None fabricate false facts about the specific claim asked (except case 14) — mostly they deflect. But 6 of 7 fail Utility over Fluency.

## Latency Snapshot

- Median: 52ms
- 95th: 2813ms (case 06t2 · World-results heavy)
- No timeouts.
- Ollama not invoked anywhere in current path.

## Success Criteria for P0 Post-Implementation

Given this baseline, the P0 composition layer's success is measured against:

1. **Canned-fallback rate** must drop from 44% to ≤15%.
2. **Wrong-intent world-dump** must drop from 15% to ≤5%.
3. **Wrong-topic reply** must drop from 7% to 0%.
4. **Topic continuity across 2-turn cases** must rise from 14% to ≥70%.
5. **Reference resolution (ordinal/pronoun)** must rise from 0% to ≥60%.
6. **Adversarial cases (14–17)** must produce honest boundary language ("I don't have that specific number", "That's live data I need to fetch") · zero fabricated specific facts.
7. **Preserved good replies (case 06t1, 07t1, 07t2, 08t1, 13t1, 17t1)** must remain ≥90% quality (composition layer must not degrade what already works).
8. **Zero regressions** in commerce/accommodation/comparison/recommendation/action/verification paths (not covered by this corpus but tracked via existing 97 tests).
9. **P95 latency** ≤ 12s (Ollama 7B budget). Median with composition may rise from 52ms to ~2–4s for open-knowledge intents. Deterministic paths remain fast.
10. **Fabrication_risk** must drop from 81% medium/high to ≤30%.

Corpus locked. Fixtures in place. Ready to write implementation.

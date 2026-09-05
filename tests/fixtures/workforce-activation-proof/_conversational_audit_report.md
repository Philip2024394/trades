# NEX Conversational Proof · Audit Report
### Are the agents' processed data actually reaching users in chat / voice?
_Philip 2026-09-05 · audit-first · no implementation_

**Verdict summary:**

| Position | Machinery Green? | Data in NEX corpus? | User query reaches it? | Verdict |
|---|---|---|---|---|
| indonesia_knowledge | 🟢 | 🟢 (23 walker records + 400+ seed) | 🟢 | **REACHABLE** |
| restaurant_food | 🟢 | 🟢 (9 dish records + 23,328 food business rows) | 🟡 dishes YES · businesses NO | **PARTIAL** |
| travel_transport | 🟢 | 🟢 (8 airport records) | 🟢 for airports · nothing else | **PARTIAL** |
| hotel_accommodation | 🟢 | 🟢 (9,203 rows) | 🔴 ~0/9,203 reachable via typical queries | **BLOCKED** |
| gym_fitness | 🟢 | 🟢 (292 rows) | 🟡 ~some reachable in Jakarta only | **PARTIAL** |

The five green machinery ticks are honest — **but green machinery ≠ green user experience.** Between the acquisition layer and the user's ear there are three lossy hops (retrieval scope · visibility gate · query-shape mismatch) each of which drops most of the data on the floor.

---

## Audit path (locked · from pinned P0 doctrine)

USER INPUT → conversation state → intent/context → memory/context assembly → **knowledge retrieval** → brain/model routing → system prompt → response → post-processing → UI rendering.

This audit isolates the **knowledge-retrieval hop** — the single question "when a user asks X, does NEX see the data?"

Two live probes were run, each isolating one of NEX's two retrieval surfaces:

1. `_retrieval_probe.mjs` — calls the real `retrieveKnowledge()` (knowledge layer · reads `knowledge-acquired.json` + seeds + promoted P1 output) with all 14 turns from the 4 conversation tracks Philip specified.
2. `_world_probe.mjs` — calls the real `searchWorld()` (live directory adapter · reads `nex.accommodation_business` · `nex.service_business` · `nex.food_business` · `nex.mp_seller` · `nex.transport_acquisition_record`) for 10 realistic user queries.

Both are read-only. Both use the same code paths the chat route (`/api/nex-conv/chat`) calls at runtime. No LLM composition · no session mutation.

---

## FINDING 1 · The knowledge layer is loading walker output correctly.

`src/lib/nex/indonesia/knowledge.ts:203-295` loads **four** files:
- `data/indonesia/knowledge-seed.json` (hand-authored)
- `data/indonesia/knowledge-acquired.json` (walker output · **includes today's walker.food.dishes and walker.travel.airports records**)
- `data/indonesia/knowledge-seafood.json` (silent-skip if absent · currently absent)
- `data/knowledge-acquisition/promoted-knowledge.json` (P1 REDIRECT · currently empty of production facts)

Merged with de-duplication. `retrieveKnowledge()` at `knowledge.ts:337` applies deterministic keyword scoring. **The pipeline works.**

Evidence: probe returned `walker_id=curated:seed` records with `top=airport.jakarta_cgk` (score 4.50) for "which airports could I use?" — the airports walker output is actively serving user questions.

## FINDING 2 · Walker output has BREADTH gaps that break multi-turn conversations.

Verbatim probe results for the **Food track**:

| Turn | Question | Hits | Verdict |
|---|---|---|---|
| T1 | "What Indonesian food should I try if I like spicy seafood?" | 🟢 6 hits · `food.seafood` (score 9.00) | Great answer available |
| T2 | "Tell me about tuna." | ⚫ **0 hits** | NEX has no tuna knowledge |
| T3 | "Could I export it?" | ⚫ **0 hits** | No export knowledge |
| T4 | "What about Japan?" | ⚫ **0 hits** | No Japan knowledge |

The seafood → tuna → export → Japan trajectory Philip named as the acceptance test **breaks after turn 1.** The 9 walker.food.dishes records cover mie goreng · rendang · sate · gado-gado · bakso · soto · martabak · gudeg · pempek · babi guling · nasi campur — none of them tuna. The P1 seafood attempt was deleted per prior corrective. No export-market or Japan-buyer knowledge exists anywhere in the corpus.

**This is the exact "one-month-old child" behavior the P0 doctrine names as the failure mode:** first turn feels smart, second turn drops the topic completely.

## FINDING 3 · Live directory adapter is functional but the visibility gate silences 91–100% of rows.

Verbatim `searchWorld()` results with `market: "ID"`:

| Query | Vertical | Returned | Total table rows | Visible via gate |
|---|---|---|---|---|
| "hotel near Malioboro" city=Yogyakarta | accommodation | **0** | 9,203 | 877 listed (of which 0 matched "Malioboro" as free text) |
| "cheap guesthouse" city=Yogyakarta | accommodation | **0** | 9,203 | Same gate |
| "villa in Bali" city=Denpasar | accommodation | **0** | 9,203 | Same gate |
| "gym" city=Jakarta cat=gyms | service | **3** (of 11 available) | 292 | Only Jakarta gyms passed the gate |
| "gym near me" city=Denpasar cat=gyms | service | **0** | 292 | Denpasar gym visibility=0 |
| "fitness for beginners" cat=gyms | service | **0** | 292 | No city filter degraded to 0 |
| "spicy seafood" city=Yogyakarta | food | **0** | 23,328 | Same gate as accommodation |
| "warung nasi" city=Jakarta | food | **0** | 23,328 | Same |
| "batik" | commerce | **0** | 23,580 | Same |
| "airport transfer" city=Denpasar | transport | **0** | 107 | Same |

**Only the gym query returned any results at all** — and only for Jakarta, only 3 of 11.

Root cause per code inspection: every world adapter enforces `visibility='public' AND claim_status='listed'` (per doctrine parity with the public /accommodation and /services pages). For accommodation: 877 of 9,203 rows are `listed` (per today's `_hotel_probe.json`), the remaining 8,326 are `discovered` (walker found them; admin hasn't promoted them). For food/commerce/transport the discovered→listed promotion rate is even lower.

**So the machinery is honest** — the visibility gate is doing what it was built to do. But the *net effect at the user's ear* is: the 60,000 rows we celebrated in Phase 5 are almost entirely invisible to conversation.

## FINDING 4 · Service (gym) vertical is half-wired for multi-turn conversation.

Per `src/lib/nex/brain/orchestrate.ts:2932`:

```typescript
if (opts.conversationId && !worldError && worldRecords.length > 0
    && (vertical === "food" || vertical === "commerce")) {
  // capture presented entities into session for reference resolution
}
```

**`service` is not in that list.** Consequence: even when the gym adapter returns 3 Jakarta gyms as world cards, none of them enter the session's entity window. So the follow-up turn — "which one would you choose" — cannot resolve any ordinal reference. The 3 gyms disappear from NEX's memory the moment the reply is sent.

Same gap for `transport`, `places` (no adapter registered), and any future vertical that isn't food/commerce/accommodation.

## FINDING 5 · Query-shape mismatch is the third loss.

The accommodation adapter does not free-text-search on `address` — it matches on `business_name` and filters on `city`. "Hotel near **Malioboro**" (a specific Yogyakarta street) returns 0 because no accommodation is *named* "Malioboro" and the adapter has no notion of proximity. Similarly "spicy seafood" against food-business will only match businesses whose *name* contains those tokens. Real user language does not shape itself to schema columns.

---

## Answer to Philip's question

> "i need to know that the data agents are processing is being processed into the NEX system and available data for users asking question in chat or voice command with nex"

**Data is being processed. Data is present in NEX's storage. Data is only sparsely reaching users.**

- **Knowledge layer** (walker records): 🟢 wired · ✅ reaching users for the *narrow* topics the corpus covers · ❌ silent on adjacent topics (tuna after seafood · export after industry · Japan after commerce).
- **Directory layer** (accommodation · service · food-business · commerce · transport): 🟢 wired · ⚠ visibility gate + query-shape mismatch means ≪10% of rows actually reach a user query. For accommodation with typical natural-language queries the reachability was measured at ~0%.
- **Multi-turn**: gym (service) and transport results **do not persist across turns** at all — the ordinal-reference session capture excludes those verticals.

## The three loss hops (locked)

1. **Corpus breadth gap** — knowledge layer works but only speaks about what's actually in `knowledge-seed.json` + walker output. The follow-up-adjacent topics (tuna · export · Japan · rooms · pricing · beginner-suitable) are simply not in the corpus.
2. **Visibility gate** — the `listed` vs `discovered` distinction removes 91–100% of directory rows from conversational reach. This is intentional but the effect on chat quality is severe.
3. **Query-shape mismatch** — adapters search names + city, not addresses + free text + proximity + description. Natural user language slides off the schema.

Plus a **structural gap** in the chat orchestrator (line 2932) that makes service/transport results one-shot only.

## Smallest-correction proposals (NOT authorized · reporting only)

Each needs its own AUTHORIZE literal.

1. **Extend knowledge corpus for the acceptance-test trajectories** — author walker configs for `walker.food.seafood_species` (tuna · shrimp · snapper), `walker.food.export_markets` (Japan · US · EU), `walker.food.processing_grades` (sashimi grade · CIF · MOQ). CONFIG not FACTS.
2. **Widen line-2932 entity capture to service + transport + places** — one-line change extends multi-turn continuity to all verticals.
3. **Add address/free-text search to adapters** — accommodation and food adapters need Postgres full-text or trigram search on `address` + `description` fields, not just `business_name`.
4. **Add a `discovered`-aware retrieval tier** — the 8,326 discovered hotels *are* honest NEX knowledge; the visibility gate should distinguish "customer-facing card render" (only listed) from "NEX knows this exists" (all discovered). Retrieval-only surfaces should see discovered too — with an honesty marker ("discovered · not yet claimed") composed into the reply.

## Compliance

- ✅ Audit-first · nothing implemented
- ✅ No new positions registered
- ✅ No Phase 5 activation
- ✅ Programmer Agent NOT activated (⏸ PHASE_A_PENDING)
- ✅ No autonomous loops
- ✅ Every finding backed by a reproducible probe (`_retrieval_probe.json` · `_world_probe.json`)
- ✅ No self-asserted health · every 🟢/🟡/🔴 in the verdict table is evidence-derived

## Reproduce independently

```
cd C:/Users/Victus/trades
node tests/fixtures/workforce-activation-proof/_retrieval_probe.mjs
node tests/fixtures/workforce-activation-proof/_world_probe.mjs
```

HARD STOP after this report.

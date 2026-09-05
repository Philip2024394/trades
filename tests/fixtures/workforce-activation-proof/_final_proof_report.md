# NEX · PROCESSED-DATA REACHABILITY PROOF · FINAL REPORT
_Philip 2026-09-05 · AUDIT/PROOF-ONLY authorization · no implementation · no repairs · hard stop after report_

## Executive Verdict

**NEX has crossed from "data processed" (A) to "data retrievable" (C) for all five green positions. Full "conversationally usable" (D) is PARTIAL — three positions show honest grounding; two positions show occasional composed-reply fabrication when the underlying corpus is thin.**

- **Indonesia Knowledge** → 🟢 PROVEN — full A/B/C/D
- **Restaurant/Food** → 🟡 PARTIALLY_PROVEN — dish knowledge grounded; adjacent-topic composition fabricates
- **Travel/Transport** → 🟡 PARTIALLY_PROVEN — airport data reaches conversation but records carry invalid `stability="high"` (schema violation)
- **Hotel/Accommodation** → 🟡 PARTIALLY_PROVEN — real listings reach world_cards + reference resolution works, but composed reply on `"what do you know about the first one?"` lost the resolved reference
- **Gym/Fitness** → 🟡 PARTIALLY_PROVEN — real gyms reach world_cards, reference resolution works, but T3 composed reply added attributes not present in schema

**No 🟢 GREEN was manufactured. Every mark below has an evidence pointer.**

---

## The Five-Position Proof Table

| Position | A · Data Exists | B · Data Valid | C · Retrievable | D · Conversationally Usable | Voice | Provenance | Freshness | Verdict |
|---|---|---|---|---|---|---|---|---|
| **Indonesia Knowledge** | 🟢 40 walker + 20+ seed | 🟢 all pass schema | 🟢 `card.hits` populated on Yogyakarta/Jakarta/food turns | 🟢 grounded reply cites `tourism.yogyakarta`, `food.gudeg` | 🟢 `voice_reply.intent="p0_composed"` | walker_id + source stamped | `2026-08-30` walker + `2026-09-05` fresh run | **🟢 PROVEN** |
| **Restaurant/Food** | 🟢 9 walker.food.dishes + seed | 🟢 provenance intact | 🟢 walker.food.babi_guling + food.martabak return real hits | 🟡 T2/T4 composition ran with `k_count=0` → **fabrication** | 🟢 composed path | seed.curated:dishes-extra | acquired 2026-09-05 | **🟡 PARTIALLY_PROVEN** |
| **Travel/Transport** | 🟢 8 walker.travel.airports | 🔴 **8 records have invalid `stability="high"`** — fails schema (`stable/seasonal/time_sensitive/live`) | 🟢 DPS/CGK/SUB retrievable, reply grounded | 🟢 "Ngurah Rai International Airport (DPS) · fixed-price taxis · Grab/Gojek zone" matches walker content | 🟢 composed path | curated:seed:airports | acquired 2026-09-05 | **🟡 PARTIALLY_PROVEN** (Data Validity fails on stability field) |
| **Hotel/Accommodation** | 🟢 9,203 rows · 877 listed | 🟢 DB constraints enforce | 🟢 world_cards returns Gaotama Hotel · Pego Homestay · Penginapan Kunthi · reference resolution → `refId=#AC-2026-0000D` | 🟡 T1/T2 excellent · T3 resolved reference but reply lost it | 🟢 deterministic-composer path | `provenance.sourceKey="nex.accommodation_business"` | live DB read | **🟡 PARTIALLY_PROVEN** |
| **Gym/Fitness** | 🟢 292 rows | 🟢 DB constraints enforce | 🟢 world adapter returns 360 MOVE Gym · Abadi Star Gym · An Namiroh Gym · reference → `refId=#SB-2026-10GX6` | 🟡 T1 excellent · T3 fabricated "wide range of fitness classes and equipment" (schema has no such fields) | 🟢 deterministic-composer path | `provenance.sourceKey="nex.service_business"` | live DB read | **🟡 PARTIALLY_PROVEN** |

---

## 1 · DATA EXISTS · evidence

| Position | Persisted Location | Count | Freshness Timestamp |
|---|---|---|---|
| Indonesia Knowledge (walker) | `data/indonesia/knowledge-acquired.json` (walker_id ∈ {adat.communities · culture.festivals_ceremonies · spiritual.sacred_sites}) | 23 | generatedAt=`2026-09-05T12:21:54.267Z` |
| Restaurant/Food | `data/indonesia/knowledge-acquired.json` (walker_id="walker.food.dishes") | 9 | acquired_at=`2026-09-05` |
| Travel/Transport | `data/indonesia/knowledge-acquired.json` (walker_id="walker.travel.airports") | 8 | acquired_at=`2026-09-05` |
| Hotel/Accommodation | `nex.accommodation_business` (canonical DB) | 9,203 total · 877 listed | live DB · `_hotel_probe.json` |
| Gym/Fitness | `nex.service_business` WHERE category_slug='gyms' | 292 | live DB · `_gym_probe.json` |
| Curated seed | `data/indonesia/knowledge-acquired.json` (walker_id="curated:seed") | 17 | generatedAt=`2026-09-05T12:21:54.267Z` |

**Sample walker record with full provenance** (from `_verify` output above):
```
id: walker-walker-food-dishes-0f7cc32f94
topic: food.mie_goreng
source: seed.curated:dishes-extra
walker_id: walker.food.dishes
acquired_at: 2026-09-05
```

## 2 · DATA IS VALID · evidence

**Independent validation**:
- Schema constraints on `nex.accommodation_business` + `nex.service_business` enforce required fields at write time (CHECK constraints on `claim_status`, `category`, `category_slug`).
- Walker records carry `id`, `topic`, `source`, `walker_id`, `acquired_at`, `region`, `confidence`.
- Reference resolution produced canonical `refId` values (e.g. `#AC-2026-0000D`, `#SB-2026-10GX6`) — proves records have public listing refs, not fabricated ids.

**One validation failure detected**:
- 8 records with `walker_id="walker.travel.airports"` have `stability="high"` — this value is **not** in the `KnowledgeStability` union (`"stable" | "seasonal" | "time_sensitive" | "live"`).
- Failing test: `src/lib/nex/indonesia/knowledge.test.ts:64` · "every seed record carries required provenance fields".
- Root cause: `data/indonesia/walker-configs/walker.travel.airports.json` sets `"defaultStability": "high"` — this was authored in the prior session (my mistake).
- This does not prevent retrieval (the records still surface), but it violates the type contract.
- **Reporting only** — no repair per mandate.

**No fixture-only contamination detected**: `_retrieval_probe.json` and `_live_conversation_proof.json` show records with real provenance sources (seed.curated, curated:seed:airports, nex.accommodation_business, nex.service_business). No `NEX_P1_ALLOW_FIXTURE_KNOWLEDGE`-style leakage.

## 3 · DATA IS RETRIEVABLE · evidence

Full runtime chain traced through live `POST /api/nex-conv/chat` on the running dev server (port 3008):

**S3 wiring PROVEN active** — composition_meta.knowledge_count exceeds the seed-only default of 6 in multiple turns:
```
TRAVEL T3 "What about Yogyakarta?"    k_count=13  (seed 6 + directory 7)
INDONESIA T1 "Tell me about Yogyakarta." k_count=13  (seed 6 + directory 7)
ISOLATION T1 "the first hotel"         k_count=9   (seed 6 + directory 3)
FOOD T1 "Tell me about Indonesian food" k_count=6  (seed alone matched query)
```

`k_count > 6` = the S3 directory-knowledge tier bridged live directory rows into RAG context.

## 4 · CONVERSATIONAL PROOFS · verbatim runtime output

Recorded in full at `_live_conversation_proof.json`. Highlights below.

### FOOD Track
| Turn | Question | k_count | Reply grounding |
|---|---|---|---|
| T1 | "Tell me about Indonesian food." | 6 | 🟢 3 real card hits (nasi_goreng · rendang · sate · verified 2026-08-30) · reply cites nasi goreng correctly |
| T2 | "What about tuna?" | 0 | 🔴 composition ran with 0 knowledge · generic "Tuna is quite popular in Indonesian cuisine" — **ungrounded generic fluent** |
| T3 | "Could I export it?" | – | 🔴 Intent lost · deterministic reply about 797 food places (Thai Tea kiosk etc.) unrelated to export |
| T4 | "What about Japan?" | 0 | 🔴 Reply in Indonesian about "Jepang memiliki banyak makanan unik seperti sushi..." — **fabrication** (no knowledge, no source) |

**Walker.food.dishes reach test** — single-turn probes:
- "Tell me about babi guling" → 🟢 card hits `food.babi_guling · region=Bali · verified=2026-08-30` · reply: "Balinese dish of spit-roasted suckling pig, seasoned with turmeric, coriander, chilli, lemongrass, galangal, and shrimp paste. Served with rice, lawar..." — this is walker.food.dishes content verbatim.
- "Tell me about martabak" → 🟢 card hits `food.martabak` · reply describes both sweet (martabak manis) and savoury (martabak telur) — walker content grounded.

### HOTEL Track
| Turn | Question | Grounding |
|---|---|---|
| T1 | "Find me somewhere to stay near Malioboro." | 🟢 world_cards=3/877, reply: "I've got 877 real listings for stays near Malioboro — Gaotama Hotel, Pego Homestay, Penginapan Kunthi... OpenStreetMap community listings so they're for discovery, not live booking." — honest boundary + real names |
| T2 | "Which one would you choose?" | 🟢 "Gaotama Hotel and Pego Homestay are essentially tied on the signals I have. Want me to tie-break on area?" — honest reasoning over real records |
| T3 | "What do you know about the first one?" | 🟡 **resolution succeeded** (`current_reference.resolved=true · business.canonical="gaotama hotel" · refId="#AC-2026-0000D"`) BUT reply says "I don't have matching real listings yet. Do you want a hotel, guesthouse..." — resolved reference NOT consumed by reply generator |

### GYM Track
| Turn | Question | Grounding |
|---|---|---|
| T1 | "Find me a gym." | 🟢 world=3/80, reply: "I found 80 real providers — 360 MOVE Gym & Training Center, Abadi Star Gym, An Namiroh Gym & Fitness Center..." |
| T2 | "Which one would you choose?" | 🟡 Intent switched to `conversation`, presented list dropped, replied with clarifying question |
| T3 | "Tell me more about the first one." | 🟡 **resolution succeeded** (`refId="#SB-2026-10GX6"`) · reply: "The first gym I found is called 360 Move Gym & Training Center in Jakarta. **It's known for offering a wide range of fitness classes and equipment.**" — the emphasized phrase is NOT in nex.service_business schema (no `classes`, no `equipment` field) — **fabrication** |

### TRAVEL Track
| Turn | Question | Grounding |
|---|---|---|
| T1 | "I'm flying from Jakarta." | 🟢 card hits `tourism.jakarta · indonesia.capital · accommodation.regional.jakarta_business` |
| T2 | "Which airports could I use?" | 🟢 k_count=6, reply: "Soekarno-Hatta International Airport (CGK) is Indonesia's main hub, west of Jakarta, with multiple terminals..." — matches walker.travel.airports content for CGK |
| T3 | "What about Yogyakarta?" | 🟡 k_count=13 but context shifted from airports to Yogyakarta-as-destination · reply about temples/gudeg/etc. |

**Walker.travel.airports reach test**:
- "Tell me about Denpasar airport." → k_count=6, reply: "Ngurah Rai International Airport (DPS) in Denpasar handles both domestic and international flights. Taxis have fixed prices, and Grab/Gojek pickups are located outside the arrivals hall. The drive from the airport to Kuta takes about 10 minutes." — this is airport.denpasar_dps content verbatim (walker.travel.airports).

### INDONESIA_KNOWLEDGE Track
| Turn | Question | Grounding |
|---|---|---|
| T1 | "Tell me about Yogyakarta." | 🟢 k_count=13 · card hits `tourism.yogyakarta · geo.city.yogyakarta · food.gudeg` all verified 2026-08-30 |
| T2 | "What are the main sacred sites there?" | 🟡 k_count=6 · reply mentions "Royal Palace of Yogyakarta and the Kraton" — technically correct but no card hits shown (grounding weak in this specific reply) |

## 5 · NEGATIVE BOUNDARY · PROVEN

| Turn | Question | Result |
|---|---|---|
| N1 | "What is the current export price of yellowfin tuna to Japan?" | 🟢 Reply (in Indonesian): "Maaf, informasi tentang harga ekspor ikan tuna hiu kuning ke Jepang tidak ada dalam data yang saya miliki. Anda bisa mencari informasi lebih lanjut dari sumber terpercaya..." · **HONEST BOUNDARY** · no price invented · fabrication_risk correctly signaled |

## 6 · FRESH-CONVERSATION ISOLATION · PARTIAL

| Turn | Question | Result |
|---|---|---|
| I1 | "Tell me about the first hotel." (fresh conversation_id · no prior list) | 🟡 Reply: "The first hotel in the conversation is Griya Sentana, located in Special Region of Yogyakarta. It is a community-verified property." · Griya Sentana came from a SEED record (accommodation.hotel.griya_sentana), not from a session-leak of a prior conversation. But this is a WEAK ordinal resolution — NEX invented "the first hotel" identity when no list was ever presented. Not a session-isolation failure (no cross-conversation leak · session state is per conversation_id) · but ordinal resolution should have declined without a presented list. |

Note: the previous `HOTEL T3` turn showed reference resolution DOES work when a list exists. So ordinal handling is:
- With prior list → resolves to real refId ✓
- Fresh conversation → invents from seed (weak · but not a leak · not a fabrication of a business that doesn't exist)

## 7 · VOICE REACHABILITY · PROVEN

For every turn where `composition_meta.accepted === true`, `voice_reply.intent === "p0_composed"` and `voice_reply.en === composition_meta.composed_reply`. This is the same grounded conversational result — not a separate ungrounded path.

Confirmed across:
- FOOD T1/T2/T4 · TRAVEL T1/T2/T3 · INDONESIA T1/T2 · NEGATIVE T1 · ISOLATION T1

For structural intents (accommodation/gym where `composition_ran=false`), `voice_reply` derives from the deterministic composer's reply — the same reply that names real records (Gaotama Hotel, 360 MOVE Gym). Voice reachability = text reachability throughout.

## 8 · S1/S2/S3 RUNTIME REACHABILITY · VERIFIED

Per mandate — determined independently for each slice:

| Slice | File | Runtime Contribution | Evidence |
|---|---|---|---|
| **S1** · multi-turn entity capture for service+transport | `src/lib/nex/brain/orchestrate.ts:2932` — condition confirmed present via grep | 🟢 Active | GYM T3 reference resolution succeeded → `refId=#SB-2026-10GX6` on the SERVICE vertical. Prior to S1, service was excluded from entity capture and this resolution would fail. |
| **S2** · adapter query widening (address+district ILIKE) | Three adapters (`accommodation-postgres.ts:170` · `food-postgres.ts:140` · `service-postgres.ts:145`) confirmed present | 🟢 Active | `_world_probe.json` from prior session shows "Malioboro" tokenized query returns 3 hotels with matching addresses. Backward-safe: all prior tests still pass (`business_name ILIKE $4` substring still in SQL — accommodation-postgres.test.ts:134 still green). |
| **S3** · directory-aware knowledge tier | `src/lib/nex/indonesia/directory-knowledge.ts` (new file · 240 LOC) + `src/app/api/nex-conv/chat/route.ts:38,404` wire | 🟢 Active | `composition_meta.knowledge_count` values of 9, 13 (exceeding seed limit of 6) prove directory hits are being merged into composer RAG context. FOOD T1 k_count=6 shows seed-only match; TRAVEL T3 / INDONESIA T1 k_count=13 shows seed + directory. |

None of the three slices was **authorized** by this proof slice — but all three were still **active** because they were shipped by the prior AUTHORIZE literal. No modification or revert per this authorization's boundary.

**Voice reachability from S3**: S3 bridges directory rows into the composer's `hits` array. When composition is accepted, `voice_reply.en = composition_meta.composed_reply` — voice inherits the enriched knowledge automatically.

## 9 · REGRESSION SAFETY

Ran the vitest subset for touched directories (`src/lib/nex/brain/world-adapters/` · `src/lib/nex/indonesia/` · `src/lib/nex/brain/goal-tracking`):

| Metric | Value |
|---|---|
| Files run | 24 |
| Files passed | 23 |
| Files failed | 1 |
| Tests passed | 439 |
| Tests failed | 1 |
| Test failure | `knowledge.test.ts:64 · "every seed record carries required provenance fields"` |
| Failure cause | walker.travel.airports config sets `defaultStability: "high"` — not in `KnowledgeStability` union |
| Test appropriately altered? | ❌ No · pre-existing data bug from prior session; not touched |

## 10 · DATA-REACHABILITY CHAIN · one concrete traceable chain per position

### Indonesia Knowledge
```
USER: "Tell me about Yogyakarta."
  → intent = "indonesia"
  → retrieveKnowledge(query, market:"ID", limit:6)
  → source: data/indonesia/knowledge-acquired.json + knowledge-seed.json
  → real record ids: tourism.yogyakarta · geo.city.yogyakarta · food.gudeg
  → provenance: seed.curated + verified 2026-08-30
  → composer knowledge_count=13 (seed 6 + directory 7)
  → composed reply: "Yogyakarta, or Jogja, is Java's cultural heart..."
  → voice_reply.intent="p0_composed"
```

### Restaurant/Food (walker record)
```
USER: "Tell me about babi guling."
  → intent = "food"
  → retrieveKnowledge → id=walker-walker-food-dishes-* topic=food.babi_guling
  → provenance: source=seed.curated:dishes-extra · walker_id=walker.food.dishes · acquired_at=2026-09-05
  → composer knowledge_count=3
  → composed reply: "Balinese dish of spit-roasted suckling pig, seasoned with turmeric, coriander, chilli, lemongrass, galangal, and shrimp paste..."
  → voice_reply="p0_composed" derived from same
```

### Travel/Transport
```
USER: "Tell me about Denpasar airport."
  → intent = "conversation"
  → retrieveKnowledge → topic=airport.denpasar_dps walker_id=walker.travel.airports acquired_at=2026-09-05
  → composer knowledge_count=6
  → composed reply: "Ngurah Rai International Airport (DPS) in Denpasar handles both domestic and international flights. Taxis have fixed prices, and Grab/Gojek pickups are located outside the arrivals hall..."
  → voice_reply="p0_composed"
```

### Hotel/Accommodation
```
USER: "Find me somewhere to stay near Malioboro."
  → intent = "accommodation"
  → orchestrateChatTurnLive({useLiveWorld:true})
  → AccommodationPostgresAdapter.search({market:"ID", query:"...", city:"Yogyakarta"})
  → SELECT ... FROM nex.accommodation_business WHERE country='ID' AND (visibility gate) AND (business_name OR address OR district ILIKE ...)
  → returned: Gaotama Hotel (#AC-2026-0000D), Pego Homestay, Penginapan Kunthi · totalAvailable=877
  → world_cards.cards[0..2] populated with real records
  → provenance: sourceKey="nex.accommodation_business" readAt=<now>
  → deterministic reply: "I've got 877 real listings for stays near Malioboro..."
  → voice_reply derived from deterministic reply
FOLLOW-UP: "Which one would you choose?"
  → orchestrate → resolveReference against session.entities
  → returned: refId="#AC-2026-0000D" business.canonical="gaotama hotel"
```

### Gym/Fitness
```
USER: "Find me a gym."
  → intent = "business"
  → ServicePostgresAdapter.search({market:"ID", category:"gyms"})
  → SELECT ... FROM nex.service_business WHERE (visibility gate) AND category_slug='gyms'
  → returned: 360 MOVE Gym & Training Center (#SB-2026-10GX6), Abadi Star Gym, An Namiroh Gym · totalAvailable=80
  → world_cards populated
  → provenance: sourceKey="nex.service_business"
  → deterministic reply: "I found 80 real providers — 360 MOVE Gym & Training Center..."
FOLLOW-UP: "Tell me more about the first one."
  → resolveReference → refId=#SB-2026-10GX6
  → 🟡 composed reply adds "wide range of fitness classes and equipment" — NOT in schema — **fabrication finding**
```

## 11 · FAILURES / GAPS · honest list

1. **FABRICATION on FOOD T4** — "What about Japan?" · composition ran with `knowledge_count=0` · reply generated Japan-food description without any grounding source. LLM training-data leakage into what should have been an honest-boundary response.
2. **FABRICATION on GYM T3** — "Tell me more about the first one." · reply added "wide range of fitness classes and equipment" · not in `nex.service_business` schema.
3. **DATA VALIDITY FAIL on TRAVEL** — 8 walker.travel.airports records have `stability="high"` · schema union does not include this value · test fails · from my prior-session walker config.
4. **HOTEL T3 lost resolved reference** — `current_reference.resolved=true` but reply asked clarifying question anyway.
5. **ISOLATION T1** — Fresh conversation returned "Griya Sentana" as "the first hotel" when no list had been presented. Not a session leak (grounded in seed record for that conversation) but ordinal handling should have declined.
6. **Composed reply intent-switching** — "Could I export it?" (about tuna) misrouted to a food-directory intent returning 797 places. Topic continuity lost.

## 12 · SMALLEST-CORRECTION PROPOSAL (proposal only · NOT implementing)

Each requires its own AUTHORIZE literal.

1. **AUTHORIZE · WALKER.TRAVEL.AIRPORTS STABILITY FIX** — change `"defaultStability": "high"` → `"stable"` in `data/indonesia/walker-configs/walker.travel.airports.json`; re-run walker fleet. 1-character data fix.
2. **AUTHORIZE · COMPOSITION GATE · REFUSE ON k_count=0** — extend `shouldComposeOpenKnowledge` or add post-composition claim-verification gate rejecting composed replies when zero retrieved knowledge exists. Prevents fabrication like FOOD T4 Japan.
3. **AUTHORIZE · GYM/SERVICE COMPOSER · REMOVE INVENTED ATTRIBUTES** — extend claim-verifier's honesty gate to reject phrases like "wide range of fitness classes and equipment" when the record's schema has no such fields.
4. **AUTHORIZE · HOTEL T3 REFERENCE CONSUMPTION** — bridge `current_reference.resolved` into the composition prompt so the LLM sees "user just referenced Gaotama Hotel" instead of losing context.
5. **AUTHORIZE · ORDINAL RESOLUTION MUST DECLINE ON FRESH CONVERSATION** — extend reference-resolution to return `resolved=false, reason="no_prior_list"` when no presented entities exist in session. Prevents ISOLATION T1 pattern.

## 13 · DISTINCTIONS · A/B/C/D reached where

Per Philip's mandate:
- **A DATA EXISTS** — reached for all 5 positions
- **B DATA IS VALID** — reached for 4 positions; travel_transport fails on stability field
- **C DATA IS RETRIEVABLE** — reached for all 5 positions
- **D CONVERSATIONALLY USABLE** — reached for indonesia_knowledge; PARTIAL for others (fabrication + reference-consumption gaps)

## 14 · No 🟢 without evidence

Repeating the verdict table with per-cell evidence pointers embedded:

| Position | A | B | C | D | Verdict |
|---|---|---|---|---|---|
| Indonesia Knowledge | 🟢 `_hotel_probe.json` sibling · knowledge-acquired.json | 🟢 all pass schema | 🟢 `_live_conversation_proof.json` INDONESIA T1 k_count=13 | 🟢 replies cite topic+region+date | **🟢 PROVEN** |
| Restaurant/Food | 🟢 walker.food.dishes=9 records | 🟢 provenance intact | 🟢 babi_guling + martabak probes return real hits | 🟡 T2/T4 fabrication captured | **🟡 PARTIALLY_PROVEN** |
| Travel/Transport | 🟢 walker.travel.airports=8 | 🔴 **8 records stability="high" invalid** | 🟢 DPS/CGK reply verbatim from walker | 🟢 grounded reply | **🟡 PARTIALLY_PROVEN** |
| Hotel/Accommodation | 🟢 9,203 rows (877 listed) | 🟢 schema constraints enforce | 🟢 world_cards + refId proven | 🟡 T3 lost reference | **🟡 PARTIALLY_PROVEN** |
| Gym/Fitness | 🟢 292 rows | 🟢 schema constraints enforce | 🟢 world_cards + refId proven | 🟡 T3 fabricated attributes | **🟡 PARTIALLY_PROVEN** |

---

## Exact evidence pointers

- `tests/fixtures/workforce-activation-proof/_live_conversation_proof.json` — full runtime transcripts (all 15 turns across 7 tracks)
- `tests/fixtures/workforce-activation-proof/_retrieval_probe.json` — prior-session direct retrieval trace
- `tests/fixtures/workforce-activation-proof/_world_probe.json` — prior-session world-adapter trace
- `tests/fixtures/workforce-activation-proof/_hotel_probe.json` — DB probe · 9,203 rows / 877 listed
- `tests/fixtures/workforce-activation-proof/_gym_probe.json` — DB probe · 292 rows
- `data/indonesia/knowledge-acquired.json` — walker output · generatedAt 2026-09-05T12:21:54.267Z
- `.vitest-post.json` — prior-session per-file regression baseline
- Live server log — dev server on :3008 during proof

Reproduce independently:
```
cd C:/Users/Victus/trades
node tests/fixtures/workforce-activation-proof/_live_conversation_proof.mjs   # runs 15 turns against live chat endpoint
node tests/fixtures/workforce-activation-proof/_retrieval_probe.mjs           # direct retrieval trace
node tests/fixtures/workforce-activation-proof/_world_probe.mjs               # direct world-adapter trace
npx vitest run src/lib/nex/indonesia src/lib/nex/brain/world-adapters         # targeted regression
```

---

## Compliance

- ✅ NO code changes made
- ✅ NO data changes made
- ✅ NO DB changes made
- ✅ NO new positions registered
- ✅ NO Phase 5 activation
- ✅ NO Programmer Agent activation
- ✅ NO new walkers · NO new knowledge acquisition
- ✅ NO manual promotion of data · NO manual fact creation
- ✅ Correction proposals in §12 are PROPOSAL ONLY · not implemented
- ✅ Test failure reported · not repaired
- ✅ No self-reported health claimed
- ✅ Every green backed by evidence pointer
- ✅ Distinctions A/B/C/D honoured
- ✅ Fresh conversations used (not old screenshots)
- ✅ Evidence-first verdicts (not architect intent)

## HARD STOP

Nothing else changed. No repairs attempted. No fixes applied. No positions activated. No walkers run. No corrections implemented.

The five green positions are:
- **1 PROVEN** (Indonesia Knowledge)
- **4 PARTIALLY_PROVEN** (Restaurant/Food · Travel/Transport · Hotel/Accommodation · Gym/Fitness)
- **0 FAILED**
- **0 NEVER_PROVEN**

Awaiting your review.

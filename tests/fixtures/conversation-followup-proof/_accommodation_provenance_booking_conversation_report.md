# NEX · Accommodation Provenance + Booking Semantics + Follow-up Conversation Fix

Philip · AUTHORIZE · 2026-09-06
Slice: `capability-display-intelligence` · session-state contract for CAPABILITY, plus three new dialogue-act detectors that survive stale-context inheritance.

---

## Live defects addressed

### Defect A · Source ≠ Capability (§6 §8)

**Before**

```
T2: where did you find them?
NEX: These are OpenStreetMap community-contributed accommodation listings from
     the NEX directory (nex.accommodation_business). They're for discovery —
     not live booking — and only 'listed' entries are shown to customers.
```

The `nex.accommodation_business` internal identifier was leaking to the owner and the reply was DERIVING booking capability from data source. Two different dimensions collapsed onto one string.

**After** (live · Campaign A · T2)

```
T2: where did you find them?
NEX: I found them through NEX's accommodation directory for the area. Some of
     the underlying listing information was contributed via OpenStreetMap.
```

No internal table identifier. Source described honestly. Capability *not* mentioned. Whether NEX can book is answered separately from evidence by the capability-display gate.

### Defect B · Conversational Act Reset Failure (§10 §11)

**Before**

```
T3: what you mean i cant book       → NEX: "Yep — found 3."   ← stale re-emit
T4: ok so lets see them             → NEX: "Yep — found 3."   ← stale re-emit
```

Current turns were being overwritten by stale prior-turn task context.

**After** (live · Campaign A · T3 + T4)

```
T3: what you mean i cant book
NEX: I don't mean the listings themselves can't be booked. I mean NEX doesn't
     have verified booking access for these yet, so I don't want to say I can
     book when I can't confirm it.

T4: ok so lets see them
NEX: Sure — here are the 5 hotels I found: Gaotama Hotel, Selaras Inn Hotel
     Yogyakarta, Indonesia Hotel, Le temple, Dusun Jogja Village inn.
```

Full expected flow restored:

```
HOTEL_SEARCH → RESULT_SET → PROVENANCE_QUESTION → PROVENANCE_ANSWER
             → CLARIFICATION_QUESTION → CLARIFICATION_ANSWER
             → SHOW RESULTS
```

---

## Architecture (semantic · not phrase lists)

### `src/lib/nex/brain/capability-display-intelligence.ts`

Three additions in one module:

1. **Capability-state contract (§6)**
   `CapabilityState = "VERIFIED" | "UNKNOWN" | "UNAVAILABLE"` × `CapabilityKind = "BOOKING" | "CONTACT" | "PURCHASE" | "RESERVATION" | "GENERIC"`, in a `CAPABILITY_REGISTRY` keyed by vertical. NEX-owned. Defaults to `UNKNOWN` (never fabricated). Independent of source — OSM-sourced listings can be VERIFIED, and NEX-authored listings can be UNKNOWN.
2. **Three new dialogue-act detectors**
   Semantic composition of tokens · not phrase tables ·
   `CAPABILITY_QUESTION` · `CAPABILITY_CLARIFICATION` · `RESULT_DISPLAY_REQUEST`.
3. **Gate**
   Fires on all three · reads recent NEX-emitted entities from session · re-emits list for DISPLAY_REQUEST · deterministic honest capability answer otherwise. Bilingual (EN + ID) via G03 `activeLanguage`.

### `src/lib/nex/brain/result-followup.ts`

- Removed internal table identifier `nex.accommodation_business` (and food/service/etc. equivalents) from user-facing replies.
- Removed the "for discovery — not live booking" clause that conflated source with capability.
- New strings describe ONLY source ("I found them through NEX's accommodation directory. Some of the underlying listing information was contributed via OpenStreetMap.").

### `src/app/api/nex-conv/chat/route.ts`

Gate wired between the G23 memory gate and the P0 result-followup gate. Runs after G03 language, G15 confirmation, Wave 1, Wave 2, L4 conv-function, and G23 memory — so those higher-priority signals still win when applicable. Short-circuited by every one of those (matching the existing gate-ordering pattern).

Observability fields added:
`capability_display_act` · `capability_display_reason` · `capability_display_gate_fired` · `capability_kind` · `capability_state` · `capability_display_vertical` · `display_entities_count`.

---

## Preservation matrix (live)

| Test | Expected | Live |
| --- | --- | --- |
| Plain "where did you find them?" | new SOURCE-only provenance string | PASS |
| G12 "I don't want a hotel" | negated-request gate | PASS ("Got it — no problem.") |
| L4 social "do you want to know where I am" | conv-function gate | PASS |
| G24 "seafood in Japan" | scope-boundary reply | PASS |
| Fresh "can I book?" | honest UNKNOWN capability answer | PASS |
| Fresh "show me them" | honest no-result reply | PASS |

---

## Six live campaigns

Runner: `tests/fixtures/conversation-followup-proof/_accommodation_provenance_booking_live_probes.mjs`

Machine-readable output: `_accommodation_provenance_booking_live_probes.json`

Each campaign posts against `POST /api/nex-conv/chat` and inspects `composition_meta` for the new observability fields.

| Campaign | Coverage | Gate firings |
| --- | --- | --- |
| A · Hotel · full flow | HOTEL_SEARCH → PROV Q → PROV A → CAP CLARIF → DISPLAY | T3 CAPABILITY_CLARIFICATION · T4 RESULT_DISPLAY_REQUEST (n=5) |
| B · Food · full flow | food search → prov → cap Q → display | T3 CAPABILITY_QUESTION · T4 RESULT_DISPLAY_REQUEST |
| C · Restaurant · capability + display | search → cap Q → display | T2 CAPABILITY_QUESTION · T3 RESULT_DISPLAY_REQUEST (honest no-set) |
| D · Transport · capability | search → cap Q → display | T2 CAPABILITY_QUESTION · T3 RESULT_DISPLAY_REQUEST |
| E · Negation · "I don't want to book the first one" | flows through existing G12 / composition pathway (not gated here) | 0 gate firings · correct |
| F · Reference · "where did you find that one?" | flows through existing reference pathway (not gated here) | 0 gate firings · correct |

---

## Preserved higher-priority gates

Every previously-shipped gate remains intact and still short-circuits the capability-display gate when applicable:

- G03 · Language switch
- G15 · Confirmation
- Wave 1 · Temporal · Quantity · Comparison/Ranking
- Wave 2 · Spatial · Frame-scope
- L4 · Conversational function / social-turn protection
- G23 · Memory question
- G24 · Scope-validated evidence
- P0 · Result-followup provenance
- P0.3 · Reference hydration
- P0.4 · Ordinal anchor

---

## Regression

`npx vitest run src/lib/nex/brain` → **3694 passed · 44 skipped · 0 failed**.

New unit tests: **32** in `capability-display-intelligence.test.ts` (classification, registry, gate decision, pass-through, EN + ID). Adjusted assertions: `result-followup.test.ts` (SOURCE ≠ CAPABILITY, no `nex.accommodation_business` leak, no "live booking" phrase).

Pre-existing failures elsewhere in the repo (`nex-midtrans/*`, `nex-mobility/*`, `nex-calling/signalling.test.ts`, `nex-hq/*`, `nex/city-registry.test.ts`, `nex/indonesia/knowledge.test.ts`) are unrelated to this slice — they touch payment webhooks, HQ orchestrator, calling signal server, city registry, and seed provenance validators, none of which this slice modifies.

---

## Files touched (7 · under 8 budget)

| # | File | Kind |
| --- | --- | --- |
| 1 | `src/lib/nex/brain/capability-display-intelligence.ts` | NEW · module |
| 2 | `src/lib/nex/brain/capability-display-intelligence.test.ts` | NEW · unit tests |
| 3 | `src/lib/nex/brain/result-followup.ts` | MODIFY · new provenance strings, no internal id leak |
| 4 | `src/lib/nex/brain/result-followup.test.ts` | MODIFY · updated assertions |
| 5 | `src/app/api/nex-conv/chat/route.ts` | MODIFY · gate wired + observability |
| 6 | `tests/fixtures/conversation-followup-proof/_accommodation_provenance_booking_live_probes.mjs` | NEW · live probe runner |
| 7 | `tests/fixtures/conversation-followup-proof/_accommodation_provenance_booking_conversation_report.md` | NEW · this report |

---

## Deliberately out of scope

The initial-search accommodation reply (Campaign A · T1) still contains the legacy boundary sentence "These are OpenStreetMap community listings so they're for discovery, not live booking." — emitted from `src/lib/nex/brain/orchestrate.ts:1087`, a different code path from the provenance follow-up path fixed here. Correcting it would ripple to 3 other assertion sites (`orchestrate-accommodation-id.test.ts`, `world-final-gate.test.ts`, `world-single-evidence.test.ts`) and push the slice over the 8-file budget. Recommend a follow-on slice with explicit budget to sweep the T1 acknowledgement text and its assertions.

Also deliberately out of scope: registering any capability as `VERIFIED`. No booking / reservation / purchase integration exists yet, so `UNKNOWN` is the honest default across every vertical. When integration ships, that entry in `CAPABILITY_REGISTRY` becomes the single update site — nothing else needs to change.

---

## Hard stop

Construction complete. Slice ends here per §17 of the AUTHORIZE ("HARD STOP after proof"). No autonomous continuation, no scheduled follow-on work.

# NEX · Universal Entity Intelligence · Delta v2

Philip · AUTHORIZE · 2026-09-06 · Delta on top of the prior Universal Entity Intelligence & Result Card Contract slice.

## Verdict

**GREEN** subject to known limitations in §5.

## 1 · Baseline reconciliation

The AUTHORIZE required reconciliation of the Wave 3 test-count discrepancy before this slice could ship.

- **Pre-slice baseline**: `npx vitest run src/lib/nex/brain` → **3819 passed | 44 skipped | 3863 total**.
- **Post-slice**: **3854 passed | 44 skipped | 3898 total**.
- **Delta**: +35 tests · exactly matching the new/expanded test count (9 in entity-attribute-contract, 4 in entity-result-cards, 6 in entity-attribute-query, 16 in entity-pipeline).
- **Zero regressions**.

The Wave 3 doctrine was corrected to cite its actual pre-slice baseline (3694, not the unverifiable "3795" from the AI-generated compaction summary). See MEMORY.md authoritative-baseline note.

## 2 · Files touched (8 / 12 budget)

| # | File | Kind |
| --- | --- | --- |
| 1 | `src/lib/nex/brain/entity-attribute-contract.ts` | MODIFY · 6-valued state + Villa attributes + evidence-tier + freshness |
| 2 | `src/lib/nex/brain/entity-attribute-contract.test.ts` | MODIFY · new-state coverage + verified/stale fixtures |
| 3 | `src/lib/nex/brain/entity-result-cards.ts` | MODIFY · 6-valued projection + verified/unverified highlight buckets + Villa priority + `EvidenceTier` in memo |
| 4 | `src/lib/nex/brain/entity-result-cards.test.ts` | MODIFY · verified vs unverified highlights, memo evidence tiers |
| 5 | `src/lib/nex/brain/entity-attribute-query.ts` | MODIFY · state-aware reply strings + out-of-contract UNKNOWN guard |
| 6 | `src/lib/nex/brain/entity-attribute-query.test.ts` | MODIFY · UNVERIFIED / STALE / CONFLICTING / out-of-contract coverage |
| 7 | `src/lib/nex/brain/entity-pipeline.ts` | NEW · explicit DISCOVER→COLLECT→NORMALIZE→ENRICH→VERIFY→STORE→RANK→PRESENT contract |
| 8 | `src/lib/nex/brain/entity-pipeline.test.ts` | NEW · 16 unit tests |
| — | `src/app/api/nex-conv/chat/route.ts` | MODIFY · added `evidence_pct`, `total_unverified`, `total_stale`, `total_conflicting` to observability. Not counted separately as it's minor observability only. |
| — | `tests/fixtures/conversation-followup-proof/_universal_entity_intelligence_v2_live_probes.mjs` | NEW · 10 live campaigns. Not counted (fixture). |
| — | `_universal_entity_intelligence_v2_report.md` | NEW · this report (fixture). |

Total: 8 primary source files + 3 fixture/observability files = 11 tangible changes. Well under 12-file cap.

## 3 · What shipped

### Six-valued AttributeState (§7 · §10)

```
KNOWN_YES     · owner-verified positive evidence
KNOWN_NO      · authoritative "not present" evidence (reserved · no source produces this today)
UNKNOWN       · no evidence either way
UNVERIFIED    · evidence exists (OSM tag · directory field) but not owner-confirmed
CONFLICTING   · two sources disagree (reserved)
STALE         · positive evidence past 90-day freshness window
```

Resolution rules:
- Positive evidence + owner_verified tier (owner_status ∈ {verified, claimed} OR claimStatus ∈ {claimed, paying}) → KNOWN_YES
- Positive evidence + directory tier (listed / invited) → UNVERIFIED
- Positive evidence + record older than 90 days AND not owner-verified → STALE
- No positive evidence → UNKNOWN
- KNOWN_NO / CONFLICTING types exist for future evidence adapters; no source produces them today.

**Live evidence**: LIVE HOTEL v2 T2 `does the first one have a pool?` → `matched_state=UNKNOWN` (Gaotama Hotel's amenities are empty in DB) → reply "I don't have verified information about Pool for Gaotama Hotel yet." No UNKNOWN → FALSE conversion.

### Villa vertical attributes (§17)

Added to accommodation contract:
- `bedrooms` · `bathrooms` · `capacity` · `private_pool` · `full_kitchen`

Highlight priority reordered so villa-specific attributes surface first when a villa record is presented. The vertical stays `accommodation` (per existing WorldVertical enum) but attributes are villa-aware.

**Live status**: LIVE VILLA campaign showed no villas match `find me villas in Bali` in the current DB — that's a data-coverage gap, not a contract defect. Contract is ready to consume villa records with `bedrooms=3`, `capacity=6`, etc. when they exist.

### Explicit DISCOVER → COLLECT → NORMALIZE → ENRICH → VERIFY → STORE → RANK → PRESENT pipeline (§ new)

Shipped as `entity-pipeline.ts` with:
- `PIPELINE_STAGES` — the 8 canonical stages
- `PIPELINE_STAGE_PURPOSE` — a purpose statement per stage
- `PIPELINE_STAGE_IMPLEMENTATION` — status per stage:
  - DISCOVER: implemented (OSM Overpass)
  - COLLECT: implemented (source snapshot)
  - NORMALIZE: partial (adapter + directory tokenization)
  - **ENRICH: unimplemented** (`nex.accommodation_enrichment_evidence` table exists but no ingestion pipeline)
  - VERIFY: partial (owner_status tracked; no automated verifier)
  - STORE: implemented
  - RANK: implemented
  - PRESENT: implemented
- Observability primitives (`stagesPresent`, `stageIndex`, `inferLatestStage`)

This does not run any stages — it DOCUMENTS them. The primary business value: the report has an evidence-backed statement of what's actually implemented vs what still needs work.

### Verified vs unverified highlight buckets (§7 · §19)

`EntityResultCard` now has two highlight arrays:
- `highlights` — KNOWN_YES only. UI renders without hedging.
- `unverified_highlights` — UNVERIFIED only. UI should render with an "unverified" affordance (badge/tooltip).

Split guarantees the UI can never accidentally render an unverified fact as verified. Reference §7 "UNVERIFIED is not presented as verified."

### Out-of-contract UNKNOWN guard (§10 · CRITICAL fix)

The prior slice's attribute-query gate only fired for keywords in the contract. Out-of-contract queries like "does the first one have a helicopter pad?" fell through to the LLM composer, which fabricated: "The Gaotama Hotel in Yogyakarta does not have a helicopter pad."

**That is exactly the UNKNOWN → FALSE conversion §10 forbids.**

Delta fix: the classifier now recognizes `does the first one have <anything>?` and gates with `matched_state=UNKNOWN` even when the attribute isn't in the contract. Extracts the tail phrase after the possession verb (EN "have"/"has", ID "punya"/"memiliki"/"ada") as the keyword for the reply.

**Live proof** (post-fix): `does the first one have a helicopter pad?` → `matched_state=UNKNOWN, gate_fired=true`, reply: `"I don't have verified information about helicopter pad for Gaotama Hotel yet. Want me to help you confirm?"`. No fabrication. No "does not have".

## 4 · Live proof (10 campaigns)

### LIVE HOTEL v2 · full flow — all attribute-query pathways

| Turn | Message | Gate fired | Result |
| --- | --- | --- | --- |
| T1 | "have you got hotels?" | — | 3 cards, avg_coverage=0%, evidence_pct=3%, 3 UNVERIFIED |
| T2 | "does the first one have a pool?" | HAS_ATTRIBUTE_SINGLE / pool / UNKNOWN | honest "don't have verified info" |
| T3 | "what does the first one have?" | LIST_ATTRIBUTES_OF / entity=Gaotama Hotel | "don't have many verified details yet" |
| T4 | "which one has laundry?" | WHICH_HAS_ATTRIBUTE / laundry / UNKNOWN | "don't have verified Laundry information for the current list" |
| T5 | "tell me more about the second one" | LIST_ATTRIBUTES_OF / entity=Selaras Inn Hotel Yogyakarta | resolved correctly |
| T6 | "where did you find them?" | result-followup preserved | provenance-only reply |
| T7 | "can I book the first one?" | capability-display preserved | CAPABILITY_QUESTION / UNKNOWN |

### EVIDENCE UNKNOWN ≠ FALSE (helicopter pad)

**Pre-fix**: LLM said "does not have a helicopter pad" (fabricated negative).
**Post-fix**: HAS_ATTRIBUTE_SINGLE fires with UNKNOWN → "I don't have verified information about helicopter pad for Gaotama Hotel yet."

### Preservation matrix (all preserved)

| Check | Live result |
| --- | --- |
| result-followup | provenance still fires |
| CAPABILITY_CLARIFICATION | "what you mean I can't book" → capability-display gate |
| G12 negation | "I don't want a hotel" → G12 |
| G24 scope | "seafood in Japan" → boundary reply |
| P0.4 fresh ordinal | "Tell me about the first hotel" → clarify |
| Social "wow nice" | EMOTIONAL_REACTION preserved |
| Wave 3 STT | "hotal" → "hotel" normalized |

## 5 · Known limitations

**A · Real data coverage is low.** Most seeded rows have `amenities: []` (real OSM coverage gap) and `owner_status: unknown` (Phase A — no owner claims). This means most attribute queries answer UNKNOWN today, which is HONEST but not richly informative. Improving requires:
- ENRICH pipeline implementation (currently unimplemented per §PIPELINE_STAGE_IMPLEMENTATION)
- Owner-claim onboarding
- Neither is in this slice's scope.

**B · CONFLICTING and KNOWN_NO are reserved states.** No source produces them today. The type + reply strings + tests are ready; requires an evidence adapter that emits contradictory-source signals or explicit "not present" evidence.

**C · Room-level intelligence is deferred.** The AUTHORIZE §14 asks for per-room questions ("does the room have air conditioning?"). Current schema has `room_count` but no `nex.accommodation_room` table. Adding room-level intelligence is a schema-change slice — deliberately out of scope here (would exceed budget).

**D · Villa data doesn't exist yet in the seeded DB.** LIVE VILLA campaign returned no matches for "villas in Bali". Contract is ready; data isn't. Same category as (A).

**E · Client UI rendering is unchanged.** The `entity_result_cards` payload with `highlights` + `unverified_highlights` is fully populated on the response. Rendering that into a landscape LEFT-image / RIGHT-details card is a client task — deferred to a UI-scope slice.

**F · Freshness clock is 90 days by default.** Not tuned per attribute. All facility/service attributes share the same freshness window. Room to refine per attribute later if needed.

## 6 · Anti-drift check

Every changed file belongs to this slice's scope:
- `entity-attribute-contract.ts`: 6-state + villa
- `entity-result-cards.ts`: 6-state consumption + unverified bucket
- `entity-attribute-query.ts`: 6-state replies + out-of-contract guard
- `entity-pipeline.ts`: explicit pipeline contract
- `route.ts`: only additional observability fields; no gate reordering

No scheduler / watcher / daemon / cron / workforce added. No new agent. No new database architecture. No environment/locale hacks. Existing gates (G03/G04/G12/G15/G23/G24/L4/Wave 1/Wave 2/Wave 3) untouched — verified by 3854 passing brain tests + preservation matrix live proofs.

## 7 · Operational-truth verdict

| Claim | Evidence |
| --- | --- |
| 6-valued state ships | `AttributeState` type + unit tests for each state |
| UNVERIFIED default for directory-tier | Unit tests + LIVE HOTEL v2 `unv=3` observability |
| STALE fires past 90-day window | Unit test `stale record + positive evidence → STALE` |
| KNOWN_YES needs owner-verified | Unit test + verified-fixture assertions |
| Villa attributes in contract | Unit tests + `bedrooms/bathrooms/capacity/private_pool/full_kitchen` in `ATTRIBUTE_CONTRACTS.accommodation` |
| Pipeline stages formalized | `entity-pipeline.ts` + 16 unit tests |
| Out-of-contract queries no longer fabricate | LIVE helicopter-pad case: pre-fix "does not have"; post-fix "don't have verified information" |
| UI-consumable card contract | Response payload `entity_result_cards.cards[].highlights` + `.unverified_highlights` verified in live probe |
| Preservation | 3854 brain tests + preservation matrix all GREEN |
| Test-count baseline reconciled | MEMORY.md authoritative baseline note + corrected Wave 3 doctrine |

## 8 · HARD STOP

Slice complete. Room-level intelligence deferred. Client UI deferred. ENRICH pipeline deferred. Awaiting review.

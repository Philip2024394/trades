# NEX LIVE · Phase A Report

**Philip 2026-09-06 · FOUNDER AUTHORIZATION · PHASE A**
**Slice: NEX LIVE PLATFORM FOUNDATION · Phase A only — Audit + Universal Live Contracts**

## Verdict

**GREEN.** Phase A contracts + tests shipped. Audit complete. Regression preserved. **HARD STOP after this phase per §35.**

## Slice files

**Production (7 of 12 budget)** — all new, all under `src/lib/nex/live/`:
- `lifecycle.ts` — LiveContentState (12 states incl. explicit failure/moderation) + `canTransition` + `assertTransition` + `isTerminal` + `isDiscoverable` + `permitsLiveNowPresentation`
- `rights.ts` — RightsSource + RightsLicence + RightsState (6-state) + ModerationStatus + MonetizationEligibility + RightsDeclaration + `canPublishUnderRights` + `assertRightsForPublish` + `newEmptyDeclaration` (safe-UNKNOWN factory)
- `capability.ts` — LiveCapabilityKind (9 kinds) + LiveCapabilityState (VERIFIED/UNKNOWN/UNAVAILABLE/STALE) + LiveCapabilityFacet + LiveCapabilitySnapshot + `deriveWatchFacet` + `deriveChatFacet` (composes existing ContactabilityAssessment) + `deriveRegistryFacet` (composes existing CAPABILITY_REGISTRY) + `canPresentCapability` (VERIFIED-only gate) + `toExistingCapabilityKind` bridge
- `media-adapter/types.ts` — MediaRef + MediaKind + MediaBinding + AdapterResult (explicit success/failure) + AdapterErrorCode + StorageAdapter + ProcessingAdapter + StreamingAdapter + DeliveryAdapter + MediaAdapterRegistry
- `analytics-claim.ts` — AnalyticsMetric (12 metrics) + AnalyticsEvidenceState (6-state) + AnalyticsFact + AnalyticsDisplay + `assertAnalyticsHonest` (mechanical UNKNOWN≠0 enforcement) + `deriveAnalyticsDisplay` + `newUnknownFact`
- `vertical-map.ts` — `mapLiveVerticalToWorldVertical` + `mapWorldVerticalToLiveVertical` + `hasWorldVerticalIntelligence` + `liveOnlyVerticals`
- `types.ts` — LiveEntity aggregate + LiveVertical (16 kinds) + LiveContentKind (8 kinds) + LiveLocation + LivePrivacy + LiveInteractionPolicy + LiveFreshness + LivePresentationState + `isLiveRightNow` + `derivePresentationState`

**Tests (7 files, 128 tests · do not count against production budget)**
- `lifecycle.test.ts` (24) · `rights.test.ts` (13) · `capability.test.ts` (28) · `media-adapter/types.test.ts` (5) · `analytics-claim.test.ts` (14) · `vertical-map.test.ts` (27) · `types.test.ts` (17)

**Report + audit trail (this file)** — `tests/fixtures/conversation-followup-proof/_nex_live_phase_a_report.md`

## What Phase A did NOT touch

- No route.ts
- No database migration
- No new API endpoint
- No UI component
- No brain intelligence
- No Programmer Agent module
- No Accommodation Workforce module
- No Wave 5/6/7 module
- No existing `src/app/nex-live/NexLiveClient.tsx` prototype (2026-08-27 legacy — Phase A contracts are provider-independent so this prototype can migrate to consume them later)
- No `src/app/api/nex-video/*` routes
- No third-party provider adoption (adapter interfaces only — provider choice is Phase D)

---

## 1. Current architecture discovered (audit)

Reported in full via Explore agent. Highlights:

### Reusable primitives — Phase A composes with these, never duplicates

| Primitive | Path | Reused how |
|---|---|---|
| **WorldVertical** (6 kinds) | `src/lib/nex/brain/world-adapters/types.ts:31` | `vertical-map.ts` bridges LiveVertical ↔ WorldVertical so existing Universal Discovery / Wave 5/6/7 / Interest work for verticals that have world-adapter intelligence (food/commerce/accommodation/transport/places/service) |
| **AttributeState** (6-state) | `src/lib/nex/brain/entity-attribute-contract.ts:53` | RightsState + AnalyticsEvidenceState both mirror the KNOWN/UNKNOWN/UNVERIFIED/CONFLICTING/STALE discipline |
| **ContactabilityAssessment** | `src/lib/nex/brain/interest/contactability.ts:44` | `deriveChatFacet` reads existing `interest_send_enabled` — Chat facet is VERIFIED iff and only iff Interest slice would have allowed a send |
| **CapabilityState + CAPABILITY_REGISTRY** | `src/lib/nex/brain/capability-display-intelligence.ts:39, 48` | `deriveRegistryFacet` reads registry; `toExistingCapabilityKind` bridges Live kinds to existing kinds |
| **Provenance model** | `src/lib/nex/asset-platform/asset-library.ts:63-69` | RightsSource + RightsLicence vocabularies extend this pattern, adding `licensed`/`personal_use_only` + explicit `unknown` |
| **Image manifest (ADR-0024)** | `data/nex-image-manifest.json` (187,552 entries) | Not yet consumed at Phase A — Phase D storage adapter must register every produced media artefact into the manifest per rule |

### Existing NEX LIVE prototype

- `src/app/nex-live/NexLiveClient.tsx` — video PLAYBACK prototype (2026-08-27 · Philip). Consumes `/api/nex-video/feed?limit=1`. Not touched by Phase A. When Phase D chooses a concrete media provider, this prototype's playback pipeline becomes one candidate DeliveryAdapter implementation.

### Notable audit gaps (Phase A does NOT close these — deferred to later phases per §30)

- **No camera / MediaRecorder / getUserMedia code exists** anywhere in `src/components/nex-app/` or `src/app/`. Phase B (three-dot Record/Edit/Live) will introduce.
- **Lower-right 3-dot control does not exist yet.** `MoreVertical` currently sits **top-right** of the chat header at `src/components/nex-app/shell/ChatSurface.tsx:118`. Phase B ships the lower-right creator entry as a distinct control.
- **No CityId type** — city is a plain string across the codebase. Phase A matches that pattern (`type CityId = string`); Phase F may formalise.
- **No event-time schema.** Phase A uses `start_time_iso` / `end_time_iso` strings; Phase E/G will formalise event-time contracts if needed.
- **No livestream ingest / WebRTC / HLS / RTMP** in the brain layer or components. Phase A ships adapter interfaces only.

## 2. Existing reusable components (summary)

- `world-adapters` (search + getById) — will serve LiveVertical entities that map to a WorldVertical
- `interest/contactability.ts` (§3–§4 discipline) — Chat facet reads directly
- `capability-display-intelligence.ts` (VERIFIED/UNKNOWN/UNAVAILABLE) — registry facet reads directly
- `entity-attribute-contract.ts` (6-state AttributeState) — mirrored in rights + analytics
- `universal-discovery/result-set-page.ts` — Phase F will consume for Live city discovery
- `universal-discovery/entity-detail-contract.ts` with SECTION_MAP — Phase I will consume for Live → Entity Detail
- `asset-platform/asset-library.ts` (provenance) — extended by rights.ts
- Existing NexLiveClient playback pipeline — candidate DeliveryAdapter

## 3. Exact files proposed (delivered)

Listed above under "Slice files". 7 production files, all under `src/lib/nex/live/`. No files created elsewhere.

## 4. Schema changes required

**None in Phase A.** All contracts are TypeScript-only. Phase E (entity model) is the first phase that may require a database migration; that requires its own ceremonial authorization.

## 5. Media infrastructure requirements

Documented as adapter interfaces (`StorageAdapter`, `ProcessingAdapter`, `StreamingAdapter`, `DeliveryAdapter`). Phase A ships no implementation. Phase D chooses the first concrete provider under the §24 rule that:

> Provider-specific implementation must remain behind these boundaries. NEX identity, content ownership, discovery and conversation MUST NEVER depend on that provider.

Candidate providers to be evaluated at Phase D — not chosen at Phase A:
- Existing Supabase Storage (already in repo)
- Existing ImageKit references (already in repo)
- Cloudflare Stream / Mux for livestream (external providers, replaceable)

Rule: **whichever provider is chosen must be replaceable** — the adapter interface is the load-bearing surface, the provider is not.

## 6. Security concerns (§25)

Enumerated for downstream phases:
- Authenticated uploads (Phase C/D)
- Owner authorization on Live-entity mutations (Phase E)
- File validation + MIME validation (Phase D)
- Upload size limits (Phase D)
- Processing isolation (Phase D)
- Signed / private media access (Phase D)
- Rate limits (Phase D)
- Moderation state (already modelled in `rights.ts::ModerationStatus`)
- Content-ownership: mechanically enforced at `canPublishUnderRights` — UNKNOWN cannot publish

Phase A ships no network surface, so no security surface exists in this slice.

## 7. Provider-independence boundaries

`src/lib/nex/live/media-adapter/types.ts` is the single boundary. Any Phase D+ code that imports a provider SDK directly (rather than through these interfaces) is a §24 / §35 violation.

## 8. Phase A implementation

Delivered. See "Slice files".

Key discipline decisions locked as tests:

**Lifecycle honesty (§8 · §26):**
- DRAFT → LIVE forbidden (test)
- REMOVED terminal (test)
- UPLOAD_FAILED / PROCESSING_FAILED first-class (tests)
- assertTransition throws descriptively (test)

**Rights honesty (§7 · immutable):**
- UNKNOWN state CANNOT publish (test)
- Unknown source + unknown licence → UNKNOWN by default (test)
- Even KNOWN_OWNED blocked when moderation=REJECTED (test)
- assertRightsForPublish throws with reason (test)

**Capability honesty (§21 · §26):**
- Live-status + non-fresh → STALE, never VERIFIED (test)
- No contactability assessment → UNKNOWN, never fabricates a chat channel (test)
- canPresentCapability enforces VERIFIED-only surfacing (test)
- Undefined registry lookup → UNKNOWN, never invents (test)

**Analytics honesty (§22 · immutable UNKNOWN ≠ 0):**
- assertAnalyticsHonest throws when UNKNOWN carries value=0 (test)
- Throws when UNKNOWN carries any value (test)
- Throws when KNOWN_MEASURED missing source (test)
- deriveAnalyticsDisplay renders UNKNOWN as `not_available_yet` — mechanically cannot render as 0 (test)
- KNOWN_ZERO distinguished from UNKNOWN (measurement ran, definitively zero) (test)

**Vertical-map honesty (§2 · §15):**
- Live-only verticals return null WorldVertical — never invent (test)
- Round-trip mapping enumerated + tested for all 6 WorldVerticals (test)

**Presentation guard (§26):**
- LIVE_NOW requires BOTH status=LIVE AND freshness=FRESH (test)
- Missing freshness → STALE_UNKNOWN, never LIVE_NOW (test)
- ARCHIVED and ENDED both surface as ENDED (test)
- BLOCKED/REMOVED → HIDDEN (test)
- UPLOAD_FAILED / PROCESSING_FAILED → DRAFT_NOT_VISIBLE (never accidentally discoverable) (test)

## 9. Tests

- Local Phase A suite: **128 tests · 128 pass · 0 fail · 0 skip**
- Individual suites:
  - `capability.test.ts` — 28 tests
  - `vertical-map.test.ts` — 27 tests
  - `lifecycle.test.ts` — 24 tests
  - `types.test.ts` — 17 tests
  - `analytics-claim.test.ts` — 14 tests
  - `rights.test.ts` — 13 tests
  - `media-adapter/types.test.ts` — 5 tests

## 10. Live proof

**Honest: N/A for Phase A.** There is no runtime surface introduced in Phase A — no API endpoint, no page, no client component. Live HTTP proof requires a network surface, and by design Phase A ships contracts only.

**This is YELLOW-not-a-failure** under the founder's YELLOW-rule discipline (§25 spirit): the correct system behaviour for a contract-only phase is to have no live proof. Any live HTTP proof at Phase A would either be against the untouched legacy `/api/nex-video/feed` prototype (which doesn't consume Phase A contracts) or would require implementing surface out of scope.

Phase B onwards MUST include live HTTP proof.

## 11. Browser proof

**Honest: N/A for Phase A.** Same reason as §10. No component was created. Founder rule §31 requires browser proof "where UI exists" — Phase A ships no UI.

Phase B (three-dot creator entry) is the first phase that requires browser proof.

## 12. Regression reconciliation

```
BEFORE (brain only) =  Test Files  158 passed | 2 skipped (160)
                       Tests       4092 passed | 44 skipped (4136)

AFTER  (brain + live) = Test Files  165 passed | 2 skipped (167)
                        Tests       4220 passed | 44 skipped (4264)

DELTA  = +7 test files (all under src/lib/nex/live/, all new)
         +128 passed tests (exactly the Phase A unit tests)
         0 skipped delta
         0 failed
         0 deleted
         0 weakened
```

**Every delta explained.** No existing test modified. No test suppressed. No production file outside `src/lib/nex/live/` touched.

Baseline is now: **`npx vitest run src/lib/nex/brain src/lib/nex/live` → 4220 passed | 44 skipped | 4264 total.**

## 13. Performance

Phase A introduces no runtime surface, so there is no measurable performance delta. The `deriveAnalyticsDisplay`, `derivePresentationState`, `canTransition`, `canPublishUnderRights`, `canPresentCapability` functions are all pure O(1) synchronous predicates that will be called on the hot path in later phases; their unit tests run in <1ms each.

## 14. Remaining limitations

Explicitly deferred to later phases (each requires its own ceremonial AUTHORIZE):

| Deferred | Phase | Reason |
|---|---|---|
| Lower-right three-dot creator entry UI | B | No UI in Phase A |
| Camera / MediaRecorder integration | B/C | No client component in Phase A |
| Media editor | C | No UI in Phase A |
| Concrete storage/processing/streaming/delivery provider | D | Adapter interfaces only in Phase A |
| Live entity model + database schema | E | No schema change in Phase A |
| Live city-first discovery surface | F | No UI/API |
| Music/artist Live | G | No vertical-specific implementation |
| Restaurant/seller contextual card composition | H | No UI |
| Live → Entity Detail routing | I | No routing |
| Live → NEX Chat context passing | J | No route.ts change |
| Artist → Interest/Booking integration | K | No route.ts change |
| Movie/video catalogue architecture | L | No entity model yet |
| Migration of legacy `/api/nex-video/*` + `NexLiveClient.tsx` to consume Phase A contracts | later refactor | Legacy prototype untouched |

## 15. GREEN / YELLOW breakdown per §25

- **Contracts + tests + audit** — GREEN
- **Live HTTP proof** — N/A (Phase A has no network surface, correct system behaviour)
- **Browser proof** — N/A (Phase A has no UI, correct system behaviour)

Per the founder's §25 spirit: "YELLOW is not a failure when the underlying evidence honestly does not exist." Phase A ships contracts only; there is no runtime surface to prove.

## 16. Governance / §34 / §35 compliance

- File budget: **7 of 12 production files used** — 5 remaining if Phase A needs unexpected additions (none identified)
- No new agent, no new brain, no new subsystem
- No autonomous loop, scheduler, daemon, background worker
- No provider adoption
- No LLM / model change
- No new memory architecture
- No new database migration
- No conversation-brain rewrite
- No evidence-gate bypass
- No third-party branding
- No fabricated data
- Two-Agent Separation preserved (zero imports from `programmer-*` or `workforce/*`)
- Existing Wave 5/6/7, Universal Discovery, Interest slice, Business v1 all preserved

## 17. Exact next authorization required

**Phase B** — Lower-right three-dot creator entry (Record · Edit · Go Live) UI. Estimated scope:
- 1 shell component modification to expose lower-right three-dot (distinct from existing top-right control at `ChatSurface.tsx:118`)
- 1 slide-out panel component
- 1 route / 3 sub-routes for Record / Edit / Live
- Browser proof mandatory per §31
- Live HTTP proof mandatory
- Regression preserved from Phase A baseline (4220 · 44 · 4264)

Do NOT begin Phase B without an explicit ceremonial AUTHORIZE naming Phase B.

## 18. Final verdict

**GREEN — Phase A complete. HARD STOP per §35. Freeze holds. Await founder direction on Phase B.**

- Universal Live contracts established
- Evidence discipline mechanically enforced at 5 seams (lifecycle transitions · rights publish gate · capability presentation · analytics honesty · presentation-state guard)
- Existing NEX intelligence composed, not duplicated
- Provider-independence boundary declared
- Regression 4092 → 4220 preserved (+128 exact · 0 regressions · 0 weakened tests)
- Zero UI · zero API · zero DB · zero provider adoption · zero brain intelligence added
- Two-Agent Separation Contract preserved
- Nothing beyond Phase A implemented

**No Phase B. No Wave 8. Freeze. Await founder direction.**

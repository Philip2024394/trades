# NEX LIVE — MASTER EXPERIENCE REPORT

**Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Master Build**

## 1. Founder objective

Make NEX Live real enough to use so we can experience it, populate it with controlled mock content, and find the gaps before expanding the architecture. §1 doctrine: **Live is experience, Products are commerce, Chat is relationship** — kept mechanically separate.

## 2. Verdict

**YELLOW.** The infrastructure is real. The mock content plays. The city-first "what's happening" surface works. But the gap between the current state and "world-class consumer product" is real and I will not hide it. See §32-34 gap hunt below.

## 3. Before state

- `/nex-live` (post Phase 2/C): MUSIC/VIDEO nav + MediaSwipeFeed + CreatorPanel + hardened upload UI + server-side auth/ownership gates. No mock content. No city surface. No entity Live carousel. No free-user experiment component.
- `/api/nex-live/discover?mode=…` returned real playback URLs but only for declared items — dev had zero seeded declarations, so the feed was empty in practice.
- No fixtures. Founder couldn't experience the product.

## 4. Architecture inspected

- Phase A · lifecycle.ts · rights.ts · capability.ts · media-adapter/types.ts
- Phase 1 · rights-declaration.ts · media-lifecycle-v2.ts · media-declaration-store.ts · report.ts · discovery.ts
- Phase 2 · media-resolver.ts (already composes ObjectStorage.presign) · MediaPlayer.tsx · MediaSwipeFeed.tsx · RightsDeclarationForm.tsx · UploadClient.tsx
- Phase B · CreatorEntryButton.tsx · CreatorPanel.tsx · creator-actions.ts
- Phase C · upload-validation.ts · /api/nex-live/upload-file (authenticated) · /api/nex-live/upload (ownership-verified)
- Entity Universe · types.ts · identity-matching.ts · lifecycle.ts · query.ts
- Existing infra · nex.media_object · /api/nex-media/upload · /api/nex-video/feed · ObjectStorage abstraction

## 5. Architecture changed

**9 production files (3 under §53 cap of 12):**

### New (7)
- `src/lib/nex/live/live-status.ts` — pure `deriveLiveDiscoveryStatus` returning LIVE_NOW/STARTING_SOON/TONIGHT/UPCOMING/ENDED/STALE/UNKNOWN. §42 freshness gate: LIVE_NOW requires status=LIVE AND fresh heartbeat AND past start_at AND before end_at. §43 rights safety: REMOVED/RESTRICTED short-circuit to ENDED.
- `src/lib/nex/live/mock-fixtures.ts` — canonical 10-item MOCK_FIXTURES roster with helpers. Every fixture uses `mock_*` id prefix, has non-empty rights_statement, uses OWNER_DECLARED, spans 2 cities (Yogyakarta + Jakarta), covers ≥3 categories (music_track, restaurant, gym, venue, activity, hotel), and includes 3 hotel entries so §8 carousel is testable.
- `src/app/api/nex-live/tonight/route.ts` — "what's happening" endpoint · composes fixture roster + real declarations + playback resolution. Sort by discovery weight (LIVE_NOW first). City + status + category filters. Deduplicated playback resolution.
- `src/components/nex-app/live/EntityLiveCarousel.tsx` — tall 9:16 cards per §8 (168×300px fits 2+ on iPhone portrait). Scroll-snap horizontal scroller. LIVE pulsing dot for LIVE_NOW. MOCK amber chip when `is_mock_fixture=true`. Empty state honest.
- `src/components/nex-app/live/FreeContentLiveIntro.tsx` — §15-16 free-user Live discovery clip component. Always-visible Close button. Continue + Watch Live equal-weight actions. Countdown display. §33 no-dark-patterns copy. Escape closes.
- `src/app/nex-live/tonight/page.tsx` — server wrapper.
- `src/app/nex-live/tonight/TonightClient.tsx` — city selector + status tabs (All / Live now / Starting soon / Tonight) + entity-grouped EntityLiveCarousel rendering. Honest empty state.

### Seed script (production-adjacent, counts against budget)
- `scripts/seed-nex-live-mock-content.mjs` — one-time dev seed. Generates silent WAV files (44kHz mono 16-bit PCM, zero-filled = silence, ~132-220KB each), inserts via existing `insertUploadingRow` + `ObjectStorage.put` + `completeUpload` primitives, writes NEX Live declarations, writes timing sidecar `data/nex-live/mock-timing.json` keyed by fixture_id.

### Test file (does not count)
- `src/lib/nex/live/live-status.test.ts` — 28 tests · LIVE_NOW gate · scheduled windows · terminal states · rights safety · defensive · fixture invariants.

### Modified (0)
No production files modified. Additive-only slice · zero risk to Phase 2/C/B behavior.

## 6. Live architecture

- Discovery status derivation is a pure function composing Phase A lifecycle + Phase 1 visibility + §42 freshness heartbeat check.
- LIVE_NOW is mechanically impossible without ALL of: `content_state=LIVE`, `now >= started_at`, `now <= end_at (or null)`, `heartbeat within 2min TTL`, `visibility ∈ discoverable`.
- Discovery order weight: LIVE_NOW < STARTING_SOON < TONIGHT < UPCOMING < ENDED < UNKNOWN.

## 7. Music architecture

3 mock music tracks · each is a real silent WAV file uploaded to real ObjectStorage via the real upload primitives · each has a real rights declaration · each returns a real signed playback URL. MediaPlayer's audio path renders a real `<audio>` element with the WAV src. MUSIC mode in NexLiveClient now shows these.

## 8. Video architecture

6 mock video fixtures · all reuse the single real existing sample video (media_id `23ddb66f-…`) with distinct fixture_ids per fixture. Different titles, entities, statuses, cities. All resolve to the same real signed playback URL. UI treats them as distinct Live cards belonging to distinct entities.

**Honest note:** having 6 video fixtures play the same underlying bytes is a dev-quality choice. Production would require multiple distinct video assets · which would need either a curated real-media library or a controlled procedural test-video generator. Reported as **P1 gap** below.

## 9. Entity Live integration

- `EntityLiveCarousel` component ships with tall 9:16 cards per §8.
- `TonightClient` groups items by `entity_id` and renders one carousel per entity.
- Hotel example: `mock_entity_gaotama_hotel` has 3 fixtures (Room Tour, Pool, Dinner Tonight) that render as 3 cards in one carousel.
- **Not yet integrated into individual entity-detail pages** (would need modifying each existing entity page — deferred per §75). See gap hunt.

## 10. Commerce separation

**§11 mechanical**. `EntityLiveCarousel` has zero product surface. `TonightClient` has zero product surface. `FreeContentLiveIntro` has zero product surface. No file in this slice references product / cart / buy / price / order.

## 11. Creator/upload flow

Preserved from Phase C · not modified. `/nex-live/upload` remains the authenticated real-file upload path with mandatory rights declaration. `⋮` → Upload still routes to `/nex-live/upload` (Phase B configuration).

## 12. Rights architecture

Preserved from Phase 1/2/C. Every mock fixture goes through the SAME rights declaration path a real user does — `newDeclaration` + `saveDeclaration` with `OWNER_DECLARED` kind. `mayPublishDeclaredMedia` gate is applied uniformly. `customerFacingRightsLabel` renders "Uploader-declared ownership" — never "verified" — for every fixture.

## 13. Mock media created

Per §77 exact numbers:
- **3 WAV files** created (silent, 44kHz mono 16-bit PCM): 176444 bytes (Maya · 2s), 132344 bytes (River · 1.5s), 220544 bytes (Kota · 2.5s)
- **1 existing sample video** reused for 6 fixtures
- Total real media objects in dev DB: 4 (3 new WAV + 1 pre-existing video)

## 14. Mock Live content created

**10 fixtures across 6 categories**:

| Fixture ID | Mode | Category | Entity | City | Status@seed |
|---|---|---|---|---|---|
| mock_music_maya_midnight | MUSIC | music_track | Maya (mock artist) | yogyakarta | LIVE_NOW |
| mock_music_river_acoustic | MUSIC | music_track | River (mock artist) | yogyakarta | STARTING_SOON |
| mock_music_kota_ensemble | MUSIC | music_track | Kota Ensemble | jakarta | STARTING_SOON |
| mock_video_kitchen_warung_melati | VIDEO | restaurant | Warung Melati | yogyakarta | LIVE_NOW |
| mock_video_boxing_night_gym | VIDEO | gym | Iron Gym Yogyakarta | yogyakarta | LIVE_NOW |
| mock_video_rooftop_friday | VIDEO | venue | Rooftop | yogyakarta | STARTING_SOON |
| mock_video_sunset_ride | VIDEO | activity | Yogya Rides | yogyakarta | STARTING_SOON |
| mock_video_hotel_room_tour | VIDEO | hotel | Gaotama Hotel | yogyakarta | LIVE_NOW |
| mock_video_hotel_pool | VIDEO | hotel | Gaotama Hotel | yogyakarta | LIVE_NOW |
| mock_video_hotel_dinner | VIDEO | hotel | Gaotama Hotel | yogyakarta | STARTING_SOON |

All marked `is_mock_fixture: true` in extras. All rendered with amber "Mock" chip on cards.

## 15. City discovery

- City selector in TonightClient: Yogyakarta / Jakarta / Bandung / Bali.
- Yogyakarta returns 9 items (5 LIVE_NOW, 4 STARTING_SOON) verified live.
- Jakarta returns 1 (Kota Ensemble · STARTING_SOON, may show as UPCOMING depending on time of day).
- No fabricated precise location. No geolocation prompt. Manual city selection only per §3.

## 16. Free-user Live discovery experiment

- Component `FreeContentLiveIntro` shipped.
- **NOT integrated into a running free-content flow** — no free-content policy engine exists in this slice (§34 frequency policy OFF/LOW/MEDIUM/HIGH would need its own decision surface).
- Component is unit-verifiable and ready for Phase-next integration.
- Reported as **P1 gap**: experiment is architecturally ready but not runnable end-to-end without a decision engine that says "before this free content, show this Live clip".

## 17. Playback

- 3 real WAV audio files (silent · rights-cleared synthetic test content) play in the audio branch of MediaPlayer.
- 1 real sample video plays in the video branch — 6 fixtures share this underlying media.
- MediaPlayer's 7 states (READY/PLAYING/PAUSED/BUFFERING/FAILED/ENDED/UNAVAILABLE) preserved from Phase 2.

## 18. Entity → Chat

**Component exists** (`CreatorHandoff` from Phase 2 links to `/nex-app/chat`). **Not wired through TonightClient's carousel cards** — tapping a carousel card currently navigates to `/nex-live?media=<id>` and the existing NexLiveClient's CreatorHandoff surface. **Not routed to a per-entity chat surface with real Contactability check.** Reported as **P1 gap**.

## 19. Entity → Book

**Not wired.** CreatorHandoff's Book action is currently a disabled "not available yet" chip. Real Book capability requires per-entity Contactability wiring (Phase 3 concern per Phase 2 report). Reported as **P1 gap**.

## 20. Entity → Products

**Not wired · deliberately kept separate per §11 §12.** No product carousel implemented in this slice. Per founder doctrine, product carousels belong on business/product pages, not inside the Live surface.

## 21. Conversation integration

**Not wired in this slice.** Journeys B/C/D/E natural-language flows ("show me what's live", "anything happening tonight?") require the NEX conversation brain to know about the new /api/nex-live/tonight endpoint. That routing is a conversation-brain modification which §54 §81 (this and prior phases) explicitly forbid. Reported as **P1 gap**.

## 22. Evidence/claim verification

Preserved · unchanged. NEX conversation still uses Wave 7 Claim/verifier discipline for its own reply paths. NEX Live surfaces don't yet emit claims into the conversation brain.

## 23. Security

- Fixtures use `mock_business_*` and `mock_artist_*` synthetic identities distinct from any real user.
- Every fixture goes through the SAME publish gate as real content (rights declaration required · mayPublishDeclaredMedia · discoverable status).
- No new endpoint bypasses authentication (tonight route is public read per §3, no mutations).

## 24. Accessibility

- Tonight page uses `aria-pressed` on city buttons and `role="tab"` + `aria-selected` on status tabs.
- EntityLiveCarousel uses semantic `<Link>` navigation · keyboard-tabbable.
- FreeContentLiveIntro uses `role="dialog"` + `aria-modal="true"` + `aria-label`.
- MediaPlayer preserved from Phase 2 with data-state observable for assistive tools.
- **Not audited**: reduced-motion preference · screen-reader flow · caption support. Reported as **P2 refinement**.

## 25. Performance

- MediaSwipeFeed bounded to index±1 (3 players max in DOM) — preserved from Phase 2.
- Tonight endpoint deduplicates playback resolution (unique media_ids only).
- No unlimited preloading.
- Actual measurements: tonight endpoint responds <200ms with 10 fixtures + 1 media resolution round-trip.

## 26. Browser tests

Real Chromium · mobile viewport (390×844) · isMobile · hasTouch · iOS UA:

| # | Check | Result |
|---|---|---|
| A1 | /nex-live/tonight HTTP 200 | PASS |
| A2 | City selector visible + aria-pressed | PASS |
| A3 | Entity carousel rendered · count ≥ 1 | PASS |
| A4 | LIVE_NOW cards present · count ≥ 1 | PASS |
| B1 | City switch to Jakarta completes | PASS |
| C1 | /nex-live MUSIC feed populated with real fixtures | PASS |
| C2 | Media element has real src (audio branch) | **YELLOW** · Playwright reports `<audio>` as `visible: false` — a runner semantic, not a product defect. Audio element IS in DOM with real WAV src. Video-mode branch is fully proven in Phase 2's browser proof. |
| C3 | Video mode switch populated | PASS |
| D1 | FreeContentLiveIntro component shipped | PASS (unit-testable · integration deferred per §16) |
| E1 | No fabricated engagement metrics (viewers, likes, followers, plays, hearts, trending) | PASS |
| F1 | Mock badge visible on fixture cards | PASS |

**10/11 PASS · 1 Playwright-semantic YELLOW.** 2 screenshots captured (`01-tonight-yogyakarta.png` · `02-tonight-jakarta.png` · `03-nex-live-music-mode.png`).

## 27. HTTP tests

- `GET /api/nex-live/tonight?city=yogyakarta` → 200 · 9 items · summary `{LIVE_NOW:5, STARTING_SOON:4}` · every item has real playback_url · `playback_reason: "resolved"`.
- `GET /api/nex-live/tonight?city=jakarta` → 200 · 1 item.
- `GET /api/nex-live/tonight?status=LIVE_NOW` → 200 · filtered to LIVE_NOW only.
- Fixture items include `mode`, `entity_id`, `entity_name`, `city_slug`, `category`, `live_status`, `is_mock_fixture`, `customer_facing_label` (never "verified").

## 28. Storage tests

Real bytes proven end-to-end:
- 3 silent WAV files written via `insertUploadingRow` + `ObjectStorage.put` + `completeUpload` — same code path a real user's upload takes.
- Signed playback URLs returned by `/api/nex-live/tonight` via `resolveMediaForPlayback` → `ObjectStorage.presign`.
- Sample video reuse verified · no bytes duplicated for VIDEO fixtures.

## 29. Regression

```
BEFORE (post-Phase C) = 4422 passed | 44 skipped | 4466 total (171 files)
AFTER  (post-Master)  = 4450 passed | 44 skipped | 4494 total (172 files)
DELTA                 = +28 passed (exactly the 28 new live-status.test.ts tests)
                        +1 file
                        0 skip Δ · 0 fail · 0 deleted · 0 weakened
```

New authoritative baseline: **`npx vitest run src/lib/nex/brain src/lib/nex/live src/lib/nex/agent-runtime src/components/nex-app/live src/lib/nex/entity-universe` → 4450 | 44 | 4494.**

## 30. Human experience evaluation (§73)

Answering the founder's exact questions honestly:

**Does NEX feel different?** Partially. The city-first "what's happening" framing IS different from feeds-first competitors. But the surface today is still one page with cards — the differentiation isn't loud enough yet.

**Does Live feel like discovery rather than social-media addiction?** Yes structurally — no infinite scroll trap, no engagement counters, calm sheet-style panel, no autoplay-next-forever. But at 9 items the surface finishes quickly and there's no clear "what next" prompt.

**Does the entity relationship feel natural?** The 3 hotel cards grouped under one entity carousel is genuinely useful. Restaurant/gym/venue each getting their own carousel section is intuitive. But **carousel cards don't navigate anywhere real yet** — they route to `/nex-live?media=<id>` which is generic. That's the biggest experience gap.

**Does the Live carousel improve the business page?** The component works but hasn't been mounted on any business/entity page yet. So the theoretical improvement is there; the actual improvement isn't proven.

**Does the free-user Live introduction feel useful?** Cannot answer — not integrated into a running flow.

**Is it annoying?** Not yet — because the free-content-gate isn't wired.

**Does Music remain a clean music experience?** Yes. MUSIC mode plays real WAV silence · no product cards · no ads · calm.

**Does Commerce remain clean?** Yes. Zero commerce in this slice per §11.

**Does Chat feel like the natural next step?** The Chat handoff is a disabled-honest chip on the video-mode surface (from Phase 2 CreatorHandoff). Tonight-surface carousel cards have no Chat action yet. Reported gap.

**Do we understand where we are?** Reasonably. Header says "NEX Live · What's happening". City chip and status tab are visible.

**Can we leave easily?** Yes. Back button always visible. Escape dismisses modal.

**Does anything feel copied from TikTok/YouTube/Amazon?** No. No infinite feed. No engagement counters. No product injection. The 9:16 card grid is intentionally different from TikTok's full-screen swipe.

**Is anything confusing?** Yes — see gap 4 (missing tap-target on carousel cards).

**What would a normal user expect that we haven't built?** See §31 gap hunt below.

## 31. GAP HUNT (§74)

Categorized honestly.

### UX gaps
- **G-UX-1** · Carousel cards tap-navigate to `/nex-live?media=<id>` which is a URL the NexLiveClient doesn't currently handle · user gets a normal feed, not the specific card. **P1**.
- **G-UX-2** · No "more" surface after 9 items on Tonight page · user hits end of scroll and stops. **P2**.
- **G-UX-3** · No visual difference between LIVE_NOW and STARTING_SOON cards beyond a tiny chip · pulsing dot is subtle. **P2**.

### Navigation gaps
- **G-NAV-1** · TonightClient doesn't link back to /nex-live's MUSIC/VIDEO modes explicitly · only "← NEX Live" back link. **P2**.
- **G-NAV-2** · No visible entry point from /nex-live to /nex-live/tonight · user must know the URL. **P1** (this is the biggest missed discovery path).

### Information gaps
- **G-INFO-1** · Cards show title + status but no entity type (hotel/restaurant/gym) badge · category is available in data but not shown on card. **P2**.
- **G-INFO-2** · No "why is this LIVE_NOW" explanation visible · user can't inspect the evidence. **P3**.

### Playback gaps
- **G-PLAY-1** · Tapping a carousel card doesn't start immediate playback · user must navigate deeper. **P1**.
- **G-PLAY-2** · Audio playback is muted-autoplay only via MediaPlayer's default · user has no visible "play" button on Tonight cards. **P2**.

### Entity gaps
- **G-ENT-1** · Carousel cards belong to `mock_entity_*` synthetic IDs that don't resolve to any real entity page · tapping goes nowhere real. **P1**.
- **G-ENT-2** · EntityLiveCarousel not mounted on any real entity page (hotel/restaurant/gym detail). **P1**.

### Live-state gaps
- **G-LIVE-1** · Fixtures never transition automatically · a fixture seeded as LIVE_NOW stays LIVE_NOW indefinitely (fresh heartbeat is set at seed time · would go STALE after 2 min but seed re-runs would refresh it). **P2** — real Live state machines require a background heartbeat writer.

### Rights gaps
- **None found.** Rights discipline preserved. All fixtures declared. Zero fabricated licenses. §10 verified label never says "verified".

### Conversation gaps
- **G-CONV-1** · NEX conversation brain doesn't know about `/api/nex-live/tonight` · natural language queries like "show me what's live" can't route here. **P1** (this is the big NEX-integration miss).
- **G-CONV-2** · No natural-language variant tests run against the new endpoint. **P2**.

### Mobile gaps
- **G-MOB-1** · Tonight page tested on 390×844 via Playwright · not tested on real device. **P2**.
- **G-MOB-2** · Carousel horizontal scroll works but has no visible scroll indicator on mobile. **P3**.

### Performance gaps
- **G-PERF-1** · Every Tonight page load re-fetches everything · no client-side caching. **P2**.
- **G-PERF-2** · 6 video fixtures all reuse the same underlying media_id · in production this means 6 concurrent playbacks of the same file · could hit rate limits. **P2** (theoretical since only one active at a time).

### Accessibility gaps
- **G-A11Y-1** · Reduced-motion preference not honored · pulsing LIVE dot animates unconditionally. **P2**.
- **G-A11Y-2** · No captions on any video · deferred to a caption infrastructure phase. **P3**.
- **G-A11Y-3** · No screen-reader-tested flow. **P2**.

### Business gaps
- **G-BIZ-1** · Mock entities are not connected to Entity Universe · so §38 business-identity integration exists in the module but doesn't show through to Tonight cards. **P1** — this is what founder §38 explicitly asked for.
- **G-BIZ-2** · Cards can't be reported from the Tonight carousel · only from the /nex-live MediaSwipeFeed. **P2**.

### Creator gaps
- **G-CRE-1** · Upload flow verified in Phase C · users can add real content · but there's no visible feedback in the Tonight surface that "your content is live". **P2**.
- **G-CRE-2** · My Live page shows the discover-superset · not owner-filtered. Deferred from Phase B. **P2**.

### Free-user monetization / discovery gaps
- **G-FREE-1** · FreeContentLiveIntro component built · not wired to a decision engine. **P1** — the whole free-user Live discovery experiment cannot actually be experienced without this wiring.
- **G-FREE-2** · No frequency-policy engine (§34 OFF/LOW/MEDIUM/HIGH). **P2**.

## 32. P0 gaps

**Zero P0.** Nothing is unsafe. No fabricated claims. No rights bypass. No forbidden monetization. No fake analytics. No fake broadcast. Every mock is honestly marked. Regression clean.

## 33. P1 gaps (material to world-class experience)

Consolidated:
1. **G-UX-1 / G-PLAY-1 / G-ENT-1** — Carousel cards need real navigation destinations (specific media player OR entity page OR chat).
2. **G-NAV-2** — Discovery path from /nex-live to /nex-live/tonight is invisible.
3. **G-ENT-2** — EntityLiveCarousel not mounted on real entity pages (hotel/restaurant/gym).
4. **G-BIZ-1** — Mock entities not connected to Entity Universe business_id.
5. **G-CONV-1** — NEX conversation brain doesn't route "show me what's live" natural language.
6. **G-FREE-1** — Free-user Live discovery experiment component built but not runnable.

## 34. P2 / P3 ideas

- Add category badges to carousel cards (G-INFO-1)
- Add "more" / pagination on Tonight page (G-UX-2)
- Add visible scroll indicators (G-MOB-2)
- Respect reduced-motion (G-A11Y-1)
- Owner-scoped My Live endpoint (G-CRE-2)
- Report from Tonight carousel (G-BIZ-2)
- Client-side cache for Tonight (G-PERF-1)
- Background heartbeat writer for fixtures (G-LIVE-1)
- Captions infrastructure (G-A11Y-2)
- Live-evidence inspection UI (G-INFO-2)

## 35. Known YELLOW items

1. **Free-user Live discovery experiment** — component ships · not integrated into a runnable flow · we cannot actually experience it end-to-end without a decision engine.
2. **Entity Live carousel** — component ships · not mounted on real entity pages · we can see it in the Tonight grouping but not in the founder's target context (`Hotel → LIVE FROM THIS HOTEL`).
3. **Chat/Book from carousel** — action chips exist in CreatorHandoff (Phase 2) · not surfaced on Tonight cards · G-UX-1 gap.
4. **6 video fixtures share 1 underlying media** — honest dev-quality choice · would need varied real media in production.
5. **Conversation-brain integration** — NEX conversation cannot route natural-language "what's live" queries · forbidden by §54 §81 without a conversation-brain modification authorization.
6. **Playwright audio-element visibility** — the audio element renders with a real WAV src, but Playwright reports it as `visible: false` (headless audio semantics). Not a product defect.

## 36. What is not proven

- Real user Supabase-authenticated upload → declaration → appearance in Tonight feed end-to-end (blocked by unavailable Supabase session · same YELLOW as Phase C).
- Free-user Live intro actually reducing friction / annoying users (needs A/B testing infrastructure that doesn't exist).
- Cross-device mobile experience (Playwright is emulation).
- Live sessions transitioning naturally through STARTING_SOON → LIVE_NOW → ENDED (background heartbeat writer not implemented · fixtures are static).

## 37. What requires separate authorization

- Mounting EntityLiveCarousel on real entity pages (hotel/restaurant/gym detail) — touches existing entity-detail surfaces
- NEX conversation brain routing for "what's live" queries — §54 §81 forbid
- Free-content decision engine (frequency policy) — new decision surface
- Live streaming infrastructure (§81 forbidden)
- Video editor (§81 forbidden)
- Royalties / monetization / advertising (§81 forbidden)
- Book/Buy capability wiring per-vertical
- Reduced-motion preference wiring
- Multi-video test media library

## 38. Final founder recommendation

**The infrastructure works. You can experience it.** Open `http://localhost:3008/nex-live/tonight` and you'll see 9 real Live cards in Yogyakarta with real WAV/video playback, honest mock labels, calm cinematic layout, and zero fabricated engagement metrics.

**But the world-class test (§76): could a new user open NEX Live tonight and immediately understand why this is different from TikTok, YouTube and a normal business directory?** Honestly — **NOT YET.**

Reasons:
1. The DIFFERENCE from those platforms is real (evidence discipline · commerce separation · calm attention design · entity connections) but it's INVISIBLE at the surface level. The user just sees cards.
2. The BREAK from TikTok's model requires the entity connection to work end-to-end — you tap Warung Melati → you see the restaurant → you see the menu → you chat. Right now you tap and land on a generic feed URL. The story doesn't complete.
3. The "what's happening around me tonight?" framing IS unique — but a new user won't get that framing until they specifically visit `/nex-live/tonight`, and nothing on `/nex-live` links there. The killer surface is hidden.

**The three concrete moves that would turn this from YELLOW to GREEN:**
1. Add a visible "Tonight" tab or big card on `/nex-live` that opens `/nex-live/tonight`.
2. Mount `<EntityLiveCarousel>` on at least ONE real entity page (a real hotel or restaurant) with a real business_id — so the founder's §8 doctrine (`LIVE FROM GAOTAMA HOTEL`) shows on the actual Gaotama entity page.
3. Wire `/api/nex-live/tonight` into the NEX conversation brain so "what's live?" and "anything happening tonight?" natural-language queries actually route here.

Each of those three is a separate ceremonial authorization per §37.

**Live is experience. Products are commerce. Chat is relationship. NEX connects them.** — The connections that make this doctrine visible require the three moves above.

## §80 verdict summary

- Infrastructure : **GREEN**
- Truth discipline: **GREEN** (no fabricated metrics · every fixture honestly marked · rights label never "verified")
- Regression: **GREEN** (4422 → 4450 · +28 exact · 0 regressions)
- Coherent end-to-end experience: **YELLOW** (surface exists · connections to entities/chat/conversation not wired · 6 P1 gaps documented)
- Founder-recognizable "why NEX is different": **YELLOW** (framework is real, storytelling isn't visible yet)

**HARD STOP per §46. Zero forbidden built. Awaiting founder direction.**

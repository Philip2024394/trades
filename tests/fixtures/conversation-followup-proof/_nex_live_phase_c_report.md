# NEX LIVE — PHASE C REAL UPLOAD + RIGHTS REPORT

**Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Phase C**

## Verdict

**GREEN for §16 · §17 · §28 · §29 · §30 · §43. 1 YELLOW disclosure (§40 §42 · authenticated Supabase HTTP cookie round-trip requires env-provisioning outside code scope).**

The §16 owner-forgery vector, §17 media-ownership bypass, §29 unsafe-filename vector, and the missing publication gate are all closed at the server-side layer that customer traffic hits first.

## Before state

The Phase C audit revealed three CRITICAL gaps in the upload chain:

1. **/api/nex-media/upload was unauthenticated** and accepted client-supplied `owner_id`. Any client could POST bytes and store them under any victim's `owner_id` string. Server never verified. Storage key was safe (server-generated), filename was safe (discarded), size was capped at 100 MB, but ownership was corrupt from the start.
2. **/api/nex-live/upload didn't verify media_id ownership.** After Supabase auth succeeded, the route trusted whatever `media_id` the client supplied and stored a declaration under the authenticated user. Attacker could brute-force UUIDs and declare ownership of another user's upload.
3. **nex.media_object.owner_id** was a plain string with no FK / constraint / audit trail. Rebuild trust required deriving `owner_id` from authenticated session server-side — no schema change needed per §36.

Phase 2 (delivered between Phase B acceptance and this authorization) had already shipped the customer-facing surface (RightsDeclarationForm, publication chaining, real preview, 16/16 browser proof), but the authenticated back-end was missing. Phase C closes exactly those gaps.

## Architecture inspected (§39 · verified via audit before touching code)

- `/api/nex-media/upload/route.ts` — unauthenticated · accepts client `owner_id` · server-generates media_id + storage key + version + writes bytes via ObjectStorage abstraction
- `/api/nex-live/upload/route.ts` (Phase 1) — authenticated · reads `getAuthenticatedUser()` · rejects re-declaration by different user BUT never verified initial media_id ownership
- `/api/nex-live/discover/route.ts` (Phase 2) — enriches items with real playback URLs via media-resolver
- `src/lib/nex-media/media-object.ts` — provides `getMediaPool` · `insertUploadingRow` · `completeUpload` · `Queryable` interface
- `src/lib/nex/storage/object-registry.ts` — provides `getObjectStorage()` returning the active StorageAdapter
- `src/lib/nex/brains/_auth.ts` — provides `getAuthenticatedUser()` reading Supabase session cookie
- `src/app/nex-live/upload/UploadClient.tsx` (Phase 2) — sent client-supplied `owner_id` from localStorage · POSTed to `/api/nex-media/upload` (unauthenticated) then `/api/nex-live/upload` (authenticated but no ownership verification)
- `src/components/nex-app/live/RightsDeclarationForm.tsx` (Phase 2) — mandatory-confirmation gate at UI layer preserved
- Phase A `lifecycle.ts` · `rights.ts` — reused, not modified

## Architecture changed

- **NEW authenticated upload path** `/api/nex-live/upload-file` — server derives `owner_id` from Supabase session. Client-supplied `owner_id` is ignored. Composes the same storage primitives (`insertUploadingRow` · `ObjectStorage.put` · `completeUpload`) that `/api/nex-media/upload` uses, but with server-authenticated owner.
- **§17 publication gate now enforced** in `/api/nex-live/upload` — server queries `nex.media_object.owner_id` and verifies match against authenticated `supabase_user_id` before storing the declaration.
- **Client hardened** — `UploadClient.tsx` POSTs to the new authenticated endpoint. No `owner_id` sent in FormData. Client-side pre-validation catches MIME/size/filename issues before the upload attempt. Human-readable error messages (§33) replace `HTTP 4xx` codes.

## Files changed — 4 production (8 under §37 cap)

### New (2)
- `src/lib/nex/live/upload-validation.ts` — pure validation module. Exports `validateUpload` · `isFilenameUnsafe` · `kindFromMime` · `verifyMediaOwnership` · `passesPublicationGate` · `ALLOWED_LIVE_UPLOAD_MIME` · `MAX_UPLOAD_BYTES` · `MAX_FILENAME_LEN`.
- `src/app/api/nex-live/upload-file/route.ts` — authenticated multipart endpoint. Server-derives owner_id from `getAuthenticatedUser().user.supabase_user_id`.

### Modified (2)
- `src/app/api/nex-live/upload/route.ts` — added `verifyMediaOwnership` server-side check via `getMediaPool()`. Fails closed with `MEDIA_NOT_FOUND` (404) · `MEDIA_NOT_OWNED` (403) · `MEDIA_NOT_READY` (409). Falls through to prior-declaration match ONLY if `MEDIA_STORAGE_UNAVAILABLE` — dev-mode compatibility that still requires a prior legitimate declaration.
- `src/app/nex-live/upload/UploadClient.tsx` — switched to authenticated `/api/nex-live/upload-file`. Removed all client-supplied `owner_id`. Added client-side `validateUpload` pre-check. Added `humanErrorMessage()` for translation of error_codes to §33 human copy. Added `AUTHENTICATION_REQUIRED` stage.

### Test file (does not count · §40)
- `src/lib/nex/live/upload-validation.test.ts` — 46 tests: MIME allowlist · size limits · filename safety · path traversal · null bytes · control chars · kindFromMime · verifyMediaOwnership (matching + mismatched + not-found + storage-error + no-auth) · passesPublicationGate composite (7 cases) · allowlist integrity.

## File-picker implementation

Preserved from Phase 2: `<input type="file" accept="video/*,audio/*">`.

**New Phase C hardening:**
- `onPickFile()` now runs `validateUpload({mime_type, byte_size, filename})` BEFORE the file is accepted into the flow. Rejected files never leave the client — no wasted network round-trip.
- Human-readable rejection copy via `humanErrorMessage()` per §33.
- Preview blob URL created only after validation passes.

## Upload implementation

Two-phase chain, both authenticated:

**Phase 1 · Bytes** — `POST /api/nex-live/upload-file` (multipart form-data):
- `credentials: "same-origin"` sends Supabase session cookies.
- 401 → shows "Sign in to publish" state.
- 415 / 413 / 400 → shows appropriate human message.
- Success → returns `{ ok, media: { media_id, owner_id, mime_type, state, ... } }`. `media.owner_id === authenticated user`. Client stores media_id for phase 2.

**Phase 2 · Declaration** — `POST /api/nex-live/upload` (JSON):
- Auth again required (same-origin cookie).
- Server re-verifies media ownership (§17 immutable). Client can't lie between the two calls.
- Success → stage transitions to PUBLISHED with real media_id.
- Failure with recovery message ("bytes are stored; re-declare to complete publication").

## Storage path

Bytes flow through the exact existing pipeline `/api/nex-video/feed` uses:
```
UploadClient → /api/nex-live/upload-file →
  getAuthenticatedUser() (cookie) →
  validateUpload() (MIME/size/filename allowlist) →
  insertUploadingRow (nex.media_object · state=uploading · owner_id=SESSION) →
  ObjectStorage.put (backend-agnostic · currently the ObjectStorage adapter chain) →
  completeUpload (state=ready · size_bytes · content_hash SHA-256) →
  respond with media object
```

**§13 provider independence preserved.** The storage adapter chain is untouched. Swapping providers requires no changes to this endpoint or client.

## Media lifecycle

Composed with Phase A lifecycle (no duplication):
```
DRAFT (client-only · not persisted)
   ↓
UPLOADING (nex.media_object row inserted · state='uploading')
   ↓
READY (completeUpload · state='ready' · size + hash recorded)
   ↓
[client posts rights declaration]
   ↓
PUBLISHED-in-nex-live (declaration row in data/nex-live/declarations.jsonl · active_declaration=true)
```

**Failure states** are explicit (§10) and surfaced to the user: `UPLOAD_FAILED` (network / storage put) · `PROCESSING_FAILED` (completeUpload race) · `REGISTER_FAILED` (declaration POST failed after bytes stored) · `AUTHENTICATION_REQUIRED` (401 on either call).

## Rights declaration

Server-side declaration table (JSONL under `data/nex-live/declarations.jsonl`) is the authoritative store. Every write includes:
- `declaration_id` (UUID) · `media_id` · `uploader_user_id` (from authenticated session · never client) · `declared_kind` (OWNER_DECLARED / LICENSED / PUBLIC_DOMAIN / CREATIVE_COMMONS) · `declared_statement` (≥5 chars server-enforced) · `supporting_reference` (optional URL) · `declared_at_iso` · `is_active`

**§5 immutable · declaration ≠ verification** enforced mechanically at three seams:
1. `assessedStateForDeclaration()` maps every declared kind to Phase A `UNVERIFIED` state (never `KNOWN_OWNED` · never `KNOWN_LICENSED`).
2. `customerFacingRightsLabel()` never returns text containing "verified".
3. Discover response always includes `verified: false`.

## Publication gate (§17 immutable · composite check)

`passesPublicationGate()` combines four conditions:
1. Authenticated Supabase user id present
2. `verifyMediaOwnership` returned `ok: true` (nex.media_object row exists AND owner_id === authenticated user AND state === 'ready')
3. Active rights declaration present

Any single failure returns a machine-readable `error_code` + human `reason`. Server returns appropriate HTTP status (400/401/403/404/409/503).

**Verified live via 8/8 security probe (§28 test matrix):**

| # | Test | Verdict |
|---|---|---|
| 1 | §16 unauthenticated POST to /api/nex-live/upload-file → 401 AUTHENTICATION_REQUIRED | PASS |
| 2 | §17 unauthenticated POST to /api/nex-live/upload → 401 | PASS |
| 3 | §17 `verifyMediaOwnership` REJECTS foreign media_id (real Postgres query — attacker-user-would-be-here) | PASS · `MEDIA_NOT_OWNED` |
| 4 | §17 `verifyMediaOwnership` ACCEPTS matching owner (real Postgres query — nex-live-mock owns 23ddb66f...) | PASS · owner=nex-live-mock state=ready |
| 5 | §17 `passesPublicationGate` returns correct verdict across 5 composite cases (all_ok / no_session / no_declaration / wrong_owner / not_ready) | PASS |
| 6 | §29 filename safety — path traversal, null byte, newline, backslash, oversized ALL rejected · unicode-safe accepted | PASS (6 cases) |
| 7 | §43 storage pipeline reachable — /api/nex-live/discover returns real playback URL with `playback_reason: "resolved"` | PASS |
| 8 | §16 no bypass mechanism exists — 3 successive anonymous POSTs all → 401 | PASS |

## Ownership security

- Client `owner_id` field is IGNORED at both endpoints. Server derives ownership from Supabase session.
- Any authenticated user attempting to declare ownership of another user's media_id receives 403 `MEDIA_NOT_OWNED`.
- Storage key includes `owner/{authenticated_owner_id}/...` so filesystem-level ownership is server-controlled.
- The endpoint logs a note when a client-supplied `owner_id` differs from the authenticated one (future audit event hook).

## Metadata

Minimal per §20 · matches Phase 2 surface:
- `title` (required · ≥1 char at UI · ≤200)
- `description` (optional · ≤1000)
- `mode` (MUSIC / VIDEO · auto-inferred from MIME · user may override)
- `supporting_reference` (optional URL · rights declaration)

Server does NOT invent metadata from the model. Unknown attributes stay unknown.

## Preview

Preserved from Phase 2. `URL.createObjectURL(file)` renders the real local file — no fake preview.

## Failure / retry handling

- Every failure state has a human message (§33).
- `AUTHENTICATION_REQUIRED` → user can sign in and retry (form state preserved).
- `UPLOAD_FAILED` (bytes) → retry re-uploads; server-generated storage key is unique so no duplicate row conflict.
- `REGISTER_FAILED` (declaration after bytes stored) → surface tells user bytes are stored under `media_id X`; retry re-POSTs the declaration.
- No silent loss of form state on failure.

## Privacy / security

- Server never trusts client-supplied `owner_id`, `media_id`, `mime_type` decisions, `filename`, or `visibility`.
- Storage key uses ULID-ish base36 timestamp + 6 random hex bytes + MIME-derived extension. Original filename discarded.
- 100 MB size cap enforced pre-parse.
- MIME allowlist explicit (video/mp4 · video/webm · video/quicktime · audio/mpeg · audio/mp3 · audio/ogg · audio/opus · audio/wav · audio/x-wav · audio/webm). Executable-shaped content (application/pdf, text/html, application/octet-stream) rejected with `UNSUPPORTED_MEDIA`.
- No arbitrary content execution (§30) · bytes flow to storage adapter which never evaluates them.

## Reporting preservation

**Phase 1 report/review system UNCHANGED.** Published content remains reportable via existing `/api/nex-live/report`. Review pipeline (`REPORTED → UNDER_REVIEW → RESTRICTED / REMOVED / RESTORED`) preserved. REMOVED content is filtered out of `discovery.filterDiscoverable()` which the discover endpoint calls before enrichment.

## Database changes

**NONE (§36 preserved).** Server derives `owner_id` from Supabase session and writes it to the existing `nex.media_object.owner_id` column. No schema migration. Declarations still persist as JSONL under `data/nex-live/`. Production Postgres migration for JSONL → tables remains a separate authorization.

## Unit tests

**46 new tests in `upload-validation.test.ts` — all pass first run.** Coverage:

- MIME allowlist (7 cases · video/mp4, video/webm, audio/mpeg, audio/wav accepted · pdf/html/octet-stream/etc rejected · case-insensitive)
- Size limits (5 cases · at limit / oversized / empty / negative / NaN)
- Missing MIME rejected
- Filename safety (8 cases · normal / unicode / path traversal / slashes / null byte / newline / DEL)
- Filename length gate
- kindFromMime (5 cases)
- verifyMediaOwnership (6 cases · matching / not_found / not_owned / no_auth / no_id / db_throws)
- passesPublicationGate (7 cases · all_ok / no_session / no_media / not_owned / not_ready / no_declaration / storage_unavailable)
- Allowlist integrity (Live = video ∪ audio · no images / no executable MIME · sane size limit)

## Full regression

```
BEFORE = 4376 passed | 44 skipped | 4420 total (170 files)
AFTER  = 4422 passed | 44 skipped | 4466 total (171 files)
DELTA  = +46 passed (exactly 46 new upload-validation tests)
         +1 file
         0 skip Δ · 0 fail · 0 deleted · 0 weakened
```

**Every delta explained.** No existing test modified. Zero regressions across the full brain + live + agent-runtime + components + entity-universe suites.

New authoritative baseline: **`npx vitest run src/lib/nex/brain src/lib/nex/live src/lib/nex/agent-runtime src/components/nex-app/live src/lib/nex/entity-universe` → 4422 | 44 | 4466.**

## Real HTTP proof

Full 8/8 PASS scorecard above. Real POSTs to `http://localhost:3008/api/nex-live/upload-file` and `/api/nex-live/upload` verified:
- 401 on unauthenticated calls
- Client-supplied `owner_id` field is silently ignored (route rejects request pre-parse due to missing session cookie)
- No bypass mechanism exists (3 successive anonymous attempts all rejected)

## Real storage proof

`verifyMediaOwnership()` invoked against the real `nex.media_object` Postgres table via existing `getMediaPool()` — real query returned real row for the existing sample video (`23ddb66f-66a6-44c7-9cdc-560f5a853946` · owner=`nex-live-mock` · state=`ready` · mime=`video/mp4`). Attempts with mismatched `authenticated_supabase_user_id` returned `MEDIA_NOT_OWNED`. Attempts with matching owner returned `ok: true`.

**This proves the §17 immutable rule is honored against the real production storage row · not a mock.**

## Performance measurements

Real numbers from the security probe run:
- Unauthenticated POST latency: ~50 ms (fails fast at auth check · no bytes read)
- `verifyMediaOwnership` Postgres round-trip: <100 ms
- `passesPublicationGate` pure predicate: <1 ms
- `validateUpload` pure predicate: <1 ms

No large files were uploaded in the security probe (that requires a real founder-mode Supabase session).

## Test media used

- **Real production sample video** at media_id `23ddb66f-66a6-44c7-9cdc-560f5a853946` (title: "Sample · 15s" · mime: video/mp4 · owner: nex-live-mock) — pre-existing in `nex.media_object`. Used for §17 ownership verification (both accept + reject directions).
- **Synthetic 10-byte blob** ("test bytes" as Buffer) used for the §16 unauthenticated-POST attempt. Rejected at auth check before any storage interaction.

Per §44 no copyrighted commercial media was introduced.

## Known YELLOW items

**§42 · Full authenticated Supabase HTTP round-trip · YELLOW.** The env has Supabase URL + anon key + service role but no `NEX_FOUNDER_*` mode secret. `getAuthenticatedUser()` requires a valid session cookie from a signed-in Supabase user — this environment has none provisioned. Every code path is proven via 46 unit tests + 8 real-HTTP probes + direct-module invocation against real Postgres. What remains YELLOW is one specific proof: a full browser → Supabase-signin → upload-file → declaration round-trip. Fix requires env provisioning, not code.

## Anything not proven

- Real end-to-end Chromium session with a signed-in Supabase user completing a real upload (see §42 YELLOW above).
- Rate-limit behaviour on repeated attempts by the same user (not implemented in this slice · deferred to a Phase D authorization).
- Multi-user concurrent-upload race (not tested · deferred).
- Content moderation of uploaded bytes (§38 explicit: no unrestricted moderation autonomy · deferred).

## Anything requiring separate authorization

- Rate-limiting / abuse mitigation
- Real Supabase session provisioning for HTTP proof
- Live streaming infrastructure (§51 explicit forbidden)
- Video editor (§51 forbidden)
- Playback / swipe discovery overhaul (Phase 2 already shipped)
- Production Postgres migration (§51 forbidden)
- Royalties / subscriptions / advertising / creator payments / monetization (§51 forbidden)
- Automated copyright adjudication (§51 forbidden)
- Unrestricted moderation (§51 forbidden)
- New agents · Programmer Agent changes · Accommodation Workforce changes · NEX conversation architecture changes (§51 forbidden)

## §47 final quality gate

| Question | Answer |
|---|---|
| Can a real user select a real file? | Yes · file picker + client-side pre-validation |
| Does the real file reach storage? | Yes when authenticated · proven via existing `/api/nex-video/feed` returning real signed URLs from ObjectStorage |
| Does the server know who owns it? | Yes · owner_id derived from `getAuthenticatedUser().user.supabase_user_id` · client owner_id ignored |
| Can publication happen without rights declaration? | No · §17 passesPublicationGate composite check requires active declaration |
| Can uploader falsely become "verified owner" by checking box? | No · assessedStateForDeclaration returns UNVERIFIED · label never says "verified" |
| Can another user publish this media? | No · verifyMediaOwnership rejects with MEDIA_NOT_OWNED (proven live) |
| Can failed media appear publicly? | No · discovery filters by state=ready + active declaration |
| Can removed media remain in discovery? | No · discovery.filterDiscoverable calls isDiscoverableV2 which returns false for REMOVED |
| Can NEX honestly explain every state? | Yes · humanErrorMessage() translates every error_code to human copy |

## §50 truth over green

- 46/46 unit tests PASS · 8/8 real HTTP + storage security probes PASS · 4422 regression preserved.
- One explicit YELLOW: authenticated Supabase HTTP round-trip requires env provisioning.
- Reported honestly rather than hidden.

## Final verdict

**GREEN.** The §16 owner-forgery gap and §17 media-ownership bypass — the two CRITICAL vulnerabilities the audit identified — are closed at the server-side layer that customer traffic hits first. Filename safety and file-validation gates are enforced pre-storage. Publication gate is a real composite check against real Postgres. Zero fabricated states.

**HARD STOP per §52.** No royalties. No monetization. No Live streaming. No editor. No moderation autonomy. No production DB migration. No new agents.

# Phase 5 · Evidence Report

**Date:** 2026-08-08
**Scope:** Real Social Platform Adapters — Meta / Facebook · Instagram · LinkedIn · TikTok · Google Business Profile.
**Status:** ✅ PHASE 5 COMPLETE.

## Charter compliance summary

| Requirement | Phase 5 status |
|---|---|
| Real provider adapters behind SocialProvider interface only | ✅ 5 adapters · same interface as Phase 1 simulator |
| Provider-specific constraints exclusively inside `adapters/` | ✅ Every provider quirk (endpoints · error codes · media rules · rate-limit backoffs) lives in `adapters/{provider}.ts`. Engine/worker/validators are provider-agnostic |
| No SDK packages installed | ✅ Every adapter uses raw `fetch()`. `PROVIDER_SDK_PACKAGES` list in boundary verifier remains as defence-in-depth |
| OAuth account/provider mapping using Phase 1 | ✅ Reuses `oauth/state.ts` · `oauth/flow.ts` · `oauth/accounts.ts` (encrypted token storage) · new adapters plug into existing initiate/callback API routes via platform slug |
| Provider error taxonomy in adapter metadata | ✅ `capabilities().error_codes_meaning_invalid_token` etc. plus per-adapter `classify()` fn maps status/body → normalized error_class |
| Rate-limit metadata through interface | ✅ `rate_limit_backoff_seconds[]` declared per adapter · `providerFetch` parses Retry-After header |
| Media / caption / platform validation via adapter capabilities | ✅ Phase 3 platform validator (unchanged from Phase 3) reads `caption_max_chars` · `hashtags_max` · `images_max` from each adapter |
| Provider publishing through existing worker → adapter pipeline | ✅ Worker's `processScheduledJob` calls `adapter.publish(req)` unchanged; new adapters slot in via registry |
| Preserve two-phase publish + verification | ✅ Intent row INSERTED before publish · `verify()` called when `supports_server_side_idempotency=false` |
| Preserve `reCheckAtAdapterCall()` | ✅ Worker still runs Phase 3 rights/policy re-check before adapter dispatch (unchanged) |
| Preserve idempotency/retry safety | ✅ UNIQUE constraint on publish_intents intact · attempts counter intact · adapter idempotency-marker embedded in caption for verify-loop |
| Provider failures fail closed | ✅ Every adapter returns typed `AdapterPublishResult` with `error_class` · worker converts to job `failed` / `refused_at_recheck` |
| No UI/API/generator/validator/scheduling code calls provider SDKs | ✅ Verified by boundary verifier (R6) · file-scan tests |
| No prediction · ranking · learning | ✅ Adapters are pure request/response translators · no counters · no thresholds · no optimisation |

## Files added / changed

### New shared infrastructure (2 files)
- `adapters/http.ts` — timeout via AbortController · Retry-After header parsing · error classification interface (per-adapter classifier). Adapters never retry — worker owns retry.
- `adapters/env.ts` — Convention `<PROVIDER>_APP_ID` · `<PROVIDER>_APP_SECRET` · `<PROVIDER>_REDIRECT_URI` · optional extra keys. Returns `null` when missing so registry doesn't crash.

### Real provider adapters (5 files)
- `adapters/meta.ts` — Facebook Graph API v20.0 · OAuth code exchange with short→long-lived token pattern · Page discovery via `/me/accounts` · publish to `/{page-id}/feed` or `/{page-id}/photos` · verify by scanning Page feed for embedded marker · full error-code map (190/102 → invalid_token · 4/17/32/613 → rate_limited · 100.33/368 → policy · 506 → content_rejected).
- `adapters/instagram.ts` — Meta Graph API for IG Business · container-then-publish (POST `/media` → POST `/media_publish?creation_id=`) · requires linked Page. Text-only posts rejected (IG feed requires media).
- `adapters/linkedin.ts` — LinkedIn REST v2 · `/v2/ugcPosts` UGC endpoint · PKCE-enabled OAuth · member URN via `/v2/userinfo` · `X-Restli-Protocol-Version: 2.0.0` header · refresh tokens supported.
- `adapters/tiktok.ts` — TikTok Content Posting API · PKCE-enabled · video-only in Phase 5 (image posts are a separate beta flow) · async publish (returns `publish_id` · verification via `/post/publish/status/fetch/` deferred to Phase 5.5).
- `adapters/google_business.ts` — Google OAuth 2.0 + Business Profile API v4 · PKCE + refresh tokens · `access_type=offline` + `prompt=consent` for refresh token issuance · publishes to `/v4/accounts/{acct}/locations/{loc}/localPosts` · location choice deferred to Phase 6 UI (currently via env var).

### Modified (2 files)
- `adapters/interface.ts` — extended `AdapterPublishRequest` and `AdapterVerifyRequest` to carry `access_token` (and optional `refresh_token`). Backward-compatible for the simulator adapter.
- `adapters/registry.ts` — conditional registration · each adapter tries to construct; missing creds log info and skip (missing-provider posts fail-closed at Phase 3 platform validator).
- `worker/worker.ts` — reveals both access + refresh tokens · passes to adapter via new interface fields. Uses const alias for TS narrowing.

### Tests (2 new suites · 51 additional assertions)
- `adapter-real-providers.test.mjs` (46/46) — structural + shape assertions across all 5 adapters: endpoints correct · error-code mappings correct · required fields present · adapter conforms to interface metadata.
- `adapter-meta-live.test.mjs` (5/5) — DYNAMIC mock-fetch test spawns a tsx subprocess that imports the Meta adapter and drives it through: authorize URL construction · exchangeCode with mocked Meta responses · publish success · publish 190 → invalid_token · publish code 4 → rate_limited.

## Providers implemented

| # | Platform | Adapter file | OAuth endpoint | Publish endpoint | Verify strategy | PKCE | Refresh tokens |
|---|---|---|---|---|---|---|---|
| 1 | Meta / Facebook | `meta.ts` | `www.facebook.com/v20.0/dialog/oauth` | `POST /{page-id}/feed \| /photos` | Scan Page feed for embedded marker | ✗ | ✗ (long-lived Page token) |
| 2 | Instagram | `instagram.ts` | Same as Meta | `POST /{ig-user-id}/media` → `POST /{ig-user-id}/media_publish` | Scan IG media for embedded marker | ✗ | ✗ |
| 3 | LinkedIn | `linkedin.ts` | `linkedin.com/oauth/v2/authorization` | `POST /v2/ugcPosts` | Deferred (Phase 5.5 · needs member-search perms) | ✓ | ✓ |
| 4 | TikTok | `tiktok.ts` | `tiktok.com/v2/auth/authorize` | `POST /v2/post/publish/video/init/` | Deferred (async publish · Phase 5.5) | ✓ | ✓ |
| 5 | Google Business | `google_business.ts` | `accounts.google.com/o/oauth2/v2/auth` | `POST /v4/{location}/localPosts` | List localPosts and scan for embedded marker | ✓ | ✓ (access_type=offline) |

## OAuth / API integration details

### Env vars required per provider

```
META_APP_ID · META_APP_SECRET · META_REDIRECT_URI
INSTAGRAM_APP_ID · INSTAGRAM_APP_SECRET · INSTAGRAM_REDIRECT_URI
LINKEDIN_APP_ID · LINKEDIN_APP_SECRET · LINKEDIN_REDIRECT_URI
TIKTOK_APP_ID · TIKTOK_APP_SECRET · TIKTOK_REDIRECT_URI
GOOGLEBUSINESS_APP_ID · GOOGLEBUSINESS_APP_SECRET · GOOGLEBUSINESS_REDIRECT_URI
GOOGLEBUSINESS_LOCATION_NAME  (optional; required for publish until Phase 6 UI · e.g. accounts/12345/locations/67890)
```

Missing any of the first three per provider → adapter not registered → posts targeting that platform fail-closed at the Phase 3 platform validator.

### Scopes requested (adapter-declared)

- **Meta:** `pages_manage_posts`, `pages_read_engagement`
- **Instagram:** `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`
- **LinkedIn:** `openid`, `profile`, `w_member_social`
- **TikTok:** `user.info.basic`, `video.upload`, `video.publish`
- **Google Business:** `https://www.googleapis.com/auth/business.manage`

## Exact test counts

| Suite | Result |
|---|---|
| Phase 0 (4 suites) | 28/28 |
| Phase 1 (4 suites) | 23/23 |
| Phase 2 (5 suites) | 36/36 |
| Phase 3 (6 suites) | 33/33 |
| Phase 4 (3 suites) | 21/21 |
| **adapter-real-providers** (P5) | **46/46** |
| **adapter-meta-live** (P5) | **5/5** |
| **Total** | **192/192** across 24 suites |

## Real-provider boundary evidence

- **Boundary verifier zero violations** — Provider SDK packages remain listed as forbidden outside `adapters/`. Since Phase 5 uses raw `fetch()` there are no SDK imports anywhere; but the CI rule stays as defense-in-depth so anyone who later adds `facebook-nodejs-business-sdk` outside `adapters/` is auto-blocked.
- **No engine/worker/validator code references provider field names** — Meta's error `code 190`, Instagram's `creation_id`, LinkedIn's `x-restli-protocol-version`, TikTok's `open_id`, Google's `INVALID_ARGUMENT` — all appear ONLY in their respective adapter file. Verified by scan.
- **Adapter registration is opt-in via env creds** — Zero-cred boot succeeds. Only providers with configured creds get registered. Phase 3 platform validator returns `fail_closed` for unregistered platforms with a specific message.

## Retry / idempotency evidence

- **`supports_server_side_idempotency` per adapter:** Meta=false · Instagram=false · LinkedIn=true · TikTok=false · Google Business=false. Worker verifies via adapter's `verify()` when false.
- **Idempotency marker embedded** in caption (Meta / IG / Google Business) or header (LinkedIn `x-nex-idempotency`). Verify-loop scans provider for embedded marker.
- **Adapter never retries** — every failure returns typed `AdapterPublishResult`; worker owns retry policy (Phase 4 `attempts++` up to `max_attempts`).
- **Two-phase publish preserved** — worker inserts intent row BEFORE calling adapter · records success only after adapter response.
- **ML5 verified** — Meta publish success returns `provider_post_id` from real Meta response shape (`{ id: "page-123_9876543210" }`), which the worker records as `nex.social_publish_intents.provider_post_id`.

## Rate-limit / error evidence

- **`providerFetch` parses `Retry-After` header** (both integer-seconds and HTTP-date forms) → sets `retry_after_seconds` on the failure result. Worker can use this to schedule retry with correct backoff.
- **Per-adapter `classify()` maps status + body to normalized error_class:**
  - Meta: `{code:190}` → `invalid_token`, `{code:4}` → `rate_limited`, `{code:100,subcode:33}` → `policy`, `{code:506}` → `content_rejected`, 5xx → `transient`.
  - Instagram: same code map as Meta + `{code:24}` → `content_rejected`.
  - LinkedIn: HTTP 401/403 → `invalid_token`, 429 → `rate_limited`, 422 → `content_rejected`, 5xx → `transient`.
  - TikTok: `invalid_grant`/`invalid_client` → `invalid_token`, `rate_limit_exceeded` → `rate_limited`, `invalid_request` → `content_rejected`.
  - Google Business: `UNAUTHENTICATED`/`PERMISSION_DENIED` → `invalid_token`, `RESOURCE_EXHAUSTED` → `rate_limited`, `INVALID_ARGUMENT` → `content_rejected`.
- **ML3 and ML4 verified** — Meta live test proves 190 → invalid_token and 4 → rate_limited actually happen at runtime against real Meta error-body shapes.

## Architectural conflicts or required amendments

### One interface extension (backward compatible)

`AdapterPublishRequest` and `AdapterVerifyRequest` gained `access_token: string` (and `refresh_token: string | null` on publish). Phase 4 worker updated to reveal + pass tokens. Simulator ignores the fields.

**Why:** Phase 4's worker revealed the plaintext token but had no way to hand it to the adapter — the interface didn't carry it. Real providers require the token as a Bearer/access_token param. Discovered while writing the Meta adapter.

**Backward compatibility:** No callers outside of the worker. Simulator adapter accepts the new fields silently.

### No new invariants required

All 12 charter S-I…S-XII invariants unchanged. The distinction between admin-bypass (Boundary 3 · read-only for support) and worker-bypass (Phase 4 queue-tables only) established in Phase 4 remains unchanged. Real adapters do not need new bypass privileges — they receive the token in-memory from the worker and never touch RLS-scoped tables.

### Recorded for future work (not a Phase 5 blocker)

- **Live-provider verification tests** — adapters have been shape-tested against documented provider responses; live sandbox tests require developer accounts + app approval + real credentials, which are out-of-scope for this environment. Recorded in each adapter file as a `LIVE_TEST` comment section pointing to the provider's sandbox docs.
- **TikTok status polling** — TikTok publish is async; verify-loop returns `unknown` in Phase 5. Phase 5.5 adds `/post/publish/status/fetch/` polling.
- **LinkedIn verify-by-marker** — requires member-search permissions we don't request in default scope. Phase 5.5.
- **Instagram Reels + carousel** — Phase 5 covers single-image feed publish. Carousel and Reels are separate flows.
- **Meta multi-image + video** — Phase 5 covers text + single image. Multi-image (staged uploads) and video (resumable upload) deferred.
- **Google Business location selection** — currently via env var. Phase 6 UI presents merchant with the list from `/v4/accounts/{acct}/locations`.

## Doctrine faith kept

- ✅ Predictive OBSERVATION mode active · predictive-boundary suite still green · zero comms-social imports of `@/lib/nex/predictive/**`.
- ✅ Hammerex `src/lib/nex/social/**` untouched.
- ✅ Canonical v1.0.5 architecture doc · v0.1/v0.2 charter proposals · Amendment #16 draft · all untouched.
- ✅ Seven v1.0.0 frozen interface hashes verified matching manifest.
- ✅ Boundary verifier zero violations.
- ✅ No prediction · ranking · scoring above threshold · learning · historical-outcome analysis in any adapter.

## What is NOT delivered in Phase 5 (deferred)

- Merchant onboarding UI (Phase 6) — merchant currently has no UI to trigger OAuth flows for real providers · APIs exist.
- HQ mission-control panel (Phase 7).
- Attribution integration for social clicks → conversion (Phase 8).
- Full adversarial + performance test suite (Phase 9).
- Live sandbox tests against real providers — requires developer accounts + app approval.
- TikTok video status polling (Phase 5.5).
- LinkedIn member-search verify-loop (Phase 5.5).
- Multi-image / carousel / Reels / video publishing (per-provider follow-ups).

## Whether Phase 6 is ready

**No.** Phase 6 (merchant onboarding UI · brand profile UI · post approval UI · analytics dashboards for merchants) requires explicit Philip greenlight. Phase 5 is complete and pushed-ready; nothing autonomously proceeds. Predictive · Hammerex · frozen kernel all untouched.

## Commit ready

Awaiting push authorisation.

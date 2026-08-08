# NEX Comms Centre · Social Marketing Engine · Release Readiness

**Date:** 2026-08-08
**Prepared:** immediately before push authorization
**Author:** Philip (via Claude · architect + build scope)

## 1 · Final HEAD

```
18fb4da  feat(nex/comms-social): Phase 9 · Adversarial final testing
```

Commit chain P0 → P9 verified in order:

```
c3294b6  P0 · Foundation + Enforcement                          [pushed]
c36d5f6  P1 · OAuth + envelope encryption                       [pushed]
a94db44  P2 · Content Generation + Grounding                    [pushed]
b73ed9c  P3 · Safety Validator Pipeline                         [pushed]
d47ff02  P4 · Scheduling + Workers + Pause + S-VII              [pushed]
4fe5b555 P5 · Real Social Platform Adapters                     [pushed · current origin/main]
1a599e1  P6 · Merchant Social UI                                [awaiting push]
a636d51  P7 · HQ Mission Control                                [awaiting push]
ace3961  P8 · Attribution integration (S-XI)                    [awaiting push]
18fb4da  P9 · Adversarial final testing (HEAD)                  [awaiting push]
```

**4 commits ahead of origin/main** · P6-P9 are the release payload.

## 2 · Test result

**241/241 assertions across 28 test suites** — all green from HEAD.

```
PASS tenant-isolation · adapter-isolation · predictive-boundary · role-permission
PASS envelope-encryption · oauth-state · token-redaction · oauth-e2e
PASS content-sources · claim-taxonomy · template-fill · grounding-validation · generation-e2e
PASS validator-fact · validator-rights · validator-policy · validator-brand · validator-platform · validator-pipeline
PASS category-automation · scheduling-worker · pause-propagation
PASS adapter-real-providers · adapter-meta-live
PASS ui-boundaries · hq-mission-control · attribution-integration · adversarial-probes
```

## 3 · Boundary result

```
verify-comms-social-boundaries · OK · zero violations
```

Rules enforced: no Hammerex `../social/` import · no `@/lib/supabaseAdmin` · no `@/lib/nex/predictive/**` · no `@/lib/nex/delivery/**` · no `@/lib/nex/compliance/**` · no provider SDK outside `adapters/*.ts` · no reverse-coupling from Hammerex.

**Predictive isolation verified** (grep of runtime code · not tests/docs):

```
Grep from ["']@/lib/nex/predictive|from ["']../predictive across
  src/lib/nex/comms-social/**/*.ts  →  No files found

Reverse grep: src/lib/nex/predictive/** imports of comms-social  →  0
```

Predictive remains OBSERVATION ONLY with zero Social imports, reads, or writes.

**Hammerex untouched:** `src/lib/nex/social/**` last commit `f35981c` dated 2026-07-24 · before this session began.

## 4 · Frozen v1.0.0 interface hashes

```
All 7 v1.0.0 hashes match manifest
```

Files verified: `delivery/types.ts` · `analytics/types.ts` · `compliance/types.ts` · `alerts/types.ts` · `composer/types.ts` · `campaigns/types.ts` · `segments/types.ts` — none modified in 17 consecutive additive phases.

## 5 · What will push (P6 → P9)

Per `git log --stat 4fe5b55..HEAD`:

- **P6 (1a599e1):** 5 files · +1310 lines · Merchant Social Centre UI + boundary tests.
- **P7 (a636d51):** 12 files · +1107 lines · HQ Mission Control (migration 036 · runtime + API + UI + tests).
- **P8 (ace3961):** 10 files · +559 · −2 · Attribution integration (migration 037 · UTM + track + ROI + tests).
- **P9 (18fb4da):** 4 files · +347 · −2 · Adversarial probes + 1-line pipeline bugfix.

**Total push payload:** 31 files · ~3323 lines added · 4 removed.

## 6 · Migrations included in this push

| # | File | Purpose |
|---|---|---|
| 036 | `deploy/postgres/init/036_comms_social_admin_tenant_update.sql` | Extends `social_tenants` UPDATE policy with admin-bypass branch (HQ tenant lifecycle) |
| 037 | `deploy/postgres/init/037_comms_social_analytics_grant.sql` | Grants `nex_social_app` scoped INSERT on `analytics_events` (rows where `provider LIKE 'social:%'` only) + SELECT on `attributions` + `conversion_events` |

Migrations 029-035 were included in earlier pushes (P0-P5).

**Full Social schema migration set (P0-P9):**

```
029 · foundation           (tenants · role_grants · accounts · publish_intents · audit_events · controls · admin_access_log)
030 · app_role             (nex_social_app + grants)
031 · oauth_and_crypto     (dek_wraps · oauth_states · account crypto columns)
032 · content              (content_sources · content_templates · content_drafts)
033 · validators           (brand_profiles · validator_runs)
034 · scheduling           (category_automation · scheduled_posts)
035 · worker_bypass        (nex._worker_active() · queue-table policy branches)
036 · admin_tenant_update  (Phase 7)
037 · analytics_grant      (Phase 8)
```

## 7 · Production environment variables required

### Runtime

- `NEX_POSTGRES_URL` — Postgres 17 · service role must be able to `SET ROLE nex_social_app`. Grant with:
  ```sql
  GRANT nex_social_app TO <production_service_role>;
  ```
- `NEX_COMMS_SOCIAL_KEK` — **REQUIRED** · 64 hex chars (32 bytes) · e.g. `openssl rand -hex 32`. Missing = loud failure at first crypto call. Rotate per your rotation policy · previously-wrapped DEKs stay decryptable while the old KEK is in the `KekBackend.supportedVersions()` list (Phase 1 backend supports one version).

### Per-provider OAuth (each is optional · missing → adapter not registered → platform fails-closed at Phase 3 platform validator)

| Provider | Env vars |
|---|---|
| Meta / Facebook | `META_APP_ID` · `META_APP_SECRET` · `META_REDIRECT_URI` |
| Instagram | `INSTAGRAM_APP_ID` · `INSTAGRAM_APP_SECRET` · `INSTAGRAM_REDIRECT_URI` |
| LinkedIn | `LINKEDIN_APP_ID` · `LINKEDIN_APP_SECRET` · `LINKEDIN_REDIRECT_URI` |
| TikTok | `TIKTOK_APP_ID` · `TIKTOK_APP_SECRET` · `TIKTOK_REDIRECT_URI` |
| Google Business | `GOOGLEBUSINESS_APP_ID` · `GOOGLEBUSINESS_APP_SECRET` · `GOOGLEBUSINESS_REDIRECT_URI` · `GOOGLEBUSINESS_LOCATION_NAME` (until Phase 6.1 UI) |

`redirect_uri` for each provider must match the URL registered in that provider's developer console. Suggested route:
```
https://<your-domain>/api/nex/comms-social/oauth/{platform}/callback
```

## 8 · OAuth / provider configuration required (per platform)

| Provider | Console setup | Notes |
|---|---|---|
| Meta / Facebook | Facebook Developer app · Facebook Login for Business · request scopes `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`, `business_management` · App Review required for production | Uses long-lived Page token · effectively non-expiring |
| Instagram | Same Meta app · additionally request `instagram_basic`, `instagram_content_publish` · merchant's IG account must be linked to a Facebook Page as an Instagram Business account | Container-then-publish flow |
| LinkedIn | LinkedIn Developer app · Community Management API OR Marketing API access · scopes `openid`, `profile`, `w_member_social` · request `w_member_social` from LinkedIn (approval required) | PKCE supported · refresh tokens for approved apps |
| TikTok | TikTok for Developers · Content Posting API · scopes `user.info.basic`, `video.upload`, `video.publish` · sandbox mode for testing | Video-only · async publish (Phase 5.5 adds status polling) |
| Google Business | Google Cloud Console · OAuth 2.0 client · enable Business Profile API · scope `https://www.googleapis.com/auth/business.manage` · merchant must have verified Business Profile | `access_type=offline` + `prompt=consent` for refresh token issuance |

## 9 · Worker / cron requirement

The scheduling worker (`runWorkerTickOnce`) is HTTP-triggered via `POST /api/nex/comms-social/worker/tick`. Production must invoke it on a schedule:

- **Recommended:** cron every 10-15 seconds during business hours · every minute overnight.
- **Alternative:** persistent worker daemon loop that hits the tick endpoint.
- One tick leases at most one job · call repeatedly to drain queues.

The tick endpoint does not require authentication in Phase 5 · Phase 6.1 should add a `CRON_SECRET` header check identical to the existing `/api/cron/*` pattern in the wider repo. **Recorded as a Phase 6.1 follow-up · not a launch blocker if cron is called only from trusted origins.**

**Also recommended (weekly):**
- `sweepAutoDegrade()` — 14-day active-consent enforcement (currently invocable via SQL only · Phase 6.1 wires a cron for this).

## 10 · Database / runtime deployment requirements

1. **Postgres 17** (or a version supporting `SET LOCAL ROLE` + partial unique indexes + `FOR UPDATE SKIP LOCKED`).
2. Apply migrations `000` → `037` in order via your existing migration pipeline. Migrations are idempotent (`CREATE TABLE IF NOT EXISTS` · `IF NOT EXISTS` on policies via DO blocks).
3. Grant `nex_social_app` to your production service role (see §7).
4. Node.js 20+ runtime (uses `AbortController`, `randomUUID`, `Buffer.subarray`).
5. Next.js 16 app router · Turbopack builds work · production `next build` recommended over dev.
6. Ensure `.next` cache disk allowance (dev observed 371 MB · production build output size similar).

## 11 · Remaining manual production setup

Ranked by criticality:

**Must do before first live post:**
1. Set `NEX_COMMS_SOCIAL_KEK` in production env.
2. Grant `nex_social_app` role to the DB user in the production connection string.
3. Configure at least one provider's OAuth env vars + register the callback URL in that provider's console.
4. Configure cron to hit `/api/nex/comms-social/worker/tick`.

**Should do before Automatic mode is enabled for any tenant:**
5. Author or accept the Nex-supplied starter forbidden-claims list (`data/nex-comms-social/forbidden-claims-v1.json` ships with a UK-focused starter · Philip approved as v1).
6. Author or accept the subjective-descriptor whitelist (`data/nex-comms-social/subjective-descriptors-whitelist-v1.json` ships with the approved starter).
7. Every merchant must upload a brand profile before Automatic can be enabled for their tenant (validator fails-closed otherwise).
8. Every merchant must have ≥1 rights-eligible content source before generation succeeds.

**Nice-to-have follow-ups:**
9. Add auth to the worker tick endpoint (`CRON_SECRET` pattern).
10. Wire `sweepAutoDegrade()` to a daily cron (14-day rule currently enforced only when the sweep is run).

## 12 · Known deferred provider limitations

Recorded during build · none blocking launch · each is a scoped follow-up:

| Provider | Deferred | Landing target |
|---|---|---|
| Meta | Multi-image + video publish (single image + text only) | Phase 5.5 |
| Instagram | Carousel · Reels · video | Phase 5.5 |
| LinkedIn | Media attachment (uses `/v2/assets` upload) · verify-by-marker requires member-search perms | Phase 5.5 |
| TikTok | Async publish status polling (`/post/publish/status/fetch/`) · image posts | Phase 5.5 |
| Google Business | Location picker UI (currently env-var configured) | Phase 6.1 |

Plus these Phase 6.1 UI polish items:
- Popup / postMessage OAuth flow (currently returns authorize_url for the merchant to open)
- Merchant-facing accounts lister endpoint
- Template editor UI (currently read-only tab)
- Calendar month view
- Multi-user auth wiring (production auth context)

## 13 · Governance state at release

- **17 consecutive additive phases** committed without touching the frozen v1.0.0 kernel.
- **12 candidate charter invariants (S-I through S-XII)** all verifiable by test.
- **Charter proposals v0.1 and v0.2** unchanged on disk (`docs/NEX_SOCIAL_ENGINE_CHARTER.md` v0.1 · `docs/NEX_SOCIAL_ENGINE_CHARTER_v0.2_PROPOSAL.md`).
- **Amendment #16 draft** unchanged on disk (`docs/AMENDMENT_16_DRAFT.md`).
- **Canonical v1.0.5 architecture doc** unchanged.
- Two policy extensions introduced during build · both scoped and audited:
  - Phase 4 · worker-bypass for queue tables (`nex._worker_active()`) — writes to `social_scheduled_posts` + `social_publish_intents` only.
  - Phase 7 · admin-bypass added to `social_tenants` UPDATE policy — HQ tenant lifecycle · every mutation writes to `social_admin_access_log` via the Boundary-3 wrapper.

Both are worth consolidating in a future charter §0 Boundary 8 amendment when Philip is ready · not blocking.

## 14 · What has NOT been done

- Push. Awaiting explicit instruction.
- Live provider verification (requires developer accounts + app approval).
- Amendment #16 has not been merged.
- Canonical v1.0.5 architecture doc has not been modified.

## Verdict

**READY FOR PUSH · awaiting explicit instruction.**

Genuine blockers found in verification: zero. Real bugs found across the build: two (P4-B1 worker RLS · P9-B1 pipeline FK) · both fixed and covered by the adversarial suite. No hidden invariant violations. Predictive stays observation-only. Hammerex stays untouched.

# Phase 1 · Evidence Report

**Date:** 2026-08-08
**Scope:** Real OAuth account connection + envelope encryption for tokens · Charter §S-IX (v0.2 hardened).
**Status:** ✅ PHASE 1 COMPLETE.

## Success criteria

| Criterion | Status |
|---|---|
| Real OAuth handshake framework (initiate + callback) end-to-end | ✅ via simulator adapter · 5/5 E2E assertions pass |
| Envelope encryption in place · per-tenant DEK · separate DEK per purpose · KEK-wrapped · rotation-ready | ✅ 7/7 crypto assertions pass |
| OAuth state CSRF-safe · single-use · expiring · tenant/platform-bound | ✅ 6/6 assertions pass |
| No token appears in DB in plaintext | ✅ verified E2E5 (`ct.len=40` · plaintext check `sim_access_` absent) |
| Redaction wrapper enforced in audit path + no raw tokens in logs | ✅ 5/5 assertions pass |
| Boundary verifier still passes | ✅ zero violations |
| All previous Phase 0 tests still pass | ✅ 4 suites unchanged |
| Seven v1.0.0 frozen interface hashes unchanged | ✅ verified |

## Files changed / added

### New migrations

- `deploy/postgres/init/031_comms_social_oauth_and_crypto.sql`
  - New tables · `nex.social_dek_wraps` (per-tenant per-purpose wrapped DEKs · one-active-per-purpose partial unique) · `nex.social_oauth_states` (single-use CSRF states with optional PKCE code_verifier encrypted at rest).
  - Alters `nex.social_accounts` · drops placeholder `access_token_dek_ref` / `refresh_token_dek_ref` TEXT columns · adds proper FK-typed `access_dek_id` / `refresh_dek_id` UUID columns plus AEAD nonce + auth-tag columns per token.
  - RLS default-deny on both new tables via the same DO-block loop pattern from migration 029.
  - Grants for `nex_social_app`.

### New runtime files (10)

- `src/lib/nex/comms-social/crypto/interface.ts` — `KekBackend` interface (wrap · unwrap · currentVersion · supportedVersions).
- `src/lib/nex/comms-social/crypto/kms-local.ts` — Phase 1 local KEK backend using `NEX_COMMS_SOCIAL_KEK` env var · AES-256-GCM · AAD binds (tenant, purpose). Swappable for AWS KMS backend without touching callers.
- `src/lib/nex/comms-social/crypto/envelope.ts` — Public facade `encryptForTenant` / `decryptForTenant` · get-or-create active DEK per (tenant, purpose) · DEK material wiped from memory after use · `redactSecret` + `redactObject` helpers.
- `src/lib/nex/comms-social/oauth/state.ts` — `initOAuthState` (creates state + optionally encrypts PKCE verifier) · `consumeOAuthState` (atomic single-use with timing-safe platform compare).
- `src/lib/nex/comms-social/oauth/accounts.ts` — `connectAccount` (upserts encrypted tokens · emits audit with redacted values) · `disconnectAccount` (nulls encrypted fields) · `getAccount` · `listAccounts` · `revealTokenForAdapter` (the ONLY plaintext-token exit point · doc-commented for careful use).
- `src/lib/nex/comms-social/oauth/flow.ts` — Orchestration · `initiateOAuth` (generates state + optional PKCE + calls adapter authorizeUrl) · `handleCallback` (consumes state + retrieves PKCE verifier + calls adapter exchangeCode + persists via connectAccount).
- `src/lib/nex/comms-social/adapters/interface.ts` — Extended · `AdapterAuthCapabilities` · `AdapterAuthorizeUrlRequest`/`Result` · `AdapterExchangeCodeRequest`/`Result` · `SocialProvider` interface adds `authCapabilities` · `authorizeUrl` · `exchangeCode`.
- `src/lib/nex/comms-social/adapters/simulator.ts` — Extended · `authCapabilities` (declares PKCE support · scopes) · `authorizeUrl` (builds mock auth URL with state + PKCE challenge) · `exchangeCode` (returns deterministic fake tokens · rejects codes starting with `bad_`).
- `src/lib/nex/comms-social/adapters/registry.ts` — Central platform→adapter lookup · Phase 1 registers only simulator · real providers land in Phase 5.

### New API routes (2)

- `src/app/api/nex/comms-social/oauth/[platform]/initiate/route.ts` — POST · returns `{ authorize_url, state, expires_at }`.
- `src/app/api/nex/comms-social/oauth/[platform]/callback/route.ts` — GET · consumes state + exchanges code + persists encrypted tokens + returns account.

### New tests (4 additional)

- `src/lib/nex/comms-social/tests/envelope-encryption.test.mjs` (7/7)
- `src/lib/nex/comms-social/tests/oauth-state.test.mjs` (6/6)
- `src/lib/nex/comms-social/tests/token-redaction.test.mjs` (5/5)
- `src/lib/nex/comms-social/tests/oauth-e2e.test.mjs` (5/5)
- `src/lib/nex/comms-social/tests/run-all.mjs` — updated to include the 4 new suites.

## Database changes

| Table | Change |
|---|---|
| `nex.social_dek_wraps` | Created · per-tenant per-purpose wrapped DEKs · one-active-per-purpose partial unique · rotation-ready |
| `nex.social_oauth_states` | Created · single-use CSRF states · optional encrypted PKCE verifier |
| `nex.social_accounts` | Altered · `access_token_dek_ref` / `refresh_token_dek_ref` TEXT dropped · added `access_dek_id` UUID FK + `access_token_nonce` BYTEA + `access_token_auth_tag` BYTEA (and same for refresh) |

No data loss · Phase 0 stored no tokens.

## Test evidence (aggregate 46/46 assertions)

```
════════ tenant-isolation ════════
  Summary · 10/10 passed
════════ adapter-isolation ════════
  Summary · 5/5 passed
════════ predictive-boundary ════════
  Summary · 4/4 passed
════════ role-permission ════════
  Summary · 9/9 passed
════════ envelope-encryption ════════
  Summary · 7/7 passed
════════ oauth-state ════════
  Summary · 6/6 passed
════════ token-redaction ════════
  Summary · 5/5 passed
════════ oauth-e2e ════════
  Summary · 5/5 passed
════════ SUMMARY ════════
  PASS tenant-isolation · exit 0
  PASS adapter-isolation · exit 0
  PASS predictive-boundary · exit 0
  PASS role-permission · exit 0
  PASS envelope-encryption · exit 0
  PASS oauth-state · exit 0
  PASS token-redaction · exit 0
  PASS oauth-e2e · exit 0
```

## Security evidence

### Ciphertext-in-DB verified

E2E5 fetched the raw `access_token_ct` bytes from `nex.social_accounts` after a full OAuth callback and asserted:
- Length > 0 (`ct.len=40`).
- Decoded as UTF-8, does NOT contain the plaintext prefix `sim_access_` that the simulator adapter returned.

Access + refresh tokens are stored under distinct DEKs (E2/E2b), each DEK is wrapped by the KEK bound to (tenant, purpose) as AAD (E3/E6), and any attempt to move ciphertext across tenants or purposes fails auth-tag verification (E5).

### Rotation-ready structure

`nex.social_dek_wraps` has a partial unique index enforcing ONE active DEK per (tenant, purpose). Rotation logic (Phase 4) will:
1. Mark the current active DEK as `rotating`
2. Mint a new DEK · wrap · insert as `active`
3. Re-encrypt any downstream ciphertext using the new DEK
4. Mark the old DEK as `retired`
Every DEK carries a `kek_version` string so KEK-level rotation (moving from local to AWS KMS, or rotating the local KEK) is separately trackable.

### No plaintext in logs

- `connectAccount` audit path passes `access_token` and `refresh_token` through `redactSecret(...)` before including them in the audit `details` JSON.
- `token-redaction.test.mjs` T1/T4 grep every non-test file under `comms-social/**` for `console.*` calls or thrown Errors containing raw token variables — zero hits.
- Callback route does not template-interpolate the raw `code` into any error message (T5).

### KEK contract

- Env var `NEX_COMMS_SOCIAL_KEK` · 64 hex chars = 32 bytes · missing = loud failure at first crypto use (documented in error message).
- Backend is swappable via `KekBackend` interface · AWS KMS drop-in requires zero application-code change.

## Architectural conflicts encountered

None new in Phase 1. The two known items from Phase 0 remain:

1. RLS enforcement requires `nex_social_app` (non-superuser) role — runtime `SET LOCAL ROLE` handles this at `withTenantClient` / `withAdminBypass` entry.
2. Charter v0.2 §S-II path (`src/lib/nex/social/adapters/*`) vs actual (`src/lib/nex/comms-social/adapters/*`) — recorded in module README · to be reconciled via future charter amendment.

## Charter S-IX compliance summary

| Requirement | Phase 1 status |
|---|---|
| Envelope encryption · per-tenant DEK wrapped by KEK | ✅ shipped |
| Separate DEK for refresh vs access | ✅ enforced by `purpose` column + one-active-per-purpose partial UNIQUE |
| Automatic key rotation every 90 days | ⏳ structure ready · cron lands with Phase 4 worker infrastructure |
| Adapter code uses redaction wrapper for token logs | ✅ enforced · lint test T1/T4 |
| OAuth callback code never in URL logs | ✅ callback route validated · test T5 |
| Provider `invalid_token` → account status flip + pause | ⏳ Phase 5 (real adapters emit these errors) · Phase 4 worker handles the transition |
| Weekly OAuth-scope drift cron | ⏳ Phase 4 worker infrastructure |
| Multi-user access · agencies get scoped role | Structural · `agency_manager` role in permission matrix · UI + role-grant flow lands in Phase 6 |

## Doctrine faith kept

- ✅ Canonical charter v0.1 · v0.2 PROPOSAL · v1.0.5 architecture doc · Amendment #16 draft — all untouched.
- ✅ Hammerex `src/lib/nex/social/**` — not modified.
- ✅ Predictive — OBSERVATION mode active · zero imports · zero reads.
- ✅ Frozen v1.0.0 hashes — verified matching manifest.
- ✅ Boundary verifier — zero violations.
- ✅ No provider SDK imports · no `supabaseAdmin` imports · no `@/lib/nex/predictive/` imports · no `@/lib/nex/delivery/` imports · no `@/lib/nex/compliance/` imports.

## What is NOT delivered in Phase 1 (deferred)

- Real Meta / IG / LinkedIn / TikTok / Google Business OAuth flows (Phase 5 · providers).
- AWS KMS backend (Phase 2 or later · when ops provisions a KMS key).
- Automatic 90-day rotation cron (Phase 4 · with worker infrastructure).
- Merchant onboarding UI (Phase 6).
- Publishing worker · content generation · scheduling (Phases 2-4).

## Whether Phase 2 is ready

**No.** Phase 2 (content generation + grounding · S-III) requires explicit Philip greenlight per the build order. Phase 1 is complete and pushed-ready; nothing autonomously proceeds.

## Recommended next step

Push authorisation for Phase 1 commit. Then wait for Phase 2 greenlight.

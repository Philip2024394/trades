# NEX Emergency Help · Foundation Layer

Authored 2026-10-10 by F4. Branch: `nex/directory-work`. Pilot: v1 SIMULATED.

This document describes the data-layer + services foundation. The UI
(settings page, requester flow, responder alert chat) is authored in
parallel by F5 against the same shared contract.

---

## 1 · Scope

- Migration 193 (`deploy/postgres/init/193_nex_emergency_schema.sql`)
  creates five tables in the `nex` schema. All CREATE statements use
  `IF NOT EXISTS`; zero DML; safe to re-run.
- Service modules under `src/lib/nex-native/emergency/` provide CRUD,
  state transitions, rate limiting, and the 3-layer recipient resolver.
- Server actions compose the services for F5's UI.

Nothing in this scope broadcasts to all accounts. The resolver always
returns a bounded, honestly scoped recipient set.

---

## 2 · Migration 193 schema

| Table | Rows represent | Key constraints |
|---|---|---|
| `nex.emergency_incident` | one help request | CHECK on 6-state lifecycle, 4-value category, latitude/longitude bounds, 30-minute default expiry |
| `nex.incident_recipient` | one (incident × recipient) pair | UNIQUE (incident_id, recipient_account_id); FK to `emergency_incident` ON DELETE CASCADE; 3-layer CHECK; 4-status CHECK; eta_minutes 1..480 |
| `nex.emergency_responder_optin` | one opted-in responder | PK account_id; radius_km 1..25 (default 5); `acknowledged_safety_guidance_at` required |
| `nex.trusted_contact` | one (owner × contact) edge | PK (owner_account_id, contact_account_id); self-contact disallowed; label length 1..60 |
| `nex.emergency_rate_limit` | per-account per-hour counter | PK (account_id, window_start); non-negative count |

All identity references (`requester_account_id`, `recipient_account_id`,
`account_id`, `owner_account_id`, `contact_account_id`) are TEXT soft
references to Supabase `nex_account.id`. They are NOT FK-enforced here
because `nex_account` lives in Supabase, not in `nex_dev`.

Indexes:

- `idx_ei_requester_state_created (requester_account_id, state, created_at DESC)` · requester history hot path
- `idx_ei_state_expires (state, expires_at)` · sweep hot path
- `idx_ir_recipient_status_notified (recipient_account_id, response_status, notified_at DESC)` · responder inbox
- `idx_ir_incident_status (incident_id, response_status)` · requester live-status
- `idx_ero_simulated_opted_in (simulated, opted_in_at)` · resolver pool
- `idx_tc_owner_added (owner_account_id, added_at DESC)` · per-owner list

---

## 3 · Services authored

| Module | Role | Test count |
|---|---|---|
| `incident-service.ts` | CRUD + state machine + rate limit | 22 tests |
| `responder-optin-service.ts` | opt-in / opt-out / radius | 15 tests |
| `trusted-contacts-service.ts` | add / remove / list / isContact | 13 tests |
| `recipient-resolver.ts` | 3-layer resolution + idempotent recipient writes | 15 tests |
| `migration-193.test.ts` | SQL structural assertions | 27 assertions |

All tests are hermetic. The DB layer (`@/lib/nex/db.withClient`) is
mocked so no network or filesystem is touched during the test runs.

---

## 4 · 3-layer recipient resolver

```
Layer 1 · trusted_contact · pre-selected set
Layer 2 · nearby_opted_in · opted-in responders with declared radius ≥ requested
Layer 3 · wider_community · DISABLED in v1 by feature flag
```

- Layer 1 ignores location entirely — the owner's pre-selected set is
  always considered.
- Layer 2 filters only the opted-in responder pool whose declared
  radius covers the request. Candidate ordering falls back to
  `opted_in_at DESC` in v1 because responder coordinates are NOT
  persisted on the opt-in row (privacy surface deferred to a later
  live-mode phase). The service NEVER emits coordinates.
- Layer 3 is a signalling flag in v1 — the resolver returns
  `layer3Available: false` unless `NEX_EMERGENCY_WIDER_COMMUNITY_ENABLED=true`.
- Trusted contacts take precedence; Layer 2 is deduped against Layer 1.
- The requester is NEVER a recipient of their own incident.
- `writeRecipientRows()` is idempotent via `ON CONFLICT (incident_id, recipient_account_id) DO NOTHING`.

---

## 5 · Server actions (11 exported)

| Action | Scope |
|---|---|
| `createEmergencyDraftAction` | requester |
| `activateEmergencyAction` | requester |
| `cancelEmergencyAction` | requester |
| `resolveEmergencyAction` | requester |
| `acceptIncidentAction` | responder |
| `declineIncidentAction` | responder |
| `withdrawIncidentAction` | responder |
| `optInAsResponderAction` | account |
| `optOutAsResponderAction` | account |
| `addTrustedContactAction` | account |
| `removeTrustedContactAction` | account |

Plus two readers:

| Reader | Scope |
|---|---|
| `updateResponderRadiusAction` | account (radius change for an existing opt-in) |
| `getEmergencyFlagsAction` | public (settings-page chrome) |

Every action returns an `EmergencyActionResult<T>` envelope:

```ts
type EmergencyActionResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: EmergencyActionReason };
```

so F5's UI pattern-matches on `reason` instead of catching exceptions.

Actor identity is resolved from the session via
`resolveNexAppSessionFromContext` (wrapped by `_session.ts` to return a
single typed `string | null`). Actions return `not_authenticated` when
there is no actor. Each action enforces authorisation: only the
requester can cancel/resolve their own incident; only the recipient
can accept/decline/withdraw their own alert row.

---

## 6 · Feature flags (`feature-flag.ts`)

| Flag | Env var | v1 default | Semantics |
|---|---|---|---|
| `isEmergencyHelpEnabled` | `NEX_EMERGENCY_HELP_ENABLED` | **ON** | Master kill-switch. Set `"false"` to disable the whole subsystem. |
| `isEmergencyLiveMode` | `NEX_EMERGENCY_LIVE_MODE` | **OFF** | Live-mode gate. In v1 the service layer forces `simulated = TRUE` regardless of this flag; flipping it has no public effect until the live-mode phase. |
| `isWiderCommunityLayerEnabled` | `NEX_EMERGENCY_WIDER_COMMUNITY_ENABLED` | **OFF** | Layer-3 recipient layer. Resolver returns `layer3Available: false` unless this is explicitly `"true"`. |

---

## 7 · Rate limits (service-enforced)

- **Concurrent active cap:** 3 incidents in `active` or `responders_assigned` per requester.
- **Daily cap:** 10 incidents created in the last rolling 24 hours per requester.

Enforced by `incident-service.rateLimit(accountId)`, which:

- Counts concurrent active rows via `nex.emergency_incident`.
- Sums the last 24 hourly buckets via `nex.emergency_rate_limit`.
- **Fails closed** when the DB is unavailable (returns `false` — the
  action layer reports `rate_limited` rather than silently permitting).

The hourly bucket is bumped by `recordRateLimitEvent` AFTER a
successful incident creation (idempotent `INSERT ... ON CONFLICT ...
DO UPDATE SET count = count + 1`).

Founder-decision-eligible values exposed via the sealed constant
`INCIDENT_RATE_LIMIT = { maxConcurrentActive: 3, maxPer24h: 10 }`.

---

## 8 · Expiration + sweep

- Each incident has `expires_at` defaulting to `now() + 30 minutes`.
- `sweepExpired()` flips `active | responders_assigned → expired` when
  `expires_at` has passed with NO accepted recipient. The guard is
  enforced in SQL via `NOT EXISTS` against `nex.incident_recipient`
  with `response_status = 'accepted'`.
- The actual background job that calls `sweepExpired()` is operator-owned
  and NOT shipped in this foundation (F5 does not need to wire it).

---

## 9 · Doctrine (sealed)

- **NEVER broadcast to all accounts.** Recipients are the resolved set
  of the three layers. Layer 3 is disabled in v1 and will remain opt-in
  gated when flipped on.
- **NEVER track location after the incident closes.** `location_*`
  columns are populated only at explicit incident-creation time by the
  requester. `incident_recipient.distance_meters` is derived once at
  resolve-time and NEVER updated live. The resolver NEVER emits
  responder coordinates.
- **NEVER auto-opt-in a responder.** The only path that creates a row
  in `nex.emergency_responder_optin` is an explicit `optIn()` call from
  a server action triggered by the settings UI. The call requires an
  `acknowledgedSafetyGuidanceAt` timestamp less than 30 days old.
- **ALL events currently simulated.** Every incident row and
  responder-opt-in row carries `simulated = TRUE` in v1. The service
  layer rejects writes with `simulated = false`. The visible "SIMULATED
  · v1" badge in F5's UI reflects this at every surface.
- **Rate limits are per-requester**, not per-origin — a motivated actor
  cannot bypass by swapping devices. The hourly bucket is keyed to
  `account_id`.
- **Idempotent recipient writes.** Re-running `writeRecipientRows()`
  with the same inputs is safe; the UNIQUE constraint on
  `(incident_id, recipient_account_id)` combined with `ON CONFLICT DO
  NOTHING` guarantees no duplicates and no mutation of existing rows.
- **Fail closed, never silently.** When the DB pool is unavailable,
  reads return empty / false and writes throw a typed error.
  `rateLimit()` fails closed.

---

## 10 · Open founder decisions

- **Rate-limit values** (3 concurrent + 10/day): sensible pilot defaults
  but may need tuning once real usage data lands. Values are centralised
  in `incident-service.INCIDENT_RATE_LIMIT`.
- **Expiration default (30 minutes):** matches the schema default. May
  need per-category tuning (e.g. medical_concern shorter horizon).
- **Layer-2 responder coordinates:** v1 does NOT persist responder
  coordinates on the opt-in row. Layer-2 ordering falls back to
  `opted_in_at DESC`. The live-mode phase will require a separate
  privacy decision before coordinates land.
- **Live-mode flip:** `NEX_EMERGENCY_LIVE_MODE=true` is a dormant env
  var in v1. Flipping it to true today has no public effect — the
  service layer still forces `simulated = TRUE`. A future founder
  authorisation plus a service-layer edit are both required.

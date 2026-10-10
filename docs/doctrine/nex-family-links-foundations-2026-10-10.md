# NEX Family Links · Phase 1 Foundations

**Date (estimate):** 2026-10-10
**Branch:** `nex/directory-work`
**Migration:** `198_nex_family_link.sql`

> Dates in this doctrine are **ESTIMATES, not commitments**.

## Scope (what this wave ships)

- Database schema: `nex.family_link` + `nex.account_age_attestation`.
- Server-only services:
  - `family-link-service.ts` — initiate / confirm / revoke / read lifecycle.
  - `age-attestation-service.ts` — record / supersede / read declared DOB.
  - `family-role-reader.ts` — read-only "is X a guardian of Y?" helpers.
- Unit tests for every service.
- Structural tests for the migration.

## Out of scope (NOT shipped here)

- **No UI surface.** Nothing is wired to any `/nex-native/*` route.
- **No parent-alert fan-out.** Emergency Help owns its own trust envelope (migration 196). Family Links does not override it.
- **No child-message access.** The schema explicitly does NOT presuppose that a parent can read a child's messages. That capability, if ever shipped, requires its own future wave with its own authorisation.
- **No child-account activation flow.** Phase 2.
- **No user-facing claim flow.** Phase 2.
- **No ID-document upload or biometric capture.** Attestation is lightweight: a declared date-of-birth plus attestation metadata (self / guardian).
- **No vendor identity-verifier integration.** The schema is adapter-agnostic — no `yoti_*`, `jumio_*`, `veriff_*`, `verifier_id` columns. If a future wave onboards a verifier, it will land its own side table in its own migration.

## Capability ceiling

Family Links establishes **relationships + role tags**. It does NOT by itself grant any user-facing capability. Consumer layers read these rows as **pre-conditions** for their own gates; they do not override Family Links primitives.

- `can_see_emergency_alerts` defaults TRUE but still participates in Emergency Help's own trust envelope (migration 196).
- `can_see_safety_summaries` defaults FALSE. Reserved for a Phase 3+ wave. No Phase 1 service path flips it.
- `can_see_location_when_shared` defaults FALSE. Reserved for a later wave that requires explicit **child AND guardian** opt-in.

The `updateLinkPermissions` symbol in `family-link-service.ts` always throws `family_link.permission_flags_locked_in_phase_1`. Its presence is a **grep anchor** — a static search for mutation of these flags will find only a loud rejection.

## Default-closed by construction

- All three permission flags default-closed except the emergency bit (which has its own gate).
- `simulated=TRUE` is the migration default **and** is hard-coded in every service INSERT (defence-in-depth). Live-mode activation requires a separate founder sign-off and a dedicated live-mode migration.
- Guardians attested as `self` cannot "guardian-attest" for the same account (prevents self-elevation).
- Trusted adult + mentor roles are **NOT guardians** at the Phase 1 primitive level. Readers (`isGuardianOf`, `listGuardianAccountIdsFor`, `listChildAccountIdsFor`) filter to `guardian_primary` | `guardian_secondary` only.

## Append-only revocation

A revoked link stays as a historical row with `state='revoked'`. A new link may be initiated for the same pair afterwards. The partial-unique index enforces "one active primary guardian per child at a time" and "one active link per pair at a time" without blocking fresh invitations after revocation.

## Open questions (surface for founder)

These are **not blockers** for Phase 1 landing — they are decisions a future wave must make before touching the schema again:

1. **Secondary-guardian cap.** Phase 1 enforces one active *primary* per child but allows unbounded *secondary* guardians. Should there be a cap (e.g. 2 secondaries)?
2. **Trusted-adult vouch count.** No limit today. Should the number of concurrent trusted-adult links per child be bounded?
3. **Pending-link default expiry.** `expires_at` is nullable with no default; invitations currently live forever until confirmed or revoked. Should Phase 2 default to 7 / 14 / 30 days?
4. **Age-threshold policy.** The attestation layer records a declared DOB but does NOT compute an "is-minor" classification. The threshold is a future-wave decision; the primitive layer is deliberately threshold-less.

## Where the sealed primitives live

- Migration: `deploy/postgres/init/198_nex_family_link.sql`
- Applier: `scripts/nex-canonical/_apply-migration-198.mjs` (session-identity gated to `nex_dev`)
- Services: `src/lib/nex-native/family-links/*`
- Tests: co-located `*.test.ts` files

## Non-goals · explicit

- No sealed primitive is contradicted by this wave. The sealed account model (`nex_account.id`) is referenced via **soft text columns** — no cross-DB FK, same pattern as every other `nex.*` table.
- No existing test suite is modified. Emergency, Owner-Claim, Related-Businesses, F4 all stay intact.
- No existing settings file is modified.

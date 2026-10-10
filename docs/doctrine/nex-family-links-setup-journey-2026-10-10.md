# NEX Family Links · Setup → Invite → Accept → Revoke Journey

**Date (estimate):** 2026-10-10 (FS-2 implementation wave).
**Branch:** `nex/directory-work`
**Status:** IMPLEMENTED · pilot (`simulated=TRUE` on every row).

> Dates in this document are **ESTIMATES, not commitments**.

## Scope

This doc documents the state machine, security notes, and sweep
contract for the Setup + Invitation + Pressure-Signal + Cooldown wave
built by FS-2. It is additive to:

- `docs/doctrine/nex-family-links-ui-spec-2026-10-10.md` (V4 UI spec)
- `docs/doctrine/nex-family-links-decisions-adopted-2026-10-10.md` (ADR · 5 adopted decisions)
- `docs/doctrine/nex-family-links-retention-policy-draft-2026-10-10.md`
- `docs/doctrine/nex-family-links-foundations-2026-10-10.md` (sealed FL foundations)

## Routes built

| Route | Purpose |
|---|---|
| `/nex-native/family-safety/setup` | Entry splash · pending invitations to me, active links, send-invitation CTA |
| `/nex-native/family-safety/invite` | 3-step invitation flow (identity · role · review) · WebAuthn-gated |
| `/nex-native/family-safety/accept/[linkId]` | Recipient reviews · accept · decline · report pressure |
| `/nex-native/family-safety/link/[linkId]` | Active link detail · revoke · bypass cooldown · cancel cooldown · report pressure · permission panel (read-only) |
| `/nex-native/family-safety/manage` | Pending + active + terminal link list |

## Services built

| Module | Role |
|---|---|
| `src/lib/nex-native/family-links/invite-service.ts` | Higher-level composition · `createInvitationWithWebAuthnGate`, `confirmInvitationFromRecipient`, `revokePrimaryGuardianWithCooldown` |
| `src/lib/nex-native/family-links/pressure-signal-service.ts` | HQ-only bidirectional pressure signal · auto-rejects pending links |
| `src/lib/nex-native/family-links/cooldown-service.ts` | 72h cooldown · bypass · cancel · reserved founder-override · sweep entry point |
| `src/lib/nex-native/family-links/_server-actions.ts` | Server Actions · session-gated · the only mutation entry from client components |

Sealed primitives (UNMODIFIED, composed only):

- `src/lib/nex-native/family-links/family-link-service.ts` · `initiateLink` / `confirmLink` / `revokeLink`
- `src/lib/nex-native/family-links/age-attestation-service.ts`
- `src/lib/nex-native/family-links/family-role-reader.ts`
- `src/lib/nex-native/webauthn-service.ts` · `listCredentialsForAccount`
- `src/lib/nex-native/app/session.ts` · `resolveNexAppSessionFromContext`

## State machine · invitation lifecycle

Sealed in DB · unchanged by this wave:

```
pending  ──(child or guardian confirm)──▶  active  ──(either revoke)──▶  revoked
   │
   └──(72h+ no confirm)──▶ expired
```

### Setup journey (FS-2)

```
       SETUP ENTRY
            │
   ┌────────┴────────┐
   │                 │
   ▼                 ▼
  INVITE            ACCEPT (someone invited me)
   │                 │
   ▼                 ▼
IDENTITY         ACCEPT · DECLINE · REPORT PRESSURE
   │                 │          │              │
   ▼                 ▼          ▼              ▼
ROLE             active     revoked       revoked (pressure_signal · HQ queue)
   │
   ▼
REVIEW
   │
   ▼
SUBMIT ─────▶ pending (72h window)
```

## Load-bearing invariants (all tested)

1. **WebAuthn gate (D3 · 3A).** `createInvitationWithWebAuthnGate` and
   `createInvitationAction` return `{ok:false, reason:'webauthn_required'}`
   when the inviter has no registered WebAuthn credential. The UI shows
   the sealed verbatim copy and a "Add a security key in Settings"
   button. **No DB write happens on the blocked path.** · Proved by
   `invite-service.test.ts` (`webauthn_required · LOAD-BEARING`) and
   `_server-actions.test.ts` (`blocks when inviter has no WebAuthn
   credential · LOAD-BEARING`).

2. **Primary-guardian uniqueness.** Sealed in migration 198 via partial
   unique index · `createInvitationWithWebAuthnGate` surfaces
   `primary_guardian_already_exists` cleanly without an index-violation
   crash.

3. **Confirmation by opposite party.** Sealed in
   `family-link-service.confirmLink`. `confirmInvitationFromRecipient`
   maps `WRONG_CONFIRMING_PARTY` to a clean user-facing error.

4. **Pressure signal (D2 · 2A).** `issuePressureSignal` writes to
   `nex.family_link_pressure_report` and, when the link is `pending`,
   calls sealed `revokeLink` with `reason='pressure_signal'`. The
   service has **zero notification side-effects** addressed at the
   reported counterparty. · Proved by `pressure-signal-service.test.ts`
   (`code path is free of notification-service imports` and `no SQL
   query references nex_notification / nex_push / email_outbox`).
   Both child AND guardian can file.

5. **72h cooldown (D1 · 1A).** `startPrimaryGuardianRevocationCooldown`
   inserts a `pending` row with `effective_at = now + 72h`. Only
   active `guardian_primary` links route through the cooldown · every
   other state and role goes through sealed `revokeLink` directly. The
   OTHER party may bypass (immediate revoke); the initiator may
   cancel. · Proved by `cooldown-service.test.ts` (`creates a pending
   cooldown row with effective_at = now + 72h · LOAD-BEARING D1`) and
   `invite-service.test.ts` (`active guardian_primary → opens cooldown
   · LOAD-BEARING D1`).

6. **Retention (D5 conditional) — documented.** Migration 200 does not
   wire the sweep job. The retention schedule is:
   - `nex.family_link_pressure_report` · 2 years (safeguarding audit)
   - `nex.family_link_revocation_cooldown` · 180 days post `applied_at`
     or `cancelled_at`
   - Legal holds follow the sealed Bucket C flow (`case duration + 7
     years`) via the HQ Tier-C two-person authorisation when wired.

7. **No ID / biometrics / vendor.** No code path in this wave collects
   ID documents, biometrics, or integrates a verifier vendor. Age
   attestation remains declared-only via the sealed `age-attestation-service`
   (not called from this wave's UI · reserved for a follow-up).

8. **Simulated=TRUE.** Enforced by the sealed primitives on every
   INSERT. The FS-2 service layer never asks to opt out.

## Sweep contract (future wave)

A nightly cron SHOULD run:

```sql
UPDATE nex.family_link_revocation_cooldown
   SET state = 'applied', applied_at = now()
 WHERE state = 'pending' AND effective_at <= now()
   AND NOT bypass_confirmed_by_other_party
RETURNING link_id, initiated_by_account_id;
```

For each returned row, call sealed
`family-link-service.revokeLink({linkId, actorAccountId:
initiated_by_account_id, reason: 'primary_guardian_cooldown_expired'})`.

`cooldown-service.finalisePendingCooldowns(nowIso?)` composes both
steps in one entry point so the future cron trigger has one function
to call. The cron trigger itself is NOT wired in this wave.

A parallel cron SHOULD finalise pressure-report retention after 2
years (hard-delete) and cooldown-row retention after 180 days
(hard-delete) · also NOT wired here.

## Reserved founder-override

`cooldown-service.founderOverrideCooldown` is implemented and tested
but the UI in this wave does NOT expose a button that reaches it. The
HQ Tier-C two-person authorisation flow will call this symbol from the
HQ console in a future wave; the cooldown row carries
`founder_override_authorised_by` as the audit anchor.

## Pressure-signal privacy guarantees · architectural

The `pressure-signal-service.ts` module:

- Imports NO notification / push / email / sms service modules
  (asserted via `pressure-signal-service.test.ts`).
- Writes to `nex.family_link_pressure_report` only. The ONLY other DB
  side-effect on the pressure path is calling sealed `revokeLink`
  (which writes to `nex.family_link`). No side-effect targets
  `reported_against_account_id`.
- Both child AND guardian can file. On a `pending` link the
  invitation is auto-revoked. On an `active` link the link stays
  active until HQ Safety Operations acts.

## Entry-point placement (D4 · 4A)

Family Safety lives under Settings only. The sealed `_page-header.tsx`
right-cluster is not modified. The nav built in `_fs-shell-stub.tsx`
is a FS-2-scoped local stub; it will be swapped for FS-1's canonical
`FamilySafetyNav` when it lands.

## FS-1 handoff TODO

Local stubs in `src/app/nex-native/family-safety/_fs-shell-stub.tsx`
MUST be replaced with FS-1's canonical modules once they ship:

- `FamilySafetyShell` + `FamilySafetyNav` (replaces
  `LocalFamilySafetyShell` + `LocalFamilySafetyNav`)
- `StatusChip` (replaces `LocalStatusChip`)
- `EmptyState` (replaces `LocalEmptyState`)

The stub consumes FS-1's shipped palette + SimulatedPilotBadge
directly, so swapping is additive · no public API change in
`src/components/nex-native/family-safety/*`.

## Rollback

Database:

```sql
DROP TABLE IF EXISTS nex.family_link_revocation_cooldown;
DROP TABLE IF EXISTS nex.family_link_pressure_report;
```

Routes (safe to delete without impacting sealed FL foundations):

- `src/app/nex-native/family-safety/setup/`
- `src/app/nex-native/family-safety/invite/`
- `src/app/nex-native/family-safety/accept/[linkId]/`
- `src/app/nex-native/family-safety/link/[linkId]/`
- `src/app/nex-native/family-safety/manage/`
- `src/app/nex-native/family-safety/_fs-shell-stub.tsx`

Services (safe to delete):

- `src/lib/nex-native/family-links/invite-service.ts(.test.ts)`
- `src/lib/nex-native/family-links/pressure-signal-service.ts(.test.ts)`
- `src/lib/nex-native/family-links/cooldown-service.ts(.test.ts)`
- `src/lib/nex-native/family-links/_server-actions.ts(.test.ts)`

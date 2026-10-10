# NEX Family Links · UI Specification (V4)

**Date (estimate):** 2026-10-10
**Branch:** `nex/directory-work`
**Status:** SPECIFICATION ONLY · build NOT authorised
**Depends on:** `docs/doctrine/nex-family-links-foundations-2026-10-10.md` (sealed)
**Depends on:** `src/lib/nex-native/family-links/*` (sealed data layer · migration 198)

> Dates in this document are **ESTIMATES, not commitments**.

---

## 0 · Scope & gate

**This document is a SPECIFICATION.** No code should be written against it
until a separate build authorisation is granted by the founder. The
implementing agent **must** request that authorisation and **must**
surface this document (and the FL foundations doctrine) in the request.
Treat this spec as a work-order shape, not a landed design.

### In scope
- Guardian invitation flow
- Child acceptance flow
- Permission editing surface (view-only in Phase 1 · the spec treats
  "both-party-consent toggles" as a Phase 2 requirement surfaced here so
  the next build authorisation includes it)
- Revocation flow (either party)
- Account-recovery flow (lost phone, lost email, unresolvable account)
- Family dashboard that lists active + pending links

### Out of scope (do NOT design, do NOT implement)
- Any surface that lets a parent read a child's chats / messages
- Any auto-notification of a parent on any child action
- Phase 2 SafeChat permission gating (separate wave · separate authorisation)
- ID-document upload / KYC / biometric capture (capability ceiling)
- Vendor identity-verifier integration (no `yoti_*`, `jumio_*`, `veriff_*`)
- Marketing or growth surfaces ("invite friends to NEX Family Safety")
- Flipping `can_see_safety_summaries` or `can_see_location_when_shared`
  via any live code path (sealed service refuses · see §438-442 of
  `family-link-service.ts`)

### Capability ceiling honoured
The FL foundations doctrine fixes the ceiling. This UI MUST:
- Treat an absent / FALSE permission flag as denial
- Never present a "turn on location" or "turn on summaries" toggle whose
  effect is unilateral · both flags are DB-default FALSE and require
  Phase 2+ both-party-consent workflow (not shipped in Phase 1)
- Never present an "upload ID" or "verify identity with vendor" step

---

## 1 · Routes & components

### Routes (follow sealed `src/app/nex-native/*` conventions)

All routes live under `src/app/nex-native/family/*`. Each route is a
Server Component shell that mounts the named client component.

| Route | Purpose | Role gate |
|---|---|---|
| `/nex-native/family` | Dashboard · lists active + pending links | Any signed-in `nex_account` |
| `/nex-native/family/invite` | Multi-step guardian invitation | Inviter must have passed WebAuthn |
| `/nex-native/family/accept/[linkId]` | Child acceptance surface | Actor MUST equal `childAccountId` of the link |
| `/nex-native/family/link/[linkId]` | Link detail · status / permissions view / revoke | Actor MUST be guardian OR child of the link |
| `/nex-native/family/permissions/[linkId]` | Permission editor (Phase 2 target · Phase 1 renders read-only banner) | Actor MUST be guardian OR child of the link |
| `/nex-native/family/recovery` | Account-recovery flow | Any signed-in `nex_account` |

Routes that take a path param MUST render a sealed `fail-closed`
unavailable state when the family-link-service returns `null` /
`DB_UNAVAILABLE` / `LINK_NOT_FOUND`.

### Components (follow sealed naming · `_client.tsx` / shell split)

| Component | File | Kind |
|---|---|---|
| `FamilyDashboardShell` | `src/app/nex-native/family/_dashboard-shell.tsx` | Server |
| `FamilyDashboardClient` | `src/app/nex-native/family/_dashboard-client.tsx` | Client |
| `InviteFlowStep1Identity` | `src/app/nex-native/family/invite/_step1-identity.tsx` | Client |
| `InviteFlowStep2Role` | `src/app/nex-native/family/invite/_step2-role.tsx` | Client |
| `InviteFlowStep3Confirm` | `src/app/nex-native/family/invite/_step3-confirm.tsx` | Client |
| `AcceptLinkPanel` | `src/app/nex-native/family/accept/[linkId]/_accept-panel.tsx` | Client |
| `LinkDetailView` | `src/app/nex-native/family/link/[linkId]/_link-detail.tsx` | Client |
| `PermissionTogglePanel` | `src/app/nex-native/family/permissions/[linkId]/_permission-panel.tsx` | Client (Phase 2 target · Phase 1 is read-only renderer) |
| `RecoveryShell` | `src/app/nex-native/family/recovery/_recovery-shell.tsx` | Client |
| `FamilyLinkChip` | `src/components/nex-native/family-links/FamilyLinkChip.tsx` | Client (shared) |
| `GuardianRoleBadge` | `src/components/nex-native/family-links/GuardianRoleBadge.tsx` | Client (shared) |
| `ChildRoleBadge` | `src/components/nex-native/family-links/ChildRoleBadge.tsx` | Client (shared) |

### Modal primitive
Reuse the sealed `CreateAccountPrompt` pattern (role=dialog · aria-modal ·
focus trap · esc / backdrop close · return focus to invoker) for ALL
confirmations in this surface (invite send, revoke, recovery confirm).
**Do NOT invent a new modal primitive.** Create one wrapper
`FamilyConfirmPrompt.tsx` beside `CreateAccountPrompt.tsx` that re-uses
the same `_palette.ts` tokens and the same focus / aria contract.

### Session + palette requirements
- Every Server shell MUST call `resolveNexAppSessionFromContext()` and
  render a sealed `account-gate` fallback (via `SettingsHeaderSlot`
  pattern) if no `nex_account` exists.
- All surfaces inherit the sealed NEX dark-navy palette via inline
  styles keyed to the `_page-header.tsx` tokens. **Do NOT add
  Vault-specific or Settings-specific palette imports.**

---

## 2 · State machines

### 2a · Link lifecycle (server-authoritative · sealed in DB)

```
pending  ──(child confirm)──▶  active  ──(either revoke)──▶  revoked
   │                             │
   └──(72h+ no confirm)──▶ expired
```

UI contract: render the current `state` honestly. Only offer actions
that match the current state. `revoked` and `expired` are terminal · no
UI path reactivates them (a new link must be initiated for the same
pair).

### 2b · Invitation flow (client-side)

```
collecting_identity ──▶ selecting_role ──▶ confirming ──▶ submitting
                                                             │
                                               ┌─────────────┴─────────────┐
                                               ▼                           ▼
                                             sent                        error
```

| State | UI behaviour | Error copy |
|---|---|---|
| `collecting_identity` | Step 1 · asks for the invited party's NEX display handle or email | — |
| `selecting_role` | Step 2 · role selector (primary / secondary / trusted_adult / mentor) · surfaces current-primary conflict IF role=primary and child already has one | — |
| `confirming` | Step 3 · review card (invitee name, role, "this is a simulated Phase 1 link" banner) · requires WebAuthn re-prompt before submit | — |
| `submitting` | Primary CTA disabled · spinner · in-flight call to `initiateLink` | — |
| `sent` | Success panel · "Invitation sent. [Name] has 72 hours to accept." | — |
| `error` | Honest error · maps `FAMILY_LINK_ERROR_CODES.*` to user copy (see §4) | per-code |

### 2c · Permission edit (Phase 2 target · surface the requirement now)

```
viewing_defaults ──▶ proposed_change ──▶ awaiting_other_party_confirmation
                                                     │
                              ┌──────────────────────┼──────────────────────┐
                              ▼                      ▼                      ▼
                          confirmed              declined                 expired
```

**Phase 1 scope:** `PermissionTogglePanel` renders the three flags
read-only with a prominent banner: *"Permission changes require both
parties to agree. This feature is not available yet."*

**Phase 2 requirement surfaced for next build authorisation:**
- New server service method: `proposeLinkPermissionChange({ linkId,
  actorAccountId, flag, nextValue })` creating a proposal row (new
  table · NOT designed here).
- New server service method: `acceptLinkPermissionChange({ proposalId,
  actorAccountId })` which flips the flag only after the OTHER party
  confirms within an expiry window (default 72h).
- `updateLinkPermissions` symbol in `family-link-service.ts` currently
  throws `PERMISSION_FLAGS_LOCKED` and MUST remain throwing in Phase 1 ·
  Phase 2 adds the proposal workflow BESIDE it, not inside it.

The implementing agent MUST NOT ship the Phase 2 toggle flow as part of
the Phase 1 UI build. Scope boundary explicit.

---

## 3 · Security model

Each threat + concrete mitigation. The implementing agent MUST build
all of these before approval; any mitigation marked "SPEC OPEN" is a
founder-question in §7.

### 3a · Impersonation of guardian
**Threat:** attacker creates a NEX account posing as a child's parent,
sends invitation.
**Mitigation:**
- Inviter MUST have passed WebAuthn (sealed per `session.ts` · a session
  without a security-key assertion cannot reach the invite form)
- Invitation surfaces the inviter's **display name** AND a verified
  identity badge
- The acceptance panel copy MUST read: *"This person claims to be
  [Name]. We have confirmed they signed in with their security key.
  Confirm you know this person before accepting."*

### 3b · Impersonation of child
**Threat:** attacker intercepts invitation and accepts on behalf of a
minor who has no device of their own.
**Mitigation:**
- Child's confirmation MUST also pass WebAuthn
- If the child is a minor without a security key, out-of-band
  verification: guardian device displays a QR code; child scans with a
  camera-equipped device
- **QR shape:** `nex://family/accept/{linkId}?nonce={32B-base64url}` ·
  nonce stored server-side with 10-minute TTL · scanning consumes the
  nonce exactly once · the acceptance Server Action verifies nonce
  freshness BEFORE calling `confirmLink`
- Nonce storage: new column OR new side table · NOT designed here ·
  flagged for the next build authorisation

### 3c · Coercive family link
**Threat:** bad actor pressures a child to accept.
**Mitigation:**
- 72-hour acceptance window with a 10-minute cooldown between
  invitations from the same inviter to the same invitee (surfaced via
  §4 duplicate-invitation flow)
- Acceptance panel exposes a tertiary CTA: **"I feel pressured"**
- Pressing it:
  - Auto-rejects the invitation (state transitions `pending → revoked`
    with `revokedReason='pressure_signal'`)
  - Notifies NEX HQ safety queue (not the guardian)
  - Returns the child to `/nex-native/family` with an honest banner:
    *"We've marked this invitation and ended it. Nobody else was told."*

### 3d · Lost phone (guardian recovery)
**Threat:** guardian loses the device holding their security key.
**Mitigation:**
- Pre-registered recovery contact (another guardian OR a NEX-safety-ops
  channel) · registration is part of `RecoveryShell`
- Recovery requires BOTH:
  - Recovery contact to confirm (via their own WebAuthn-gated action)
  - A 24-hour waiting period before the new device becomes usable
- **Never a one-tap recovery.** No "magic link in email" path · email is
  not a security boundary in this feature.

### 3e · Lost email / unresolvable account
**Threat:** FL table holds a `guardian_account_id text` soft-reference ·
if the Supabase account is lost, the string becomes unresolvable (the
`nex_account` row is gone / tombstoned).
**Mitigation:**
- `LinkDetailView` MUST detect `null` from `getAccountById(id)` and
  render a **"safe-mode"** panel: *"The other party on this link cannot
  be found. All permissions on this link will revoke automatically in N
  days."*
- Server-side cron / scheduled task (NOT designed here · flagged for
  next build authorisation) revokes any link whose counterparty has
  been unresolvable for 7 consecutive days · `revokedReason='counterparty_unresolvable'`
- Fail-closed: during the 7-day window the UI treats all permission
  flags as FALSE regardless of DB value

### 3f · Secret guardian removal
**Threat:** bad actor who is a `guardian_secondary` revokes a
`guardian_primary` without warning.
**Mitigation:**
- Revocation of a `guardian_primary` link requires EITHER:
  - BOTH parties to confirm (guardian + child), OR
  - A 72-hour cooldown with notification to ALL active guardians on
    the child's account before the revocation lands
- A `guardian_secondary` can revoke ONLY their own link (never another
  guardian's)
- `LinkDetailView` MUST hide the revoke CTA for cross-guardian
  revocation attempts and render an honest error if the server-side
  guard rejects a direct call
- Server-side guard is a new wrapper around `revokeLink` · NOT designed
  here · flagged for next build authorisation

---

## 4 · Error states + edge cases

Each case maps a sealed error code (where applicable) to user-facing copy.

| Case | Trigger | Behaviour |
|---|---|---|
| Duplicate invitation | `initiateLink` would create a second pending link for the same (guardian, child, role) tuple | UI MUST pre-flight check via `listLinksForGuardian` → surface the existing pending row with its remaining acceptance window · the "Send invitation" CTA becomes "View pending invitation" |
| Expired invitation | `state='expired'` (72h+ without confirm) | Dashboard renders chip with muted palette · tapping routes to `LinkDetailView` which shows terminal state · action: start a new invitation |
| Account-does-not-exist | Invitee is referenced by email with no `nex_account` row | Invitation flow sends an email with CTA "Join NEX to link with [Guardian Name]" · recipient MUST verify ownership of the email, create an account, AND confirm the link in sequence · pre-link state stored as "pending-with-no-account" · uses existing email verification primitive (NOT designed here) |
| Role conflict / self-link | `guardianAccountId === childAccountId` (sealed `SELF_LINK` error) | Invite flow step 1 pre-checks · if the invitee matches the inviter's own account, step 1 surfaces: *"You can't be your own guardian."* · submit button stays disabled |
| Primary-guardian uniqueness | `PRIMARY_GUARDIAN_ALREADY_EXISTS` | Step 2 (role selection) MUST read `listLinksForChild` BEFORE enabling `guardian_primary` option · if an active primary exists it surfaces: *"[Child] already has a primary guardian ([Current Primary Name]). You can be a secondary guardian, or ask the current primary to revoke their link first."* |
| Wrong confirming party | `WRONG_CONFIRMING_PARTY` | `AcceptLinkPanel` detects via session + link.initiatedBy · if actor is not the required confirmer the panel renders a fail-closed banner · never calls `confirmLink` |
| Already confirmed / already revoked | `ALREADY_CONFIRMED` / `ALREADY_REVOKED` | Treated as "stale link row" · dashboard refreshes · banner: *"This invitation was already handled."* |
| DB unavailable | `DB_UNAVAILABLE` from any service | **Fail-closed.** UI renders: *"Family Links is temporarily unavailable. Try again shortly."* · NEVER fabricates optimistic UI state |

---

## 5 · Acceptance criteria for the implementing agent

The implementing agent MUST prove the following before any approval. All
tests are additive · do NOT modify V1/V2/V3 scope test files.

### Playwright (real-browser · against live NEX Supabase simulated-mode)
1. **Happy-path invite + accept:** Guardian signs in (with WebAuthn),
   invites Child, Child signs in (with WebAuthn), accepts · link
   appears `active` on BOTH dashboards.
2. **Revocation:** either-party revocation flips to `revoked` on both
   dashboards within one reload.
3. **Pressure signal:** Child marks pending invitation as "I feel
   pressured" · HQ safety queue sees the signal · invitation is
   `revoked` with `revokedReason='pressure_signal'` · guardian is NOT
   notified (test asserts absence of any outgoing notification for the
   guardian account).
4. **WebAuthn gate:** Inviter without a passed security-key assertion
   cannot reach the invite form (route redirects to sealed WebAuthn
   enrol / assertion path).
5. **Permission read-only (Phase 1):** `PermissionTogglePanel` renders
   three flags read-only + the "not available yet" banner · ANY attempt
   to POST a flag-flip to `updateLinkPermissions` returns
   `PERMISSION_FLAGS_LOCKED`.

### Unit tests (`*.test.ts` co-located with components)
- Every state transition in state machines 2a / 2b / 2c
- Every error code in `FAMILY_LINK_ERROR_CODES` renders a specific user
  copy string (table-driven test)
- Permission panel's "read-only + banner" invariant · snapshot test

### Privacy / server-side enforcement
- No permission flag can be flipped by any client-reachable code path
  in Phase 1 (grep-anchor test: `rg -F "updateLinkPermissions("
  src/app src/components` must only match imports in tests that assert
  the thrown error)
- No new API route exposes raw `nex.family_link` rows for a counterparty
  the viewer isn't a party to (test seeds a decoy third-party link and
  asserts it's absent from the viewer's dashboard)

### Fail-closed
- Mock `withClient` to return `null` (DB unavailable) and assert every
  surface renders the "temporarily unavailable" banner · never
  fabricates optimistic UI

---

## 6 · Explicit non-features (DO NOT BUILD)

The implementing agent MUST NOT ship any of the following in the
Family Links UI wave:

- No "parent reads child messages" surface (any variant)
- No auto-notification of a parent on any child action (no silent
  observability of a child by a guardian beyond the explicit
  `can_see_emergency_alerts` primitive · which Emergency Help still
  gates via its own trust envelope)
- No Phase 2 SafeChat gating (separate wave · separate authorisation)
- No ID-document upload (capability ceiling · age attestation stays
  declared-only in current phase)
- No KYC / vendor identity verifier integration
- No marketing surface ("invite your friends to NEX Family Safety!") ·
  this is a safety feature, not growth
- No "magic link in email" one-tap recovery (email is not a security
  boundary for this feature)
- No background location collection, no location sharing, no
  "safety summary" rendering · both are Phase 2+ features behind
  default-FALSE flags that cannot be flipped in Phase 1
- No new modal primitive · reuse the sealed `CreateAccountPrompt` pattern

---

## 7 · Open questions for founder

The implementing agent MUST surface these to the founder BEFORE
starting the build. The agent should NOT guess at the answers.

1. **Primary-guardian revocation escalation.** Should revocation of a
   `guardian_primary` require founder-level override (NEX HQ safety
   confirms) OR is the 72-hour cooldown + notify-all-guardians flow
   sufficient on its own?
2. **Pressure signal direction.** Should the "I feel pressured" signal
   to HQ be **bidirectional** · can a child also report a bad
   guardian AFTER acceptance (post-active-link safety signal), not just
   decline a pending invitation?
3. **WebAuthn-missing invite copy.** What's the exact user-facing copy
   when a guardian without a security key tries to invite · route them
   to enrol a key, OR block entirely with "add a security key in
   Settings before inviting"?
4. **Entry-point placement.** Should Family Links have its own icon in
   the sealed `_page-header.tsx` right-cluster, OR live only under
   Settings? Impact: adding a 4th icon crowds the sealed header
   (home · search · gear/lock); a Settings-only entry is less
   discoverable but preserves sealed chrome.
5. **Revoked-row retention policy.** Currently `revoked` rows live
   indefinitely as append-only history. Should there be a retention
   policy (e.g. anonymise after 2 years, hard-delete after 7)? If so,
   the policy requires its own migration · NOT shippable in this UI
   wave.

---

## Appendix · References to sealed primitives

- Migration · `deploy/postgres/init/198_nex_family_link.sql`
- Services · `src/lib/nex-native/family-links/family-link-service.ts`
- Services · `src/lib/nex-native/family-links/age-attestation-service.ts`
- Readers · `src/lib/nex-native/family-links/family-role-reader.ts`
- Types · `src/lib/nex-native/family-links/types.ts`
- Session · `src/lib/nex-native/app/session.ts`
- Modal pattern · `src/components/nex-native/account-gate/CreateAccountPrompt.tsx`
- Header · `src/app/nex-native/_page-header.tsx`
- Foundations doctrine · `docs/doctrine/nex-family-links-foundations-2026-10-10.md`

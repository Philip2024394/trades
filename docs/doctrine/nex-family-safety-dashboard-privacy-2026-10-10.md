# NEX Family Safety · Parent Dashboard Privacy Model (FS-3)

**Date (estimate):** 2026-10-10
**Branch:** `nex/directory-work`
**Status:** DOCTRINE · sealed with migration 201 + FS-3 service landing
**Depends on:** `docs/doctrine/nex-family-links-foundations-2026-10-10.md`
**Depends on:** `docs/doctrine/nex-family-links-ui-spec-2026-10-10.md`
**Depends on:** `docs/doctrine/nex-safechat-privacy-audit-evidence-2026-10-10.md`

> Dates in this document are **ESTIMATES, not commitments**.

---

## 0 · Founder authorisation (verbatim)

> *"The parent's dashboard must show only information the system is
> authorised to disclose. It must not become unrestricted access to a
> child's private conversations. SafeChat classification must remain
> simulated until separately authorised."*
>
> *"The parent dashboard is not a back door into the child's private
> account. Do not expose unrestricted chat histories, message contents,
> private messages, credentials, or unrelated personal data. Do not
> give guardians blanket access to the child's contacts merely because
> a family link exists. Only expose contact information and safety
> data permitted by the relevant consent, role, and access rules. Do
> not create hidden surveillance, silent location tracking, or
> unauthorised cross-account access. Enforce access rules on the
> server, not merely by hiding frontend controls."*

---

## 1 · What this dashboard IS

- A list of the viewer's active, pending, revoked, and expired family
  links.
- Per-child: role (primary / secondary / trusted / mentor), state
  (pending / active / revoked / expired), confirmed-at date.
- Server-side status of the SafeChat FEATURE (classifier version,
  phase-1 logging flag, user-facing flag, retention window).
- A plain-language privacy page with 5 promises + capability ceiling.
- An append-only audit log of every dashboard query attempt
  (`nex.family_safety_dashboard_access_log` · migration 201).

## 2 · What this dashboard IS NOT

- Not a reader of message bodies, ciphertext, plaintext, rule_matches,
  signals, attachment URLs, or any other child-content column.
- Not a reader of `nex_peer_message`, `nex_peer_conversation`,
  `nex_friend_edge`, `nex_contact_*`, or `nex.safechat_classification`.
- Not a surface that reveals safety summaries. Phase 1
  `can_see_safety_summaries` defaults FALSE and is NOT flippable from
  Phase 1 code. The sealed service refuses regardless of DB value.
- Not a surface that reveals location. Phase 1
  `can_see_location_when_shared` defaults FALSE and is NOT flippable
  from Phase 1 code.
- Not a surface that reveals contacts. The sealed Phase 1 schema does
  not have a `can_see_contacts_summary` flag · the
  `contact-visibility-service` always returns
  `{available: false, reason: 'contact_visibility_not_in_phase_1'}`.
- Not a notification channel for guardians · a child action never
  auto-notifies a guardian through this dashboard.

## 3 · Server-side enforcement (10 invariants)

Each invariant is covered by at least one test in
`src/lib/nex-native/family-safety/*.test.ts` and
`privacy-invariants.test.ts`.

| # | Invariant | Enforcement |
|---|---|---|
| 1 | Guardianship check | `resolveChildDashboardAccess` → `isGuardianOf` + `getLinkById` cross-check |
| 2 | URL tampering | Same gate · 403-equivalent returned, child id not echoed |
| 3 | No raw-message queries | Grep-anchor test + per-call SQL assertion |
| 4 | No contact exposure by default | `contact-visibility-service` returns unavailable unconditionally |
| 5 | No location exposure by default | `resolvePermissionFlag` returns `denied_flag_off` even when DB flag TRUE |
| 6 | SafeChat summary unavailable in Phase 1 | `readSafeChatGuardianSummaryForChild` returns unavailable unconditionally |
| 7 | Revoked-link enforcement | Re-fetch of specific link via `getLinkById` closes the isGuardianOf → getLinkById race |
| 8 | Cross-account isolation | `isGuardianOf` SQL binds (viewer, child); mismatched pair returns no row |
| 9 | Error paths don't leak | Denial result carries sealed reason enum only; test asserts no uuids / content tokens |
| 10 | Access logging | Every outcome bucket (`granted` / 4× `denied_*`) writes an audit row |

## 4 · Audit log schema (migration 201)

`nex.family_safety_dashboard_access_log` (append-only):

- `access_id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `viewer_account_id text NOT NULL`
- `viewed_child_account_id text NULL` (NULL for aggregate reads)
- `surface_name text CHECK IN ('dashboard_root','child_dashboard',
   'child_contacts','child_safechat','safechat_status','privacy_page')`
- `outcome text CHECK IN ('granted','denied_not_guardian',
   'denied_revoked','denied_flag_off','denied_other')`
- `simulated boolean NOT NULL DEFAULT TRUE`
- `accessed_at timestamptz NOT NULL DEFAULT now()`

Indexes:
- `(viewer_account_id, accessed_at DESC)` — self-audit queries
- `(outcome, accessed_at DESC)` — HQ denial-pattern scans

The sealed service writes `simulated=TRUE` hard-coded in the SQL
(never via parameter) so live-mode drift via param injection is
structurally impossible.

Retention: the sweep is NOT in this migration. Documented policy:
`granted` rows retained 12 months; `denied_*` rows retained 24 months
(longer so HQ can detect abuse patterns). Sweep implementation is a
future wave.

## 5 · Phase-1 ceiling · what cannot be changed from Phase 1 code

Even if a future bug or a sealed-service bypass flipped
`can_see_safety_summaries` or `can_see_location_when_shared` to TRUE
in the DB, the `resolvePermissionFlag` function in
`dashboard-service.ts` returns `denied_flag_off` regardless of the
value. This is the deliberate ceiling · it ensures the UI surfaces
cannot be weaponised by a DB-level mistake.

The gate is removed as part of the future wave that WIRES the actual
summary / location surfaces. That wave will:
- Add the both-party-consent proposal workflow (see FL UI spec §2c).
- Replace the hard-false short-circuit with a real flag read.
- Add new audit log outcomes (`granted_with_summary`,
  `granted_with_location`) so the audit trail distinguishes.

## 6 · Boundaries with sealed FS scopes

- **FS-1** (shell + home + palette + types + home-service): FS-3
  consumes `FamilySafetyShell`, `StatusChip`, `SimulatedPilotBadge`,
  `EmptyState`, `FAMILY_SAFETY_PALETTE` · never modifies them.
- **FS-2** (setup + invite + accept + revoke): FS-3 does NOT touch
  invite-service, pressure-signal-service, cooldown-service,
  `_server-actions.ts`, or any route under
  `/family-safety/{setup,invite,accept,link,manage}`.
- **FS-4** (subscription + e2e): FS-3 does NOT touch
  `family-safety/subscription/*` paths or files.

## 7 · Non-features (explicit)

The FS-3 wave MUST NOT ship any of:

- Any surface that lets a parent read a child's chats
- Any automatic notification of a parent on any child action
- Any contact-visibility surface that queries contact tables
- Any location-sharing surface
- Any SafeChat summary surface
- Any "upload ID" / KYC / vendor identity-verifier integration
- Any marketing or growth hook on the dashboard
- Any `UPDATE` / `DELETE` on `nex.family_link` (that's FS-2's scope)
- Any modification of sealed FL services or SafeChat classifier files

---

## Appendix · References to sealed primitives + new primitives

Sealed (never modified by FS-3):
- `deploy/postgres/init/198_nex_family_link.sql`
- `deploy/postgres/init/200_nex_family_link_pressure_and_cooldown.sql`
- `src/lib/nex-native/family-links/*` (all files)
- `src/lib/nex-native/safechat/*` (except read of `feature-flag.ts`)

New (FS-3 landed):
- `deploy/postgres/init/201_nex_family_safety_dashboard_access_log.sql`
- `scripts/nex-canonical/_apply-migration-201.mjs`
- `scripts/nex-canonical/migration-201.test.ts`
- `src/lib/nex-native/family-safety/dashboard-service.ts`
- `src/lib/nex-native/family-safety/contact-visibility-service.ts`
- `src/lib/nex-native/family-safety/safechat-status-reader.ts`
- `src/lib/nex-native/family-safety/privacy-invariants.test.ts`
- `src/components/nex-native/family-safety/ChildAccountChip.tsx`
- `src/components/nex-native/family-safety/ParentDashboardShell.tsx`
- `src/components/nex-native/family-safety/SafeChatStatusPanel.tsx`
- `src/components/nex-native/family-safety/PrivacyExplanationPanel.tsx`
- `src/app/nex-native/family-safety/dashboard/page.tsx`
- `src/app/nex-native/family-safety/dashboard/children/[childAccountId]/page.tsx`
- `src/app/nex-native/family-safety/dashboard/children/[childAccountId]/contacts/page.tsx`
- `src/app/nex-native/family-safety/dashboard/children/[childAccountId]/safechat/page.tsx`
- `src/app/nex-native/family-safety/safechat/page.tsx`
- `src/app/nex-native/family-safety/privacy/page.tsx`

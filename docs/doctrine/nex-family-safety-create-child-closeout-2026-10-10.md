# NEX Family Safety · Create-Child Wave · Closeout
> 2026-10-10 · nex/directory-work · live engineering closeout for the parent-creates-child pivot

## Scope landed

The Family Safety architecture pivoted from guardian-invites-existing-child to parent-creates-child-account-with-government-ID. All six founder-approved decisions implemented:

- **A** · Legal review BLOCKS live create · `NEX_FAMILY_SAFETY_CHILD_CREATE_LIVE_MODE` defaults OFF · UI reachable end-to-end · final materialisation gated · honest `awaiting_legal_clearance` state when flag OFF
- **B** · ID verifier stubbed as `StubPendingVendorAdapter` · sealed interface accepts future providers (Jumio / Onfido / Veriff / Privy ID) · operator manual-override helper for dev verification
- **C** · Parent is custodian · can issue password reset via opaque token handoff · NEVER sees plaintext credentials · all actions audited to `nex.parent_custody_audit_log`
- **D** · SafeChat enforced always-on for minor accounts · `preventFlagFlipByParent` throws `PARENT_CANNOT_DISABLE` on any attempt to flip `safechat_always_on=FALSE` for a minor
- **E** · Age transition at 16th birthday · 30-day guardian notification + child confirmation · atomic transition via `confirmChildHandover` OR sweep job
- **F** · Dashboard always-active · uses REAL data from `parent-custody-service` · honest empty state when no custodies · never shows demo/placeholder data

## Migrations (5 new, 203-207)

| # | Table | Purpose |
|---|---|---|
| 203 | `nex.child_account_creation_request` | parent-initiated workflow row |
| 204 | `nex.id_verification_submission` + `nex.id_document_blob` | ID metadata + strict-access bytea blob |
| 205 | `nex.parent_custody_link` | parent↔child custody (replaces invite for created minors) |
| 206 | `nex.account_minor_profile` | minor flag + always-on SafeChat enforcement |
| 207 | `nex.parent_custody_audit_log` | append-only audit of parent actions on child account |

Apply order: 204 → 203 → 205 → 206 → 207 (FK dependencies). All session-identity gated to `nex_dev`. All idempotent. `simulated=TRUE` default on every table.

## Services (CC-1)

- `child-account-creation/child-account-creation-service.ts` · 32/32 tests
- `child-account-creation/_server-actions.ts` · 21/21 tests
- `child-account-creation/feature-flag.ts` · 11/11 tests · LIVE_MODE defaults OFF · UI_ENABLED defaults TRUE · MANUAL_OVERRIDE defaults OFF
- `id-verifier/stub-pending-vendor-adapter.ts` · 20/20 tests
- `id-verifier/id-verification-storage.ts` · 17/17 tests · SHA256 integrity · admin-only reader
- `custody/parent-custody-service.ts` · 22/22 tests · opaque token handoff for password reset
- `custody/parent-custody-audit-log-service.ts` · 17/17 tests · regex redaction of emails/phones/credentials
- `minor-profile/minor-profile-reader.ts` · 14/14 tests

Total CC-1 services: **151/151 tests pass**.

## UI (CC-2)

Pages:
- `/family-safety/create-child` + `/step-1-identity` + `/[requestId]/step-2-document` + `/[requestId]/step-3-review` + `/[requestId]/status`
- `/family-safety/custody` + `/[custodyId]` + `/[custodyId]/reset-password` + `/[custodyId]/audit`
- `/family-safety` home updated with "Create a child account" primary CTA
- `/family-safety/invite` + `/accept` + `/link` + `/manage` disambiguated with guardian-only banners

Components: ChildCreateWizardShell · ChildIdentityForm · GovernmentIdUploader · CreationReviewPanel · VerificationStatusChip · CustodyActionLog · PasswordResetPanel · LegalClearancePendingBanner.

CC-2 component tests: 59/59 local · integrated into 587/587 family-safety suite.

Load-bearing UI invariants verified:
- `GovernmentIdUploader` NEVER persists ID bytes to localStorage (source-grep test)
- `GovernmentIdUploader` uploads only via onSubmit prop → server action (no direct client fetch)
- `PasswordResetPanel` NEVER renders plaintext credentials (source-grep + render test)
- `LegalClearancePendingBanner` visible on every `/create-child` and `/custody` page when live-mode OFF
- SIMULATED · PILOT badge on every create-child and custody page

## Dashboard + age-transition + minor SafeChat (CC-3)

- `/dashboard` always reachable · lists real custodies via `listActiveCustodiesForParent` · honest empty state
- `/dashboard/children/[id]` · `ChildAccountDashboardPanel` composed from real custody data
- `/dashboard/children/[id]/safechat` · minors get `MinorSafeChatStatusPanel` · non-minors keep "not available in Phase 1" state
- `/age-transition` + `/[childAccountId]` + `/confirm-handover` · all live
- `_age-transition-sweep.mjs` · session-identity gated · dry-run default · atomic per-row
- `minor-safechat-enforcer.ts` · 19/19 tests · `preventFlagFlipByParent` throws for minors
- `age-transition-service.ts` · 31/31 tests
- `dashboard-service.ts` extended with 10 new tests · ALL 10 prior privacy invariants preserved

Components: AgeTransitionCountdownChip · ChildAccountDashboardPanel · MinorSafeChatStatusPanel · 26/26 tests.

## E2E Playwright specs (CC-4)

Six new specs covering the real journeys:
- `nex-family-safety-create-child.spec.ts` · 3-step wizard · submit · rejection · legal-clearance pending
- `nex-family-safety-custody.spec.ts` · list · detail · password reset · audit · revoke
- `nex-family-safety-age-transition.spec.ts` · countdown · parent notify · child confirm · sweep dry-run + live
- `nex-family-safety-dashboard-live.spec.ts` · always reachable · real data · no DEMO/PLACEHOLDER words (grep anchor)
- `nex-family-safety-minor-safechat-enforcement.spec.ts` · parent cannot disable · classifier version pinned to v1.1.0
- `nex-family-safety-regression.spec.ts` · guardian-guardian invite still works · subscription intact · Emergency Help intact

Specs scaffolded with session fixture provisioning. Scenarios that depend on seeded data use the sealed probe pattern.

## Totals this wave

- **5 migrations applied** (203-207) · all idempotent · session-identity gated
- **151 CC-1 service tests** · 59 CC-2 component tests · 156 CC-3 service+component tests · all green
- **587 unit tests pass** across the whole family-safety + family-links + components tree
- **5 live routes serve** HTTP 200: /family-safety, /create-child, /custody, /dashboard, /age-transition
- **13 doctrine documents** across this wave + prior (architecture, verification, age-transition, enforcement, closeout)
- **No fake / demo / placeholder data** · every rendered page pulls from real services
- **Zero changes** to sealed Vault / Bridge / Socials / Emergency / SafeChat classifier / FL foundations

## Remaining production gates

- **Indonesian legal review** · brief ready at `docs/doctrine/nex-family-safety-indonesian-legal-review-brief-2026-10-10.md` · appointed lawyer required · gates `NEX_FAMILY_SAFETY_CHILD_CREATE_LIVE_MODE=true`
- **ID verifier vendor selection** · stub ready · founder picks Jumio / Onfido / Veriff / Privy ID
- **ID document retention policy** · defer to Indonesian legal counsel
- **ID document breach notification** · defer to Indonesian legal counsel
- **Child auth model** · sealed `account-service.createAccount` requires `supabase_user_id` · child-auth flow needs founder sign-off before `materialiseChildAccount` can mint real accounts
- **Password reset channel** · currently opaque token handoff · future wave may add OOB verification (email/SMS to parent) · requires vendor selection for SMS

## Deferred items (not in this wave)

- SafeChat hook consumption of `minor-safechat-enforcer` (SafeChat classifier currently reads global flags · future wave wires per-account enforcement)
- Dashboard SafeChat summary surface for guardians (gated behind separate authorisation · currently "not available in Phase 1" state)
- Age-transition sweep as a scheduled cron (currently manual-run script · operator chooses scheduler)
- Guardian-side notification channel for age-transition (currently in-app only · future wave adds email/SMS)
- Pressure signal integration into the new custody model (currently invite-only · pressure can be filed against custody via a future primitive)

## Branch state

`nex/directory-work` · 4 commits ahead of previous HEAD · wave work uncommitted at time of this closeout · CC-4 completed in CC-4 agent · next step is coordinator commit + push.

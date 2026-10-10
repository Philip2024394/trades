# NEX Family Links · Design Decisions Adopted

> ADR · 2026-10-10 · adopted by founder · **UI build still requires separate authorisation**
> Branch: `nex/directory-work` · no code written by this ADR

## Context

This ADR formally adopts the five open design decisions raised in the
Family Links UI planning wave. It does **not** authorise any UI build.
A separate build-authorisation request citing this ADR **and** the
adopted retention policy is required before any UI code is written.

References (all sealed, this ADR does not amend them):

- Sealed spec: `docs/doctrine/nex-family-links-ui-spec-2026-10-10.md`
- Open questions: `docs/doctrine/nex-family-links-ui-open-questions-2026-10-10.md`
- Foundations (migration 198, services): `docs/doctrine/nex-family-links-foundations-2026-10-10.md`
- Retention policy draft (dependency for D5): `docs/doctrine/nex-family-links-retention-policy-draft-2026-10-10.md`
- Indonesian legal review brief (external dependency): `docs/doctrine/nex-family-safety-indonesian-legal-review-brief-2026-10-10.md`

## Decisions

### D1 · Primary-guardian revocation escalation

**Decision:** ADOPTED — Option **1A** · founder-level override PLUS a
72-hour cooldown.

**Implementation notes:**

- Revoking an **active** `guardian_primary` link requires EITHER
  both-party confirmation OR a 72-hour cooldown during which all
  parties on the link are notified.
- "Founder-level override" is a **reserved escalation path** for cases
  where both-party confirmation is impossible (e.g. child in acute
  danger from the current guardian). It is reviewed by HQ Safety
  Operations and requires **two-person authorisation** per the sealed
  Emergency Help operator doctrine (see
  `nex-emergency-help-police-handoff-2026-10-10.md` for the Tier-C
  pattern reused here).
- UI must display remaining cooldown time via a specific countdown
  chip on `LinkDetailView`.
- The HQ-review state and server action referenced in the sealed spec
  stay in scope; the simplification in Option 1B is **rejected**.

**Open question deferred to the next wave:** exact UI copy for the
cooldown countdown chip and the HQ-review pending state.

---

### D2 · Pressure signal direction (post-acceptance)

**Decision:** ADOPTED — Option **2A** · bidirectional. Signal is
available on both **pending** AND **active** links.

**Implementation notes:**

- The pressure signal is **HQ-only**. The counterparty on the link is
  **never** notified that the signal was filed.
- On a **pending** invitation, filing a signal auto-rejects the
  invitation and routes an opaque case record to HQ Safety Operations.
- On an **active** link, filing a signal does NOT auto-revoke the
  link. It opens an opaque HQ Safety Operations case for review. The
  child retains normal product behaviour until Safety Operations acts.
- **Either side** of the link (child OR guardian) can file. The
  symmetry is intentional: coercion flows in both directions.
- Access to the resulting case records follows the sealed HQ console
  Tier-B pattern (case-based, documented reason, audit-logged).

---

### D3 · WebAuthn-missing invite copy & flow

**Decision:** ADOPTED — Option **3A** · block the invitation flow and
route the user to Settings to enrol a security key.

**Implementation notes:**

- When a user without a registered security key opens the invite flow,
  the UI MUST render the blocking screen with the copy specified in
  the Open Questions doc section 3A **verbatim**:

  > **A security key is required to invite a family member.**
  > We require a hardware or platform security key before any family
  > link can be created. This protects the people you want to link to
  > from impersonation.
  >
  > **[Add a security key in Settings]**  **[Cancel]**

- The WebAuthn enrol path lives in **exactly one place**: the sealed
  Settings surface. The invite flow never duplicates it.
- Playwright must assert the blocking screen on a cold account.

---

### D4 · Entry-point placement in `_page-header.tsx`

**Decision:** ADOPTED — Option **4A** · Settings-only entry. No new
header icon.

**Implementation notes:**

- The sealed `_page-header.tsx` right-cluster is **not modified**.
- Family Links is reached only from the sealed Settings surface.
- A future dashboard-tile discovery path (Option 4C) remains possible
  in a **separate** wave; it is not authorised here.
- Any later attempt to mutate `_page-header.tsx` requires an explicit
  "sealed chrome amendment" authorisation.

---

### D5 · Retention policy for revoked family-link rows

**Decision:** ADOPTED CONDITIONALLY — Option **5A WITH MODIFICATION**.

**Original 5A:** "Keep indefinite retention for now; defer the question
to a dedicated retention / privacy wave."

**Founder modification (verbatim):**

> No indefinite retention by default; establish a lawful,
> purpose-limited retention policy first. Keeping revoked family
> relationships indefinitely could retain sensitive family information
> longer than necessary. Preserve only what is justified for security,
> disputes, or legal obligations, with access controls and a defined
> retention schedule.

**Implementation notes:**

- The purpose-limited retention policy MUST be adopted **before** the
  UI build is authorised.
- Proposed policy: `docs/doctrine/nex-family-links-retention-policy-draft-2026-10-10.md`.
- The policy requires, for each retention bucket: **lawful basis**,
  **access controls**, **defined schedule**, **deletion mechanism**,
  **audit trail**.
- The sweep job and audit-log tooling implied by the policy are **not**
  authorised by this ADR; they require their own dedicated wave.

## What this adoption authorises

- The UI design defaults for Family Links are now **sealed**. The
  implementing agent builds against these defaults when the UI wave is
  separately authorised.
- A follow-up build-authorisation request citing (a) this ADR, (b) the
  adopted retention policy, and (c) usable guidance from the appointed
  Indonesian counsel is required BEFORE any UI code is written.
- The five decisions above become the contract. Deviation requires a
  new ADR.

## What this adoption does NOT authorise

- UI implementation of any Family Links surface.
- Any production child-account activation.
- Collection of children's sensitive data (ID documents, biometric,
  payment, precise long-term location, etc.).
- Vendor selection for identity verification.
- Flipping any sealed feature flag (SafeChat logging, user-facing
  effects, Emergency Help live-mode, Family Links `simulated=FALSE`,
  etc.).
- Any modification of the sealed FL foundations (migration 198,
  services under `src/lib/nex-native/family-links/*`, their types).
- Any modification of the sealed FL UI spec from the prior wave.

## Sign-off

- **Founder:** adopted 2026-10-10 (verbatim decisions quoted in task
  authorisation).
- **Agent (this ADR author):** W2 · Family Links Decisions Adoption +
  Indonesian Legal Brief agent · documents-only scope.

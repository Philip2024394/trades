# NEX Family Links · Revoked-Link Retention Policy · DRAFT

> Draft 2026-10-10 · pending founder adoption · prepared in response to
> the founder modification of D5 in
> `docs/doctrine/nex-family-links-decisions-adopted-2026-10-10.md`.

## Scope

This policy defines, for rows in `nex.family_link` where
`state='revoked'`:

- **What** information is retained
- **For what lawful purpose** it is retained
- **For how long** it is retained
- **Who** may access it (which Safety Operations tier)
- **How** deletion is enforced

It applies **only** to revoked rows. Active (`state='active'`) and
pending (`state='pending'`) rows are governed by the live product
schema and are out of scope here.

## Guiding principle

Keep only what is justified by **security**, **dispute resolution**,
or **legal obligation**. Default to the minimum. Access is logged.
Deletion is enforced automatically wherever possible.

## Retention buckets

### Bucket A · Operational metadata · 90 days

**Fields retained** (from the revoked row):

- `link_id`
- `guardian_account_id`
- `child_account_id`
- `role` (`guardian_primary` | `guardian_secondary` | `trusted_adult` | `mentor`)
- `state` (= `revoked`)
- `initiated_at`, `confirmed_at`, `revoked_at`
- `revoked_reason_category` — **bucketed enum**, not free-text
  (e.g. `requested_by_child`, `requested_by_guardian`, `hq_safety_action`,
  `pressure_signal_outcome`, `other`)

**Lawful basis:**

- **Security:** detecting abusive re-invitation patterns (same
  guardian re-inviting after revocation, invitation farming,
  coordinated-pair signals).
- **Dispute resolution:** answering "did a link exist between
  account X and account Y on date Z?" during a safety case.

**Access tier:** Safety Operations **Tier B** per the sealed HQ
console doctrine — case-based access with documented reason and
audit log.

**Deletion mechanism:** nightly sweep job deletes rows where
`state='revoked' AND revoked_at < now() - interval '90 days' AND NOT
on_legal_hold`.

**Exception:** an **active legal hold** (see Bucket C) prevents
deletion. Holds are explicit, visible to Operations, and auditable.

---

### Bucket B · Aggregated statistics · 2 years

**Fields retained:**

- Daily counts, grouped by `role` and `revoked_reason_category`.
- **No** account IDs. **No** link IDs. **No** per-pair data.

**Lawful basis:** product safety analysis (legitimate interest). Used
for internal trend reporting such as "primary-guardian revocations
trending up this quarter" or "pressure-signal-outcome revocations by
quarter".

**Access tier:** Safety Operations **Tier A** — aggregates only,
no PII, viewable by any employee with the Safety Operations role.

**Deletion mechanism:** aggregation produced at end of each UTC day;
the underlying raw rows are deleted according to Bucket A's schedule;
the aggregate table itself is retained for 2 years then rolled off.

---

### Bucket C · Legal hold · case duration + 7 years

**Fields retained:** ALL fields from the revoked `nex.family_link` row
PLUS the full audit trail (who filed, who confirmed, who revoked,
timestamps, HQ case ID if any).

**Trigger:** an explicit legal hold placed by the Safety Operations
lead with an associated case ID. Not automatic. Not inferred from a
pressure signal alone.

**Lawful basis:** legal obligation — preservation for safeguarding
investigation or regulatory response (e.g. KPAI inquiry, Komdigi
request, Indonesian police investigation, foreign MLAT).

**Access tier:** **Tier C emergency only**. Requires **two-person
authorisation** per the sealed Emergency Help operator doctrine. Every
access event is written to an append-only audit log with case ID,
reviewer, and reason.

**Deletion mechanism:** manual deletion after the hold is lifted;
deletion itself is auditable; a tombstone remains with case ID,
hold-lift reason, and reviewer.

## What is NOT retained after revocation

- Permission-flag history beyond the final state (the three Phase-1
  flags are default-closed and immutable; no history worth keeping).
- Any permission-proposal history (none exists at Phase 1).
- Attestation metadata **beyond** the final state (the attestation
  record itself lives under `nex.account_age_attestation` and is
  governed by its own retention schedule, not this one).
- Free-text revocation reasons (we store only the bucketed enum).
- Any content from messages, chats, or Emergency Help incidents — none
  of which are owned by the Family Links table.

## Open questions for founder review

- Is **90 days** correct for Bucket A? (Shorter = less data exposure;
  longer = better dispute resolution window.)
- Is a **bucketed enum** sufficient for `revoked_reason_category`, or
  do we need free-text reasons under tighter access controls?
- Does the Indonesian legal framework require specific **minimum**
  retention periods we must honour (e.g. for safeguarding records
  under PP 17/2025 or Permenkomdigi 9/2026)?
- Should Bucket C's "case duration + 7 years" default be reduced if
  Indonesian counsel finds a shorter statutory ceiling?

## Dependencies

- Requires the Indonesian legal review (per
  `docs/doctrine/nex-family-safety-indonesian-legal-review-brief-2026-10-10.md`)
  to validate the lawful basis and duration under PP 17/2025,
  Permenkomdigi 9/2026, and UU 27/2022 (PDP).
- Requires a **sweep job** implementation (nightly, idempotent,
  retry-safe) — NOT in current scope; requires a dedicated authorised
  wave.
- Requires an **access audit log** for Bucket A and Bucket C accesses
  — the sealed HQ console pattern applies.
- Requires a **legal-hold flag** on `nex.family_link` (new nullable
  column + partial index) — NOT in current scope; requires a dedicated
  migration wave.

## Explicit non-decisions

This draft does **NOT**:

- Approve the policy. Founder adopts after review (and after
  Indonesian counsel confirms there is no legal conflict).
- Authorise the sweep job to run. That is a separate authorised build.
- Authorise Safety Operations tooling. That is in the sealed HQ
  console roadmap.
- Amend any sealed migration. Migration 198 is untouched.
- Authorise any UI surface that reveals these retention windows to end
  users. User-facing retention copy is a separate wave.

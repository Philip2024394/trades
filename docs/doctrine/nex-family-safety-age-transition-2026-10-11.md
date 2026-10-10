# NEX Family Safety · Age Transition Workflow + Sweep Job

Authored 2026-10-10 by CC-4. Dates are ESTIMATES.

## 1 · Why

Every custody created in Phase 1 has a **finite life**. When the child
turns 16 the parent's custody MUST end and the account becomes a full
NEX account owned by the (now 16-year-old) user. This is a safeguarding
+ autonomy issue, not just a feature: a parent must not retain
indefinite custody of their adult child's chat account.

## 2 · Workflow

```
┌────────────────────────────────┐
│  Parent creates child account  │
│  with declared DOB             │
└────────────────────────────────┘
              │
              ▼
┌────────────────────────────────┐
│  Service computes              │
│  auto_transfer_at = DOB + 16y  │
│  on parent_custody_link        │
│  AND account_minor_profile     │
└────────────────────────────────┘
              │
              ▼       (30-day warning window)
┌────────────────────────────────┐
│  Dashboard shows countdown     │
│  chip on parent's view         │
└────────────────────────────────┘
              │
   ┌──────────┴──────────┐
   │                     │
   ▼                     ▼
Parent clicks         Deadline passes
"Notify child"        without parent action
   │                     │
   ▼                     │
Child sees             │
confirm-handover       │
route                  │
   │                     │
   ▼                     ▼
Child confirms         Sweep job runs at
atomic transition      midnight → atomic
                       transition
```

### 2a · Precompute auto_transfer_at

CC-1's service computes `auto_transfer_at` as the UTC midnight at
start-of-day on the DOB + 16 years. This mirrors onto two columns:

- `nex.parent_custody_link.auto_transfer_at`
- `nex.account_minor_profile.auto_transfer_at`

The duplication is deliberate: the age-transition reader never joins.

### 2b · Countdown chip

The sealed age-transition page at
`/nex-native/family-safety/age-transition` lists all custodies the
viewer parents where `auto_transfer_at` is within a sealed warning
window (default 30 days) and `transferred_at IS NULL AND revoked_at
IS NULL`. Each row renders a countdown chip with:

- `data-testid="nex-age-transition-countdown-<custodyId>"`
- Visible days remaining
- A "Notify child to confirm handover" CTA

### 2c · Parent notifies child

Clicking "Notify child" writes an audit row with action
`age_transfer_notified`. Idempotency: multiple clicks still produce
multiple audit rows (operators can see repeated nudges), but no state
on `parent_custody_link` changes.

### 2d · Child confirmation route

A sealed route at
`/nex-native/family-safety/age-transition/<childAccountId>/confirm-handover`
gated by the child's own session. Content:

- "Your parent has asked NEX to hand over custody of your account."
- Primary CTA: "I accept custody of my account" (`data-testid=
  "nex-age-transition-confirm-handover"`)
- Secondary CTA: "Not yet" (keeps the custody live).

Clicking the primary CTA fires the atomic transition.

### 2e · Atomic transition

The transition writes (in one DB transaction):

- `parent_custody_link.transferred_at = now()` and
  `link_type = 'transferred_at_16'`.
- `account_minor_profile.is_minor = FALSE` and
  `account_minor_profile.transferred_at = now()`.
  - **CRITICAL:** `safechat_always_on` remains at its current value
    (TRUE at this point) but is no longer enforced-locked because the
    account is no longer a minor. The CC-3 enforcer honours `is_minor`
    first, `safechat_always_on` second.
- `parent_custody_audit_log` += one row with action
  `age_transfer_completed`.

After commit, the parent's `/custody` list no longer shows the row and
the (now adult) user owns their own account.

## 3 · Sweep job

**Script:** `scripts/nex-canonical/_age-transition-sweep.mjs` (CC-3).

**Default:** `--dry-run` (reports what would transfer without writing).

**Live:** `--live` + `NEX_SESSION_IDENTITY === "nex_dev"` + explicit
operator confirmation prompt in interactive mode.

### 3a · Query

Rows where:

- `parent_custody_link.auto_transfer_at < now()`
- `parent_custody_link.transferred_at IS NULL`
- `parent_custody_link.revoked_at IS NULL`

### 3b · Transfer

For each row, run the same atomic transition as 2e. The write path is
shared between the child-confirm route and the sweep (they both call
the same `transferCustodyAtomic(custodyId)` function in
`age-transition-service.ts`).

### 3c · Idempotency

The sweep runs daily (operator-scheduled cron OR manual). Multiple
runs on the same row MUST NOT double-transfer. The service guards with
a `SELECT ... FOR UPDATE` and a WHERE clause requiring
`transferred_at IS NULL`.

### 3d · Audit

Every live transfer emits an `age_transfer_completed` audit row with
`action_details_redacted = 'sweep-job'`. A dry-run emits ZERO audit
rows and ZERO state changes.

## 4 · Edge cases

- **DOB in the future (clock skew):** The CHECK on migration-203
  prevents a future DOB being stored. The sweep tolerates clock skew
  up to the warning window default.
- **Parent revokes custody before auto-transfer:** `revoked_at` is set.
  The sweep ignores revoked rows. The child does NOT auto-promote;
  the custody is terminated differently.
- **Child dies / account tombstoned:** Operator process deletes the
  `nex_account` row; cascade deletes propagate to
  `parent_custody_link` and `account_minor_profile`. The audit log
  survives via `ON DELETE SET NULL`-less `custody_id` CASCADE, which
  is why we export audit data to the disaster-evidence bundle BEFORE
  any wipe.
- **Child confirms AFTER sweep already transferred:** The confirm-route
  checks `transferred_at` first and shows a friendly "You already
  have custody of your account" state instead of erroring.

## 5 · What CC-4 verifies in Playwright

Spec: `tests/e2e/nex-family-safety-age-transition.spec.ts`. All five
scenarios (S15-S19) are `test.fixme()` until CC-3 ships the route +
service + sweep script.

- S15: countdown chip visible for a seeded 5-day custody.
- S16: audit row `age_transfer_notified` after parent click.
- S17: child route atomic transition fires; `parent_custody_link.transferred_at`
  populated; parent's list no longer shows the custody.
- S18: `--dry-run` reports past-deadline rows without side-effects.
- S19: `--live` transfers past-deadline rows + emits
  `age_transfer_completed` audit rows.

## 6 · Dates

Dates are **ESTIMATES**. The 30-day warning window is a sealed default
that may be adjusted. The sweep's cadence (daily at midnight) is the
operator's choice, not a doctrine commitment.

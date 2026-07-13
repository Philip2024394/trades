# ADR-0005: Non-destructive canteen restore

Status: Accepted
Date: 2026-07-13

## Context

Merchants make mistakes. A kitchen fitter deletes their entire designs portfolio at 11pm because they misread a UI. A tester accidentally wipes their live product list. Without an undo path, our only options are "sorry" or "let me pull the DB backup manually" — neither of which scales past a handful of support tickets.

## Decision

Every editable canteen state is snapshotted to `hammerex_canteen_snapshots` (JSONB payload of canteen row + admin row + products + designs) on merchant save + a daily 3am cron. Admin can restore any snapshot from the Support tool. Critically, **restore is non-destructive**: before applying the target snapshot, the current state is captured as a `pre_restore` snapshot. Merchant can always "restore forward" if the restore itself was a mistake.

Admin restore is gated by 4 safety layers:
1. Admin session cookie
2. `ADMIN_RESET_PASSCODE` env passcode (second factor)
3. Slug confirmation typed exactly
4. Reason note ≥ 20 chars, permanent audit log

Every restore is logged in `hammerex_canteen_restore_log` (immutable, separate table so snapshot retention pruning never loses the audit record).

## Consequences

- **Positive:** No support ticket ever ends with "sorry, that's gone forever". Restore reverses in a single admin click.
- **Positive:** Restore itself is undoable — admin restore mistakes are recoverable.
- **Positive:** Audit trail satisfies compliance / forensic needs. Every restore attributable to an admin ID and a reason.
- **Negative:** Storage cost per canteen grows over time. Retention policy caps rolling `auto` snapshots at 30 per canteen.
- **Negative:** JSONB payload shape can drift as schemas evolve. Restore logic must handle missing fields gracefully.

## Alternatives considered

- **Rely on Supabase point-in-time recovery** — rejected. Not per-merchant. Restoring one merchant would require staging a whole DB snapshot elsewhere. Doesn't scale.
- **Merchant self-restore** — considered, deferred. Simpler to ship admin-only first; merchant UI can layer on later using the same snapshot / restore functions.
- **Destructive restore (overwrite without pre-snapshot)** — rejected. One bad restore would compound the merchant's mistake, not fix it.
</parameter>

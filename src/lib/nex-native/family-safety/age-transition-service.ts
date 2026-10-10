// src/lib/nex-native/family-safety/age-transition-service.ts
//
// NEX Family Safety · CC-3 · Age-transition workflow.
//
// Founder decision E (2026-10-10):
//   · At the minor's 16th birthday, custody transfers from the parent
//     to the child.
//   · 30 days before the transition, the guardian receives an in-app
//     notification.
//   · The child can CONFIRM the handover before the deadline. On
//     confirmation the handover is immediate.
//   · If the deadline passes without confirmation, the sweep job
//     performs an atomic transfer: `parent_custody_link.transferred_at`
//     is set, and `nex.account_minor_profile.is_minor=FALSE`.
//
// Doctrine (sealed with this file):
//   · The transition PRESERVES the child's account identity · the
//     `account_id` does not change. Only the minor profile flips.
//   · Both tables are updated in ONE transaction. Any partial write
//     is treated as a failure and the service surface returns
//     `transition_atomic_failure`.
//   · ONLY the child (via `confirmChildHandover`) or the sweep job
//     (via `sweepPendingTransitions`) may transition the row. Any
//     other actor receives `UNAUTHORIZED_ACTOR`.
//   · simulated=TRUE in Phase 1 · the service refuses to accept
//     FALSE writes.

import "server-only";

import { withClient, type PgClientLike } from "@/lib/nex/db";

// ═════════════════════════════════════════════════════════════════════
// §1 · Sealed shape
// ═════════════════════════════════════════════════════════════════════

export const AGE_TRANSITION_STATES = [
  "scheduled",
  "awaiting_child_confirmation",
  "completed_by_child",
  "completed_by_sweep",
] as const;
export type AgeTransitionState = (typeof AGE_TRANSITION_STATES)[number];

export const AGE_TRANSITION_ACTIONS = [
  "parent_notified",
  "child_confirmation_requested",
  "child_confirmed",
  "age_transfer_completed_auto",
] as const;
export type AgeTransitionAction = (typeof AGE_TRANSITION_ACTIONS)[number];

export const AGE_TRANSITION_ERROR_CODES = {
  INVALID_DOB: "age_transition.invalid_declared_date_of_birth",
  INVALID_CUSTODY_ID: "age_transition.invalid_custody_id",
  INVALID_ACTOR: "age_transition.invalid_actor",
  CUSTODY_NOT_FOUND: "age_transition.custody_not_found",
  UNAUTHORIZED_ACTOR: "age_transition.unauthorized_actor",
  ALREADY_TRANSFERRED: "age_transition.already_transferred",
  ALREADY_REVOKED: "age_transition.already_revoked",
  NOT_DUE: "age_transition.not_due",
  TRANSITION_ATOMIC_FAILURE: "age_transition.transition_atomic_failure",
  DB_UNAVAILABLE: "age_transition.db_unavailable",
} as const;
export type AgeTransitionErrorCode =
  (typeof AGE_TRANSITION_ERROR_CODES)[keyof typeof AGE_TRANSITION_ERROR_CODES];

export interface UpcomingTransitionEntry {
  readonly custodyId: string;
  readonly parentAccountId: string;
  readonly childAccountId: string;
  readonly autoTransferAt: string; // ISO 8601
  readonly state: AgeTransitionState;
  readonly simulated: boolean;
  readonly daysUntilTransfer: number; // integer · may be negative when overdue
}

export interface AgeTransitionAuditEntry {
  readonly custodyId: string;
  readonly childAccountId: string;
  readonly parentAccountId: string;
  readonly action: AgeTransitionAction;
  readonly actorAccountId: string | null; // null for sweep
  readonly at: string;
  readonly simulated: true;
}

export interface AgeTransitionResult {
  readonly ok: boolean;
  readonly custodyId: string | null;
  readonly action: AgeTransitionAction | null;
  readonly completedAt: string | null;
  readonly audit: AgeTransitionAuditEntry | null;
  readonly reason: AgeTransitionErrorCode | null;
}

export interface SweepResult {
  readonly scanned: number;
  readonly transferred: number;
  readonly failures: number;
  readonly entries: readonly AgeTransitionAuditEntry[];
}

// ═════════════════════════════════════════════════════════════════════
// §2 · Pure helper · auto-transfer-at computation
// ═════════════════════════════════════════════════════════════════════

/**
 * Compute the sealed auto-transfer-at timestamp from a declared date
 * of birth. The transition occurs at midnight UTC on the 16th
 * birthday · the sweep job may run at any time after that moment.
 *
 * `declaredDateOfBirth` must be an ISO 8601 date string (YYYY-MM-DD).
 * Throws `INVALID_DOB` on malformed input.
 *
 * Edge cases:
 *   · Leap-year DOB (2008-02-29) maps to 2024-02-29 when the target
 *     year is a leap year, else 2024-03-01 (JavaScript Date behaviour
 *     is reproduced faithfully · the test suite pins this).
 */
export function computeAutoTransferAt(declaredDateOfBirth: string): string {
  if (
    !declaredDateOfBirth ||
    typeof declaredDateOfBirth !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(declaredDateOfBirth)
  ) {
    throw new Error(AGE_TRANSITION_ERROR_CODES.INVALID_DOB);
  }
  const [yStr, mStr, dStr] = declaredDateOfBirth.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    throw new Error(AGE_TRANSITION_ERROR_CODES.INVALID_DOB);
  }
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) {
    throw new Error(AGE_TRANSITION_ERROR_CODES.INVALID_DOB);
  }
  const target = new Date(Date.UTC(y + 16, m - 1, d, 0, 0, 0, 0));
  if (
    Number.isNaN(target.getTime()) ||
    target.getUTCFullYear() !== y + 16
  ) {
    // Leap-year rollover · fall through · the JS Date behaviour above
    // may have advanced the day. If the Date is NaN that's a true
    // invalid input.
    if (Number.isNaN(target.getTime())) {
      throw new Error(AGE_TRANSITION_ERROR_CODES.INVALID_DOB);
    }
  }
  return target.toISOString();
}

/** Compute whole-day delta from `nowIso` to `targetIso` · UTC-grounded.
 *  Negative when `targetIso` is in the past. */
export function daysUntil(targetIso: string, nowIso: string): number {
  const t = new Date(targetIso).getTime();
  const n = new Date(nowIso).getTime();
  if (!Number.isFinite(t) || !Number.isFinite(n)) return 0;
  return Math.floor((t - n) / (1000 * 60 * 60 * 24));
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Listing · upcoming transitions for a parent
// ═════════════════════════════════════════════════════════════════════

/**
 * Return the custodies belonging to `parentAccountId` whose
 * `auto_transfer_at` falls within `withinDays` of `nowIso` (and is
 * not already transferred / revoked).
 *
 * The default window is 30 days (founder decision E notification
 * window).
 *
 * Returned rows do NOT include any content column · just the
 * relationship structure and the countdown.
 */
export async function listUpcomingTransitions(
  parentAccountId: string,
  withinDays: number = 30,
  nowIso: string = new Date().toISOString(),
): Promise<readonly UpcomingTransitionEntry[]> {
  if (!parentAccountId || typeof parentAccountId !== "string") return [];
  if (!Number.isFinite(withinDays) || withinDays < 0) return [];

  const nowTs = new Date(nowIso).getTime();
  if (!Number.isFinite(nowTs)) return [];
  const windowEndIso = new Date(nowTs + withinDays * 86400_000).toISOString();

  try {
    const rows = await withClient(async (client) => {
      const r = await client.query(
        `SELECT
           custody_id,
           parent_account_id,
           child_account_id,
           auto_transfer_at,
           transferred_at,
           revoked_at,
           simulated
         FROM nex.parent_custody_link
         WHERE parent_account_id = $1
           AND auto_transfer_at IS NOT NULL
           AND transferred_at IS NULL
           AND revoked_at IS NULL
           AND auto_transfer_at <= $2
         ORDER BY auto_transfer_at ASC`,
        [parentAccountId, windowEndIso],
      );
      return r.rows;
    });

    if (!rows) return [];
    const out: UpcomingTransitionEntry[] = rows.map((raw) => {
      const transferAt = String(raw.auto_transfer_at);
      return {
        custodyId: String(raw.custody_id),
        parentAccountId: String(raw.parent_account_id),
        childAccountId: String(raw.child_account_id),
        autoTransferAt: transferAt,
        state: "scheduled" as AgeTransitionState,
        simulated: raw.simulated === true,
        daysUntilTransfer: daysUntil(transferAt, nowIso),
      } satisfies UpcomingTransitionEntry;
    });
    return out;
  } catch {
    return [];
  }
}

// ═════════════════════════════════════════════════════════════════════
// §4 · Fetch a single custody row (shared read helper)
// ═════════════════════════════════════════════════════════════════════

interface CustodySnapshot {
  readonly custodyId: string;
  readonly parentAccountId: string;
  readonly childAccountId: string;
  readonly autoTransferAt: string | null;
  readonly transferredAt: string | null;
  readonly revokedAt: string | null;
  readonly simulated: boolean;
}

async function readCustodyRow(
  client: PgClientLike,
  custodyId: string,
): Promise<CustodySnapshot | null> {
  const r = await client.query(
    `SELECT
       custody_id,
       parent_account_id,
       child_account_id,
       auto_transfer_at,
       transferred_at,
       revoked_at,
       simulated
     FROM nex.parent_custody_link
     WHERE custody_id = $1
     LIMIT 1`,
    [custodyId],
  );
  if ((r.rowCount ?? 0) === 0) return null;
  const raw = r.rows[0]!;
  return {
    custodyId: String(raw.custody_id),
    parentAccountId: String(raw.parent_account_id),
    childAccountId: String(raw.child_account_id),
    autoTransferAt:
      typeof raw.auto_transfer_at === "string" && raw.auto_transfer_at.length > 0
        ? raw.auto_transfer_at
        : raw.auto_transfer_at
          ? new Date(raw.auto_transfer_at as number).toISOString()
          : null,
    transferredAt:
      typeof raw.transferred_at === "string" && raw.transferred_at.length > 0
        ? raw.transferred_at
        : raw.transferred_at
          ? new Date(raw.transferred_at as number).toISOString()
          : null,
    revokedAt:
      typeof raw.revoked_at === "string" && raw.revoked_at.length > 0
        ? raw.revoked_at
        : raw.revoked_at
          ? new Date(raw.revoked_at as number).toISOString()
          : null,
    simulated: raw.simulated === true,
  } satisfies CustodySnapshot;
}

// ═════════════════════════════════════════════════════════════════════
// §5 · Request child confirmation (parent-initiated)
// ═════════════════════════════════════════════════════════════════════

/**
 * The parent custodian records that they've reviewed the upcoming
 * transition and are prompting the child to confirm. This does NOT
 * transfer the account · it is a workflow-step audit record.
 *
 * Guardrails:
 *   · `actorAccountId` MUST match `parent_account_id` on the custody
 *     row · else UNAUTHORIZED_ACTOR.
 *   · Custody must not already be transferred or revoked.
 */
export async function requestChildConfirmation(
  custodyId: string,
  actorAccountId: string,
  nowIso: string = new Date().toISOString(),
): Promise<AgeTransitionResult> {
  if (!custodyId || typeof custodyId !== "string") {
    return fail(AGE_TRANSITION_ERROR_CODES.INVALID_CUSTODY_ID);
  }
  if (!actorAccountId || typeof actorAccountId !== "string") {
    return fail(AGE_TRANSITION_ERROR_CODES.INVALID_ACTOR);
  }

  const result = await withClient(async (client) => {
    const row = await readCustodyRow(client, custodyId);
    if (!row) return fail(AGE_TRANSITION_ERROR_CODES.CUSTODY_NOT_FOUND);
    if (row.transferredAt)
      return fail(AGE_TRANSITION_ERROR_CODES.ALREADY_TRANSFERRED);
    if (row.revokedAt) return fail(AGE_TRANSITION_ERROR_CODES.ALREADY_REVOKED);
    if (row.parentAccountId !== actorAccountId)
      return fail(AGE_TRANSITION_ERROR_CODES.UNAUTHORIZED_ACTOR);

    const audit: AgeTransitionAuditEntry = {
      custodyId: row.custodyId,
      childAccountId: row.childAccountId,
      parentAccountId: row.parentAccountId,
      action: "child_confirmation_requested",
      actorAccountId,
      at: nowIso,
      simulated: true,
    };

    return {
      ok: true,
      custodyId: row.custodyId,
      action: "child_confirmation_requested" as AgeTransitionAction,
      completedAt: null,
      audit,
      reason: null,
    } satisfies AgeTransitionResult;
  });

  return result ?? fail(AGE_TRANSITION_ERROR_CODES.DB_UNAVAILABLE);
}

// ═════════════════════════════════════════════════════════════════════
// §6 · Confirm handover (child-initiated · atomic transfer)
// ═════════════════════════════════════════════════════════════════════

/**
 * The child confirms they're ready to take over. ATOMICALLY:
 *   · sets `nex.parent_custody_link.transferred_at = nowIso`
 *   · flips `nex.account_minor_profile.is_minor = FALSE` AND sets
 *     `transferred_at = nowIso` on the same account_id
 *
 * Both updates run in ONE transaction. If either fails the entire
 * transition rolls back and the caller receives
 * `TRANSITION_ATOMIC_FAILURE`.
 *
 * Only the child (actorAccountId === row.child_account_id) is
 * authorised. Any other actor receives UNAUTHORIZED_ACTOR.
 */
export async function confirmChildHandover(
  custodyId: string,
  actorAccountId: string,
  nowIso: string = new Date().toISOString(),
): Promise<AgeTransitionResult> {
  return performAtomicTransfer({
    custodyId,
    actorAccountId,
    nowIso,
    action: "child_confirmed",
    actorRequirement: "child",
  });
}

// ═════════════════════════════════════════════════════════════════════
// §7 · Sweep · deadline-passed auto-transfer
// ═════════════════════════════════════════════════════════════════════

/**
 * Scan `nex.parent_custody_link` for rows whose `auto_transfer_at`
 * has elapsed and are not already transferred/revoked. For each row
 * perform the same atomic transfer as `confirmChildHandover`, but
 * with `actorAccountId=null` and `action='age_transfer_completed_auto'`.
 *
 * The sweep is idempotent: a second run after a successful transfer
 * finds no eligible rows.
 */
export async function sweepPendingTransitions(
  nowIso: string = new Date().toISOString(),
): Promise<SweepResult> {
  const nowTs = new Date(nowIso).getTime();
  if (!Number.isFinite(nowTs)) {
    return { scanned: 0, transferred: 0, failures: 0, entries: [] };
  }

  const candidates = await withClient(async (client) => {
    const r = await client.query(
      `SELECT custody_id
         FROM nex.parent_custody_link
        WHERE auto_transfer_at IS NOT NULL
          AND transferred_at IS NULL
          AND revoked_at IS NULL
          AND auto_transfer_at <= $1
        ORDER BY auto_transfer_at ASC`,
      [nowIso],
    );
    return r.rows.map((row) => String(row.custody_id));
  });

  if (!candidates) {
    return { scanned: 0, transferred: 0, failures: 0, entries: [] };
  }

  let transferred = 0;
  let failures = 0;
  const entries: AgeTransitionAuditEntry[] = [];
  for (const custodyId of candidates) {
    const r = await performAtomicTransfer({
      custodyId,
      actorAccountId: null,
      nowIso,
      action: "age_transfer_completed_auto",
      actorRequirement: "sweep",
    });
    if (r.ok && r.audit) {
      transferred += 1;
      entries.push(r.audit);
    } else {
      failures += 1;
    }
  }
  return {
    scanned: candidates.length,
    transferred,
    failures,
    entries,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §8 · Shared atomic transfer implementation
// ═════════════════════════════════════════════════════════════════════

interface AtomicTransferArgs {
  readonly custodyId: string;
  readonly actorAccountId: string | null;
  readonly nowIso: string;
  readonly action: AgeTransitionAction;
  readonly actorRequirement: "child" | "sweep";
}

async function performAtomicTransfer(
  args: AtomicTransferArgs,
): Promise<AgeTransitionResult> {
  if (!args.custodyId || typeof args.custodyId !== "string") {
    return fail(AGE_TRANSITION_ERROR_CODES.INVALID_CUSTODY_ID);
  }
  if (args.actorRequirement === "child") {
    if (!args.actorAccountId || typeof args.actorAccountId !== "string") {
      return fail(AGE_TRANSITION_ERROR_CODES.INVALID_ACTOR);
    }
  }

  const result = await withClient(async (client) => {
    const row = await readCustodyRow(client, args.custodyId);
    if (!row) return fail(AGE_TRANSITION_ERROR_CODES.CUSTODY_NOT_FOUND);
    if (row.transferredAt)
      return fail(AGE_TRANSITION_ERROR_CODES.ALREADY_TRANSFERRED);
    if (row.revokedAt) return fail(AGE_TRANSITION_ERROR_CODES.ALREADY_REVOKED);

    if (args.actorRequirement === "child") {
      if (args.actorAccountId !== row.childAccountId) {
        return fail(AGE_TRANSITION_ERROR_CODES.UNAUTHORIZED_ACTOR);
      }
    } else {
      // Sweep · require the row to be due.
      if (!row.autoTransferAt) {
        return fail(AGE_TRANSITION_ERROR_CODES.NOT_DUE);
      }
      const transferTs = new Date(row.autoTransferAt).getTime();
      const nowTs = new Date(args.nowIso).getTime();
      if (!Number.isFinite(transferTs) || !Number.isFinite(nowTs)) {
        return fail(AGE_TRANSITION_ERROR_CODES.NOT_DUE);
      }
      if (transferTs > nowTs) return fail(AGE_TRANSITION_ERROR_CODES.NOT_DUE);
    }

    // Atomic transaction · both rows in one BEGIN/COMMIT.
    try {
      await client.query("BEGIN");

      const u1 = await client.query(
        `UPDATE nex.parent_custody_link
            SET transferred_at = $2
          WHERE custody_id = $1
            AND transferred_at IS NULL
            AND revoked_at IS NULL`,
        [row.custodyId, args.nowIso],
      );
      if ((u1.rowCount ?? 0) !== 1) {
        await client.query("ROLLBACK");
        return fail(AGE_TRANSITION_ERROR_CODES.TRANSITION_ATOMIC_FAILURE);
      }

      const u2 = await client.query(
        `UPDATE nex.account_minor_profile
            SET is_minor = FALSE,
                transferred_at = $2,
                updated_at = $2
          WHERE account_id = $1`,
        [row.childAccountId, args.nowIso],
      );
      if ((u2.rowCount ?? 0) !== 1) {
        await client.query("ROLLBACK");
        return fail(AGE_TRANSITION_ERROR_CODES.TRANSITION_ATOMIC_FAILURE);
      }

      await client.query("COMMIT");
    } catch {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* noop */
      }
      return fail(AGE_TRANSITION_ERROR_CODES.TRANSITION_ATOMIC_FAILURE);
    }

    const audit: AgeTransitionAuditEntry = {
      custodyId: row.custodyId,
      childAccountId: row.childAccountId,
      parentAccountId: row.parentAccountId,
      action: args.action,
      actorAccountId: args.actorAccountId,
      at: args.nowIso,
      simulated: true,
    };

    return {
      ok: true,
      custodyId: row.custodyId,
      action: args.action,
      completedAt: args.nowIso,
      audit,
      reason: null,
    } satisfies AgeTransitionResult;
  });

  return result ?? fail(AGE_TRANSITION_ERROR_CODES.DB_UNAVAILABLE);
}

function fail(reason: AgeTransitionErrorCode): AgeTransitionResult {
  return {
    ok: false,
    custodyId: null,
    action: null,
    completedAt: null,
    audit: null,
    reason,
  };
}

// src/lib/nex-native/safechat/retention-sweep.ts
//
// NEX SafeChat Phase 1 · classification retention sweep.
// -------------------------------------------------------------
// Deletes rows from nex.safechat_classification older than the configured
// retention window. Idempotent · safe to re-run.
//
// Doctrine (sealed 2026-10-10 Privacy Audit):
//   · The sweep is content-blind · it deletes by classified_at only.
//     It never reads rule_matches / signals bodies.
//   · retentionDays must be a positive integer · the function rejects
//     zero / negative / NaN / fractional with a clear error so callers
//     cannot accidentally pass "0" (= delete everything) or similar.
//   · Session identity (current_database() = 'nex_dev') is enforced at
//     the script boundary (scripts/nex-canonical/_safechat-retention-sweep.mjs).
//   · The DB query uses parameterised interval math · never string
//     concatenation of user-supplied values.

import "server-only";
import { withClient } from "@/lib/nex/db";

export interface SweepResult {
  readonly deletedCount: number;
  readonly cutoffAt: string;
}

export interface SweepArgs {
  readonly retentionDays: number;
}

function validateRetentionDays(retentionDays: number): void {
  if (
    typeof retentionDays !== "number" ||
    !Number.isFinite(retentionDays) ||
    !Number.isInteger(retentionDays) ||
    retentionDays <= 0
  ) {
    throw new Error(
      `[safechat.retention] invalid retentionDays · must be a positive integer · got ${String(retentionDays)}`,
    );
  }
}

/** Delete every row in nex.safechat_classification whose classified_at
 *  is older than (now - retentionDays). Returns {deletedCount, cutoffAt}. */
export async function sweepClassificationsOlderThan(
  args: SweepArgs,
): Promise<SweepResult> {
  validateRetentionDays(args.retentionDays);

  const result = await withClient(async (client) => {
    const r = await client.query(
      `WITH cutoff AS (
         SELECT now() - ($1::int || ' days')::interval AS at
       )
       DELETE FROM nex.safechat_classification
        WHERE classified_at < (SELECT at FROM cutoff)
       RETURNING classification_id`,
      [args.retentionDays],
    );
    const cutoffRow = await client.query(
      `SELECT (now() - ($1::int || ' days')::interval)::text AS at`,
      [args.retentionDays],
    );
    const cutoffAt = String(
      (cutoffRow.rows[0] as { at: string } | undefined)?.at ?? "",
    );
    return {
      deletedCount: r.rowCount ?? 0,
      cutoffAt,
    };
  });
  if (!result) {
    return { deletedCount: 0, cutoffAt: "" };
  }
  return result;
}

/** Dry-run · counts the rows that WOULD be deleted, without deleting. */
export async function countClassificationsOlderThan(
  args: SweepArgs,
): Promise<SweepResult> {
  validateRetentionDays(args.retentionDays);

  const result = await withClient(async (client) => {
    const r = await client.query(
      `SELECT count(*)::int AS n,
              (now() - ($1::int || ' days')::interval)::text AS at
         FROM nex.safechat_classification
        WHERE classified_at < now() - ($1::int || ' days')::interval`,
      [args.retentionDays],
    );
    const row = r.rows[0] as { n: number; at: string } | undefined;
    return {
      deletedCount: Number(row?.n ?? 0),
      cutoffAt: String(row?.at ?? ""),
    };
  });
  if (!result) {
    return { deletedCount: 0, cutoffAt: "" };
  }
  return result;
}

// src/lib/nex-native/cross-db-reconciler/log-service.ts
//
// NEX Directory · Cross-DB Reconciler · audit log I/O boundary.
//
// WHAT THIS MODULE IS
//   The thin pg wrapper around `nex.cross_db_reconcile_log` (migration
//   191). Writes one audit row per reconcile attempt + exposes a
//   read-only recent-events lookup for the operator.
//
// WHAT THIS MODULE IS NOT
//   · Not the reconciler. The decision tree + Supabase client wiring
//     lives in `./reconciler.ts`. This file knows nothing about
//     Supabase.
//   · Not a secret logger. error_detail is already sanitised by the
//     caller via the sealed `sanitiseError` helper (see
//     directory-service.ts). This module appends extra safety by
//     refusing to log an error_detail longer than 2000 chars (the
//     migration CHECK rejects longer, so we fail-fast before the DB
//     round trip).
//
// DOCTRINE
//   · pg withClient from `@/lib/nex/db`. Same pool the Directory
//     service uses. Returns null when NEX_POSTGRES_URL is unset so
//     dev-offline mode degrades gracefully — recordReconcileEvent
//     reports alreadyRecorded=false with a sentinel logId.
//   · Idempotency: UPSERT via `ON CONFLICT (idempotency_key,
//     attempt_number) DO NOTHING RETURNING log_id`. When RETURNING
//     yields zero rows, the row was already present — a follow-up
//     SELECT fetches the existing log_id and we return
//     alreadyRecorded=true. The service NEVER throws for duplicate
//     attempts; the caller treats dedup as success.
//   · Doctrine 7: audit log entries NEVER contain PII beyond the
//     Supabase account id (a soft reference, operationally traceable).
//     We document the raw storage here · any export job MUST hash
//     this column before leaving NEX.

import "server-only";
import { withClient } from "@/lib/nex/db";
import {
  RECONCILE_EVENT_TYPES,
  isReconcileEventType,
  type RecordReconcileEventArgs,
  type RecordReconcileEventResult,
  type ReconcileLogEntry,
  type ReconcileEventType,
} from "./types";

// ═════════════════════════════════════════════════════════════════════
// §1 · Public API
// ═════════════════════════════════════════════════════════════════════

/**
 * Sentinel logId returned when the pg pool is unavailable (NEX
 * running without NEX_POSTGRES_URL set). Callers should treat this
 * as "I couldn't record anything, degraded gracefully".
 */
export const RECORD_UNAVAILABLE_SENTINEL = "00000000-0000-0000-0000-000000000000";

/**
 * Write one row to nex.cross_db_reconcile_log. Idempotent per
 * (idempotency_key, attempt_number).
 *
 * Returns `alreadyRecorded: true` when the ON CONFLICT branch fires.
 * In that case the returned logId points at the pre-existing row.
 */
export async function recordReconcileEvent(
  args: RecordReconcileEventArgs,
): Promise<RecordReconcileEventResult> {
  validateRecordArgs(args);

  const simulated = args.simulated ?? true;
  const attemptNumber = args.attemptNumber ?? 1;

  const result = await withClient(async (client) => {
    // Phase 1: UPSERT via ON CONFLICT DO NOTHING. RETURNING yields the
    // new log_id iff an insert actually happened.
    const insertRes = await client.query(
      `
      INSERT INTO nex.cross_db_reconcile_log (
        event_type,
        claim_id,
        canonical_business_id,
        supabase_account_id,
        affected_rows,
        error_code,
        error_detail,
        idempotency_key,
        simulated,
        attempt_number
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (idempotency_key, attempt_number) DO NOTHING
      RETURNING log_id
      `,
      [
        args.eventType,
        args.claimId ?? null,
        args.canonicalBusinessId ?? null,
        args.supabaseAccountId ?? null,
        args.affectedRows ?? null,
        args.errorCode ?? null,
        args.errorDetail ?? null,
        args.idempotencyKey,
        simulated,
        attemptNumber,
      ],
    );

    if (insertRes.rowCount === 1) {
      const row = insertRes.rows[0];
      return {
        logId: String(row.log_id),
        alreadyRecorded: false,
      };
    }

    // Phase 2: duplicate — fetch the pre-existing log_id.
    const existingRes = await client.query(
      `
      SELECT log_id FROM nex.cross_db_reconcile_log
       WHERE idempotency_key = $1 AND attempt_number = $2
      `,
      [args.idempotencyKey, attemptNumber],
    );
    if (existingRes.rowCount === 1) {
      return {
        logId: String(existingRes.rows[0].log_id),
        alreadyRecorded: true,
      };
    }

    // Unreachable in practice (ON CONFLICT means the row exists), but
    // we treat it as "unavailable" rather than throwing.
    return {
      logId: RECORD_UNAVAILABLE_SENTINEL,
      alreadyRecorded: false,
    };
  });

  if (result === null) {
    // Pool unavailable (NEX_POSTGRES_URL not set in this env).
    return {
      logId: RECORD_UNAVAILABLE_SENTINEL,
      alreadyRecorded: false,
    };
  }
  return result;
}

/**
 * Read the N most recent audit rows. Admin-read-only. The pg driver
 * returns rows with lowercase snake_case keys; we project to the
 * typed ReconcileLogEntry shape.
 */
export async function readRecentReconcileEvents(
  limit: number,
): Promise<ReconcileLogEntry[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new Error(
      `invalid_limit · readRecentReconcileEvents requires 1 <= limit <= 500, got ${limit}`,
    );
  }

  const rows = await withClient(async (client) => {
    const res = await client.query(
      `
      SELECT
        log_id,
        event_type,
        claim_id,
        canonical_business_id,
        supabase_account_id,
        affected_rows,
        error_code,
        error_detail,
        idempotency_key,
        simulated,
        attempt_number,
        created_at
      FROM nex.cross_db_reconcile_log
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [limit],
    );
    return res.rows;
  });

  if (rows === null) return [];

  return rows.map(projectRowToEntry);
}

// ═════════════════════════════════════════════════════════════════════
// §2 · Internal helpers
// ═════════════════════════════════════════════════════════════════════

function validateRecordArgs(args: RecordReconcileEventArgs): void {
  if (!isReconcileEventType(args.eventType)) {
    throw new Error(
      `invalid_event_type · got '${String(args.eventType)}' expected one of ${RECONCILE_EVENT_TYPES.join(" | ")}`,
    );
  }
  if (typeof args.idempotencyKey !== "string" || args.idempotencyKey.length < 1 || args.idempotencyKey.length > 64) {
    throw new Error(
      `invalid_idempotency_key · length must be 1..64, got ${typeof args.idempotencyKey === "string" ? args.idempotencyKey.length : "non-string"}`,
    );
  }
  if (args.attemptNumber !== undefined) {
    if (!Number.isInteger(args.attemptNumber) || args.attemptNumber < 1 || args.attemptNumber > 10) {
      throw new Error(
        `invalid_attempt_number · must be integer 1..10, got ${String(args.attemptNumber)}`,
      );
    }
  }
  if (args.affectedRows !== undefined && args.affectedRows !== null) {
    if (!Number.isInteger(args.affectedRows) || args.affectedRows < 0) {
      throw new Error(
        `invalid_affected_rows · must be non-negative integer or null, got ${String(args.affectedRows)}`,
      );
    }
  }
  if (args.errorDetail !== undefined && args.errorDetail !== null) {
    if (typeof args.errorDetail !== "string" || args.errorDetail.length > 2000) {
      throw new Error(
        `invalid_error_detail · must be string <= 2000 chars or null`,
      );
    }
  }
  if (args.errorCode !== undefined && args.errorCode !== null) {
    if (typeof args.errorCode !== "string" || args.errorCode.length < 1 || args.errorCode.length > 64) {
      throw new Error(
        `invalid_error_code · must be string 1..64 chars or null`,
      );
    }
  }
}

function projectRowToEntry(row: Record<string, unknown>): ReconcileLogEntry {
  return {
    logId: String(row.log_id),
    eventType: row.event_type as ReconcileEventType,
    claimId: row.claim_id === null ? null : String(row.claim_id),
    canonicalBusinessId:
      row.canonical_business_id === null ? null : String(row.canonical_business_id),
    supabaseAccountId:
      row.supabase_account_id === null ? null : String(row.supabase_account_id),
    affectedRows:
      row.affected_rows === null ? null : Number(row.affected_rows),
    errorCode: row.error_code === null ? null : String(row.error_code),
    errorDetail: row.error_detail === null ? null : String(row.error_detail),
    idempotencyKey: String(row.idempotency_key),
    simulated: Boolean(row.simulated),
    attemptNumber: Number(row.attempt_number),
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(String(row.created_at)),
  };
}

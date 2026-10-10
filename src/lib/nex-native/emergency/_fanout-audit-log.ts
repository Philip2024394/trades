// src/lib/nex-native/emergency/_fanout-audit-log.ts
//
// NEX Emergency Help · fan-out audit log writer.
//
// Writes to `nex.emergency_fanout_log` (migration 197).
//
// Doctrine:
//   · One row per fan-out ATTEMPT, no matter the outcome.
//   · Idempotency enforced at the DB layer via UNIQUE(idempotency_key).
//     The service treats a 23505 (unique_violation) as "already
//     logged" and returns `alreadyLogged: true` without raising.
//   · `recipient_identifier` is opaque: either a NEX account_id uuid
//     or a SHA-16 hash of a lower-cased email / normalised phone.
//     Raw PII never enters the audit log.

import "server-only";
import { createHash } from "node:crypto";
import { withClient } from "@/lib/nex/db";

export type FanOutTransition =
  | "pending_confirmation"
  | "active"
  | "revoked_within_window"
  | "cancelled"
  | "resolved";

export type FanOutChannel = "email" | "sms" | "whatsapp" | "in_app";

export type FanOutOutcome =
  | "ok"
  | "skipped"
  | "honest_blocked"
  | "rate_limited"
  | "provider_error";

export interface AuditWriteArgs {
  readonly incidentId: string;
  readonly transition: FanOutTransition;
  readonly channel: FanOutChannel;
  readonly recipientIdentifier: string;
  readonly outcome: FanOutOutcome;
  readonly reason: string | null;
  readonly idempotencyKey: string;
  readonly simulated: boolean;
}

export interface AuditWriteResult {
  readonly inserted: boolean;
  readonly alreadyLogged: boolean;
  readonly logId: string | null;
}

/** SHA-16 hash of a string. Used to opaque-ify emails and phones. */
export function hashIdentifier(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

/** Normalise + hash an email address into an opaque recipient_identifier. */
export function identifierFromEmail(email: string): string {
  return `email:${hashIdentifier(email.trim().toLowerCase())}`;
}

/** Normalise + hash a phone number into an opaque recipient_identifier. */
export function identifierFromPhone(phone: string): string {
  const normalised = phone.trim().replace(/[\s\-()]/g, "");
  return `phone:${hashIdentifier(normalised)}`;
}

/** Account-id identifier is pass-through (account ids are already opaque uuids). */
export function identifierFromAccount(accountId: string): string {
  return `account:${accountId.trim()}`;
}

/** Compose the sealed idempotency key shape. Stable across re-runs. */
export function makeIdempotencyKey(args: {
  incidentId: string;
  transition: FanOutTransition;
  channel: FanOutChannel;
  recipientIdentifier: string;
}): string {
  const seed = [
    args.incidentId.trim(),
    args.transition,
    args.channel,
    args.recipientIdentifier,
  ].join(":");
  return createHash("sha256").update(seed).digest("hex");
}

/**
 * Writes a single audit row. If an idempotency conflict occurs the
 * writer treats it as "already logged" (idempotent re-run).
 */
export async function writeFanOutAudit(
  args: AuditWriteArgs,
): Promise<AuditWriteResult> {
  if (typeof args.incidentId !== "string" || args.incidentId.trim().length === 0) {
    throw new Error("fanout_audit.invalid_incident_id");
  }
  if (typeof args.idempotencyKey !== "string" || args.idempotencyKey.trim().length === 0) {
    throw new Error("fanout_audit.invalid_idempotency_key");
  }
  if (typeof args.recipientIdentifier !== "string" || args.recipientIdentifier.trim().length === 0) {
    throw new Error("fanout_audit.invalid_recipient_identifier");
  }

  const result = await withClient(async (client) => {
    try {
      const r = await client.query(
        `INSERT INTO nex.emergency_fanout_log
           (incident_id, transition, channel, recipient_identifier,
            outcome, reason, idempotency_key, simulated)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING log_id::text`,
        [
          args.incidentId.trim(),
          args.transition,
          args.channel,
          args.recipientIdentifier.trim(),
          args.outcome,
          args.reason,
          args.idempotencyKey.trim(),
          args.simulated,
        ],
      );
      if ((r.rowCount ?? 0) === 1) {
        return {
          inserted: true,
          alreadyLogged: false,
          logId: String((r.rows[0] as { log_id: string }).log_id),
        };
      }
      return { inserted: false, alreadyLogged: true, logId: null };
    } catch (err) {
      // Belt-and-braces: if the ON CONFLICT path somehow doesn't swallow
      // the 23505 (e.g. older pg driver), treat it the same.
      const code = (err as { code?: string } | null)?.code;
      if (code === "23505") {
        return { inserted: false, alreadyLogged: true, logId: null };
      }
      throw err;
    }
  });
  if (result === null) throw new Error("fanout_audit.db_unavailable");
  return result;
}

/** Reader (used by operator surfaces + tests). */
export async function listFanOutAuditForIncident(
  incidentId: string,
  limit: number = 100,
): Promise<Array<{
  logId: string;
  transition: FanOutTransition;
  channel: FanOutChannel;
  recipientIdentifier: string;
  outcome: FanOutOutcome;
  reason: string | null;
  simulated: boolean;
  attemptedAt: string;
}>> {
  if (typeof incidentId !== "string" || incidentId.trim().length === 0) {
    throw new Error("fanout_audit.invalid_incident_id");
  }
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 500);
  const result = await withClient(async (client) => {
    const r = await client.query(
      `SELECT log_id::text, transition, channel, recipient_identifier,
              outcome, reason, simulated, attempted_at
         FROM nex.emergency_fanout_log
        WHERE incident_id = $1
        ORDER BY attempted_at DESC
        LIMIT $2`,
      [incidentId.trim(), safeLimit],
    );
    return r.rows.map((row) => {
      const rec = row as Record<string, unknown>;
      return {
        logId: String(rec.log_id),
        transition: String(rec.transition) as FanOutTransition,
        channel: String(rec.channel) as FanOutChannel,
        recipientIdentifier: String(rec.recipient_identifier),
        outcome: String(rec.outcome) as FanOutOutcome,
        reason: rec.reason === null || rec.reason === undefined
          ? null
          : String(rec.reason),
        simulated: Boolean(rec.simulated),
        attemptedAt:
          rec.attempted_at instanceof Date
            ? (rec.attempted_at as Date).toISOString()
            : new Date(String(rec.attempted_at ?? 0)).toISOString(),
      };
    });
  });
  return result ?? [];
}

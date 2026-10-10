// src/lib/nex-native/emergency/responder-optin-service.ts
//
// NEX Emergency Help · responder opt-in service.
//
// Server-only. Owns writes against `nex.emergency_responder_optin`
// (migration 193).
//
// Doctrine:
//   · NEVER auto-opt-in. The only path that creates a row here is an
//     explicit `optIn()` call from a server action triggered by the
//     settings UI.
//   · The caller must have read the sealed safety guidance within the
//     last 30 days. The timestamp is passed through from the UI;
//     `optIn()` rejects if it's older than 30 days.
//   · v1 PILOT: `simulated = TRUE` is enforced. The DB default is
//     TRUE; the service never writes `simulated = false`.

import "server-only";

import { withClient } from "@/lib/nex/db";
import type { EmergencyResponderOptIn } from "./types";

const SELECT_COLS =
  "account_id, opted_in_at, acknowledged_safety_guidance_at, radius_km, simulated";

const MIN_RADIUS_KM = 1;
const MAX_RADIUS_KM = 25;
const SAFETY_GUIDANCE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return new Date(v).toISOString();
  return new Date(0).toISOString();
}

function mapRow(r: Record<string, unknown>): EmergencyResponderOptIn {
  return {
    accountId: String(r.account_id),
    optedInAt: toIso(r.opted_in_at),
    acknowledgedSafetyGuidanceAt: toIso(r.acknowledged_safety_guidance_at),
    radiusKm: Number(r.radius_km),
    simulated: Boolean(r.simulated),
  };
}

function assertAccountId(accountId: string): void {
  if (typeof accountId !== "string" || accountId.trim().length === 0) {
    throw new Error("responder_optin.invalid_account_id");
  }
}

function assertRadius(radiusKm: number): void {
  if (!Number.isFinite(radiusKm) || !Number.isInteger(radiusKm)
      || radiusKm < MIN_RADIUS_KM || radiusKm > MAX_RADIUS_KM) {
    throw new Error("responder_optin.invalid_radius");
  }
}

function assertRecentSafetyAck(ts: string): void {
  const parsed = Date.parse(ts);
  if (!Number.isFinite(parsed)) {
    throw new Error("responder_optin.invalid_safety_ack");
  }
  if (Date.now() - parsed > SAFETY_GUIDANCE_MAX_AGE_MS) {
    throw new Error("responder_optin.safety_guidance_stale");
  }
  // Clock-skew guard: ack timestamp cannot be more than 1h in the future.
  if (parsed - Date.now() > 60 * 60 * 1000) {
    throw new Error("responder_optin.invalid_safety_ack");
  }
}

export async function getOptIn(accountId: string): Promise<EmergencyResponderOptIn | null> {
  assertAccountId(accountId);
  const result = await withClient(async (client) => {
    const r = await client.query(
      `SELECT ${SELECT_COLS}
         FROM nex.emergency_responder_optin
        WHERE account_id = $1
        LIMIT 1`,
      [accountId.trim()],
    );
    if (r.rowCount !== 1) return null;
    return mapRow(r.rows[0]);
  });
  return result ?? null;
}

export interface OptInArgs {
  readonly accountId: string;
  readonly radiusKm: number;
  readonly acknowledgedSafetyGuidanceAt: string;
}

export async function optIn(args: OptInArgs): Promise<EmergencyResponderOptIn> {
  assertAccountId(args.accountId);
  assertRadius(args.radiusKm);
  assertRecentSafetyAck(args.acknowledgedSafetyGuidanceAt);

  const result = await withClient(async (client) => {
    const r = await client.query(
      `INSERT INTO nex.emergency_responder_optin
         (account_id, acknowledged_safety_guidance_at, radius_km, simulated)
       VALUES ($1, $2::timestamptz, $3, TRUE)
       ON CONFLICT (account_id) DO UPDATE
         SET acknowledged_safety_guidance_at = EXCLUDED.acknowledged_safety_guidance_at,
             radius_km                       = EXCLUDED.radius_km,
             opted_in_at                     = now()
       RETURNING ${SELECT_COLS}`,
      [args.accountId.trim(), args.acknowledgedSafetyGuidanceAt, args.radiusKm],
    );
    if (r.rowCount !== 1) {
      throw new Error("responder_optin.insert_failed");
    }
    return mapRow(r.rows[0]);
  });

  if (result === null) throw new Error("responder_optin.db_unavailable");
  return result;
}

export async function optOut(accountId: string): Promise<void> {
  assertAccountId(accountId);
  const result = await withClient(async (client) => {
    await client.query(
      `DELETE FROM nex.emergency_responder_optin WHERE account_id = $1`,
      [accountId.trim()],
    );
    return true;
  });
  if (result === null) throw new Error("responder_optin.db_unavailable");
}

export async function updateRadius(
  accountId: string,
  radiusKm: number,
): Promise<EmergencyResponderOptIn> {
  assertAccountId(accountId);
  assertRadius(radiusKm);
  const result = await withClient(async (client) => {
    const r = await client.query(
      `UPDATE nex.emergency_responder_optin
          SET radius_km = $2
        WHERE account_id = $1
      RETURNING ${SELECT_COLS}`,
      [accountId.trim(), radiusKm],
    );
    if (r.rowCount !== 1) throw new Error("responder_optin.not_opted_in");
    return mapRow(r.rows[0]);
  });
  if (result === null) throw new Error("responder_optin.db_unavailable");
  return result;
}

export async function countActiveResponders(): Promise<number> {
  const result = await withClient(async (client) => {
    const r = await client.query(
      `SELECT count(*)::int AS n
         FROM nex.emergency_responder_optin
        WHERE simulated = TRUE`,
      [],
    );
    return Number(r.rows[0]?.n ?? 0);
  });
  return result ?? 0;
}

// Exposed for tests + sealed documentation.
export const RESPONDER_OPTIN_RULES = Object.freeze({
  minRadiusKm: MIN_RADIUS_KM,
  maxRadiusKm: MAX_RADIUS_KM,
  safetyAckMaxAgeDays: 30,
});

// src/lib/nex-calling/gate.ts
//
// NEX Calling · Business calling gate helper · Philip 2026-08-27.
//
// Reads nex.business_calling_config to decide whether an inbound call to a
// specific business is allowed right now.
//
// Constitutional rules applied here:
//   · Default DENY · a business with NO config row cannot be called
//   · voice_enabled and video_enabled are independent
//   · Hours evaluated in Asia/Jakarta (or the row's override) · outside hours = deny
//   · blocked_callers filter · caller identity matched exactly
//   · consent_at MUST be set (opt-in required) · unclaimed businesses ignored
//
// Reads only. Never writes. Business opts in via a separate settings surface.

// Accept anything that can query (Pool, PoolClient, or a stub for tests).
export interface QueryableDb {
  query<R = unknown>(sql: string, params?: unknown[]): Promise<{ rowCount: number | null; rows: R[] }>;
}

export type CallGateDecision =
  | { allow: true; mediaType: "voice" | "video"; hours_note?: string }
  | { allow: false; reason: "no_config" | "not_enabled" | "outside_hours" | "caller_blocked" | "no_consent" };

const BUSINESS_TABLES = new Set([
  "nex.food_business",
  "nex.accommodation_business",
  "nex.service_business",
  "nex.mp_seller",
]);

export interface CallGateInput {
  businessTable: string;   // one of BUSINESS_TABLES
  businessRef: string;     // public_listing_ref or slug
  callerIdentity: string;  // caller's NEX identity
  mediaType: "voice" | "video";
}

export interface BusinessCallingConfigRow {
  voice_enabled: boolean;
  video_enabled: boolean;
  hours: Record<string, { open: string; close: string }> | null;
  timezone: string;
  consent_at: Date | null;
  blocked_callers: string[];
}

/** Query the gate for a single decision. */
export async function decideCall(db: QueryableDb, input: CallGateInput): Promise<CallGateDecision> {
  if (!BUSINESS_TABLES.has(input.businessTable)) {
    return { allow: false, reason: "no_config" };
  }
  const r = await db.query<BusinessCallingConfigRow>(
    `SELECT voice_enabled, video_enabled, hours, timezone, consent_at, blocked_callers
       FROM nex.business_calling_config
      WHERE business_table = $1 AND business_ref = $2
      LIMIT 1`,
    [input.businessTable, input.businessRef],
  );
  if (r.rowCount === 0) return { allow: false, reason: "no_config" };
  const cfg = r.rows[0];

  if (!cfg.consent_at) return { allow: false, reason: "no_consent" };

  const enabled = input.mediaType === "voice" ? cfg.voice_enabled : cfg.video_enabled;
  if (!enabled) return { allow: false, reason: "not_enabled" };

  if (cfg.blocked_callers?.includes(input.callerIdentity)) {
    return { allow: false, reason: "caller_blocked" };
  }

  if (cfg.hours && Object.keys(cfg.hours).length > 0) {
    const check = evaluateHours(cfg.hours, cfg.timezone ?? "Asia/Jakarta");
    if (!check.open) return { allow: false, reason: "outside_hours" };
    return { allow: true, mediaType: input.mediaType, hours_note: check.note };
  }
  return { allow: true, mediaType: input.mediaType };
}

/** Evaluate whether the business is currently within its opening hours.
 * Hours JSON: { "mon": { "open": "09:00", "close": "17:00" }, ... }
 */
function evaluateHours(hours: Record<string, { open: string; close: string }>, tz: string): { open: boolean; note?: string } {
  // Compute local time in the given timezone. Uses Intl for portability.
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const weekday = String(parts.find((p) => p.type === "weekday")?.value ?? "").toLowerCase();
  const hh = String(parts.find((p) => p.type === "hour")?.value ?? "00");
  const mm = String(parts.find((p) => p.type === "minute")?.value ?? "00");
  const nowHM = `${hh}:${mm}`;
  const dayRule = hours[weekday];
  if (!dayRule) return { open: false, note: `${weekday} closed` };
  const inRange = nowHM >= dayRule.open && nowHM < dayRule.close;
  return { open: inRange, note: `${weekday} ${dayRule.open}-${dayRule.close}` };
}

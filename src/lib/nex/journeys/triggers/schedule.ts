// Trigger evaluator · schedule
//
// Config: {
//   cron?:               "0 9 * * 1"                   // classic cron (5-field · UTC)
//   at_local_time?:      "09:00"                        // e.g. "09:00" · combined with timezone + days_of_week
//   days_of_week?:       Array<"Sun"|"Mon"|...>         // optional filter
//   day_of_month?:       number                          // 1..28 · fires on that day
//   timezone?:           string                          // IANA tz name · defaults to UTC
//   segment_id:          string                          // WHO enters when the schedule fires
// }
//
// The evaluator answers: "has this trigger's schedule elapsed since
// last_fired_at?" If yes, materialise entries for every eligible contact
// in the target segment.

import { withClient } from "@/lib/nex/delivery/db";
import type { EvalContext, JourneyTriggerEvent } from "./types";

type ScheduleConfig = {
  cron?: string;
  at_local_time?: string;
  days_of_week?: string[];
  day_of_month?: number;
  timezone?: string;
  segment_id?: string;
};

export async function evaluateSchedule(ctx: EvalContext): Promise<JourneyTriggerEvent[]> {
  const cfg = ctx.trigger.trigger_config as ScheduleConfig;
  const segment_id = cfg.segment_id;
  if (!segment_id) return [];

  const due = isDue(ctx.trigger.last_fired_at, ctx.now, cfg);
  if (!due) return [];

  // Load the segment's filter (same read-only path as segment_join)
  const filter = await withClient(async (c) => {
    const res = await c.query(`SELECT filter FROM nex.contact_segments WHERE segment_id = $1 AND archived_at IS NULL`, [segment_id]);
    return res.rows[0] ? (res.rows[0].filter as Record<string, unknown>) : null;
  });
  if (!filter) return [];

  const rows = await withClient(async (c) => {
    const wheres: string[] = ["c.deleted_at IS NULL", "c.canonical_email IS NOT NULL", "c.compliance_state = 'allowed'"];
    const params: unknown[] = [ctx.trigger.journey_id];
    const push = (v: unknown) => { params.push(v); return `$${params.length}`; };
    const countries = filter.countries as string[] | undefined;
    if (Array.isArray(countries) && countries.length > 0) wheres.push(`c.country = ANY(ARRAY[${countries.map((v) => push(v)).join(",")}])`);
    const trades = filter.trades as string[] | undefined;
    if (Array.isArray(trades) && trades.length > 0) wheres.push(`c.trade_categories ?| ARRAY[${trades.map((v) => push(v)).join(",")}]`);
    if (typeof filter.consent_marketing === "boolean") wheres.push(`c.consent_marketing = ${push(filter.consent_marketing)}`);

    const res = await c.query(
      `WITH canonical AS (SELECT DISTINCT ON (contact_id) * FROM nex.contacts ORDER BY contact_id, updated_at DESC)
       SELECT c.contact_id FROM canonical c
       WHERE ${wheres.join(" AND ")}
         AND NOT EXISTS (SELECT 1 FROM nex.journey_states js WHERE js.journey_id = $1 AND js.contact_id = c.contact_id)
       LIMIT 5000`, params,
    );
    return res.rows.map((r0) => String(r0.contact_id));
  });

  const now = ctx.now.toISOString();
  return (rows ?? []).map((contact_id) => ({
    trigger_id: ctx.trigger.trigger_id,
    trigger_type: "schedule" as const,
    journey_id: ctx.trigger.journey_id,
    contact_id,
    event_time: now,
    payload: { schedule: cfg, segment_id },
    correlation_id: `schedule:${ctx.trigger.trigger_id}:${now}`,
    causation_id: `tick:${ctx.tick_id}`,
  }));
}

// ── Schedule matcher ─────────────────────────────────────────────
// MVP: supports cron (5-field · UTC-only) OR at_local_time + timezone.
// Any minute of the tick that falls on or past the next-due instant
// fires. Compares against last_fired_at to avoid re-firing within the
// same minute.
export function isDue(last_fired_at: string | null, now: Date, cfg: ScheduleConfig): boolean {
  const minuteBucketNow = Math.floor(now.getTime() / 60_000);
  if (last_fired_at) {
    const lastBucket = Math.floor(new Date(last_fired_at).getTime() / 60_000);
    if (lastBucket === minuteBucketNow) return false;              // already fired this minute
  }
  if (cfg.cron) {
    return cronMatches(cfg.cron, now);
  }
  if (cfg.at_local_time) {
    return localTimeMatches(cfg, now);
  }
  return false;
}

function cronMatches(expr: string, now: Date): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [minute, hour, dom, month, dow] = parts;
  return matches(minute, now.getUTCMinutes(), 0, 59)
      && matches(hour,   now.getUTCHours(),   0, 23)
      && matches(dom,    now.getUTCDate(),    1, 31)
      && matches(month,  now.getUTCMonth() + 1, 1, 12)
      && matches(dow,    now.getUTCDay(),      0, 6);
}
function matches(spec: string, value: number, min: number, max: number): boolean {
  if (spec === "*") return true;
  for (const tok of spec.split(",")) {
    if (tok === "*") return true;
    if (tok.includes("/")) {
      const [range, stepStr] = tok.split("/");
      const step = Number(stepStr);
      const [lo, hi] = range === "*" ? [min, max] : range.split("-").map(Number);
      const from = Number.isFinite(lo) ? lo : min; const to = Number.isFinite(hi) ? hi : max;
      if (value >= from && value <= to && (value - from) % step === 0) return true;
      continue;
    }
    if (tok.includes("-")) { const [lo, hi] = tok.split("-").map(Number); if (value >= lo && value <= hi) return true; continue; }
    if (Number(tok) === value) return true;
  }
  return false;
}

const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function localTimeMatches(cfg: ScheduleConfig, now: Date): boolean {
  const tz = cfg.timezone ?? "UTC";
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", day: "2-digit", weekday: "short", hour12: false });
  const parts = dtf.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hh = Number(get("hour")); const mm = Number(get("minute"));
  const dow = WEEKDAY[get("weekday") as keyof typeof WEEKDAY] ?? -1;
  const dayOfMonth = Number(get("day"));

  const [tgtH, tgtM] = String(cfg.at_local_time ?? "").split(":").map(Number);
  if (!Number.isFinite(tgtH) || !Number.isFinite(tgtM)) return false;
  if (hh !== tgtH || mm !== tgtM) return false;
  if (Array.isArray(cfg.days_of_week) && cfg.days_of_week.length > 0) {
    const allowed = cfg.days_of_week.map((d) => WEEKDAY[d] ?? -1);
    if (!allowed.includes(dow)) return false;
  }
  if (typeof cfg.day_of_month === "number" && cfg.day_of_month !== dayOfMonth) return false;
  return true;
}

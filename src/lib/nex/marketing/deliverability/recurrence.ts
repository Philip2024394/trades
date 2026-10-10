// src/lib/nex/marketing/deliverability/recurrence.ts
//
// NEX Deliverability · Recurring Campaign Spec + Next-Run Calculator
// Founder-authorised programme · Session-16 · Part 11j · 2026-09-22.
//
// PURE FUNCTIONS. Computes next-run and enumerates occurrences for daily,
// weekly, and monthly recurrence patterns. All UTC.
//
// GOVERNANCE HARD-LOCKS:
//   * Pure functions · zero triggers · zero cron dispatch
//   * Never fires itself · Founder-controlled cron activation (gate #2)
//     is the only path to actual execution
//   * Deterministic · same spec + same `now` always produces same result
//   * Never fabricates an occurrence past ends_at · fail-closed on window

export type RecurrenceFrequency = "daily" | "weekly" | "monthly";

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, matches JS Date.getUTCDay()

export interface RecurrenceSpec {
  readonly frequency: RecurrenceFrequency;
  readonly at_hour: number;                       // 0..23 UTC
  readonly at_minute: number;                     // 0..59 UTC
  readonly starts_at: string;                     // ISO-8601 · earliest allowed occurrence (inclusive)
  readonly ends_at?: string;                      // ISO-8601 · exclusive upper bound (optional)
  /** For weekly · days on which the campaign fires. Ignored for other frequencies. */
  readonly days_of_week?: readonly DayOfWeek[];
  /** For monthly · day of month (1..31 · clamped to actual month length). Ignored for others. */
  readonly day_of_month?: number;
}

export type NextRunOutcome =
  | { kind: "scheduled"; next_run_at: string; reason: string }
  | { kind: "spec_expired"; ends_at: string; reason: string }
  | { kind: "spec_invalid"; reason: string };

// ─── Validation ─────────────────────────────────────────────────────
export function validateRecurrenceSpec(spec: RecurrenceSpec): { ok: true } | { ok: false; reason: string } {
  if (!["daily", "weekly", "monthly"].includes(spec.frequency)) {
    return { ok: false, reason: "frequency_must_be_daily_weekly_or_monthly" };
  }
  if (!Number.isInteger(spec.at_hour) || spec.at_hour < 0 || spec.at_hour > 23) {
    return { ok: false, reason: "at_hour_must_be_integer_0_to_23" };
  }
  if (!Number.isInteger(spec.at_minute) || spec.at_minute < 0 || spec.at_minute > 59) {
    return { ok: false, reason: "at_minute_must_be_integer_0_to_59" };
  }
  if (!Number.isFinite(Date.parse(spec.starts_at))) {
    return { ok: false, reason: "starts_at_must_be_iso_8601" };
  }
  if (spec.ends_at !== undefined && !Number.isFinite(Date.parse(spec.ends_at))) {
    return { ok: false, reason: "ends_at_must_be_iso_8601" };
  }
  if (spec.ends_at !== undefined && Date.parse(spec.ends_at) <= Date.parse(spec.starts_at)) {
    return { ok: false, reason: "ends_at_must_be_after_starts_at" };
  }
  if (spec.frequency === "weekly") {
    if (!spec.days_of_week || spec.days_of_week.length === 0) {
      return { ok: false, reason: "weekly_frequency_requires_days_of_week_non_empty" };
    }
    for (const d of spec.days_of_week) {
      if (!Number.isInteger(d) || d < 0 || d > 6) {
        return { ok: false, reason: `days_of_week_must_be_integers_0_to_6_got_${d}` };
      }
    }
  }
  if (spec.frequency === "monthly") {
    if (spec.day_of_month === undefined || !Number.isInteger(spec.day_of_month) ||
        spec.day_of_month < 1 || spec.day_of_month > 31) {
      return { ok: false, reason: "monthly_frequency_requires_day_of_month_1_to_31" };
    }
  }
  return { ok: true };
}

// ─── Helpers ────────────────────────────────────────────────────────
function daysInMonth(year: number, month: number /* 0-11 */): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function makeUtc(y: number, m: number, d: number, h: number, min: number): number {
  return Date.UTC(y, m, d, h, min, 0, 0);
}

// ─── computeNextRun ─────────────────────────────────────────────────
export function computeNextRun(spec: RecurrenceSpec, now_iso: string): NextRunOutcome {
  const v = validateRecurrenceSpec(spec);
  if (!v.ok) return { kind: "spec_invalid", reason: v.reason };
  const now_ms = Date.parse(now_iso);
  if (!Number.isFinite(now_ms)) return { kind: "spec_invalid", reason: "now_must_be_iso_8601" };

  const starts_ms = Date.parse(spec.starts_at);
  const ends_ms = spec.ends_at ? Date.parse(spec.ends_at) : Number.POSITIVE_INFINITY;

  // Cursor: start from max(now, starts_at)
  let cursor_ms = Math.max(now_ms, starts_ms);
  if (cursor_ms >= ends_ms) {
    return { kind: "spec_expired", ends_at: spec.ends_at ?? "", reason: "cursor_past_ends_at" };
  }

  const d = new Date(cursor_ms);
  let year = d.getUTCFullYear();
  let month = d.getUTCMonth();
  let day = d.getUTCDate();

  const candidate_today_ms = makeUtc(year, month, day, spec.at_hour, spec.at_minute);

  switch (spec.frequency) {
    case "daily": {
      let next_ms = candidate_today_ms >= cursor_ms ? candidate_today_ms : candidate_today_ms + 86_400_000;
      if (next_ms >= ends_ms) {
        return { kind: "spec_expired", ends_at: spec.ends_at ?? "", reason: "next_daily_occurrence_past_ends_at" };
      }
      return { kind: "scheduled", next_run_at: new Date(next_ms).toISOString(), reason: "daily_next_slot" };
    }
    case "weekly": {
      const days_set = new Set(spec.days_of_week!);
      // Try up to 14 days ahead
      for (let i = 0; i < 14; i++) {
        const try_ms = candidate_today_ms + i * 86_400_000;
        if (try_ms < cursor_ms) continue;
        const try_day = new Date(try_ms).getUTCDay() as DayOfWeek;
        if (days_set.has(try_day)) {
          if (try_ms >= ends_ms) {
            return { kind: "spec_expired", ends_at: spec.ends_at ?? "", reason: "next_weekly_occurrence_past_ends_at" };
          }
          return { kind: "scheduled", next_run_at: new Date(try_ms).toISOString(), reason: `weekly_next_slot_day_${try_day}` };
        }
      }
      return { kind: "spec_invalid", reason: "weekly_no_slot_within_14_days_check_days_of_week" };
    }
    case "monthly": {
      const target_day = spec.day_of_month!;
      // Try current month first · clamp to actual month length
      for (let step = 0; step < 12; step++) {
        const y = year;
        const m = month + step;
        const y_actual = y + Math.floor(m / 12);
        const m_actual = ((m % 12) + 12) % 12;
        const dim = daysInMonth(y_actual, m_actual);
        const day_clamped = Math.min(target_day, dim);
        const try_ms = makeUtc(y_actual, m_actual, day_clamped, spec.at_hour, spec.at_minute);
        if (try_ms >= cursor_ms) {
          if (try_ms >= ends_ms) {
            return { kind: "spec_expired", ends_at: spec.ends_at ?? "", reason: "next_monthly_occurrence_past_ends_at" };
          }
          return { kind: "scheduled", next_run_at: new Date(try_ms).toISOString(), reason: `monthly_next_slot_day_${day_clamped}` };
        }
      }
      return { kind: "spec_invalid", reason: "monthly_no_slot_within_12_months" };
    }
  }
}

// ─── enumerateOccurrences ──────────────────────────────────────────
export interface EnumerateOptions {
  readonly from_iso: string;
  readonly to_iso: string;
  readonly max: number;
}

export type EnumerateOutcome =
  | { kind: "occurrences"; occurrences: readonly string[]; truncated_at_max: boolean }
  | { kind: "spec_invalid"; reason: string }
  | { kind: "window_invalid"; reason: string };

/** Enumerate all occurrences of the spec within [from, to). Bounded by `max`
 *  to prevent unbounded lists. */
export function enumerateOccurrences(spec: RecurrenceSpec, opts: EnumerateOptions): EnumerateOutcome {
  const v = validateRecurrenceSpec(spec);
  if (!v.ok) return { kind: "spec_invalid", reason: v.reason };
  if (!Number.isFinite(Date.parse(opts.from_iso)) || !Number.isFinite(Date.parse(opts.to_iso))) {
    return { kind: "window_invalid", reason: "from_and_to_must_be_iso_8601" };
  }
  if (Date.parse(opts.to_iso) <= Date.parse(opts.from_iso)) {
    return { kind: "window_invalid", reason: "to_must_be_after_from" };
  }
  if (!Number.isInteger(opts.max) || opts.max < 1 || opts.max > 10_000) {
    return { kind: "window_invalid", reason: "max_must_be_integer_1_to_10000" };
  }

  const to_ms = Date.parse(opts.to_iso);
  const occurrences: string[] = [];
  let cursor_iso = opts.from_iso;

  for (let step = 0; step < opts.max + 1; step++) {
    const r = computeNextRun(spec, cursor_iso);
    if (r.kind !== "scheduled") break;
    const next_ms = Date.parse(r.next_run_at);
    if (next_ms >= to_ms) break;
    if (occurrences.length >= opts.max) {
      return { kind: "occurrences", occurrences, truncated_at_max: true };
    }
    occurrences.push(r.next_run_at);
    // Advance cursor to 1ms after this occurrence · next call finds the following slot
    cursor_iso = new Date(next_ms + 1).toISOString();
  }

  return { kind: "occurrences", occurrences, truncated_at_max: false };
}

// ─── Structural boundary markers ───────────────────────────────────
export const _RECURRENCE_NEVER_TRIGGERS = "pure_calculator_never_fires_cron_never_dispatches";
export const _RECURRENCE_NEVER_PERSISTS = "no_DB_writes_no_side_effects";
export const _RECURRENCE_DETERMINISTIC = "same_spec_and_now_always_produces_same_next_run";
export const _RECURRENCE_RESPECTS_ENDS_AT = "occurrences_past_ends_at_return_spec_expired_never_fabricated";

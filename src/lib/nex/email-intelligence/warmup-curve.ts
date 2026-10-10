// src/lib/nex/email-intelligence/warmup-curve.ts
//
// Sender warm-up curve · pure computational · zero I/O · zero external deps.
// Founder-authorised 2026-09-22.
//
// Purpose: gradually ramp send volume from a small daily cap up to the target,
// so a fresh sender domain builds reputation before hitting Gmail/Yahoo's
// bulk-sender radar (>5,000/day to Gmail = strict SPF/DKIM/DMARC + <0.3%
// complaint rate).
//
// Standard warm-up recipes (used by SendGrid, Postmark, Mailgun, SES docs):
//   Day 1-2:      50/day       (very small · sanity check)
//   Day 3-7:     100-300/day
//   Day 8-14:    500-2,000/day
//   Day 15-21:   3,000-10,000/day
//   Day 22-30:   15,000-40,000/day
//   Day 31+:     target (e.g. 100,000/day)
//
// Compounding rule: each day's cap is min(prev * multiplier, target).
// Bounce/complaint circuit-breaker: if any day's bounce_rate > threshold,
// HOLD the cap (don't increase) until bounce_rate returns below threshold.

export interface WarmupInput {
  readonly target_daily_volume: number;         // final target · e.g. 10000
  readonly start_daily_volume?: number;         // first day cap · default 50
  readonly ramp_multiplier?: number;            // daily multiplier · default 1.5
  readonly max_days?: number;                   // cap the curve length · default 60
  readonly max_bounce_rate?: number;            // 0-1 · default 0.03 (3% Gmail hard-cap)
  readonly max_complaint_rate?: number;         // 0-1 · default 0.003 (0.3% Gmail)
}

export interface WarmupDay {
  readonly day: number;                          // 1-based
  readonly daily_cap: number;
  readonly hourly_cap: number;                   // daily_cap / 16h approximation
  readonly per_domain_hourly_cap: number;        // Gmail-per-domain ceiling
  readonly cumulative_sent: number;
  readonly notes: string[];
}

export interface WarmupSchedule {
  readonly target_daily_volume: number;
  readonly total_days_to_target: number;
  readonly cumulative_at_target: number;
  readonly days: ReadonlyArray<WarmupDay>;
}

/** Generate the ideal warm-up schedule assuming no reputation issues. */
export function generateWarmupSchedule(input: WarmupInput): WarmupSchedule {
  const target = Math.max(1, Math.floor(input.target_daily_volume));
  const start = Math.max(1, Math.floor(input.start_daily_volume ?? 50));
  const mult = Math.max(1.05, input.ramp_multiplier ?? 1.5);
  const maxDays = Math.max(1, Math.min(365, input.max_days ?? 60));

  const days: WarmupDay[] = [];
  let currentCap = start;
  let cumulative = 0;
  let day = 1;
  let daysAtTarget = 0;

  while (day <= maxDays) {
    const cap = Math.min(currentCap, target);
    cumulative += cap;
    const notes: string[] = [];
    if (cap === target) notes.push("target_reached");
    if (day <= 2 && cap > 50) notes.push("first_days_conservative");
    // Gmail-specific: cap per-domain to 500/hour to any single recipient domain
    const hourly = Math.ceil(cap / 16);   // 16 sending hours/day approximation
    const perDomainHourly = Math.min(500, hourly);
    days.push({ day, daily_cap: cap, hourly_cap: hourly, per_domain_hourly_cap: perDomainHourly, cumulative_sent: cumulative, notes });
    if (cap === target) daysAtTarget++;
    if (daysAtTarget >= 3) break;         // 3 consecutive days at target = warmed
    currentCap = Math.floor(currentCap * mult);
    day++;
  }

  return {
    target_daily_volume: target,
    total_days_to_target: days.findIndex((d) => d.daily_cap === target) + 1,
    cumulative_at_target: days.find((d) => d.daily_cap === target)?.cumulative_sent ?? 0,
    days,
  };
}

/** Apply reputation feedback to the schedule · returns adjusted next-day cap. */
export interface ReputationFeedback {
  readonly day: number;
  readonly sent: number;
  readonly bounced: number;
  readonly complained: number;
  readonly max_bounce_rate: number;         // e.g. 0.03
  readonly max_complaint_rate: number;      // e.g. 0.003
  readonly current_daily_cap: number;
  readonly next_daily_cap_if_ok: number;
}

export interface ReputationAdjustment {
  readonly action: "advance" | "hold" | "cut" | "pause";
  readonly new_daily_cap: number;
  readonly bounce_rate: number;
  readonly complaint_rate: number;
  readonly reason: string;
}

export function adjustCapForReputation(f: ReputationFeedback): ReputationAdjustment {
  const bounce_rate = f.sent > 0 ? f.bounced / f.sent : 0;
  const complaint_rate = f.sent > 0 ? f.complained / f.sent : 0;
  if (complaint_rate >= f.max_complaint_rate * 2) {
    return { action: "pause", new_daily_cap: 0, bounce_rate, complaint_rate,
             reason: `complaint_rate ${(complaint_rate*100).toFixed(2)}% >= 2x limit ${(f.max_complaint_rate*100).toFixed(2)}%` };
  }
  if (bounce_rate >= f.max_bounce_rate * 2) {
    return { action: "cut", new_daily_cap: Math.max(1, Math.floor(f.current_daily_cap / 2)), bounce_rate, complaint_rate,
             reason: `bounce_rate ${(bounce_rate*100).toFixed(2)}% >= 2x limit ${(f.max_bounce_rate*100).toFixed(2)}%` };
  }
  if (bounce_rate >= f.max_bounce_rate || complaint_rate >= f.max_complaint_rate) {
    return { action: "hold", new_daily_cap: f.current_daily_cap, bounce_rate, complaint_rate,
             reason: `bounce ${(bounce_rate*100).toFixed(2)}% or complaint ${(complaint_rate*100).toFixed(2)}% at threshold · hold` };
  }
  return { action: "advance", new_daily_cap: f.next_daily_cap_if_ok, bounce_rate, complaint_rate,
           reason: "reputation_within_bounds" };
}

// Doctrine locks
export const _WARMUP_NEVER_EXCEEDS_TARGET = "cap_never_greater_than_target_daily_volume";
export const _WARMUP_HONORS_REPUTATION_CIRCUIT_BREAKER = "bounce_or_complaint_over_threshold_holds_or_cuts";
export const _WARMUP_RAMP_IS_MONOTONIC_UNTIL_FEEDBACK = "cap_never_shrinks_without_reputation_signal";

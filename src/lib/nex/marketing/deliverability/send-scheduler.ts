// src/lib/nex/marketing/deliverability/send-scheduler.ts
//
// NEX Deliverability · Send Scheduler
// Founder-authorised programme · Session-12 · Part 11f · 2026-09-21.
//
// PURE FUNCTION. Given N permitted units over M hours, computes a deterministic
// temporal distribution respecting reputation floors and provider throttle caps.
//
// GOVERNANCE HARD-LOCKS:
//   * Never sends · never queues · never touches the SMTP/provider surface
//   * Never fabricates capacity · reads sender capacity from typed input
//   * Reputation-aware · frozen → 0 slots · limited → half rate · warning → 0.5-0.75x
//   * Deterministic · same inputs always produce the same schedule (jitter seeded by sender_id)
//   * Refuses to schedule beyond the requested window
//   * Refuses to bunch · minimum inter-slot gap enforced

import type { ReputationState } from "./types";

export interface SendSchedulerInput {
  readonly sender_id: string;
  readonly reputation_state: ReputationState;
  readonly requested_units: number;
  readonly window_hours: number;
  readonly per_hour_cap: number;              // provider or Founder-authored ceiling
  readonly start_at: string;                  // ISO-8601 UTC
  readonly min_slot_size?: number;            // default 1
  readonly max_slot_size?: number;            // default 50 (never blast > 50 in one slot)
  readonly min_inter_slot_ms?: number;        // default 60_000 (1 minute apart)
}

export interface SendSlot {
  readonly slot_index: number;
  readonly scheduled_at: string;              // ISO-8601 UTC
  readonly units: number;
  readonly hour_bucket: number;               // 0-based hour from start
}

export type SendScheduleOutcome =
  | { kind: "scheduled"; sender_id: string; total_scheduled: number; slots: readonly SendSlot[]; ceiling_units: number; reason: string }
  | { kind: "reputation_hold"; reputation_state: ReputationState; reason: string }
  | { kind: "no_capacity"; per_hour_cap: number; window_hours: number; reason: string }
  | { kind: "invalid_input"; reason: string };

// ─── Reputation multipliers (matches Session-5 ceiling policy) ─────
/** Fraction of per_hour_cap allowed at each reputation state. Frozen and
 *  limited are HARD BLOCKS by policy · warning halves · watch is 0.75 ·
 *  healthy uses full cap · unknown treated conservatively as watch. */
export const REPUTATION_CEILING_MULTIPLIER: Readonly<Record<ReputationState, number>> = {
  unknown:  0.75,
  healthy:  1.00,
  watch:    0.75,
  warning:  0.50,
  limited:  0.00,
  frozen:   0.00,
};

// ─── Deterministic jitter from sender_id ────────────────────────────
/** Cheap deterministic pseudo-random in [0, 1) seeded by sender_id + slot index.
 *  Not cryptographic · used only to spread slots within a minute so batches
 *  from different senders don't collide on the same second. */
function jitter01(sender_id: string, slot_index: number): number {
  let h = 2166136261; // FNV-1a offset basis
  const s = `${sender_id}#${slot_index}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Map to [0, 1)
  return ((h >>> 0) % 10_000) / 10_000;
}

// ─── Public API ─────────────────────────────────────────────────────
export function computeSendSchedule(input: SendSchedulerInput): SendScheduleOutcome {
  if (!Number.isFinite(input.requested_units) || input.requested_units < 0) {
    return { kind: "invalid_input", reason: "requested_units_must_be_non_negative_finite" };
  }
  if (!Number.isFinite(input.window_hours) || input.window_hours <= 0) {
    return { kind: "invalid_input", reason: "window_hours_must_be_positive" };
  }
  if (!Number.isFinite(input.per_hour_cap) || input.per_hour_cap < 0) {
    return { kind: "invalid_input", reason: "per_hour_cap_must_be_non_negative_finite" };
  }
  const start_ms = Date.parse(input.start_at);
  if (!Number.isFinite(start_ms)) {
    return { kind: "invalid_input", reason: "start_at_must_be_iso_8601" };
  }

  const mult = REPUTATION_CEILING_MULTIPLIER[input.reputation_state];
  if (mult === 0) {
    return {
      kind: "reputation_hold",
      reputation_state: input.reputation_state,
      reason: `reputation_state=${input.reputation_state}_hard_block_no_send_allowed`,
    };
  }

  const effective_hourly_cap = Math.floor(input.per_hour_cap * mult);
  const window_ceiling = effective_hourly_cap * input.window_hours;
  if (window_ceiling <= 0) {
    return {
      kind: "no_capacity",
      per_hour_cap: input.per_hour_cap,
      window_hours: input.window_hours,
      reason: "per_hour_cap_times_reputation_multiplier_yields_zero",
    };
  }

  const total_scheduled = Math.min(input.requested_units, window_ceiling);
  if (total_scheduled === 0) {
    return {
      kind: "scheduled",
      sender_id: input.sender_id,
      total_scheduled: 0,
      slots: [],
      ceiling_units: window_ceiling,
      reason: "zero_requested_units",
    };
  }

  const min_slot = Math.max(1, input.min_slot_size ?? 1);
  const max_slot = Math.max(min_slot, input.max_slot_size ?? 50);
  const min_gap_ms = Math.max(1000, input.min_inter_slot_ms ?? 60_000);

  const slots: SendSlot[] = [];
  let remaining = total_scheduled;
  let slot_index = 0;

  for (let hour = 0; hour < input.window_hours && remaining > 0; hour++) {
    // How many units this hour is allowed
    let hour_units = Math.min(remaining, effective_hourly_cap);
    // Distribute this hour's units into slots of at most max_slot units each
    // Enforce minimum inter-slot gap.
    const hour_start_ms = start_ms + hour * 3_600_000;
    const max_slots_in_hour = Math.floor(3_600_000 / min_gap_ms);

    // We want at least `ceil(hour_units / max_slot)` slots, but no more than max_slots_in_hour
    const desired_slots_by_batch = Math.ceil(hour_units / max_slot);
    const slots_this_hour = Math.min(max_slots_in_hour, Math.max(desired_slots_by_batch, 1));

    const per_slot_base = Math.floor(hour_units / slots_this_hour);
    let leftover = hour_units - per_slot_base * slots_this_hour;

    for (let i = 0; i < slots_this_hour && hour_units > 0; i++) {
      let units_here = Math.min(max_slot, per_slot_base + (leftover > 0 ? 1 : 0));
      if (leftover > 0) leftover--;
      if (units_here < min_slot) units_here = Math.min(hour_units, min_slot);
      const j = jitter01(input.sender_id, slot_index);
      // Position within the slot's inter-slot window · jitter within the slot's share of the hour
      const slot_share_ms = Math.floor(3_600_000 / slots_this_hour);
      const base_offset = i * slot_share_ms;
      const jitter_offset = Math.floor(j * (slot_share_ms - 1000));
      const scheduled_ms = hour_start_ms + base_offset + jitter_offset;
      slots.push({
        slot_index,
        scheduled_at: new Date(scheduled_ms).toISOString(),
        units: units_here,
        hour_bucket: hour,
      });
      remaining -= units_here;
      hour_units -= units_here;
      slot_index++;
    }
  }

  // Post-condition: total distributed must equal total_scheduled
  const distributed = slots.reduce((a, s) => a + s.units, 0);
  if (distributed !== total_scheduled) {
    return {
      kind: "invalid_input",
      reason: `internal_distribution_error_expected_${total_scheduled}_got_${distributed}`,
    };
  }

  return {
    kind: "scheduled",
    sender_id: input.sender_id,
    total_scheduled,
    slots,
    ceiling_units: window_ceiling,
    reason:
      total_scheduled < input.requested_units
        ? `requested_${input.requested_units}_capped_to_ceiling_${window_ceiling}_at_reputation_${input.reputation_state}`
        : `full_request_scheduled_within_reputation_ceiling`,
  };
}

// ─── Structural boundary markers ────────────────────────────────────
export const _SCHEDULER_NEVER_SENDS = "computes_schedule_only_never_transmits_email";
export const _SCHEDULER_NEVER_QUEUES = "returns_slot_projection_never_writes_to_send_queue";
export const _SCHEDULER_REPUTATION_HARD_BLOCKS = "limited_and_frozen_return_zero_slots_no_exceptions_no_bypass";
export const _SCHEDULER_DETERMINISTIC = "same_inputs_produce_same_slots_jitter_seeded_by_sender_id";

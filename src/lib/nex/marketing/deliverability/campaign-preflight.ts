// src/lib/nex/marketing/deliverability/campaign-preflight.ts
//
// NEX Deliverability · Campaign Preflight Composer
// Founder-authorised programme · Session-15 · Part 11i · 2026-09-22.
//
// PURE COMPOSITION. Chains the three sending-safety calculators into one
// integrated projection:
//
//   1. computeSuppressionProjection  (Session-14 · who will actually go)
//   2. assignVariantsBatch           (Session-13 · how they split)
//   3. computeSendSchedule           (Session-12 · how they're spaced)
//
// GOVERNANCE HARD-LOCKS:
//   * Pure function · zero side effects · zero persistence
//   * Never triggers a send · never queues a slot · never activates a gate
//   * Reputation short-circuits (limited/frozen) return `reputation_hold`
//     BEFORE any assignment or scheduling · fail fast
//   * All-suppressed audience returns zero-slot projection · no scheduling
//   * Composition never fabricates data · every field traces to a sub-calculator

import {
  computeSuppressionProjection,
  type SuppressionInputRow, type SuppressionProjection,
} from "./suppression-preflight";
import {
  assignVariantsBatch,
  type VariantDefinition, type VariantAssignment,
} from "./ab-testing";
import {
  computeSendSchedule,
  type SendScheduleOutcome, type SendSlot,
} from "./send-scheduler";
import type { ReputationState } from "./types";

export interface CampaignPreflightInput {
  readonly campaign_id: string;
  readonly audience_rows: readonly SuppressionInputRow[];
  readonly variants: readonly VariantDefinition[];
  readonly sender_id: string;
  readonly sender_reputation_state: ReputationState;
  readonly per_hour_cap: number;
  readonly window_hours: number;
  readonly start_at: string;
  readonly max_slot_size?: number;
  readonly min_inter_slot_ms?: number;
}

export interface PerVariantProjection {
  readonly variant_id: string;
  readonly weight: number;
  readonly assigned_count: number;
  readonly assigned_contact_ids: readonly string[]; // opaque · never emails
  readonly schedule: SendScheduleOutcome;
  readonly total_scheduled: number;
  readonly slots_count: number;
}

export type CampaignPreflightOutcome =
  | {
      kind: "projected";
      campaign_id: string;
      sender_id: string;
      suppression: SuppressionProjection;
      per_variant: readonly PerVariantProjection[];
      overall_scheduled: number;
      overall_slots: number;
      note: string;
    }
  | {
      kind: "reputation_hold";
      campaign_id: string;
      sender_id: string;
      reputation_state: ReputationState;
      suppression: SuppressionProjection;
      note: string;
    }
  | {
      kind: "empty_audience";
      campaign_id: string;
      suppression: SuppressionProjection;
      note: string;
    }
  | {
      kind: "all_suppressed";
      campaign_id: string;
      suppression: SuppressionProjection;
      note: string;
    }
  | {
      kind: "invalid_input";
      campaign_id: string;
      reason: string;
    };

// ─── Public composer ────────────────────────────────────────────────
export function composeCampaignPreflight(input: CampaignPreflightInput): CampaignPreflightOutcome {
  if (!input.campaign_id) {
    return { kind: "invalid_input", campaign_id: "", reason: "campaign_id_required" };
  }
  if (input.variants.length === 0) {
    return { kind: "invalid_input", campaign_id: input.campaign_id, reason: "variants_required_min_1" };
  }
  const suppression = computeSuppressionProjection(input.audience_rows);

  if (suppression.total_proposed === 0) {
    return {
      kind: "empty_audience",
      campaign_id: input.campaign_id,
      suppression,
      note: "audience_filter_matched_no_contacts",
    };
  }

  // Reputation hard-blocks (frozen/limited) short-circuit BEFORE assignment
  if (input.sender_reputation_state === "frozen" || input.sender_reputation_state === "limited") {
    return {
      kind: "reputation_hold",
      campaign_id: input.campaign_id,
      sender_id: input.sender_id,
      reputation_state: input.sender_reputation_state,
      suppression,
      note: `sender_reputation_${input.sender_reputation_state}_hard_block_no_send`,
    };
  }

  if (suppression.sendable === 0) {
    return {
      kind: "all_suppressed",
      campaign_id: input.campaign_id,
      suppression,
      note: "all_proposed_contacts_suppressed_no_variant_assignment_needed",
    };
  }

  // Sendable contact_ids only · never emails
  const sendable_ids = input.audience_rows
    .filter(r => {
      if (!r.has_valid_email) return false;
      if (r.hard_bounced) return false;
      if (r.opt_out) return false;
      if (r.complaint_count > 0) return false;
      if (r.sender_reputation_state === "frozen") return false;
      if (r.sender_reputation_state === "limited") return false;
      if (r.domain_dmarc_reject_unaligned) return false;
      return true;
    })
    .map(r => r.contact_id);

  // A/B assign the sendable audience
  const assignments: readonly VariantAssignment[] = assignVariantsBatch(
    input.campaign_id,
    sendable_ids,
    input.variants,
  );

  // Bucket by variant
  const by_variant: Record<string, string[]> = {};
  for (const v of input.variants) by_variant[v.variant_id] = [];
  for (const a of assignments) by_variant[a.variant_id]!.push(a.contact_id);

  // Schedule each variant separately · per-variant hourly cap is proportional to weight
  const total_weight = input.variants.reduce((a, v) => a + Math.max(1, Math.floor(v.weight)), 0);
  const per_variant: PerVariantProjection[] = [];
  let overall_scheduled = 0;
  let overall_slots = 0;

  for (const v of input.variants) {
    const contact_ids = by_variant[v.variant_id]!;
    const assigned_count = contact_ids.length;
    const w = Math.max(1, Math.floor(v.weight));
    const variant_per_hour_cap = Math.floor(input.per_hour_cap * (w / total_weight));

    const schedule = computeSendSchedule({
      sender_id: `${input.sender_id}::${v.variant_id}`,
      reputation_state: input.sender_reputation_state,
      requested_units: assigned_count,
      window_hours: input.window_hours,
      per_hour_cap: variant_per_hour_cap,
      start_at: input.start_at,
      max_slot_size: input.max_slot_size,
      min_inter_slot_ms: input.min_inter_slot_ms,
    });

    let total_scheduled = 0;
    let slots_count = 0;
    if (schedule.kind === "scheduled") {
      total_scheduled = schedule.total_scheduled;
      slots_count = schedule.slots.length;
    }

    per_variant.push({
      variant_id: v.variant_id,
      weight: w,
      assigned_count,
      assigned_contact_ids: contact_ids,
      schedule,
      total_scheduled,
      slots_count,
    });
    overall_scheduled += total_scheduled;
    overall_slots += slots_count;
  }

  return {
    kind: "projected",
    campaign_id: input.campaign_id,
    sender_id: input.sender_id,
    suppression,
    per_variant,
    overall_scheduled,
    overall_slots,
    note: `${overall_scheduled} of ${suppression.sendable} sendable contacts projected across ${input.variants.length} variants and ${overall_slots} slots over ${input.window_hours}h window`,
  };
}

// ─── Structural boundary markers ───────────────────────────────────
export const _COMPOSER_NEVER_SENDS = "pure_composition_of_pure_calculators_never_transmits";
export const _COMPOSER_NEVER_PERSISTS = "no_DB_writes_no_side_effects";
export const _COMPOSER_FAIL_FAST_ON_REPUTATION_HOLD =
  "limited_and_frozen_short_circuit_before_variant_assignment_and_scheduling";
export const _COMPOSER_NO_EMAIL_ADDRESSES_IN_OUTPUT =
  "assigned_contact_ids_are_opaque_contact_ids_never_email_addresses";

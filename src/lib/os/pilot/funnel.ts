// Pilot funnel recorder.
//
// Every stage in the runbook fires one funnel event. Idempotent per
// (participant, stage) so double-clicks / retries never inflate the
// numbers.
//
// Not on the shared Event Bus — funnel events are pilot-scoped
// observability, not business events. When the pilot closes, the
// entire instrumentation namespace deletes with zero impact on the
// business apps.
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type PilotStage =
  // Merchant setup
  | "merchant.onboarding_started"
  | "merchant.trade_confirmed"
  | "merchant.products_seeded"
  | "merchant.brand_generated"
  | "merchant.scope_bound"
  | "merchant.tile_published"
  | "merchant.onboarding_completed"
  | "merchant.onboarding_abandoned"
  // Homeowner journey
  | "homeowner.tile_opened"
  | "homeowner.contact_started"
  | "homeowner.contact_completed"
  | "homeowner.property_claimed"
  | "homeowner.address_confirmed"
  | "homeowner.photo_uploaded"
  | "homeowner.render_completed"
  | "homeowner.quote_received"
  | "homeowner.quote_viewed"
  | "homeowner.quote_accepted"
  | "homeowner.review_posted"
  | "homeowner.abandoned"
  // Merchant delivery
  | "merchant.quote_drafted"
  | "merchant.quote_sent"
  | "merchant.job_opened"
  | "merchant.job_first_checkin"
  | "merchant.job_signed_off"
  | "merchant.review_response";

export type RecordFunnelEventInput = {
  cohort: string;
  stage: PilotStage;
  participantId?: string | null;
  merchantId?: string | null;
  homeownerPartyId?: string | null;
  propertyId?: string | null;
  projectId?: string | null;
  actorKind?: "merchant" | "homeowner" | "system";
  meta?: Record<string, unknown>;
};

/** Idempotent by (participantId, stage). Errors are logged, not thrown
 *  — instrumentation must never break the user journey. */
export async function recordFunnelEvent(
  input: RecordFunnelEventInput
): Promise<void> {
  try {
    await supabaseAdmin.from("os_pilot_funnel_events").insert({
      participant_id: input.participantId ?? null,
      cohort: input.cohort,
      stage: input.stage,
      merchant_id: input.merchantId ?? null,
      homeowner_party_id: input.homeownerPartyId ?? null,
      property_id: input.propertyId ?? null,
      project_id: input.projectId ?? null,
      actor_kind: input.actorKind ?? "system",
      meta: input.meta ?? {}
    });
  } catch (err) {
    // Unique index will error on duplicate stage per participant —
    // that's the desired behaviour, not a real failure.
    const code = (err as { code?: string }).code;
    if (code === "23505") return;
    console.error("[pilot.funnel] recordFunnelEvent failed", err);
  }
}

// -------------------------------------------------------------------
// Participant helpers
// -------------------------------------------------------------------

export async function findOrCreateParticipant(input: {
  cohort: string;
  merchantId: string;
  homeownerPartyId?: string | null;
  propertyId?: string | null;
  merchantDisplayName?: string | null;
  homeownerDisplayName?: string | null;
}): Promise<string> {
  if (input.homeownerPartyId) {
    const { data: existing } = await supabaseAdmin
      .from("os_pilot_participants")
      .select("id")
      .eq("cohort", input.cohort)
      .eq("merchant_id", input.merchantId)
      .eq("homeowner_party_id", input.homeownerPartyId)
      .maybeSingle();
    if (existing) return existing.id as string;
  }
  const friendly =
    input.merchantDisplayName && input.homeownerDisplayName
      ? `${input.merchantDisplayName} × ${input.homeownerDisplayName}`
      : input.merchantDisplayName || "Pilot participant";
  const { data: created, error } = await supabaseAdmin
    .from("os_pilot_participants")
    .insert({
      cohort: input.cohort,
      merchant_id: input.merchantId,
      homeowner_party_id: input.homeownerPartyId ?? null,
      property_id: input.propertyId ?? null,
      merchant_display_name: input.merchantDisplayName ?? null,
      homeowner_display_name: input.homeownerDisplayName ?? null,
      friendly_label: friendly
    })
    .select("id")
    .single();
  if (error || !created) {
    throw new Error(`Failed to create participant: ${error?.message}`);
  }
  return created.id as string;
}

export type FunnelSummary = {
  cohort: string;
  countsByStage: Record<PilotStage, number>;
  medianTimes: Partial<Record<`${PilotStage}->${PilotStage}`, number>>;
};

export async function loadFunnelSummary(cohort: string): Promise<FunnelSummary> {
  const { data: events } = await supabaseAdmin
    .from("os_pilot_funnel_events")
    .select("stage, participant_id, occurred_at")
    .eq("cohort", cohort)
    .order("occurred_at", { ascending: true });

  const counts: Record<string, number> = {};
  const perParticipant = new Map<string, Map<string, string>>();
  (events || []).forEach((e) => {
    counts[e.stage as string] = (counts[e.stage as string] || 0) + 1;
    if (e.participant_id) {
      const pid = e.participant_id as string;
      const timeline = perParticipant.get(pid) || new Map();
      if (!timeline.has(e.stage as string)) {
        timeline.set(e.stage as string, e.occurred_at as string);
        perParticipant.set(pid, timeline);
      }
    }
  });

  // Compute a handful of key transitions
  const KEY_TRANSITIONS: Array<[PilotStage, PilotStage]> = [
    ["homeowner.tile_opened", "homeowner.contact_completed"],
    ["homeowner.contact_completed", "homeowner.render_completed"],
    ["homeowner.render_completed", "merchant.quote_sent"],
    ["merchant.quote_sent", "homeowner.quote_accepted"],
    ["homeowner.quote_accepted", "merchant.job_signed_off"],
    ["merchant.job_signed_off", "homeowner.review_posted"]
  ];
  const medianTimes: Partial<Record<string, number>> = {};
  for (const [from, to] of KEY_TRANSITIONS) {
    const deltas: number[] = [];
    for (const timeline of perParticipant.values()) {
      const a = timeline.get(from);
      const b = timeline.get(to);
      if (!a || !b) continue;
      deltas.push(new Date(b).getTime() - new Date(a).getTime());
    }
    if (deltas.length > 0) {
      deltas.sort((x, y) => x - y);
      medianTimes[`${from}->${to}`] = deltas[Math.floor(deltas.length / 2)];
    }
  }

  return {
    cohort,
    countsByStage: counts as Record<PilotStage, number>,
    medianTimes: medianTimes as FunnelSummary["medianTimes"]
  };
}

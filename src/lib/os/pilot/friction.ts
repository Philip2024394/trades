// Friction report submission + read.
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type FrictionSeverity = "stuck" | "confusion" | "minor" | "positive";
export type FrictionActor = "merchant" | "homeowner" | "trade" | "admin";

export type SubmitFrictionInput = {
  cohort: string;
  screenId: string;
  severity: FrictionSeverity;
  actorKind: FrictionActor;
  body: string;
  context?: Record<string, unknown>;
  participantId?: string | null;
  merchantId?: string | null;
  homeownerPartyId?: string | null;
};

export async function submitFrictionReport(
  input: SubmitFrictionInput
): Promise<{ id: string } | null> {
  const { data, error } = await supabaseAdmin
    .from("os_friction_reports")
    .insert({
      cohort: input.cohort,
      screen_id: input.screenId,
      severity: input.severity,
      actor_kind: input.actorKind,
      body: input.body.trim().slice(0, 4000),
      context: input.context ?? {},
      participant_id: input.participantId ?? null,
      merchant_id: input.merchantId ?? null,
      homeowner_party_id: input.homeownerPartyId ?? null
    })
    .select("id")
    .single();
  if (error) {
    console.error("[pilot.friction] insert failed", error);
    return null;
  }
  return data ? { id: data.id as string } : null;
}

export type FrictionListItem = {
  id: string;
  cohort: string;
  screenId: string;
  severity: FrictionSeverity;
  actorKind: FrictionActor;
  body: string;
  context: Record<string, unknown>;
  merchantId: string | null;
  homeownerPartyId: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export async function listFrictionReports(input: {
  cohort?: string;
  unresolvedOnly?: boolean;
  limit?: number;
}): Promise<FrictionListItem[]> {
  let q = supabaseAdmin
    .from("os_friction_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 100);
  if (input.cohort) q = q.eq("cohort", input.cohort);
  if (input.unresolvedOnly) q = q.is("resolved_at", null);
  const { data } = await q;
  return (data || []).map((r) => ({
    id: r.id,
    cohort: r.cohort,
    screenId: r.screen_id,
    severity: r.severity,
    actorKind: r.actor_kind,
    body: r.body,
    context: r.context || {},
    merchantId: r.merchant_id,
    homeownerPartyId: r.homeowner_party_id,
    resolvedAt: r.resolved_at,
    createdAt: r.created_at
  }));
}

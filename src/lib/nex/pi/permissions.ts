// Permission gate — enforced before ANY adapter runs.
//
// A homeowner may only ask about projects they own. A merchant may
// only ask about projects they've been invited to as a member. This
// module is the single source of truth for both checks so a mistake
// in one adapter can't leak data across.
//
// Blueprint rule (SITEBOOK_BLUEPRINT_v2_2_FINAL.md): homeowner owns
// their view; merchant never sees homeowner documents. We enforce
// that by refusing to build a snapshot for a merchant on a project
// they don't belong to, AND by stripping visible_to='homeowner'
// fields from any snapshot returned to a merchant.

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type AccessDecision =
  | { ok: true }
  | { ok: false; reason: "not_owner" | "not_member" | "project_missing" };

export async function assertHomeownerAccess(projectId: string, homeownerId: string): Promise<AccessDecision> {
  const res = await supabaseAdmin
    .from("hammerex_sitebook_projects")
    .select("id")
    .eq("id", projectId)
    .eq("homeowner_id", homeownerId)
    .maybeSingle();
  if (!res.data) return { ok: false, reason: "not_owner" };
  return { ok: true };
}

export async function assertMerchantAccess(projectId: string, listingId: string): Promise<AccessDecision> {
  const proj = await supabaseAdmin
    .from("hammerex_sitebook_projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  if (!proj.data) return { ok: false, reason: "project_missing" };

  const member = await supabaseAdmin
    .from("hammerex_sitebook_members")
    .select("id, status")
    .eq("project_id", projectId)
    .eq("listing_id", listingId)
    .maybeSingle();
  if (!member.data) return { ok: false, reason: "not_member" };
  // Declined members lose access.
  if (member.data.status === "declined") return { ok: false, reason: "not_member" };
  return { ok: true };
}

/** Convenience — dispatch to the right check based on viewer type. */
export async function assertAccess(
  projectId: string,
  viewer: "homeowner" | "merchant",
  viewerId: string
): Promise<AccessDecision> {
  return viewer === "homeowner"
    ? assertHomeownerAccess(projectId, viewerId)
    : assertMerchantAccess(projectId, viewerId);
}

// PATCH /api/home/entity/members/[memberId]
//   { role?, can_see_financials?, status? }
// DELETE /api/home/entity/members/[memberId]  (soft delete → status=removed)
//
// Owner-only. Changes a member's role, financial visibility, or status
// inside the active entity. Logs every change to the audit table.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireHomeownerSession } from "@/lib/os/homeownerSession";
import { requireEntityRole } from "@/lib/os/entitySession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { memberId: string };

const ALLOWED_ROLES = new Set([
  "owner",
  "finance",
  "foreman",
  "estimator",
  "viewer",
  "trade"
]);

async function loadMemberInScope(memberId: string, entityId: string) {
  const { data } = await supabaseAdmin
    .from("os_entity_members")
    .select(
      "id, entity_id, party_id, role, can_see_financials, status"
    )
    .eq("id", memberId)
    .eq("entity_id", entityId)
    .maybeSingle();
  return data as
    | {
        id: string;
        entity_id: string;
        party_id: string;
        role: string;
        can_see_financials: boolean;
        status: string;
      }
    | null;
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<Params> }
) {
  let party;
  try {
    party = await requireHomeownerSession();
  } catch {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }
  let ownerMembership;
  try {
    ownerMembership = await requireEntityRole("owner");
  } catch {
    return NextResponse.json({ ok: false, error: "not_owner" }, { status: 403 });
  }

  const { memberId } = await ctx.params;
  const target = await loadMemberInScope(memberId, ownerMembership.entity_id);
  if (!target) {
    return NextResponse.json({ ok: false, error: "member_not_found" }, { status: 404 });
  }
  // Owners can't demote themselves — prevents lock-out.
  if (target.party_id === party.id) {
    return NextResponse.json(
      { ok: false, error: "cannot_change_own_membership" },
      { status: 400 }
    );
  }

  let body: {
    role?: string;
    can_see_financials?: boolean;
    status?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.role !== undefined) {
    if (!ALLOWED_ROLES.has(body.role)) {
      return NextResponse.json({ ok: false, error: "invalid_role" }, { status: 400 });
    }
    patch.role = body.role;
  }
  if (body.can_see_financials !== undefined) {
    patch.can_see_financials = Boolean(body.can_see_financials);
  }
  if (body.status !== undefined) {
    if (!["active", "paused", "removed"].includes(body.status)) {
      return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 400 });
    }
    patch.status = body.status;
    if (body.status === "removed") patch.removed_at = new Date().toISOString();
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "no_changes" }, { status: 400 });
  }

  const { data: updated, error } = await supabaseAdmin
    .from("os_entity_members")
    .update(patch)
    .eq("id", memberId)
    .select("id, role, can_see_financials, status")
    .single();
  if (error || !updated) {
    return NextResponse.json(
      { ok: false, error: "update_failed", detail: error?.message },
      { status: 500 }
    );
  }

  await supabaseAdmin.from("os_entity_audit_events").insert({
    entity_id: ownerMembership.entity_id,
    actor_party_id: party.id,
    target_party_id: target.party_id,
    target_member_id: memberId,
    verb: "member.updated",
    before_state: {
      role: target.role,
      can_see_financials: target.can_see_financials,
      status: target.status
    },
    after_state: {
      role: updated.role,
      can_see_financials: updated.can_see_financials,
      status: updated.status
    }
  });

  return NextResponse.json({ ok: true, member: updated });
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<Params> }
) {
  let party;
  try {
    party = await requireHomeownerSession();
  } catch {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }
  let ownerMembership;
  try {
    ownerMembership = await requireEntityRole("owner");
  } catch {
    return NextResponse.json({ ok: false, error: "not_owner" }, { status: 403 });
  }

  const { memberId } = await ctx.params;
  const target = await loadMemberInScope(memberId, ownerMembership.entity_id);
  if (!target) {
    return NextResponse.json({ ok: false, error: "member_not_found" }, { status: 404 });
  }
  if (target.party_id === party.id) {
    return NextResponse.json(
      { ok: false, error: "cannot_remove_self" },
      { status: 400 }
    );
  }

  await supabaseAdmin
    .from("os_entity_members")
    .update({
      status: "removed",
      removed_at: new Date().toISOString()
    })
    .eq("id", memberId);

  await supabaseAdmin.from("os_entity_audit_events").insert({
    entity_id: ownerMembership.entity_id,
    actor_party_id: party.id,
    target_party_id: target.party_id,
    target_member_id: memberId,
    verb: "member.removed",
    before_state: { role: target.role, status: target.status },
    after_state: { status: "removed" }
  });

  return NextResponse.json({ ok: true });
}

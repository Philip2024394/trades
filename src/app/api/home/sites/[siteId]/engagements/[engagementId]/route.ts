// PATCH /api/home/sites/[siteId]/engagements/[engagementId]
//
// Foreman-or-above. Change status, actual dates, notes.
// Enforces the allowed state transitions.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireHomeownerSession } from "@/lib/os/homeownerSession";
import { requireEntityRole } from "@/lib/os/entitySession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { siteId: string; engagementId: string };

const NEXT_ALLOWED: Record<string, string[]> = {
  pending: ["accepted", "cancelled"],
  accepted: ["in_progress", "cancelled", "disputed"],
  in_progress: ["completed", "disputed", "cancelled"],
  completed: ["signed_off", "disputed", "in_progress"],
  signed_off: [],
  disputed: ["accepted", "in_progress", "cancelled"],
  cancelled: []
};

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
  let membership;
  try {
    membership = await requireEntityRole("foreman");
  } catch {
    return NextResponse.json(
      { ok: false, error: "insufficient_role" },
      { status: 403 }
    );
  }

  const { siteId, engagementId } = await ctx.params;

  const { data: current } = await supabaseAdmin
    .from("os_site_engagements")
    .select("id, status, owner_entity_id, actual_start_date, actual_end_date, notes")
    .eq("id", engagementId)
    .eq("site_id", siteId)
    .maybeSingle();

  if (!current || current.owner_entity_id !== membership.entity_id) {
    return NextResponse.json(
      { ok: false, error: "engagement_not_found" },
      { status: 404 }
    );
  }

  let body: {
    status?: string;
    actual_start_date?: string | null;
    actual_end_date?: string | null;
    notes?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.status !== undefined) {
    const allowed = NEXT_ALLOWED[current.status] ?? [];
    if (!allowed.includes(body.status)) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_transition",
          detail: `Cannot move ${current.status} → ${body.status}`
        },
        { status: 400 }
      );
    }
    patch.status = body.status;
    if (body.status === "in_progress" && !current.actual_start_date) {
      patch.actual_start_date = new Date().toISOString().slice(0, 10);
    }
    if (body.status === "completed" && !current.actual_end_date) {
      patch.actual_end_date = new Date().toISOString().slice(0, 10);
    }
  }
  if (body.actual_start_date !== undefined) {
    patch.actual_start_date = body.actual_start_date || null;
  }
  if (body.actual_end_date !== undefined) {
    patch.actual_end_date = body.actual_end_date || null;
  }
  if (body.notes !== undefined) {
    patch.notes = body.notes.trim() || null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "no_changes" }, { status: 400 });
  }

  const { data: updated, error } = await supabaseAdmin
    .from("os_site_engagements")
    .update(patch)
    .eq("id", engagementId)
    .select("id, status, actual_start_date, actual_end_date, notes")
    .single();

  if (error || !updated) {
    return NextResponse.json(
      { ok: false, error: "update_failed", detail: error?.message },
      { status: 500 }
    );
  }

  await supabaseAdmin.from("os_entity_audit_events").insert({
    entity_id: membership.entity_id,
    actor_party_id: party.id,
    verb: "engagement.updated",
    before_state: {
      status: current.status,
      actual_start_date: current.actual_start_date,
      actual_end_date: current.actual_end_date
    },
    after_state: {
      status: updated.status,
      actual_start_date: updated.actual_start_date,
      actual_end_date: updated.actual_end_date
    }
  });

  return NextResponse.json({ ok: true, engagement: updated });
}

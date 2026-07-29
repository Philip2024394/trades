// POST /api/admin/brains/[slug]/drafts/[draftId]/submit
//
// Author submits their draft for review. Transitions draft.status
// editing | changes_requested → submitted_for_review + stamps
// submitted_at. Logs `brain_submitted_for_review`.

import { NextResponse, type NextRequest } from "next/server";
import { brainSupabase, brainSupabaseAvailable } from "@/lib/nex/brains/_supabase";
import { withBrainWrite } from "@/lib/nex/brains/_writer";
import { BRAIN_EVENT_TYPES, type BrainDraftRow } from "@/lib/nex/brains/_living_types";
import { extractActor } from "@/lib/nex/brains/_actor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string; draftId: string }> }) {
  if (!brainSupabaseAvailable()) return json503();
  const { slug, draftId } = await params;

  // F1 · Real authentication
  const actorResult = await extractActor(req);
  if (!actorResult.ok) return NextResponse.json({ ok: false, error: actorResult.error }, { status: actorResult.status });
  const actor = actorResult.actor;

  const sb = brainSupabase()!;

  const { data: current, error: readErr } = await sb
    .from("hammerex_nex_brain_drafts")
    .select("*").eq("brain_slug", slug).eq("id", draftId).maybeSingle();
  if (readErr) return NextResponse.json({ ok: false, error: readErr.message }, { status: 500 });
  if (!current) return NextResponse.json({ ok: false, error: "draft_not_found" }, { status: 404 });

  const draft = current as BrainDraftRow;
  const submittable = draft.status === "editing" || draft.status === "changes_requested";
  if (!submittable) {
    return NextResponse.json({ ok: false, error: "not_submittable", status: draft.status }, { status: 409 });
  }

  await withBrainWrite<string>(
    { ...actor, brain_slug: slug, entity_type: "brain_draft", entity_id: draftId },
    async () => {
      const submittedAt = new Date().toISOString();
      const { error } = await sb
        .from("hammerex_nex_brain_drafts")
        .update({ status: "submitted_for_review", submitted_at: submittedAt })
        .eq("id", draftId);
      if (error) throw new Error(error.message);
      return {
        return_value: draftId,
        event: {
          event_type: BRAIN_EVENT_TYPES.DRAFT_SUBMITTED_FOR_REVIEW,
          before_json: { status: draft.status },
          after_json:  { status: "submitted_for_review", submitted_at: submittedAt, proposed_semver: draft.proposed_semver },
        },
      };
    }
  );

  const { data: updated } = await sb.from("hammerex_nex_brain_drafts").select("*").eq("id", draftId).single();
  return NextResponse.json({ ok: true, draft: updated });
}

function json503() {
  return NextResponse.json({ ok: false, error: "supabase_unavailable" }, { status: 503 });
}

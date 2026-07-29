// GET   /api/admin/brains/[slug]/drafts/[draftId]  — fetch a single draft
// PATCH /api/admin/brains/[slug]/drafts/[draftId]  — edit draft content
//
// PATCH accepts partial updates for: manifest_json · modules_json ·
// proposed_semver. Editing forbidden once the draft has been submitted
// unless status is `changes_requested` (author is re-working the draft).

import { NextResponse, type NextRequest } from "next/server";
import { brainSupabase, brainSupabaseAvailable } from "@/lib/nex/brains/_supabase";
import { withBrainWrite } from "@/lib/nex/brains/_writer";
import { BRAIN_EVENT_TYPES, type BrainDraftRow } from "@/lib/nex/brains/_living_types";
import { extractActor } from "@/lib/nex/brains/_actor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PatchBody = {
  manifest_json?: Record<string, unknown>;
  modules_json?: Record<string, unknown>;
  proposed_semver?: string | null;
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string; draftId: string }> }) {
  if (!brainSupabaseAvailable()) return json503();
  const { slug, draftId } = await params;
  const sb = brainSupabase()!;
  const { data, error } = await sb
    .from("hammerex_nex_brain_drafts")
    .select("*")
    .eq("brain_slug", slug)
    .eq("id", draftId)
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, error: "draft_not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, draft: data });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string; draftId: string }> }) {
  if (!brainSupabaseAvailable()) return json503();
  const { slug, draftId } = await params;

  // F1 · Real authentication
  const actorResult = await extractActor(req);
  if (!actorResult.ok) return NextResponse.json({ ok: false, error: actorResult.error }, { status: actorResult.status });
  const actor = actorResult.actor;

  let body: PatchBody;
  try { body = (await req.json()) as PatchBody; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const sb = brainSupabase()!;
  const { data: current, error: readErr } = await sb
    .from("hammerex_nex_brain_drafts")
    .select("*")
    .eq("brain_slug", slug)
    .eq("id", draftId)
    .maybeSingle();
  if (readErr) return NextResponse.json({ ok: false, error: readErr.message }, { status: 500 });
  if (!current) return NextResponse.json({ ok: false, error: "draft_not_found" }, { status: 404 });

  const draft = current as BrainDraftRow;
  const editable = draft.status === "editing" || draft.status === "changes_requested";
  if (!editable) {
    return NextResponse.json({ ok: false, error: "draft_not_editable", status: draft.status }, { status: 409 });
  }

  const patch: Record<string, unknown> = {};
  if (body.manifest_json !== undefined) patch.manifest_json = body.manifest_json;
  if (body.modules_json !== undefined)  patch.modules_json  = body.modules_json;
  if (body.proposed_semver !== undefined) patch.proposed_semver = body.proposed_semver;
  // Any edit while in `changes_requested` bumps the draft back to `editing`.
  if (draft.status === "changes_requested") patch.status = "editing";

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "no_changes" }, { status: 400 });
  }

  await withBrainWrite<string>(
    {
      ...actor,
      brain_slug: slug,
      entity_type: "brain_draft",
      entity_id: draftId,
    },
    async () => {
      const { error } = await sb
        .from("hammerex_nex_brain_drafts")
        .update(patch)
        .eq("id", draftId);
      if (error) throw new Error(error.message);
      return {
        return_value: draftId,
        event: {
          event_type: BRAIN_EVENT_TYPES.DRAFT_SAVED,
          before_json: {
            status: draft.status,
            proposed_semver: draft.proposed_semver,
            modules_keys: Object.keys(draft.modules_json ?? {}),
          },
          after_json: {
            status: (patch.status ?? draft.status),
            proposed_semver: patch.proposed_semver ?? draft.proposed_semver,
            modules_keys: Object.keys((patch.modules_json as Record<string, unknown>) ?? draft.modules_json ?? {}),
          },
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

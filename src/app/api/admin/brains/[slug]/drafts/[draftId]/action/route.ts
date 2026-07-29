// POST /api/admin/brains/[slug]/drafts/[draftId]/action
//
// Reviewer action on a submitted draft. Body: { action: "approve" |
// "reject" | "request_changes" | "comment", notes?: string }.
//
// approve         → draft.status = approved             + writes review_action + event
// reject          → draft.status = rejected             + writes review_action + event
// request_changes → draft.status = changes_requested    + writes review_action + event
// comment         → no status change                    + writes review_action + event
//
// F6 · Separation of Duties (Philip 2026-07-28 · locked as critical path #2):
//   an author CANNOT approve · reject · or request_changes on their own draft.
//   Only "comment" is permitted from the author's own identity.
//   Trust chain requires the review to come from a different named human.

import { NextResponse, type NextRequest } from "next/server";
import { brainSupabase, brainSupabaseAvailable } from "@/lib/nex/brains/_supabase";
import { withBrainWrite } from "@/lib/nex/brains/_writer";
import {
  BRAIN_EVENT_TYPES,
  type BrainDraftRow,
  type BrainReviewActionKind,
} from "@/lib/nex/brains/_living_types";
import {
  requireAuth,
  requireBrainPermission,
  toErrorResponse,
} from "@/lib/nex/brains/_route_guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set<BrainReviewActionKind>(["approve", "reject", "request_changes", "comment"]);

type Body = { action: BrainReviewActionKind; notes?: string };

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string; draftId: string }> }) {
  if (!brainSupabaseAvailable()) return json503();

  const { slug, draftId } = await params;

  // D1 Turn 3 · centralised guards (review permission required · F6 self-review check still enforced below)
  let actor: { actor_id: string; actor_role: "author" | "reviewer" | "admin" | "system" | "runtime" };
  try {
    const user = await requireAuth();
    requireBrainPermission(user, slug, "review");
    actor = { actor_id: user.email, actor_role: user.nex_user.role };
  } catch (err) {
    return toErrorResponse(err);
  }
  const sb = brainSupabase()!;

  let body: Body;
  try { body = (await req.json()) as Body; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  if (!body.action || !ALLOWED.has(body.action)) {
    return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
  }

  const { data: current, error: readErr } = await sb
    .from("hammerex_nex_brain_drafts").select("*").eq("brain_slug", slug).eq("id", draftId).maybeSingle();
  if (readErr) return NextResponse.json({ ok: false, error: readErr.message }, { status: 500 });
  if (!current) return NextResponse.json({ ok: false, error: "draft_not_found" }, { status: 404 });

  const draft = current as BrainDraftRow;

  // F6 · Separation of Duties — author cannot self-review
  if (body.action !== "comment" && actor.actor_id === draft.author_id) {
    return NextResponse.json({
      ok: false,
      error: "self_review_forbidden",
      detail: `actor '${actor.actor_id}' is the draft author · a different named identity must approve · reject · or request_changes (F6 · separation of duties)`,
    }, { status: 403 });
  }

  if (body.action !== "comment" && draft.status !== "submitted_for_review") {
    return NextResponse.json({ ok: false, error: "not_reviewable", status: draft.status }, { status: 409 });
  }

  const nextStatus =
    body.action === "approve"          ? "approved" :
    body.action === "reject"           ? "rejected" :
    body.action === "request_changes"  ? "changes_requested" :
    draft.status;

  const eventType =
    body.action === "approve"          ? BRAIN_EVENT_TYPES.DRAFT_APPROVED :
    body.action === "reject"           ? BRAIN_EVENT_TYPES.DRAFT_REJECTED :
    body.action === "request_changes"  ? BRAIN_EVENT_TYPES.DRAFT_CHANGES_REQUESTED :
    "brain_review_comment";

  await withBrainWrite<string>(
    { ...actor, brain_slug: slug, entity_type: "brain_draft", entity_id: draftId },
    async () => {
      const reviewedAt = new Date().toISOString();

      if (body.action !== "comment") {
        const { error: dErr } = await sb
          .from("hammerex_nex_brain_drafts")
          .update({
            status: nextStatus,
            reviewed_at: reviewedAt,
            reviewed_by: actor.actor_id,
            review_notes: body.notes ?? null,
          })
          .eq("id", draftId);
        if (dErr) throw new Error(dErr.message);
      }

      const { error: raErr } = await sb.from("hammerex_nex_brain_review_actions").insert({
        brain_slug: slug,
        draft_id: draftId,
        action: body.action,
        reviewer_id: actor.actor_id,
        reviewer_role: actor.actor_role === "reviewer" ? "admin" : "admin",
        notes: body.notes ?? null,
        occurred_at: reviewedAt,
      });
      if (raErr) throw new Error(raErr.message);

      return {
        return_value: draftId,
        event: {
          event_type: eventType,
          before_json: { status: draft.status },
          after_json: { status: nextStatus, notes: body.notes ?? null },
          metadata: { reviewer_id: actor.actor_id },
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

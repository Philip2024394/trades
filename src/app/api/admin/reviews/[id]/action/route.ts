// POST /api/admin/reviews/[id]/action
//
// Admin moderation for a review. One endpoint, three actions —
// action=freeze | remove | verify — so admins have a single form
// posting to the same URL.
//
// Every action:
//   1. Updates the review row's admin_action + admin_action_reason
//      + admin_action_at fields
//   2. Emits a matching event to hammerex_network_review_events
//   3. If action=remove, also flips reviewer accountability weight
//      via recalculateReviewerWeight (see reviewerAccountability.ts)

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminAuthed } from "@/lib/adminAuth";
import { recalculateReviewerWeight } from "@/lib/reviewerAccountability";
import { deleteStorageObjects } from "@/lib/uploads.server";

type ActionPayload = {
  action: "freeze" | "remove" | "verify";
  reason: string;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "not-admin" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "missing-id" }, { status: 400 });
  }

  let payload: ActionPayload;
  try {
    payload = (await req.json()) as ActionPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const action = payload.action;
  if (!action || !["freeze", "remove", "verify"].includes(action)) {
    return NextResponse.json({ ok: false, error: "invalid-action" }, { status: 400 });
  }
  const reason = String(payload.reason ?? "").trim();
  if (reason.length < 10) {
    return NextResponse.json({ ok: false, error: "reason-required" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();

  // Read review before mutating so we know the reviewer identity
  // (needed for accountability recalc on removes) + the photo urls
  // (needed for bucket cleanup on removes).
  const review = await supabaseAdmin
    .from("hammerex_network_reviews")
    .select("id, reviewer_slug, reviewer_cookie, status, photo_urls")
    .eq("id", id)
    .maybeSingle();

  if (review.error) {
    return NextResponse.json({ ok: false, error: "db-lookup-failed" }, { status: 500 });
  }
  if (!review.data) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }

  // Map action → new row status.
  //   freeze → status stays but admin_action='frozen' (excluded from
  //     public reads by application code)
  //   remove → status='removed' (RLS + app read both filter these out)
  //   verify → admin_action='verified' — the row stays visible, but
  //     the accountability weight goes to 1.5×
  const rowUpdate: Record<string, unknown> = {
    admin_action: action === "freeze" ? "frozen" : action === "remove" ? "removed" : "verified",
    admin_action_reason: reason,
    admin_action_at: nowIso,
    admin_action_by: "admin"
  };
  if (action === "freeze") rowUpdate.status = "frozen";
  else if (action === "remove") rowUpdate.status = "removed";

  const update = await supabaseAdmin
    .from("hammerex_network_reviews")
    .update(rowUpdate)
    .eq("id", id);

  if (update.error) {
    return NextResponse.json(
      { ok: false, error: "db-update-failed", detail: update.error.message },
      { status: 500 }
    );
  }

  // Event log.
  await supabaseAdmin.from("hammerex_network_review_events").insert({
    review_id: id,
    kind: action === "freeze" ? "admin_frozen" : action === "remove" ? "admin_removed" : "admin_verified",
    actor: "admin",
    actor_slug: "admin",
    note: reason
  });

  // Reviewer accountability — bump the removed-count on removal so
  // the reviewer's weight_multiplier recomputes. Verify doesn't
  // touch the reviewer weight; it only bumps a per-review 1.5×
  // multiplier at read-time (see reviews.server.ts).
  if (action === "remove") {
    const reviewerId = review.data.reviewer_slug ?? review.data.reviewer_cookie ?? null;
    if (reviewerId) {
      await recalculateReviewerWeight(reviewerId);
    }
    // Storage cleanup — orphaned review photos leave the bucket when
    // the review is admin-removed. Non-network URLs (e.g. ImageKit
    // mocks in older data) are silently skipped by the helper.
    const photoUrls = ((review.data.photo_urls ?? []) as string[]);
    if (photoUrls.length > 0) {
      await deleteStorageObjects(photoUrls);
    }
  }

  return NextResponse.json({ ok: true, action });
}

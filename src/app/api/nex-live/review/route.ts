// src/app/api/nex-live/review/route.ts
//
// NEX LIVE · MUSIC/VIDEO slice · Moderator/Founder review decision
// Philip 2026-09-06 · FOUNDER AUTHORIZATION · §8 · §11 · §17 · §18
//
// Only founder OR admin-role moderator may issue a review decision.
// §18 no parallel auth — reuses existing resolveFounderIdentity +
// assertAdminRole([moderator, admin]).
//
// Body:
//   {
//     media_id: string,
//     decision: "KEEP" | "RESTRICT" | "REMOVE" | "DISPUTE_ACCEPTED" | "DISPUTE_REJECTED",
//     reason: string,
//     addressed_report_ids?: string[]
//   }

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/nex/brains/_auth";
import { resolveFounderIdentity } from "@/lib/nex/founder/identity";
import { assertAdminRole } from "@/lib/admin/rbac";
import {
  applyReview,
  readMediaVisibility,
  listReviewsForMedia,
  type ReviewDecision,
} from "@/lib/nex/live/report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_DECISIONS: ReviewDecision[] = [
  "KEEP", "RESTRICT", "REMOVE", "DISPUTE_ACCEPTED", "DISPUTE_REJECTED",
];

type ReviewerAuth =
  | { ok: true; user_id: string; role: "founder" | "moderator" }
  | { ok: false; reason: string; status: 401 | 403 };

async function resolveReviewer(): Promise<ReviewerAuth> {
  // Path 1 · founder identity
  const auth = await getAuthenticatedUser();
  if (auth.ok) {
    const founder = resolveFounderIdentity({
      supabase_user_id: auth.user.supabase_user_id,
      email: auth.user.email ?? "",
    });
    if (founder.kind === "founder_candidate") {
      return { ok: true, user_id: founder.supabase_user_id, role: "founder" };
    }
  }
  // Path 2 · admin role · reuses existing RBAC · no parallel auth (§18)
  const admin = await assertAdminRole(["moderator", "admin"]);
  if (admin.ok) {
    // adminId may be null under shared-password fallback — record 'root'
    // so the audit line always has a stable identifier.
    return {
      ok: true,
      user_id: admin.identity.adminId ?? `admin:${admin.identity.email}`,
      role: "moderator",
    };
  }
  return {
    ok: false,
    reason: `unauthorized:${auth.ok ? "not_founder_and_not_moderator" : (auth.error ?? "no_auth")}`,
    status: 403,
  };
}

export async function POST(req: Request) {
  const reviewer = await resolveReviewer();
  if (!reviewer.ok) {
    return NextResponse.json({ ok: false, error: reviewer.reason }, { status: reviewer.status });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "body_required" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const media_id = typeof b.media_id === "string" ? b.media_id.trim() : "";
  if (!media_id) return NextResponse.json({ ok: false, error: "media_id_required" }, { status: 400 });
  const decision = b.decision;
  if (typeof decision !== "string" || !ALLOWED_DECISIONS.includes(decision as ReviewDecision)) {
    return NextResponse.json(
      { ok: false, error: `decision_must_be:${ALLOWED_DECISIONS.join("|")}` },
      { status: 400 },
    );
  }
  const reason = typeof b.reason === "string" ? b.reason.trim() : "";
  if (reason.length < 5) return NextResponse.json({ ok: false, error: "reason_min_5_chars" }, { status: 400 });
  const addressed_report_ids = Array.isArray(b.addressed_report_ids)
    ? (b.addressed_report_ids as unknown[]).filter((x) => typeof x === "string") as string[]
    : [];

  const previous = readMediaVisibility(media_id);
  let review;
  try {
    review = applyReview({
      media_id,
      reviewer_user_id: reviewer.user_id,
      reviewer_role: reviewer.role,
      decision: decision as ReviewDecision,
      reason,
      addressed_report_ids,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `review_failed:${(err as Error).message}` },
      { status: 400 },
    );
  }
  const current = readMediaVisibility(media_id);
  const history = listReviewsForMedia(media_id);

  return NextResponse.json({
    ok: true,
    review: {
      review_id: review.review_id,
      media_id,
      decision: review.decision,
      previous_state: review.previous_state,
      new_state: review.new_state,
      reviewer_role: review.reviewer_role,
      decided_at_iso: review.decided_at_iso,
    },
    previous_visibility: previous,
    current_visibility: current,
    review_history_count: history.length,
  });
}

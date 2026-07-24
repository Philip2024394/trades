// POST /api/brain-admin/brains/[slug]/candidates/[candidateId]/review
//
// Body: {
//   run_id: string,
//   action: "approve" | "reject" | "request_changes" | "merge" | "send_back",
//   reason?: string,       // mandatory for reject + request_changes
//   notes?: string,
//   merge_target_id?: string  // required for action="merge"
// }
//
// The single Admin decision endpoint. Every call appends a
// CandidateReviewEvent to the candidate's immutable review_history —
// the audit trail that supports the "fully auditable and reversible"
// requirement.

import type { NextRequest } from "next/server";
import { loadRun, updateCandidate } from "@/lib/nex/brains/_studio/_extraction";
import type { AdminReviewAction, CandidateAdminStatus, CandidateReviewEvent } from "@/lib/nex/brains/_studio/_extraction";
import { jsonError, jsonOk, requireBrainAdmin } from "../../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTION_TO_STATUS: Record<AdminReviewAction, CandidateAdminStatus> = {
  approve:         "approved",
  reject:          "rejected",
  request_changes: "changes_requested",
  merge:           "merged",
  send_back:       "sent_back"
};

const REQUIRE_REASON = new Set<AdminReviewAction>(["reject", "request_changes"]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string; candidateId: string }> }) {
  const gate = await requireBrainAdmin();
  if (!gate.ok) return gate.response;
  const { slug, candidateId } = await ctx.params;

  let body: {
    run_id?:          unknown;
    action?:          unknown;
    reason?:          unknown;
    notes?:           unknown;
    merge_target_id?: unknown;
  };
  try { body = await req.json(); } catch {
    return jsonError("invalid_json", "Request body is not valid JSON");
  }

  const runId = typeof body.run_id === "string" ? body.run_id : "";
  if (!runId) return jsonError("bad_request", "run_id is required");

  const action = body.action as AdminReviewAction;
  if (!Object.hasOwn(ACTION_TO_STATUS, action)) {
    return jsonError("bad_request", `action must be one of: ${Object.keys(ACTION_TO_STATUS).join(", ")}`);
  }

  const reason = typeof body.reason === "string" ? body.reason : undefined;
  if (REQUIRE_REASON.has(action) && (!reason || reason.trim() === "")) {
    return jsonError("bad_request", `reason is required for action='${action}'`);
  }

  const notes = typeof body.notes === "string" ? body.notes : undefined;
  const mergeTargetId = typeof body.merge_target_id === "string" ? body.merge_target_id : undefined;
  if (action === "merge" && (!mergeTargetId || mergeTargetId.trim() === "")) {
    return jsonError("bad_request", "merge_target_id is required for action='merge'");
  }

  const run = await loadRun(slug, runId);
  if (!run) return jsonError("run_not_found", `No run '${runId}' for '${slug}'`, 404);

  const candidate = run.candidates.find((c) => c.id === candidateId);
  if (!candidate) return jsonError("candidate_not_found", `No candidate '${candidateId}' in run '${runId}'`, 404);

  // Author must have Accepted/Edited before Admin can review.
  if (candidate.status !== "accepted" && candidate.status !== "edited") {
    return jsonError("author_step_missing", `Candidate must be Author-accepted (or edited-accepted) before Admin review. Current status=${candidate.status}`, 422);
  }

  const nowIso = new Date().toISOString();
  const event: CandidateReviewEvent = {
    actor: { kind: "brain_admin", id: gate.adminId },
    action,
    at: nowIso,
    reason,
    notes,
    brain_version: "current",
    ...(mergeTargetId ? { merge_target_id: mergeTargetId } : {})
  };

  const updated = await updateCandidate(slug, runId, candidateId, {
    admin_status: ACTION_TO_STATUS[action]
  }, event);
  if (!updated) return jsonError("update_failed", "Could not update candidate", 500);

  return jsonOk({ candidate: updated });
}

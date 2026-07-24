// POST /api/authors/brains/[slug]/extract/confirm
//
// Body: { run_id: string, candidate_id: string,
//         action: "accept" | "reject" | "edit",
//         edited_payload?: unknown,
//         notes?: string }
//
// Author-per-item accept/reject/edit. Accepted (or edited-then-accepted)
// candidates are merged into the corresponding draft module via
// mergeCandidate(). Rejected candidates are archived with the Author's
// notes so the audit trail preserves why.

import type { NextRequest } from "next/server";
import {
  loadRun,
  mergeCandidate,
  updateCandidate
} from "@/lib/nex/brains/_studio/_extraction";
import type { CandidateReviewEvent } from "@/lib/nex/brains/_studio/_extraction";
import { jsonError, jsonOk, requireStudio } from "../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action = "accept" | "reject" | "edit";

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const gate = await requireStudio();
  if (!gate.ok) return gate.response;
  const { slug } = await ctx.params;

  let body: {
    run_id?:         unknown;
    candidate_id?:   unknown;
    action?:         unknown;
    edited_payload?: unknown;
    notes?:          unknown;
  };
  try { body = await req.json(); } catch {
    return jsonError("invalid_json", "Request body is not valid JSON");
  }

  const runId       = typeof body.run_id === "string"       ? body.run_id       : "";
  const candidateId = typeof body.candidate_id === "string" ? body.candidate_id : "";
  const action      = body.action as Action;
  if (!runId || !candidateId)                return jsonError("bad_request", "run_id and candidate_id are required");
  if (action !== "accept" && action !== "reject" && action !== "edit") {
    return jsonError("bad_request", "action must be accept, reject, or edit");
  }

  const run = await loadRun(slug, runId);
  if (!run) return jsonError("run_not_found", `No extraction run '${runId}' for '${slug}'`, 404);

  const candidate = run.candidates.find((c) => c.id === candidateId);
  if (!candidate) return jsonError("candidate_not_found", `No candidate '${candidateId}' in run '${runId}'`, 404);

  const nowIso = new Date().toISOString();
  const notes = typeof body.notes === "string" ? body.notes : undefined;

  // Best-effort brain version — we don't have the manifest handy here.
  // The audit trail captures what we know at review time; fine to be
  // approximate.
  const brainVersion = "current";

  if (action === "reject") {
    const event: CandidateReviewEvent = {
      actor: { kind: "author", id: gate.authorId },
      action: "rejected",
      at: nowIso,
      notes,
      brain_version: brainVersion
    };
    const updated = await updateCandidate(slug, runId, candidateId, {
      status:       "rejected",
      author_notes: notes,
      reviewed_at:  nowIso
    }, event);
    return jsonOk({ candidate: updated, merged: false });
  }

  // accept or edit → status transitions to accepted or edited AND we
  // attempt to merge into the draft.
  const isEdit = action === "edit";
  const patch = isEdit
    ? {
        status:  "edited" as const,
        payload: body.edited_payload,
        author_notes: notes,
        reviewed_at: nowIso
      }
    : {
        status: "accepted" as const,
        author_notes: notes,
        reviewed_at: nowIso
      };

  const event: CandidateReviewEvent = {
    actor: { kind: "author", id: gate.authorId },
    action: isEdit ? "edited" : "accepted",
    at: nowIso,
    notes,
    brain_version: brainVersion
  };

  const updated = await updateCandidate(slug, runId, candidateId, patch, event);
  if (!updated) return jsonError("candidate_update_failed", "Could not update candidate", 500);

  // Refuse to merge when the candidate still lacks a source and the
  // Author has not supplied one via edited_payload.
  if (updated.needs_author_source) {
    // Author accepted without supplying a source — revert to pending
    // and surface the reason.
    await updateCandidate(slug, runId, candidateId, { status: "pending" });
    return jsonError(
      "needs_author_source",
      "This candidate has no verified citation. Edit it to supply an evidence source before accepting.",
      422
    );
  }

  const mergeResult = await mergeCandidate({
    brain_slug: slug,
    author_id:  gate.authorId,
    candidate:  updated
  });

  if (!mergeResult.ok) {
    return jsonError(mergeResult.reason, mergeResult.detail, 422);
  }

  return jsonOk({ candidate: updated, merged: true, module: mergeResult.module });
}

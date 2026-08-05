// POST /api/nex/brain/review — approve / reject / edit a draft record
//
// One atomic action that:
//   (a) updates the record's status
//   (b) captures a knowledge_feedback row with the decision + any
//       correction text so the Learning Context Worker can pick it up
//       on future authoring runs
//
// This is the human end of the learning loop. Every click here becomes
// signal that improves the next round of authoring.
//
// Body:
//   {
//     record_id: string,
//     action: "approve" | "reject" | "edit",
//     correction?: string,       // required for edit + optional for reject
//     lesson?: string,            // one-line "why" — the future prompt hint
//     severity?: "minor" | "moderate" | "critical"  // defaults to moderate
//   }
//
// Behaviour:
//   approve → status becomes AUTHORITATIVE + feedback kind=approval
//   reject  → status becomes DEPRECATED   + feedback kind=rejection
//   edit    → status becomes UNDER_REVIEW + feedback kind=edit (Philip
//             can approve the edited version on the next click)

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { brainStore } from "@/lib/nex/brain/storage";
import type { FeedbackSeverity, KnowledgeRecord } from "@/lib/nex/brain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_SEVERITY: FeedbackSeverity[] = ["minor", "moderate", "critical"];

export async function POST(req: NextRequest) {
  let body: {
    record_id?: unknown;
    action?: unknown;
    correction?: unknown;
    lesson?: unknown;
    severity?: unknown;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const recordId = typeof body.record_id === "string" ? body.record_id : "";
  const action = body.action;
  const correction = typeof body.correction === "string" ? body.correction : null;
  const lesson = typeof body.lesson === "string" ? body.lesson : null;
  const severity: FeedbackSeverity =
    typeof body.severity === "string" && (VALID_SEVERITY as string[]).includes(body.severity)
      ? (body.severity as FeedbackSeverity)
      : "moderate";

  if (!recordId) {
    return NextResponse.json({ ok: false, error: "record_id required" }, { status: 400 });
  }
  if (action !== "approve" && action !== "reject" && action !== "edit") {
    return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
  }
  if (action === "edit" && !correction) {
    return NextResponse.json(
      { ok: false, error: "edit action requires correction text" },
      { status: 400 }
    );
  }

  const store = brainStore();
  const record = await store.getRecord(recordId);
  if (!record) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  // Compute new status
  let newStatus: KnowledgeRecord["status"];
  let feedbackKind: "approval" | "edit" | "rejection";
  if (action === "approve") {
    newStatus = "AUTHORITATIVE";
    feedbackKind = "approval";
  } else if (action === "reject") {
    newStatus = "DEPRECATED";
    feedbackKind = "rejection";
  } else {
    newStatus = "UNDER_REVIEW";
    feedbackKind = "edit";
  }

  // Persist the status update
  const updated = await store.updateRecordStatus(record.record_id, newStatus, "philip");

  // Capture the feedback row (the moat — this is what learning-context reads)
  const feedback = await store.insertFeedback({
    question: null,
    nex_answer: record.summary,
    correction,
    lesson,
    record_id: record.record_id,
    domain: record.category,
    topic_tags: [
      ...(record.industry_concepts ?? []),
      ...(record.nex_concepts ?? []),
    ].slice(0, 10),
    feedback_kind: feedbackKind,
    severity,
    feedback_source: "philip",
    submitted_by: "philip",
    context: {
      source: "review-ui",
      previous_status: record.status,
      new_status: newStatus,
    },
    applied_at: null,
    triggered_worker_proposal: null,
    resulted_in_record: null,
  });

  // Audit
  await store.insertAudit({
    entity_type: "knowledge_records",
    entity_id: record.record_id,
    action: feedbackKind,
    actor: "philip",
    before_state: { status: record.status },
    after_state: { status: newStatus, feedback_id: feedback.id },
    notes: `Review UI · ${action} · ${lesson ?? "(no lesson noted)"}`,
  });

  return NextResponse.json({
    ok: true,
    record: updated,
    feedback,
  });
}

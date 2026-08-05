// POST /api/nex/brain/feedback — capture a correction / approval / edit
//
// This is the API for the "corrections are the moat" table. Every
// NEX answer that Philip corrects, approves, or edits gets recorded
// here so future prompts can be improved and specialist workers can
// be proposed based on repeated patterns.
//
// Body: { question?, nex_answer?, correction?, lesson?, record_id?,
//         domain?, topic_tags?, feedback_kind, severity?,
//         feedback_source? }
//
// GET (same route) returns recent feedback with an ?unapplied_only=1 filter.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { brainStore } from "@/lib/nex/brain/storage";
import type {
  FeedbackKind,
  FeedbackSeverity,
  FeedbackSource,
} from "@/lib/nex/brain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_KINDS: FeedbackKind[] = [
  "correction", "approval", "edit", "rejection", "gap", "contradiction", "voice_drift",
];
const VALID_SEVERITIES: FeedbackSeverity[] = ["minor", "moderate", "critical"];
const VALID_SOURCES: FeedbackSource[] = ["philip", "customer", "worker-audit", "automated-check"];

function coerce<T extends string>(input: unknown, valid: T[], fallback: T): T {
  return typeof input === "string" && (valid as string[]).includes(input) ? (input as T) : fallback;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const feedback_kind = coerce(body.feedback_kind, VALID_KINDS, "correction");
  const severity = coerce(body.severity, VALID_SEVERITIES, "moderate");
  const feedback_source = coerce(body.feedback_source, VALID_SOURCES, "philip");

  try {
    const row = await brainStore().insertFeedback({
      question: typeof body.question === "string" ? body.question : null,
      nex_answer: typeof body.nex_answer === "string" ? body.nex_answer : null,
      correction: typeof body.correction === "string" ? body.correction : null,
      lesson: typeof body.lesson === "string" ? body.lesson : null,
      record_id: typeof body.record_id === "string" ? body.record_id : null,
      domain: typeof body.domain === "string" ? body.domain : null,
      topic_tags: Array.isArray(body.topic_tags) ? (body.topic_tags as unknown[]).map(String) : [],
      feedback_kind,
      severity,
      feedback_source,
      submitted_by: typeof body.submitted_by === "string" ? body.submitted_by : null,
      context: typeof body.context === "object" && body.context !== null
        ? (body.context as Record<string, unknown>)
        : null,
      applied_at: null,
      triggered_worker_proposal: null,
      resulted_in_record: null,
    });
    return NextResponse.json({ ok: true, feedback: row });
  } catch (err) {
    console.error("[api.brain.feedback] insert failed:", err);
    return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const unappliedOnly = searchParams.get("unapplied_only") === "1";
  const limit = Math.min(Math.max(1, Number(searchParams.get("limit") ?? "50")), 500);
  const record_id = searchParams.get("record_id") ?? undefined;

  try {
    const rows = await brainStore().listFeedback({
      record_id: record_id ?? undefined,
      unapplied_only: unappliedOnly,
      limit,
    });
    return NextResponse.json({ ok: true, feedback: rows, count: rows.length });
  } catch (err) {
    console.error("[api.brain.feedback.get] failed:", err);
    return NextResponse.json({ ok: false, error: "list_failed" }, { status: 500 });
  }
}

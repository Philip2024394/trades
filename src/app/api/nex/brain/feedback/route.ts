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
import { z } from "zod";
import { brainStore } from "@/lib/nex/brain/storage";
import { validateSearchParams, validateJsonBody } from "@/lib/nex/brain/http/validate-input";
import { logger } from "@/lib/nex/observability/logger";
// W-OBS-1 Path A Layer 1 · Wave 3 H2.a · adopted 2026-08-10.
import { runFromRequest } from "@/lib/nex/observability/correlation";

const log = logger("api.brain.feedback");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FEEDBACK_KINDS = ["correction", "approval", "edit", "rejection", "gap", "contradiction", "voice_drift"] as const;
const SEVERITIES     = ["minor", "moderate", "critical"] as const;
const SOURCES        = ["philip", "customer", "worker-audit", "automated-check"] as const;

const PostBodySchema = z.object({
  question:        z.string().nullable().optional(),
  nex_answer:      z.string().nullable().optional(),
  correction:      z.string().nullable().optional(),
  lesson:          z.string().nullable().optional(),
  record_id:       z.string().nullable().optional(),
  domain:          z.string().nullable().optional(),
  topic_tags:      z.array(z.string()).default([]),
  feedback_kind:   z.enum(FEEDBACK_KINDS).default("correction"),
  severity:        z.enum(SEVERITIES).default("moderate"),
  feedback_source: z.enum(SOURCES).default("philip"),
  submitted_by:    z.string().nullable().optional(),
  context:         z.record(z.string(), z.unknown()).nullable().optional(),
});

const GetQuerySchema = z.object({
  unapplied_only: z.enum(["1", "true"]).optional().transform((v) => v !== undefined),
  limit:          z.coerce.number().int().min(1).max(500).default(50),
  record_id:      z.string().min(1).optional(),
});

export async function POST(req: NextRequest) {
  return runFromRequest(req, () => feedbackPostHandler(req));
}

async function feedbackPostHandler(req: NextRequest) {
  const parsed = await validateJsonBody(req, PostBodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  try {
    const row = await brainStore().insertFeedback({
      question:        body.question        ?? null,
      nex_answer:      body.nex_answer      ?? null,
      correction:      body.correction      ?? null,
      lesson:          body.lesson          ?? null,
      record_id:       body.record_id       ?? null,
      domain:          body.domain          ?? null,
      topic_tags:      body.topic_tags,
      feedback_kind:   body.feedback_kind,
      severity:        body.severity,
      feedback_source: body.feedback_source,
      submitted_by:    body.submitted_by    ?? null,
      context:         body.context         ?? null,
      applied_at: null,
      triggered_worker_proposal: null,
      resulted_in_record: null,
    });
    return NextResponse.json({ ok: true, feedback: row });
  } catch (err) {
    log.error("insert_failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return runFromRequest(req, () => feedbackGetHandler(req));
}

async function feedbackGetHandler(req: NextRequest) {
  const parsed = validateSearchParams(req, GetQuerySchema);
  if (!parsed.ok) return parsed.response;
  const { unapplied_only: unappliedOnly, limit, record_id } = parsed.data;

  try {
    const rows = await brainStore().listFeedback({
      record_id,
      unapplied_only: unappliedOnly,
      limit,
    });
    return NextResponse.json({ ok: true, feedback: rows, count: rows.length });
  } catch (err) {
    log.error("list_failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ ok: false, error: "list_failed" }, { status: 500 });
  }
}

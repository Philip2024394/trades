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
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { brainStore } from "@/lib/nex/brain/storage";
import type { FeedbackSeverity, KnowledgeRecord } from "@/lib/nex/brain/types";
// V-1b · D9 route-boundary validation adopted 2026-08-10.
import { validateSearchParams, validateJsonBody } from "@/lib/nex/brain/http/validate-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_SEVERITY: FeedbackSeverity[] = ["minor", "moderate", "critical"];

const GetQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

const PostBodySchema = z.object({
  record_id: z.string().min(1),
  action: z.enum(["approve", "reject", "edit"]),
  correction: z.string().nullable().optional().transform((v) => v ?? null),
  lesson: z.string().nullable().optional().transform((v) => v ?? null),
  severity: z.enum(["minor", "moderate", "critical"]).optional().default("moderate"),
}).refine((data) => !(data.action === "edit" && !data.correction), {
  message: "edit action requires correction text",
  path: ["correction"],
});

// ── GET /api/nex/brain/review · Phase 10.8 ──────────────────────────
//
// Lists records where status = UNDER_REVIEW so a human reviewer (Philip
// or a delegate) can see the queue and decide. Read-only · never mutates.
// Composes each record with the most recent worker_result (confidence +
// flags) so the reviewer has decision context in one payload.
//
// Query params:
//   limit  (default 25 · max 100)
//   offset (default 0)
//
// Response:
//   { ok, records: [...], total, computed_at }

interface ReviewRecordDto {
  record_id:        string;
  title:            string;
  category:         string;
  subcategory:      string | null;
  summary:          string;
  primary_audience: string;
  authored_by:      string;
  last_reviewed_at: string | null;
  created_at:       string;
  industry_concepts: string[];
  nex_concepts:      string[];
  latest_check: {
    overall_confidence: number | null;
    decision:           string | null;
    flags:              string[];
    checked_at:         string | null;
  } | null;
}

interface KnowledgeRecordRow {
  record_id: string;
  title: string;
  category: string;
  subcategory: string | null;
  summary: string;
  primary_audience: string;
  authored_by: string;
  last_reviewed_at: string | null;
  created_at: string;
  industry_concepts: string[] | null;
  nex_concepts: string[] | null;
}

interface WorkerResultRow {
  job_id: string;
  overall_confidence: number | null;
  flags: string[] | null;
  created_at: string;
  output_payload: { decision?: string } | null;
}

interface WorkerJobRow {
  id: string;
  input_ref: string;
}

function openNexSupabase() {
  const url = process.env.NEX_SUPABASE_URL
    || process.env.NEXT_PUBLIC_NEX_SUPABASE_URL
    || process.env.SUPABASE_URL;
  const key = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(req: NextRequest) {
  const client = openNexSupabase();
  if (!client) {
    return NextResponse.json(
      { ok: false, error: "supabase_unavailable · NEX_SUPABASE_URL / NEX_SUPABASE_SERVICE_ROLE_KEY not configured" },
      { status: 503 },
    );
  }

  const parsed = validateSearchParams(req, GetQuerySchema);
  if (!parsed.ok) return parsed.response;
  const { limit, offset } = parsed.data;

  // 1 · exact count of UNDER_REVIEW records so the UI can page honestly
  const countRes = await client
    .from("knowledge_records")
    .select("*", { count: "exact", head: true })
    .eq("status", "UNDER_REVIEW");
  const total = countRes.count ?? 0;

  // 2 · fetch the page of records
  const recordsRes = await client
    .from("knowledge_records")
    .select("record_id,title,category,subcategory,summary,primary_audience,authored_by,last_reviewed_at,created_at,industry_concepts,nex_concepts")
    .eq("status", "UNDER_REVIEW")
    .order("last_reviewed_at", { ascending: true, nullsFirst: false })
    .range(offset, offset + limit - 1);
  if (recordsRes.error) {
    return NextResponse.json({ ok: false, error: `records_fetch_failed: ${recordsRes.error.message}` }, { status: 500 });
  }
  const records = (recordsRes.data ?? []) as KnowledgeRecordRow[];
  if (records.length === 0) {
    return NextResponse.json({ ok: true, records: [], total, computed_at: new Date().toISOString() });
  }

  // 3 · pull the latest completed quality-checker result per record.
  //     We first need the job ids whose input_ref = one of our records ·
  //     PostgREST can filter with .in on multiple values.
  const recordIds = records.map((r) => r.record_id);
  const jobsRes = await client
    .from("worker_jobs")
    .select("id,input_ref")
    .eq("worker_type", "quality-checker")
    .eq("status", "completed")
    .in("input_ref", recordIds);
  const jobs = (jobsRes.data ?? []) as WorkerJobRow[];
  const jobIdsByRecord = new Map<string, string[]>();
  for (const j of jobs) {
    const arr = jobIdsByRecord.get(j.input_ref) ?? [];
    arr.push(j.id);
    jobIdsByRecord.set(j.input_ref, arr);
  }

  // 4 · fetch worker_results for those jobs · one round-trip · newest first
  const allJobIds = Array.from(new Set(jobs.map((j) => j.id)));
  let resultsByJob = new Map<string, WorkerResultRow>();
  if (allJobIds.length > 0) {
    const resultsRes = await client
      .from("worker_results")
      .select("job_id,overall_confidence,flags,created_at,output_payload")
      .in("job_id", allJobIds)
      .order("created_at", { ascending: false });
    const rrows = (resultsRes.data ?? []) as WorkerResultRow[];
    // keep only the latest per job_id (rows already sorted desc)
    for (const r of rrows) if (!resultsByJob.has(r.job_id)) resultsByJob.set(r.job_id, r);
  }

  // 5 · compose the reviewer view
  const dtos: ReviewRecordDto[] = records.map((r) => {
    const jobIds = jobIdsByRecord.get(r.record_id) ?? [];
    // Pick the latest result across all matching jobs for this record.
    let latest: WorkerResultRow | null = null;
    for (const jid of jobIds) {
      const rr = resultsByJob.get(jid);
      if (!rr) continue;
      if (!latest || new Date(rr.created_at) > new Date(latest.created_at)) latest = rr;
    }
    return {
      record_id:         r.record_id,
      title:             r.title,
      category:          r.category,
      subcategory:       r.subcategory,
      summary:           r.summary,
      primary_audience:  r.primary_audience,
      authored_by:       r.authored_by,
      last_reviewed_at:  r.last_reviewed_at,
      created_at:        r.created_at,
      industry_concepts: r.industry_concepts ?? [],
      nex_concepts:      r.nex_concepts ?? [],
      latest_check: latest
        ? {
            overall_confidence: latest.overall_confidence,
            decision:           latest.output_payload?.decision ?? null,
            flags:              latest.flags ?? [],
            checked_at:         latest.created_at,
          }
        : null,
    };
  });

  return NextResponse.json({
    ok: true,
    records: dtos,
    total,
    limit,
    offset,
    computed_at: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  const parsed = await validateJsonBody(req, PostBodySchema);
  if (!parsed.ok) return parsed.response;
  const { record_id: recordId, action, correction, lesson, severity } = parsed.data;
  // Keep the type-narrowing that downstream code expects; VALID_SEVERITY
  // still references the canonical list even though zod now enforces it.
  void VALID_SEVERITY;

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

// src/app/api/nex-native/generation-jobs/[jobId]/route.ts
//
// Public API for a UI (or another service) to poll a generation job's
// status after enqueue. Returns the job's current status + any result
// message ID when completed. Auth-scoped: the caller must be the same
// account that enqueued the job, OR a business-side participant of the
// conversation the job belongs to.

import { NextResponse } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getJobById } from "@/lib/nex-native/generation-job-service";
import * as conversationService from "@/lib/nex-native/conversation-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const job = await getJobById(jobId).catch(() => null);
  if (!job) {
    return NextResponse.json({ ok: false, error: "job_not_found" }, { status: 404 });
  }
  // Auth scope · caller must be the requester OR a participant of the conversation
  const participants = await conversationService.listParticipants(job.conversation_id);
  const isRequester = job.requester_account_id === session.account.id;
  const isParticipant = participants.some((p) => p.account_id === session.account.id);
  if (!isRequester && !isParticipant) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  return NextResponse.json({
    ok: true,
    job: {
      id: job.id,
      correlation_id: job.correlation_id,
      status: job.status,
      created_at: job.created_at,
      completed_at: job.completed_at,
      failed_at: job.failed_at,
      result_message_id: job.result_message_id,
      result_model_id: job.result_model_id,
      result_latency_ms: job.result_latency_ms,
      attempts: job.attempts,
      max_attempts: job.max_attempts,
      last_error: job.last_error,
    },
  });
}

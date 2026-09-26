// src/lib/nex-native/intelligence/enqueue-nex-reply.ts
//
// NEX-native · async enqueue path for NEX Assistant replies.
// -----------------------------------------------------------
// Wave 9 · integration: turns the previously-inline `generateNexReply`
// call into a queue enqueue. The API layer accepts the customer message
// synchronously, enqueues the reply job, and returns immediately with a
// `job_id + correlation_id`. A worker (any worker, on any host) picks
// the job up and runs the untouched engine.
//
// Guarantees:
//   · Zero engine change · the engine is invoked identically once the
//     worker leases the job.
//   · Backpressure enforced BEFORE enqueue · per-account + global caps
//     fire with an honest `retry_after`.
//   · Correlation ID travels with the job so an operator can trace
//     enqueue → lease → generation → persist → response.
//   · No hosted-AI fallback anywhere.

import "server-only";
import * as crypto from "node:crypto";
import { shouldAdmitGenerationJob } from "../backpressure";
import {
  enqueueGenerationJob,
  type GenerationJobRow,
} from "../generation-job-service";
import type { NexUuid } from "../types";

export type EnqueueNexReplyResult =
  | {
      admit: true;
      job_id: NexUuid;
      correlation_id: NexUuid;
      queued_at: string;
    }
  | {
      admit: false;
      reason: "per_account_limit" | "global_hard_cap";
      queued_global: number;
      queued_for_account: number;
      retry_after_seconds: number;
    };

export interface EnqueueNexReplyInput {
  conversation_id: NexUuid;
  requester_account_id: NexUuid | null;
  requester_side: "customer" | "business";
  priority?: number;
  expires_in_seconds?: number;
  max_attempts?: number;
  correlation_id?: NexUuid;
}

/**
 * Admit + enqueue a NEX Assistant reply job on the durable queue. Returns
 * immediately. A worker completes the job out-of-band.
 */
export async function enqueueNexReply(
  input: EnqueueNexReplyInput
): Promise<EnqueueNexReplyResult> {
  const admit = await shouldAdmitGenerationJob({ account_id: input.requester_account_id });
  if (!admit.admit) {
    return {
      admit: false,
      reason: admit.reason,
      queued_global: admit.queuedGlobal,
      queued_for_account: admit.queuedForAccount,
      retry_after_seconds: admit.retryAfterSeconds,
    };
  }
  const correlationId = (input.correlation_id ?? crypto.randomUUID()) as NexUuid;
  const job: GenerationJobRow = await enqueueGenerationJob({
    conversation_id: input.conversation_id,
    requester_account_id: input.requester_account_id,
    requester_side: input.requester_side,
    priority: input.priority ?? 100,
    expires_in_seconds: input.expires_in_seconds ?? 300,
    max_attempts: input.max_attempts ?? 2,
    correlation_id: correlationId,
  });
  return {
    admit: true,
    job_id: job.id,
    correlation_id: job.correlation_id,
    queued_at: job.created_at,
  };
}

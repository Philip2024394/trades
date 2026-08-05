// NEX Brain · LLM Retry Worker
//
// Philip 2026-08-06 · Stage 3 production readiness · "no work is lost
// if a provider fails."
//
// When a call in the AI Connection Manager exhausts every provider in
// the chain, the call metadata is persisted to llm_retry_queue. This
// worker drains the queue by re-executing each entry against the
// current provider chain — which may have recovered by now (circuit
// breakers auto-close, rate limits reset, transient outages end).
//
// Cadence: runs as part of the standard 5-stage manager cycle. Not a
// specialist authoring worker — it's a resilience worker.
//
// Exponential backoff: attempts get further apart to give providers
// room to recover. Delay per attempt (in ms):
//   1 → 30s, 2 → 2min, 3 → 10min, 4 → 30min, 5 → 2h
// After max_attempts (default 5), the entry is marked exhausted and
// surfaced on the dashboard for manual triage.

import { brainStore, nowIso } from "../storage";
import { complete } from "../llm";
import type { LlmRetryEntry } from "../types";

const WORKER_ID = `llm-retry@${process.pid}`;

const BACKOFF_MS: number[] = [
  30_000,       // attempt 1 → 30 seconds
  2 * 60_000,   // attempt 2 → 2 minutes
  10 * 60_000,  // attempt 3 → 10 minutes
  30 * 60_000,  // attempt 4 → 30 minutes
  2 * 60 * 60_000, // attempt 5+ → 2 hours
];

export type LlmRetryOutcome = {
  entry_id: string;
  parent_job_id: string | null;
  attempted_at: string;
  succeeded: boolean;
  provider?: string;
  ms?: number;
  tokens?: number;
  error?: string;
  next_attempt_at?: string;
  exhausted?: boolean;
};

// Runs ONE retry attempt. Returns null if nothing was due.
export async function runLlmRetryOnce(): Promise<LlmRetryOutcome | null> {
  const store = brainStore();
  let entry: LlmRetryEntry | null;
  try {
    entry = await store.claimNextLlmRetry(WORKER_ID, 60);
  } catch (err) {
    // Table missing (migration 002 not applied yet) — silently no-op
    if (/relation .*llm_retry_queue/i.test((err as Error).message)) return null;
    if (/does not exist/i.test((err as Error).message)) return null;
    throw err;
  }
  if (!entry) return null;

  const attemptedAt = nowIso();

  // Reconstruct call options + messages from the queue row
  const options = {
    ...(entry.call_options ?? {}),
    requires_capability: entry.requires_capability ?? undefined,
    prefer_provider: entry.prefer_provider ?? undefined,
  } as Parameters<typeof complete>[1];

  try {
    const result = await complete(entry.call_messages as { role: "system" | "user" | "assistant"; content: string }[], options);
    await store.markLlmRetrySucceeded(entry.id, result.provider, {
      text_preview: result.text.slice(0, 400),
      tokens_in: result.tokens_in,
      tokens_out: result.tokens_out,
      ms: result.ms,
      model: result.model,
    });
    await store.insertAudit({
      entity_type: "llm_retry_queue",
      entity_id: entry.id,
      action: "retry-succeeded",
      actor: WORKER_ID,
      before_state: {
        attempts: entry.attempts,
        last_provider: entry.last_provider_tried,
        last_error: entry.last_error,
      },
      after_state: {
        succeeded_provider: result.provider,
        tokens: result.tokens_in + result.tokens_out,
        ms: result.ms,
      },
      notes: `LLM retry succeeded on attempt ${entry.attempts} via ${result.provider}`,
    });
    return {
      entry_id: entry.id,
      parent_job_id: entry.parent_job_id,
      attempted_at: attemptedAt,
      succeeded: true,
      provider: result.provider,
      ms: result.ms,
      tokens: result.tokens_in + result.tokens_out,
    };
  } catch (err) {
    const errMsg = (err as Error).message;
    const attemptsSoFar = entry.attempts; // already incremented by claimNextLlmRetry
    if (attemptsSoFar >= entry.max_attempts) {
      await store.markLlmRetryExhausted(entry.id, errMsg);
      await store.insertAudit({
        entity_type: "llm_retry_queue",
        entity_id: entry.id,
        action: "retry-exhausted",
        actor: WORKER_ID,
        before_state: null,
        after_state: { attempts: attemptsSoFar, error: errMsg.slice(0, 200) },
        notes: `LLM retry exhausted after ${attemptsSoFar}/${entry.max_attempts} attempts`,
      });
      return {
        entry_id: entry.id,
        parent_job_id: entry.parent_job_id,
        attempted_at: attemptedAt,
        succeeded: false,
        error: errMsg,
        exhausted: true,
      };
    }
    const backoffMs = BACKOFF_MS[Math.min(attemptsSoFar - 1, BACKOFF_MS.length - 1)];
    const nextAt = new Date(Date.now() + backoffMs).toISOString();
    await store.markLlmRetryPending(entry.id, nextAt, errMsg, entry.last_provider_tried ?? WORKER_ID);
    return {
      entry_id: entry.id,
      parent_job_id: entry.parent_job_id,
      attempted_at: attemptedAt,
      succeeded: false,
      error: errMsg,
      next_attempt_at: nextAt,
    };
  }
}

// Drains up to N retry entries in a single pass.
export async function drainLlmRetryQueue(max: number = 5): Promise<LlmRetryOutcome[]> {
  const outcomes: LlmRetryOutcome[] = [];
  for (let i = 0; i < max; i += 1) {
    const outcome = await runLlmRetryOnce();
    if (!outcome) break;
    outcomes.push(outcome);
    // Small breath between retries so we don't hammer a recovering provider
    if (outcome.succeeded === false && !outcome.exhausted) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  return outcomes;
}

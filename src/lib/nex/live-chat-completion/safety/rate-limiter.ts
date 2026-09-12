// src/lib/nex/live-chat-completion/safety/rate-limiter.ts
//
// Founder BEGIN Phase 3.7 · Rate limiter as an Input Guardrail.
//
// Token bucket keyed on conversation_id (fallback IP). In-memory ·
// per-process. Defaults: 30 requests / 60s per key. Configurable via env
// NEX_RATE_LIMIT_PER_MIN / NEX_RATE_LIMIT_WINDOW_MS.
//
// Rejects with a polite retry hint. Never blocks legitimate SSE reconnect
// within an existing turn (rate limit fires PER request, and SSE is one
// long request).

import type { InputGuardrail, InputGuardrailVerdict, InputTurn } from "./guardrails";

interface Bucket {
  tokens: number;
  last_refill_ms: number;
}

const _buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 4096;   // cap so a single ip flood can't OOM

const CAPACITY = Number(process.env.NEX_RATE_LIMIT_PER_MIN ?? 30);
const WINDOW_MS = Number(process.env.NEX_RATE_LIMIT_WINDOW_MS ?? 60_000);
const REFILL_PER_MS = CAPACITY / WINDOW_MS;

const HONEST_BLOCK_EN = "You're going a bit fast for me. Give me a few seconds and try again.";
const HONEST_BLOCK_ID = "Terlalu cepat · coba lagi dalam beberapa detik.";

function keyOf(turn: InputTurn): string {
  return turn.conversation_id ?? turn.request_ip ?? "anonymous";
}

function takeToken(key: string): { allowed: boolean; retry_after_seconds: number } {
  const now = Date.now();
  if (_buckets.size >= MAX_BUCKETS && !_buckets.has(key)) {
    // Evict oldest.
    let oldestKey: string | null = null;
    let oldestAt = Infinity;
    for (const [k, v] of _buckets.entries()) if (v.last_refill_ms < oldestAt) { oldestAt = v.last_refill_ms; oldestKey = k; }
    if (oldestKey) _buckets.delete(oldestKey);
  }
  let b = _buckets.get(key);
  if (!b) { b = { tokens: CAPACITY, last_refill_ms: now }; _buckets.set(key, b); }
  const elapsed = now - b.last_refill_ms;
  if (elapsed > 0) {
    b.tokens = Math.min(CAPACITY, b.tokens + elapsed * REFILL_PER_MS);
    b.last_refill_ms = now;
  }
  if (b.tokens >= 1) {
    b.tokens -= 1;
    return { allowed: true, retry_after_seconds: 0 };
  }
  const need = 1 - b.tokens;
  const wait_ms = need / REFILL_PER_MS;
  return { allowed: false, retry_after_seconds: Math.max(1, Math.ceil(wait_ms / 1000)) };
}

export function makeRateLimitGuardrail(): InputGuardrail {
  return {
    name: "rate_limit",
    evaluate(turn: InputTurn): InputGuardrailVerdict {
      const key = keyOf(turn);
      const t = takeToken(key);
      if (t.allowed) return { allow: true };
      return {
        allow: false,
        reason: `rate_limit_exceeded · key=${key} · cap=${CAPACITY}/${WINDOW_MS}ms`,
        block_reply: turn.language === "id" ? HONEST_BLOCK_ID : HONEST_BLOCK_EN,
        category: "rate_limit",
        retry_after_seconds: t.retry_after_seconds,
      };
    },
  };
}

/** Test-only reset. */
export function _resetRateLimiterForTesting(): void { _buckets.clear(); }

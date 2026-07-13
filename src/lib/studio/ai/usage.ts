// Studio AI usage — DB-backed rate limiting + cost/cache telemetry.
//
// Every AI request writes one row. Rate checks run a bounded count
// query against the per-listing hot index. Persisting to Supabase
// (instead of an in-memory Map) means:
//   • Dev restarts don't reset a merchant's quota mid-session.
//   • Vercel / multi-instance deploys share the same counter.
//   • We can eyeball cost + cache-hit rate without instrumenting a
//     separate logger.
//
// The rate model is "how many succeeded-or-attempted calls in the last
// N ms" — we count both `ok` and `error` rows so a merchant can't
// spam the LLM into failing to sneak past the cap.

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type UsageEndpoint =
  | "compose"
  | "mutate"
  | "orchestrate"
  | "publish";

export type UsageStatus =
  | "ok"
  | "rate_limited"
  | "error"
  | "ai_unavailable";

export type UsageLog = {
  listingId: string;
  endpoint: UsageEndpoint;
  status: UsageStatus;
  sectionId?: string | null;
  promptSnippet?: string | null;
  errorCode?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  latencyMs?: number;
};

/** Count rows in the last `windowMs` for a listing+endpoint. Used by
 *  the rate limiter before making an LLM call. */
export async function countRecentUsage(
  listingId: string,
  endpoint: UsageEndpoint,
  windowMs: number
): Promise<number> {
  const since = new Date(Date.now() - windowMs).toISOString();
  const { count, error } = await supabaseAdmin
    .from("studio_ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId)
    .eq("endpoint", endpoint)
    .gte("created_at", since);
  if (error) {
    // Fail-open: if the ledger is unreachable, don't block the merchant.
    // The error surfaces in server logs; the alternative — hard-blocking
    // every merchant when Supabase blips — is worse than a rare over-cap.
    console.warn("studio_ai_usage count failed", error.message);
    return 0;
  }
  return count ?? 0;
}

/** Write a single usage row. Never throws — a logging failure must
 *  never block returning the merchant's response. */
export async function logUsage(row: UsageLog): Promise<void> {
  const payload = {
    listing_id: row.listingId,
    endpoint: row.endpoint,
    status: row.status,
    section_id: row.sectionId ?? null,
    prompt_snippet: row.promptSnippet ? row.promptSnippet.slice(0, 240) : null,
    error_code: row.errorCode ?? null,
    input_tokens: row.inputTokens ?? 0,
    output_tokens: row.outputTokens ?? 0,
    cache_read_tokens: row.cacheReadTokens ?? 0,
    cache_creation_tokens: row.cacheCreationTokens ?? 0,
    latency_ms: row.latencyMs ?? null
  };
  const { error } = await supabaseAdmin
    .from("studio_ai_usage")
    .insert(payload);
  if (error) console.warn("studio_ai_usage insert failed", error.message);
}

/** Rate-limit check + auto-log the rate-limit event. Returns `true`
 *  when the request may proceed, `false` when the merchant is capped.
 *  Callers should return 429 on `false`. */
export async function checkRateAndLog(
  listingId: string,
  endpoint: UsageEndpoint,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const count = await countRecentUsage(listingId, endpoint, windowMs);
  if (count >= limit) {
    await logUsage({ listingId, endpoint, status: "rate_limited" });
    return false;
  }
  return true;
}

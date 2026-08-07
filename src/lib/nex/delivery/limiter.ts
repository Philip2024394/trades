// NEX Delivery Engine · token-bucket rate limiter
//
// Three scopes (spec Philip 2026-08-07): global · provider · domain.
// In-memory MVP · single process. For multi-worker scale-out this
// moves to Redis or a Postgres-backed counter; the interface stays
// identical.

type Bucket = { tokens: number; last_refill_ms: number };

type LimiterConfig = {
  global_per_sec: number;        // 60
  provider_per_sec: number;      // 30
  domain_per_sec: number;        // 10
  burst_multiplier: number;      // 2 · max tokens = per_sec * burst_multiplier
};

const DEFAULTS: LimiterConfig = {
  global_per_sec: Number(process.env.NEX_DELIVERY_GLOBAL_PER_SEC   ?? 60),
  provider_per_sec: Number(process.env.NEX_DELIVERY_PROVIDER_PER_SEC ?? 30),
  domain_per_sec: Number(process.env.NEX_DELIVERY_DOMAIN_PER_SEC   ?? 10),
  burst_multiplier: 2,
};

const buckets = new Map<string, Bucket>();

function refill(b: Bucket, per_sec: number): void {
  const now = Date.now();
  const elapsed = (now - b.last_refill_ms) / 1000;
  const add = elapsed * per_sec;
  b.tokens = Math.min(per_sec * DEFAULTS.burst_multiplier, b.tokens + add);
  b.last_refill_ms = now;
}

function tryTake(key: string, per_sec: number): { ok: true } | { ok: false; retry_after_ms: number } {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) { b = { tokens: per_sec * DEFAULTS.burst_multiplier, last_refill_ms: now }; buckets.set(key, b); }
  refill(b, per_sec);
  if (b.tokens >= 1) { b.tokens -= 1; return { ok: true }; }
  const need = 1 - b.tokens;
  const retry_after_ms = Math.ceil((need / per_sec) * 1000);
  return { ok: false, retry_after_ms };
}

/**
 * Try to acquire ONE send slot across three scopes: global · provider · domain.
 * Returns `ok:false` with a `retry_after_ms` hint if any scope refuses;
 * caller (worker) uses this to back off and retry the batch.
 */
export function tryAcquireSendSlot(provider: string, email: string): { ok: true } | { ok: false; retry_after_ms: number; scope: "global" | "provider" | "domain" } {
  const g = tryTake("global", DEFAULTS.global_per_sec);
  if (!g.ok) return { ok: false, retry_after_ms: g.retry_after_ms, scope: "global" };
  const p = tryTake(`p:${provider}`, DEFAULTS.provider_per_sec);
  if (!p.ok) return { ok: false, retry_after_ms: p.retry_after_ms, scope: "provider" };
  const dom = (email.split("@")[1] ?? "unknown").toLowerCase();
  const d = tryTake(`d:${dom}`, DEFAULTS.domain_per_sec);
  if (!d.ok) return { ok: false, retry_after_ms: d.retry_after_ms, scope: "domain" };
  return { ok: true };
}

export function limiterSnapshot(): Array<{ key: string; tokens: number; per_sec: number }> {
  const out: Array<{ key: string; tokens: number; per_sec: number }> = [];
  for (const [key, b] of buckets.entries()) {
    const per_sec = key === "global"    ? DEFAULTS.global_per_sec
                  : key.startsWith("p:") ? DEFAULTS.provider_per_sec
                  : key.startsWith("d:") ? DEFAULTS.domain_per_sec
                  : DEFAULTS.global_per_sec;
    out.push({ key, tokens: Math.round(b.tokens * 10) / 10, per_sec });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

export function limiterConfig(): LimiterConfig { return DEFAULTS; }

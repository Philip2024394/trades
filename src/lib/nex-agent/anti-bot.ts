// src/lib/nex-agent/anti-bot.ts
//
// Anti-scraping / anti-bot protection for the NEX1 Workstation surface.
// Layered defence · used by API routes to reject bot-shaped requests before
// they hit the orchestrator.
//
// Discipline:
//   - Rate limits are per-IP + per-session · never block a real founder
//   - Every rejection emits a sec.* code · logged for audit
//   - Bot UA signatures are high-precision (curl · python-requests · axios)
//   - Honeypot fields on public forms · bots fill them · humans don't

import { createHash } from "node:crypto";

/** Well-known bot user agents. Never blocks real browsers. */
const BOT_UA_SIGNATURES = [
  /^curl\//i,
  /^wget\//i,
  /^python-requests\//i,
  /^python-urllib\//i,
  /^Java\/\d/i,
  /^Go-http-client\//i,
  /^okhttp\//i,
  /^axios\//i,
  /^node-fetch\//i,
  /^Apache-HttpClient\//i,
  /^Faraday/i,
  /^HttpClient\//i,
  /^Scrapy\//i,
  /HeadlessChrome/i,
  /^PhantomJS\//i,
  /^PostmanRuntime\//i,   // human tool but never a founder in production
];

const KNOWN_LLM_SCRAPERS = [
  /GPTBot/i, /ChatGPT-User/i, /CCBot/i, /anthropic-ai/i, /ClaudeBot/i,
  /Google-Extended/i, /PerplexityBot/i, /Bytespider/i, /Amazonbot/i,
];

export interface RateLimitConfig {
  readonly windowMs: number;
  readonly maxRequests: number;
}

interface BucketState {
  readonly windowStart: number;
  readonly count: number;
}

const buckets = new Map<string, BucketState>();

/** Cap on entries · prevents memory bloat under scraping. */
const BUCKET_LIMIT = 5000;

function pruneBuckets(now: number): void {
  if (buckets.size < BUCKET_LIMIT) return;
  // Drop entries older than 1 hour · then LRU-ish truncate
  const cutoff = now - 60 * 60 * 1000;
  for (const [k, v] of buckets) {
    if (v.windowStart < cutoff) buckets.delete(k);
    if (buckets.size < BUCKET_LIMIT * 0.9) break;
  }
}

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly resetAt: number;
  readonly reason: string | null;
}

export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  pruneBuckets(now);
  const state = buckets.get(key);
  if (!state || now - state.windowStart > config.windowMs) {
    buckets.set(key, { windowStart: now, count: 1 });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs, reason: null };
  }
  if (state.count >= config.maxRequests) {
    return {
      allowed: false, remaining: 0, resetAt: state.windowStart + config.windowMs,
      reason: `sec.rate_limit_exceeded · ${state.count}/${config.maxRequests} in ${config.windowMs}ms`,
    };
  }
  buckets.set(key, { windowStart: state.windowStart, count: state.count + 1 });
  return { allowed: true, remaining: config.maxRequests - state.count - 1, resetAt: state.windowStart + config.windowMs, reason: null };
}

export interface BotDetectionResult {
  readonly isBot: boolean;
  readonly signature: string | null;
  readonly reason: string | null;
}

export function detectBotUA(userAgent: string | null | undefined): BotDetectionResult {
  const ua = String(userAgent ?? "").trim();
  if (!ua) return { isBot: true, signature: "empty-ua", reason: "sec.bot_ua_signature · no user-agent" };
  for (const sig of BOT_UA_SIGNATURES) {
    if (sig.test(ua)) return { isBot: true, signature: sig.source, reason: `sec.bot_ua_signature · matched ${sig.source}` };
  }
  for (const sig of KNOWN_LLM_SCRAPERS) {
    if (sig.test(ua)) return { isBot: true, signature: sig.source, reason: `sec.bot_ua_signature · LLM scraper ${sig.source}` };
  }
  return { isBot: false, signature: null, reason: null };
}

/**
 * Compose a session-scoped rate-limit key. Uses IP + session cookie hash if present.
 */
export function rateLimitKeyFor(req: Request, prefix: string): string {
  const url = new URL(req.url);
  // Cloudflare / Vercel headers · fallback to remote address hint
  const cfIp = req.headers.get("cf-connecting-ip");
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = cfIp || fwd || "unknown-ip";
  const sess = req.headers.get("cookie")?.match(/nex1_sid=([A-Za-z0-9._-]+)/)?.[1] ?? "";
  const hash = createHash("sha256").update(`${prefix}:${ip}:${sess}`).digest("hex").slice(0, 16);
  return hash;
}

/**
 * Honeypot check · if the request body contains a value in the honeypot field,
 * the submitter is a bot (real humans never fill hidden fields).
 */
export function honeypotTriggered(body: Record<string, unknown> | undefined | null): boolean {
  if (!body || typeof body !== "object") return false;
  // Any of these fields being non-empty = bot
  const honeypots = ["website_hp", "url_hp", "email_confirm_hp", "phone_hp"];
  for (const key of honeypots) {
    const v = body[key];
    if (typeof v === "string" && v.length > 0) return true;
  }
  return false;
}

/** Standard security-related response headers · applied on every workstation route. */
export const WORKSTATION_SEC_HEADERS: Record<string, string> = {
  "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet, notranslate, noimageindex",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(self), interest-cohort=()",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
};

// src/lib/nex/discovery/conditional-fetch.ts
//
// UWI · Wave 3.3 · M11 · Conditional GET + freshness index
// Founder-authorised programme.
//
// RFC 7232 conditional GET: sends `If-None-Match` (from cached ETag)
// and `If-Modified-Since` (from cached Last-Modified) so origin servers
// can respond 304 Not Modified and NEX skips body transfer.
//
// Also computes SHA-256 content hash for delta detection when the origin
// does not honour conditional headers (some do not).
//
// Redirect chains bounded (max 5 · founder failure class "redirect_chain_exceeded").

import { createHash } from "node:crypto";
import type { CanonicalUrl, ConditionalFetchOutcome, FreshnessSnapshot } from "./types";
import { canonicalise, tryCanonicalise } from "./url-canonicalisation";

export interface ConditionalFetchConfig {
  max_redirects: number;
  timeout_ms: number;
  max_body_bytes: number;
}

export const DEFAULT_CONDITIONAL_FETCH: ConditionalFetchConfig = {
  max_redirects: 5,
  timeout_ms: 30_000,
  max_body_bytes: 10 * 1024 * 1024, // 10 MB
};

/** In-memory freshness index. In production this backs onto Postgres
 *  (see Wave 4 · integration). For now, in-process Map suffices for
 *  D3 acceptance tests. */
export class FreshnessIndex {
  private store = new Map<string, FreshnessSnapshot>();

  get(url: CanonicalUrl): FreshnessSnapshot | null {
    return this.store.get(url.canonical_key) ?? null;
  }

  set(url: CanonicalUrl, snapshot: FreshnessSnapshot): void {
    this.store.set(url.canonical_key, snapshot);
  }

  clear(): void { this.store.clear(); }
  size(): number { return this.store.size; }
}

export class RedirectChainExceededError extends Error {
  constructor(public readonly chain: readonly CanonicalUrl[]) {
    super(`redirect chain exceeded (${chain.length} hops)`);
    this.name = "RedirectChainExceededError";
  }
}

export class ConditionalFetchTimeoutError extends Error {
  constructor(public readonly url: string, public readonly timeout_ms: number) {
    super(`conditional fetch timeout ${timeout_ms}ms for ${url}`);
    this.name = "ConditionalFetchTimeoutError";
  }
}

/** Perform a conditional GET · returns ConditionalFetchOutcome including
 *  changed flag · redirect chain · updated freshness snapshot. Body is
 *  returned in `bytes` when changed (null on 304 or content-hash unchanged). */
export async function conditionalFetch(
  input_url: string | CanonicalUrl,
  freshness: FreshnessIndex,
  user_agent: string,
  config: ConditionalFetchConfig = DEFAULT_CONDITIONAL_FETCH,
  now_ms: () => number = Date.now,
  raw_fetcher: (url: string, init: RequestInit) => Promise<Response> = fetch,
): Promise<ConditionalFetchOutcome> {
  const t0 = now_ms();
  const start_url = typeof input_url === "string" ? canonicalise(input_url) : input_url;
  const prior = freshness.get(start_url);

  const headers: Record<string, string> = {
    "user-agent": user_agent,
    "accept": "*/*",
    "accept-encoding": "gzip, deflate",
  };
  if (prior?.etag) headers["if-none-match"] = prior.etag;
  if (prior?.last_modified_iso) headers["if-modified-since"] = new Date(prior.last_modified_iso).toUTCString();

  const redirects: CanonicalUrl[] = [];
  let current_url = start_url;

  for (let hop = 0; hop <= config.max_redirects; hop++) {
    let res: Response;
    try {
      res = await raw_fetcher(current_url.normalised, {
        method: "GET",
        headers,
        redirect: "manual", // handle redirect chain explicitly for canonical tracking
        signal: AbortSignal.timeout(config.timeout_ms),
      });
    } catch (e: any) {
      if (e?.name === "TimeoutError" || /timeout/i.test(e?.message ?? "")) {
        throw new ConditionalFetchTimeoutError(current_url.normalised, config.timeout_ms);
      }
      throw e;
    }

    // Extract response headers into a plain object (case-insensitive keys lowercased)
    const respHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => { respHeaders[k.toLowerCase()] = v; });

    // Redirect handling
    if (res.status >= 300 && res.status < 400 && respHeaders["location"]) {
      const next_raw = new URL(respHeaders["location"], current_url.normalised).toString();
      const next_url = tryCanonicalise(next_raw);
      if (!next_url) throw new Error(`unparseable redirect Location: ${respHeaders["location"]}`);
      redirects.push(current_url);
      current_url = next_url;
      if (hop === config.max_redirects) {
        throw new RedirectChainExceededError([...redirects, current_url]);
      }
      continue;
    }

    // 304 Not Modified — return unchanged, keep prior freshness snapshot
    if (res.status === 304 && prior) {
      const updated_snapshot: FreshnessSnapshot = {
        ...prior,
        last_fetched_iso: new Date(now_ms()).toISOString(),
      };
      freshness.set(current_url, updated_snapshot);
      return {
        status: 304,
        changed: false,
        bytes: null,
        headers: respHeaders,
        final_url: current_url,
        redirects,
        freshness_snapshot: updated_snapshot,
        duration_ms: now_ms() - t0,
      };
    }

    // 2xx success · read body (bounded)
    if (res.status >= 200 && res.status < 300) {
      const bodyBuf = await readBodyBounded(res, config.max_body_bytes);
      const content_hash_sha256 = createHash("sha256").update(bodyBuf).digest("hex");
      const server_etag = respHeaders["etag"] ?? null;
      const server_last_modified = respHeaders["last-modified"] ?? null;
      const last_mod_iso = server_last_modified ? new Date(server_last_modified).toISOString() : null;

      // Content-hash unchanged? Some origins don't honour 304 but content is identical.
      const unchanged_by_hash = prior && prior.content_hash === content_hash_sha256;

      const now_iso = new Date(now_ms()).toISOString();
      const updated_snapshot: FreshnessSnapshot = {
        etag: server_etag,
        last_modified_iso: last_mod_iso,
        content_hash: content_hash_sha256,
        first_seen_iso: prior?.first_seen_iso ?? now_iso,
        last_fetched_iso: now_iso,
      };
      freshness.set(current_url, updated_snapshot);

      return {
        status: res.status,
        changed: !unchanged_by_hash,
        bytes: unchanged_by_hash ? null : bodyBuf,
        headers: respHeaders,
        final_url: current_url,
        redirects,
        freshness_snapshot: updated_snapshot,
        duration_ms: now_ms() - t0,
      };
    }

    // Non-2xx / non-304 / non-redirect · surface to caller as-is
    const now_iso = new Date(now_ms()).toISOString();
    return {
      status: res.status,
      changed: false,
      bytes: null,
      headers: respHeaders,
      final_url: current_url,
      redirects,
      freshness_snapshot: prior ?? {
        etag: null,
        last_modified_iso: null,
        content_hash: null,
        first_seen_iso: now_iso,
        last_fetched_iso: now_iso,
      },
      duration_ms: now_ms() - t0,
    };
  }
  throw new Error("unreachable"); // loop always returns/throws
}

async function readBodyBounded(res: Response, max_bytes: number): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) {
    // Fallback path — some environments may not expose the reader
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > max_bytes) return buf.subarray(0, max_bytes);
    return buf;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
      if (total >= max_bytes) {
        try { await reader.cancel(); } catch { /* silent */ }
        break;
      }
    }
  }
  const out = new Uint8Array(Math.min(total, max_bytes));
  let off = 0;
  for (const c of chunks) {
    const remain = max_bytes - off;
    if (remain <= 0) break;
    const take = Math.min(c.length, remain);
    out.set(c.subarray(0, take), off);
    off += take;
  }
  return out;
}

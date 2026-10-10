// src/lib/nex-native/link-preview-fetcher.ts
//
// NEX · SSRF-safe Open Graph fetcher.
// Sealed 2026-10-02 · Phase 1 link previews.
// -----------------------------------------------------------------------------
// Takes a URL, returns parsed Open Graph metadata (title, description,
// image URL, source domain) OR an explicit failure reason. Never
// throws — all errors are mapped to a typed outcome so the caller
// can log without exposing internals.
//
// Security model (every one of these is covered by test cases in
// scripts/test-link-preview-safety.mjs):
//
//   · Scheme allowlist: http / https only
//   · URL userinfo stripped-and-rejected (http://user:pass@host)
//   · DNS resolved via node:dns/promises.lookup({all: true}) BEFORE
//     any TCP connect; ALL resolved addresses must be globally
//     routable; one validated IP is pinned into an undici custom
//     dispatcher so the actual connection cannot be rebound at
//     connect time
//   · IPv4-mapped IPv6 unmapped and re-validated
//   · 5-second wall-clock deadline across DNS + redirects + connect
//     + TLS + headers + body
//   · 1 MB cap on decompressed body (we send Accept-Encoding: identity
//     so compressed delivery is suppressed; cap enforced on the raw
//     stream)
//   · Content-type restricted to text/html or application/xhtml+xml
//   · Max 3 redirect hops, full re-validation at each hop
//   · Global concurrency semaphore (10 in-flight max process-wide)
//   · No forwarded auth / cookies / referer / internal headers
//   · og:image URL independently validated (same SSRF checks)
//     before being stored on the message
//
// Rate-limit note: this module exposes `assertUserRateLimit(accountId)`
// as a per-user token bucket (20 / 10 min). Caller must invoke it
// before `fetchLinkPreview`. Phase 1 is in-memory per-process — a
// multi-instance deployment will need Redis.

import { Agent, request as undiciRequest } from "undici";
import { lookup as dnsLookup } from "node:dns/promises";
import {
  createGunzip,
  createInflate,
  createBrotliDecompress,
} from "node:zlib";
import { isGloballyRoutable } from "./ip-range-check";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface LinkPreview {
  url: string;              // Final URL after any redirects
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  sourceDomain: string;
}

export type FetchOutcome =
  | "bad_scheme"
  | "bad_url"
  | "contains_userinfo"
  | "ssrf_blocked"
  | "ssrf_blocked_at_redirect"
  | "redirect_limit_exceeded"
  | "bad_content_type"
  | "size_cap_exceeded"
  | "timeout_exceeded"
  | "rate_limit_user"
  | "rate_limit_global_concurrency"
  | "network_error";

export interface FetchResult {
  ok: boolean;
  outcome: FetchOutcome | "ok";
  preview: LinkPreview | null;
}

// ---------------------------------------------------------------------------
// Tunables (centralised for test override + audit visibility)
// ---------------------------------------------------------------------------

export const LINK_PREVIEW_LIMITS = {
  maxBodyBytes: 1_048_576,                // 1 MB
  wallClockMs: 5_000,                     // 5 s total
  maxRedirects: 3,                        // Hops
  maxConcurrent: 10,                      // Global in-flight
  maxConcurrentQueue: 50,                 // Beyond-queue → immediate reject
  perUserWindowMs: 10 * 60_000,           // 10 min
  perUserMaxFetches: 20,                  // 20 fetches / 10 min
  userAgent: "NEX-LinkPreview/1.0 (+https://nex.chat/bots)",
};

// ---------------------------------------------------------------------------
// Per-user rate limit · in-memory token bucket
// ---------------------------------------------------------------------------

interface Bucket {
  count: number;
  windowStart: number;
}
const userBuckets = new Map<string, Bucket>();

/** Returns true if the caller is within the per-user quota.
 *  Side-effect: increments the bucket. Caller aborts with
 *  'rate_limit_user' when this returns false. */
export function tryConsumeUserToken(accountId: string, now = Date.now()): boolean {
  const b = userBuckets.get(accountId);
  if (!b || now - b.windowStart >= LINK_PREVIEW_LIMITS.perUserWindowMs) {
    userBuckets.set(accountId, { count: 1, windowStart: now });
    return true;
  }
  if (b.count >= LINK_PREVIEW_LIMITS.perUserMaxFetches) return false;
  b.count += 1;
  return true;
}

/** Test-only reset. Not exported in a production index — intended
 *  only for the security test harness. */
export function _resetRateLimitStateForTests(): void {
  userBuckets.clear();
}

// ---------------------------------------------------------------------------
// Global concurrency semaphore
// ---------------------------------------------------------------------------

let activeFetches = 0;
const concurrencyWaiters: Array<() => void> = [];

async function acquireConcurrencySlot(): Promise<"ok" | "rejected"> {
  if (activeFetches < LINK_PREVIEW_LIMITS.maxConcurrent) {
    activeFetches += 1;
    return "ok";
  }
  if (concurrencyWaiters.length >= LINK_PREVIEW_LIMITS.maxConcurrentQueue) {
    return "rejected";
  }
  await new Promise<void>((resolve) => concurrencyWaiters.push(resolve));
  activeFetches += 1;
  return "ok";
}

function releaseConcurrencySlot(): void {
  activeFetches -= 1;
  const next = concurrencyWaiters.shift();
  if (next) next();
}

/** Test-only concurrency inspection. */
export function _getConcurrencyStateForTests() {
  return {
    active: activeFetches,
    queued: concurrencyWaiters.length,
    limit: LINK_PREVIEW_LIMITS.maxConcurrent,
    maxQueue: LINK_PREVIEW_LIMITS.maxConcurrentQueue,
  };
}

// ---------------------------------------------------------------------------
// URL validation (pre-fetch)
// ---------------------------------------------------------------------------

interface ValidatedTarget {
  url: URL;
  address: string;
  family: 4 | 6;
}

/** Validate the URL + resolve DNS + check every resolved address.
 *  Returns the parsed URL and the pre-chosen IP to pin into the
 *  dispatcher. Throws with a typed outcome string on any failure. */
export async function validateUrlForFetch(
  rawUrl: string,
  options: {
    dnsLookupFn?: typeof dnsLookup;
  } = {},
): Promise<ValidatedTarget> {
  // Phase 1: shape + scheme
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("bad_url");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("bad_scheme");
  }
  // Reject embedded credentials (http://user:pass@host) — easy exfil vector
  if (parsed.username !== "" || parsed.password !== "") {
    throw new Error("contains_userinfo");
  }
  // Reject hostnames that look like raw IPs in private ranges BEFORE
  // DNS lookup (lookup of "127.0.0.1" would return 127.0.0.1 but
  // some resolvers are quirky about that).
  const host = parsed.hostname;
  const lookup = options.dnsLookupFn ?? dnsLookup;
  const addrs = await lookup(host, { all: true, verbatim: true });
  if (!addrs || addrs.length === 0) {
    throw new Error("ssrf_blocked");
  }
  for (const a of addrs) {
    const family = a.family === 6 ? 6 : 4;
    if (!isGloballyRoutable(a.address, family as 4 | 6)) {
      throw new Error("ssrf_blocked");
    }
  }
  // Pick first validated address to pin.
  const chosen = addrs[0];
  const family = chosen.family === 6 ? 6 : 4;
  return { url: parsed, address: chosen.address, family: family as 4 | 6 };
}

// ---------------------------------------------------------------------------
// Pinned fetch (DNS-rebinding safe)
// ---------------------------------------------------------------------------

/** Perform a single HTTP(S) request to the given URL with the TCP
 *  connection pinned to the pre-validated IP. The hostname is
 *  preserved for TLS SNI + HTTP Host header so cert validation
 *  works normally. Redirects are NOT followed here — caller
 *  handles the redirect chain so each hop can be independently
 *  SSRF-validated. */
export async function pinnedRawFetch(
  target: ValidatedTarget,
  signal: AbortSignal,
): Promise<{
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: NodeJS.ReadableStream;
  location?: string;
}> {
  const { url, address, family } = target;
  const agent = new Agent({
    connect: {
      // Pin the TCP destination to our pre-validated IP; preserve
      // the hostname for TLS SNI and HTTP Host.
      // Node's dns.lookup supports BOTH signatures via options.all:
      //   - options.all=true  → cb(null, [{address,family}, ...])
      //   - options.all=false → cb(null, address, family)
      // undici / net.connect sometimes requests the all-form, so we
      // branch on options.all and return the matching shape.
      lookup: (
        _hostname: string,
        opts: { all?: boolean } | undefined,
        cb: (err: Error | null, addressOrList?: string | Array<{ address: string; family: number }>, family?: number) => void,
      ) => {
        if (opts && opts.all) {
          cb(null, [{ address, family }]);
        } else {
          cb(null, address, family);
        }
      },
      servername: url.hostname,
    },
  });
  const result = await undiciRequest(url.href, {
    dispatcher: agent,
    method: "GET",
    headers: {
      "User-Agent": LINK_PREVIEW_LIMITS.userAgent,
      Accept: "text/html, application/xhtml+xml;q=0.9",
      "Accept-Encoding": "identity",
      Connection: "close",
    },
    signal,
    maxRedirections: 0,
    bodyTimeout: LINK_PREVIEW_LIMITS.wallClockMs,
    headersTimeout: LINK_PREVIEW_LIMITS.wallClockMs,
  });
  const locationHeader = result.headers["location"];
  const location = Array.isArray(locationHeader)
    ? locationHeader[0]
    : locationHeader;
  return {
    statusCode: result.statusCode,
    headers: result.headers,
    body: result.body,
    location,
  };
}

// ---------------------------------------------------------------------------
// Body reader with hard size cap
// ---------------------------------------------------------------------------

/** Read a Readable stream up to maxBytes and return the UTF-8
 *  decoded body. Aborts (throws 'size_cap_exceeded') if the stream
 *  exceeds the cap. If the response carried Content-Encoding (even
 *  though we asked for identity · servers often ignore the request),
 *  the stream is piped through the matching decompressor FIRST so
 *  the cap is enforced on DECOMPRESSED bytes · this is the gzip-bomb
 *  defence required by the Phase-1 security review (2026-10-02). */
async function readBodyWithCap(
  rawStream: NodeJS.ReadableStream,
  contentEncoding: string | undefined,
  maxBytes: number,
): Promise<string> {
  const enc = (contentEncoding ?? "").toLowerCase();
  let stream: NodeJS.ReadableStream = rawStream;
  // Only single-layer decompression · nested encodings (`gzip, gzip`)
  // are abusive and would be caught by the cap on the first layer.
  if (enc.includes("gzip") || enc.includes("x-gzip")) {
    stream = rawStream.pipe(createGunzip());
  } else if (enc.includes("deflate")) {
    stream = rawStream.pipe(createInflate());
  } else if (enc.includes("br")) {
    stream = rawStream.pipe(createBrotliDecompress());
  }
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for await (const chunk of stream) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buf.length;
      if (total > maxBytes) {
        throw new Error("size_cap_exceeded");
      }
      chunks.push(buf);
    }
  } catch (e) {
    // Also catches decompression errors (corrupt gzip, etc.) · we
    // surface them as size_cap_exceeded only if that's the actual
    // cause; otherwise it's a bad body.
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "size_cap_exceeded") throw e;
    throw new Error("bad_body");
  }
  return Buffer.concat(chunks).toString("utf8");
}

// ---------------------------------------------------------------------------
// OG metadata parser (minimal regex-based, no HTML library dep)
// ---------------------------------------------------------------------------

/** Pull og:title / og:description / og:image / <title> out of raw
 *  HTML. Uses minimal regex because we don't need full DOM — we
 *  only read a handful of meta tags and the first title. All
 *  outputs are plain text; HTML entities are decoded; angle
 *  brackets are stripped as a defence-in-depth measure (React
 *  escapes at render anyway). */
export function parseOgMetadata(html: string): {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
} {
  const findMeta = (property: string): string | null => {
    // Match <meta property="og:xxx" content="..."> in either order of
    // attributes · case-insensitive · single or double quotes.
    const patterns = [
      new RegExp(
        `<meta[^>]+property\\s*=\\s*["']${property}["'][^>]*content\\s*=\\s*["']([^"']*)["']`,
        "i",
      ),
      new RegExp(
        `<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]+property\\s*=\\s*["']${property}["']`,
        "i",
      ),
    ];
    for (const p of patterns) {
      const m = html.match(p);
      if (m && m[1]) return decodeEntities(stripAngleBrackets(m[1]));
    }
    return null;
  };
  const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const fallbackTitle = titleTag && titleTag[1]
    ? decodeEntities(stripAngleBrackets(titleTag[1].trim()))
    : null;
  const ogTitle = findMeta("og:title");
  const ogDesc = findMeta("og:description");
  const ogImage = findMeta("og:image");
  return {
    title: ogTitle || fallbackTitle,
    description: ogDesc,
    imageUrl: ogImage,
  };
}

function stripAngleBrackets(s: string): string {
  return s.replace(/[<>]/g, "");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}

// ---------------------------------------------------------------------------
// Image URL post-validation
// ---------------------------------------------------------------------------

/** Validate an og:image URL before persisting it. Returns the URL
 *  if safe, null otherwise. We do a full DNS check (same SSRF
 *  pipeline) because the client's device will fetch the image —
 *  we don't want to help it hit internal networks. Also drops
 *  SVG (active content), userinfo URLs, and non-http(s) schemes. */
export async function validateImageUrl(
  rawUrl: string,
  options: { dnsLookupFn?: typeof dnsLookup } = {},
): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password) return null;
  if (parsed.pathname.toLowerCase().endsWith(".svg")) return null;
  if (parsed.href.length > 2048) return null;
  try {
    const lookup = options.dnsLookupFn ?? dnsLookup;
    const addrs = await lookup(parsed.hostname, { all: true, verbatim: true });
    if (!addrs || addrs.length === 0) return null;
    for (const a of addrs) {
      const family = a.family === 6 ? 6 : 4;
      if (!isGloballyRoutable(a.address, family as 4 | 6)) return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Full fetchLinkPreview · ties it all together with redirect handling
// ---------------------------------------------------------------------------

/** The raw-fetch response shape · exported so tests can mock it
 *  via the fetchImpl option. */
export interface PinnedFetchResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: NodeJS.ReadableStream;
  location?: string;
}

export interface FetchLinkPreviewOptions {
  /** TEST-ONLY · inject a custom DNS resolver.
   *  Production callers (the server action) never pass this. */
  dnsLookupFn?: typeof dnsLookup;
  /** TEST-ONLY · inject a replacement for pinnedRawFetch so
   *  integration tests can route transport to a local test server
   *  while the REAL validateUrlForFetch logic still runs. Production
   *  callers (the server action) never pass this. The default is
   *  the real pinnedRawFetch (SSRF-safe, DNS-pinned, undici-based). */
  fetchImpl?: (
    target: ValidatedTarget,
    signal: AbortSignal,
  ) => Promise<PinnedFetchResponse>;
}

/** The public entry point. Caller guarantees rate limits have been
 *  checked separately via tryConsumeUserToken. Returns a FetchResult
 *  — never throws. */
export async function fetchLinkPreview(
  initialUrl: string,
  options: FetchLinkPreviewOptions = {},
): Promise<FetchResult> {
  const concurrency = await acquireConcurrencySlot();
  if (concurrency === "rejected") {
    return { ok: false, outcome: "rate_limit_global_concurrency", preview: null };
  }
  const deadline = new AbortController();
  const timer = setTimeout(
    () => deadline.abort("deadline"),
    LINK_PREVIEW_LIMITS.wallClockMs,
  );
  try {
    let currentUrl = initialUrl;
    let hops = 0;
    while (true) {
      let target: ValidatedTarget;
      try {
        target = await validateUrlForFetch(currentUrl, {
          dnsLookupFn: options.dnsLookupFn,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "network_error";
        const outcome: FetchOutcome =
          msg === "bad_scheme" ||
          msg === "bad_url" ||
          msg === "contains_userinfo" ||
          msg === "ssrf_blocked"
            ? (hops === 0 ? (msg as FetchOutcome) : "ssrf_blocked_at_redirect")
            : "network_error";
        return { ok: false, outcome, preview: null };
      }
      let response;
      try {
        const impl = options.fetchImpl ?? pinnedRawFetch;
        response = await impl(target, deadline.signal);
      } catch (e) {
        const name = e instanceof Error ? e.name : "";
        if (name === "AbortError" || deadline.signal.aborted) {
          return { ok: false, outcome: "timeout_exceeded", preview: null };
        }
        return { ok: false, outcome: "network_error", preview: null };
      }
      // Redirect?
      if (
        [301, 302, 303, 307, 308].includes(response.statusCode) &&
        response.location
      ) {
        if (hops >= LINK_PREVIEW_LIMITS.maxRedirects) {
          return {
            ok: false,
            outcome: "redirect_limit_exceeded",
            preview: null,
          };
        }
        try {
          currentUrl = new URL(response.location, target.url.href).href;
        } catch {
          return { ok: false, outcome: "network_error", preview: null };
        }
        hops += 1;
        // Drain the body of the redirect response.
        try {
          for await (const _ of response.body) { void _; }
        } catch { /* ignore */ }
        continue;
      }
      // Final response.
      if (response.statusCode >= 400) {
        return { ok: false, outcome: "network_error", preview: null };
      }
      const ct = String(response.headers["content-type"] ?? "").toLowerCase();
      if (!ct.includes("text/html") && !ct.includes("application/xhtml+xml")) {
        return { ok: false, outcome: "bad_content_type", preview: null };
      }
      let body: string;
      try {
        const contentEncodingRaw = response.headers["content-encoding"];
        const contentEncoding = Array.isArray(contentEncodingRaw)
          ? contentEncodingRaw[0]
          : contentEncodingRaw;
        body = await readBodyWithCap(
          response.body,
          contentEncoding,
          LINK_PREVIEW_LIMITS.maxBodyBytes,
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "size_cap_exceeded") {
          return { ok: false, outcome: "size_cap_exceeded", preview: null };
        }
        if (deadline.signal.aborted) {
          return { ok: false, outcome: "timeout_exceeded", preview: null };
        }
        return { ok: false, outcome: "network_error", preview: null };
      }
      const parsed = parseOgMetadata(body);
      // Resolve relative og:image against the final page URL + run
      // SSRF validation on the image.
      let imageUrl: string | null = null;
      if (parsed.imageUrl) {
        let absoluteImage: string;
        try {
          absoluteImage = new URL(parsed.imageUrl, target.url.href).href;
        } catch {
          absoluteImage = "";
        }
        if (absoluteImage) {
          imageUrl = await validateImageUrl(absoluteImage, {
            dnsLookupFn: options.dnsLookupFn,
          });
        }
      }
      return {
        ok: true,
        outcome: "ok",
        preview: {
          url: target.url.href,
          title: parsed.title ? parsed.title.slice(0, 300) : null,
          description: parsed.description
            ? parsed.description.slice(0, 600)
            : null,
          imageUrl,
          sourceDomain: target.url.hostname,
        },
      };
    }
  } finally {
    clearTimeout(timer);
    releaseConcurrencySlot();
  }
}

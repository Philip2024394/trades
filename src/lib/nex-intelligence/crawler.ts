// WO-INTELLIGENCE-01 · Broker-gated crawler.
//
// Every fetch:
//   1. requires a signed, non-expired manifest (verified once per call)
//   2. verifies the request against a matching manifest entry
//   3. checks rate limit
//   4. runs real HTTP GET (node:https) — GET-only, no POST/PUT/DELETE
//   5. persists a CrawlerAuditRecord regardless of outcome
//   6. on success, computes content hash, builds SourceRecord, persists it
//
// The crawler ONLY consumes URLs it can prove are in the signed manifest.
// It NEVER writes to disk outside its designated persistence collections.
// It NEVER opens files. It NEVER modifies substrate.

import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { URL } from "node:url";
import { randomUUID } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import { checkCrawlerRequest, verifyCrawlerManifest } from "./crawler-manifest";
import { provenanceChainHash, sha256Hex } from "./provenance";
import type { CrawlerAuditRecord, CrawlerManifest, SourceRecord } from "./types";

export interface CrawlerFetchInput {
  readonly manifest: CrawlerManifest;
  /** Test-only. Overrides the compiled-in attestation trust root. */
  readonly trusted_attestation_keys?: readonly string[];
  readonly url: string;                               // full URL including query
  readonly method: "GET";
  /** Query predicates the caller intends — must all be in the entry's allowlist. */
  readonly query_predicates?: readonly string[];
  /** Categories the caller intends — must all be in the entry's allowlist. */
  readonly match_categories?: readonly string[];
  readonly max_response_bytes?: number;               // hard cap (default 5 MiB)
  readonly timeout_ms?: number;                       // default 15s
  /** Test-only. If provided, the crawler uses this in-memory rate tracker
   *  instead of the module-level one. */
  readonly _rate_tracker?: RateTracker;
  /** Test-only. Override the actual HTTP request implementation so unit
   *  tests can supply captured Atom bytes without network I/O. */
  readonly _http_override?: HttpRequestFn;
}

export type CrawlerFetchResult =
  | { readonly ok: true; readonly source: SourceRecord; readonly audit: CrawlerAuditRecord }
  | {
      readonly ok: false;
      readonly reason_code: CrawlerAuditRecord["outcome"];
      readonly reason: string;
      readonly audit: CrawlerAuditRecord;
    };

// ── Rate tracker ────────────────────────────────────────────────────────

export interface RateTracker {
  recordRequest(manifest_entry_id: string, atTimeMs: number): void;
  countLastMinute(manifest_entry_id: string, atTimeMs: number): number;
}

class InMemoryRateTracker implements RateTracker {
  private hits = new Map<string, number[]>();
  recordRequest(id: string, atTimeMs: number): void {
    const arr = this.hits.get(id) ?? [];
    arr.push(atTimeMs);
    this.hits.set(id, arr);
  }
  countLastMinute(id: string, atTimeMs: number): number {
    const cutoff = atTimeMs - 60_000;
    const arr = (this.hits.get(id) ?? []).filter((t) => t >= cutoff);
    this.hits.set(id, arr);
    return arr.length;
  }
}

const MODULE_RATE_TRACKER: RateTracker = new InMemoryRateTracker();

// ── HTTP override type for tests ────────────────────────────────────────

export type HttpRequestFn = (input: {
  readonly url: string;
  readonly method: "GET";
  readonly timeout_ms: number;
  readonly max_response_bytes: number;
}) => Promise<{ readonly status: number; readonly headers: Record<string, string>; readonly body: Buffer }>;

// ── Real HTTP GET (node stdlib) ─────────────────────────────────────────

async function realHttpGet(input: {
  url: string; method: "GET"; timeout_ms: number; max_response_bytes: number;
}): Promise<{ status: number; headers: Record<string, string>; body: Buffer }> {
  const u = new URL(input.url);
  const isHttps = u.protocol === "https:";
  const requestFn = isHttps ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const req = requestFn(
      {
        method: "GET",
        hostname: u.hostname,
        port: u.port ? Number(u.port) : (isHttps ? 443 : 80),
        path: u.pathname + u.search,
        timeout: input.timeout_ms,
        headers: {
          "User-Agent": "NEX-Intelligence-Crawler/0.1 (+arXiv research; contact via NEX WO-INTELLIGENCE-01)",
          "Accept": "application/atom+xml, application/xml, text/xml;q=0.9",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let total = 0;
        res.on("data", (c: Buffer) => {
          total += c.length;
          if (total > input.max_response_bytes) {
            res.destroy(new Error(`response exceeded ${input.max_response_bytes} bytes`));
            return;
          }
          chunks.push(c);
        });
        res.on("end", () => {
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (typeof v === "string") headers[k.toLowerCase()] = v;
            else if (Array.isArray(v)) headers[k.toLowerCase()] = v.join(", ");
          }
          resolve({ status: res.statusCode ?? 0, headers, body: Buffer.concat(chunks) });
        });
        res.on("error", reject);
      },
    );
    req.on("timeout", () => { req.destroy(new Error("request timeout")); });
    req.on("error", reject);
    req.end();
  });
}

// ── Main entry point ────────────────────────────────────────────────────

export async function crawlerFetch(input: CrawlerFetchInput): Promise<CrawlerFetchResult> {
  const attemptedAt = new Date().toISOString();
  const rate = input._rate_tracker ?? MODULE_RATE_TRACKER;

  // 1. Manifest signature check
  if (!verifyCrawlerManifest(input.manifest, input.trusted_attestation_keys)) {
    const audit: CrawlerAuditRecord = {
      record_type: "NEX_INTELLIGENCE_CRAWLER_AUDIT",
      audit_id: `crawler-audit-${randomUUID()}`,
      attempted_at: attemptedAt,
      manifest_entry_id: null,
      attempted_url: input.url,
      attempted_method: input.method,
      outcome: "REFUSED_MANIFEST_INVALID",
      refusal_reason: "manifest attestation signature does not verify",
      response_status: null,
    };
    await persistAudit(audit);
    return { ok: false, reason_code: "REFUSED_MANIFEST_INVALID", reason: audit.refusal_reason!, audit };
  }

  // 2. Method — enforce GET-only at the type + runtime level
  if (input.method !== "GET") {
    const audit: CrawlerAuditRecord = {
      record_type: "NEX_INTELLIGENCE_CRAWLER_AUDIT",
      audit_id: `crawler-audit-${randomUUID()}`,
      attempted_at: attemptedAt,
      manifest_entry_id: null,
      attempted_url: input.url,
      attempted_method: input.method as string,
      outcome: "REFUSED_UNAUTHORISED_METHOD",
      refusal_reason: "crawler is GET-only",
      response_status: null,
    };
    await persistAudit(audit);
    return { ok: false, reason_code: "REFUSED_UNAUTHORISED_METHOD", reason: audit.refusal_reason!, audit };
  }

  // 3. Parse URL and match against manifest
  let parsed: URL;
  try { parsed = new URL(input.url); }
  catch {
    const audit: CrawlerAuditRecord = {
      record_type: "NEX_INTELLIGENCE_CRAWLER_AUDIT",
      audit_id: `crawler-audit-${randomUUID()}`,
      attempted_at: attemptedAt,
      manifest_entry_id: null,
      attempted_url: input.url,
      attempted_method: input.method,
      outcome: "REFUSED_UNAUTHORISED_HOST",
      refusal_reason: "malformed URL",
      response_status: null,
    };
    await persistAudit(audit);
    return { ok: false, reason_code: "REFUSED_UNAUTHORISED_HOST", reason: audit.refusal_reason!, audit };
  }

  const check = checkCrawlerRequest(input.manifest, {
    host: parsed.hostname,
    path: parsed.pathname,
    method: input.method,
    queryPredicates: input.query_predicates,
    matchCategories: input.match_categories,
  });

  if (!check.ok) {
    const audit: CrawlerAuditRecord = {
      record_type: "NEX_INTELLIGENCE_CRAWLER_AUDIT",
      audit_id: `crawler-audit-${randomUUID()}`,
      attempted_at: attemptedAt,
      manifest_entry_id: null,
      attempted_url: input.url,
      attempted_method: input.method,
      outcome: check.reason_code === "REFUSED_ENTRY_EXPIRED" ? "REFUSED_MANIFEST_INVALID" : check.reason_code,
      refusal_reason: check.reason,
      response_status: null,
    };
    await persistAudit(audit);
    return { ok: false, reason_code: audit.outcome, reason: check.reason, audit };
  }

  // 4. Rate limit
  const nowMs = Date.now();
  const count = rate.countLastMinute(check.entry.manifest_entry_id, nowMs);
  if (count >= check.entry.rate_limit_requests_per_minute) {
    const audit: CrawlerAuditRecord = {
      record_type: "NEX_INTELLIGENCE_CRAWLER_AUDIT",
      audit_id: `crawler-audit-${randomUUID()}`,
      attempted_at: attemptedAt,
      manifest_entry_id: check.entry.manifest_entry_id,
      attempted_url: input.url,
      attempted_method: input.method,
      outcome: "REFUSED_RATE_LIMIT",
      refusal_reason: `rate limit exceeded: ${count}/${check.entry.rate_limit_requests_per_minute} per minute`,
      response_status: null,
    };
    await persistAudit(audit);
    return { ok: false, reason_code: "REFUSED_RATE_LIMIT", reason: audit.refusal_reason!, audit };
  }
  rate.recordRequest(check.entry.manifest_entry_id, nowMs);

  // 5. Perform HTTP GET
  const httpFn = input._http_override ?? realHttpGet;
  const maxBytes = input.max_response_bytes ?? 5 * 1024 * 1024;
  const timeoutMs = input.timeout_ms ?? 15_000;
  let response: { status: number; headers: Record<string, string>; body: Buffer };
  try {
    response = await httpFn({ url: input.url, method: "GET", timeout_ms: timeoutMs, max_response_bytes: maxBytes });
  } catch (err) {
    const audit: CrawlerAuditRecord = {
      record_type: "NEX_INTELLIGENCE_CRAWLER_AUDIT",
      audit_id: `crawler-audit-${randomUUID()}`,
      attempted_at: attemptedAt,
      manifest_entry_id: check.entry.manifest_entry_id,
      attempted_url: input.url,
      attempted_method: input.method,
      outcome: "PERMITTED_BUT_HTTP_ERROR",
      refusal_reason: (err as Error).message,
      response_status: null,
    };
    await persistAudit(audit);
    return { ok: false, reason_code: "PERMITTED_BUT_HTTP_ERROR", reason: audit.refusal_reason!, audit };
  }

  if (response.status < 200 || response.status >= 300) {
    const audit: CrawlerAuditRecord = {
      record_type: "NEX_INTELLIGENCE_CRAWLER_AUDIT",
      audit_id: `crawler-audit-${randomUUID()}`,
      attempted_at: attemptedAt,
      manifest_entry_id: check.entry.manifest_entry_id,
      attempted_url: input.url,
      attempted_method: input.method,
      outcome: "PERMITTED_BUT_HTTP_ERROR",
      refusal_reason: `HTTP ${response.status}`,
      response_status: response.status,
    };
    await persistAudit(audit);
    return { ok: false, reason_code: "PERMITTED_BUT_HTTP_ERROR", reason: audit.refusal_reason!, audit };
  }

  // 6. Build SourceRecord + audit
  const contentHash = sha256Hex(response.body);
  const source: SourceRecord = {
    record_type: "NEX_INTELLIGENCE_SOURCE",
    source_id: `intel-source-${contentHash.slice(0, 12)}-${randomUUID()}`,
    crawler_manifest_entry_id: check.entry.manifest_entry_id,
    fetched_at: attemptedAt,
    fetch_url: input.url,
    fetch_method: "GET",
    response_status: response.status,
    content_hash_sha256: contentHash,
    content_bytes: response.body.length,
    content_type: response.headers["content-type"] ?? "application/octet-stream",
    raw_content_ref: `inline:base64:${response.body.toString("base64")}`,
    provenance_chain_hash: "",   // filled next
  };
  const chained: SourceRecord = { ...source, provenance_chain_hash: provenanceChainHash(source, []) };
  await getStorage().save(COLLECTIONS.nex_intelligence_sources, chained);

  const audit: CrawlerAuditRecord = {
    record_type: "NEX_INTELLIGENCE_CRAWLER_AUDIT",
    audit_id: `crawler-audit-${randomUUID()}`,
    attempted_at: attemptedAt,
    manifest_entry_id: check.entry.manifest_entry_id,
    attempted_url: input.url,
    attempted_method: input.method,
    outcome: "PERMITTED",
    refusal_reason: null,
    response_status: response.status,
  };
  await persistAudit(audit);
  return { ok: true, source: chained, audit };
}

async function persistAudit(audit: CrawlerAuditRecord): Promise<void> {
  await getStorage().save(COLLECTIONS.nex_intelligence_crawler_audit, audit);
}

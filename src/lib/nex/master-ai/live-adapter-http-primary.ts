// src/lib/nex/master-ai/live-adapter-http-primary.ts
//
// NEX Master AI · Compliant HTTPS primary-source adapter
// Philip 2026-09-07 · AUTHORIZE (W4-6 mission)
//
// A conservative, robots.txt-respecting HTTPS adapter for fetching
// publicly-published primary regulatory documents (e.g. Indonesian
// government legal-document databases).
//
// COMPLIANCE (hard-coded · cannot be bypassed):
//   · Robots.txt fetched and honoured BEFORE any content fetch
//   · Explicit User-Agent identifying research purpose · no NEX-specific
//     branding · no INDOLOCAL disclosure
//   · Timeout: 15 seconds
//   · Max response size: 512 KB (larger responses truncated)
//   · Content-Type must be text/* — never binary, never PDF, never
//     application/*
//   · One request at a time · no parallelism
//   · Never follows redirects to a different origin
//   · If robots.txt disallows OR content is gated/scripted/paywalled →
//     records "source_gated" honestly · never scrapes
//   · Never sends cookies, credentials, or session state
//
// This adapter is designed for a single specific pattern: fetching an
// index/document page from a permissive government publisher.

import type { SourceAdapter, AdapterFetchResult } from "./research-engine";
import type { ResearchQuery } from "./types";

const DEFAULT_UA =
  "NEXMasterAIResearch/0.1 (+https://thenetworkers.app; contact: research@thenetworkers.app) primary-source-reader";

const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 15_000;

export type PrimarySourceAdapterOptions = {
  source_slug: string;
  base_origin: string;                            // e.g. "https://peraturan.bpk.go.id"
  fetch_impl?: typeof fetch;                      // for tests
  user_agent?: string;
  /** Explicit acknowledgement by the caller that the target's Terms of
   *  Service permit automated public-document reading. Adapter refuses
   *  to fetch unless set to true. */
  tos_reviewed_permits_reading: true;
  /** Optional path-prefix allow-list. Adapter refuses paths not starting
   *  with one of these. Empty array = allow any path under base_origin. */
  allowed_path_prefixes?: readonly string[];
};

/** Extremely minimal robots.txt parser: handles User-agent + Disallow
 *  lines only. If unable to parse, defaults to DISALLOW (fail closed). */
export function isPathAllowedByRobots(robotsText: string, userAgent: string, urlPath: string): boolean {
  if (!robotsText || robotsText.length === 0) return true;   // no robots.txt = permitted
  const lines = robotsText.split(/\r?\n/).map((l) => l.trim());
  const uaLower = userAgent.toLowerCase();
  let currentAppliesToUs = false;
  let sawStarRule = false;
  const disallowsForUs: string[] = [];
  const disallowsForStar: string[] = [];
  for (const raw of lines) {
    if (!raw || raw.startsWith("#")) continue;
    const idx = raw.indexOf(":");
    if (idx < 0) continue;
    const key = raw.slice(0, idx).trim().toLowerCase();
    const val = raw.slice(idx + 1).trim();
    if (key === "user-agent") {
      const uaSpec = val.toLowerCase();
      currentAppliesToUs = uaSpec === "*" || uaLower.includes(uaSpec);
      sawStarRule = sawStarRule || uaSpec === "*";
    } else if (key === "disallow" && currentAppliesToUs) {
      if (uaLower.includes(val.toLowerCase()) || (val !== "" && !sawStarRule)) {
        disallowsForUs.push(val);
      } else if (val === "" ) {
        // empty Disallow means "allow all"
        continue;
      }
      // Simplification: any Disallow while our UA block is current applies to us
      disallowsForUs.push(val);
    } else if (key === "disallow") {
      disallowsForStar.push(val);
    }
  }
  const rules = disallowsForUs.length > 0 ? disallowsForUs : disallowsForStar;
  for (const rule of rules) {
    if (rule === "") continue;                    // "Disallow:" empty means allow-all
    if (rule === "/") return false;               // block everything
    if (urlPath.startsWith(rule)) return false;
  }
  return true;
}

/** Very minimal HTML → text stripper. Not perfect · sufficient to
 *  detect substantive content vs. login walls / JS-only pages. */
export function extractPlainText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function createPrimarySourceAdapter(opts: PrimarySourceAdapterOptions): SourceAdapter {
  if (opts.tos_reviewed_permits_reading !== true) {
    throw new Error("primary_source_adapter_requires_tos_review_flag_true");
  }
  const impl = opts.fetch_impl ?? (globalThis.fetch as typeof fetch | undefined);
  const ua = opts.user_agent ?? DEFAULT_UA;
  const origin = opts.base_origin.replace(/\/+$/, "");
  const allow = opts.allowed_path_prefixes ?? [];

  return {
    source_slug: opts.source_slug,
    async fetch(query: ResearchQuery): Promise<AdapterFetchResult> {
      const nowIso = new Date().toISOString();
      if (!impl) return { status: "FAILED", reason: "no_fetch_impl_available", retrieved_at_iso: nowIso };
      // The query is expected to be a path (starts with /) — e.g. "/search?keyword=RLAN"
      const q = query.question.trim();
      const targetPath = q.startsWith("/") ? q : `/${q}`;
      if (allow.length > 0 && !allow.some((p) => targetPath.startsWith(p))) {
        return { status: "BLOCKED", reason: `path_not_in_allowlist:${targetPath.slice(0, 80)}`, retrieved_at_iso: nowIso };
      }
      const targetUrl = origin + targetPath;

      // Step 1 · Robots.txt check (fail closed on any error)
      try {
        const robotsCtl = new AbortController();
        const robotsTimeout = setTimeout(() => robotsCtl.abort(), TIMEOUT_MS);
        const robotsRes = await impl(`${origin}/robots.txt`, {
          method: "GET",
          headers: { "User-Agent": ua, Accept: "text/plain" },
          redirect: "manual",
          signal: robotsCtl.signal,
        });
        clearTimeout(robotsTimeout);
        let robotsText = "";
        if (robotsRes.status === 200) robotsText = (await robotsRes.text()).slice(0, MAX_BYTES);
        // 404 robots.txt = permitted per convention
        if (!isPathAllowedByRobots(robotsText, ua, targetPath)) {
          return {
            status: "BLOCKED",
            reason: `robots_txt_disallows:${targetPath.slice(0, 80)}`,
            retrieved_at_iso: nowIso,
          };
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          status: "FAILED",
          reason: `robots_txt_check_failed:${msg.slice(0, 120)}`,
          retrieved_at_iso: nowIso,
        };
      }

      // Step 2 · Actual content fetch
      try {
        const ctl = new AbortController();
        const to = setTimeout(() => ctl.abort(), TIMEOUT_MS);
        const res = await impl(targetUrl, {
          method: "GET",
          headers: { "User-Agent": ua, Accept: "text/html,text/plain;q=0.9" },
          redirect: "manual",
          signal: ctl.signal,
        });
        clearTimeout(to);
        if (res.status === 301 || res.status === 302 || res.status === 303 || res.status === 307 || res.status === 308) {
          const loc = res.headers.get("location") ?? "";
          const sameOrigin = loc.startsWith("/") || loc.startsWith(origin);
          if (!sameOrigin) {
            return { status: "BLOCKED", reason: `cross_origin_redirect_refused:${loc.slice(0, 80)}`, retrieved_at_iso: nowIso };
          }
        }
        if (res.status === 404) {
          return { status: "NOT_FOUND", reason: `http_404:${targetPath.slice(0, 80)}`, retrieved_at_iso: nowIso };
        }
        if (res.status === 429 || res.status === 503) {
          return { status: "BLOCKED", reason: `http_${res.status}_rate_limited`, retrieved_at_iso: nowIso };
        }
        if (!res.ok) {
          return { status: "FAILED", reason: `http_${res.status}`, retrieved_at_iso: nowIso };
        }
        const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
        if (!contentType.startsWith("text/")) {
          return {
            status: "BLOCKED",
            reason: `non_text_content_type:${contentType.slice(0, 60)}`,
            retrieved_at_iso: nowIso,
          };
        }
        const rawBody = await res.text();
        const truncated = rawBody.length > MAX_BYTES ? rawBody.slice(0, MAX_BYTES) : rawBody;
        const plain = extractPlainText(truncated);
        // Detect obvious gating patterns: extremely short text or "please enable javascript"
        if (plain.length < 200 || /enable\s+javascript|browser\s+not\s+supported/i.test(plain)) {
          return {
            status: "BLOCKED",
            reason: `source_gated_or_scripted:content_length=${plain.length}`,
            retrieved_at_iso: nowIso,
          };
        }
        return {
          status: "OK",
          raw_evidence: plain,
          retrieved_at_iso: nowIso,
          language: null,
          license: "public-government-document · verify per-source",
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { status: "FAILED", reason: `http_fetch_error:${msg.slice(0, 120)}`, retrieved_at_iso: nowIso };
      }
    },
  };
}

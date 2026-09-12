// src/lib/nex/master-ai/live-adapter-wikipedia.ts
//
// NEX Master AI Engineer · Wave 4 · W4-A · Live Wikipedia REST adapter
// Philip 2026-09-07 · AUTHORIZE (Wave-4 continuous mission)
//
// FIRST LEGITIMATE LIVE SOURCE. Targets Wikipedia's public REST API:
//   https://en.wikipedia.org/api/rest_v1/page/summary/{title}
//
// LEGITIMACY:
//   · Public API · no auth required
//   · CC-BY-SA 3.0 content · attribution recorded in license field
//   · Wikimedia UA policy strictly required · we set descriptive UA
//   · Rate policy conservative (30 req/min) even though Wikimedia
//     allows ~200 req/s per IP
//   · Respects HTTP 429 / 503 by returning BLOCKED (no retry loop)
//   · Only READS · never writes · never bypasses paywalls/CAPTCHA
//
// PRESERVATION:
//   · Adapter alone cannot bypass the gateway · it exposes only
//     `fetch(query)` and must be registered through registerAdapter.
//   · Tests inject a stub fetch to avoid touching the real network.
//   · Auto-registration is off unless MASTER_AI_ENABLE_LIVE_WIKIPEDIA=1.

import type { SourceAdapter, AdapterFetchResult } from "./research-engine";
import { registerAdapter, registerSource, getSource } from "./research-engine";
import { setPolicy, currentPolicy } from "./cost-intelligence";
import type { ResearchQuery } from "./types";

export const WIKIPEDIA_SOURCE_SLUG = "wikipedia_en_summary";

const DEFAULT_UA =
  "NEXMasterAI/0.1 (+https://thenetworkers.app; contact: research@thenetworkers.app) master-ai-research-agent";
const DEFAULT_BASE = "https://en.wikipedia.org/api/rest_v1/page/summary/";

export type WikipediaAdapterOptions = {
  /** Optional stub fetch for tests. Defaults to globalThis.fetch. */
  fetch_impl?: typeof fetch;
  /** Optional base URL override for tests OR for a different language variant. */
  base_url?: string;
  /** Optional user-agent override. */
  user_agent?: string;
  /** Optional source_slug override for language variants (e.g. wikipedia_id_summary). */
  source_slug?: string;
};

/** Extracts a page title from the query question. Prefers the first
 *  quoted string, else the whole question stripped of trailing punctuation.
 *  Preserves internal dots that are part of the title (e.g. IEEE 802.11s,
 *  Guifi.net) — strips only sentence-level punctuation ?, !, ,, ;, : and
 *  trailing periods. */
export function extractTitleFromQuery(question: string): string {
  const quoted = question.match(/"([^"]{2,})"/);
  if (quoted) return quoted[1].trim();
  // Strip only ? ! , ; : and any TRAILING period · keep internal dots
  return question.replace(/[?!,;:]/g, "").replace(/\.+\s*$/, "").trim();
}

export function createWikipediaAdapter(opts?: WikipediaAdapterOptions): SourceAdapter {
  const impl = opts?.fetch_impl ?? (globalThis.fetch as typeof fetch | undefined);
  const base = opts?.base_url ?? DEFAULT_BASE;
  const ua = opts?.user_agent ?? DEFAULT_UA;

  const source_slug = opts?.source_slug ?? WIKIPEDIA_SOURCE_SLUG;
  return {
    source_slug,
    async fetch(query: ResearchQuery): Promise<AdapterFetchResult> {
      const nowIso = new Date().toISOString();
      if (!impl) return { status: "FAILED", reason: "no_fetch_impl_available", retrieved_at_iso: nowIso };
      const title = extractTitleFromQuery(query.question);
      if (!title || title.length < 2) return { status: "FAILED", reason: "empty_title_from_question", retrieved_at_iso: nowIso };
      const url = base + encodeURIComponent(title.replace(/\s+/g, "_"));
      try {
        const res = await impl(url, {
          method: "GET",
          headers: { "User-Agent": ua, Accept: "application/json" },
          redirect: "follow",
        });
        if (res.status === 404) {
          return { status: "NOT_FOUND", reason: `wikipedia_404_no_article_for:${title}`, retrieved_at_iso: nowIso };
        }
        if (res.status === 429 || res.status === 503) {
          return { status: "BLOCKED", reason: `wikipedia_rate_limited:${res.status}`, retrieved_at_iso: nowIso };
        }
        if (!res.ok) {
          return { status: "FAILED", reason: `wikipedia_http_${res.status}`, retrieved_at_iso: nowIso };
        }
        const text = await res.text();
        return {
          status: "OK",
          raw_evidence: text,
          retrieved_at_iso: nowIso,
          language: "en",
          license: "CC-BY-SA-3.0",
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { status: "FAILED", reason: `wikipedia_fetch_error:${msg.slice(0, 200)}`, retrieved_at_iso: nowIso };
      }
    },
  };
}

/** Register the Wikipedia source + adapter + conservative quota policy.
 *  Called from worker-master-ai when env flag is set OR from tests
 *  directly with a stub fetch. Idempotent: source is created only if
 *  absent, policy set only if absent. */
export function registerWikipediaLiveSource(input: {
  registered_by: string;
  adapter?: SourceAdapter;                        // for tests · defaults to real
  policy_requests_per_day?: number;
}): { source_slug: string; already_present: boolean } {
  const existing = getSource(WIKIPEDIA_SOURCE_SLUG);
  const alreadyPresent = existing !== null;
  if (!alreadyPresent) {
    registerSource({
      source_slug: WIKIPEDIA_SOURCE_SLUG,
      name: "English Wikipedia · REST page summary",
      kind: "PUBLIC_WEB",
      authority_tier: "TIER_3",                   // authoritative but community-edited
      base_url: DEFAULT_BASE,
      rate_policy: { max_requests_per_minute: 30, respect_retry_after: true },
      respects_robots_txt: true,
      license_note: "CC-BY-SA-3.0 · attribution required",
      authorization_state: "AUTHORIZED",
      registered_by: input.registered_by,
    });
  }
  const policyExists = currentPolicy(WIKIPEDIA_SOURCE_SLUG, "REQUEST") !== null;
  if (!policyExists) {
    setPolicy({
      source_slug: WIKIPEDIA_SOURCE_SLUG,
      metric: "REQUEST",
      free_allowance_per_day: input.policy_requests_per_day ?? 5000,
      paid_allowance_per_day: 0,
      unit_cost_idr: 0,
      hard_cap: true,
      warning_threshold_pct: 80,
      set_by: input.registered_by,
    });
  }
  registerAdapter(input.adapter ?? createWikipediaAdapter());
  return { source_slug: WIKIPEDIA_SOURCE_SLUG, already_present: alreadyPresent };
}

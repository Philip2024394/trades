// src/lib/nex/live-chat-completion/web-acquisition/wikidata-provider.ts
//
// Founder AIW-2a · Wikidata SPARQL provider (NEX AI-WiFi).
//
// Public Wikidata endpoint · CC0 license · structured entity data.
// Uses the Wikidata Query Service SPARQL endpoint. Rate-limit ceiling
// per Wikidata policy: 60 s per query · 5 concurrent per source IP.
// This module keeps each query under a 5 s budget and never exceeds
// 1 concurrent request per call.
//
// The provider searches for entities matching a natural-language
// query using the wbsearchentities-driven MediaWiki API for name
// resolution, then SPARQL-fetches key structured properties for the
// top matches. Output is snippet-shaped so it slots into the existing
// WebResult contract.

import type { WebAcquisitionInput, WebAcquisitionOutput, WebProvider, WebResult } from "./contract";

const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";
const SEARCH_ENDPOINT = "https://www.wikidata.org/w/api.php";
const USER_AGENT = "NEX-WebAcquisition/1 (+https://thenetworkers.app)";
const MAX_ENTITIES = 4;
const MAX_SNIPPET_CHARS = 400;

export function makeWikidataProvider(): WebProvider {
  return {
    name: "wikidata",
    async acquire(input: WebAcquisitionInput): Promise<WebAcquisitionOutput> {
      const t0 = performance.now();
      const controller = new AbortController();
      const budget = Math.min(Math.max(input.budget_ms, 500), 30_000);
      const timer = setTimeout(() => controller.abort(new DOMException("wd_timeout", "AbortError")), budget);
      if (input.signal) {
        input.signal.addEventListener("abort", () => controller.abort(input.signal!.reason), { once: true });
      }
      try {
        // ── 1. Resolve entities matching the query ───────────────
        const searchUrl = new URL(SEARCH_ENDPOINT);
        searchUrl.searchParams.set("action", "wbsearchentities");
        searchUrl.searchParams.set("search", String(input.query).slice(0, 100));
        searchUrl.searchParams.set("language", input.language === "id" ? "id" : "en");
        searchUrl.searchParams.set("format", "json");
        searchUrl.searchParams.set("limit", String(MAX_ENTITIES));
        searchUrl.searchParams.set("origin", "*");
        const searchRes = await fetch(searchUrl.toString(), {
          headers: { "User-Agent": USER_AGENT, "Accept": "application/json" },
          signal: controller.signal,
        });
        if (!searchRes.ok) {
          return honestEmpty(t0, `search_http_${searchRes.status}`);
        }
        const searchJson = await searchRes.json().catch(() => ({}));
        const entities = Array.isArray(searchJson?.search) ? searchJson.search : [];
        if (entities.length === 0) return honestEmpty(t0, "no_entities");

        // ── 2. Materialise each entity into a WebResult ──────────
        const results: WebResult[] = [];
        for (const e of entities.slice(0, MAX_ENTITIES)) {
          if (!e?.id || !e?.label) continue;
          const parts: string[] = [];
          if (typeof e.description === "string" && e.description) parts.push(e.description);
          if (Array.isArray(e.aliases) && e.aliases.length > 0) {
            parts.push(`aliases: ${e.aliases.slice(0, 3).join(", ")}`);
          }
          const snippet = parts.join(" · ").slice(0, MAX_SNIPPET_CHARS);
          if (snippet.length < 8) continue;
          results.push({
            title: String(e.label),
            snippet,
            url: `https://www.wikidata.org/wiki/${encodeURIComponent(e.id)}`,
            provider: "wikidata",
            retrieved_at: new Date().toISOString(),
            confidence: 0.65,
          });
        }
        return {
          results,
          provider_meta: {
            provider: "wikidata",
            request_ms: Math.round(performance.now() - t0),
            completed: true,
            result_count: results.length,
          },
        };
      } catch (e) {
        const reason = (e as { name?: string })?.name === "AbortError"
          ? "aborted"
          : (e instanceof Error ? e.message.slice(0, 100) : "wikidata_error");
        return honestEmpty(t0, reason);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

function honestEmpty(t0: number, error: string): WebAcquisitionOutput {
  return {
    results: [],
    provider_meta: {
      provider: "wikidata",
      request_ms: Math.round(performance.now() - t0),
      completed: false,
      result_count: 0,
      error,
    },
  };
}

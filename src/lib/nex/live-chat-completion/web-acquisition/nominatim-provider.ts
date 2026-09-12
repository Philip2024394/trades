// src/lib/nex/live-chat-completion/web-acquisition/nominatim-provider.ts
//
// Founder AIW-2b · OpenStreetMap Nominatim geocoding provider (NEX AI-WiFi).
//
// Public Nominatim endpoint · ODbL license · geocoding data only.
// Rate-limit ceiling per Nominatim usage policy: 1 request per second
// per IP. This module enforces a rolling 1-second gap at the process
// level so multiple concurrent NEX calls don't exceed the ceiling.
//
// The provider returns geographic entities (places, addresses,
// landmarks) as WebResult snippets. Attribution: ODbL requires
// attribution — surfaced via /api/nex/attributions (AIW-3).

import type { WebAcquisitionInput, WebAcquisitionOutput, WebProvider, WebResult } from "./contract";

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "NEX-WebAcquisition/1 (+https://thenetworkers.app)";
const MAX_RESULTS = 5;
const MIN_GAP_MS = 1_000;

let _lastCallAt = 0;

async function respectRateLimit(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, MIN_GAP_MS - (now - _lastCallAt));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  _lastCallAt = Date.now();
}

export function makeNominatimProvider(): WebProvider {
  return {
    name: "nominatim",
    async acquire(input: WebAcquisitionInput): Promise<WebAcquisitionOutput> {
      const t0 = performance.now();
      const controller = new AbortController();
      const budget = Math.min(Math.max(input.budget_ms, 500), 30_000);
      const timer = setTimeout(() => controller.abort(new DOMException("nom_timeout", "AbortError")), budget);
      if (input.signal) {
        input.signal.addEventListener("abort", () => controller.abort(input.signal!.reason), { once: true });
      }
      try {
        await respectRateLimit();
        const url = new URL(NOMINATIM_ENDPOINT);
        url.searchParams.set("q", String(input.query).slice(0, 200));
        url.searchParams.set("format", "jsonv2");
        url.searchParams.set("limit", String(MAX_RESULTS));
        url.searchParams.set("addressdetails", "1");
        url.searchParams.set("accept-language", input.language === "id" ? "id" : "en");
        const res = await fetch(url.toString(), {
          headers: { "User-Agent": USER_AGENT, "Accept": "application/json" },
          signal: controller.signal,
        });
        if (!res.ok) return honestEmpty(t0, `http_${res.status}`);
        const rows: unknown = await res.json().catch(() => []);
        const arr = Array.isArray(rows) ? rows : [];
        const results: WebResult[] = [];
        for (const r of arr) {
          const row = r as { display_name?: string; lat?: string; lon?: string; type?: string; class?: string; osm_type?: string; osm_id?: number };
          if (!row.display_name || !row.lat || !row.lon) continue;
          const snippet = `${row.class ?? "?"}/${row.type ?? "?"} at ${row.lat},${row.lon}`;
          results.push({
            title: row.display_name,
            snippet,
            url: `https://www.openstreetmap.org/${row.osm_type ?? ""}/${row.osm_id ?? ""}`,
            provider: "nominatim",
            retrieved_at: new Date().toISOString(),
            confidence: 0.6,
          });
        }
        return {
          results,
          provider_meta: {
            provider: "nominatim",
            request_ms: Math.round(performance.now() - t0),
            completed: true,
            result_count: results.length,
          },
        };
      } catch (e) {
        const reason = (e as { name?: string })?.name === "AbortError"
          ? "aborted"
          : (e instanceof Error ? e.message.slice(0, 100) : "nom_error");
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
      provider: "nominatim",
      request_ms: Math.round(performance.now() - t0),
      completed: false,
      result_count: 0,
      error,
    },
  };
}

// src/lib/nex/live-chat-completion/web-acquisition/ddg-wikipedia-provider.ts
//
// Founder BEGIN Phase 3.5 · Real web acquisition provider.
//
// Zero paid API. Two free sources tried in order:
//   1. DuckDuckGo Instant Answer API — https://api.duckduckgo.com/?q=...&format=json
//      Free, no key, low rate limits. Good for factual queries.
//   2. Wikipedia REST — https://en.wikipedia.org/api/rest_v1/page/summary/{title}
//      Free, no key. Good for entity summaries.
//
// Both are bounded to the founder-configured budget_ms (default 5000).
// Zero storage of full-page HTML — only structured extracted fields.
//
// Failure modes are ALL non-fatal — an empty result set is returned rather
// than throwing. Downstream code (retrieval bundle + Fabrication Gate)
// handles empty acquisition as "no evidence" and emits honest limitation.

import type { WebProvider, WebResult, WebAcquisitionOutput } from "./contract";

const DDG_BASE = "https://api.duckduckgo.com";
const WP_BASE = "https://en.wikipedia.org/api/rest_v1";
const UA = "NEX-Live-Chat/1.0 (Founder-authorized zero-cost web-acquisition · Master AI Engineer)";

const MAX_SNIPPET = 500;
const MAX_RESULTS_PER_SOURCE = 3;

export function makeDdgWikipediaProvider(): WebProvider {
  return {
    name: "ddg-wikipedia",
    async acquire(input): Promise<WebAcquisitionOutput> {
      const t0 = performance.now();
      const controller = new AbortController();
      const budgetTimer = setTimeout(() => controller.abort(), Math.max(500, Math.min(30_000, input.budget_ms)));
      const link = () => { if (input.signal) input.signal.addEventListener("abort", () => controller.abort(), { once: true }); };
      link();

      const results: WebResult[] = [];
      let errorMsg: string | undefined = undefined;

      // ── 1. DuckDuckGo Instant Answer ──────────────────────────────
      try {
        const url = `${DDG_BASE}/?q=${encodeURIComponent(input.query)}&format=json&no_html=1&skip_disambig=1`;
        const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": UA, "Accept": "application/json" } });
        if (res.ok) {
          const j = await res.json() as {
            AbstractText?: string;
            AbstractURL?: string;
            Heading?: string;
            AbstractSource?: string;
            RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
          };
          if (j?.AbstractText && j?.AbstractURL) {
            results.push({
              title: j.Heading ?? "Result",
              snippet: j.AbstractText.slice(0, MAX_SNIPPET),
              url: j.AbstractURL,
              provider: `duckduckgo (source: ${j.AbstractSource ?? "unknown"})`,
              retrieved_at: new Date().toISOString(),
              confidence: 0.65,
            });
          }
          const related = Array.isArray(j?.RelatedTopics) ? j.RelatedTopics : [];
          for (const r of related.slice(0, MAX_RESULTS_PER_SOURCE - 1)) {
            if (!r?.Text || !r?.FirstURL) continue;
            results.push({
              title: r.Text.split(" - ")[0] ?? "Related",
              snippet: r.Text.slice(0, MAX_SNIPPET),
              url: r.FirstURL,
              provider: "duckduckgo",
              retrieved_at: new Date().toISOString(),
              confidence: 0.5,
            });
          }
        } else {
          errorMsg = `ddg_http_${res.status}`;
        }
      } catch (e) {
        errorMsg = e instanceof Error ? `ddg_error:${e.message.slice(0, 80)}` : "ddg_error";
      }

      // ── 2. Wikipedia summary — only if DDG returned nothing ───────
      if (results.length === 0 && !controller.signal.aborted) {
        try {
          const title = encodeURIComponent(input.query.replace(/[?!]+$/g, "").trim().replace(/\s+/g, "_"));
          const res = await fetch(`${WP_BASE}/page/summary/${title}`, {
            signal: controller.signal,
            headers: { "User-Agent": UA, "Accept": "application/json" },
          });
          if (res.ok) {
            const j = await res.json() as {
              title?: string;
              extract?: string;
              content_urls?: { desktop?: { page?: string } };
            };
            const pageUrl = j?.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${title}`;
            if (j?.extract) {
              results.push({
                title: j.title ?? "Wikipedia",
                snippet: j.extract.slice(0, MAX_SNIPPET),
                url: pageUrl,
                provider: "wikipedia",
                retrieved_at: new Date().toISOString(),
                confidence: 0.7,
              });
            }
          }
        } catch (e) {
          errorMsg = errorMsg ?? (e instanceof Error ? `wp_error:${e.message.slice(0, 80)}` : "wp_error");
        }
      }

      clearTimeout(budgetTimer);
      const completed = !controller.signal.aborted;
      return {
        results,
        provider_meta: {
          provider: "ddg-wikipedia",
          request_ms: Math.round(performance.now() - t0),
          completed,
          result_count: results.length,
          error: errorMsg,
        },
      };
    },
  };
}

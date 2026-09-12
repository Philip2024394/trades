// src/lib/nex/live-chat-completion/web-acquisition/composite-provider.ts
//
// Founder AIW-2c · Composite web provider (NEX AI-WiFi).
//
// Fans a query out to N sub-providers in parallel under a SHARED
// budget. Merges results deduped by URL. Never returns partial errors
// as failures — every provider that returns results contributes.
//
// Sub-providers are WebProvider instances (DuckDuckGo, Wikipedia,
// Wikidata, Nominatim, Open-Meteo, ...). This module is the "internet
// as raw data supply" surface: raw HTTP fetches only, zero AI.

import type { WebAcquisitionInput, WebAcquisitionOutput, WebProvider, WebResult } from "./contract";

export interface CompositeOptions {
  /** Max results returned overall (dedup by URL). */
  max_results?: number;
  /** Which sub-providers to include. Order affects tie-breaking. */
  providers: readonly WebProvider[];
}

export function makeCompositeWebProvider(opts: CompositeOptions): WebProvider {
  const providers = opts.providers.filter(Boolean);
  const maxResults = Math.min(Math.max(opts.max_results ?? 12, 1), 40);
  const names = providers.map((p) => p.name).join("+");
  return {
    name: `composite:${names}`,
    async acquire(input: WebAcquisitionInput): Promise<WebAcquisitionOutput> {
      const t0 = performance.now();
      // Give each sub-provider the full budget · shared clock via AbortSignal.
      const outs = await Promise.all(providers.map(async (p) => {
        try { return await p.acquire(input); }
        catch (e) {
          return {
            results: [] as WebResult[],
            provider_meta: {
              provider: p.name,
              request_ms: 0,
              completed: false,
              result_count: 0,
              error: e instanceof Error ? e.message.slice(0, 100) : "composite_sub_error",
            },
          };
        }
      }));

      // Merge deduped by URL. Preserve provider order for tie-breaking.
      const seen = new Set<string>();
      const merged: WebResult[] = [];
      for (const o of outs) {
        for (const r of o.results ?? []) {
          if (!r?.url) continue;
          const key = r.url.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(r);
          if (merged.length >= maxResults) break;
        }
        if (merged.length >= maxResults) break;
      }

      // Sub-provider meta aggregated.
      const submeta = outs.map((o) => ({
        provider: o.provider_meta.provider,
        result_count: o.provider_meta.result_count,
        completed: o.provider_meta.completed,
        error: o.provider_meta.error,
        request_ms: o.provider_meta.request_ms,
      }));

      return {
        results: merged,
        provider_meta: {
          provider: `composite:${names}`,
          request_ms: Math.round(performance.now() - t0),
          completed: outs.some((o) => o.provider_meta.completed),
          result_count: merged.length,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          error: (submeta as any),
        },
      };
    },
  };
}

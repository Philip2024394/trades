// src/lib/nex/live-chat-completion/web-acquisition/mock-provider.ts
//
// Founder BEGIN Phase 3.5 · Mock web acquisition provider.
//
// Deterministic outputs keyed on query keywords · lets the Fabrication
// Gate + LLM rescue path be exercised without live network I/O.
//
// Scenarios:
//   contains "yogyakarta" → 2 canned results about Yogyakarta hotels
//   contains "wifi" or "internet" → 1 result about hotel wifi norms
//   contains "web:none" → returns [] (empty acquisition)
//   contains "web:fabricate" → returns 1 result the mock LLM will misquote
//   default → 1 generic accommodation result

import type { WebProvider, WebResult, WebAcquisitionOutput } from "./contract";

const NOW = () => new Date().toISOString();

export function makeMockWebProvider(): WebProvider {
  return {
    name: "mock-web",
    async acquire(input): Promise<WebAcquisitionOutput> {
      const t0 = performance.now();
      const q = input.query.toLowerCase();
      let results: WebResult[] = [];

      if (q.includes("web:none")) {
        results = [];
      } else if (q.includes("yogyakarta") || q.includes("jogja")) {
        results = [
          {
            title: "Yogyakarta accommodation — Wikipedia overview",
            snippet: "Yogyakarta hosts a range of accommodation types from budget kos and homestays to five-star hotels. Malioboro Street is a major hotel corridor.",
            url: "https://en.wikipedia.org/wiki/Yogyakarta_accommodation",
            provider: "mock-web",
            retrieved_at: NOW(),
            confidence: 0.7,
          },
          {
            title: "Hotels near Malioboro — travel guide",
            snippet: "Malioboro is central Yogyakarta's main pedestrian corridor. Many hotels within walking distance offer breakfast and airport transfer.",
            url: "https://mockweb.example/yogyakarta-malioboro-hotels",
            provider: "mock-web",
            retrieved_at: NOW(),
            confidence: 0.55,
          },
        ];
      } else if (q.includes("wifi") || q.includes("internet")) {
        results = [
          {
            title: "Wi-Fi in Indonesian hotels — expected norms",
            snippet: "Free Wi-Fi is commonly offered by 3-star and above properties in Indonesia; budget properties often charge or provide limited access.",
            url: "https://mockweb.example/wifi-in-indonesian-hotels",
            provider: "mock-web",
            retrieved_at: NOW(),
            confidence: 0.5,
          },
        ];
      } else {
        results = [
          {
            title: "Indonesia hotel guide",
            snippet: "General guidance for accommodation search across Indonesian cities.",
            url: "https://mockweb.example/indonesia-hotel-guide",
            provider: "mock-web",
            retrieved_at: NOW(),
            confidence: 0.4,
          },
        ];
      }

      return {
        results,
        provider_meta: {
          provider: "mock-web",
          request_ms: Math.round(performance.now() - t0),
          completed: true,
          result_count: results.length,
        },
      };
    },
  };
}

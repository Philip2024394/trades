// src/lib/nex/live-chat-completion/web-acquisition/openmeteo-provider.ts
//
// Founder AIW-2b · Open-Meteo weather provider (NEX AI-WiFi).
//
// Public Open-Meteo endpoint · CC BY 4.0 · no API key required.
// 10,000 requests/day free tier · well within NEX scale.
//
// Two-step flow:
//   1. Geocode the query via Open-Meteo's own geocoding endpoint
//      (data-only · CC BY).
//   2. Fetch current + short-term forecast for the top result.
//
// Only fires when the query looks weather-related; otherwise returns
// an empty result set so the composite provider doesn't waste budget.

import type { WebAcquisitionInput, WebAcquisitionOutput, WebProvider, WebResult } from "./contract";

const GEOCODE_ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const USER_AGENT = "NEX-WebAcquisition/1 (+https://thenetworkers.app)";

const WEATHER_KEYWORDS = /\b(weather|forecast|rain|temperature|temp|climate|humidity|wind|storm|sunny|cloudy|cuaca|hujan|angin|panas)\b/i;

export function makeOpenMeteoProvider(): WebProvider {
  return {
    name: "openmeteo",
    async acquire(input: WebAcquisitionInput): Promise<WebAcquisitionOutput> {
      const t0 = performance.now();
      if (!WEATHER_KEYWORDS.test(String(input.query))) {
        return {
          results: [],
          provider_meta: {
            provider: "openmeteo",
            request_ms: Math.round(performance.now() - t0),
            completed: true,
            result_count: 0,
            error: "not_weather_query",
          },
        };
      }
      const controller = new AbortController();
      const budget = Math.min(Math.max(input.budget_ms, 500), 30_000);
      const timer = setTimeout(() => controller.abort(new DOMException("om_timeout", "AbortError")), budget);
      if (input.signal) {
        input.signal.addEventListener("abort", () => controller.abort(input.signal!.reason), { once: true });
      }
      try {
        // ── 1. Geocode (extract location from query if present) ──
        // Strip weather keywords to isolate the location noun-phrase.
        const location = String(input.query)
          .replace(WEATHER_KEYWORDS, "")
          .replace(/\b(in|at|for|the)\b/gi, "")
          .replace(/\s+/g, " ")
          .trim();
        if (location.length < 2) {
          return honestEmpty(t0, "no_location_in_query");
        }
        const gUrl = new URL(GEOCODE_ENDPOINT);
        gUrl.searchParams.set("name", location.slice(0, 80));
        gUrl.searchParams.set("count", "1");
        gUrl.searchParams.set("language", input.language === "id" ? "id" : "en");
        const gRes = await fetch(gUrl.toString(), {
          headers: { "User-Agent": USER_AGENT, "Accept": "application/json" },
          signal: controller.signal,
        });
        if (!gRes.ok) return honestEmpty(t0, `geocode_http_${gRes.status}`);
        const gJson = await gRes.json().catch(() => ({}));
        const hit = Array.isArray(gJson?.results) && gJson.results[0];
        if (!hit || typeof hit.latitude !== "number" || typeof hit.longitude !== "number") {
          return honestEmpty(t0, "geocode_no_result");
        }
        // ── 2. Fetch current forecast ────────────────────────────
        const fUrl = new URL(FORECAST_ENDPOINT);
        fUrl.searchParams.set("latitude", String(hit.latitude));
        fUrl.searchParams.set("longitude", String(hit.longitude));
        fUrl.searchParams.set("current", "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code");
        fUrl.searchParams.set("timezone", "auto");
        const fRes = await fetch(fUrl.toString(), {
          headers: { "User-Agent": USER_AGENT, "Accept": "application/json" },
          signal: controller.signal,
        });
        if (!fRes.ok) return honestEmpty(t0, `forecast_http_${fRes.status}`);
        const fJson = await fRes.json().catch(() => ({}));
        const cur = fJson?.current;
        if (!cur) return honestEmpty(t0, "no_current_forecast");
        const snippet = `Current in ${hit.name}${hit.country ? `, ${hit.country}` : ""}: `
          + `temperature ${cur.temperature_2m}${fJson?.current_units?.temperature_2m ?? "°C"} · `
          + `humidity ${cur.relative_humidity_2m}${fJson?.current_units?.relative_humidity_2m ?? "%"} · `
          + `wind ${cur.wind_speed_10m}${fJson?.current_units?.wind_speed_10m ?? " km/h"}`;
        const result: WebResult = {
          title: `Weather · ${hit.name}${hit.country ? `, ${hit.country}` : ""}`,
          snippet,
          url: `https://open-meteo.com/en/docs?latitude=${hit.latitude}&longitude=${hit.longitude}`,
          provider: "openmeteo",
          retrieved_at: new Date().toISOString(),
          confidence: 0.75,
        };
        return {
          results: [result],
          provider_meta: {
            provider: "openmeteo",
            request_ms: Math.round(performance.now() - t0),
            completed: true,
            result_count: 1,
          },
        };
      } catch (e) {
        const reason = (e as { name?: string })?.name === "AbortError"
          ? "aborted"
          : (e instanceof Error ? e.message.slice(0, 100) : "om_error");
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
      provider: "openmeteo",
      request_ms: Math.round(performance.now() - t0),
      completed: false,
      result_count: 0,
      error,
    },
  };
}

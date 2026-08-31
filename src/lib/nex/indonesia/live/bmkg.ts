// BMKG connectors · weather + earthquake + tsunami.
//
// BMKG (Badan Meteorologi, Klimatologi, dan Geofisika) publishes
// open XML/JSON feeds. This module defines three connectors:
//
//   1. bmkg.earthquake  — latest earthquake JSON feed
//   2. bmkg.weather     — 3-day forecast per province
//   3. bmkg.tsunami     — tsunami warning feed
//
// Each has:
//   · a stable LiveSourceConfig
//   · a parser that turns raw payload → EntityRecord[]
//   · a fetch() method that consults httpFetch (which is env-gated
//     off unless NEX_LIVE_SOURCES_ENABLED=1)
//
// Real endpoints (public, attribution required):
//   · https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json
//   · https://data.bmkg.go.id/DataMKG/MEWS/DigitalForecast/…
//
// For mocked tests, pass fixture JSON via fetch({ mock }).

import type { LiveSourceConnector, LiveSourceConfig, LiveObservation, LiveFetchError } from "./types";
import type { EntityRecord } from "../data/types";
import { httpFetch } from "./http-adapter";
import { stampVerified } from "../data/freshness";

// ─── EARTHQUAKE ────────────────────────────────────────────────────

export const BMKG_EARTHQUAKE_CONFIG: LiveSourceConfig = {
  id: "live.bmkg.earthquake",
  kind: "bmkg",
  endpoint: "https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json",
  freshnessPolicy: "live",
  pollIntervalMs: 60_000,
  timeoutMs: 8_000,
  breakerOpenAfter: 3,
  breakerOpenForMs: 5 * 60_000,
  description: "BMKG · latest significant earthquake in Indonesia.",
};

export function parseBmkgEarthquake(raw: unknown, now: Date = new Date()): EntityRecord[] {
  const anyR = raw as { Infogempa?: { gempa?: BmkgQuake } };
  const g = anyR?.Infogempa?.gempa;
  if (!g) return [];
  const magnitude = parseFloat(g.Magnitude ?? "0");
  const depth = g.Kedalaman ?? "";
  const wilayah = g.Wilayah ?? "";
  const timeIso = (g.DateTime ?? now.toISOString());
  return [{
    id: `earthquake:bmkg:${g.Tanggal ?? now.toISOString().slice(0, 10)}:${g.Jam ?? ""}`.replace(/\s+/g, "_"),
    kind: "government",
    category: "safety.earthquake",
    name: `M${magnitude.toFixed(1)} · ${wilayah}`,
    description: `Earthquake M${magnitude.toFixed(1)} · depth ${depth} · ${wilayah}. Reported by BMKG at ${timeIso}.`,
    keywords: ["earthquake", "gempa", "bmkg", ...(wilayah ? [wilayah.toLowerCase()] : [])],
    lifecycle: "PUBLISHED",
    lifecycleChangedAt: now.toISOString(),
    provenance: [{
      walkerId: "live.bmkg.earthquake",
      sourceKey: "bmkg.autogempa",
      sourceName: "BMKG",
      sourceTier: "A",
      market: "ID",
      firstDiscoveredAt: timeIso,
      lastCheckedAt: now.toISOString(),
      lastChangedAt: timeIso,
      observedAt: now.toISOString(),
    }],
    freshness: stampVerified("live", now),
    geo: parseCoords(g.Coordinates),
    attributes: {
      magnitude, depth, wilayah,
      potensi: g.Potensi,
      // Normalised tsunami-potential signal derived from BMKG's
      // Indonesian Potensi text. Never override the raw text · both
      // are kept so downstream consumers see raw evidence AND a
      // machine-readable signal. Unrecognised wording → "unknown"
      // (never "no") so we don't silently downgrade real signals we
      // haven't seen wording for yet.
      tsunamiPotential: classifyTsunamiPotential(g.Potensi),
      dirasakan: g.Dirasakan,
    },
  }];
}

/**
 * Classify BMKG's Indonesian `Potensi` text into a normalised tsunami
 * signal. Kept small + explicit · adding new wording is a deliberate
 * act after we see it in real BMKG data.
 *
 * Observed values (2026-08-30 · verified against real gempaterkini.json):
 *   · "Tidak berpotensi tsunami"                      → "no"
 *   · "Gempa ini dirasakan untuk diteruskan ..."      → "unknown" (felt-quake message · not tsunami-related)
 *   · absent / non-string                              → "unknown"
 *   · "Berpotensi tsunami" (documented, not observed) → "yes"
 */
export function classifyTsunamiPotential(potensi: unknown): "no" | "yes" | "unknown" {
  if (typeof potensi !== "string") return "unknown";
  const s = potensi.toLowerCase().trim();
  if (!s) return "unknown";
  // Order matters · "tidak berpotensi tsunami" contains the substring
  // "berpotensi tsunami", so the negation must be checked first.
  if (s.includes("tidak berpotensi tsunami")) return "no";
  if (s.includes("berpotensi tsunami")) return "yes";
  return "unknown";
}

type BmkgQuake = {
  Tanggal?: string; Jam?: string; DateTime?: string;
  Magnitude?: string; Kedalaman?: string; Wilayah?: string;
  Coordinates?: string; Potensi?: string; Dirasakan?: string;
};

function parseCoords(coords?: string): EntityRecord["geo"] {
  if (!coords) return undefined;
  const [latS, lngS] = coords.split(",").map((s) => s.trim());
  const lat = parseFloat(latS); const lng = parseFloat(lngS);
  if (isNaN(lat) || isNaN(lng)) return undefined;
  return { lat, lng, geoConfidence: 1 };
}

export function createBmkgEarthquakeConnector(): LiveSourceConnector {
  return {
    config: BMKG_EARTHQUAKE_CONFIG,
    async fetch(opts?: { mock?: unknown }): Promise<LiveObservation | LiveFetchError> {
      const now = new Date();
      // Mock path · used by tests and by any offline dev.
      if (opts?.mock !== undefined) {
        return { raw: opts.mock, entities: parseBmkgEarthquake(opts.mock, now), observedAt: now.toISOString(), live: false };
      }
      const r = await httpFetch(BMKG_EARTHQUAKE_CONFIG.endpoint, { timeoutMs: BMKG_EARTHQUAKE_CONFIG.timeoutMs });
      if ("error" in r) return r;
      return { raw: r.json, entities: parseBmkgEarthquake(r.json, now), observedAt: now.toISOString(), live: true };
    },
  };
}

// ─── WEATHER (province-scoped · placeholder) ───────────────────────

export const BMKG_WEATHER_CONFIG: LiveSourceConfig = {
  id: "live.bmkg.weather",
  kind: "bmkg",
  endpoint: "https://data.bmkg.go.id/DataMKG/MEWS/DigitalForecast/DigitalForecast-{PROVINCE}.xml",
  freshnessPolicy: "hourly",
  pollIntervalMs: 60 * 60_000,
  timeoutMs: 15_000,
  breakerOpenAfter: 3,
  breakerOpenForMs: 10 * 60_000,
  description: "BMKG · 3-day weather forecast per province (XML feed).",
};

/** Minimal weather parser · v1 extracts region + a summary string.
 *  Detailed hourly parsing is a follow-up when the connector is
 *  activated against the real XML. */
export function parseBmkgWeatherStub(raw: unknown, province: string, now: Date): EntityRecord[] {
  return [{
    id: `weather:bmkg:${province}:${now.toISOString().slice(0, 13)}`,
    kind: "government",
    category: "safety.weather",
    name: `Weather · ${province}`,
    description: (typeof raw === "string" ? raw.slice(0, 400) : "BMKG weather feed"),
    keywords: ["weather", "bmkg", "cuaca", province.toLowerCase()],
    lifecycle: "PUBLISHED",
    lifecycleChangedAt: now.toISOString(),
    provenance: [{
      walkerId: "live.bmkg.weather",
      sourceKey: "bmkg.digitalforecast",
      sourceName: "BMKG",
      sourceTier: "A",
      market: "ID",
      firstDiscoveredAt: now.toISOString(),
      lastCheckedAt: now.toISOString(),
      lastChangedAt: now.toISOString(),
      observedAt: now.toISOString(),
    }],
    freshness: stampVerified("hourly", now),
    geo: { province: province.toLowerCase() },
    attributes: { rawSample: typeof raw === "string" ? raw.slice(0, 400) : undefined },
  }];
}

// ─── TSUNAMI ───────────────────────────────────────────────────────

export const BMKG_TSUNAMI_CONFIG: LiveSourceConfig = {
  id: "live.bmkg.tsunami",
  kind: "bmkg",
  endpoint: "https://data.bmkg.go.id/DataMKG/TEWS/tsunami.json",
  freshnessPolicy: "live",
  pollIntervalMs: 60_000,
  timeoutMs: 8_000,
  breakerOpenAfter: 3,
  breakerOpenForMs: 5 * 60_000,
  description: "BMKG · active tsunami warnings.",
};

export function parseBmkgTsunami(raw: unknown, now: Date = new Date()): EntityRecord[] {
  // Feed structure varies · v1 emits a single "no active warning"
  // record when the payload is empty, and a warning record otherwise.
  const active = raw && typeof raw === "object" && "gempa" in (raw as object);
  return [{
    id: `tsunami:bmkg:${now.toISOString().slice(0, 13)}`,
    kind: "government",
    category: "safety.tsunami",
    name: active ? "Tsunami warning · check BMKG" : "No active tsunami warning",
    description: active
      ? "BMKG has an active tsunami-warning entry. Check the BMKG feed and follow local instructions immediately."
      : "No active tsunami warning at last BMKG check.",
    keywords: ["tsunami", "bmkg", ...(active ? ["warning", "peringatan"] : [])],
    lifecycle: "PUBLISHED",
    lifecycleChangedAt: now.toISOString(),
    provenance: [{
      walkerId: "live.bmkg.tsunami",
      sourceKey: "bmkg.tsunami",
      sourceName: "BMKG",
      sourceTier: "A",
      market: "ID",
      firstDiscoveredAt: now.toISOString(),
      lastCheckedAt: now.toISOString(),
      lastChangedAt: now.toISOString(),
      observedAt: now.toISOString(),
    }],
    freshness: stampVerified("live", now),
    attributes: { rawPresent: active },
  }];
}

// NOTE: no createBmkgTsunamiConnector() · BMKG's documented tsunami
// endpoint returns 404 (verified 2026-08-30). Tsunami information is
// carried on the earthquake record's Potensi field · see
// classifyTsunamiPotential() + parseBmkgEarthquake's attributes.tsunamiPotential.
// Do NOT re-add a connector around a dead endpoint.

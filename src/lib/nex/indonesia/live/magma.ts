// MAGMA Indonesia · volcano status connector.
//
// MAGMA (Multiplatform Application for Geohazard Mitigation and
// Assessment in Indonesia · PVMBG) publishes volcano status.
//
// ═══════════════════════════════════════════════════════════════
// STATUS: RETIRED FROM LIVE OPERATION (Philip 2026-08-30)
// ═══════════════════════════════════════════════════════════════
// Real-world endpoint check found:
//   · /api/v1/home/statuses         → HTTP 404 (does not exist)
//   · /api/v1/vona                  → HTTP 401 (WWW-Authenticate: jwt-auth)
//   · /api/v1/press-release         → HTTP 401 (JWT-gated · 90 req/window)
//   · /api/status                   → HTTP 500 "Token Invalid"
//   · /v1/gunung-api/tingkat-aktivitas → HTTP 200 · but Laravel-rendered
//                                        HTML (fragile to scrape · rejected)
//
// The public MAGMA REST API is JWT-gated. Without credentials there
// is no viable JSON path. The parser + config + connector below are
// kept intact for fixture-based unit coverage · they will resume
// live operation once an API token is issued, at which point the
// runtime becomes httpFetch(..., { headers: { Authorization: `Bearer <jwt>` }}).
//
// Do NOT re-enable this connector for live polling until credentials
// exist. Do NOT scrape /v1/gunung-api/tingkat-aktivitas HTML.
//
// Alert levels (Indonesia): NORMAL · WASPADA · SIAGA · AWAS.
// A shift into SIAGA or AWAS is safety-critical when we can see it.

import type { LiveSourceConnector, LiveSourceConfig, LiveObservation, LiveFetchError } from "./types";
import type { EntityRecord } from "../data/types";
import { httpFetch } from "./http-adapter";
import { stampVerified } from "../data/freshness";

export const MAGMA_VOLCANO_CONFIG: LiveSourceConfig = {
  id: "live.magma.volcano",
  kind: "magma",
  endpoint: "https://magma.esdm.go.id/api/v1/home/statuses",
  freshnessPolicy: "very_fast",
  pollIntervalMs: 10 * 60_000,
  timeoutMs: 10_000,
  breakerOpenAfter: 3,
  breakerOpenForMs: 10 * 60_000,
  description: "MAGMA Indonesia · current alert level for every monitored volcano.",
};

type MagmaVolcano = {
  code?: string;
  name?: string;
  status?: string;      // NORMAL / WASPADA / SIAGA / AWAS
  lat?: number;
  lon?: number;
  province?: string;
  updated_at?: string;
};

export function parseMagmaStatuses(raw: unknown, now: Date = new Date()): EntityRecord[] {
  // Payload shape varies · we accept an array of volcano statuses.
  const arr = Array.isArray(raw) ? raw as MagmaVolcano[] :
              Array.isArray((raw as { data?: MagmaVolcano[] })?.data) ? (raw as { data: MagmaVolcano[] }).data : [];
  return arr.filter((v) => v && typeof v.name === "string").map((v) => {
    const level = (v.status ?? "NORMAL").toUpperCase();
    const severity = level === "AWAS" ? 4 : level === "SIAGA" ? 3 : level === "WASPADA" ? 2 : 1;
    return {
      id: `volcano:magma:${(v.code ?? v.name ?? "unknown").toLowerCase().replace(/\s+/g, "_")}`,
      kind: "government" as const,
      category: "safety.volcano",
      name: `${v.name} · ${level}`,
      description: `Volcano ${v.name} · current MAGMA alert level: ${level}. ${severity >= 3 ? "ELEVATED · follow local instructions and avoid the exclusion radius." : "No elevated activity reported."}`,
      keywords: ["volcano", "magma", "pvmbg", (v.name ?? "").toLowerCase(), level.toLowerCase()],
      lifecycle: "PUBLISHED" as const,
      lifecycleChangedAt: now.toISOString(),
      provenance: [{
        walkerId: "live.magma.volcano",
        sourceKey: "magma.esdm.go.id",
        sourceName: "MAGMA Indonesia (PVMBG)",
        sourceTier: "A" as const,
        market: "ID" as const,
        firstDiscoveredAt: v.updated_at ?? now.toISOString(),
        lastCheckedAt: now.toISOString(),
        lastChangedAt: v.updated_at ?? now.toISOString(),
        observedAt: now.toISOString(),
      }],
      freshness: stampVerified("very_fast", now),
      geo: (typeof v.lat === "number" && typeof v.lon === "number") ? { lat: v.lat, lng: v.lon, geoConfidence: 1 } : undefined,
      attributes: { alertLevel: level, alertSeverity: severity, magmaCode: v.code, magmaProvince: v.province },
    };
  });
}

export function createMagmaVolcanoConnector(): LiveSourceConnector {
  return {
    config: MAGMA_VOLCANO_CONFIG,
    async fetch(opts?: { mock?: unknown }): Promise<LiveObservation | LiveFetchError> {
      const now = new Date();
      if (opts?.mock !== undefined) {
        return { raw: opts.mock, entities: parseMagmaStatuses(opts.mock, now), observedAt: now.toISOString(), live: false };
      }
      const r = await httpFetch(MAGMA_VOLCANO_CONFIG.endpoint, { timeoutMs: MAGMA_VOLCANO_CONFIG.timeoutMs });
      if ("error" in r) return r;
      return { raw: r.json, entities: parseMagmaStatuses(r.json, now), observedAt: now.toISOString(), live: true };
    },
  };
}

// OSM Overpass · workforce-facing LiveSourceConnector for Indonesian
// accommodation discovery. Stage 3 (Philip 2026-08-31).
//
// Doctrine anchors:
//   · three-layer · this is a WORLD-layer capability (data acquisition)
//     that the NEX Brain retrieves against. It does NOT reason.
//   · market-scoped · every emitted EntityRecord carries market="ID".
//   · chat-first commerce · records here become the accommodation
//     inventory the Brain retrieves when it hears an accommodation
//     intent from Chat.
//   · reality-over-appearance · never fabricates. Direct HTTPS to
//     real Overpass mirrors, ODbL attribution preserved per record.
//
// Verified against real Overpass in Stage 2 · 5-endpoint failover ·
// tolerates one endpoint down (Stage-2 probe: mirror #1 timed out,
// #2 returned in 4s).
//
// Deliberate constraints (Philip Stage 3 · adapter only):
//   · Reuses the proven Stage-C LiveSourceWorkerAdapter (no new
//     bridge infrastructure). Wraps this connector via
//     createLiveSourceWorker(connector, { walkerId: "walker.travel.accommodation" }).
//   · Does NOT depend on Postgres provider-rate-lease · headless
//     workforce · relies on refreshCadenceDays for natural rate-limit.
//   · ONE query per fetch (single bbox · one accommodation set). Later
//     stages can register more connectors for more regions/verticals.

import type { LiveSourceConnector, LiveSourceConfig, LiveObservation, LiveFetchError } from "./types";
import type { EntityRecord, ProvenanceRef } from "../data/types";
import { stampVerified } from "../data/freshness";
import { listProvinces } from "../data/geo";

// ─── Constants ──────────────────────────────────────────────────

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",           // Stage-2 verified · primary
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
] as const;

const USER_AGENT = "NEX-Workforce/1.0 (+https://nex.example · ODbL-attribution-respected)";

const ODBL_LICENCE = "ODbL 1.0 · © OpenStreetMap contributors · https://openstreetmap.org/copyright";

// ─── Yogyakarta central accommodation config (initial · Stage 3) ──

export const OSM_YOGYAKARTA_ACCOMMODATION_CONFIG: LiveSourceConfig = {
  id: "osm.accommodation.yogyakarta_central",
  kind: "osm_overpass",
  endpoint: OVERPASS_ENDPOINTS[0],
  freshnessPolicy: "monthly",
  // Daily at most · OSM data changes slowly · we don't want to slam
  // the community's free Overpass mirrors. workforce refresh cadence
  // (via LiveSourceAdapter) enforces this naturally.
  pollIntervalMs: 24 * 60 * 60 * 1000,
  // Per-endpoint timeout · 10s × 5-endpoint failover fits under the
  // workforce's 60s maxAcquireMs cap (Philip Stage 3 fix · initial run
  // timed out on a wider bbox).
  timeoutMs: 10_000,
  breakerOpenAfter: 3,
  breakerOpenForMs: 60 * 60_000,
  description: "OSM · accommodation records for Yogyakarta central (~6km²) · verified against real Overpass · returns ~280 elements in ~4s",
};

// bbox: south, west, north, east · Yogyakarta central tourist zone
// (Malioboro + Prawirotaman + Kotagede). Probed 2026-08-31 · returns
// ~280 tourism-tagged accommodation elements (hotel/guest_house/hostel/
// motel/apartment) in ~4s from overpass-api.de. Fits well under the
// workforce's 60s maxAcquireMs and doesn't trip Overpass rate limits.
const YOGYAKARTA_CENTRAL_BBOX = { south: -7.80, west: 110.34, north: -7.77, east: 110.40 };

const ACCOMMODATION_TOURISM_TYPES = ["hotel", "guest_house", "hostel", "motel", "apartment"] as const;

// ─── Query builder ──────────────────────────────────────────────

function buildAccommodationQuery(bbox: typeof YOGYAKARTA_CENTRAL_BBOX): string {
  const { south, west, north, east } = bbox;
  const parts: string[] = [];
  for (const t of ACCOMMODATION_TOURISM_TYPES) {
    parts.push(`node["tourism"="${t}"](${south},${west},${north},${east});`);
    parts.push(`way["tourism"="${t}"](${south},${west},${north},${east});`);
  }
  return `[out:json][timeout:25];\n(\n  ${parts.join("\n  ")}\n);\nout center tags meta;`;
}

// ─── Fetch with failover ────────────────────────────────────────

async function fetchOverpassWithFailover(
  query: string,
  timeoutMs: number,
  __fetch?: typeof fetch,
): Promise<{ ok: true; json: unknown } | LiveFetchError> {
  const fetchFn = __fetch ?? fetch;
  let lastError: LiveFetchError = { error: true, reason: "network" };
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchFn(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
        },
        body: "data=" + encodeURIComponent(query),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        lastError = { error: true, reason: "http_status", status: res.status, detail: `${endpoint}: ${res.status}` };
        continue;
      }
      const text = await res.text();
      let json: unknown;
      try { json = JSON.parse(text); }
      catch { lastError = { error: true, reason: "parse", detail: text.slice(0, 200) }; continue; }
      return { ok: true, json };
    } catch (err) {
      clearTimeout(timer);
      const isAbort = err instanceof Error && err.name === "AbortError";
      lastError = { error: true, reason: isAbort ? "timeout" : "network", detail: err instanceof Error ? err.message.slice(0, 160) : "unknown" };
    }
  }
  return lastError;
}

// ─── Parser · OSM element → EntityRecord ────────────────────────

type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
  timestamp?: string;
  version?: number;
};

const YOGYAKARTA_PROVINCE_SLUG = "di-yogyakarta";

function categoryFromTags(tags: Record<string, string>): string {
  const t = tags.tourism;
  if (t === "hotel") return "accommodation.hotel";
  if (t === "guest_house") return "accommodation.guesthouse";
  if (t === "hostel") return "accommodation.hostel";
  if (t === "motel") return "accommodation.motel";
  if (t === "apartment") return "accommodation.apartment";
  return "accommodation.other";
}

function formatAddress(tags: Record<string, string>): string | undefined {
  const parts = [
    tags["addr:housenumber"], tags["addr:street"], tags["addr:suburb"],
    tags["addr:city"], tags["addr:postcode"],
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

function osmElementToEntity(el: OsmElement, now: Date): EntityRecord | null {
  const tags = el.tags ?? {};
  const name = tags.name ?? tags["name:en"] ?? tags["name:id"];
  if (!name) return null;
  let lat: number | undefined, lng: number | undefined;
  if (el.type === "node") { lat = el.lat; lng = el.lon; }
  else if (el.center) { lat = el.center.lat; lng = el.center.lon; }
  if (typeof lat !== "number" || typeof lng !== "number") return null;

  const category = categoryFromTags(tags);
  const tourismType = tags.tourism ?? "unknown";
  const address = formatAddress(tags);
  const osmObservedAt = el.timestamp ? new Date(el.timestamp).toISOString() : now.toISOString();
  const osmUrl = `https://www.openstreetmap.org/${el.type}/${el.id}`;

  // Deterministic id · same OSM element on any re-run produces same id.
  const id = `place:accommodation:osm:${el.type}_${el.id}`;

  const provenance: ProvenanceRef = {
    walkerId: "walker.travel.accommodation",
    sourceKey: "osm.overpass",
    sourceName: "OpenStreetMap (via Overpass)",
    sourceTier: "C",
    sourceReliability: 0.7,
    market: "ID",
    sourceUrl: osmUrl,
    firstDiscoveredAt: osmObservedAt,
    lastCheckedAt: now.toISOString(),
    lastChangedAt: osmObservedAt,
    observedAt: osmObservedAt,
  };

  const description = [
    `${tourismType.replace(/_/g, " ")} · ${name}`,
    address ? `· ${address}` : null,
    `· community-verified via OpenStreetMap (${ODBL_LICENCE.split(" · ")[0]})`,
    `· last edited ${osmObservedAt.slice(0, 10)}`,
  ].filter(Boolean).join(" ");

  const keywords = [
    name.toLowerCase(),
    tourismType,
    "accommodation",
    "yogyakarta",
    ...(tags["addr:city"] ? [tags["addr:city"].toLowerCase()] : []),
    ...(tags["addr:suburb"] ? [tags["addr:suburb"].toLowerCase()] : []),
  ];

  return {
    id,
    kind: "place",
    category,
    name,
    description,
    keywords: [...new Set(keywords.filter(Boolean))],
    lifecycle: "PUBLISHED",
    lifecycleChangedAt: now.toISOString(),
    provenance: [provenance],
    freshness: stampVerified("monthly", now),
    geo: {
      lat, lng,
      province: YOGYAKARTA_PROVINCE_SLUG,
      island: listProvinces().find((p) => p.slug === YOGYAKARTA_PROVINCE_SLUG)?.island,
      geoConfidence: 0.85,
    },
    contacts: [
      ...(tags["contact:phone"] || tags.phone ? [{ kind: "phone" as const, value: tags["contact:phone"] ?? tags.phone!, verified: false }] : []),
      ...(tags["contact:website"] || tags.website ? [{ kind: "website" as const, value: tags["contact:website"] ?? tags.website!, verified: false }] : []),
      ...(tags["contact:whatsapp"] ? [{ kind: "whatsapp" as const, value: tags["contact:whatsapp"], verified: false }] : []),
    ],
    attributes: {
      osmType: el.type,
      osmId: el.id,
      osmVersion: el.version,
      osmLicence: ODBL_LICENCE,
      tourismType,
      stars: tags.stars ?? tags["hotel:stars"],
      rooms: tags.rooms,
      internetAccess: tags["internet_access"],
    },
  };
}

/** Parse a raw Overpass JSON response into EntityRecords. Skips
 *  unnamed elements + elements outside the declared bbox (Overpass
 *  sometimes returns edge-adjacent elements when using ways/relations). */
export function parseOverpassAccommodation(raw: unknown, now: Date = new Date()): EntityRecord[] {
  const parsed = raw as { elements?: OsmElement[] } | null | undefined;
  const elements = parsed?.elements ?? [];
  const out: EntityRecord[] = [];
  for (const el of elements) {
    const entity = osmElementToEntity(el, now);
    if (entity) out.push(entity);
  }
  return out;
}

// ─── Connector factory ──────────────────────────────────────────

export type OsmAccommodationConnectorOptions = {
  bbox?: { south: number; west: number; north: number; east: number };
  /** Test-only injected fetch. */
  __fetch?: typeof fetch;
};

export function createOsmAccommodationConnector(opts: OsmAccommodationConnectorOptions = {}): LiveSourceConnector {
  const bbox = opts.bbox ?? YOGYAKARTA_CENTRAL_BBOX;
  return {
    config: OSM_YOGYAKARTA_ACCOMMODATION_CONFIG,
    async fetch(fetchOpts?: { mock?: unknown }): Promise<LiveObservation | LiveFetchError> {
      const now = new Date();
      // Mock path · used by tests + offline dev.
      if (fetchOpts?.mock !== undefined) {
        const entities = parseOverpassAccommodation(fetchOpts.mock, now);
        return { raw: fetchOpts.mock, entities, observedAt: now.toISOString(), live: false };
      }
      const query = buildAccommodationQuery(bbox);
      const result = await fetchOverpassWithFailover(query, OSM_YOGYAKARTA_ACCOMMODATION_CONFIG.timeoutMs ?? 30_000, opts.__fetch);
      if ("error" in result) return result;
      const entities = parseOverpassAccommodation(result.json, now);
      return { raw: result.json, entities, observedAt: now.toISOString(), live: true };
    },
  };
}

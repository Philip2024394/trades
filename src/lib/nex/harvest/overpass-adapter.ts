// src/lib/nex/harvest/overpass-adapter.ts
//
// NEX 24/7 World Harvest Engine · Wave H3 · Overpass adapter
// Founder-authorised programme · 2026-09-22.
//
// Injectable · NULL_OVERPASS_ADAPTER is the default. A production adapter
// is instantiated explicitly by H5 when NEX_PAGE_FETCHER_ACTIVATION=on
// AND the Founder-signed page-fetcher allowlist includes the Overpass host.
//
// GOVERNANCE HARD-LOCKS:
//   * Pure parse · zero fabrication · every field derives from a real tag
//   * business_name required · missing → element skipped (not fabricated)
//   * website_url copied verbatim from OSM `website` or `contact:website` tag
//     · never inferred from name/domain
//   * external_ref = `${type}/${id}` · deterministic idempotency key
//   * NULL_OVERPASS_ADAPTER never fetches · returns `adapter_dormant`

export type OverpassProbeKind =
  | "responded"                // 200 · at least one element
  | "responded_zero"            // 200 · zero elements
  | "unavailable"               // all mirrors failed / network error
  | "rate_limited"              // 429
  | "parse_error"               // 200 but body malformed
  | "adapter_dormant";          // NULL adapter · never fetched

export interface OverpassRawElement {
  readonly type: "node" | "way" | "relation";
  readonly id: number;
  readonly tags?: Record<string, string>;
  readonly lat?: number;
  readonly lon?: number;
  readonly center?: { lat: number; lon: number };
}

export interface OverpassProbeInput {
  readonly host: string;
  readonly query: string;
  readonly timeout_ms: number;
}

export interface OverpassProbeResult {
  readonly kind: OverpassProbeKind;
  readonly elements: readonly OverpassRawElement[];
  readonly bytes: number;
  readonly ms: number;
  readonly endpoint_used: string;
  readonly note: string | null;
}

export interface OverpassAdapter {
  readonly source_id: string;
  probe(input: OverpassProbeInput): Promise<OverpassProbeResult>;
}

export const NULL_OVERPASS_ADAPTER: OverpassAdapter = {
  source_id: "null-overpass",
  async probe(input) {
    return {
      kind: "adapter_dormant",
      elements: [],
      bytes: 0, ms: 0,
      endpoint_used: input.host,
      note: "no production Overpass adapter configured · Founder decision · source-probe executor is idle",
    };
  },
};

/** Fixture adapter for tests · returns a deterministic canned response. */
export function makeFixtureOverpassAdapter(payload: {
  readonly kind?: OverpassProbeKind;
  readonly elements?: readonly OverpassRawElement[];
  readonly latency_ms?: number;
  readonly source_id?: string;
}): OverpassAdapter {
  return {
    source_id: payload.source_id ?? "fixture-overpass",
    async probe(input) {
      return {
        kind: payload.kind ?? (payload.elements && payload.elements.length > 0 ? "responded" : "responded_zero"),
        elements: payload.elements ?? [],
        bytes: JSON.stringify(payload.elements ?? []).length,
        ms: payload.latency_ms ?? 0,
        endpoint_used: input.host,
        note: null,
      };
    },
  };
}

// ─── Pure query builder ────────────────────────────────────────────
/** Builds the Overpass QL query for a (term, country) probe. Deterministic ·
 *  pure · testable. The query targets OSM elements with either an explicit
 *  `craft=scaffolder` tag OR a name containing the term. */
export function buildOverpassQuery(term: string, country_iso: string): string {
  const escaped_term = String(term).replace(/[\\"]/g, "\\$&");
  const escaped_iso = String(country_iso).toUpperCase().replace(/[^A-Z]/g, "");
  return `[out:json][timeout:60];area["ISO3166-1"="${escaped_iso}"]->.a;(node["craft"="scaffolder"](area.a);node["shop"]["name"~"${escaped_term}",i](area.a);node["office"]["name"~"${escaped_term}",i](area.a);node["craft"]["name"~"${escaped_term}",i](area.a);way["craft"="scaffolder"](area.a);way["name"~"${escaped_term}",i](area.a););out center tags 200;`;
}

// ─── Pure parser ───────────────────────────────────────────────────
export function parseOverpassResponse(text: string): OverpassRawElement[] {
  try {
    const j = JSON.parse(text);
    if (!j || !Array.isArray(j.elements)) return [];
    return j.elements as OverpassRawElement[];
  } catch { return []; }
}

// ─── Pure extractor · retains the business record faithfully ───────
export interface ExtractedCandidate {
  readonly business_name: string;
  readonly website_url: string | null;
  readonly phone: string | null;
  readonly address: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly external_ref: string;
  readonly raw_tags: Readonly<Record<string, string>>;
}

/** Extracts a business candidate from an Overpass element. Returns null if
 *  the element does not carry a business name (no anonymous candidates).
 *  Never fabricates a website · never fabricates an email. */
export function extractCandidateFromElement(el: OverpassRawElement): ExtractedCandidate | null {
  const tags = el.tags ?? {};
  const name = (tags.name ?? tags["operator"] ?? "").trim();
  if (name.length === 0) return null;

  const website = tags.website ?? tags["contact:website"] ?? null;
  const phone = tags.phone ?? tags["contact:phone"] ?? tags["contact:mobile"] ?? null;

  const addr_parts = [
    tags["addr:housenumber"], tags["addr:street"], tags["addr:city"], tags["addr:postcode"],
  ].filter(v => typeof v === "string" && v.trim().length > 0);
  const address = addr_parts.length > 0 ? addr_parts.join(", ") : null;

  const lat = typeof el.lat === "number" ? el.lat : (el.center?.lat ?? null);
  const lon = typeof el.lon === "number" ? el.lon : (el.center?.lon ?? null);

  return {
    business_name: name,
    website_url: website && String(website).length > 0 ? String(website) : null,
    phone: phone && String(phone).length > 0 ? String(phone) : null,
    address,
    latitude: lat,
    longitude: lon,
    external_ref: `${el.type}/${el.id}`,
    raw_tags: tags,
  };
}

// ─── Canonicalise website for dedup ────────────────────────────────
/** Normalises a website URL to a stable idempotency key. Strips protocol,
 *  trailing slash, and 'www.' prefix. Returns null when input is falsy or
 *  not URL-shaped. Never adds a domain that wasn't in the input. */
export function canonicaliseWebsite(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  let s = url.trim();
  if (s.length === 0) return null;
  // Reject anything that looks synthetic
  s = s.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "").toLowerCase();
  if (s.length === 0 || !s.includes(".")) return null;
  return s;
}

// ─── Structural boundary markers ───────────────────────────────────
export const _OVERPASS_NEVER_FABRICATES_WEBSITE =
  "extractCandidate_only_copies_website_from_OSM_tag_never_inferred";
export const _OVERPASS_NEVER_FABRICATES_EMAIL =
  "no_email_field_produced_by_this_adapter_email_extraction_is_H4_from_walked_pages";
export const _OVERPASS_NULL_ADAPTER_DEFAULT =
  "NULL_OVERPASS_ADAPTER_is_module_default_production_wiring_is_founder_opt_in";
export const _OVERPASS_EXTERNAL_REF_DETERMINISTIC =
  "external_ref_equals_type_slash_id_same_OSM_node_always_same_candidate";

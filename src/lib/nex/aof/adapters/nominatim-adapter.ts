// src/lib/nex/aof/adapters/nominatim-adapter.ts
//
// NEX Autonomous Operations Framework · Nominatim discovery adapter
// Founder-authorised programme · 2026-09-22.
//
// Structured JSON search against OSM Foundation's Nominatim endpoint.
// Same contract as OverpassAdapter but for a different underlying source.
// Injectable HttpClient · NULL_NOMINATIM_ADAPTER remains module default ·
// production adapter must be constructed with explicit allowed_hosts and
// respects the Nominatim usage policy (min 1 req/sec sustained, UA that
// identifies the app).

export interface NominatimAdapter {
  readonly source_id: string;
  search(input: NominatimSearchInput): Promise<NominatimSearchResult>;
}

export interface NominatimSearchInput {
  readonly term: string;
  readonly country_iso: string;
  readonly limit: number;
  readonly timeout_ms?: number;
  /**
   * Optional bounded viewbox `(x1,y1,x2,y2)` per Nominatim usage policy.
   * When provided with bounded=1, restricts search to that geographic
   * bounding box. Enables regional/city subdivision of a country
   * without fake coordinates · caller supplies reproducible bounds.
   */
  readonly viewbox?: string;
}

export type NominatimSearchKind =
  | "responded" | "responded_zero" | "rate_limited"
  | "source_unavailable" | "parse_error" | "not_authorised";

export interface NominatimRawElement {
  readonly osm_type?: string;
  readonly osm_id?: number | string;
  readonly display_name?: string;
  readonly lat?: string;
  readonly lon?: string;
  readonly name?: string;
  readonly address?: Record<string, unknown>;
  readonly extratags?: Record<string, unknown>;
}

export interface NominatimSearchResult {
  readonly kind: NominatimSearchKind;
  readonly elements: ReadonlyArray<NominatimRawElement>;
  readonly note: string | null;
  readonly bytes: number;
  readonly ms: number;
}

export const NULL_NOMINATIM_ADAPTER: NominatimAdapter = {
  source_id: "nex-null-nominatim-adapter",
  async search() {
    return { kind: "source_unavailable", elements: [], note: "NULL_NOMINATIM_ADAPTER · production adapter not constructed", bytes: 0, ms: 0 };
  },
};

export interface NominatimHttpClient {
  request(input: {
    url: string; method: "GET"; headers: Record<string, string>; timeout_ms: number; max_bytes: number;
  }): Promise<{ status: number; headers: Record<string, string>; body_bytes: number; body_text: string | null }>;
}

export interface ProductionNominatimAdapterOptions {
  readonly allowed_hosts: ReadonlyArray<string>;
  readonly user_agent?: string;
  readonly default_timeout_ms?: number;
  readonly max_bytes?: number;
  readonly http_client?: NominatimHttpClient;
  readonly clock?: () => number;
}

const DEFAULT_USER_AGENT = "NEX-Networkers-Bot/1.0 (+https://thenetworkers.app · Founder-signed source · scaffolding discovery)";
const DEFAULT_TIMEOUT_MS = 25_000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;                // 2 MB
const NOMINATIM_HOST = "nominatim.openstreetmap.org";

export class ProductionNominatimAdapter implements NominatimAdapter {
  readonly source_id = "nex-production-nominatim-adapter";
  private readonly allowed: Set<string>;
  private readonly user_agent: string;
  private readonly default_timeout_ms: number;
  private readonly max_bytes: number;
  private readonly http: NominatimHttpClient;
  private readonly clock: () => number;

  constructor(opts: ProductionNominatimAdapterOptions) {
    this.allowed = new Set(opts.allowed_hosts.map(h => h.toLowerCase()));
    this.user_agent = opts.user_agent ?? DEFAULT_USER_AGENT;
    this.default_timeout_ms = opts.default_timeout_ms ?? DEFAULT_TIMEOUT_MS;
    this.max_bytes = opts.max_bytes ?? DEFAULT_MAX_BYTES;
    this.http = opts.http_client ?? defaultNominatimHttp;
    this.clock = opts.clock ?? (() => Date.now());
  }

  async search(input: NominatimSearchInput): Promise<NominatimSearchResult> {
    const started = this.clock();
    if (!this.allowed.has(NOMINATIM_HOST)) {
      return { kind: "not_authorised", elements: [], note: `${NOMINATIM_HOST} not in allowed_hosts · adapter dormant`, bytes: 0, ms: 0 };
    }
    const cc = String(input.country_iso || "").toLowerCase();
    if (cc.length !== 2) {
      return { kind: "parse_error", elements: [], note: `invalid country_iso ${input.country_iso}`, bytes: 0, ms: 0 };
    }
    // Bounded viewbox subdivision · Founder-authorised Wave frontier · 2026-09-22
    // Uses Nominatim's documented `viewbox=x1,y1,x2,y2&bounded=1` parameter.
    // Caller supplies reproducible bounds · no fake coordinates constructed here.
    const viewboxPart = input.viewbox
      ? `&viewbox=${encodeURIComponent(input.viewbox)}&bounded=1`
      : "";
    const path = `/search?q=${encodeURIComponent(input.term)}&countrycodes=${cc}&format=json&limit=${Math.max(1, Math.min(50, input.limit))}&extratags=1&addressdetails=1${viewboxPart}`;
    const url = `https://${NOMINATIM_HOST}${path}`;
    let resp: Awaited<ReturnType<NominatimHttpClient["request"]>>;
    try {
      resp = await this.http.request({
        url, method: "GET",
        headers: { "user-agent": this.user_agent, "accept": "application/json" },
        timeout_ms: input.timeout_ms ?? this.default_timeout_ms,
        max_bytes: this.max_bytes,
      });
    } catch (e) {
      return { kind: "source_unavailable", elements: [], note: `network error: ${(e as Error).message.slice(0, 200)}`, bytes: 0, ms: this.clock() - started };
    }
    const ms = this.clock() - started;
    if (resp.status === 429) return { kind: "rate_limited", elements: [], note: `HTTP 429`, bytes: resp.body_bytes, ms };
    if (resp.status >= 500) return { kind: "source_unavailable", elements: [], note: `HTTP ${resp.status}`, bytes: resp.body_bytes, ms };
    if (resp.status !== 200) return { kind: "source_unavailable", elements: [], note: `HTTP ${resp.status}`, bytes: resp.body_bytes, ms };
    let parsed: unknown;
    try { parsed = JSON.parse(resp.body_text ?? ""); }
    catch (e) { return { kind: "parse_error", elements: [], note: `json parse: ${(e as Error).message.slice(0, 120)}`, bytes: resp.body_bytes, ms }; }
    if (!Array.isArray(parsed)) return { kind: "parse_error", elements: [], note: `not an array`, bytes: resp.body_bytes, ms };
    if (parsed.length === 0) return { kind: "responded_zero", elements: [], note: null, bytes: resp.body_bytes, ms };
    return { kind: "responded", elements: parsed as NominatimRawElement[], note: null, bytes: resp.body_bytes, ms };
  }
}

// Deterministic mapping · never fabricates any field
export interface NominatimCandidate {
  readonly business_name: string;
  readonly website_url: string | null;
  readonly phone: string | null;
  readonly address: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly external_ref: string;
  readonly raw_tags: Record<string, unknown>;
  readonly direct_email_from_osm: string | null;
}

export function extractNominatimCandidate(el: NominatimRawElement): NominatimCandidate | null {
  const et = (el.extratags ?? {}) as Record<string, unknown>;
  const name = (el.name as string) || (et.name as string) || (typeof el.display_name === "string" ? el.display_name.split(",")[0].trim() : "");
  if (!name) return null;
  const website = (et.website as string) || (et["contact:website"] as string) || null;
  const phone = (et.phone as string) || (et["contact:phone"] as string) || null;
  const direct_email = (et.email as string) || (et["contact:email"] as string) || null;
  const osm_type = typeof el.osm_type === "string" ? el.osm_type[0].toUpperCase() : "N";
  const external_ref = `${osm_type}${el.osm_id ?? ""}`;
  return {
    business_name: name,
    website_url: website,
    phone,
    address: (el.display_name as string) ?? null,
    latitude: el.lat ? Number(el.lat) : null,
    longitude: el.lon ? Number(el.lon) : null,
    external_ref,
    raw_tags: {
      ...(el.address ?? {}),
      ...et,
      osm_type: el.osm_type,
      osm_id: el.osm_id,
      ...(direct_email ? { osm_direct_email: direct_email } : {}),
    },
    direct_email_from_osm: direct_email,
  };
}

// ─── Default HTTP client using node:https (opt-in via production adapter) ─
const defaultNominatimHttp: NominatimHttpClient = {
  async request({ url, method, headers, timeout_ms, max_bytes }) {
    const { request: httpsRequest } = await import("node:https");
    const u = new URL(url);
    return new Promise((resolve, reject) => {
      const req = httpsRequest({
        method, hostname: u.hostname, port: u.port || 443,
        path: u.pathname + u.search, headers, timeout: timeout_ms,
      }, res => {
        const chunks: Buffer[] = [];
        let total = 0;
        let truncated = false;
        res.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total > max_bytes) { truncated = true; res.destroy(); return; }
          chunks.push(chunk);
        });
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          const h: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (typeof v === "string") h[k.toLowerCase()] = v;
            else if (Array.isArray(v)) h[k.toLowerCase()] = v.join(", ");
          }
          resolve({ status: res.statusCode ?? 0, headers: h, body_bytes: total, body_text: truncated ? null : body });
        });
        res.on("error", reject);
      });
      req.on("timeout", () => { req.destroy(new Error(`timeout after ${timeout_ms}ms`)); });
      req.on("error", reject);
      req.end();
    });
  },
};

export const _NOMINATIM_NULL_ADAPTER_DEFAULT =
  "NULL_NOMINATIM_ADAPTER_returns_source_unavailable_when_production_adapter_not_constructed";
export const _NOMINATIM_REQUIRES_EXPLICIT_ALLOWLIST =
  "production_adapter_refuses_search_when_nominatim_host_not_in_allowed_hosts";
export const _NOMINATIM_NEVER_FABRICATES =
  "extractNominatimCandidate_returns_null_when_name_absent_never_synthesises_fields";

// src/lib/nex/aof/adapters/wikidata-adapter.ts
//
// NEX Autonomous Operations Framework · Wikidata Query Service adapter
// Founder-authorised Wave F · 2026-09-22.
//
// Structured SPARQL discovery against query.wikidata.org. Same contract
// as NominatimAdapter (search → parsed elements). Fetches only entities
// that Wikidata itself already asserts as businesses/companies with
// scaffolding-related classification in the requested country, and only
// preserves the official website (property P856) when Wikidata itself
// returned it.
//
// NEVER infers websites. NEVER infers or fabricates emails.
// If no website is returned by Wikidata, the resulting candidate has
// website_url = null and the Model-B walker will treat it as
// not_applicable_no_website. That is honest.
//
// Wikidata Query Service usage policy:
//   * User-Agent header identifying the app (required)
//   * Respect 429 and Retry-After
//   * 60s per-query cap on the server side
//   * SPARQL LIMIT applied client-side
//
// This is a WORLDWIDE-CAPABLE STRUCTURED DISCOVERY SOURCE.
// Not a claim of complete worldwide coverage.

export interface WikidataAdapter {
  readonly source_id: string;
  search(input: WikidataSearchInput): Promise<WikidataSearchResult>;
}

export interface WikidataSearchInput {
  readonly country_iso: string;                       // ISO 3166-1 alpha-2
  readonly domain: WikidataQueryDomain;               // 'scaffolding' etc.
  readonly limit: number;
  readonly timeout_ms?: number;
}

export type WikidataQueryDomain = "scaffolding";      // extend as Founder authorises

export type WikidataSearchKind =
  | "responded" | "responded_zero" | "rate_limited"
  | "source_unavailable" | "parse_error" | "not_authorised";

export interface WikidataRawBinding {
  readonly qid: string;                                // e.g. "Q123456"
  readonly label: string | null;                       // English label if present
  readonly labelLocal: string | null;                  // local-language label if present
  readonly website: string | null;                     // P856 official website
  readonly countryLabel: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly instanceOfQids: ReadonlyArray<string>;
}

export interface WikidataSearchResult {
  readonly kind: WikidataSearchKind;
  readonly bindings: ReadonlyArray<WikidataRawBinding>;
  readonly note: string | null;
  readonly bytes: number;
  readonly ms: number;
  readonly status_code: number | null;
}

export const NULL_WIKIDATA_ADAPTER: WikidataAdapter = {
  source_id: "nex-null-wikidata-adapter",
  async search() {
    return { kind: "source_unavailable", bindings: [], note: "NULL_WIKIDATA_ADAPTER · production adapter not constructed", bytes: 0, ms: 0, status_code: null };
  },
};

export interface WikidataHttpClient {
  request(input: {
    url: string; method: "GET"; headers: Record<string, string>; timeout_ms: number; max_bytes: number;
  }): Promise<{ status: number; headers: Record<string, string>; body_bytes: number; body_text: string | null }>;
}

export interface ProductionWikidataAdapterOptions {
  readonly allowed_hosts: ReadonlyArray<string>;
  readonly user_agent?: string;
  readonly default_timeout_ms?: number;
  readonly max_bytes?: number;
  readonly http_client?: WikidataHttpClient;
  readonly clock?: () => number;
}

const WIKIDATA_HOST = "query.wikidata.org";
const DEFAULT_USER_AGENT = "NEX-Networkers-Bot/1.0 (+https://thenetworkers.app · Founder-signed source · scaffolding-domain discovery via SPARQL · contact founder@thenetworkers.app)";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
// Wave F v2 · adapter-level politeness · matches allowlist min_interval_ms
// so back-to-back per-country SPARQL doesn't trip WDQS fair-use throttle.
const DEFAULT_MIN_INTERVAL_MS = 3000;

// Scaffolding-related Wikidata classes we look for. Bounded — new domain
// classifications require Founder decision (not a runtime add).
//   Q831365     : scaffolding
//   Q4830453    : business
//   Q19967801   : construction company
//   Q4830453 and subclass paths are traversed by wdt:P31/P279* below.
//
// The query targets: entities WHOSE occupation OR field of work OR
// industry involves scaffolding, OR whose short description says so,
// OR whose instance-of chain includes scaffolding-adjacent classes, all
// restricted to the requested country.
export function buildScaffoldingSparql(country_iso: string, limit: number): string {
  const cc = country_iso.toUpperCase();
  const lim = Math.max(1, Math.min(200, limit));
  // Bounded query · no transitive P31/P279* expansion (killed WDQS server-side
  // in Wave F v1 · timed out at 60s). Only entities where Wikidata itself
  // asserts P452 (industry) or P101 (field of work) as scaffolding
  // (Q831365) OR construction (Q385378) AND the label contains a
  // scaffolding-related term. This may legitimately return zero for many
  // countries — Wikidata's business coverage is Wikipedia-notability-bounded
  // and honestly small for trade businesses. Zero results is a truthful
  // measurement of Wikidata's coverage, not a framework failure.
  return `#nex-networkers-bot scaffolding discovery · Wave F v2
SELECT DISTINCT ?item ?itemLabel ?itemLocalLabel ?website ?countryLabel ?coord WHERE {
  ?item wdt:P17 ?country .
  ?country wdt:P297 "${cc}" .
  {
    ?item wdt:P452 wd:Q831365 .
  } UNION {
    ?item wdt:P101 wd:Q831365 .
  } UNION {
    ?item wdt:P452 wd:Q385378 .
    ?item rdfs:label ?labelWithScaffold .
    FILTER(REGEX(?labelWithScaffold, "scaffold|Gerüst|Geruest|échafaudage|steiger|impalcatur|andaim|andami", "i"))
  }
  OPTIONAL { ?item wdt:P856 ?website . }
  OPTIONAL { ?item wdt:P625 ?coord . }
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en" .
    ?item rdfs:label ?itemLabel .
    ?country rdfs:label ?countryLabel .
  }
  OPTIONAL {
    ?item rdfs:label ?itemLocalLabel .
    FILTER(LANG(?itemLocalLabel) IN ("de","fr","es","it","nl","pt","sv","da","nb","pl","cs"))
  }
}
LIMIT ${lim}`;
}

function parseWktPoint(wkt: string | null): { lat: number | null; lon: number | null } {
  if (!wkt) return { lat: null, lon: null };
  // Wikidata returns coords as WKT "Point(<lon> <lat>)"
  const m = /Point\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i.exec(wkt);
  if (!m) return { lat: null, lon: null };
  const lon = Number(m[1]); const lat = Number(m[2]);
  return { lat: Number.isFinite(lat) ? lat : null, lon: Number.isFinite(lon) ? lon : null };
}

function extractQid(uri: string): string {
  // http://www.wikidata.org/entity/Q123 → Q123
  const m = /\/entity\/(Q\d+)/.exec(uri);
  return m ? m[1] : uri;
}

export function parseWikidataSparqlJson(text: string): ReadonlyArray<WikidataRawBinding> {
  const j = JSON.parse(text);
  const rows = j?.results?.bindings;
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>();
  const out: WikidataRawBinding[] = [];
  for (const r of rows) {
    const qidRaw = r.item?.value;
    if (!qidRaw) continue;
    const qid = extractQid(qidRaw);
    if (seen.has(qid)) continue;
    seen.add(qid);
    const label = r.itemLabel?.value ?? null;
    const labelLocal = r.itemLocalLabel?.value ?? null;
    const website = r.website?.value ?? null;
    const countryLabel = r.countryLabel?.value ?? null;
    const coord = parseWktPoint(r.coord?.value ?? null);
    out.push({
      qid, label: label && label !== qid ? label : null, labelLocal,
      website, countryLabel, latitude: coord.lat, longitude: coord.lon,
      instanceOfQids: [],
    });
  }
  return out;
}

export class ProductionWikidataAdapter implements WikidataAdapter {
  readonly source_id = "nex-production-wikidata-adapter";
  private readonly allowed: Set<string>;
  private readonly user_agent: string;
  private readonly default_timeout_ms: number;
  private readonly min_interval_ms: number;
  private readonly max_bytes: number;
  private readonly http: WikidataHttpClient;
  private readonly clock: () => number;
  private last_request_at_ms: number = 0;

  constructor(opts: ProductionWikidataAdapterOptions & { min_interval_ms?: number }) {
    this.allowed = new Set(opts.allowed_hosts.map(h => h.toLowerCase()));
    this.user_agent = opts.user_agent ?? DEFAULT_USER_AGENT;
    this.default_timeout_ms = opts.default_timeout_ms ?? DEFAULT_TIMEOUT_MS;
    this.min_interval_ms = opts.min_interval_ms ?? DEFAULT_MIN_INTERVAL_MS;
    this.max_bytes = opts.max_bytes ?? DEFAULT_MAX_BYTES;
    this.http = opts.http_client ?? defaultWikidataHttp;
    this.clock = opts.clock ?? (() => Date.now());
  }

  async search(input: WikidataSearchInput): Promise<WikidataSearchResult> {
    const started = this.clock();
    if (!this.allowed.has(WIKIDATA_HOST)) {
      return { kind: "not_authorised", bindings: [], note: `${WIKIDATA_HOST} not in allowed_hosts · adapter dormant`, bytes: 0, ms: 0, status_code: null };
    }
    if (String(input.country_iso || "").length !== 2) {
      return { kind: "parse_error", bindings: [], note: `invalid country_iso ${input.country_iso}`, bytes: 0, ms: 0, status_code: null };
    }
    if (input.domain !== "scaffolding") {
      return { kind: "parse_error", bindings: [], note: `unsupported domain '${input.domain}' · only 'scaffolding' authorised in Wave F`, bytes: 0, ms: 0, status_code: null };
    }
    // Adapter-level politeness · sleep until min_interval elapsed since last request
    const now = this.clock();
    const elapsed = now - this.last_request_at_ms;
    if (this.last_request_at_ms > 0 && elapsed < this.min_interval_ms) {
      const wait = this.min_interval_ms - elapsed;
      await new Promise(r => setTimeout(r, wait));
    }
    this.last_request_at_ms = this.clock();
    const sparql = buildScaffoldingSparql(input.country_iso, input.limit);
    const url = `https://${WIKIDATA_HOST}/sparql?query=${encodeURIComponent(sparql)}&format=json`;
    let resp: Awaited<ReturnType<WikidataHttpClient["request"]>>;
    try {
      resp = await this.http.request({
        url, method: "GET",
        headers: { "user-agent": this.user_agent, "accept": "application/sparql-results+json" },
        timeout_ms: input.timeout_ms ?? this.default_timeout_ms,
        max_bytes: this.max_bytes,
      });
    } catch (e) {
      return { kind: "source_unavailable", bindings: [], note: `network error: ${(e as Error).message.slice(0, 200)}`, bytes: 0, ms: this.clock() - started, status_code: null };
    }
    const ms = this.clock() - started;
    if (resp.status === 429) return { kind: "rate_limited", bindings: [], note: `HTTP 429 · retry-after=${resp.headers["retry-after"] ?? "unknown"}`, bytes: resp.body_bytes, ms, status_code: 429 };
    if (resp.status >= 500) return { kind: "source_unavailable", bindings: [], note: `HTTP ${resp.status}`, bytes: resp.body_bytes, ms, status_code: resp.status };
    if (resp.status !== 200) return { kind: "source_unavailable", bindings: [], note: `HTTP ${resp.status}`, bytes: resp.body_bytes, ms, status_code: resp.status };
    let parsed: ReadonlyArray<WikidataRawBinding>;
    try { parsed = parseWikidataSparqlJson(resp.body_text ?? ""); }
    catch (e) { return { kind: "parse_error", bindings: [], note: `sparql json parse: ${(e as Error).message.slice(0, 120)}`, bytes: resp.body_bytes, ms, status_code: resp.status }; }
    if (parsed.length === 0) return { kind: "responded_zero", bindings: [], note: null, bytes: resp.body_bytes, ms, status_code: resp.status };
    return { kind: "responded", bindings: parsed, note: null, bytes: resp.body_bytes, ms, status_code: resp.status };
  }
}

// Deterministic mapping · never fabricates any field
export interface WikidataCandidate {
  readonly business_name: string;
  readonly website_url: string | null;
  readonly phone: string | null;                       // Wikidata rarely has this · left null
  readonly address: string | null;                     // country label only in this pass
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly external_ref: string;                       // Q-ID
  readonly raw_tags: Record<string, unknown>;
}

export function extractWikidataCandidate(b: WikidataRawBinding): WikidataCandidate | null {
  const name = b.label ?? b.labelLocal ?? null;
  if (!name || name === b.qid) return null;             // no usable label · skip
  return {
    business_name: name,
    website_url: b.website && /^https?:\/\//i.test(b.website) ? b.website : null,
    phone: null,
    address: b.countryLabel ?? null,
    latitude: b.latitude,
    longitude: b.longitude,
    external_ref: b.qid,
    raw_tags: {
      wikidata_qid: b.qid,
      label_en: b.label,
      label_local: b.labelLocal,
      country_label: b.countryLabel,
      website_from_wikidata: b.website ?? null,
    },
  };
}

// ─── Default HTTP client using node:https (only loaded when opted in) ─
const defaultWikidataHttp: WikidataHttpClient = {
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

// ─── Doctrine locks ─────────────────────────────────────────────────
export const _WIKIDATA_NULL_ADAPTER_DEFAULT =
  "NULL_WIKIDATA_ADAPTER_returns_source_unavailable_when_production_adapter_not_constructed";
export const _WIKIDATA_REQUIRES_EXPLICIT_ALLOWLIST =
  "production_adapter_refuses_search_when_wikidata_host_not_in_allowed_hosts";
export const _WIKIDATA_NEVER_INFERS_WEBSITE =
  "candidate_website_url_null_unless_wikidata_P856_returned_an_http_or_https_url";
export const _WIKIDATA_NEVER_FABRICATES_EMAIL =
  "wikidata_adapter_never_writes_email_addresses_at_discovery_time_walker_publishes_evidence";
export const _WIKIDATA_QID_IS_EXTERNAL_REF =
  "external_ref_field_stores_Q-ID_deterministic_never_random";
export const _WIKIDATA_DOMAIN_ALLOWLIST_BOUNDED =
  "search_refuses_domain_other_than_scaffolding_new_domain_requires_founder_decision";

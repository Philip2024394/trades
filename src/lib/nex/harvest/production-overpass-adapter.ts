// src/lib/nex/harvest/production-overpass-adapter.ts
//
// NEX 24/7 World Harvest Engine · Production Overpass Adapter
// Founder-authorised programme · 2026-09-22.
//
// The one missing wire-in for Gate #1 real-world activation.
// Implements the existing OverpassAdapter interface (H3) without
// creating any new gate, database, or architecture.
//
// GOVERNANCE HARD-LOCKS:
//   * Constructor MUST take explicit allowed_hosts · empty list = refuses everything
//   * Host of probe input MUST be in allowed_hosts · else returns adapter_dormant
//   * Real HTTP goes via node:https (lazy dynamic import · zero-cost when not used)
//   * Injectable HTTP client for tests · production path never mocked away
//   * Timeout enforced per-call · deadline hardcoded ceiling 60_000ms
//   * Size cap enforced per-call · body truncated at max_bytes · returns parse_error
//   * NULL_OVERPASS_ADAPTER remains the module default · this class is opt-in only
//   * No robots.txt (Overpass /api/interpreter is a query API not a scraped site)
//   * User-Agent identifies NEX per OSM community etiquette

import type {
  OverpassAdapter, OverpassProbeInput, OverpassProbeResult, OverpassRawElement,
} from "./overpass-adapter";
import { parseOverpassResponse } from "./overpass-adapter";

export interface HttpClient {
  request(input: {
    url: string;
    method: "POST";
    headers: Record<string, string>;
    body: string;
    timeout_ms: number;
    max_bytes: number;
  }): Promise<{
    status: number;
    body_text: string;
    body_bytes: number;
    truncated: boolean;
  }>;
}

export interface ProductionOverpassAdapterOptions {
  /** Founder-signed set of hosts this adapter is permitted to POST to.
   *  MUST be non-empty at instantiation for the adapter to do any work.
   *  An empty allowed_hosts list is a valid construction — the adapter
   *  then refuses every probe with adapter_dormant. */
  readonly allowed_hosts: readonly string[];
  /** Injectable HTTP client · defaults to node:https-backed implementation. */
  readonly http_client?: HttpClient;
  /** Default hard ceiling on per-call timeout in ms. Never exceeded. */
  readonly hard_timeout_ceiling_ms?: number;
  /** Default hard ceiling on per-call response bytes. Never exceeded. */
  readonly hard_bytes_ceiling?: number;
  /** Attribution identifier · appears in logs + source_id. */
  readonly source_id?: string;
  /** User-Agent header. Overpass community expects a reachable contact. */
  readonly user_agent?: string;
}

const DEFAULT_USER_AGENT =
  "NEX-Networkers-Bot/1.0 (+https://thenetworkers.app · Founder-signed allowlist only · ODbL-attribution-respected)";
const DEFAULT_TIMEOUT_CEILING_MS = 60_000;
const DEFAULT_BYTES_CEILING = 20 * 1024 * 1024;   // 20 MB · Overpass responses can be larger than a normal page

export class ProductionOverpassAdapter implements OverpassAdapter {
  readonly source_id: string;
  private readonly allowed: Set<string>;
  private readonly http: HttpClient;
  private readonly hard_timeout_ceiling_ms: number;
  private readonly hard_bytes_ceiling: number;
  private readonly user_agent: string;

  constructor(opts: ProductionOverpassAdapterOptions) {
    this.source_id = opts.source_id ?? "production-overpass";
    this.allowed = new Set(opts.allowed_hosts.map(h => h.toLowerCase()));
    this.http = opts.http_client ?? defaultHttpClient;
    this.hard_timeout_ceiling_ms = opts.hard_timeout_ceiling_ms ?? DEFAULT_TIMEOUT_CEILING_MS;
    this.hard_bytes_ceiling = opts.hard_bytes_ceiling ?? DEFAULT_BYTES_CEILING;
    this.user_agent = opts.user_agent ?? DEFAULT_USER_AGENT;
  }

  async probe(input: OverpassProbeInput): Promise<OverpassProbeResult> {
    const started = Date.now();
    const host_key = String(input.host || "").toLowerCase();

    // Empty allowlist → adapter refuses every call · safe by construction
    if (this.allowed.size === 0) {
      return this.dormant("no_allowed_hosts_configured", host_key, started);
    }
    if (!this.allowed.has(host_key)) {
      return this.dormant(`host ${host_key} not in adapter allowed_hosts`, input.host, started);
    }

    const url = `https://${host_key}/api/interpreter`;
    const timeout_ms = Math.min(
      Math.max(1000, Number(input.timeout_ms) || DEFAULT_TIMEOUT_CEILING_MS),
      this.hard_timeout_ceiling_ms,
    );
    const body = `data=${encodeURIComponent(input.query)}`;

    let resp;
    try {
      resp = await this.http.request({
        url,
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "user-agent": this.user_agent,
          "accept": "application/json",
        },
        body,
        timeout_ms,
        max_bytes: this.hard_bytes_ceiling,
      });
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      return {
        kind: "unavailable",
        elements: [],
        bytes: 0,
        ms: Date.now() - started,
        endpoint_used: url,
        note: `network error: ${msg}`,
      };
    }

    if (resp.status === 429) {
      return {
        kind: "rate_limited",
        elements: [],
        bytes: resp.body_bytes,
        ms: Date.now() - started,
        endpoint_used: url,
        note: `HTTP 429 rate limited by ${host_key}`,
      };
    }
    if (resp.status >= 500 && resp.status < 600) {
      return {
        kind: "unavailable",
        elements: [],
        bytes: resp.body_bytes,
        ms: Date.now() - started,
        endpoint_used: url,
        note: `HTTP ${resp.status} from ${host_key}`,
      };
    }
    if (resp.truncated) {
      return {
        kind: "parse_error",
        elements: [],
        bytes: resp.body_bytes,
        ms: Date.now() - started,
        endpoint_used: url,
        note: `response body exceeded ${this.hard_bytes_ceiling} bytes · truncated`,
      };
    }
    if (resp.status < 200 || resp.status >= 300) {
      return {
        kind: "unavailable",
        elements: [],
        bytes: resp.body_bytes,
        ms: Date.now() - started,
        endpoint_used: url,
        note: `HTTP ${resp.status} from ${host_key}`,
      };
    }

    // Strict JSON parse first · a real Overpass response is always JSON.
    // Malformed body = real failure · never treated as "zero results".
    let parsed: any;
    try {
      parsed = JSON.parse(resp.body_text);
    } catch {
      return {
        kind: "parse_error",
        elements: [],
        bytes: resp.body_bytes,
        ms: Date.now() - started,
        endpoint_used: url,
        note: "response body was not valid JSON",
      };
    }
    if (!parsed || !Array.isArray(parsed.elements)) {
      return {
        kind: "parse_error",
        elements: [],
        bytes: resp.body_bytes,
        ms: Date.now() - started,
        endpoint_used: url,
        note: "response.elements was not an array",
      };
    }
    // Delegate the actual element parsing to the Session-6 authoritative primitive.
    const elements: readonly OverpassRawElement[] = parseOverpassResponse(resp.body_text);
    return {
      kind: elements.length > 0 ? "responded" : "responded_zero",
      elements,
      bytes: resp.body_bytes,
      ms: Date.now() - started,
      endpoint_used: url,
      note: null,
    };
  }

  private dormant(reason: string, host: string, started: number): OverpassProbeResult {
    return {
      kind: "adapter_dormant",
      elements: [],
      bytes: 0,
      ms: Date.now() - started,
      endpoint_used: host,
      note: reason,
    };
  }
}

// ─── Default HTTP client backed by node:https (lazy dynamic import) ─
const defaultHttpClient: HttpClient = {
  async request({ url, method, headers, body, timeout_ms, max_bytes }) {
    const { request: httpsRequest } = await import("node:https");
    const u = new URL(url);
    return new Promise((resolve, reject) => {
      const req = httpsRequest({
        method,
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        headers: {
          ...headers,
          "content-length": Buffer.byteLength(body, "utf8").toString(),
        },
        timeout: timeout_ms,
      }, (res) => {
        const chunks: Buffer[] = [];
        let total = 0;
        let truncated = false;
        res.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total > max_bytes) {
            truncated = true;
            res.destroy();
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          const body_text = truncated ? "" : Buffer.concat(chunks).toString("utf8");
          resolve({
            status: res.statusCode ?? 0,
            body_text,
            body_bytes: total,
            truncated,
          });
        });
        res.on("error", (err) => reject(err));
      });
      req.on("timeout", () => { req.destroy(new Error(`timeout after ${timeout_ms}ms`)); });
      req.on("error", (err) => reject(err));
      req.write(body);
      req.end();
    });
  },
};

// ─── Structural boundary markers ───────────────────────────────────
export const _PRODUCTION_OVERPASS_REQUIRES_EXPLICIT_ALLOWLIST =
  "constructor_takes_allowed_hosts_empty_list_refuses_every_probe_with_adapter_dormant";
export const _PRODUCTION_OVERPASS_NULL_ADAPTER_REMAINS_DEFAULT =
  "module_default_stays_NULL_OVERPASS_ADAPTER_production_is_founder_opt_in_at_instantiation";
export const _PRODUCTION_OVERPASS_USES_SESSION_6_PARSER =
  "parseOverpassResponse_is_authoritative_never_reimplemented";
export const _PRODUCTION_OVERPASS_NEVER_FABRICATES =
  "elements_are_only_ever_the_result_of_a_real_HTTP_response_never_synthesised";
export const _PRODUCTION_OVERPASS_TIMEOUT_AND_SIZE_CAPPED =
  "hard_timeout_ceiling_ms_and_hard_bytes_ceiling_enforced_per_call";

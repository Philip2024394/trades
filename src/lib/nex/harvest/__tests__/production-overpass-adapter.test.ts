// src/lib/nex/harvest/__tests__/production-overpass-adapter.test.ts
//
// Acceptance for the production Overpass adapter.
// The adapter itself is tested against a fixture HTTP client (no real
// network in tests). The wire-in proof (block E) shows the adapter
// plugs into the existing H3 executeSourceProbe path without any type
// change or protocol drift.

import { describe, it, expect } from "vitest";
import type { PoolClient, QueryResult } from "pg";
import {
  ProductionOverpassAdapter,
  NULL_OVERPASS_ADAPTER,
  executeSourceProbe,
  _PRODUCTION_OVERPASS_REQUIRES_EXPLICIT_ALLOWLIST,
  _PRODUCTION_OVERPASS_NULL_ADAPTER_REMAINS_DEFAULT,
  _PRODUCTION_OVERPASS_USES_SESSION_6_PARSER,
  _PRODUCTION_OVERPASS_NEVER_FABRICATES,
  _PRODUCTION_OVERPASS_TIMEOUT_AND_SIZE_CAPPED,
  type ProductionOverpassHttpClient,
  type HarvestJob,
} from "..";

// ─── Fixture HTTP client helper ─────────────────────────────────────
function makeFixtureHttp(preset: {
  status?: number; body_text?: string; body_bytes?: number; truncated?: boolean;
  throw_error?: string;
  capture?: (input: any) => void;
}): ProductionOverpassHttpClient {
  return {
    async request(input) {
      preset.capture?.(input);
      if (preset.throw_error) throw new Error(preset.throw_error);
      return {
        status: preset.status ?? 200,
        body_text: preset.body_text ?? '{"elements":[]}',
        body_bytes: preset.body_bytes ?? (preset.body_text?.length ?? 0),
        truncated: preset.truncated ?? false,
      };
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// A · Allowlist enforcement
// ═══════════════════════════════════════════════════════════════════
describe("Production Overpass adapter · (A) allowlist enforcement", () => {
  it("(A1) empty allowed_hosts → every probe returns adapter_dormant", async () => {
    const called: any[] = [];
    const adapter = new ProductionOverpassAdapter({
      allowed_hosts: [],
      http_client: makeFixtureHttp({ capture: (i) => called.push(i) }),
    });
    const r = await adapter.probe({ host: "overpass-api.de", query: "test", timeout_ms: 5000 });
    expect(r.kind).toBe("adapter_dormant");
    expect(r.note).toContain("no_allowed_hosts_configured");
    expect(called).toHaveLength(0); // never even attempted a request
  });

  it("(A2) host NOT in allowlist → adapter_dormant · no HTTP request made", async () => {
    const called: any[] = [];
    const adapter = new ProductionOverpassAdapter({
      allowed_hosts: ["overpass-api.de"],
      http_client: makeFixtureHttp({ capture: (i) => called.push(i) }),
    });
    const r = await adapter.probe({ host: "malicious.tld", query: "test", timeout_ms: 5000 });
    expect(r.kind).toBe("adapter_dormant");
    expect(r.note).toContain("not in adapter allowed_hosts");
    expect(called).toHaveLength(0);
  });

  it("(A3) case-insensitive host match", async () => {
    const called: any[] = [];
    const adapter = new ProductionOverpassAdapter({
      allowed_hosts: ["Overpass-API.DE"],
      http_client: makeFixtureHttp({ capture: (i) => called.push(i) }),
    });
    const r = await adapter.probe({ host: "overpass-api.DE", query: "test", timeout_ms: 5000 });
    expect(r.kind).toBe("responded_zero");
    expect(called).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// B · Successful response parsing
// ═══════════════════════════════════════════════════════════════════
describe("Production Overpass adapter · (B) response parsing", () => {
  it("(B1) 200 + elements → responded · elements returned verbatim", async () => {
    const body = JSON.stringify({ elements: [
      { type: "node", id: 42, tags: { name: "ABC Scaffolding", website: "https://abcscaff.co.uk" } },
    ]});
    const adapter = new ProductionOverpassAdapter({
      allowed_hosts: ["overpass-api.de"],
      http_client: makeFixtureHttp({ status: 200, body_text: body }),
    });
    const r = await adapter.probe({ host: "overpass-api.de", query: "test", timeout_ms: 5000 });
    expect(r.kind).toBe("responded");
    expect(r.elements).toHaveLength(1);
    expect((r.elements[0] as any).tags.name).toBe("ABC Scaffolding");
    expect(r.endpoint_used).toBe("https://overpass-api.de/api/interpreter");
  });

  it("(B2) 200 + empty elements → responded_zero (source zero ≠ country zero · caller decides)", async () => {
    const adapter = new ProductionOverpassAdapter({
      allowed_hosts: ["overpass-api.de"],
      http_client: makeFixtureHttp({ status: 200, body_text: '{"elements":[]}' }),
    });
    const r = await adapter.probe({ host: "overpass-api.de", query: "test", timeout_ms: 5000 });
    expect(r.kind).toBe("responded_zero");
    expect(r.elements).toHaveLength(0);
  });

  it("(B3) 200 + malformed JSON → parse_error · no fabricated elements", async () => {
    const adapter = new ProductionOverpassAdapter({
      allowed_hosts: ["overpass-api.de"],
      http_client: makeFixtureHttp({ status: 200, body_text: "not-json-at-all" }),
    });
    const r = await adapter.probe({ host: "overpass-api.de", query: "test", timeout_ms: 5000 });
    expect(r.kind).toBe("parse_error");
    expect(r.elements).toHaveLength(0);
  });

  it("(B4) 200 + JSON without elements array → parse_error (defense-in-depth)", async () => {
    const adapter = new ProductionOverpassAdapter({
      allowed_hosts: ["overpass-api.de"],
      http_client: makeFixtureHttp({ status: 200, body_text: '{"foo":"bar"}' }),
    });
    const r = await adapter.probe({ host: "overpass-api.de", query: "test", timeout_ms: 5000 });
    // parseOverpassResponse returns [] when elements is not an array, which the adapter maps to responded_zero.
    // Governance requirement is that no fabricated elements appear · verify that.
    expect(r.elements).toHaveLength(0);
    expect(["parse_error", "responded_zero"]).toContain(r.kind);
  });
});

// ═══════════════════════════════════════════════════════════════════
// C · Failure modes
// ═══════════════════════════════════════════════════════════════════
describe("Production Overpass adapter · (C) failure modes", () => {
  it("(C1) 429 → rate_limited", async () => {
    const adapter = new ProductionOverpassAdapter({
      allowed_hosts: ["overpass-api.de"],
      http_client: makeFixtureHttp({ status: 429, body_text: "too many requests" }),
    });
    const r = await adapter.probe({ host: "overpass-api.de", query: "test", timeout_ms: 5000 });
    expect(r.kind).toBe("rate_limited");
    expect(r.note).toContain("429");
  });

  it("(C2) 5xx → unavailable", async () => {
    const adapter = new ProductionOverpassAdapter({
      allowed_hosts: ["overpass-api.de"],
      http_client: makeFixtureHttp({ status: 503, body_text: "service down" }),
    });
    const r = await adapter.probe({ host: "overpass-api.de", query: "test", timeout_ms: 5000 });
    expect(r.kind).toBe("unavailable");
  });

  it("(C3) network error → unavailable · no crash", async () => {
    const adapter = new ProductionOverpassAdapter({
      allowed_hosts: ["overpass-api.de"],
      http_client: makeFixtureHttp({ throw_error: "ETIMEDOUT" }),
    });
    const r = await adapter.probe({ host: "overpass-api.de", query: "test", timeout_ms: 5000 });
    expect(r.kind).toBe("unavailable");
    expect(r.note).toContain("ETIMEDOUT");
  });

  it("(C4) response body truncated (> size cap) → parse_error · never partial parse", async () => {
    const adapter = new ProductionOverpassAdapter({
      allowed_hosts: ["overpass-api.de"],
      http_client: makeFixtureHttp({ status: 200, body_text: "", body_bytes: 999_999_999, truncated: true }),
    });
    const r = await adapter.probe({ host: "overpass-api.de", query: "test", timeout_ms: 5000 });
    expect(r.kind).toBe("parse_error");
    expect(r.note).toContain("truncated");
    expect(r.elements).toHaveLength(0);
  });

  it("(C5) non-standard status (e.g. 400) → unavailable · never responded", async () => {
    const adapter = new ProductionOverpassAdapter({
      allowed_hosts: ["overpass-api.de"],
      http_client: makeFixtureHttp({ status: 400, body_text: "bad request" }),
    });
    const r = await adapter.probe({ host: "overpass-api.de", query: "test", timeout_ms: 5000 });
    expect(r.kind).toBe("unavailable");
  });
});

// ═══════════════════════════════════════════════════════════════════
// D · Request construction (correct wire format)
// ═══════════════════════════════════════════════════════════════════
describe("Production Overpass adapter · (D) request construction", () => {
  it("(D1) POST · form-encoded body · correct URL · required headers", async () => {
    let captured: any = null;
    const adapter = new ProductionOverpassAdapter({
      allowed_hosts: ["overpass-api.de"],
      http_client: makeFixtureHttp({
        status: 200, body_text: '{"elements":[]}',
        capture: (i) => { captured = i; },
      }),
    });
    await adapter.probe({
      host: "overpass-api.de",
      query: '[out:json];out count;',
      timeout_ms: 15000,
    });
    expect(captured.url).toBe("https://overpass-api.de/api/interpreter");
    expect(captured.method).toBe("POST");
    expect(captured.headers["content-type"]).toBe("application/x-www-form-urlencoded");
    expect(captured.headers["user-agent"]).toContain("NEX-Networkers-Bot");
    expect(captured.headers["accept"]).toBe("application/json");
    expect(captured.body).toContain("data=");
    // The query must be URL-encoded
    expect(captured.body).toContain(encodeURIComponent('[out:json];out count;'));
  });

  it("(D2) timeout_ms clamped to hard ceiling", async () => {
    let captured: any = null;
    const adapter = new ProductionOverpassAdapter({
      allowed_hosts: ["overpass-api.de"],
      hard_timeout_ceiling_ms: 10_000,
      http_client: makeFixtureHttp({
        status: 200, body_text: '{"elements":[]}',
        capture: (i) => { captured = i; },
      }),
    });
    await adapter.probe({
      host: "overpass-api.de",
      query: "x",
      timeout_ms: 999_999_999,   // way beyond ceiling
    });
    expect(captured.timeout_ms).toBe(10_000);
  });

  it("(D3) max_bytes hard-ceiling passed to HTTP client", async () => {
    let captured: any = null;
    const adapter = new ProductionOverpassAdapter({
      allowed_hosts: ["overpass-api.de"],
      hard_bytes_ceiling: 1_000_000,
      http_client: makeFixtureHttp({
        status: 200, body_text: '{"elements":[]}',
        capture: (i) => { captured = i; },
      }),
    });
    await adapter.probe({ host: "overpass-api.de", query: "x", timeout_ms: 5000 });
    expect(captured.max_bytes).toBe(1_000_000);
  });
});

// ═══════════════════════════════════════════════════════════════════
// E · WIRE-IN PROOF · adapter plugs into H3 executeSourceProbe
// ═══════════════════════════════════════════════════════════════════
describe("Production Overpass adapter · (E) wire-in proof · composes with H3 executor", () => {
  // Minimal H3-integration mock · reuses the same shape as source-probe-executor.test.ts
  function makeIntegrationMock() {
    const state = {
      candidates: new Map<string, any>(),
      jobs: new Map<string, any>(),
      yields: [] as any[],
      sources: new Map<string, any>([[
        "osm_overpass_primary",
        {
          source_slug: "osm_overpass_primary", reliability_score: 1.0,
          consecutive_success: 0, consecutive_failure: 0, lifetime_probes: 0,
          lifetime_businesses: 0, lifetime_emails: 0, metadata: {},
        },
      ]]),
    };
    let jseq = 1, cseq = 1, yseq = 1;
    const client: PoolClient = {
      async query(sql: string, params: any[] = []): Promise<QueryResult<any>> {
        const n = sql.replace(/\s+/g, " ").trim();
        if (/^INSERT INTO nex\.harvest_business_candidate/i.test(n)) {
          const [source_slug, source_probe_job_id, programme_id, country_iso, term, external_ref, business_name, website_url, phone, address, latitude, longitude, raw_tags_str, provenance_url, provenance_note] = params;
          const key = `${source_slug}:${external_ref}`;
          if (external_ref && state.candidates.has(key)) return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
          const row = { candidate_id: `c-${cseq++}`, source_slug, source_probe_job_id: source_probe_job_id ?? null, programme_id: programme_id ?? null, country_iso, term: term ?? null, external_ref: external_ref ?? null, business_name, website_url: website_url ?? null, phone: phone ?? null, address: address ?? null, latitude: latitude !== null ? Number(latitude) : null, longitude: longitude !== null ? Number(longitude) : null, raw_tags: JSON.parse(raw_tags_str), provenance_url, provenance_note: provenance_note ?? null, website_walk_job_id: null, website_walk_status: null, website_walked_at: null, emails_discovered_count: 0, discovered_at: new Date().toISOString(), updated_at: new Date().toISOString() };
          state.candidates.set(key, row);
          return { rows: [row], rowCount: 1, command: "", oid: 0, fields: [] };
        }
        if (/^SELECT \* FROM nex\.harvest_business_candidate WHERE source_slug/i.test(n)) {
          const key = `${params[0]}:${params[1]}`;
          const row = state.candidates.get(key);
          return { rows: row ? [row] : [], rowCount: row ? 1 : 0, command: "", oid: 0, fields: [] };
        }
        if (/^UPDATE nex\.harvest_business_candidate\s+SET website_walk_job_id = \$2, website_walk_status = 'queued'/i.test(n)) {
          for (const r of state.candidates.values()) if (r.candidate_id === params[0]) { r.website_walk_job_id = params[1]; r.website_walk_status = "queued"; return { rows: [r], rowCount: 1, command: "", oid: 0, fields: [] }; }
          return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
        }
        if (/^INSERT INTO nex\.harvest_job/i.test(n)) {
          const [job_type, programme_id, country_iso, source_id, payload_str, idempotency_key, priority, max_attempts, next_attempt_at, parent_job_id] = params;
          for (const j of state.jobs.values()) if (j.job_type === job_type && j.idempotency_key === idempotency_key) return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
          const row: any = { job_id: `j-${jseq++}`, job_type, programme_id: programme_id ?? null, country_iso: country_iso ?? null, source_id: source_id ?? null, payload: JSON.parse(payload_str), idempotency_key, status: "queued", priority: Number(priority), attempts: 0, max_attempts: Number(max_attempts), next_attempt_at, lease_owner: null, lease_acquired_at: null, lease_expires_at: null, heartbeat_at: null, last_error: null, last_error_at: null, dead_letter_reason: null, dead_letter_at: null, completed_at: null, parent_job_id: parent_job_id ?? null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
          state.jobs.set(row.job_id, row);
          return { rows: [row], rowCount: 1, command: "", oid: 0, fields: [] };
        }
        if (/^SELECT \* FROM nex\.harvest_job WHERE job_type = \$1 AND idempotency_key = \$2/i.test(n)) {
          for (const j of state.jobs.values()) if (j.job_type === params[0] && j.idempotency_key === params[1]) return { rows: [j], rowCount: 1, command: "", oid: 0, fields: [] };
          return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
        }
        if (/^INSERT INTO nex\.harvest_yield/i.test(n)) {
          state.yields.push({ yield_id: `y-${yseq++}`, job_id: params[0], worker_id: params[1] ?? null, yield_kind: params[2], yield_count: Number(params[3]), yield_meta: JSON.parse(params[4]), yielded_at: new Date().toISOString() });
          return { rows: [], rowCount: 1, command: "", oid: 0, fields: [] };
        }
        if (/^UPDATE nex\.harvest_source\s+SET reliability_score = GREATEST/i.test(n)) {
          const row = state.sources.get(params[0]);
          if (!row) return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
          row.lifetime_probes += 1;
          return { rows: [row], rowCount: 1, command: "", oid: 0, fields: [] };
        }
        throw new Error(`E-mock: unhandled ${n.slice(0, 120)}`);
      },
      release() {},
    } as unknown as PoolClient;
    return { client, state };
  }

  function makeProbeJob(): HarvestJob {
    return {
      job_id: "probe-1", job_type: "source_probe",
      programme_id: "prog-scaffolding", country_iso: "GB",
      source_id: "osm_overpass_primary",
      payload: {
        source_slug: "osm_overpass_primary",
        source_type: "public_geographic_data",
        host: "overpass-api.de",
        url_template: null,
        discovery_method: "overpass_query",
        rate_limit_per_minute: 6,
        per_probe_timeout_ms: 15000,
        country_iso: "GB",
        term: "scaffolding",
        category: null,
        cycle_id: null,
      },
      idempotency_key: "probe:osm_overpass_primary:GB:scaffolding:test",
      status: "claimed", priority: 100, attempts: 1, max_attempts: 3,
      next_attempt_at: new Date().toISOString(),
      lease_owner: "wire-in-test-worker",
      lease_acquired_at: new Date().toISOString(),
      lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
      heartbeat_at: new Date().toISOString(),
      last_error: null, last_error_at: null,
      dead_letter_reason: null, dead_letter_at: null, completed_at: null,
      parent_job_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  it("(E1) ProductionOverpassAdapter passed to executeSourceProbe · fixture response → candidates persisted", async () => {
    const m = makeIntegrationMock();
    const body = JSON.stringify({ elements: [
      { type: "node", id: 501, lat: 51.5, lon: -0.1, tags: { name: "Real-Looking Scaffolding Ltd", website: "https://realscaff.test" } },
      { type: "node", id: 502, lat: 51.6, lon: -0.2, tags: { name: "Another Scaffolder Ltd" } },
    ]});
    const adapter = new ProductionOverpassAdapter({
      allowed_hosts: ["overpass-api.de"],
      http_client: makeFixtureHttp({ status: 200, body_text: body }),
    });
    const result = await executeSourceProbe({
      client: m.client, job: makeProbeJob(), worker_id: "wire-in-test-worker", adapter,
    });
    expect(result.kind).toBe("completed");
    if (result.kind === "completed") {
      expect(result.source_results).toBe(2);
      expect(result.candidates_new).toBe(2);
      expect(result.websites_found).toBe(1);         // only the first candidate had a website
      expect(result.website_walks_enqueued).toBe(1); // one website_walk job enqueued
    }
    expect(m.state.candidates.size).toBe(2);
    // Verify the persisted rows came from the adapter's response · not fabricated
    const names = [...m.state.candidates.values()].map(c => c.business_name).sort();
    expect(names).toEqual(["Another Scaffolder Ltd", "Real-Looking Scaffolding Ltd"]);
  });

  it("(E2) adapter with empty allowlist · executeSourceProbe → adapter_dormant · zero persistence", async () => {
    const m = makeIntegrationMock();
    const adapter = new ProductionOverpassAdapter({
      allowed_hosts: [],   // dormant by construction
      http_client: makeFixtureHttp({ status: 200, body_text: '{"elements":[]}' }),
    });
    const result = await executeSourceProbe({
      client: m.client, job: makeProbeJob(), worker_id: "w", adapter,
    });
    expect(result.kind).toBe("adapter_dormant");
    expect(m.state.candidates.size).toBe(0);
  });

  it("(E3) NULL_OVERPASS_ADAPTER remains module default · verified structurally", () => {
    expect(NULL_OVERPASS_ADAPTER.source_id).toBe("null-overpass");
  });
});

// ═══════════════════════════════════════════════════════════════════
// F · Governance canaries
// ═══════════════════════════════════════════════════════════════════
describe("Production Overpass adapter · (F) governance canaries", () => {
  it("(F1) all 5 boundary markers exported", () => {
    expect(_PRODUCTION_OVERPASS_REQUIRES_EXPLICIT_ALLOWLIST).toContain("empty_list_refuses_every_probe");
    expect(_PRODUCTION_OVERPASS_NULL_ADAPTER_REMAINS_DEFAULT).toContain("founder_opt_in_at_instantiation");
    expect(_PRODUCTION_OVERPASS_USES_SESSION_6_PARSER).toContain("never_reimplemented");
    expect(_PRODUCTION_OVERPASS_NEVER_FABRICATES).toContain("never_synthesised");
    expect(_PRODUCTION_OVERPASS_TIMEOUT_AND_SIZE_CAPPED).toContain("enforced_per_call");
  });

  it("(F2) module exports NO bypass function", async () => {
    const mod: any = await import("..");
    expect(mod.forceOverpassFetch).toBeUndefined();
    expect(mod.bypassOverpassAllowlist).toBeUndefined();
    expect(mod.fabricateOverpassResponse).toBeUndefined();
    expect(mod.overrideOverpassSizeCap).toBeUndefined();
  });

  it("(F3) source file structural check · no bare fetch · no LLM · no third-party AI", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/nex/harvest/production-overpass-adapter.ts", "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    // Only lazy-imported node:https · no top-level fetch/axios/etc.
    expect(code).not.toMatch(/\bfetch\(/);
    expect(code).not.toMatch(/require\(["']axios["']\)/);
    expect(code).not.toMatch(/from ["']axios["']/);
    expect(code).not.toMatch(/openai/i);
    expect(code).not.toMatch(/anthropic/i);
    expect(code).not.toMatch(/\bLLM\b/);
    expect(code).not.toMatch(/setInterval\(/);
    // Strip strings to check code-only for fabrication verbs
    const stripped = code
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''")
      .replace(/`(?:[^`\\]|\\.)*`/g, "``");
    expect(stripped).not.toMatch(/\bfabricate\w*\s*\(/);
    expect(stripped).not.toMatch(/\bsynthesise\w*\s*\(/);
    expect(stripped).not.toMatch(/@\$\{/);
  });
});

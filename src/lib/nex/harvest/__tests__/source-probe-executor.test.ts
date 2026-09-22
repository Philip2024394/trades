// src/lib/nex/harvest/__tests__/source-probe-executor.test.ts
//
// NEX 24/7 World Harvest Engine · Wave H3 · Source-probe executor acceptance
// Founder-authorised programme · 2026-09-22.
//
// THE ARCHITECTURAL BREAKTHROUGH ACCEPTANCE:
//   Overpass returned 3 elements
//     → 3 business_candidate rows persisted
//     → 2 have websites → 2 website_walk H1 jobs enqueued
//     → 1 has no website → candidate retained, no walk enqueued (never fabricated)
//     → Running executor again → 0 new rows, 0 new walk jobs (idempotent)
//   Source zero_results does NOT mark country complete.

import { describe, it, expect } from "vitest";
import type { PoolClient, QueryResult } from "pg";
import {
  executeSourceProbe, makeFixtureOverpassAdapter, NULL_OVERPASS_ADAPTER,
  buildOverpassQuery, extractCandidateFromElement, canonicaliseWebsite,
  parseOverpassResponse,
  _EXECUTOR_RETAINS_EVERY_BUSINESS_ELEMENT,
  _EXECUTOR_NEVER_FABRICATES_WEBSITE,
  _EXECUTOR_NEVER_FABRICATES_EMAIL,
  _EXECUTOR_SOURCE_ZERO_NOT_COUNTRY_ZERO,
  _EXECUTOR_WEBSITE_JOBS_ARE_DURABLE,
  _OVERPASS_NEVER_FABRICATES_WEBSITE,
  _OVERPASS_NEVER_FABRICATES_EMAIL,
  _OVERPASS_NULL_ADAPTER_DEFAULT,
  _CANDIDATE_IDEMPOTENT_INSERT,
  _CANDIDATE_WEBSITE_URL_NULLABLE,
  type HarvestJob, type OverpassRawElement,
} from "..";

// ═══════════════════════════════════════════════════════════════════
// Combined mock (harvest_job + harvest_source + harvest_business_candidate
// + harvest_yield) sufficient for the executor path.
// ═══════════════════════════════════════════════════════════════════
function makeH3Mock() {
  const state = {
    jobs: new Map<string, any>(),
    candidates: new Map<string, any>(),   // key: `${source_slug}:${external_ref}`
    yields: [] as any[],
    sources: new Map<string, any>(),
  };
  let job_seq = 1;
  let candidate_seq = 1;
  let yield_seq = 1;

  const seedSource = (slug: string) => {
    state.sources.set(slug, {
      source_slug: slug, reliability_score: 1.0, consecutive_success: 0, consecutive_failure: 0,
      lifetime_probes: 0, lifetime_businesses: 0, lifetime_emails: 0,
      last_attempt_at: null, last_success_at: null, last_failure_at: null,
      last_zero_result_at: null, last_yield_at: null, metadata: {},
    });
  };

  const client: PoolClient = {
    async query(sql: string, params: any[] = []): Promise<QueryResult<any>> {
      const norm = sql.replace(/\s+/g, " ").trim();

      // ─── harvest_business_candidate INSERT ───
      if (/^INSERT INTO nex\.harvest_business_candidate/i.test(norm)) {
        const [
          source_slug, source_probe_job_id, programme_id, country_iso, term, external_ref,
          business_name, website_url, phone, address, latitude, longitude,
          raw_tags_str, provenance_url, provenance_note,
        ] = params;
        const key = `${source_slug}:${external_ref}`;
        if (external_ref && state.candidates.has(key)) {
          return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
        }
        const now = new Date().toISOString();
        const row = {
          candidate_id: `cand-${candidate_seq++}`,
          source_slug, source_probe_job_id: source_probe_job_id ?? null,
          programme_id: programme_id ?? null, country_iso, term: term ?? null,
          external_ref: external_ref ?? null,
          business_name, website_url: website_url ?? null,
          phone: phone ?? null, address: address ?? null,
          latitude: latitude !== null ? Number(latitude) : null,
          longitude: longitude !== null ? Number(longitude) : null,
          raw_tags: JSON.parse(raw_tags_str),
          provenance_url, provenance_note: provenance_note ?? null,
          website_walk_job_id: null, website_walk_status: null,
          website_walked_at: null, emails_discovered_count: 0,
          discovered_at: now, updated_at: now,
        };
        state.candidates.set(key, row);
        return { rows: [row], rowCount: 1, command: "", oid: 0, fields: [] };
      }
      // ─── SELECT existing candidate ───
      if (/^SELECT \* FROM nex\.harvest_business_candidate WHERE source_slug = \$1 AND external_ref = \$2/i.test(norm)) {
        const [ss, er] = params;
        const key = `${ss}:${er}`;
        const row = state.candidates.get(key);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0, command: "", oid: 0, fields: [] };
      }
      // ─── UPDATE candidate · attach walk job ───
      if (/^UPDATE nex\.harvest_business_candidate\s+SET website_walk_job_id = \$2, website_walk_status = 'queued'/i.test(norm)) {
        const [candidate_id, walk_job_id] = params;
        for (const row of state.candidates.values()) {
          if (row.candidate_id === candidate_id) {
            row.website_walk_job_id = walk_job_id;
            row.website_walk_status = "queued";
            row.updated_at = new Date().toISOString();
            return { rows: [row], rowCount: 1, command: "", oid: 0, fields: [] };
          }
        }
        return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
      }

      // ─── harvest_job INSERT (from enqueueJob) ───
      if (/^INSERT INTO nex\.harvest_job/i.test(norm)) {
        const [job_type, programme_id, country_iso, source_id, payload_str,
               idempotency_key, priority, max_attempts, next_attempt_at, parent_job_id] = params;
        for (const j of state.jobs.values()) {
          if (j.job_type === job_type && j.idempotency_key === idempotency_key) {
            return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
          }
        }
        const now = new Date().toISOString();
        const row = {
          job_id: `job-${job_seq++}`, job_type,
          programme_id: programme_id ?? null, country_iso: country_iso ?? null,
          source_id: source_id ?? null, payload: JSON.parse(payload_str), idempotency_key,
          status: "queued", priority: Number(priority), attempts: 0,
          max_attempts: Number(max_attempts), next_attempt_at,
          lease_owner: null, lease_acquired_at: null, lease_expires_at: null, heartbeat_at: null,
          last_error: null, last_error_at: null, dead_letter_reason: null,
          dead_letter_at: null, completed_at: null,
          parent_job_id: parent_job_id ?? null,
          created_at: now, updated_at: now,
        };
        state.jobs.set(row.job_id, row);
        return { rows: [row], rowCount: 1, command: "", oid: 0, fields: [] };
      }
      // ─── SELECT existing job by idempotency ───
      if (/^SELECT \* FROM nex\.harvest_job WHERE job_type = \$1 AND idempotency_key = \$2/i.test(norm)) {
        const [jt, ik] = params;
        for (const j of state.jobs.values()) if (j.job_type === jt && j.idempotency_key === ik) return { rows: [j], rowCount: 1, command: "", oid: 0, fields: [] };
        return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
      }

      // ─── harvest_yield INSERT ───
      if (/^INSERT INTO nex\.harvest_yield/i.test(norm)) {
        const [job_id, worker_id, yield_kind, yield_count, meta_str] = params;
        const row = {
          yield_id: `y-${yield_seq++}`, job_id, worker_id: worker_id ?? null,
          yield_kind, yield_count: Number(yield_count), yield_meta: JSON.parse(meta_str),
          yielded_at: new Date().toISOString(),
        };
        state.yields.push(row);
        return { rows: [row], rowCount: 1, command: "", oid: 0, fields: [] };
      }

      // ─── harvest_source · recordProbeAttempt UPDATE ───
      if (/^UPDATE nex\.harvest_source\s+SET reliability_score = GREATEST/i.test(norm)) {
        const slug = params[0];
        const row = state.sources.get(slug);
        if (!row) return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
        const delta_match = norm.match(/reliability_score \+ (-?[\d.]+)\)/);
        const delta = delta_match ? Number(delta_match[1]) : 0;
        row.reliability_score = Math.max(0, Math.min(1, row.reliability_score + delta));
        if (/consecutive_success = 0/.test(norm)) row.consecutive_success = 0;
        else if (/consecutive_success \+ 1/.test(norm)) row.consecutive_success += 1;
        if (/consecutive_failure = 0/.test(norm)) row.consecutive_failure = 0;
        else if (/consecutive_failure \+ 1/.test(norm)) row.consecutive_failure += 1;
        row.lifetime_probes += 1;
        row.last_attempt_at = new Date().toISOString();
        if (/last_success_at = /.test(norm)) {
          row.last_success_at = new Date().toISOString();
          row.lifetime_businesses += Number(params[1] ?? 0);
          row.lifetime_emails += Number(params[2] ?? 0);
        }
        if (/last_zero_result_at = /.test(norm)) row.last_zero_result_at = new Date().toISOString();
        if (/last_failure_at = /.test(norm)) row.last_failure_at = new Date().toISOString();
        return { rows: [row], rowCount: 1, command: "", oid: 0, fields: [] };
      }

      throw new Error(`h3-mock: unhandled SQL: ${norm.slice(0, 180)}`);
    },
    release() {},
  } as unknown as PoolClient;

  const enqueueProbeJob = (payload: any): HarvestJob => {
    const now = new Date().toISOString();
    const row: any = {
      job_id: `probe-${job_seq++}`, job_type: "source_probe",
      programme_id: "prog-scaffolding", country_iso: payload.country_iso,
      source_id: payload.source_slug, payload,
      idempotency_key: `probe:${payload.source_slug}:${payload.country_iso}:${payload.term}:test`,
      status: "claimed", priority: 100, attempts: 1, max_attempts: 3,
      next_attempt_at: now, lease_owner: "test-worker",
      lease_acquired_at: now, lease_expires_at: now, heartbeat_at: now,
      last_error: null, last_error_at: null, dead_letter_reason: null,
      dead_letter_at: null, completed_at: null, parent_job_id: null,
      created_at: now, updated_at: now,
    };
    state.jobs.set(row.job_id, row);
    return row as HarvestJob;
  };

  return { client, state, seedSource, enqueueProbeJob };
}

// ═══════════════════════════════════════════════════════════════════
// A · Pure query builder + parser + extractor
// ═══════════════════════════════════════════════════════════════════
describe("H3 · (A) pure query + parse + extract", () => {
  it("(A1) buildOverpassQuery is deterministic + escapes country ISO", () => {
    const q1 = buildOverpassQuery("scaffolding", "gb");
    const q2 = buildOverpassQuery("scaffolding", "gb");
    expect(q1).toBe(q2);
    expect(q1).toContain(`ISO3166-1"="GB"`);
    expect(q1).toContain("scaffolding");
  });

  it("(A2) parseOverpassResponse returns empty on malformed JSON · never throws", () => {
    expect(parseOverpassResponse("not json")).toEqual([]);
    expect(parseOverpassResponse("{}")).toEqual([]);
    expect(parseOverpassResponse(`{"elements":[]}`)).toEqual([]);
    const els = parseOverpassResponse(`{"elements":[{"type":"node","id":1}]}`);
    expect(els).toHaveLength(1);
  });

  it("(A3) extractCandidateFromElement returns null when no name (no anonymous candidates)", () => {
    const r = extractCandidateFromElement({ type: "node", id: 1, tags: {} });
    expect(r).toBeNull();
  });

  it("(A4) extractCandidateFromElement copies website VERBATIM · never fabricates", () => {
    const r = extractCandidateFromElement({
      type: "node", id: 42,
      tags: { name: "ABC Scaffolding", website: "https://abcscaff.co.uk" },
    });
    expect(r?.website_url).toBe("https://abcscaff.co.uk");
    // Same shape but no website → null
    const r2 = extractCandidateFromElement({ type: "node", id: 43, tags: { name: "XYZ Ltd" } });
    expect(r2?.website_url).toBeNull();
  });

  it("(A5) canonicaliseWebsite strips protocol + www + trailing slash · null on invalid", () => {
    expect(canonicaliseWebsite("https://Example.com/")).toBe("example.com");
    expect(canonicaliseWebsite("http://www.Example.com")).toBe("example.com");
    expect(canonicaliseWebsite("")).toBeNull();
    expect(canonicaliseWebsite("garbage")).toBeNull();
    expect(canonicaliseWebsite(null)).toBeNull();
  });

  it("(A6) external_ref is deterministic · same OSM node = same ref", () => {
    const a = extractCandidateFromElement({ type: "node", id: 100, tags: { name: "X" } });
    const b = extractCandidateFromElement({ type: "node", id: 100, tags: { name: "X" } });
    expect(a?.external_ref).toBe(b?.external_ref);
    expect(a?.external_ref).toBe("node/100");
  });
});

// ═══════════════════════════════════════════════════════════════════
// B · The critical bridge · retention proof
// ═══════════════════════════════════════════════════════════════════
describe("H3 · (B) retention · Overpass results become durable candidates", () => {
  const fixtureElements: OverpassRawElement[] = [
    { type: "node", id: 101, lat: 51.5, lon: -0.1, tags: { name: "ABC Scaffolding", website: "https://abcscaff.co.uk", phone: "+44 20 555 1111" } },
    { type: "node", id: 102, lat: 51.6, lon: -0.2, tags: { name: "XYZ Access", website: "https://xyz-access.example" } },
    { type: "node", id: 103, lat: 51.7, lon: -0.3, tags: { name: "Local Scaffs" /* no website */ } },
  ];

  it("(B1) THE AUDIT FIX · every element with a name becomes a persisted candidate", async () => {
    const m = makeH3Mock();
    m.seedSource("osm_overpass_primary");
    const job = m.enqueueProbeJob({
      source_slug: "osm_overpass_primary",
      host: "overpass-api.de",
      discovery_method: "overpass_query",
      country_iso: "GB",
      term: "scaffolding",
    });
    const adapter = makeFixtureOverpassAdapter({ elements: fixtureElements });
    const r = await executeSourceProbe({ client: m.client, job, worker_id: "w1", adapter });
    expect(r.kind).toBe("completed");
    if (r.kind === "completed") {
      // The Founder's demand: 3 elements, 3 persisted candidates
      expect(r.source_results).toBe(3);
      expect(r.candidates_retained).toBe(3);
      expect(r.candidates_new).toBe(3);
    }
    expect(m.state.candidates.size).toBe(3);
  });

  it("(B2) 2 candidates have websites → 2 website_walk H1 jobs enqueued", async () => {
    const m = makeH3Mock();
    m.seedSource("osm_overpass_primary");
    const job = m.enqueueProbeJob({ source_slug: "osm_overpass_primary", host: "overpass-api.de", discovery_method: "overpass_query", country_iso: "GB", term: "scaffolding" });
    const adapter = makeFixtureOverpassAdapter({ elements: fixtureElements });
    const r = await executeSourceProbe({ client: m.client, job, worker_id: "w1", adapter });
    if (r.kind !== "completed") throw new Error("expected completed");
    expect(r.websites_found).toBe(2);
    expect(r.website_walks_enqueued).toBe(2);
    // Verify the H1 queue has 2 website_walk jobs
    const walks = [...m.state.jobs.values()].filter(j => j.job_type === "website_walk");
    expect(walks).toHaveLength(2);
    // Every walk job has the required payload
    for (const w of walks) {
      expect(w.payload.website_url).toMatch(/^https?:\/\//);
      expect(w.payload.candidate_id).toBeTruthy();
      expect(w.payload.discovered_from_source_slug).toBe("osm_overpass_primary");
      expect(w.parent_job_id).toBe(job.job_id);
    }
  });

  it("(B3) candidate WITHOUT website persisted honestly · website_url=null · no walk job", async () => {
    const m = makeH3Mock();
    m.seedSource("osm_overpass_primary");
    const job = m.enqueueProbeJob({ source_slug: "osm_overpass_primary", host: "overpass-api.de", discovery_method: "overpass_query", country_iso: "GB", term: "scaffolding" });
    const adapter = makeFixtureOverpassAdapter({ elements: fixtureElements });
    await executeSourceProbe({ client: m.client, job, worker_id: "w1", adapter });
    // Find the "Local Scaffs" candidate
    const local = [...m.state.candidates.values()].find(c => c.business_name === "Local Scaffs");
    expect(local).toBeTruthy();
    expect(local.website_url).toBeNull();  // NEVER fabricated
    expect(local.website_walk_job_id).toBeNull();  // no walk job
  });

  it("(B4) idempotent · running executor twice → 0 new candidates + 0 new walks", async () => {
    const m = makeH3Mock();
    m.seedSource("osm_overpass_primary");
    const job = m.enqueueProbeJob({ source_slug: "osm_overpass_primary", host: "overpass-api.de", discovery_method: "overpass_query", country_iso: "GB", term: "scaffolding" });
    const adapter = makeFixtureOverpassAdapter({ elements: fixtureElements });
    const r1 = await executeSourceProbe({ client: m.client, job, worker_id: "w1", adapter });
    const r2 = await executeSourceProbe({ client: m.client, job, worker_id: "w1", adapter });
    expect(r1.kind).toBe("completed");
    expect(r2.kind).toBe("completed");
    if (r1.kind === "completed" && r2.kind === "completed") {
      expect(r1.candidates_new).toBe(3);
      expect(r2.candidates_new).toBe(0);           // idempotent by (source_slug, external_ref)
      expect(r1.website_walks_enqueued).toBe(2);
      expect(r2.website_walks_enqueued).toBe(0);   // idempotent by (canonical_website, date)
      expect(r2.website_walks_duplicate).toBe(2);
    }
    expect(m.state.candidates.size).toBe(3);         // still just 3 rows
    const walks = [...m.state.jobs.values()].filter(j => j.job_type === "website_walk");
    expect(walks).toHaveLength(2);                    // still just 2 walk jobs
  });

  it("(B5) yield events recorded · at least source_probe_completed", async () => {
    const m = makeH3Mock();
    m.seedSource("osm_overpass_primary");
    const job = m.enqueueProbeJob({ source_slug: "osm_overpass_primary", host: "overpass-api.de", discovery_method: "overpass_query", country_iso: "GB", term: "scaffolding" });
    const adapter = makeFixtureOverpassAdapter({ elements: fixtureElements });
    await executeSourceProbe({ client: m.client, job, worker_id: "w1", adapter });
    const completed_yields = m.state.yields.filter(y => y.yield_kind === "source_probe_completed");
    expect(completed_yields).toHaveLength(1);
    expect(completed_yields[0]!.yield_meta.source_results).toBe(3);
    expect(completed_yields[0]!.yield_meta.candidates_new).toBe(3);
    expect(completed_yields[0]!.yield_meta.websites_enqueued).toBe(2);
  });

  it("(B6) source health updated · reliability + last_success_at + lifetime_businesses", async () => {
    const m = makeH3Mock();
    m.seedSource("osm_overpass_primary");
    // Start with reduced reliability to see it climb
    m.state.sources.get("osm_overpass_primary")!.reliability_score = 0.7;
    const job = m.enqueueProbeJob({ source_slug: "osm_overpass_primary", host: "overpass-api.de", discovery_method: "overpass_query", country_iso: "GB", term: "scaffolding" });
    const adapter = makeFixtureOverpassAdapter({ elements: fixtureElements });
    await executeSourceProbe({ client: m.client, job, worker_id: "w1", adapter });
    const src = m.state.sources.get("osm_overpass_primary")!;
    expect(src.reliability_score).toBeCloseTo(0.75, 2);   // +0.05
    expect(src.last_success_at).not.toBeNull();
    expect(src.lifetime_businesses).toBe(3);
    expect(src.consecutive_success).toBe(1);
    expect(src.consecutive_failure).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// C · Non-happy paths
// ═══════════════════════════════════════════════════════════════════
describe("H3 · (C) zero_results / unavailable / dormant / rate_limited", () => {
  it("(C1) zero_results · 0 candidates · source health bumped (zero_result kind) · SOURCE_ZERO ≠ COUNTRY_ZERO", async () => {
    const m = makeH3Mock();
    m.seedSource("osm_overpass_primary");
    const job = m.enqueueProbeJob({ source_slug: "osm_overpass_primary", host: "overpass-api.de", discovery_method: "overpass_query", country_iso: "GB", term: "obscure-term" });
    const adapter = makeFixtureOverpassAdapter({ kind: "responded_zero", elements: [] });
    const r = await executeSourceProbe({ client: m.client, job, worker_id: "w1", adapter });
    expect(r.kind).toBe("zero_results");
    expect(m.state.candidates.size).toBe(0);
    // Source updated but NO country-completion side-effect happened
    const src = m.state.sources.get("osm_overpass_primary")!;
    expect(src.last_zero_result_at).not.toBeNull();
    // Yield recorded distinctly
    const y = m.state.yields.find(y => y.yield_kind === "source_probe_zero_result");
    expect(y).toBeTruthy();
  });

  it("(C2) unavailable · source health degrades · executor returns source_unavailable", async () => {
    const m = makeH3Mock();
    m.seedSource("osm_overpass_primary");
    const job = m.enqueueProbeJob({ source_slug: "osm_overpass_primary", host: "overpass-api.de", discovery_method: "overpass_query", country_iso: "GB", term: "x" });
    const adapter = makeFixtureOverpassAdapter({ kind: "unavailable" });
    const r = await executeSourceProbe({ client: m.client, job, worker_id: "w1", adapter });
    expect(r.kind).toBe("source_unavailable");
    const src = m.state.sources.get("osm_overpass_primary")!;
    expect(src.consecutive_failure).toBe(1);
    expect(src.reliability_score).toBeLessThan(1.0);
  });

  it("(C3) NULL_OVERPASS_ADAPTER returns adapter_dormant · zero candidates", async () => {
    const m = makeH3Mock();
    m.seedSource("osm_overpass_primary");
    const job = m.enqueueProbeJob({ source_slug: "osm_overpass_primary", host: "overpass-api.de", discovery_method: "overpass_query", country_iso: "GB", term: "x" });
    const r = await executeSourceProbe({ client: m.client, job, worker_id: "w1", adapter: NULL_OVERPASS_ADAPTER });
    expect(r.kind).toBe("adapter_dormant");
    expect(m.state.candidates.size).toBe(0);
    const y = m.state.yields.find(y => y.yield_kind === "source_probe_adapter_dormant");
    expect(y).toBeTruthy();
  });

  it("(C4) invalid_payload returns typed outcome · no crash", async () => {
    const m = makeH3Mock();
    m.seedSource("osm_overpass_primary");
    const bad_job = m.enqueueProbeJob({ /* missing required fields */ });
    const r = await executeSourceProbe({ client: m.client, job: bad_job, worker_id: "w1" });
    expect(r.kind).toBe("invalid_payload");
  });
});

// ═══════════════════════════════════════════════════════════════════
// D · Governance canaries
// ═══════════════════════════════════════════════════════════════════
describe("H3 · (D) governance canaries", () => {
  it("(D1) all boundary markers exported", () => {
    expect(_EXECUTOR_RETAINS_EVERY_BUSINESS_ELEMENT).toContain("audit_2026_09_22_fix");
    expect(_EXECUTOR_NEVER_FABRICATES_WEBSITE).toContain("stays_null");
    expect(_EXECUTOR_NEVER_FABRICATES_EMAIL).toContain("H4_walked_pages");
    expect(_EXECUTOR_SOURCE_ZERO_NOT_COUNTRY_ZERO).toContain("never_marks_country_complete");
    expect(_EXECUTOR_WEBSITE_JOBS_ARE_DURABLE).toContain("enqueueJob");
    expect(_OVERPASS_NEVER_FABRICATES_WEBSITE).toContain("never_inferred");
    expect(_OVERPASS_NEVER_FABRICATES_EMAIL).toContain("H4_from_walked_pages");
    expect(_OVERPASS_NULL_ADAPTER_DEFAULT).toContain("founder_opt_in");
    expect(_CANDIDATE_IDEMPOTENT_INSERT).toContain("UNIQUE");
    expect(_CANDIDATE_WEBSITE_URL_NULLABLE).toContain("never_fabricated");
  });

  it("(D2) module exports NO fabricate/generate/infer function · email/website integrity", async () => {
    const mod: any = await import("..");
    expect(mod.fabricateEmail).toBeUndefined();
    expect(mod.fabricateWebsite).toBeUndefined();
    expect(mod.inferEmailFromName).toBeUndefined();
    expect(mod.inferWebsiteFromName).toBeUndefined();
    expect(mod.guessEmail).toBeUndefined();
    expect(mod.synthesiseBusinessName).toBeUndefined();
    expect(mod.forceComplete).toBeUndefined();
  });

  it("(D3) executor source file contains no email-inference / fabricated-URL primitives", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/nex/harvest/source-probe-executor.ts", "utf8");
    // Strip comments so "never fabricates" doctrine language doesn't false-positive
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(code).not.toMatch(/generate.*email/i);
    expect(code).not.toMatch(/@\$\{/);           // no template-literal email interpolation
    expect(code).not.toMatch(/`info@/);         // no fake info@ construction
    expect(code).not.toMatch(/inferEmail/);
    expect(code).not.toMatch(/synthesise/i);
  });

  it("(D4) executor uses enqueueJob for website walks · durable H1 jobs · never a bare setTimeout", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/nex/harvest/source-probe-executor.ts", "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(code).toMatch(/enqueueJob\(/);
    expect(code).not.toMatch(/setTimeout\(/);
    expect(code).not.toMatch(/setInterval\(/);
  });
});

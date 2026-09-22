// src/lib/nex/harvest/__tests__/website-walk-executor.test.ts
//
// NEX 24/7 World Harvest Engine · Wave H4 · Website-walk executor acceptance
// Founder-authorised programme · 2026-09-22.
//
// Proves that a website_walk H1 job produces a publicly evidenced email
// and persists the complete provenance chain (candidate → walk → email
// → evidence). Uses an injectable walker so we can test the executor's
// wire-up + post-processing without spinning up the full walker stack in
// the mock. The walker itself is tested by Session-2's own 21 tests.

import { describe, it, expect } from "vitest";
import type { PoolClient, QueryResult } from "pg";
import {
  executeWebsiteWalk,
  _WEBSITE_WALK_NEVER_GENERATES_EMAIL,
  _WEBSITE_WALK_USES_SESSION_2_EXTRACTOR,
  _WEBSITE_WALK_PRESERVES_DISTINCT_COUNTERS,
  _WEBSITE_WALK_NULL_FETCHER_DEFAULT,
  _WEBSITE_WALK_STATUS_TRUTHFUL,
  type HarvestJob, type WalkerFn,
} from "..";
import type { AdaptedResult } from "@/lib/nex/discovery-world";

// ─── Combined mock for H4 acceptance ────────────────────────────────
function makeH4Mock() {
  const state = {
    candidates: new Map<string, any>(),
    yields: [] as any[],
  };
  let yield_seq = 1;

  const client: PoolClient = {
    async query(sql: string, params: any[] = []): Promise<QueryResult<any>> {
      const norm = sql.replace(/\s+/g, " ").trim();

      // SELECT candidate
      if (/^SELECT candidate_id, source_slug, programme_id, country_iso, term, business_name, website_url/i.test(norm)) {
        const row = state.candidates.get(params[0]);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0, command: "", oid: 0, fields: [] };
      }
      // UPDATE candidate walk outcome
      if (/^UPDATE nex\.harvest_business_candidate\s+SET website_walk_status = \$2, emails_discovered_count = \$3/i.test(norm)) {
        const [candidate_id, status, emails, walked_at] = params;
        const row = state.candidates.get(candidate_id);
        if (row) {
          row.website_walk_status = status;
          row.emails_discovered_count = Number(emails);
          if (walked_at) row.website_walked_at = walked_at;
        }
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0, command: "", oid: 0, fields: [] };
      }
      // Yield INSERT
      if (/^INSERT INTO nex\.harvest_yield/i.test(norm)) {
        const [job_id, worker_id, yield_kind, yield_count, meta_str] = params;
        state.yields.push({
          yield_id: `y-${yield_seq++}`, job_id, worker_id: worker_id ?? null,
          yield_kind, yield_count: Number(yield_count),
          yield_meta: JSON.parse(meta_str),
          yielded_at: new Date().toISOString(),
        });
        return { rows: [], rowCount: 1, command: "", oid: 0, fields: [] };
      }
      throw new Error(`h4-mock: unhandled SQL: ${norm.slice(0, 180)}`);
    },
    release() {},
  } as unknown as PoolClient;

  const seedCandidate = (partial: any) => {
    const c = {
      candidate_id: `cand-${state.candidates.size + 1}`,
      source_slug: "osm_overpass_primary",
      programme_id: "prog-scaffolding",
      country_iso: "GB",
      term: "scaffolding",
      business_name: "ABC Scaffolding",
      website_url: "https://abcscaff.co.uk",
      website_walk_status: null,
      emails_discovered_count: 0,
      website_walked_at: null,
      ...partial,
    };
    state.candidates.set(c.candidate_id, c);
    return c;
  };

  const makeJob = (candidate: any): HarvestJob => ({
    job_id: `walk-job-${Math.random().toString(36).slice(2, 8)}`,
    job_type: "website_walk",
    programme_id: candidate.programme_id,
    country_iso: candidate.country_iso,
    source_id: candidate.source_slug,
    payload: {
      candidate_id: candidate.candidate_id,
      website_url: candidate.website_url,
      canonical_website: candidate.website_url ? "abcscaff.co.uk" : null,
      business_name: candidate.business_name,
      country_iso: candidate.country_iso,
      discovered_from_source_slug: candidate.source_slug,
      discovered_from_probe_job_id: "probe-1",
    },
    idempotency_key: `walk:${candidate.candidate_id}`,
    status: "claimed", priority: 80, attempts: 1, max_attempts: 3,
    next_attempt_at: new Date().toISOString(),
    lease_owner: "test-worker",
    lease_acquired_at: new Date().toISOString(),
    lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
    heartbeat_at: new Date().toISOString(),
    last_error: null, last_error_at: null,
    dead_letter_reason: null, dead_letter_at: null, completed_at: null,
    parent_job_id: "probe-1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  return { client, state, seedCandidate, makeJob };
}

// ─── Fake walker fixtures (mimic processEntityCandidate return shape) ─
function fakeWalker(preset: {
  outcome: AdaptedResult["outcome"];
  emails: number;
  entity_id?: string | null;
  evidence_ids?: string[];
  walk_stats?: Partial<AdaptedResult["walk"]>;
  note?: string | null;
}): WalkerFn {
  return async (_client, candidate, _config) => {
    const walk: AdaptedResult["walk"] = {
      entity_domain: candidate.website_url ?? "",
      pages: [],
      pages_attempted: preset.walk_stats?.pages_attempted ?? 5,
      pages_fetched: preset.walk_stats?.pages_fetched ?? 3,
      pages_blocked_by_governance: preset.walk_stats?.pages_blocked_by_governance ?? 0,
      pages_robots_denied: preset.walk_stats?.pages_robots_denied ?? 0,
      pages_not_found: preset.walk_stats?.pages_not_found ?? 0,
      pages_unavailable: preset.walk_stats?.pages_unavailable ?? 0,
      deadline_expired: false,
      total_bytes: 0,
      total_ms: 100,
      note: null,
    };
    const emails = Array.from({ length: preset.emails }, (_, i) => ({
      classification: {
        valid: true, normalized_email: `contact${i}@abcscaff.co.uk`,
        email_type: "role", email_evidence_tier: "directly_published_by_entity",
        email_provider_domain: "abcscaff.co.uk",
      } as any,
      extracted: { normalized: `contact${i}@abcscaff.co.uk`, method: "mailto_href", nearby_role_hint: null } as any,
    }));
    return {
      candidate,
      walk,
      emails,
      outcome: preset.outcome,
      persisted: {
        entity_id: preset.entity_id ?? "ent-1",
        evidence_ids: preset.evidence_ids ?? emails.map((_, i) => `ev-${i}`),
      },
      note: preset.note ?? null,
    };
  };
}

// ═══════════════════════════════════════════════════════════════════
// A · Happy path · walker succeeds with emails
// ═══════════════════════════════════════════════════════════════════
describe("H4 · (A) happy path · website walked · emails captured · evidence written", () => {
  it("(A1) walked with emails → candidate updated + evidence chain complete", async () => {
    const m = makeH4Mock();
    const c = m.seedCandidate({});
    const job = m.makeJob(c);
    const walker = fakeWalker({ outcome: "walker_completed_with_emails", emails: 3, evidence_ids: ["ev-a", "ev-b", "ev-c"] });
    const r = await executeWebsiteWalk({ client: m.client, job, worker_id: "w1", walker });

    expect(r.kind).toBe("walked");
    if (r.kind === "walked") {
      expect(r.pages_fetched).toBe(3);
      expect(r.emails_captured).toBe(3);
      expect(r.evidence_ids).toEqual(["ev-a", "ev-b", "ev-c"]);
      expect(r.website_walk_status).toBe("walked");
    }
    const updated = m.state.candidates.get(c.candidate_id);
    expect(updated.website_walk_status).toBe("walked");
    expect(updated.emails_discovered_count).toBe(3);
    expect(updated.website_walked_at).not.toBeNull();
  });

  it("(A2) distinct yield events · website_walk_completed · pages_walked · email_captured", async () => {
    const m = makeH4Mock();
    const c = m.seedCandidate({});
    const job = m.makeJob(c);
    const walker = fakeWalker({ outcome: "walker_completed_with_emails", emails: 2, walk_stats: { pages_fetched: 4 } });
    await executeWebsiteWalk({ client: m.client, job, worker_id: "w1", walker });

    const kinds = m.state.yields.map(y => y.yield_kind);
    expect(kinds).toContain("website_walk_completed");
    expect(kinds).toContain("website_pages_walked");
    expect(kinds).toContain("email_captured");

    const pages_yield = m.state.yields.find(y => y.yield_kind === "website_pages_walked");
    expect(pages_yield!.yield_count).toBe(4);
    const emails_yield = m.state.yields.find(y => y.yield_kind === "email_captured");
    expect(emails_yield!.yield_count).toBe(2);
  });

  it("(A3) yield_meta on email_captured does NOT contain email addresses (structural anti-leak)", async () => {
    const m = makeH4Mock();
    const c = m.seedCandidate({});
    const job = m.makeJob(c);
    const walker = fakeWalker({ outcome: "walker_completed_with_emails", emails: 2 });
    await executeWebsiteWalk({ client: m.client, job, worker_id: "w1", walker });

    const emails_yield = m.state.yields.find(y => y.yield_kind === "email_captured");
    const meta_json = JSON.stringify(emails_yield!.yield_meta);
    // No @-shaped patterns · email addresses stay behind Founder audience-inventory controls
    expect(meta_json).not.toMatch(/[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  });
});

// ═══════════════════════════════════════════════════════════════════
// B · Zero-email and zero-page paths
// ═══════════════════════════════════════════════════════════════════
describe("H4 · (B) zero-email + zero-page paths", () => {
  it("(B1) walker_completed_no_emails → status='walked' · emails_captured=0", async () => {
    const m = makeH4Mock();
    const c = m.seedCandidate({});
    const job = m.makeJob(c);
    const walker = fakeWalker({ outcome: "walker_completed_no_emails", emails: 0, evidence_ids: [] });
    const r = await executeWebsiteWalk({ client: m.client, job, worker_id: "w1", walker });

    expect(r.kind).toBe("walked");
    if (r.kind === "walked") {
      expect(r.emails_captured).toBe(0);
      expect(r.website_walk_status).toBe("walked");
    }
    // email_captured yield NOT recorded when zero emails · truthful state
    expect(m.state.yields.find(y => y.yield_kind === "email_captured")).toBeUndefined();
  });

  it("(B2) walker_no_pages_fetched with all robots-denied → robots_denied outcome", async () => {
    const m = makeH4Mock();
    const c = m.seedCandidate({});
    const job = m.makeJob(c);
    const walker = fakeWalker({
      outcome: "walker_no_pages_fetched", emails: 0, evidence_ids: [],
      walk_stats: { pages_attempted: 3, pages_fetched: 0, pages_robots_denied: 3 },
    });
    const r = await executeWebsiteWalk({ client: m.client, job, worker_id: "w1", walker });
    expect(r.kind).toBe("robots_denied");
    expect(m.state.candidates.get(c.candidate_id).website_walk_status).toBe("blocked_by_robots");
  });

  it("(B3) walker_no_pages_fetched with all unavailable → unavailable outcome", async () => {
    const m = makeH4Mock();
    const c = m.seedCandidate({});
    const job = m.makeJob(c);
    const walker = fakeWalker({
      outcome: "walker_no_pages_fetched", emails: 0, evidence_ids: [],
      walk_stats: { pages_attempted: 3, pages_fetched: 0, pages_unavailable: 3 },
    });
    const r = await executeWebsiteWalk({ client: m.client, job, worker_id: "w1", walker });
    expect(r.kind).toBe("unavailable");
    expect(m.state.candidates.get(c.candidate_id).website_walk_status).toBe("unavailable");
  });

  it("(B4) walker_blocked_by_governance → blocked_by_governance outcome", async () => {
    const m = makeH4Mock();
    const c = m.seedCandidate({});
    const job = m.makeJob(c);
    const walker = fakeWalker({
      outcome: "walker_blocked_by_governance", emails: 0, evidence_ids: [],
      walk_stats: { pages_attempted: 3, pages_fetched: 0, pages_blocked_by_governance: 3 },
      note: "no host on allowlist",
    });
    const r = await executeWebsiteWalk({ client: m.client, job, worker_id: "w1", walker });
    expect(r.kind).toBe("blocked_by_governance");
    expect(m.state.candidates.get(c.candidate_id).website_walk_status).toBe("blocked_by_governance");
  });
});

// ═══════════════════════════════════════════════════════════════════
// C · No-website path · never fabricated
// ═══════════════════════════════════════════════════════════════════
describe("H4 · (C) no website · truthfully marked not_applicable", () => {
  it("(C1) candidate.website_url=null → not_applicable_no_website · never fabricated", async () => {
    const m = makeH4Mock();
    const c = m.seedCandidate({ website_url: null });
    const job = m.makeJob(c);
    // walker fn is never called when there is no URL · use a walker that would throw if called
    const walker: WalkerFn = async () => { throw new Error("walker should not be called when website is null"); };
    const r = await executeWebsiteWalk({ client: m.client, job, worker_id: "w1", walker });
    expect(r.kind).toBe("not_applicable_no_website");
    expect(m.state.candidates.get(c.candidate_id).website_walk_status).toBe("not_applicable");
    expect(m.state.candidates.get(c.candidate_id).emails_discovered_count).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// D · Invalid payload + missing candidate
// ═══════════════════════════════════════════════════════════════════
describe("H4 · (D) invalid payload / missing candidate · typed outcomes · never crashes", () => {
  it("(D1) missing payload fields → invalid_payload", async () => {
    const m = makeH4Mock();
    const bad_job = {
      job_id: "x", job_type: "website_walk", payload: {},
      programme_id: null, country_iso: null, source_id: null, idempotency_key: "x",
      status: "claimed", priority: 80, attempts: 1, max_attempts: 3,
      next_attempt_at: "", lease_owner: null, lease_acquired_at: null,
      lease_expires_at: null, heartbeat_at: null, last_error: null,
      last_error_at: null, dead_letter_reason: null, dead_letter_at: null,
      completed_at: null, parent_job_id: null, created_at: "", updated_at: "",
    } as any;
    const r = await executeWebsiteWalk({ client: m.client, job: bad_job, worker_id: "w1" });
    expect(r.kind).toBe("invalid_payload");
  });

  it("(D2) candidate_id references non-existent candidate → candidate_not_found", async () => {
    const m = makeH4Mock();
    const c = m.seedCandidate({});
    const job = m.makeJob(c);
    // Delete candidate from state to simulate missing row
    m.state.candidates.delete(c.candidate_id);
    const r = await executeWebsiteWalk({ client: m.client, job, worker_id: "w1", walker: fakeWalker({ outcome: "walker_completed_no_emails", emails: 0 }) });
    expect(r.kind).toBe("candidate_not_found");
  });
});

// ═══════════════════════════════════════════════════════════════════
// E · Governance canaries · anti-fabrication
// ═══════════════════════════════════════════════════════════════════
describe("H4 · (E) governance canaries", () => {
  it("(E1) all 5 boundary markers exported", () => {
    expect(_WEBSITE_WALK_NEVER_GENERATES_EMAIL).toContain("publicly_found_email_not_equal_generated_email");
    expect(_WEBSITE_WALK_USES_SESSION_2_EXTRACTOR).toContain("six_method_extractor_is_authoritative");
    expect(_WEBSITE_WALK_PRESERVES_DISTINCT_COUNTERS).toContain("reported_separately");
    expect(_WEBSITE_WALK_NULL_FETCHER_DEFAULT).toContain("founder_opt_in");
    expect(_WEBSITE_WALK_STATUS_TRUTHFUL).toContain("all_distinct");
  });

  it("(E2) module exports NO fabricate/infer/generate/guess email or website function", async () => {
    const mod: any = await import("..");
    expect(mod.generateEmail).toBeUndefined();
    expect(mod.inferEmailFromDomain).toBeUndefined();
    expect(mod.buildInfoAtEmail).toBeUndefined();
    expect(mod.guessEmailFromName).toBeUndefined();
    expect(mod.mxInventEmail).toBeUndefined();
    expect(mod.fabricateWebsiteFromName).toBeUndefined();
    expect(mod.likelyEmail).toBeUndefined();
  });

  it("(E3) executor source-file structural check · no email generation primitives", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/nex/harvest/website-walk-executor.ts", "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    // Strip string literals so doctrine language (e.g. "publicly_found_email_not_equal_generated_email")
    // in exported constants does not falsely trigger these anti-fabrication checks.
    const code_no_strings = code
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''")
      .replace(/`(?:[^`\\]|\\.)*`/g, "``");
    // Function-shaped email generation primitives
    expect(code_no_strings).not.toMatch(/\bgenerate[A-Z]\w*[Ee]mail\s*\(/);
    expect(code_no_strings).not.toMatch(/\binferEmail\w*\s*\(/);
    expect(code_no_strings).not.toMatch(/\blikelyEmail\w*\s*\(/);
    expect(code_no_strings).not.toMatch(/\bmxInvent\w*\s*\(/);
    expect(code_no_strings).not.toMatch(/\bfabricateEmail\w*\s*\(/);
    // Also confirm no template-literal @construction pattern in raw source
    expect(code).not.toMatch(/@\$\{/);
    expect(code).not.toMatch(/setTimeout\(/);
    expect(code).not.toMatch(/setInterval\(/);
  });

  it("(E4) executor delegates to injected walker · never re-implements extraction", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/nex/harvest/website-walk-executor.ts", "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    // Must import the Session-2 walker function · never redefine an extract-emails routine
    expect(code).toMatch(/processEntityCandidate/);
    expect(code).not.toMatch(/function\s+extractEmails\b/);   // no shadow extractor
  });
});

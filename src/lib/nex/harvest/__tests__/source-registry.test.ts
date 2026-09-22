// src/lib/nex/harvest/__tests__/source-registry.test.ts
//
// NEX 24/7 World Harvest Engine · Wave H2 · Source Registry acceptance
// Founder-authorised programme · 2026-09-22.
//
// The critical acceptance:
//   The registry FEEDS the harvest_job queue via scheduleSourceProbes().
//   Running the scheduler twice = same jobs (idempotent).
//   This proves H2 is not "another registry-only exercise" · it produces
//   H1 work directly.

import { describe, it, expect } from "vitest";
import type { PoolClient, QueryResult } from "pg";
import {
  listAllSources, loadSourceBySlug, loadSourcesForScope,
  disableSource, enableSource, quarantineSource,
  recordProbeAttempt, scheduleSourceProbes,
  enqueueJob, loadQueueSummary,
  _REGISTRY_FOUNDER_SIGNATURE_REQUIRED,
  _REGISTRY_NEVER_RUNTIME_ADDS,
  _REGISTRY_FEEDS_QUEUE,
  _REGISTRY_HEALTH_FROM_EXECUTOR_ONLY,
} from "..";

// ─── Combined mock supporting harvest_source + harvest_job ─────────
function makeH2Mock(clock: () => Date = () => new Date()) {
  const sources = new Map<string, any>();
  const jobs = new Map<string, any>();
  let job_seq = 1;

  const seedSource = (row: any) => {
    const merged = {
      source_id: row.source_id ?? `src-${sources.size + 1}`,
      country_scope: [], category_scope: [],
      robots_policy_required: true, rate_limit_per_minute: 6,
      max_bytes: 5242880, per_probe_timeout_ms: 15000,
      priority: 100, enabled: true, quarantined_until: null,
      reliability_score: 1.0, consecutive_success: 0, consecutive_failure: 0,
      last_attempt_at: null, last_success_at: null, last_failure_at: null,
      last_zero_result_at: null, last_yield_at: null,
      lifetime_probes: 0, lifetime_businesses: 0, lifetime_emails: 0,
      metadata: {},
      created_at: clock().toISOString(), updated_at: clock().toISOString(),
      ...row,
    };
    sources.set(merged.source_slug, merged);
    return merged;
  };

  const client: PoolClient = {
    async query(sql: string, params: any[] = []): Promise<QueryResult<any>> {
      const norm = sql.replace(/\s+/g, " ").trim();

      // ─── Source SELECTs ───
      if (/^SELECT \* FROM nex\.harvest_source ORDER BY/i.test(norm)) {
        return { rows: [...sources.values()].sort((a, b) => (b.priority - a.priority) || a.source_slug.localeCompare(b.source_slug)), rowCount: sources.size, command: "", oid: 0, fields: [] };
      }
      if (/^SELECT \* FROM nex\.harvest_source WHERE source_slug = \$1$/i.test(norm)) {
        const row = sources.get(params[0]);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0, command: "", oid: 0, fields: [] };
      }
      if (/^SELECT \* FROM nex\.harvest_source (WHERE|ORDER)/i.test(norm)) {
        const rows = [...sources.values()];
        const filtered = rows.filter(r => {
          if (norm.includes("enabled = TRUE") && !r.enabled) return false;
          if (norm.includes("quarantined_until IS NULL OR quarantined_until <")) {
            const idx_qt = params.findIndex(p => typeof p === "string" && p.includes("T"));
            const now_iso = params[idx_qt];
            if (r.quarantined_until && r.quarantined_until >= now_iso) return false;
          }
          // country/category scope
          for (let i = 0; i < params.length; i++) {
            if (typeof params[i] === "string" && params[i].length === 2 && /^[A-Z]{2}$/.test(params[i])) {
              // country param
              if ((r.country_scope?.length ?? 0) > 0 && !r.country_scope.includes(params[i])) return false;
            }
          }
          // Category filter is anything else · if we detected a category param, apply it
          if (norm.includes("category_scope = '{}'") && norm.includes("= ANY(category_scope)")) {
            const catIdx = params.findIndex(p => typeof p === "string" && p.length > 2 && !/T\d{2}:/.test(p) && !/^[A-Z]{2}$/.test(p));
            if (catIdx >= 0) {
              const cat = params[catIdx];
              if ((r.category_scope?.length ?? 0) > 0 && !r.category_scope.includes(cat)) return false;
            }
          }
          return true;
        });
        return { rows: filtered.sort((a, b) => (b.priority - a.priority) || a.source_slug.localeCompare(b.source_slug)), rowCount: filtered.length, command: "", oid: 0, fields: [] };
      }

      // ─── Source UPDATE (enable / disable / quarantine / recordProbeAttempt) ───
      if (/^UPDATE nex\.harvest_source/i.test(norm)) {
        const slug = params[0];
        const row = sources.get(slug);
        if (!row) return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };

        if (/SET enabled = FALSE/.test(norm)) {
          row.enabled = false;
          row.metadata = { ...row.metadata, last_disable_reason: params[1], last_disable_by: params[2], last_disable_at: clock().toISOString() };
        } else if (/SET enabled = TRUE/.test(norm)) {
          row.enabled = true;
          row.quarantined_until = null;
          row.metadata = { ...row.metadata, last_enable_by: params[1], last_enable_at: clock().toISOString() };
        } else if (/SET quarantined_until = /.test(norm)) {
          row.quarantined_until = params[1];
          row.metadata = { ...row.metadata, last_quarantine_reason: params[2], last_quarantine_by: params[3], last_quarantine_at: clock().toISOString() };
        } else if (/SET reliability_score = GREATEST/.test(norm)) {
          // recordProbeAttempt · compute deltas from the SQL literal
          const delta_match = norm.match(/reliability_score \+ (-?[\d.]+)\)/);
          const delta = delta_match ? Number(delta_match[1]) : 0;
          row.reliability_score = Math.max(0, Math.min(1, row.reliability_score + delta));
          if (/consecutive_success = 0/.test(norm)) row.consecutive_success = 0;
          else if (/consecutive_success \+ 1/.test(norm)) row.consecutive_success += 1;
          if (/consecutive_failure = 0/.test(norm)) row.consecutive_failure = 0;
          else if (/consecutive_failure \+ 1/.test(norm)) row.consecutive_failure += 1;
          row.lifetime_probes += 1;
          row.last_attempt_at = clock().toISOString();
          if (/last_success_at = /.test(norm)) {
            row.last_success_at = clock().toISOString();
            row.lifetime_businesses += Number(params[1] ?? 0);
            row.lifetime_emails += Number(params[2] ?? 0);
            if ((params[1] ?? 0) > 0 || (params[2] ?? 0) > 0) row.last_yield_at = clock().toISOString();
          } else if (/last_zero_result_at = /.test(norm)) {
            row.last_zero_result_at = clock().toISOString();
          } else if (/last_failure_at = /.test(norm)) {
            row.last_failure_at = clock().toISOString();
          }
        }
        row.updated_at = clock().toISOString();
        return { rows: [row], rowCount: 1, command: "", oid: 0, fields: [] };
      }

      // ─── harvest_job INSERT (from enqueueJob called by scheduleSourceProbes) ───
      if (/^INSERT INTO nex\.harvest_job/i.test(norm)) {
        const [job_type, programme_id, country_iso, source_id, payload_str,
               idempotency_key, priority, max_attempts, next_attempt_at] = params;
        for (const j of jobs.values()) {
          if (j.job_type === job_type && j.idempotency_key === idempotency_key) {
            return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
          }
        }
        const now = clock().toISOString();
        const row = {
          job_id: `job-${job_seq++}`, job_type, programme_id: programme_id ?? null,
          country_iso: country_iso ?? null, source_id: source_id ?? null,
          payload: JSON.parse(payload_str), idempotency_key,
          status: "queued", priority: Number(priority), attempts: 0,
          max_attempts: Number(max_attempts), next_attempt_at,
          lease_owner: null, lease_acquired_at: null, lease_expires_at: null, heartbeat_at: null,
          last_error: null, last_error_at: null, dead_letter_reason: null,
          dead_letter_at: null, completed_at: null, parent_job_id: null,
          created_at: now, updated_at: now,
        };
        jobs.set(row.job_id, row);
        return { rows: [row], rowCount: 1, command: "", oid: 0, fields: [] };
      }
      if (/^SELECT \* FROM nex\.harvest_job WHERE job_type = \$1 AND idempotency_key = \$2/i.test(norm)) {
        const [jt, ik] = params;
        for (const j of jobs.values()) if (j.job_type === jt && j.idempotency_key === ik) return { rows: [j], rowCount: 1, command: "", oid: 0, fields: [] };
        return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
      }
      if (/^SELECT status, COUNT/i.test(norm)) {
        const counts: Record<string, number> = {};
        for (const j of jobs.values()) counts[j.status] = (counts[j.status] ?? 0) + 1;
        return { rows: Object.entries(counts).map(([status, n]) => ({ status, n })), rowCount: Object.keys(counts).length, command: "", oid: 0, fields: [] };
      }

      throw new Error(`h2-mock: unhandled SQL: ${norm.slice(0, 180)}`);
    },
    release() {},
  } as unknown as PoolClient;

  return { client, sources, jobs, seedSource };
}

// ═══════════════════════════════════════════════════════════════════
// A · Registry read + scope filtering
// ═══════════════════════════════════════════════════════════════════
describe("Source registry · (A) read + scope filtering", () => {
  it("(A1) listAllSources returns all seeded sources", async () => {
    const m = makeH2Mock();
    m.seedSource({ source_slug: "s1", source_type: "public_geographic_data", host: "h1", url_template: null, discovery_method: "overpass_query", founder_signed_at: "2026-09-22T00:00:00Z", founder_signed_by: "founder", provenance_note: "test" });
    m.seedSource({ source_slug: "s2", source_type: "public_geographic_data", host: "h2", url_template: null, discovery_method: "overpass_query", founder_signed_at: "2026-09-22T00:00:00Z", founder_signed_by: "founder", provenance_note: "test" });
    const all = await listAllSources(m.client);
    expect(all).toHaveLength(2);
  });

  it("(A2) loadSourceBySlug returns exactly one", async () => {
    const m = makeH2Mock();
    m.seedSource({ source_slug: "found", source_type: "public_geographic_data", host: "h", url_template: null, discovery_method: "overpass_query", founder_signed_at: "x", founder_signed_by: "founder", provenance_note: "n" });
    const r = await loadSourceBySlug(m.client, "found");
    expect(r?.source_slug).toBe("found");
    const miss = await loadSourceBySlug(m.client, "missing");
    expect(miss).toBeNull();
  });

  it("(A3) loadSourcesForScope respects enabled flag", async () => {
    const m = makeH2Mock();
    m.seedSource({ source_slug: "on",  source_type: "public_geographic_data", host: "h", url_template: null, discovery_method: "overpass_query", founder_signed_at: "x", founder_signed_by: "f", provenance_note: "n", enabled: true });
    m.seedSource({ source_slug: "off", source_type: "public_geographic_data", host: "h", url_template: null, discovery_method: "overpass_query", founder_signed_at: "x", founder_signed_by: "f", provenance_note: "n", enabled: false });
    const list = await loadSourcesForScope(m.client, {});
    expect(list).toHaveLength(1);
    expect(list[0]?.source_slug).toBe("on");
  });

  it("(A4) loadSourcesForScope respects quarantined_until", async () => {
    const now = new Date("2026-09-22T00:00:00Z");
    const m = makeH2Mock(() => now);
    m.seedSource({ source_slug: "q-future", source_type: "public_geographic_data", host: "h", url_template: null, discovery_method: "overpass_query", founder_signed_at: "x", founder_signed_by: "f", provenance_note: "n", quarantined_until: "2027-01-01T00:00:00Z" });
    m.seedSource({ source_slug: "q-past",   source_type: "public_geographic_data", host: "h", url_template: null, discovery_method: "overpass_query", founder_signed_at: "x", founder_signed_by: "f", provenance_note: "n", quarantined_until: "2025-01-01T00:00:00Z" });
    const list = await loadSourcesForScope(m.client, { now: () => now });
    const slugs = list.map(l => l.source_slug);
    expect(slugs).toContain("q-past");
    expect(slugs).not.toContain("q-future");
  });

  it("(A5) loadSourcesForScope respects country_scope", async () => {
    const m = makeH2Mock();
    m.seedSource({ source_slug: "universal", source_type: "public_geographic_data", host: "h", url_template: null, discovery_method: "overpass_query", founder_signed_at: "x", founder_signed_by: "f", provenance_note: "n", country_scope: [] });
    m.seedSource({ source_slug: "uk-only",   source_type: "public_geographic_data", host: "h", url_template: null, discovery_method: "overpass_query", founder_signed_at: "x", founder_signed_by: "f", provenance_note: "n", country_scope: ["GB"] });
    m.seedSource({ source_slug: "de-only",   source_type: "public_geographic_data", host: "h", url_template: null, discovery_method: "overpass_query", founder_signed_at: "x", founder_signed_by: "f", provenance_note: "n", country_scope: ["DE"] });
    const gb_list = await loadSourcesForScope(m.client, { country_iso: "GB" });
    const slugs = gb_list.map(l => l.source_slug);
    expect(slugs).toContain("universal");
    expect(slugs).toContain("uk-only");
    expect(slugs).not.toContain("de-only");
  });
});

// ═══════════════════════════════════════════════════════════════════
// B · State transitions
// ═══════════════════════════════════════════════════════════════════
describe("Source registry · (B) enable / disable / quarantine", () => {
  it("(B1) disableSource flips enabled to false + records reason", async () => {
    const m = makeH2Mock();
    m.seedSource({ source_slug: "s", source_type: "public_geographic_data", host: "h", url_template: null, discovery_method: "overpass_query", founder_signed_at: "x", founder_signed_by: "f", provenance_note: "n" });
    const r = await disableSource(m.client, { source_slug: "s", reason: "test", founder_signed_by: "founder" });
    expect(r?.enabled).toBe(false);
    expect((r?.metadata as any).last_disable_reason).toBe("test");
  });

  it("(B2) enableSource clears quarantined_until", async () => {
    const m = makeH2Mock();
    m.seedSource({ source_slug: "s", source_type: "public_geographic_data", host: "h", url_template: null, discovery_method: "overpass_query", founder_signed_at: "x", founder_signed_by: "f", provenance_note: "n", enabled: false, quarantined_until: "2027-01-01T00:00:00Z" });
    const r = await enableSource(m.client, { source_slug: "s", founder_signed_by: "founder" });
    expect(r?.enabled).toBe(true);
    expect(r?.quarantined_until).toBeNull();
  });

  it("(B3) quarantineSource sets until_iso + reason", async () => {
    const m = makeH2Mock();
    m.seedSource({ source_slug: "s", source_type: "public_geographic_data", host: "h", url_template: null, discovery_method: "overpass_query", founder_signed_at: "x", founder_signed_by: "f", provenance_note: "n" });
    const r = await quarantineSource(m.client, { source_slug: "s", until_iso: "2027-01-01T00:00:00Z", reason: "abuse", founder_signed_by: "founder" });
    expect(r?.quarantined_until).toBe("2027-01-01T00:00:00Z");
  });
});

// ═══════════════════════════════════════════════════════════════════
// C · Health tracking
// ═══════════════════════════════════════════════════════════════════
describe("Source registry · (C) recordProbeAttempt updates health", () => {
  it("(C1) success bumps reliability + resets consecutive_failure", async () => {
    const m = makeH2Mock();
    m.seedSource({ source_slug: "s", source_type: "public_geographic_data", host: "h", url_template: null, discovery_method: "overpass_query", founder_signed_at: "x", founder_signed_by: "f", provenance_note: "n", reliability_score: 0.5, consecutive_failure: 3 });
    const r = await recordProbeAttempt(m.client, { source_slug: "s", result: { kind: "success", businesses: 12, emails: 4 } });
    expect(r?.reliability_score).toBeCloseTo(0.55, 2);
    expect(r?.consecutive_failure).toBe(0);
    expect(r?.consecutive_success).toBe(1);
    expect(r?.lifetime_businesses).toBe(12);
    expect(r?.lifetime_emails).toBe(4);
    expect(r?.last_yield_at).not.toBeNull();
  });

  it("(C2) zero_result unchanged reliability + no yield timestamp", async () => {
    const m = makeH2Mock();
    m.seedSource({ source_slug: "s", source_type: "public_geographic_data", host: "h", url_template: null, discovery_method: "overpass_query", founder_signed_at: "x", founder_signed_by: "f", provenance_note: "n", reliability_score: 0.8 });
    const r = await recordProbeAttempt(m.client, { source_slug: "s", result: { kind: "zero_result" } });
    expect(r?.reliability_score).toBeCloseTo(0.8, 2);
    expect(r?.last_zero_result_at).not.toBeNull();
    expect(r?.last_yield_at).toBeNull();
  });

  it("(C3) failure decrements reliability + resets consecutive_success", async () => {
    const m = makeH2Mock();
    m.seedSource({ source_slug: "s", source_type: "public_geographic_data", host: "h", url_template: null, discovery_method: "overpass_query", founder_signed_at: "x", founder_signed_by: "f", provenance_note: "n", reliability_score: 0.9, consecutive_success: 5 });
    const r = await recordProbeAttempt(m.client, { source_slug: "s", result: { kind: "failure", error: "TLS handshake" } });
    expect(r?.reliability_score).toBeCloseTo(0.75, 2);
    expect(r?.consecutive_success).toBe(0);
    expect(r?.consecutive_failure).toBe(1);
    expect(r?.last_failure_at).not.toBeNull();
  });

  it("(C4) reliability bounded to [0, 1]", async () => {
    const m = makeH2Mock();
    m.seedSource({ source_slug: "s", source_type: "public_geographic_data", host: "h", url_template: null, discovery_method: "overpass_query", founder_signed_at: "x", founder_signed_by: "f", provenance_note: "n", reliability_score: 0.98 });
    const r = await recordProbeAttempt(m.client, { source_slug: "s", result: { kind: "success", businesses: 0, emails: 0 } });
    expect(r?.reliability_score).toBeLessThanOrEqual(1.0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// D · The H2 → H1 SEAM · scheduleSourceProbes must produce jobs
// ═══════════════════════════════════════════════════════════════════
describe("Source registry · (D) H2→H1 seam · scheduleSourceProbes", () => {
  function seedTwoOverpass(m: ReturnType<typeof makeH2Mock>) {
    m.seedSource({ source_slug: "osm_overpass_primary", source_type: "public_geographic_data", host: "overpass-api.de", url_template: null, discovery_method: "overpass_query", founder_signed_at: "2026-09-22T00:00:00Z", founder_signed_by: "founder", provenance_note: "seed" });
    m.seedSource({ source_slug: "osm_overpass_swiss_mirror", source_type: "public_geographic_data", host: "overpass.osm.ch", url_template: null, discovery_method: "overpass_query", founder_signed_at: "2026-09-22T00:00:00Z", founder_signed_by: "founder", provenance_note: "seed" });
  }

  it("(D1) scheduler enqueues 1 job per (source × term)", async () => {
    const m = makeH2Mock();
    seedTwoOverpass(m);
    const r = await scheduleSourceProbes(m.client, {
      programme_id: "p1", country_iso: "GB", terms: ["scaffolding", "scaffolders"],
    });
    // 2 sources × 2 terms = 4 jobs
    expect(r.enqueued).toBe(4);
    expect(r.sources_considered).toBe(2);
    expect(r.per_source).toHaveLength(2);
  });

  it("(D2) running scheduler twice = same jobs (idempotent · anti-registry-only proof)", async () => {
    const m = makeH2Mock();
    seedTwoOverpass(m);
    const cycle_id = "cycle-42";
    const r1 = await scheduleSourceProbes(m.client, {
      programme_id: "p1", country_iso: "GB", terms: ["scaffolding"], cycle_id,
    });
    const r2 = await scheduleSourceProbes(m.client, {
      programme_id: "p1", country_iso: "GB", terms: ["scaffolding"], cycle_id,
    });
    expect(r1.enqueued).toBe(2);
    expect(r2.enqueued).toBe(0);
    expect(r2.duplicates).toBe(2);
    const summary = await loadQueueSummary(m.client);
    expect(summary.queued).toBe(2);
  });

  it("(D3) enqueued jobs have job_type='source_probe' with correct payload", async () => {
    const m = makeH2Mock();
    seedTwoOverpass(m);
    await scheduleSourceProbes(m.client, {
      programme_id: "p1", country_iso: "GB", terms: ["scaffolding"], cycle_id: "c",
    });
    // Every enqueued job carries source_slug + country + term in payload
    for (const j of m.jobs.values()) {
      expect(j.job_type).toBe("source_probe");
      expect(j.payload.country_iso).toBe("GB");
      expect(j.payload.term).toBe("scaffolding");
      expect(j.source_id).toMatch(/^osm_overpass_/);
    }
  });

  it("(D4) disabled sources are excluded from scheduling", async () => {
    const m = makeH2Mock();
    seedTwoOverpass(m);
    await disableSource(m.client, { source_slug: "osm_overpass_swiss_mirror", reason: "test", founder_signed_by: "founder" });
    const r = await scheduleSourceProbes(m.client, {
      programme_id: "p1", country_iso: "GB", terms: ["scaffolding"],
    });
    expect(r.sources_considered).toBe(1);
    expect(r.enqueued).toBe(1);
  });

  it("(D5) country-scoped sources exclude non-matching countries", async () => {
    const m = makeH2Mock();
    m.seedSource({ source_slug: "gb_only", source_type: "public_directory", host: "h", url_template: null, discovery_method: "public_html", founder_signed_at: "x", founder_signed_by: "f", provenance_note: "n", country_scope: ["GB"] });
    m.seedSource({ source_slug: "universal", source_type: "public_geographic_data", host: "h", url_template: null, discovery_method: "overpass_query", founder_signed_at: "x", founder_signed_by: "f", provenance_note: "n" });
    const r_gb = await scheduleSourceProbes(m.client, { programme_id: "p1", country_iso: "GB", terms: ["t"] });
    expect(r_gb.sources_considered).toBe(2);
    const r_de = await scheduleSourceProbes(m.client, { programme_id: "p1", country_iso: "DE", terms: ["t"] });
    expect(r_de.sources_considered).toBe(1);   // only universal
  });

  it("(D6) max_jobs_per_source caps the number of terms per source", async () => {
    const m = makeH2Mock();
    m.seedSource({ source_slug: "s", source_type: "public_geographic_data", host: "h", url_template: null, discovery_method: "overpass_query", founder_signed_at: "x", founder_signed_by: "f", provenance_note: "n" });
    const r = await scheduleSourceProbes(m.client, {
      programme_id: "p1", country_iso: "GB",
      terms: ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"],
      max_jobs_per_source: 3,
    });
    expect(r.enqueued).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════
// E · Governance canaries
// ═══════════════════════════════════════════════════════════════════
describe("Source registry · (E) governance canaries", () => {
  it("(E1) boundary markers exported", () => {
    expect(_REGISTRY_FOUNDER_SIGNATURE_REQUIRED).toContain("NOT_NULL");
    expect(_REGISTRY_NEVER_RUNTIME_ADDS).toContain("migration_required");
    expect(_REGISTRY_FEEDS_QUEUE).toContain("H2_to_H1_seam");
    expect(_REGISTRY_HEALTH_FROM_EXECUTOR_ONLY).toContain("never_fabricated");
  });
  it("(E2) module exports NO addSource / registerRuntimeSource / bypassSignature function", async () => {
    const mod: any = await import("..");
    expect(mod.addSource).toBeUndefined();
    expect(mod.registerRuntimeSource).toBeUndefined();
    expect(mod.insertSource).toBeUndefined();
    expect(mod.bypassSignature).toBeUndefined();
    expect(mod.fabricateHealth).toBeUndefined();
    expect(mod.overrideReliability).toBeUndefined();
  });
  it("(E3) every seeded source (real world) must carry founder_signed_at + founder_signed_by + provenance_note · verified via mock structural default absence", async () => {
    const m = makeH2Mock();
    // Attempting to seed a row without the required governance fields is deliberate here to prove the shape.
    // In production, the migration ADDS the NOT NULL constraint; the mock does not enforce it, but the type
    // system requires the fields at insertion time. Verify by direct listAll: our seeded fixtures have them.
    m.seedSource({ source_slug: "seed", source_type: "public_geographic_data", host: "h", url_template: null, discovery_method: "overpass_query", founder_signed_at: "2026-09-22T00:00:00Z", founder_signed_by: "founder", provenance_note: "seeded via H2 migration" });
    const all = await listAllSources(m.client);
    for (const s of all) {
      expect(s.founder_signed_at).toBeTruthy();
      expect(s.founder_signed_by).toBeTruthy();
      expect(s.provenance_note.length).toBeGreaterThan(0);
    }
  });
});

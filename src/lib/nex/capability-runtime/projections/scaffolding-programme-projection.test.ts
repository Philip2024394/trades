// src/lib/nex/capability-runtime/projections/scaffolding-programme-projection.test.ts
//
// Stage 6 acceptance · concrete ScaffoldingProgrammeProjection against the
// real NEX aggregator shape.
//
// §18 no-fake-completeness: the wrapper must actually invoke the real
// aggregator (verified via source-level import test). The freshness state
// machine is exercised via dependency injection — a fake loader simulates
// each success/error/unavailable path without spinning up a real DB.

import { describe, it, expect } from "vitest";
import type { PoolClient } from "pg";
import type { ScaffoldingProgrammeStatus } from "../../discovery-world/scaffolding-programme-status";
import {
  ScaffoldingProgrammeProjection,
  SCAFFOLDING_PROGRAMME_PROJECTION_NAME,
  SCAFFOLDING_PROGRAMME_PROJECTION_VERSION,
} from "./scaffolding-programme-projection";
import { validateProjectionInvariant } from "../projection-engine";

// Fake PoolClient (never queried directly — loader is injected)
const fakeClient: PoolClient = {
  async query() { throw new Error("client.query should not be called when a loader is injected"); },
} as unknown as PoolClient;

// A minimal but well-formed ScaffoldingProgrammeStatus value.
function makeStatus(overrides: Partial<ScaffoldingProgrammeStatus> = {}): ScaffoldingProgrammeStatus {
  return {
    programme: {
      slug: "scaffolding",
      display_name: "Scaffolding",
      asia_last_policy_active: true,
      topic: "trade",
    },
    queue: {
      total_in_scope: 30,
      completed: 5,
      in_progress: 1,
      queued: 22,
      idle: 2,
      zero_results: 0,
      source_unavailable: 0,
      blocked: 0,
      percent_completed: 16.7,
    },
    asia_last: {
      non_asia_total: 25, non_asia_completed: 5, non_asia_remaining: 20,
      asia_total: 5, asia_completed: 0, asia_remaining: 5, in_asia_tail: false,
    },
    cumulative_business_evidence: {
      total_rows: 100, rows_with_email: 30, rows_without_email: 70,
      distinct_websites: 100, distinct_countries_touched: 11,
      rows_last_24h: 5, rows_last_7d: 40, provenance_coverage_percent: 100,
    },
    cumulative_emails: {
      total_captured: 32, with_source_url: 32, with_source_url_percent: 100,
      by_country: [{ country: "GB", total: 12 }],
    },
    entities: {
      total: 50, unresolved: 10, candidate: 5, resolved: 30, ambiguous: 3, rejected: 2,
    },
    ...(overrides as any),
  } as ScaffoldingProgrammeStatus;
}

describe("ScaffoldingProgrammeProjection · Stage 6 acceptance", () => {
  const projection = new ScaffoldingProgrammeProjection(async () => makeStatus());

  it("has correct name + version constants", () => {
    expect(projection.name).toBe(SCAFFOLDING_PROGRAMME_PROJECTION_NAME);
    expect(projection.version).toBe(SCAFFOLDING_PROGRAMME_PROJECTION_VERSION);
    expect(SCAFFOLDING_PROGRAMME_PROJECTION_NAME).toBe("scaffolding_programme_status");
    expect(SCAFFOLDING_PROGRAMME_PROJECTION_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("SUCCESS: loader returns status → freshness=ok, fact non-null, provenance carried", async () => {
    const r = await projection.compute({ client: fakeClient });
    expect(r.freshness.status).toBe("ok");
    expect(r.fact).not.toBeNull();
    expect(r.fact!.provenance.kind).toBe("durable_query");
    expect(r.fact!.value.programme?.slug).toBe("scaffolding");
    expect(validateProjectionInvariant(r).ok).toBe(true);
  });

  it("SUCCESS: provenance query_signature includes name+version+slug", async () => {
    const r = await projection.compute({ client: fakeClient, programme_slug: "scaffolding" });
    expect(r.fact).not.toBeNull();
    if (r.fact && r.fact.provenance.kind === "durable_query") {
      expect(r.fact.provenance.query_signature).toContain(
        SCAFFOLDING_PROGRAMME_PROJECTION_NAME,
      );
      expect(r.fact.provenance.query_signature).toContain("scaffolding");
    }
  });

  it("SUCCESS: provenance store names include the authoritative NEX tables", async () => {
    const r = await projection.compute({ client: fakeClient });
    expect(r.fact).not.toBeNull();
    if (r.fact) {
      const s = r.fact.provenance.store;
      expect(s).toContain("nex.discovery_programme");
      expect(s).toContain("nex.discovery_business_evidence");
      expect(s).toContain("nex.discovery_entity");
    }
  });

  it("ERROR: loader throws → freshness=error, fact=null (NO silent zero)", async () => {
    const p = new ScaffoldingProgrammeProjection(async () => {
      throw new Error("boom");
    });
    const r = await p.compute({ client: fakeClient });
    expect(r.freshness.status).toBe("error");
    expect(r.fact).toBeNull(); // <-- the crucial anti-silent-zero property
    if (r.freshness.status === "error") {
      expect(r.freshness.error).toContain("boom");
    }
    expect(validateProjectionInvariant(r).ok).toBe(true);
  });

  it("UNAVAILABLE: loader throws 'relation does not exist' → freshness=unavailable, fact=null", async () => {
    const p = new ScaffoldingProgrammeProjection(async () => {
      throw new Error("relation \"nex.discovery_programme\" does not exist");
    });
    const r = await p.compute({ client: fakeClient });
    expect(r.freshness.status).toBe("unavailable");
    expect(r.fact).toBeNull();
    if (r.freshness.status === "unavailable") {
      expect(r.freshness.reason).toContain("authoritative_store_unavailable");
    }
    expect(validateProjectionInvariant(r).ok).toBe(true);
  });

  it("SUCCESS: default programme_slug is 'scaffolding' when not provided", async () => {
    let seenSlug = "";
    const p = new ScaffoldingProgrammeProjection(async (_c, slug) => {
      seenSlug = slug;
      return makeStatus();
    });
    await p.compute({ client: fakeClient });
    expect(seenSlug).toBe("scaffolding");
  });

  it("compute() NEVER throws (contract: errors become freshness=error)", async () => {
    const p = new ScaffoldingProgrammeProjection(async () => {
      throw new TypeError("unexpected shape");
    });
    // Should not throw · returns error result
    await expect(p.compute({ client: fakeClient })).resolves.toBeDefined();
  });

  it("ANTI-SILENT-ZERO: on error, fact.value is NOT a zero-defaults status object", async () => {
    const p = new ScaffoldingProgrammeProjection(async () => {
      throw new Error("db down");
    });
    const r = await p.compute({ client: fakeClient });
    // The failure mode we're guarding against: consumer sees a fact with
    // programme.queue.total_in_scope = 0 that looks like a legitimate zero.
    // The correct behaviour: fact is null.
    expect(r.fact).toBeNull();
    expect(r.freshness.status).not.toBe("ok");
  });

  it("Default constructor binds to the real loadScaffoldingProgrammeStatus (no fake completeness)", () => {
    // We cannot execute the default loader without a live DB, but we can
    // verify the constructor stores a reference — the source-level test
    // below proves the import comes from the real aggregator module.
    const p = new ScaffoldingProgrammeProjection();
    expect(p).toBeInstanceOf(ScaffoldingProgrammeProjection);
    expect(p.name).toBe(SCAFFOLDING_PROGRAMME_PROJECTION_NAME);
  });
});

describe("Source-level guardrails · Stage 6", () => {
  it("scaffolding-programme-projection.ts imports the REAL aggregator (not a copy)", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.join(process.cwd(), "src/lib/nex/capability-runtime/projections/scaffolding-programme-projection.ts"),
      "utf8",
    );
    // Must import from the real aggregator path.
    expect(src).toMatch(/from ["']\.\.\/\.\.\/discovery-world\/scaffolding-programme-status["']/);
  });

  it("scaffolding-programme-projection.ts does NOT import any writer module", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.join(process.cwd(), "src/lib/nex/capability-runtime/projections/scaffolding-programme-projection.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/from ["'].*aof\/lifecycle["']/);
    expect(src).not.toMatch(/from ["'].*aof\/cycle["']/);
    expect(src).not.toMatch(/from ["'].*harvest\/queue["']/);
    expect(src).not.toMatch(/from ["'].*business-evidence["']/);
    // No SQL writes
    expect(src).not.toMatch(/\bINSERT\b|\bUPDATE\b|\bDELETE\b/);
  });

  it("projection-engine.ts does NOT import authoritative stores directly (contract-only)", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.join(process.cwd(), "src/lib/nex/capability-runtime/projection-engine.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/from ["'].*discovery-world/);
    expect(src).not.toMatch(/from ["'].*harvest/);
    expect(src).not.toMatch(/from ["'].*aof\//);
    // Only imports its sibling LoggedFact type
    expect(src).toMatch(/from ["']\.\/logged-fact["']/);
  });
});

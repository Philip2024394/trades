// src/lib/nex/capability-runtime/job-handle.test.ts
//
// Stage 8 acceptance · JobHandle typed seam.
// §18 no-fake-completeness discipline:
//   · Handle bundles Stage 7 snapshot + recovery + Stage 5 provenance refs
//   · yield_query is DB-authoritative (harvest_yield.job_id FK)
//   · worker_activity_query is null when lease_owner is null (never fabricated)
//   · No fetch/write helpers exported
//   · No import from harvest writer modules

import { describe, it, expect } from "vitest";
import type { HarvestJob } from "../harvest/types";
import { jobHandleFromHarvestJob } from "./job-handle";
import { validateProvenanceRef } from "./logged-fact";

const iso = "2026-09-23T09:15:00.000Z";

function makeJob(overrides: Partial<HarvestJob> = {}): HarvestJob {
  return {
    job_id: "job-abc-123",
    job_type: "source_probe",
    programme_id: "scaffolding",
    country_iso: "GB",
    source_id: "nominatim_openstreetmap",
    payload: { term: "scaffolding" },
    idempotency_key: "k1",
    status: "processing",
    priority: 10,
    attempts: 1,
    max_attempts: 3,
    next_attempt_at: iso,
    lease_owner: "worker-01",
    lease_acquired_at: iso,
    lease_expires_at: iso,
    heartbeat_at: iso,
    last_error: null,
    last_error_at: null,
    dead_letter_reason: null,
    dead_letter_at: null,
    completed_at: null,
    parent_job_id: null,
    created_at: iso,
    updated_at: iso,
    ...overrides,
  };
}

describe("JobHandle · Stage 8 · typed seam", () => {
  it("bundles snapshot + recovery + provenance refs into one handle", () => {
    const h = jobHandleFromHarvestJob(makeJob());
    expect(h.job_id).toBe("job-abc-123");
    expect(h.snapshot.job_id).toBe("job-abc-123");
    expect(h.snapshot.provenance_store).toBe("nex.harvest_job");
    expect(h.recovery.job_id).toBe("job-abc-123");
    expect(h.yield_query).toBeDefined();
    expect(h.worker_activity_query).toBeDefined();
  });

  it("yield_query is DB-authoritative durable_query pointing at nex.harvest_yield with job_id filter", () => {
    const h = jobHandleFromHarvestJob(makeJob());
    expect(h.yield_query.kind).toBe("durable_query");
    expect(h.yield_query.store).toBe("nex.harvest_yield");
    if (h.yield_query.kind === "durable_query") {
      expect(h.yield_query.query_signature).toContain("job_id=job-abc-123");
    }
    expect(validateProvenanceRef(h.yield_query).ok).toBe(true);
  });

  it("worker_activity_query is non-null when lease_owner is set", () => {
    const h = jobHandleFromHarvestJob(makeJob({ lease_owner: "worker-42" }));
    expect(h.worker_activity_query).not.toBeNull();
    if (h.worker_activity_query && h.worker_activity_query.kind === "durable_query") {
      expect(h.worker_activity_query.store).toBe("nex.aof_agent_event");
      expect(h.worker_activity_query.query_signature).toContain("worker_id=worker-42");
    }
    expect(validateProvenanceRef(h.worker_activity_query!).ok).toBe(true);
  });

  it("worker_activity_query is NULL when lease_owner is null (no fabricated correlation)", () => {
    const h = jobHandleFromHarvestJob(makeJob({ lease_owner: null }));
    expect(h.worker_activity_query).toBeNull();
  });

  it("snapshot carries DB-authoritative parent_job_id from the row", () => {
    const h = jobHandleFromHarvestJob(makeJob({ parent_job_id: "parent-xyz" }));
    expect(h.snapshot.parent_job_id).toBe("parent-xyz");
  });

  it("recovery classifies retriable failed jobs", () => {
    const h = jobHandleFromHarvestJob(makeJob({
      status: "failed", attempts: 1, max_attempts: 3, lease_owner: null,
    }));
    expect(h.recovery.is_retriable).toBe(true);
    expect(h.recovery.is_dead_letter).toBe(false);
  });

  it("recovery classifies dead-letter jobs", () => {
    const h = jobHandleFromHarvestJob(makeJob({
      status: "dead_letter", dead_letter_reason: "too many failures",
    }));
    expect(h.recovery.is_dead_letter).toBe(true);
    expect(h.recovery.is_retriable).toBe(false);
  });

  it("handle is a plain object · no proxy · no getters that trigger side effects", () => {
    const h = jobHandleFromHarvestJob(makeJob());
    expect(Object.getPrototypeOf(h)).toBe(Object.prototype);
    // JSON serialisation smoke test · handle is fully data
    expect(() => JSON.stringify(h)).not.toThrow();
  });

  it("multiple constructions with the same input produce equal handles (pure function)", () => {
    const row = makeJob();
    const h1 = jobHandleFromHarvestJob(row);
    const h2 = jobHandleFromHarvestJob(row);
    expect(JSON.stringify(h1)).toBe(JSON.stringify(h2));
  });
});

describe("JobHandle · anti-pattern surface (Stage 8 guardrail)", () => {
  it("module exports NO fetch/write/enqueue/claim/complete helpers", async () => {
    const mod = await import("./job-handle");
    for (const key of Object.keys(mod)) {
      expect(key.toLowerCase()).not.toMatch(
        /^(fetch|read|load|query|enqueue|claim|complete|fail|dead|write|persist|store|save|insert|update|delete|spawn|dispatch|schedule)/,
      );
    }
  });

  it("job-handle.ts source does NOT import harvest writers (queue/reaper)", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.join(process.cwd(), "src/lib/nex/capability-runtime/job-handle.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/from ["'].*harvest\/queue["']/);
    expect(src).not.toMatch(/from ["'].*harvest\/reaper["']/);
    expect(src).not.toMatch(/from ["'].*aof\/lifecycle["']/);
    // Only type import from harvest/types is allowed
    expect(src).toMatch(/from ["']\.\.\/harvest\/types["']/);
  });

  it("job-handle.ts source contains NO SQL INSERT/UPDATE/DELETE", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.join(process.cwd(), "src/lib/nex/capability-runtime/job-handle.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/\bINSERT\b|\bUPDATE\b|\bDELETE\b/);
  });

  it("provenance refs in the handle validate as well-formed DurableProvenanceRef", () => {
    const h = jobHandleFromHarvestJob(makeJob());
    expect(validateProvenanceRef(h.yield_query).ok).toBe(true);
    if (h.worker_activity_query) {
      expect(validateProvenanceRef(h.worker_activity_query).ok).toBe(true);
    }
  });
});

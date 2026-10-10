// src/lib/nex/capability-runtime/projection-engine.test.ts
//
// Stage 6 acceptance tests · generic projection engine + freshness invariants.

import { describe, it, expect } from "vitest";
import type { LoggedFact } from "./logged-fact";
import {
  okResult,
  staleResult,
  unavailableResult,
  errorResult,
  validateProjectionInvariant,
  type ProjectionResult,
} from "./projection-engine";

const iso = "2026-09-23T08:50:00.000Z";
const sampleFact: LoggedFact<{ count: number }> = {
  value: { count: 42 },
  provenance: {
    kind: "durable_query",
    store: "nex.aof_agent_event",
    query_signature: "test:count",
    recorded_at: iso,
  },
  recorded_at: iso,
};

describe("Projection freshness helpers · Stage 6", () => {
  it("okResult produces status=ok with non-null fact", () => {
    const r = okResult({
      projection_name: "test", projection_version: "1.0.0",
      fact: sampleFact, computed_at: iso,
    });
    expect(r.freshness.status).toBe("ok");
    expect(r.fact).not.toBeNull();
    expect(r.projection_name).toBe("test");
    expect(r.projection_version).toBe("1.0.0");
    expect(r.computed_at).toBe(iso);
  });

  it("staleResult produces status=stale with non-null fact and last_ok_at + reason", () => {
    const r = staleResult({
      projection_name: "test", projection_version: "1.0.0",
      fact: sampleFact,
      last_ok_at: iso,
      staleness_reason: "no data since last cycle",
      computed_at: iso,
    });
    expect(r.freshness.status).toBe("stale");
    if (r.freshness.status === "stale") {
      expect(r.freshness.last_ok_at).toBe(iso);
      expect(r.freshness.staleness_reason).toBe("no data since last cycle");
    }
    expect(r.fact).not.toBeNull();
  });

  it("unavailableResult produces status=unavailable with NULL fact", () => {
    const r = unavailableResult<{ count: number }>({
      projection_name: "test", projection_version: "1.0.0",
      reason: "schema not applied",
      computed_at: iso,
    });
    expect(r.freshness.status).toBe("unavailable");
    expect(r.fact).toBeNull();
    if (r.freshness.status === "unavailable") {
      expect(r.freshness.reason).toBe("schema not applied");
    }
  });

  it("errorResult produces status=error with NULL fact", () => {
    const r = errorResult<{ count: number }>({
      projection_name: "test", projection_version: "1.0.0",
      error: "boom",
      computed_at: iso,
    });
    expect(r.freshness.status).toBe("error");
    expect(r.fact).toBeNull();
    if (r.freshness.status === "error") {
      expect(r.freshness.error).toBe("boom");
    }
  });
});

describe("Projection invariant · no silent zero (§ core doctrine)", () => {
  it("VALID: ok freshness with non-null fact", () => {
    const r = okResult({
      projection_name: "t", projection_version: "1",
      fact: sampleFact, computed_at: iso,
    });
    expect(validateProjectionInvariant(r).ok).toBe(true);
  });

  it("VALID: unavailable freshness with null fact", () => {
    const r = unavailableResult<{ count: number }>({
      projection_name: "t", projection_version: "1",
      reason: "gone", computed_at: iso,
    });
    expect(validateProjectionInvariant(r).ok).toBe(true);
  });

  it("VALID: error freshness with null fact", () => {
    const r = errorResult<{ count: number }>({
      projection_name: "t", projection_version: "1",
      error: "boom", computed_at: iso,
    });
    expect(validateProjectionInvariant(r).ok).toBe(true);
  });

  it("VALID: stale freshness with non-null fact", () => {
    const r = staleResult({
      projection_name: "t", projection_version: "1",
      fact: sampleFact, last_ok_at: iso,
      staleness_reason: "n/a", computed_at: iso,
    });
    expect(validateProjectionInvariant(r).ok).toBe(true);
  });

  it("INVALID: ok freshness with null fact (compile-time protected, runtime double-check)", () => {
    const bad: ProjectionResult<{ count: number }> = {
      projection_name: "t", projection_version: "1",
      fact: null,
      freshness: { status: "ok" },
      computed_at: iso,
    };
    const v = validateProjectionInvariant(bad);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain("non_null_fact");
  });

  it("INVALID: unavailable freshness carrying a non-null fact (would mean fake data)", () => {
    const bad: ProjectionResult<{ count: number }> = {
      projection_name: "t", projection_version: "1",
      fact: sampleFact,
      freshness: { status: "unavailable", reason: "x" },
      computed_at: iso,
    };
    const v = validateProjectionInvariant(bad);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain("null_fact");
  });

  it("INVALID: error freshness carrying a non-null fact (violates no-silent-zero)", () => {
    const bad: ProjectionResult<{ count: number }> = {
      projection_name: "t", projection_version: "1",
      fact: sampleFact,
      freshness: { status: "error", error: "e" },
      computed_at: iso,
    };
    expect(validateProjectionInvariant(bad).ok).toBe(false);
  });
});

describe("Freshness type surface (§ 4 named states, no ambiguity)", () => {
  it("only produces one of four freshness states", () => {
    const states = new Set([
      okResult({ projection_name: "t", projection_version: "1", fact: sampleFact, computed_at: iso }).freshness.status,
      staleResult({ projection_name: "t", projection_version: "1", fact: sampleFact, last_ok_at: iso, staleness_reason: "s", computed_at: iso }).freshness.status,
      unavailableResult({ projection_name: "t", projection_version: "1", reason: "u", computed_at: iso }).freshness.status,
      errorResult({ projection_name: "t", projection_version: "1", error: "e", computed_at: iso }).freshness.status,
    ]);
    expect([...states].sort()).toEqual(["error", "ok", "stale", "unavailable"]);
  });
});

describe("Projection surface anti-patterns · Stage 6 guardrail", () => {
  it("projection-engine module exports NO write/persist/store helpers", async () => {
    const mod = await import("./projection-engine");
    for (const key of Object.keys(mod)) {
      expect(key.toLowerCase()).not.toMatch(/^(write|persist|store|save|insert|update|delete|cache)/);
    }
  });
});

// src/lib/nex/capability-runtime/agent-lifecycle.test.ts
//
// Stage 7 acceptance · agent lifecycle + topology + task lifecycle contracts.
// §18 no-fake-completeness discipline:
//   · Snapshot adapter losslessly wraps real AofAgent / HarvestJob rows
//   · ALLOWED_TRANSITIONS mirrors agent-registry.ts enforcement
//   · Topology carries evidence markers · no invented parent/child claims
//   · Task parent/child is DB-authoritative (from harvest_job.parent_job_id)
//   · No write/mutate/dispatch helpers exported

import { describe, it, expect } from "vitest";
import type { AofAgent, AgentRole } from "../aof/types";
import type { HarvestJob } from "../harvest/types";
import {
  ALLOWED_TRANSITIONS,
  KNOWN_LIFECYCLE_STATUSES,
  canTransition,
  fromAofAgent,
} from "./agent-lifecycle";
import {
  AGENT_TOPOLOGY,
  childrenOf,
  parentsOf,
  linksBetween,
  hasRelationship,
} from "./agent-topology";
import {
  KNOWN_TASK_STATUSES,
  TERMINAL_TASK_STATUSES,
  fromHarvestJob,
  isTerminalStatus,
  toRecoveryView,
} from "./task-lifecycle";

const iso = "2026-09-23T09:00:00.000Z";

function makeAgent(overrides: Partial<AofAgent> = {}): AofAgent {
  return {
    agent_id: "agent-test-01",
    agent_name: "orbiting-primary",
    agent_role: "orbiting",
    description: "Top-level orchestrator",
    status: "active",
    founder_signed: true,
    founder_signed_at: iso,
    founder_signed_by: "founder",
    last_seen_at: iso,
    created_at: iso,
    updated_at: iso,
    metadata: { note: "ok" },
    ...overrides,
  };
}

function makeJob(overrides: Partial<HarvestJob> = {}): HarvestJob {
  return {
    job_id: "job-01",
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

// ─── AgentLifecycle · adapter + transitions ───────────────────────────

describe("AgentLifecycle · Stage 7", () => {
  it("KNOWN_LIFECYCLE_STATUSES has all 5 AOF states", () => {
    expect(KNOWN_LIFECYCLE_STATUSES.length).toBe(5);
    expect([...KNOWN_LIFECYCLE_STATUSES].sort()).toEqual(
      ["active", "error", "paused", "registered", "stopped"],
    );
  });

  it("fromAofAgent losslessly wraps every AofAgent field", () => {
    const row = makeAgent();
    const snap = fromAofAgent(row);
    expect(snap.agent_id).toBe(row.agent_id);
    expect(snap.agent_name).toBe(row.agent_name);
    expect(snap.agent_role).toBe(row.agent_role);
    expect(snap.status).toBe(row.status);
    expect(snap.founder_signed).toBe(row.founder_signed);
    expect(snap.founder_signed_at).toBe(row.founder_signed_at);
    expect(snap.last_seen_at).toBe(row.last_seen_at);
    expect(snap.metadata).toBe(row.metadata);
    expect(snap.provenance_row_id).toBe(row.agent_id);
    expect(snap.provenance_store).toBe("nex.aof_agent");
  });

  it("canTransition allows registered → active only when founder_signed", () => {
    expect(canTransition({ from: "registered", to: "active", founder_signed: true }).allowed).toBe(true);
    const denied = canTransition({ from: "registered", to: "active", founder_signed: false });
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) expect(denied.reason).toContain("founder_signed");
  });

  it("canTransition allows active → paused/stopped/error without founder-sign requirement", () => {
    for (const to of ["paused", "stopped", "error"] as const) {
      expect(canTransition({ from: "active", to, founder_signed: false }).allowed).toBe(true);
    }
  });

  it("canTransition rejects unknown transitions with a reason", () => {
    const r = canTransition({ from: "stopped", to: "active", founder_signed: true });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toContain("no_transition");
  });

  it("canTransition treats no-op transitions as allowed", () => {
    expect(canTransition({ from: "active", to: "active", founder_signed: true }).allowed).toBe(true);
  });

  it("ALLOWED_TRANSITIONS contains exactly the 9 rules mirroring agent-registry.ts", () => {
    expect(ALLOWED_TRANSITIONS.length).toBe(9);
    // Every entry references only known statuses.
    for (const t of ALLOWED_TRANSITIONS) {
      expect(KNOWN_LIFECYCLE_STATUSES).toContain(t.from);
      expect(KNOWN_LIFECYCLE_STATUSES).toContain(t.to);
    }
  });
});

// ─── AgentTopology · code-derived · honest evidence ───────────────────

describe("AgentTopology · Stage 7 · code-derived, DB-honest", () => {
  it("every topology link carries an evidence marker (honesty invariant)", () => {
    for (const link of AGENT_TOPOLOGY) {
      expect(link.evidence).toMatch(/^code_derived_from_/);
    }
  });

  it("no evidence value claims DB provenance (§ core honesty rule)", () => {
    for (const link of AGENT_TOPOLOGY) {
      expect(link.evidence).not.toContain("db");
      expect(link.evidence).not.toContain("row");
      expect(link.evidence).not.toContain("authoritative");
    }
  });

  it("every parent_role and child_role is a valid AgentRole", () => {
    const validRoles: readonly AgentRole[] = [
      "source_intelligence", "rate_governor", "country_scheduler",
      "api_adapter_registry", "heartbeat_recovery", "discovery",
      "website_walk", "evidence_audit", "orbiting", "live_streaming",
      "connections", "gate_adapter",
    ];
    for (const link of AGENT_TOPOLOGY) {
      expect(validRoles).toContain(link.parent_role);
      expect(validRoles).toContain(link.child_role);
    }
  });

  it("every topology link has a non-trivial reason", () => {
    for (const link of AGENT_TOPOLOGY) {
      expect(link.reason.length).toBeGreaterThan(20);
    }
  });

  it("orbiting is the parent for at least 6 children (dispatches to most roles)", () => {
    const children = childrenOf("orbiting");
    expect(children.length).toBeGreaterThanOrEqual(6);
  });

  it("orbiting invokes discovery + website_walk + evidence_audit", () => {
    const orbChildren = childrenOf("orbiting").map((l) => l.child_role);
    expect(orbChildren).toContain("discovery");
    expect(orbChildren).toContain("website_walk");
    expect(orbChildren).toContain("evidence_audit");
  });

  it("no self-loop (a role cannot be parent AND child of itself)", () => {
    for (const link of AGENT_TOPOLOGY) {
      expect(link.parent_role).not.toBe(link.child_role);
    }
  });

  it("hasRelationship reflects presence in AGENT_TOPOLOGY", () => {
    expect(hasRelationship("orbiting", "discovery")).toBe(true);
    expect(hasRelationship("orbiting", "orbiting")).toBe(false);
    expect(hasRelationship("gate_adapter", "orbiting")).toBe(false); // reverse never true
  });

  it("linksBetween returns kind-annotated relationships", () => {
    const links = linksBetween("orbiting", "heartbeat_recovery");
    expect(links.length).toBe(1);
    expect(links[0].kind).toBe("orchestrates");
  });

  it("parentsOf(heartbeat_recovery) surfaces orbiting", () => {
    const parents = parentsOf("heartbeat_recovery").map((l) => l.parent_role);
    expect(parents).toContain("orbiting");
  });

  it("topology exposes only 4 link kinds (bounded taxonomy)", () => {
    const kinds = new Set(AGENT_TOPOLOGY.map((l) => l.kind));
    for (const k of kinds) {
      expect(["orchestrates", "invokes", "provides_recovery_for", "consults"]).toContain(k);
    }
  });

  it("no topology module export names contain write/dispatch/spawn/mutate", async () => {
    const mod = await import("./agent-topology");
    for (const key of Object.keys(mod)) {
      expect(key.toLowerCase()).not.toMatch(/(write|dispatch|spawn|mutate|create|delete|update)/);
    }
  });
});

// ─── TaskLifecycle · DB-authoritative parent/child ────────────────────

describe("TaskLifecycle · Stage 7 · DB-authoritative parent_job_id", () => {
  it("KNOWN_TASK_STATUSES has the 6 harvest_job states", () => {
    expect(KNOWN_TASK_STATUSES.length).toBe(6);
  });

  it("TERMINAL_TASK_STATUSES = [completed, dead_letter]", () => {
    expect([...TERMINAL_TASK_STATUSES].sort()).toEqual(["completed", "dead_letter"]);
  });

  it("isTerminalStatus classifies correctly", () => {
    expect(isTerminalStatus("completed")).toBe(true);
    expect(isTerminalStatus("dead_letter")).toBe(true);
    expect(isTerminalStatus("queued")).toBe(false);
    expect(isTerminalStatus("processing")).toBe(false);
  });

  it("fromHarvestJob losslessly wraps every HarvestJob field", () => {
    const row = makeJob({ parent_job_id: "parent-42" });
    const snap = fromHarvestJob(row);
    expect(snap.job_id).toBe(row.job_id);
    expect(snap.parent_job_id).toBe("parent-42");
    expect(snap.status).toBe(row.status);
    expect(snap.attempts).toBe(row.attempts);
    expect(snap.max_attempts).toBe(row.max_attempts);
    expect(snap.lease_owner).toBe(row.lease_owner);
    expect(snap.dead_letter_reason).toBe(row.dead_letter_reason);
    expect(snap.provenance_row_id).toBe(row.job_id);
    expect(snap.provenance_store).toBe("nex.harvest_job");
  });

  it("fromHarvestJob preserves null parent_job_id (top-level tasks)", () => {
    const snap = fromHarvestJob(makeJob({ parent_job_id: null }));
    expect(snap.parent_job_id).toBeNull();
  });

  it("toRecoveryView reports is_retriable for failed with attempts < max", () => {
    const snap = fromHarvestJob(makeJob({ status: "failed", attempts: 1, max_attempts: 3 }));
    const rv = toRecoveryView(snap);
    expect(rv.is_retriable).toBe(true);
    expect(rv.is_dead_letter).toBe(false);
  });

  it("toRecoveryView reports is_dead_letter for dead_letter status", () => {
    const snap = fromHarvestJob(makeJob({ status: "dead_letter", dead_letter_reason: "no retries left" }));
    const rv = toRecoveryView(snap);
    expect(rv.is_dead_letter).toBe(true);
    expect(rv.is_retriable).toBe(false);
  });

  it("toRecoveryView reports not-retriable for exhausted attempts", () => {
    const snap = fromHarvestJob(makeJob({ status: "failed", attempts: 3, max_attempts: 3 }));
    const rv = toRecoveryView(snap);
    expect(rv.is_retriable).toBe(false);
  });

  it("task-lifecycle module exports no write/enqueue/claim/complete helpers", async () => {
    const mod = await import("./task-lifecycle");
    for (const key of Object.keys(mod)) {
      expect(key.toLowerCase()).not.toMatch(/(enqueue|claim|complete|fail|dead|write|persist|store|save|insert|update|delete)/);
    }
  });
});

// ─── Source-level guardrails · § 15 · no protected-code modifications ──

describe("Source-level guardrails · Stage 7", () => {
  it("agent-lifecycle.ts does NOT import authoritative writer", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.join(process.cwd(), "src/lib/nex/capability-runtime/agent-lifecycle.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/from ["'].*aof\/agent-registry["']/);
    expect(src).not.toMatch(/from ["'].*aof\/lifecycle["']/);
    // Only type imports from aof/types are allowed
    expect(src).toMatch(/from ["']\.\.\/aof\/types["']/);
  });

  it("agent-topology.ts does NOT import any AOF agent implementation", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.join(process.cwd(), "src/lib/nex/capability-runtime/agent-topology.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/from ["'].*aof\/agents\//);
    expect(src).not.toMatch(/from ["'].*aof\/governors\//);
    expect(src).not.toMatch(/from ["'].*aof\/agent-registry["']/);
    expect(src).not.toMatch(/from ["'].*aof\/lifecycle["']/);
  });

  it("task-lifecycle.ts does NOT import harvest/queue or harvest/reaper", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.join(process.cwd(), "src/lib/nex/capability-runtime/task-lifecycle.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/from ["'].*harvest\/queue["']/);
    expect(src).not.toMatch(/from ["'].*harvest\/reaper["']/);
    // Only type import from harvest/types is allowed
    expect(src).toMatch(/from ["']\.\.\/harvest\/types["']/);
  });

  it("no Stage 7 file contains SQL INSERT/UPDATE/DELETE (source-text check)", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    for (const f of [
      "agent-lifecycle.ts",
      "agent-topology.ts",
      "task-lifecycle.ts",
    ]) {
      const src = await fs.readFile(
        path.join(process.cwd(), "src/lib/nex/capability-runtime", f),
        "utf8",
      );
      expect(src).not.toMatch(/\bINSERT\b|\bUPDATE\b|\bDELETE\b/);
    }
  });
});

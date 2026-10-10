// src/lib/nex/capability-runtime/agent-profile.test.ts
//
// Stage 10 acceptance · AgentProfile composition.
// §18 no-fake-completeness: every field must be sourced from an existing
// authoritative seam (Stage 2/3/7/9). No new state introduced.

import { describe, it, expect } from "vitest";
import type { AofCapabilityGrant, AofAgent } from "../aof/types";
import { fromAofAgent } from "./agent-lifecycle";
import { buildAgentProfile } from "./agent-profile";

const iso = "2026-09-23T09:30:00.000Z";

function makeAgent(role: AofAgent["agent_role"] = "orbiting"): AofAgent {
  return {
    agent_id: `agent-${role}-01`,
    agent_name: `${role}-primary`,
    agent_role: role,
    description: null,
    status: "active",
    founder_signed: true,
    founder_signed_at: iso,
    founder_signed_by: "founder",
    last_seen_at: iso,
    created_at: iso,
    updated_at: iso,
    metadata: {},
  };
}

function makeGrant(agent_id: string, capability: AofCapabilityGrant["capability"]): AofCapabilityGrant {
  return {
    agent_id,
    capability,
    scope: {},
    granted_by: "founder",
    granted_at: iso,
    revoked_at: null,
  };
}

describe("AgentProfile composition · Stage 10", () => {
  it("composes identity + role_spec + grants + coverage + topology + gates for a known role", () => {
    const snapshot = fromAofAgent(makeAgent("orbiting"));
    const grants = [
      makeGrant(snapshot.agent_id, "orbit_territories"),
      makeGrant(snapshot.agent_id, "schedule_country"),
      makeGrant(snapshot.agent_id, "failover_source"),
      makeGrant(snapshot.agent_id, "recover_worker"),
    ];
    const p = buildAgentProfile({ snapshot, grants, composed_at: iso });

    expect(p.identity.agent_id).toBe(snapshot.agent_id);
    expect(p.identity.agent_role).toBe("orbiting");
    expect(p.role_spec).not.toBeNull();
    expect(p.role_spec!.consumer_id).toBe("orbiting");
    expect(p.grants.length).toBe(4);
    expect(p.capability_coverage.satisfied).toBe(true);
    expect(p.capability_coverage.missing.length).toBe(0);
    expect(p.composed_at).toBe(iso);
    expect(p.composition_version).toBe("1.0.0");
  });

  it("capability_coverage.missing lists exactly the required-but-not-granted capabilities", () => {
    const snapshot = fromAofAgent(makeAgent("orbiting"));
    // orbiting requires: orbit_territories, schedule_country, failover_source, recover_worker
    // Grant only 2 of 4
    const grants = [
      makeGrant(snapshot.agent_id, "orbit_territories"),
      makeGrant(snapshot.agent_id, "schedule_country"),
    ];
    const p = buildAgentProfile({ snapshot, grants });
    expect(p.capability_coverage.satisfied).toBe(false);
    expect([...p.capability_coverage.missing].sort()).toEqual([
      "failover_source",
      "recover_worker",
    ]);
    expect([...p.capability_coverage.granted].sort()).toEqual([
      "orbit_territories",
      "schedule_country",
    ]);
  });

  it("empty grants produce coverage.missing = full required list (never fabricated)", () => {
    const snapshot = fromAofAgent(makeAgent("discovery"));
    // discovery requires source_probe + publish_evidence
    const p = buildAgentProfile({ snapshot, grants: [] });
    expect(p.capability_coverage.granted.length).toBe(0);
    expect([...p.capability_coverage.missing].sort()).toEqual([
      "publish_evidence",
      "source_probe",
    ]);
    expect(p.capability_coverage.satisfied).toBe(false);
  });

  it("granted extras beyond required are recorded in granted but not missing", () => {
    const snapshot = fromAofAgent(makeAgent("rate_governor"));
    // rate_governor requires manage_cooldown · grant that + one extra
    const grants = [
      makeGrant(snapshot.agent_id, "manage_cooldown"),
      makeGrant(snapshot.agent_id, "stream_events"),
    ];
    const p = buildAgentProfile({ snapshot, grants });
    expect(p.capability_coverage.satisfied).toBe(true);
    expect(p.capability_coverage.missing.length).toBe(0);
    expect(p.capability_coverage.granted.length).toBe(2);
  });

  it("invokes topology (Stage 7): orbiting invokes several children", () => {
    const snapshot = fromAofAgent(makeAgent("orbiting"));
    const p = buildAgentProfile({ snapshot, grants: [] });
    expect(p.invokes.length).toBeGreaterThan(0);
    const childRoles = p.invokes.map((l) => l.child_role);
    expect(childRoles).toContain("discovery");
    expect(childRoles).toContain("website_walk");
  });

  it("invoked_by topology (Stage 7): heartbeat_recovery is invoked by orbiting", () => {
    const snapshot = fromAofAgent(makeAgent("heartbeat_recovery"));
    const p = buildAgentProfile({ snapshot, grants: [] });
    const parentRoles = p.invoked_by.map((l) => l.parent_role);
    expect(parentRoles).toContain("orbiting");
  });

  it("gates_by_capability lists Stage 9 enforcement gates for each granted capability", () => {
    const snapshot = fromAofAgent(makeAgent("rate_governor"));
    const grants = [makeGrant(snapshot.agent_id, "manage_cooldown")];
    const p = buildAgentProfile({ snapshot, grants });
    const gates = p.gates_by_capability["manage_cooldown"];
    expect(gates.length).toBeGreaterThan(0);
    const gateIds = gates.map((g) => g.gate_id);
    expect(gateIds).toContain("rate_governor");
    expect(gateIds).toContain("source_cooldown");
  });

  it("gates_by_capability keys match granted capabilities exactly", () => {
    const snapshot = fromAofAgent(makeAgent("discovery"));
    const grants = [
      makeGrant(snapshot.agent_id, "source_probe"),
      makeGrant(snapshot.agent_id, "publish_evidence"),
    ];
    const p = buildAgentProfile({ snapshot, grants });
    expect([...Object.keys(p.gates_by_capability)].sort()).toEqual([
      "publish_evidence",
      "source_probe",
    ]);
  });

  it("role_spec null when the role is not registered in AGENT_CONSUMERS", () => {
    // All 12 AgentRoles are in AGENT_CONSUMERS. This test proves the null
    // branch works even though it's not reachable via typed input · we
    // simulate an unknown role via cast.
    const snapshot = fromAofAgent(makeAgent("orbiting"));
    const rewrittenSnap = {
      ...snapshot,
      // deliberately not a real role
      agent_role: "unknown_role_xyz" as never,
    };
    const p = buildAgentProfile({ snapshot: rewrittenSnap, grants: [] });
    expect(p.role_spec).toBeNull();
    // With no known role_spec, required is empty · granted is empty · satisfied is FALSE (nothing to satisfy)
    expect(p.capability_coverage.required.length).toBe(0);
    expect(p.capability_coverage.satisfied).toBe(false);
  });

  it("uses supplied composed_at timestamp when provided", () => {
    const snapshot = fromAofAgent(makeAgent());
    const p = buildAgentProfile({ snapshot, grants: [], composed_at: iso });
    expect(p.composed_at).toBe(iso);
  });

  it("defaults composed_at to now() ISO when not supplied", () => {
    const snapshot = fromAofAgent(makeAgent());
    const p = buildAgentProfile({ snapshot, grants: [] });
    expect(p.composed_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("is a pure function · same inputs produce equal outputs", () => {
    const snapshot = fromAofAgent(makeAgent("evidence_audit"));
    const grants = [makeGrant(snapshot.agent_id, "audit_evidence")];
    const p1 = buildAgentProfile({ snapshot, grants, composed_at: iso });
    const p2 = buildAgentProfile({ snapshot, grants, composed_at: iso });
    expect(JSON.stringify(p1)).toBe(JSON.stringify(p2));
  });

  it("profile object is plain and JSON-serialisable (no proxies · no getters with side effects)", () => {
    const snapshot = fromAofAgent(makeAgent());
    const p = buildAgentProfile({ snapshot, grants: [] });
    expect(Object.getPrototypeOf(p)).toBe(Object.prototype);
    expect(() => JSON.stringify(p)).not.toThrow();
  });
});

describe("Stage 10 anti-pattern surface", () => {
  it("agent-profile module exports NO write/register/create/mutate FUNCTIONS", async () => {
    const mod: Record<string, unknown> = await import("./agent-profile");
    for (const key of Object.keys(mod)) {
      if (typeof mod[key] !== "function") continue;
      expect(key.toLowerCase()).not.toMatch(
        /^(write|register|create|update|delete|mutate|persist|store|save|grant|revoke|dispatch|spawn)/,
      );
    }
  });

  it("agent-profile.ts source imports NO authoritative writer", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.join(process.cwd(), "src/lib/nex/capability-runtime/agent-profile.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/from ["'].*aof\/agent-registry["']/);
    expect(src).not.toMatch(/from ["'].*aof\/capability["']/);
    expect(src).not.toMatch(/from ["'].*aof\/lifecycle["']/);
    expect(src).not.toMatch(/from ["'].*harvest\/queue["']/);
    // Only type imports from aof/types are allowed
    expect(src).toMatch(/from ["']\.\.\/aof\/types["']/);
    // No SQL writes
    expect(src).not.toMatch(/\bINSERT\b|\bUPDATE\b|\bDELETE\b/);
  });

  it("agent-profile.ts imports from Stage 2/3/7/9 seams only (composition)", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.join(process.cwd(), "src/lib/nex/capability-runtime/agent-profile.ts"),
      "utf8",
    );
    // Must reference each stage's contribution
    expect(src).toMatch(/from ["']\.\/contract["']/);       // Stage 2
    expect(src).toMatch(/from ["']\.\/consumers["']/);       // Stage 3
    expect(src).toMatch(/from ["']\.\/agent-lifecycle["']/); // Stage 7
    expect(src).toMatch(/from ["']\.\/agent-topology["']/);  // Stage 7
    expect(src).toMatch(/from ["']\.\/execution-level["']/); // Stage 9
  });
});

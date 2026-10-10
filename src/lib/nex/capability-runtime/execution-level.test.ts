// src/lib/nex/capability-runtime/execution-level.test.ts
//
// Stage 9 acceptance · execution-level metadata + enforcement-gate catalogue.
// §18 no-fake-completeness: every EnforcementGate.implementing_module MUST
// exist on disk. This is the anti-invention test.

import { describe, it, expect } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { KNOWN_CAPABILITIES } from "./contract";
import {
  KNOWN_EXECUTION_LEVELS,
  EXECUTION_LEVEL_DESCRIPTIONS,
  ENFORCEMENT_GATES,
  describe as describeLevel,
  ordinalOf,
  isAtLeast,
  gateById,
  gatesForLevel,
  gatesByKind,
  gatesForCapability,
} from "./execution-level";

const ROOT = process.cwd();

describe("ExecutionLevel taxonomy · Stage 9", () => {
  it("KNOWN_EXECUTION_LEVELS has exactly 6 levels", () => {
    expect(KNOWN_EXECUTION_LEVELS.length).toBe(6);
  });

  it("EXECUTION_LEVEL_DESCRIPTIONS covers every level exactly once", () => {
    const covered = EXECUTION_LEVEL_DESCRIPTIONS.map((d) => d.level).sort();
    expect(covered).toEqual([...KNOWN_EXECUTION_LEVELS].sort());
  });

  it("ordinals are 0..5 in order", () => {
    for (let i = 0; i < KNOWN_EXECUTION_LEVELS.length; i++) {
      const level = KNOWN_EXECUTION_LEVELS[i];
      expect(ordinalOf(level)).toBe(i);
    }
  });

  it("describe() returns the matching description for every level", () => {
    for (const level of KNOWN_EXECUTION_LEVELS) {
      const d = describeLevel(level);
      expect(d.level).toBe(level);
      expect(d.short_name.length).toBeGreaterThan(0);
      expect(d.description.length).toBeGreaterThan(30);
      expect(["reversible", "reversible_with_procedure", "irreversible"]).toContain(d.reversibility);
    }
  });

  it("E5 is irreversible", () => {
    expect(describeLevel("E5_DESTRUCTIVE_IRREVERSIBLE").reversibility).toBe("irreversible");
  });

  it("E3+ requires Founder authority; E0-E2 do not", () => {
    expect(describeLevel("E0_OBSERVE").requires_founder_authority).toBe(false);
    expect(describeLevel("E1_ISOLATED_BUILD").requires_founder_authority).toBe(false);
    expect(describeLevel("E2_TESTED_MUTATION").requires_founder_authority).toBe(false);
    expect(describeLevel("E3_PROTECTED_PROMOTION").requires_founder_authority).toBe(true);
    expect(describeLevel("E4_PRODUCTION_OPERATION").requires_founder_authority).toBe(true);
    expect(describeLevel("E5_DESTRUCTIVE_IRREVERSIBLE").requires_founder_authority).toBe(true);
  });

  it("isAtLeast is a monotone ordering", () => {
    expect(isAtLeast("E5_DESTRUCTIVE_IRREVERSIBLE", "E0_OBSERVE")).toBe(true);
    expect(isAtLeast("E4_PRODUCTION_OPERATION", "E3_PROTECTED_PROMOTION")).toBe(true);
    expect(isAtLeast("E0_OBSERVE", "E1_ISOLATED_BUILD")).toBe(false);
    expect(isAtLeast("E3_PROTECTED_PROMOTION", "E3_PROTECTED_PROMOTION")).toBe(true);
  });

  it("describe() throws on unknown level (defensive)", () => {
    expect(() => describeLevel("E99_UNKNOWN" as never)).toThrow(/unknown_execution_level/);
  });
});

describe("Enforcement gate catalogue · Stage 9 (§18 · no fake completeness)", () => {
  it("catalogue is non-empty (at least the 12 known gates)", () => {
    expect(ENFORCEMENT_GATES.length).toBeGreaterThanOrEqual(12);
  });

  it("ANTI-INVENTION: every EnforcementGate.implementing_module exists on disk", async () => {
    for (const gate of ENFORCEMENT_GATES) {
      const abs = path.join(ROOT, gate.implementing_module);
      let stat;
      try { stat = await fs.stat(abs); } catch { stat = null; }
      expect(stat, `${gate.gate_id} cites ${gate.implementing_module} — must exist`).not.toBeNull();
      expect(stat!.isFile()).toBe(true);
    }
  });

  it("every gate has a unique gate_id", () => {
    const ids = ENFORCEMENT_GATES.map((g) => g.gate_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every gate's execution_level is a valid ExecutionLevel", () => {
    for (const gate of ENFORCEMENT_GATES) {
      expect(KNOWN_EXECUTION_LEVELS).toContain(gate.execution_level);
    }
  });

  it("every gate has a non-trivial display_name and note", () => {
    for (const gate of ENFORCEMENT_GATES) {
      expect(gate.display_name.length).toBeGreaterThan(10);
      expect(gate.note.length).toBeGreaterThan(30);
    }
  });

  it("every gate's enforcement_kind is in the bounded taxonomy", () => {
    const allowed = [
      "capability_grant",
      "founder_signing",
      "activation_env",
      "founder_signed_allowlist",
      "ip_classification",
      "publication_gate",
      "doctrine_lock",
      "rate_policy",
      "cooldown_policy",
      "failover_policy",
      "scheduler_policy",
    ];
    for (const gate of ENFORCEMENT_GATES) {
      expect(allowed).toContain(gate.enforcement_kind);
    }
  });

  it("every capability_name in a gate is a real KNOWN_CAPABILITIES value", () => {
    for (const gate of ENFORCEMENT_GATES) {
      for (const cap of gate.capability_names ?? []) {
        expect(KNOWN_CAPABILITIES).toContain(cap);
      }
    }
  });

  it("E5 catalogue contains at least the publication gate (irreversible action)", () => {
    const e5 = gatesForLevel("E5_DESTRUCTIVE_IRREVERSIBLE").map((g) => g.gate_id);
    expect(e5).toContain("publication_gate");
  });

  it("E3 catalogue contains at least Founder-signing and doctrine locks", () => {
    const e3 = gatesForLevel("E3_PROTECTED_PROMOTION").map((g) => g.gate_id);
    expect(e3).toContain("aof_founder_signing");
    expect(e3).toContain("security_agent_doctrine_locks");
  });

  it("E4 catalogue contains at least capability grants and activation envs", () => {
    const e4 = gatesForLevel("E4_PRODUCTION_OPERATION").map((g) => g.gate_id);
    expect(e4).toContain("aof_capability_grant");
    expect(e4).toContain("page_fetcher_activation");
    expect(e4).toContain("discovery_cron_activation");
  });

  it("gateById returns the same entry as the catalogue", () => {
    for (const gate of ENFORCEMENT_GATES) {
      expect(gateById(gate.gate_id)).toBe(gate);
    }
    expect(gateById("not-a-gate")).toBeNull();
  });

  it("gatesByKind filters correctly", () => {
    const rate = gatesByKind("rate_policy").map((g) => g.gate_id);
    expect(rate).toContain("rate_governor");
    expect(rate).not.toContain("publication_gate");
  });

  it("gatesForCapability surfaces gates that name a capability", () => {
    const g = gatesForCapability("manage_cooldown").map((x) => x.gate_id);
    expect(g).toContain("rate_governor");
    expect(g).toContain("source_cooldown");
    expect(gatesForCapability("orbit_territories").length).toBeGreaterThanOrEqual(0);
  });
});

describe("Stage 9 anti-pattern surface (§ enforcement stays elsewhere)", () => {
  it("execution-level module exports NO enforce/apply/override/deny/allow FUNCTIONS", async () => {
    const mod: Record<string, unknown> = await import("./execution-level");
    for (const key of Object.keys(mod)) {
      // Anti-pattern check applies to functions only. Data catalogues
      // like ENFORCEMENT_GATES are metadata — they don't act, they describe.
      if (typeof mod[key] !== "function") continue;
      expect(key.toLowerCase()).not.toMatch(
        /^(enforce|apply|override|deny|allow|grant|revoke|sign|activate|deactivate|publish|delete|write|store|persist)/,
      );
    }
  });

  it("execution-level.ts imports NO authoritative enforcer", async () => {
    const src = await fs.readFile(
      path.join(ROOT, "src/lib/nex/capability-runtime/execution-level.ts"),
      "utf8",
    );
    // Only type imports from contract.ts are allowed
    expect(src).toMatch(/from ["']\.\/contract["']/);
    // These would indicate duplicated enforcement
    expect(src).not.toMatch(/from ["'].*aof\/capability["']/);
    expect(src).not.toMatch(/from ["'].*aof\/agent-registry["']/);
    expect(src).not.toMatch(/from ["'].*aof\/governors\//);
    expect(src).not.toMatch(/from ["'].*harvest\/production-boot["']/);
    expect(src).not.toMatch(/from ["'].*nex-security\//);
    // No writes
    expect(src).not.toMatch(/\bINSERT\b|\bUPDATE\b|\bDELETE\b/);
  });
});

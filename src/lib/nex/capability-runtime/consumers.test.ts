// src/lib/nex/capability-runtime/consumers.test.ts
//
// Stage 3 acceptance tests · domain taxonomy + agent-role consumer specs.
// §18 no-fake-completeness discipline:
//   - Domain map must cover every capability in KNOWN_CAPABILITIES
//   - Consumers must cover every AgentRole in the AOF type union
//   - Every consumer's `requires` list references only known capabilities
//   - Registry exposes real domain + consumer read views

import { describe, it, expect } from "vitest";
import type { PgClient, AgentRole } from "../aof/types";
import { buildDefaultDiscoveryRegistry } from "../aof/adapters/registry";
import { NexCapabilityRegistry } from "./registry";
import { KNOWN_CAPABILITIES } from "./contract";
import {
  DOMAIN_ASSIGNMENTS,
  KNOWN_DOMAINS,
  capabilitiesInDomain,
  type CapabilityDomain,
} from "./domain";
import {
  AGENT_CONSUMERS,
  getAgentConsumer,
  consumersOfCapability,
} from "./consumers";

// Minimal fake client · these tests only exercise metadata, not DB paths.
const emptyClient: PgClient = {
  async query() {
    return { rows: [], rowCount: 0 };
  },
};

const registry = new NexCapabilityRegistry({
  client: emptyClient,
  adapter_registry: buildDefaultDiscoveryRegistry({}),
});

// The complete AOF AgentRole union — kept in sync manually.
// If this list drifts from src/lib/nex/aof/types.ts, the coverage test fails.
const ALL_AGENT_ROLES: readonly AgentRole[] = [
  "source_intelligence",
  "rate_governor",
  "country_scheduler",
  "api_adapter_registry",
  "heartbeat_recovery",
  "discovery",
  "website_walk",
  "evidence_audit",
  "orbiting",
  "live_streaming",
  "connections",
  "gate_adapter",
];

describe("Domain taxonomy · Stage 3", () => {
  it("KNOWN_DOMAINS has 6 entries", () => {
    expect(KNOWN_DOMAINS.length).toBe(6);
  });

  it("DOMAIN_ASSIGNMENTS covers every KNOWN_CAPABILITY exactly once", () => {
    const assignedCapabilities = Object.keys(DOMAIN_ASSIGNMENTS).sort();
    expect(assignedCapabilities).toEqual([...KNOWN_CAPABILITIES].sort());
  });

  it("every domain has at least one capability assigned", () => {
    for (const domain of KNOWN_DOMAINS) {
      const caps = capabilitiesInDomain(domain);
      expect(caps.length, `domain ${domain}`).toBeGreaterThan(0);
    }
  });

  it("union of capabilitiesInDomain() over all domains equals KNOWN_CAPABILITIES", () => {
    const union = new Set<string>();
    for (const domain of KNOWN_DOMAINS) {
      for (const cap of capabilitiesInDomain(domain)) union.add(cap);
    }
    expect([...union].sort()).toEqual([...KNOWN_CAPABILITIES].sort());
  });

  it("no capability appears in two domains", () => {
    const seen = new Set<string>();
    for (const domain of KNOWN_DOMAINS) {
      for (const cap of capabilitiesInDomain(domain)) {
        expect(seen.has(cap), `${cap} in multiple domains`).toBe(false);
        seen.add(cap);
      }
    }
  });
});

describe("Registry domain + consumer read views · Stage 3", () => {
  it("listDomains() returns all known domains", () => {
    expect(registry.listDomains()).toEqual(KNOWN_DOMAINS);
  });

  it("listCapabilitiesInDomain() returns definitions with matching domain", () => {
    for (const domain of KNOWN_DOMAINS) {
      const defs = registry.listCapabilitiesInDomain(domain);
      expect(defs.length).toBeGreaterThan(0);
      for (const d of defs) {
        expect(d.domain).toBe(domain);
      }
    }
  });

  it("every CapabilityDefinition has domain field populated correctly", () => {
    for (const def of registry.listDefinitions()) {
      expect(def.domain).toBe(DOMAIN_ASSIGNMENTS[def.name]);
    }
  });

  it("listConsumers() returns 12 role-level consumers", () => {
    const consumers = registry.listConsumers();
    expect(consumers.length).toBe(12);
  });

  it("getConsumer() resolves each known role by name", () => {
    for (const role of ALL_AGENT_ROLES) {
      const c = registry.getConsumer(role);
      expect(c, `consumer for role ${role}`).not.toBeNull();
      expect(c!.consumer_id).toBe(role);
      expect(c!.consumer_kind).toBe("aof_agent");
    }
  });

  it("getConsumer() returns null for unknown consumer_id", () => {
    expect(registry.getConsumer("not_an_agent_role")).toBeNull();
  });
});

describe("Agent role consumer specs · Stage 3", () => {
  it("AGENT_CONSUMERS length matches AgentRole union count (12)", () => {
    expect(AGENT_CONSUMERS.length).toBe(12);
  });

  it("AGENT_CONSUMERS covers every AgentRole exactly once", () => {
    const consumerIds = AGENT_CONSUMERS.map((c) => c.consumer_id).sort();
    expect(consumerIds).toEqual([...ALL_AGENT_ROLES].sort());
  });

  it("every consumer's requires list references only KNOWN_CAPABILITIES", () => {
    const known = new Set<string>(KNOWN_CAPABILITIES);
    for (const c of AGENT_CONSUMERS) {
      expect(c.requires.length, `${c.consumer_id} has empty requires`).toBeGreaterThan(0);
      for (const cap of c.requires) {
        expect(
          known.has(cap),
          `${c.consumer_id} requires unknown capability ${cap}`,
        ).toBe(true);
      }
    }
  });

  it("every KNOWN_CAPABILITY is required by at least one consumer (coverage)", () => {
    const requiredAny = new Set<string>();
    for (const c of AGENT_CONSUMERS) {
      for (const cap of c.requires) requiredAny.add(cap);
    }
    // Every capability the AOF defines must have at least one role that
    // legitimately requires it — otherwise the capability is orphaned.
    for (const cap of KNOWN_CAPABILITIES) {
      expect(requiredAny.has(cap), `no consumer requires ${cap}`).toBe(true);
    }
  });

  it("every consumer has a non-empty reason (documentation invariant)", () => {
    for (const c of AGENT_CONSUMERS) {
      expect(c.reason.length, `${c.consumer_id}.reason`).toBeGreaterThan(20);
    }
  });

  it("consumer_kind is always 'aof_agent' (Stage 3 scope)", () => {
    for (const c of AGENT_CONSUMERS) {
      expect(c.consumer_kind).toBe("aof_agent");
    }
  });

  it("consumersOfCapability() reverse lookup returns non-empty for every capability", () => {
    for (const cap of KNOWN_CAPABILITIES) {
      const consumers = consumersOfCapability(cap);
      expect(consumers.length, `no consumers for ${cap}`).toBeGreaterThan(0);
    }
  });

  it("consumersOfCapability(source_probe) includes discovery + source_intelligence roles", () => {
    const consumers = consumersOfCapability("source_probe").map((c) => c.consumer_id).sort();
    expect(consumers).toContain("discovery");
    expect(consumers).toContain("source_intelligence");
  });

  it("consumersOfCapability(orbit_territories) includes only orbiting role", () => {
    const consumers = consumersOfCapability("orbit_territories").map((c) => c.consumer_id);
    expect(consumers).toEqual(["orbiting"]);
  });

  it("getAgentConsumer() and registry.getConsumer() return the same entry", () => {
    for (const role of ALL_AGENT_ROLES) {
      expect(getAgentConsumer(role)).toBe(registry.getConsumer(role));
    }
  });

  it("orbiting role requires the four coordination-critical capabilities", () => {
    const orbiting = getAgentConsumer("orbiting");
    expect(orbiting).not.toBeNull();
    expect([...orbiting!.requires].sort()).toEqual(
      ["failover_source", "orbit_territories", "recover_worker", "schedule_country"],
    );
  });

  it("consumers do NOT reference protected implementation details (no PgClient, no adapter object)", () => {
    for (const c of AGENT_CONSUMERS) {
      const stringified = JSON.stringify(c);
      expect(stringified).not.toMatch(/PgClient|new Production|allowed_hosts/);
    }
  });
});

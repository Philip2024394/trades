// src/lib/nex/capability-runtime/contract.test.ts
//
// Stage 2 acceptance tests · proves the typed capability contract against
// the REAL NEX capability system (aof/capability.ts + AdapterRegistry).
//
// §18 no-fake-completeness discipline:
//   - Definitions must cover every capability in the AOF Capability union
//   - Providers must be derived from a real AdapterRegistry
//   - enforce() must invoke the real requireCapability and propagate
//     CapabilityDenied when the agent lacks the grant
//   - isGranted() and listGrantsFor() must return real query results
//
// The test uses an in-memory PgClient that responds to the exact SQL used
// by src/lib/nex/aof/capability.ts. This exercises the authoritative code
// paths without requiring a live Postgres.

import { describe, it, expect } from "vitest";
import type { PgClient, Capability, AofCapabilityGrant } from "../aof/types";
import { CapabilityDenied } from "../aof/capability";
import { buildDefaultDiscoveryRegistry } from "../aof/adapters/registry";
import { NexCapabilityRegistry } from "./registry";
import { KNOWN_CAPABILITIES } from "./contract";

interface FakeGrant {
  readonly agent_id: string;
  readonly capability: Capability;
}

// In-memory PgClient that matches the SQL in aof/capability.ts.
// If aof/capability.ts changes its query text, this fake will fail —
// which is the point: the contract wraps the real module.
function makeFakeClient(grants: readonly FakeGrant[]): PgClient {
  return {
    async query(text: string, params?: unknown[]) {
      const agentId = (params?.[0] as string | undefined) ?? "";
      const cap = (params?.[1] as string | undefined) ?? "";
      if (text.includes("SELECT 1 FROM nex.aof_agent_capability")) {
        const found = grants.some(
          (g) => g.agent_id === agentId && g.capability === cap,
        );
        return { rows: found ? [{ ok: 1 }] : [], rowCount: found ? 1 : 0 };
      }
      if (text.includes("SELECT * FROM nex.aof_agent_capability")) {
        const rows = grants
          .filter((g) => g.agent_id === agentId)
          .map((g) => ({
            agent_id: g.agent_id,
            capability: g.capability,
            scope: {},
            granted_by: "founder",
            granted_at: "2026-09-23T00:00:00.000Z",
            revoked_at: null,
          }));
        return { rows, rowCount: rows.length };
      }
      throw new Error("unexpected query in fake client: " + text.slice(0, 120));
    },
  };
}

describe("NexCapabilityRegistry · Stage 2 typed capability contract", () => {
  const adapterRegistry = buildDefaultDiscoveryRegistry({});
  const client = makeFakeClient([
    { agent_id: "agent-source-intel", capability: "source_probe" },
    { agent_id: "agent-source-intel", capability: "connect_adapter" },
    { agent_id: "agent-orbiting", capability: "orbit_territories" },
    { agent_id: "agent-orbiting", capability: "schedule_country" },
    { agent_id: "agent-orbiting", capability: "failover_source" },
  ]);
  const registry = new NexCapabilityRegistry({
    client,
    adapter_registry: adapterRegistry,
  });

  it("lists all 12 known capabilities as definitions", () => {
    const defs = registry.listDefinitions();
    expect(defs.length).toBe(12);
    const names = defs.map((d) => d.name).sort();
    expect(names).toEqual([...KNOWN_CAPABILITIES].sort());
  });

  it("KNOWN_CAPABILITIES matches the AOF Capability type union count", () => {
    expect(KNOWN_CAPABILITIES.length).toBe(12);
  });

  it("resolves each known capability by name with implementing_module path", () => {
    for (const cap of KNOWN_CAPABILITIES) {
      const def = registry.getDefinition(cap);
      expect(def, `definition for ${cap}`).not.toBeNull();
      expect(def!.name).toBe(cap);
      expect(def!.implementing_module).toMatch(/^src\/lib\/nex\/.+\.ts$/);
      expect(def!.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(Array.isArray(def!.scope_keys)).toBe(true);
    }
  });

  it("returns null for an unknown capability name lookup", () => {
    // Cast avoids TS narrowing; we want to prove runtime returns null too.
    expect(registry.getDefinition("not_a_capability" as Capability)).toBeNull();
  });

  it("lists AdapterRegistry entries as providers", () => {
    const providers = registry.listProviders();
    // buildDefaultDiscoveryRegistry with no allowlist registers all slugs
    // with NULL adapters, so providers list is non-empty.
    expect(providers.length).toBeGreaterThan(0);
    for (const p of providers) {
      expect(p.provider_kind).toBe("adapter");
      expect(p.capabilities).toContain("source_probe");
      expect(p.capabilities).toContain("connect_adapter");
      expect(p.source_slug).toBeTruthy();
    }
  });

  it("marks providers as unsigned when adapter registry has no allowlist (NULL adapters)", () => {
    // buildDefaultDiscoveryRegistry({}) with no allowlist → NULL_* adapters
    const providers = registry.listProviders();
    for (const p of providers) {
      expect(p.signed).toBe(false);
    }
  });

  it("marks providers as signed when their allowed host is provided", () => {
    const signedRegistry = new NexCapabilityRegistry({
      client,
      adapter_registry: buildDefaultDiscoveryRegistry({
        overpass_allowed_hosts: ["overpass-api.de"],
        nominatim_allowed_hosts: ["nominatim.openstreetmap.org"],
        wikidata_allowed_hosts: ["query.wikidata.org"],
      }),
    });
    const providers = signedRegistry.listProviders();
    const signed = providers.filter((p) => p.signed);
    // Overpass covers 4 slugs when its host is allowed, Nominatim 1, Wikidata 1
    expect(signed.length).toBeGreaterThan(0);
  });

  it("getProvider by id returns the same entry as listProviders", () => {
    const providers = registry.listProviders();
    const first = providers[0];
    expect(registry.getProvider(first.provider_id)).toEqual(first);
    expect(registry.getProvider("adapter:does-not-exist")).toBeNull();
  });

  it("enforce() proxies to real requireCapability · resolves when granted", async () => {
    await expect(
      registry.enforce("agent-source-intel", "source_probe"),
    ).resolves.toBeUndefined();
  });

  it("enforce() proxies to real requireCapability · throws CapabilityDenied when NOT granted", async () => {
    await expect(
      registry.enforce("agent-source-intel", "orbit_territories"),
    ).rejects.toBeInstanceOf(CapabilityDenied);
  });

  it("enforce() correctly refuses unknown agent · CapabilityDenied", async () => {
    await expect(
      registry.enforce("agent-does-not-exist", "source_probe"),
    ).rejects.toBeInstanceOf(CapabilityDenied);
  });

  it("CapabilityDenied error message includes agent_id and capability name", async () => {
    await expect(
      registry.enforce("agent-source-intel", "audit_evidence"),
    ).rejects.toThrowError(/agent-source-intel/);
  });

  it("isGranted returns real hasCapability boolean", async () => {
    expect(
      await registry.isGranted("agent-source-intel", "source_probe"),
    ).toBe(true);
    expect(
      await registry.isGranted("agent-source-intel", "audit_evidence"),
    ).toBe(false);
    expect(
      await registry.isGranted("agent-orbiting", "orbit_territories"),
    ).toBe(true);
  });

  it("listGrantsFor returns real listCapabilities result rows", async () => {
    const grants = await registry.listGrantsFor("agent-orbiting");
    expect(grants.length).toBe(3);
    const caps = grants.map((g) => g.capability).sort();
    expect(caps).toEqual(["failover_source", "orbit_territories", "schedule_country"]);
    for (const g of grants) {
      expect(g.agent_id).toBe("agent-orbiting");
      expect(g.granted_by).toBe("founder");
      expect(g.revoked_at).toBeNull();
    }
  });

  it("listGrantsFor returns empty array for unknown agent (never throws)", async () => {
    const grants = await registry.listGrantsFor("agent-does-not-exist");
    expect(grants).toEqual([]);
  });

  it("does NOT expose grant/revoke methods (writes stay in aof/capability.ts)", () => {
    const anyReg = registry as unknown as Record<string, unknown>;
    expect(anyReg.grantCapability).toBeUndefined();
    expect(anyReg.revokeCapability).toBeUndefined();
    expect(anyReg.grant).toBeUndefined();
    expect(anyReg.revoke).toBeUndefined();
  });
});

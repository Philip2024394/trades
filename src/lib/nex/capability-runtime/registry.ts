// src/lib/nex/capability-runtime/registry.ts
//
// NexCapabilityRegistry · concrete implementation of CapabilityRegistry.
// Founder-authorised build-lane addition · 2026-09-23.
//
// This class:
//   · READS static definitions for the 12 known capabilities
//   · READS providers from the existing AdapterRegistry (never mirrors)
//   · PROXIES enforce()/isGranted()/listGrantsFor() to the real functions
//     from src/lib/nex/aof/capability.ts (never reimplements denial)
//
// It holds no capability state. It cannot grant or revoke — those
// operations remain in the authoritative module.

import type { PgClient, AofCapabilityGrant } from "../aof/types";
import { hasCapability, requireCapability, listCapabilities } from "../aof/capability";
import { AdapterRegistry } from "../aof/adapters/registry";
import { NULL_OVERPASS_ADAPTER } from "../harvest";
import { NULL_NOMINATIM_ADAPTER } from "../aof/adapters/nominatim-adapter";
import { NULL_WIKIDATA_ADAPTER } from "../aof/adapters/wikidata-adapter";
import type {
  CapabilityConsumer,
  CapabilityDefinition,
  CapabilityName,
  CapabilityProvider,
  CapabilityRegistry,
} from "./contract";
import type { CapabilityDomain } from "./domain";
import { DOMAIN_ASSIGNMENTS, KNOWN_DOMAINS } from "./domain";
import { AGENT_CONSUMERS, getAgentConsumer } from "./consumers";

// ─── Static definitions for the 12 known capabilities ─────────────────
//
// Raw definitions omit the `domain` field. The registry composes the final
// CapabilityDefinition[] by looking up DOMAIN_ASSIGNMENTS at load time.
// This keeps the domain map as the single source of truth.

type RawCapabilityDefinition = Omit<CapabilityDefinition, "domain">;

const RAW_DEFINITIONS: readonly RawCapabilityDefinition[] = [
  {
    name: "source_probe",
    description:
      "Query a Founder-signed external discovery source for candidate businesses",
    version: "1.0.0",
    implementing_module: "src/lib/nex/harvest/source-probe-executor.ts",
    scope_keys: ["source_slug", "country_iso", "term"],
    example_grant_scope: {
      source_slug: "nominatim_openstreetmap",
      country_iso: "GB",
      term: "scaffolding",
    },
  },
  {
    name: "website_walk",
    description:
      "Fetch permitted public website pages via BehaviorWalkFetcher / ProductionPageFetcher",
    version: "1.0.0",
    implementing_module: "src/lib/nex/harvest/website-walk-executor.ts",
    scope_keys: ["max_pages_per_entity", "deadline_ms"],
    example_grant_scope: { max_pages_per_entity: 8, deadline_ms: 45000 },
  },
  {
    name: "publish_evidence",
    description:
      "Record verified business + email evidence into nex.discovery_business_evidence",
    version: "1.0.0",
    implementing_module: "src/lib/nex/discovery-world/business-evidence.ts",
    scope_keys: ["programme_id"],
    example_grant_scope: { programme_id: "scaffolding" },
  },
  {
    name: "manage_cooldown",
    description: "Apply, lift, and inspect nex.aof_source_cooldown entries",
    version: "1.0.0",
    implementing_module: "src/lib/nex/aof/governors/source-cooldown.ts",
    scope_keys: ["max_cooldown_ms"],
    example_grant_scope: { max_cooldown_ms: 3_600_000 },
  },
  {
    name: "schedule_country",
    description:
      "Select next country for probe (Asia-last enforced at scheduler)",
    version: "1.0.0",
    implementing_module: "src/lib/nex/harvest/country-scheduler.ts",
    scope_keys: ["programme_id"],
    example_grant_scope: { programme_id: "scaffolding" },
  },
  {
    name: "failover_source",
    description:
      "Choose next source when primary is on cooldown (never bypasses cooldown)",
    version: "1.0.0",
    implementing_module: "src/lib/nex/aof/governors/failover.ts",
    scope_keys: [],
    example_grant_scope: {},
  },
  {
    name: "recover_worker",
    description:
      "Reap stale leases, restart interrupted workers (harvest reaper)",
    version: "1.0.0",
    implementing_module: "src/lib/nex/harvest/reaper.ts",
    scope_keys: [],
    example_grant_scope: {},
  },
  {
    name: "emit_heartbeat",
    description:
      "Append liveness heartbeat to nex.aof_agent_event and touch last_seen_at",
    version: "1.0.0",
    implementing_module: "src/lib/nex/aof/lifecycle.ts",
    scope_keys: [],
    example_grant_scope: {},
  },
  {
    name: "stream_events",
    description:
      "Publish operational snapshot events consumed by HQ Operations Centre",
    version: "1.0.0",
    implementing_module: "src/lib/nex/aof/agents/live-streaming-agent.ts",
    scope_keys: [],
    example_grant_scope: {},
  },
  {
    name: "connect_adapter",
    description:
      "Instantiate a Founder-signed adapter provider (Overpass / Nominatim / Wikidata)",
    version: "1.0.0",
    implementing_module: "src/lib/nex/aof/adapters/registry.ts",
    scope_keys: ["source_slug"],
    example_grant_scope: { source_slug: "wikidata_query_service" },
  },
  {
    name: "audit_evidence",
    description:
      "Run R1-R6 integrity audits on nex.discovery_business_evidence",
    version: "1.0.0",
    implementing_module: "src/lib/nex/aof/agents/evidence-audit-agent.ts",
    scope_keys: [],
    example_grant_scope: {},
  },
  {
    name: "orbit_territories",
    description:
      "Coordinate whole-cycle orbit across territories (Asia-last enforced)",
    version: "1.0.0",
    implementing_module: "src/lib/nex/aof/agents/orbiting-agent.ts",
    scope_keys: ["programme_id"],
    example_grant_scope: { programme_id: "scaffolding" },
  },
];

// Compose the final definitions by attaching domain from DOMAIN_ASSIGNMENTS.
const DEFINITIONS: readonly CapabilityDefinition[] = RAW_DEFINITIONS.map(
  (d) => ({ ...d, domain: DOMAIN_ASSIGNMENTS[d.name] }),
);

const DEFINITIONS_BY_NAME = new Map<CapabilityName, CapabilityDefinition>(
  DEFINITIONS.map((d) => [d.name, d] as const),
);

// ─── Provider derivation from AdapterRegistry ─────────────────────────

function isNullAdapter(adapter: unknown): boolean {
  return (
    adapter === NULL_OVERPASS_ADAPTER ||
    adapter === NULL_NOMINATIM_ADAPTER ||
    adapter === NULL_WIKIDATA_ADAPTER
  );
}

// ─── Concrete registry ────────────────────────────────────────────────

export interface NexCapabilityRegistryInput {
  readonly client: PgClient;
  readonly adapter_registry: AdapterRegistry;
}

export class NexCapabilityRegistry implements CapabilityRegistry {
  private readonly client: PgClient;
  private readonly adapters: AdapterRegistry;

  constructor(input: NexCapabilityRegistryInput) {
    this.client = input.client;
    this.adapters = input.adapter_registry;
  }

  listDefinitions(): readonly CapabilityDefinition[] {
    return DEFINITIONS;
  }

  getDefinition(name: CapabilityName): CapabilityDefinition | null {
    return DEFINITIONS_BY_NAME.get(name) ?? null;
  }

  listProviders(): readonly CapabilityProvider[] {
    return this.adapters.list().map((entry) => ({
      provider_id: `adapter:${entry.source_slug}`,
      provider_kind: "adapter" as const,
      capabilities: ["source_probe", "connect_adapter"] as const,
      signed: !isNullAdapter(entry.adapter),
      source_slug: entry.source_slug,
    }));
  }

  getProvider(provider_id: string): CapabilityProvider | null {
    return this.listProviders().find((p) => p.provider_id === provider_id) ?? null;
  }

  // ─── Stage 3 · Domain + Consumer read views ─────────────────────────

  listDomains(): readonly CapabilityDomain[] {
    return KNOWN_DOMAINS;
  }

  listCapabilitiesInDomain(domain: CapabilityDomain): readonly CapabilityDefinition[] {
    return DEFINITIONS.filter((d) => d.domain === domain);
  }

  listConsumers(): readonly CapabilityConsumer[] {
    return AGENT_CONSUMERS;
  }

  getConsumer(consumer_id: string): CapabilityConsumer | null {
    return getAgentConsumer(consumer_id);
  }

  // ─── Stage 2 · Enforcement seam ─────────────────────────────────────

  async enforce(agent_id: string, capability: CapabilityName): Promise<void> {
    // Proxies to authoritative implementation. Never reimplements denial.
    await requireCapability(this.client, agent_id, capability);
  }

  async isGranted(agent_id: string, capability: CapabilityName): Promise<boolean> {
    return hasCapability(this.client, agent_id, capability);
  }

  async listGrantsFor(
    agent_id: string,
  ): Promise<readonly AofCapabilityGrant[]> {
    return listCapabilities(this.client, agent_id);
  }
}

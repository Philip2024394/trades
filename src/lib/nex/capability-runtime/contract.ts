// src/lib/nex/capability-runtime/contract.ts
//
// NEX Capability Runtime · Stage 2 · Typed capability contract
// Founder-authorised build-lane addition · 2026-09-23.
//
// Purpose: type-safe wrapper interfaces for the capability seam.
// This module WRAPS `src/lib/nex/aof/capability.ts` and
// `src/lib/nex/aof/adapters/registry.ts`. It does NOT duplicate state:
// authoritative grants remain in `nex.aof_agent_capability`, and
// authoritative providers remain in `AdapterRegistry`.
//
// Doctrine locks:
//   _CAPABILITY_RUNTIME_WRAPS_AOF_NEVER_DUPLICATES
//   _CAPABILITY_RUNTIME_PROXIES_REQUIRE_CAPABILITY
//
// No table changes · no schema migration · no modification of protected code.

import type { Capability, AofCapabilityGrant } from "../aof/types";
import type { CapabilityDomain } from "./domain";

/** Canonical name for a NEX capability. Alias for the AOF-defined typed union. */
export type CapabilityName = Capability;

/**
 * All 12 known capability names.
 *
 * Kept in lockstep with the `Capability` type union in
 * `src/lib/nex/aof/types.ts`. If a capability is added there, add it here.
 * The contract test asserts length === 12.
 */
export const KNOWN_CAPABILITIES: readonly CapabilityName[] = [
  "source_probe",
  "website_walk",
  "publish_evidence",
  "manage_cooldown",
  "schedule_country",
  "failover_source",
  "recover_worker",
  "emit_heartbeat",
  "stream_events",
  "connect_adapter",
  "audit_evidence",
  "orbit_territories",
] as const;

/**
 * A capability definition. Names the seam, describes its intent, points
 * to the implementing module, and lists the valid scope keys.
 * The definition itself is READ-ONLY metadata; runtime enforcement lives
 * elsewhere (nex.aof_agent_capability + requireCapability).
 */
export interface CapabilityDefinition {
  readonly name: CapabilityName;
  readonly description: string;
  readonly version: string;
  readonly implementing_module: string;
  readonly scope_keys: readonly string[];
  readonly example_grant_scope: Record<string, unknown>;
  /** Primary domain classification (Stage 3 · metadata only). */
  readonly domain: CapabilityDomain;
}

/**
 * A provider fulfils zero or more capabilities.
 *
 * In current NEX, providers are:
 *   · discovery adapters (Nominatim / Overpass / Wikidata) — provide `source_probe` + `connect_adapter`
 *   · AOF agents implementing internal capabilities (heartbeat, cooldown, scheduling)
 *   · modules (website walker, evidence recorder)
 *
 * `source_slug` matches `nex.harvest_source.source_slug` where applicable.
 * `signed` mirrors the Founder-signed status of the provider — an adapter
 * is unsigned if it is a NULL_* placeholder (allowlist entry absent).
 */
export interface CapabilityProvider {
  readonly provider_id: string;
  readonly provider_kind: "adapter" | "agent" | "module";
  readonly capabilities: readonly CapabilityName[];
  readonly signed: boolean;
  readonly source_slug: string | null;
}

/**
 * A consumer requires one or more capability grants before invocation.
 * Consumers are AOF agent rows (identified by `agent_id`).
 *
 * The wrapper never bypasses the authoritative check —
 * `CapabilityRegistry.enforce()` proxies to the real `requireCapability`
 * from `src/lib/nex/aof/capability.ts`.
 */
export interface CapabilityConsumer {
  readonly consumer_id: string;
  readonly consumer_kind: "aof_agent";
  readonly requires: readonly CapabilityName[];
}

/**
 * Read view + enforcement seam for the NEX capability runtime.
 *
 * The registry is stateless: it composes reads from `AdapterRegistry`
 * (providers) and delegates all grant queries to `capability.ts`
 * (authoritative). It is NOT a cache.
 */
export interface CapabilityRegistry {
  listDefinitions(): readonly CapabilityDefinition[];
  getDefinition(name: CapabilityName): CapabilityDefinition | null;
  listProviders(): readonly CapabilityProvider[];
  getProvider(provider_id: string): CapabilityProvider | null;

  // Stage 3: domain + consumer read views (metadata only)
  listDomains(): readonly CapabilityDomain[];
  listCapabilitiesInDomain(domain: CapabilityDomain): readonly CapabilityDefinition[];
  listConsumers(): readonly CapabilityConsumer[];
  getConsumer(consumer_id: string): CapabilityConsumer | null;

  enforce(agent_id: string, capability: CapabilityName): Promise<void>;
  isGranted(agent_id: string, capability: CapabilityName): Promise<boolean>;
  listGrantsFor(agent_id: string): Promise<readonly AofCapabilityGrant[]>;
}

// ─── Doctrine locks (Stage 2) ─────────────────────────────────────────

export const _CAPABILITY_RUNTIME_WRAPS_AOF_NEVER_DUPLICATES =
  "capability_runtime_reads_authoritative_state_from_nex_aof_agent_capability_never_mirrors";

export const _CAPABILITY_RUNTIME_PROXIES_REQUIRE_CAPABILITY =
  "enforce_calls_the_real_requireCapability_from_aof_capability_never_reimplements_denial";

export const _CAPABILITY_RUNTIME_IS_ADDITIVE_ONLY =
  "stage_2_creates_only_new_files_never_modifies_protected_capability_ts_or_adapter_registry_ts";

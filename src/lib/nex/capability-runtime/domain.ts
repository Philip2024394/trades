// src/lib/nex/capability-runtime/domain.ts
//
// NEX Capability Runtime · Stage 3 · Capability domains (lightweight taxonomy)
// Founder-authorised build-lane addition · 2026-09-23.
//
// Purpose: categorise the 12 capabilities so future stages can discuss
// "everything is a capability in domain X" without churning per-capability
// individual imports. Additive · no runtime behaviour change.
//
// This is metadata only. The authoritative capability list remains
// `Capability` in `src/lib/nex/aof/types.ts`. Domains are a read-only
// classification.

import type { CapabilityName } from "./contract";

/**
 * Capability domain taxonomy for NEX AOF capabilities.
 * Kept small and NEX-native. Names taken from the DeepSeek Harness
 * concept list but scoped to what NEX actually has today.
 */
export type CapabilityDomain =
  | "discovery"       // source_probe · connect_adapter (finding real businesses)
  | "website_fetch"   // website_walk (permitted public website acquisition)
  | "evidence"        // publish_evidence · audit_evidence (verified business emails)
  | "governance"      // manage_cooldown · failover_source · schedule_country
  | "coordination"    // orbit_territories · stream_events (cycle orchestration + HQ streaming)
  | "lifecycle";      // emit_heartbeat · recover_worker (worker liveness + recovery)

/**
 * Assignment of each capability to its primary domain.
 * Every capability has exactly ONE primary domain (no dual-domain
 * assignments in this stage · keeps taxonomy simple).
 */
export const DOMAIN_ASSIGNMENTS: Readonly<Record<CapabilityName, CapabilityDomain>> = {
  source_probe:       "discovery",
  connect_adapter:    "discovery",
  website_walk:       "website_fetch",
  publish_evidence:   "evidence",
  audit_evidence:     "evidence",
  manage_cooldown:    "governance",
  failover_source:    "governance",
  schedule_country:   "governance",
  orbit_territories:  "coordination",
  stream_events:      "coordination",
  emit_heartbeat:     "lifecycle",
  recover_worker:     "lifecycle",
} as const;

/** All defined domain names, in a stable order for iteration. */
export const KNOWN_DOMAINS: readonly CapabilityDomain[] = [
  "discovery",
  "website_fetch",
  "evidence",
  "governance",
  "coordination",
  "lifecycle",
] as const;

/**
 * Return all capabilities assigned to a given domain.
 * Pure function · no state.
 */
export function capabilitiesInDomain(domain: CapabilityDomain): readonly CapabilityName[] {
  return (Object.entries(DOMAIN_ASSIGNMENTS) as [CapabilityName, CapabilityDomain][])
    .filter(([, d]) => d === domain)
    .map(([c]) => c);
}

// ─── Doctrine locks (Stage 3) ─────────────────────────────────────────

export const _DOMAIN_TAXONOMY_IS_METADATA_ONLY =
  "domains_do_not_affect_capability_enforcement_are_pure_classification";

export const _EVERY_CAPABILITY_HAS_EXACTLY_ONE_DOMAIN =
  "no_multi_domain_assignments_this_stage_taxonomy_stays_simple";

// WO-ACADEMY-01 · capability-profile builder + provenance.
//
// A profile is a snapshot of what an agent can do. Every profile carries a
// provenance chain hash covering all 11 founder-specified fields plus the
// known-weaknesses ledger.

import { randomUUID } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import { provenanceChainHash, sha256Hex } from "@/lib/nex-intelligence/provenance";
import type {
  CapabilityProfile,
  CapabilityProfileEvidencePointer,
  CapabilityProfileFailureType,
  KnownWeakness,
} from "./types";

export interface BuildProfileInput {
  readonly agent_id: string;
  readonly what_it_knows: readonly string[];
  readonly what_it_trained_on: readonly string[];
  readonly tasks_it_can_perform: readonly string[];
  readonly success_rate: number;
  readonly failure_types: readonly CapabilityProfileFailureType[];
  readonly qualified_tools: readonly string[];
  readonly evidence_pointers: readonly CapabilityProfileEvidencePointer[];
  readonly capability_scope: readonly string[];
  readonly current_workload: number;
  readonly confidence: number;
  readonly specialist_domain: string;
  readonly known_weaknesses: readonly KnownWeakness[];
  readonly version?: number;             // caller controls versioning
}

/**
 * Build a CapabilityProfile with a valid provenance chain hash.
 * Deterministic given the exact input (except for profile_id + updated_at).
 */
export function buildCapabilityProfile(input: BuildProfileInput): CapabilityProfile {
  const version = input.version ?? 1;
  const profile_id = `academy-profile-${sha256Hex(input.agent_id + String(version)).slice(0, 16)}-${randomUUID()}`;
  const base = {
    record_type: "NEX_ACADEMY_CAPABILITY_PROFILE" as const,
    profile_id,
    agent_id: input.agent_id,
    version,
    updated_at: new Date().toISOString(),
    what_it_knows: Object.freeze([...input.what_it_knows]) as readonly string[],
    what_it_trained_on: Object.freeze([...input.what_it_trained_on]) as readonly string[],
    tasks_it_can_perform: Object.freeze([...input.tasks_it_can_perform]) as readonly string[],
    success_rate: clamp01(input.success_rate),
    failure_types: Object.freeze([...input.failure_types]) as readonly CapabilityProfileFailureType[],
    qualified_tools: Object.freeze([...input.qualified_tools]) as readonly string[],
    evidence_pointers: Object.freeze([...input.evidence_pointers]) as readonly CapabilityProfileEvidencePointer[],
    capability_scope: Object.freeze([...input.capability_scope]) as readonly string[],
    current_workload: Math.max(0, Math.floor(input.current_workload)),
    confidence: clamp01(input.confidence),
    specialist_domain: input.specialist_domain,
    known_weaknesses: Object.freeze([...input.known_weaknesses]) as readonly KnownWeakness[],
  };
  return { ...base, provenance_chain_hash: provenanceChainHash(base, []) };
}

/**
 * Guard used by A-1: a caller cannot silently increase capability_scope
 * beyond what a signed WO authorised. This validates a candidate NEW
 * profile against the PREVIOUS profile's scope + an authorised expansion
 * list. Any scope entry in `candidate.capability_scope` that is neither
 * (a) already in `previous.capability_scope` nor (b) in `authorised_expansion`
 * is refused.
 */
export function validateScopeExpansion(input: {
  readonly previous: CapabilityProfile | null;
  readonly candidate: CapabilityProfile;
  readonly authorised_expansion: readonly string[];
}): { readonly ok: true } | { readonly ok: false; readonly unauthorised: readonly string[] } {
  const previousScope = new Set(input.previous?.capability_scope ?? []);
  const authorised = new Set(input.authorised_expansion);
  const unauthorised: string[] = [];
  for (const s of input.candidate.capability_scope) {
    if (previousScope.has(s)) continue;
    if (authorised.has(s)) continue;
    unauthorised.push(s);
  }
  if (unauthorised.length > 0) return { ok: false, unauthorised };
  return { ok: true };
}

export async function persistCapabilityProfile(p: CapabilityProfile): Promise<void> {
  await getStorage().save(COLLECTIONS.nex_academy_capability_profiles, p);
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

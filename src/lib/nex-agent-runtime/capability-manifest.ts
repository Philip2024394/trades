// WO-AGENT-RUNTIME-01 · capability manifest builder + verifier.
//
// Founder-locked 2026-09-13: every agent has a signed CapabilityManifest
// listing its 15 facets with a verification tier.
//
// HQ cards may only display a facet as ✅ when its tier >= RUNTIME_VERIFIED.
// CLAIMED-only facets show as UNVERIFIED — this is the code-existing ≠
// facet-verified rule.

import { randomUUID, sign as ed25519Sign, verify as ed25519Verify } from "node:crypto";
import { canonicalJson, provenanceChainHash } from "@/lib/nex-intelligence/provenance";
import type {
  AgentIdentity,
  CapabilityManifest,
  FacetKey,
  FacetStatus,
  FacetVerificationTier,
} from "./types";

/** All 15 founder-locked facets · order matches doctrine. */
export const ALL_FACETS: readonly FacetKey[] = Object.freeze([
  "brain",
  "memory",
  "tools",
  "vision",
  "network",
  "experiment",
  "knowledge",
  "identity",
  "liveness",
  "performance_history",
  "evidence",
  "training_state",
  "authority_boundary",
  "recovery_state",
  "learning_contribution",
]);

function manifestSignaturePayload(input: {
  manifest_id: string;
  agent_id: string;
  runtime_version: string;
  version: number;
  emitted_at: string;
  facets: readonly FacetStatus[];
  specialist_domain: string;
}): string {
  return canonicalJson({
    manifest_id: input.manifest_id,
    agent_id: input.agent_id,
    runtime_version: input.runtime_version,
    version: input.version,
    emitted_at: input.emitted_at,
    facets: input.facets,
    specialist_domain: input.specialist_domain,
  });
}

export interface BuildCapabilityManifestInput {
  readonly agent_id: string;
  readonly runtime_version: string;
  readonly version: number;
  readonly specialist_domain: string;
  readonly facets: Readonly<Partial<Record<FacetKey, Omit<FacetStatus, "facet">>>>;
  readonly runtime_private_key_hex: string;
  readonly emitted_at?: string;
}

/**
 * Build + agent-sign a CapabilityManifest. Any facet not specified in
 * `input.facets` defaults to { tier: "CLAIMED", evidence_pointer: null,
 * last_verified_at: null }. Founder-locked: CLAIMED does NOT grant HQ
 * green — it is the honest default.
 */
export function buildCapabilityManifest(input: BuildCapabilityManifestInput): CapabilityManifest {
  const emitted_at = input.emitted_at ?? new Date().toISOString();
  const manifest_id = `agent-capman-${input.agent_id}-v${input.version}-${randomUUID().slice(0, 8)}`;

  const facets: FacetStatus[] = ALL_FACETS.map((facet) => {
    const provided = input.facets[facet];
    if (provided) {
      return {
        facet,
        tier: provided.tier,
        evidence_pointer: provided.evidence_pointer,
        last_verified_at: provided.last_verified_at,
      };
    }
    return { facet, tier: "CLAIMED" as FacetVerificationTier, evidence_pointer: null, last_verified_at: null };
  });

  const payload = manifestSignaturePayload({
    manifest_id,
    agent_id: input.agent_id,
    runtime_version: input.runtime_version,
    version: input.version,
    emitted_at,
    facets,
    specialist_domain: input.specialist_domain,
  });

  const signature = ed25519Sign(null, Buffer.from(payload, "utf8"), {
    key: Buffer.from(input.runtime_private_key_hex, "hex"),
    format: "der", type: "pkcs8",
  });
  const runtime_signature_hex = signature.toString("hex");

  const base = {
    record_type: "NEX_AGENT_CAPABILITY_MANIFEST" as const,
    manifest_id,
    agent_id: input.agent_id,
    runtime_version: input.runtime_version,
    version: input.version,
    emitted_at,
    facets: Object.freeze(facets) as readonly FacetStatus[],
    specialist_domain: input.specialist_domain,
    runtime_signature_hex,
  };
  return { ...base, provenance_chain_hash: provenanceChainHash(base, []) };
}

/** Count facets at a specific verification tier or higher. */
export function countFacetsAtLeast(manifest: CapabilityManifest, minimum: FacetVerificationTier): number {
  const rank: Record<FacetVerificationTier, number> = {
    NOT_APPLICABLE: -1,   // NOT_APPLICABLE is neither above nor below other tiers — it's a distinct classification
    CLAIMED: 0,
    RUNTIME_VERIFIED: 1,
    PRODUCTION_VERIFIED: 2,
  };
  const target = rank[minimum];
  return manifest.facets.filter((f) => rank[f.tier] >= target).length;
}

/** True when the facet's tier is at least RUNTIME_VERIFIED (HQ green-eligible). */
export function isFacetHqGreenEligible(status: FacetStatus): boolean {
  return status.tier === "RUNTIME_VERIFIED" || status.tier === "PRODUCTION_VERIFIED";
}

// verifyCapabilityManifest — verifies the agent's runtime signature on
// a manifest. Uses the same one-shot Ed25519 API as heartbeat-emitter.
import type { VerificationResult } from "./types";

export function verifyCapabilityManifest(input: {
  manifest: CapabilityManifest;
  agent_runtime_public_key_hex: string;
}): VerificationResult {
  const m = input.manifest;
  if (!m.runtime_signature_hex || m.runtime_signature_hex.length === 0) {
    return { ok: false, rejection: "MISSING_SIGNATURE", reason: "capability manifest has no signature" };
  }
  const payload = manifestSignaturePayload({
    manifest_id: m.manifest_id,
    agent_id: m.agent_id,
    runtime_version: m.runtime_version,
    version: m.version,
    emitted_at: m.emitted_at,
    facets: m.facets,
    specialist_domain: m.specialist_domain,
  });
  try {
    const pub = Buffer.from(input.agent_runtime_public_key_hex, "hex");
    const ok = ed25519Verify(null, Buffer.from(payload, "utf8"), { key: pub, format: "der", type: "spki" }, Buffer.from(m.runtime_signature_hex, "hex"));
    if (!ok) return { ok: false, rejection: "WRONG_KEY", reason: "signature did not verify against agent runtime public key" };
    return { ok: true };
  } catch (e) {
    return { ok: false, rejection: "SIGNATURE_INVALID", reason: (e as Error).message };
  }
}

// Also verify the AgentIdentity's capability_manifest_hash matches this
// manifest (prevents swapping in a different manifest post-identity-signing).
export function verifyIdentityMatchesManifest(input: {
  identity: AgentIdentity;
  manifest_hash: string;
}): VerificationResult {
  if (input.identity.capability_manifest_hash !== input.manifest_hash) {
    return { ok: false, rejection: "ATTESTATION_INVALID", reason: `capability_manifest_hash on identity (${input.identity.capability_manifest_hash}) does not match provided manifest hash (${input.manifest_hash})` };
  }
  return { ok: true };
}

// WO-AGENT-RUNTIME-01 · agent identity module.
//
// Every agent has a UNIQUE runtime keypair. The public key is signed by
// the founder attestation root (Ed25519). This lets the observer
// cryptographically distinguish "this heartbeat came from this specific
// agent" from "some process injected data into GB claiming to be that
// agent".
//
// Founder-locked 2026-09-13:
//  - No central process may impersonate an agent.
//  - HQ cannot show WORKING unless the observed activity is attributable
//    to a valid AgentIdentity.

import { generateKeyPairSync, randomUUID, sign as ed25519Sign, verify as ed25519Verify } from "node:crypto";
import { canonicalJson, provenanceChainHash, sha256Hex } from "@/lib/nex-intelligence/provenance";
import type { AgentEnvironment, AgentIdentity, AuthorityManifest, CapabilityManifest, VerificationResult } from "./types";

// ── Keypair generation ─────────────────────────────────────────────────

export interface AgentKeypair {
  readonly publicKeyHex: string;   // Ed25519 SPKI · DER · hex-encoded
  readonly privateKeyHex: string;  // Ed25519 PKCS8 · DER · hex-encoded (agent keeps this)
}

export function generateAgentKeypair(): AgentKeypair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKeyHex: (publicKey.export({ type: "spki", format: "der" }) as Buffer).toString("hex"),
    privateKeyHex: (privateKey.export({ type: "pkcs8", format: "der" }) as Buffer).toString("hex"),
  };
}

// ── Founder attestation signing ────────────────────────────────────────

/**
 * Compute the canonical payload the founder signs to attest an identity.
 * Excludes the founder_attestation_signature_hex + provenance_chain_hash
 * fields (those are set after signing).
 */
function identityAttestationPayload(input: {
  identity_id: string;
  agent_id: string;
  runtime_version: string;
  runtime_key_public_hex: string;
  capability_manifest_hash: string;
  authority_manifest_hash: string;
  environment: AgentEnvironment;
  spawned_at: string;
}): string {
  return canonicalJson({
    identity_id: input.identity_id,
    agent_id: input.agent_id,
    runtime_version: input.runtime_version,
    runtime_key_public_hex: input.runtime_key_public_hex,
    capability_manifest_hash: input.capability_manifest_hash,
    authority_manifest_hash: input.authority_manifest_hash,
    environment: input.environment,
    spawned_at: input.spawned_at,
  });
}

export interface CreateIdentityInput {
  readonly agent_id: string;
  readonly runtime_version: string;
  readonly agent_public_key_hex: string;
  readonly capability_manifest_hash: string;
  readonly authority_manifest_hash: string;
  readonly environment?: AgentEnvironment;                  // defaults to DEVELOPMENT
  readonly founder_attestation_private_key_hex: string;   // founder's key, held offline in prod
  readonly spawned_at?: string;                             // defaults to now
}

/**
 * Create + founder-sign an AgentIdentity record. Only callable with the
 * founder's attestation private key. In production this is done offline
 * and the signed identity is provisioned into the runtime.
 */
export function createAgentIdentity(input: CreateIdentityInput): AgentIdentity {
  const spawned_at = input.spawned_at ?? new Date().toISOString();
  const identity_id = `agent-identity-${input.agent_id}-${randomUUID()}`;
  const environment: AgentEnvironment = input.environment ?? "DEVELOPMENT";

  const payload = identityAttestationPayload({
    identity_id,
    agent_id: input.agent_id,
    runtime_version: input.runtime_version,
    runtime_key_public_hex: input.agent_public_key_hex,
    capability_manifest_hash: input.capability_manifest_hash,
    authority_manifest_hash: input.authority_manifest_hash,
    environment,
    spawned_at,
  });

  const privateKeyBuf = Buffer.from(input.founder_attestation_private_key_hex, "hex");
  // Ed25519 uses one-shot sign · algorithm must be null · no streaming digest.
  const signature = ed25519Sign(null, Buffer.from(payload, "utf8"), { key: privateKeyBuf, format: "der", type: "pkcs8" });
  const founder_attestation_signature_hex = signature.toString("hex");

  const base = {
    record_type: "NEX_AGENT_IDENTITY" as const,
    identity_id,
    agent_id: input.agent_id,
    runtime_version: input.runtime_version,
    runtime_key_public_hex: input.agent_public_key_hex,
    capability_manifest_hash: input.capability_manifest_hash,
    authority_manifest_hash: input.authority_manifest_hash,
    environment,
    spawned_at,
    founder_attestation_signature_hex,
  };
  return { ...base, provenance_chain_hash: provenanceChainHash(base, []) };
}

// ── Verification ────────────────────────────────────────────────────────

export interface VerifyIdentityInput {
  readonly identity: AgentIdentity;
  readonly trusted_founder_public_keys_hex: readonly string[];
}

/**
 * Verify that an AgentIdentity is signed by one of the trusted founder
 * attestation public keys. Founder-locked 2026-09-13: NO EVIDENCE = NO
 * CLAIM. An identity that fails this check must NOT be trusted for any
 * downstream state derivation.
 */
export function verifyAgentIdentity(input: VerifyIdentityInput): VerificationResult {
  const { identity, trusted_founder_public_keys_hex } = input;
  if (!identity.founder_attestation_signature_hex || identity.founder_attestation_signature_hex.length === 0) {
    return { ok: false, rejection: "MISSING_SIGNATURE", reason: "founder attestation signature is empty" };
  }
  const payload = identityAttestationPayload({
    identity_id: identity.identity_id,
    agent_id: identity.agent_id,
    runtime_version: identity.runtime_version,
    runtime_key_public_hex: identity.runtime_key_public_hex,
    capability_manifest_hash: identity.capability_manifest_hash,
    authority_manifest_hash: identity.authority_manifest_hash,
    environment: identity.environment,
    spawned_at: identity.spawned_at,
  });
  const signature = Buffer.from(identity.founder_attestation_signature_hex, "hex");
  for (const pubHex of trusted_founder_public_keys_hex) {
    const pub = Buffer.from(pubHex, "hex");
    try {
      const ok = ed25519Verify(null, Buffer.from(payload, "utf8"), { key: pub, format: "der", type: "spki" }, signature);
      if (ok) return { ok: true };
    } catch { /* try next */ }
  }
  return { ok: false, rejection: "WRONG_KEY", reason: "signature did not verify against any trusted founder attestation key" };
}

// ── Capability + Authority manifest hashing helpers ─────────────────────

/**
 * Compute the canonical hash of a manifest for pinning into AgentIdentity.
 * Excludes the signature + provenance fields.
 */
export function hashCapabilityManifest(manifest: Omit<CapabilityManifest, "runtime_signature_hex" | "provenance_chain_hash">): string {
  return sha256Hex(canonicalJson(manifest));
}

export function hashAuthorityManifest(manifest: Omit<AuthorityManifest, "founder_attestation_signature_hex" | "provenance_chain_hash">): string {
  return sha256Hex(canonicalJson(manifest));
}

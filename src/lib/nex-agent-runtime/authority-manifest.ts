// WO-AGENT-RUNTIME-01 · founder-signed authority manifest builder + verifier.
//
// Founder-locked 2026-09-13: intelligence ≠ authority (P-U). Every agent
// has an AuthorityManifest that defines exactly what its runtime may do.
// The manifest is signed by the founder attestation root (Ed25519) — no
// agent can self-modify its own authority.

import { randomUUID, sign as ed25519Sign, verify as ed25519Verify } from "node:crypto";
import { canonicalJson, provenanceChainHash } from "@/lib/nex-intelligence/provenance";
import type { AuthorityManifest, VerificationResult } from "./types";

// ── Signature payload ──────────────────────────────────────────────────

function authoritySignaturePayload(input: {
  manifest_id: string;
  agent_id: string;
  runtime_version: string;
  authorised_tools: readonly string[];
  authorised_hosts: readonly string[];
  authorised_collections_read: readonly string[];
  authorised_collections_write: readonly string[];
  prohibited_actions: readonly string[];
  emitted_at: string;
}): string {
  return canonicalJson({
    manifest_id: input.manifest_id,
    agent_id: input.agent_id,
    runtime_version: input.runtime_version,
    authorised_tools: input.authorised_tools,
    authorised_hosts: input.authorised_hosts,
    authorised_collections_read: input.authorised_collections_read,
    authorised_collections_write: input.authorised_collections_write,
    prohibited_actions: input.prohibited_actions,
    emitted_at: input.emitted_at,
  });
}

// ── Build (founder side) ───────────────────────────────────────────────

export interface BuildAuthorityManifestInput {
  readonly agent_id: string;
  readonly runtime_version: string;
  readonly authorised_tools: readonly string[];
  readonly authorised_hosts: readonly string[];
  readonly authorised_collections_read: readonly string[];
  readonly authorised_collections_write: readonly string[];
  readonly prohibited_actions: readonly string[];
  readonly founder_attestation_private_key_hex: string;
  readonly emitted_at?: string;
}

export function buildAuthorityManifest(input: BuildAuthorityManifestInput): AuthorityManifest {
  const emitted_at = input.emitted_at ?? new Date().toISOString();
  const manifest_id = `agent-authman-${input.agent_id}-${randomUUID().slice(0, 8)}`;
  const payload = authoritySignaturePayload({
    manifest_id,
    agent_id: input.agent_id,
    runtime_version: input.runtime_version,
    authorised_tools: input.authorised_tools,
    authorised_hosts: input.authorised_hosts,
    authorised_collections_read: input.authorised_collections_read,
    authorised_collections_write: input.authorised_collections_write,
    prohibited_actions: input.prohibited_actions,
    emitted_at,
  });
  const signature = ed25519Sign(null, Buffer.from(payload, "utf8"), {
    key: Buffer.from(input.founder_attestation_private_key_hex, "hex"),
    format: "der", type: "pkcs8",
  });
  const base = {
    record_type: "NEX_AGENT_AUTHORITY_MANIFEST" as const,
    manifest_id,
    agent_id: input.agent_id,
    runtime_version: input.runtime_version,
    authorised_tools: Object.freeze([...input.authorised_tools]) as readonly string[],
    authorised_hosts: Object.freeze([...input.authorised_hosts]) as readonly string[],
    authorised_collections_read: Object.freeze([...input.authorised_collections_read]) as readonly string[],
    authorised_collections_write: Object.freeze([...input.authorised_collections_write]) as readonly string[],
    prohibited_actions: Object.freeze([...input.prohibited_actions]) as readonly string[],
    emitted_at,
    founder_attestation_signature_hex: signature.toString("hex"),
  };
  return { ...base, provenance_chain_hash: provenanceChainHash(base, []) };
}

// ── Verify ─────────────────────────────────────────────────────────────

export function verifyAuthorityManifest(input: {
  manifest: AuthorityManifest;
  trusted_founder_public_keys_hex: readonly string[];
}): VerificationResult {
  const m = input.manifest;
  if (!m.founder_attestation_signature_hex || m.founder_attestation_signature_hex.length === 0) {
    return { ok: false, rejection: "MISSING_SIGNATURE", reason: "authority manifest has no founder attestation signature" };
  }
  const payload = authoritySignaturePayload({
    manifest_id: m.manifest_id,
    agent_id: m.agent_id,
    runtime_version: m.runtime_version,
    authorised_tools: m.authorised_tools,
    authorised_hosts: m.authorised_hosts,
    authorised_collections_read: m.authorised_collections_read,
    authorised_collections_write: m.authorised_collections_write,
    prohibited_actions: m.prohibited_actions,
    emitted_at: m.emitted_at,
  });
  const signature = Buffer.from(m.founder_attestation_signature_hex, "hex");
  for (const pubHex of input.trusted_founder_public_keys_hex) {
    try {
      const pub = Buffer.from(pubHex, "hex");
      const ok = ed25519Verify(null, Buffer.from(payload, "utf8"), { key: pub, format: "der", type: "spki" }, signature);
      if (ok) return { ok: true };
    } catch { /* try next */ }
  }
  return { ok: false, rejection: "WRONG_KEY", reason: "authority manifest signature did not verify against any trusted founder attestation key" };
}

// ── Runtime enforcement helpers ────────────────────────────────────────

/**
 * Runtime guard: does the requested action fall within this authority
 * manifest? Founder-locked: any tool/host/collection/action NOT explicitly
 * authorised is REJECTED.
 */
export function authorityPermits(input: {
  manifest: AuthorityManifest;
  action: {
    kind: "tool" | "host" | "read_collection" | "write_collection" | "prohibited_check";
    value: string;
  };
}): { permitted: boolean; reason: string } {
  const { manifest: m, action } = input;
  // Any prohibited action is always denied — even if listed elsewhere.
  if (m.prohibited_actions.includes(action.value)) {
    return { permitted: false, reason: `action "${action.value}" is in prohibited_actions list` };
  }
  switch (action.kind) {
    case "tool":
      return { permitted: m.authorised_tools.includes(action.value), reason: `tool "${action.value}" ${m.authorised_tools.includes(action.value) ? "authorised" : "NOT authorised"}` };
    case "host":
      return { permitted: m.authorised_hosts.includes(action.value), reason: `host "${action.value}" ${m.authorised_hosts.includes(action.value) ? "authorised" : "NOT authorised"}` };
    case "read_collection":
      return { permitted: m.authorised_collections_read.includes(action.value), reason: `read collection "${action.value}" ${m.authorised_collections_read.includes(action.value) ? "authorised" : "NOT authorised"}` };
    case "write_collection":
      return { permitted: m.authorised_collections_write.includes(action.value), reason: `write collection "${action.value}" ${m.authorised_collections_write.includes(action.value) ? "authorised" : "NOT authorised"}` };
    case "prohibited_check":
      return { permitted: !m.prohibited_actions.includes(action.value), reason: `prohibited check on "${action.value}"` };
  }
}

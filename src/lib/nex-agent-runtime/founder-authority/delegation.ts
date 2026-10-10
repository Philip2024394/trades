// WO-NEX-RUNTIME-08 · founder delegation envelope signing + verification.
//
// Founder-locked 2026-09-14. Founder signs delegations OFFLINE
// (helpers here are dev/test only; production delegations arrive as
// bytes imported into NEX). NEX only READS delegations · it can never
// produce a founder-signed delegation itself.

import { randomBytes, randomUUID, sign as ed25519Sign, createPublicKey, createPrivateKey, verify as ed25519Verify } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import {
  type FounderDelegationEnvelope,
  type DelegationAllowedScope,
  type DelegationForbiddenScope,
  type FounderDelegationRevocation,
  FOUNDER_DELEGATION_COLLECTION,
  FOUNDER_REVOCATION_COLLECTION,
  REQUIRED_FORBIDDEN_CATEGORIES,
  REQUIRED_FORBIDDEN_PATH_PREFIXES,
} from "./types";

// ── Canonical serialisation ────────────────────────────────────────────

export function canonicaliseDelegation(env: Omit<FounderDelegationEnvelope, "founder_signature_hex">): Buffer {
  const ordered = {
    record_type: env.record_type,
    delegation_id: env.delegation_id,
    founder_public_key_der_hex: env.founder_public_key_der_hex,
    delegate_agent_id: env.delegate_agent_id,
    delegate_public_key_der_hex: env.delegate_public_key_der_hex,
    allowed: {
      proposal_kinds: [...env.allowed.proposal_kinds].sort(),
      file_path_prefixes: [...env.allowed.file_path_prefixes].sort(),
      stages_allowed: [...env.allowed.stages_allowed].sort(),
      max_risk_level: env.allowed.max_risk_level,
      mission_ids_allowed: [...env.allowed.mission_ids_allowed].sort(),
      cap_ids_allowed: [...env.allowed.cap_ids_allowed].sort(),
      // RUNTIME-09 · internet_scope. Absent/null = no Internet access.
      internet_scope: env.allowed.internet_scope
        ? {
            allowed_hosts: [...env.allowed.internet_scope.allowed_hosts].sort(),
            allowed_methods: [...env.allowed.internet_scope.allowed_methods].sort(),
            max_request_bytes: env.allowed.internet_scope.max_request_bytes,
            max_response_bytes: env.allowed.internet_scope.max_response_bytes,
            max_rps_per_host: env.allowed.internet_scope.max_rps_per_host,
            timeout_ms: env.allowed.internet_scope.timeout_ms,
            allow_redirects: env.allowed.internet_scope.allow_redirects,
          }
        : null,
    },
    forbidden: {
      forbidden_categories: [...env.forbidden.forbidden_categories].sort(),
      forbidden_path_prefixes: [...env.forbidden.forbidden_path_prefixes].sort(),
      forbidden_cap_kinds: [...env.forbidden.forbidden_cap_kinds].sort(),
    },
    issued_at: env.issued_at,
    expires_at: env.expires_at,
    nonce: env.nonce,
  };
  return Buffer.from(JSON.stringify(ordered), "utf8");
}

export function canonicaliseRevocation(rev: Omit<FounderDelegationRevocation, "founder_signature_hex">): Buffer {
  const ordered = {
    record_type: rev.record_type,
    revocation_id: rev.revocation_id,
    delegation_id: rev.delegation_id,
    founder_public_key_der_hex: rev.founder_public_key_der_hex,
    revoked_at: rev.revoked_at,
    reason: rev.reason,
  };
  return Buffer.from(JSON.stringify(ordered), "utf8");
}

// ── Founder-offline signing (test/dev helper) ──────────────────────────
// Production founders run this OUTSIDE NEX. Here we expose the same
// pure function so tests can exercise the end-to-end flow. Callers pass
// the founder's PKCS8 private key hex.

export interface SignDelegationInput {
  readonly delegate_agent_id: string;
  readonly delegate_public_key_der_hex: string;
  readonly allowed: DelegationAllowedScope;
  /** Custom additions to the required-forbidden set. */
  readonly forbidden_extra?: Partial<DelegationForbiddenScope>;
  readonly expires_at: string;
  readonly issued_at?: string;
  readonly nonce?: string;
  readonly founder_private_key_pkcs8_hex: string;
  readonly founder_public_key_der_hex: string;
}

export function signFounderDelegation(input: SignDelegationInput): FounderDelegationEnvelope {
  // Merge required-forbidden set with any extras
  const forbidden: DelegationForbiddenScope = {
    forbidden_categories: Object.freeze([
      ...REQUIRED_FORBIDDEN_CATEGORIES,
      ...(input.forbidden_extra?.forbidden_categories ?? []),
    ]) as readonly FounderDelegationEnvelope["forbidden"]["forbidden_categories"][number][],
    forbidden_path_prefixes: Object.freeze([
      ...REQUIRED_FORBIDDEN_PATH_PREFIXES,
      ...(input.forbidden_extra?.forbidden_path_prefixes ?? []),
    ]) as readonly string[],
    forbidden_cap_kinds: Object.freeze([
      ...(input.forbidden_extra?.forbidden_cap_kinds ?? []),
    ]) as readonly string[],
  };
  const base: Omit<FounderDelegationEnvelope, "founder_signature_hex"> = {
    record_type: "NEX_FOUNDER_DELEGATION",
    delegation_id: `DEL-${randomUUID()}`,
    founder_public_key_der_hex: input.founder_public_key_der_hex,
    delegate_agent_id: input.delegate_agent_id,
    delegate_public_key_der_hex: input.delegate_public_key_der_hex,
    allowed: input.allowed,
    forbidden,
    issued_at: input.issued_at ?? new Date().toISOString(),
    expires_at: input.expires_at,
    nonce: input.nonce ?? randomBytes(24).toString("base64"),
  };
  const privateKey = createPrivateKey({ key: Buffer.from(input.founder_private_key_pkcs8_hex, "hex"), format: "der", type: "pkcs8" });
  const sig = ed25519Sign(null, canonicaliseDelegation(base), privateKey).toString("hex");
  return { ...base, founder_signature_hex: sig };
}

export function verifyDelegationSignature(envelope: FounderDelegationEnvelope, trustedFounderKeys: readonly string[]): boolean {
  if (!trustedFounderKeys.includes(envelope.founder_public_key_der_hex)) return false;
  try {
    const pub = createPublicKey({ key: Buffer.from(envelope.founder_public_key_der_hex, "hex"), format: "der", type: "spki" });
    return ed25519Verify(null, canonicaliseDelegation(envelope), pub, Buffer.from(envelope.founder_signature_hex, "hex"));
  } catch { return false; }
}

// ── Delegation persistence ─────────────────────────────────────────────

export async function persistDelegation(envelope: FounderDelegationEnvelope): Promise<void> {
  await getStorage().save(FOUNDER_DELEGATION_COLLECTION, envelope);
}

export async function loadDelegation(delegation_id: string): Promise<FounderDelegationEnvelope | null> {
  const rows = await getStorage().query<FounderDelegationEnvelope>(FOUNDER_DELEGATION_COLLECTION, {
    where: { delegation_id }, limit: 5, order_by: "issued_at", order_dir: "desc",
  }).catch(() => [] as FounderDelegationEnvelope[]);
  return rows[0] ?? null;
}

// ── Revocation ─────────────────────────────────────────────────────────

export interface SignRevocationInput {
  readonly delegation_id: string;
  readonly reason: string;
  readonly founder_private_key_pkcs8_hex: string;
  readonly founder_public_key_der_hex: string;
}

export function signFounderRevocation(input: SignRevocationInput): FounderDelegationRevocation {
  const base: Omit<FounderDelegationRevocation, "founder_signature_hex"> = {
    record_type: "NEX_DELEGATION_REVOCATION",
    revocation_id: `REV-${randomUUID()}`,
    delegation_id: input.delegation_id,
    founder_public_key_der_hex: input.founder_public_key_der_hex,
    revoked_at: new Date().toISOString(),
    reason: input.reason,
  };
  const privateKey = createPrivateKey({ key: Buffer.from(input.founder_private_key_pkcs8_hex, "hex"), format: "der", type: "pkcs8" });
  const sig = ed25519Sign(null, canonicaliseRevocation(base), privateKey).toString("hex");
  return { ...base, founder_signature_hex: sig };
}

export function verifyRevocationSignature(rev: FounderDelegationRevocation, trustedFounderKeys: readonly string[]): boolean {
  if (!trustedFounderKeys.includes(rev.founder_public_key_der_hex)) return false;
  try {
    const pub = createPublicKey({ key: Buffer.from(rev.founder_public_key_der_hex, "hex"), format: "der", type: "spki" });
    return ed25519Verify(null, canonicaliseRevocation(rev), pub, Buffer.from(rev.founder_signature_hex, "hex"));
  } catch { return false; }
}

export async function persistRevocation(rev: FounderDelegationRevocation): Promise<void> {
  await getStorage().save(FOUNDER_REVOCATION_COLLECTION, rev);
}

export async function loadRevocationsForDelegation(delegation_id: string): Promise<FounderDelegationRevocation[]> {
  return getStorage().query<FounderDelegationRevocation>(FOUNDER_REVOCATION_COLLECTION, {
    where: { delegation_id }, limit: 20, order_by: "revoked_at", order_dir: "desc",
  }).catch(() => [] as FounderDelegationRevocation[]);
}

export async function isDelegationRevoked(delegation_id: string, trustedFounderKeys: readonly string[]): Promise<{ revoked: boolean; revocation?: FounderDelegationRevocation }> {
  const revs = await loadRevocationsForDelegation(delegation_id);
  for (const r of revs) {
    if (verifyRevocationSignature(r, trustedFounderKeys)) return { revoked: true, revocation: r };
  }
  return { revoked: false };
}

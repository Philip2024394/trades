// WO-NEX-RUNTIME-08 · NEX delegated authorization envelope.
//
// Founder-locked 2026-09-14. The NEX delegate agent signs a per-
// proposal authorization envelope with its OWN identity key. It does
// NOT produce a founder signature. It merely produces evidence that
// this NEX agent is asserting: "I am acting within the delegation the
// founder signed for me."
//
// The verifier (verifyDelegatedAuthorization) checks BOTH signatures
// plus scope match plus expiry plus revocation.

import { randomUUID, sign as ed25519Sign, createPublicKey, verify as ed25519Verify } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import type { AgentIdentity } from "@/lib/nex-agent-runtime/process/identity";
import type { CapEngineeringProposal } from "@/lib/nex-cap/nex1-engineer";
import { hashAuthorisedScope } from "@/lib/nex-cap/nex1-engineer";
import {
  type FounderDelegationEnvelope,
  type DelegatedAuthorizationEnvelope,
  type AuthorizationVerdict,
  type AuthorizationVerificationResult,
  type AuthorizationCheckDetail,
  DELEGATED_AUTHORIZATION_COLLECTION,
} from "./types";
import {
  verifyDelegationSignature,
  isDelegationRevoked,
} from "./delegation";

// ── Canonical serialisation ────────────────────────────────────────────

export function canonicaliseAuthorization(env: Omit<DelegatedAuthorizationEnvelope, "nex_signature_hex">): Buffer {
  const ordered = {
    record_type: env.record_type,
    authorization_id: env.authorization_id,
    delegation_id: env.delegation_id,
    proposal_id: env.proposal_id,
    cap_id: env.cap_id,
    mission_id: env.mission_id,
    scope_hash: env.scope_hash,
    authorized_by_agent_id: env.authorized_by_agent_id,
    authorized_by_public_key_der_hex: env.authorized_by_public_key_der_hex,
    authorized_at: env.authorized_at,
    authorization_expires_at: env.authorization_expires_at,
  };
  return Buffer.from(JSON.stringify(ordered), "utf8");
}

// ── NEX signs a per-authorization envelope ─────────────────────────────

export interface SignAuthorizationInput {
  readonly delegate_identity: AgentIdentity;
  readonly delegation: FounderDelegationEnvelope;
  readonly proposal: CapEngineeringProposal;
  readonly mission_id: string | null;
  /** Authorization-level expiry. Must be ≤ delegation.expires_at.
   *  Default: min(now + 1h, delegation.expires_at). */
  readonly authorization_expires_at?: string;
}

export function signDelegatedAuthorization(input: SignAuthorizationInput): DelegatedAuthorizationEnvelope {
  const now = Date.now();
  const oneHour = now + 60 * 60_000;
  const delegationExpiresMs = Date.parse(input.delegation.expires_at);
  const requestedExpires = input.authorization_expires_at ? Date.parse(input.authorization_expires_at) : oneHour;
  const boundedExpires = Math.min(requestedExpires, delegationExpiresMs);
  const scope = input.proposal.authorised_workstation_scope;
  const scope_hash = scope ? hashAuthorisedScope(scope) : "";

  const base: Omit<DelegatedAuthorizationEnvelope, "nex_signature_hex"> = {
    record_type: "NEX_DELEGATED_AUTHORIZATION",
    authorization_id: `AUTH-${randomUUID()}`,
    delegation_id: input.delegation.delegation_id,
    proposal_id: input.proposal.proposal_id,
    cap_id: input.proposal.cap_id,
    mission_id: input.mission_id,
    scope_hash,
    authorized_by_agent_id: input.delegate_identity.agent_id,
    authorized_by_public_key_der_hex: input.delegate_identity.public_key_der_hex,
    authorized_at: new Date(now).toISOString(),
    authorization_expires_at: new Date(boundedExpires).toISOString(),
  };
  const sig = ed25519Sign(null, canonicaliseAuthorization(base), input.delegate_identity.private).toString("hex");
  return { ...base, nex_signature_hex: sig };
}

export function verifyAuthorizationSignature(auth: DelegatedAuthorizationEnvelope): boolean {
  try {
    const pub = createPublicKey({ key: Buffer.from(auth.authorized_by_public_key_der_hex, "hex"), format: "der", type: "spki" });
    return ed25519Verify(null, canonicaliseAuthorization(auth), pub, Buffer.from(auth.nex_signature_hex, "hex"));
  } catch { return false; }
}

// ── Persistence ────────────────────────────────────────────────────────

export async function persistDelegatedAuthorization(auth: DelegatedAuthorizationEnvelope): Promise<void> {
  await getStorage().save(DELEGATED_AUTHORIZATION_COLLECTION, auth);
}

export async function loadAuthorizationsForProposal(proposal_id: string): Promise<DelegatedAuthorizationEnvelope[]> {
  return getStorage().query<DelegatedAuthorizationEnvelope>(DELEGATED_AUTHORIZATION_COLLECTION, {
    where: { proposal_id }, limit: 20, order_by: "authorized_at", order_dir: "desc",
  }).catch(() => [] as DelegatedAuthorizationEnvelope[]);
}

// ── Combined verifier · founder-locked doctrine implementation ─────────

export interface VerifyDelegatedAuthorizationInput {
  readonly delegation: FounderDelegationEnvelope;
  readonly authorization: DelegatedAuthorizationEnvelope;
  readonly proposal: CapEngineeringProposal;
  readonly trusted_founder_public_keys_hex: readonly string[];
  readonly now_ms?: number;
}

export async function verifyDelegatedAuthorization(input: VerifyDelegatedAuthorizationInput): Promise<AuthorizationVerificationResult> {
  const now_ms = input.now_ms ?? Date.now();
  const checks: AuthorizationCheckDetail[] = [];
  const push = (check: string, ok: boolean, detail: string) => { checks.push({ check, ok, detail }); };

  // 1 · Delegation signature
  const delSigOk = verifyDelegationSignature(input.delegation, input.trusted_founder_public_keys_hex);
  push("delegation_signature_valid", delSigOk, delSigOk ? "founder signature on delegation verifies against a trusted key" : "delegation signature did not verify against any trusted founder key");
  if (!delSigOk) return { verdict: "NOT_AUTHORIZED_DELEGATION_INVALID", checks: Object.freeze([...checks]), reason_summary: "delegation signature invalid" };

  // 2 · Delegation expiry
  const delExpMs = Date.parse(input.delegation.expires_at);
  const delFresh = now_ms < delExpMs;
  push("delegation_not_expired", delFresh, delFresh ? `delegation expires ${input.delegation.expires_at}` : `delegation expired at ${input.delegation.expires_at}`);
  if (!delFresh) return { verdict: "NOT_AUTHORIZED_DELEGATION_EXPIRED", checks: Object.freeze([...checks]), reason_summary: "delegation expired · STOP" };

  // 3 · Delegation not revoked
  const revStatus = await isDelegationRevoked(input.delegation.delegation_id, input.trusted_founder_public_keys_hex);
  push("delegation_not_revoked", !revStatus.revoked, revStatus.revoked ? `revoked by founder at ${revStatus.revocation?.revoked_at}` : "no revocation record");
  if (revStatus.revoked) return { verdict: "NOT_AUTHORIZED_DELEGATION_REVOKED", checks: Object.freeze([...checks]), reason_summary: "delegation revoked" };

  // 4 · Authorization signature
  const authSigOk = verifyAuthorizationSignature(input.authorization);
  push("authorization_signature_valid", authSigOk, authSigOk ? "NEX signature verifies against delegate public key" : "NEX authorization signature invalid");
  if (!authSigOk) return { verdict: "NOT_AUTHORIZED_AUTHORIZATION_INVALID", checks: Object.freeze([...checks]), reason_summary: "authorization signature invalid" };

  // 5 · Delegate binding (the NEX authorization must be signed by the SAME agent the delegation empowered)
  const delegateOk =
    input.authorization.authorized_by_agent_id === input.delegation.delegate_agent_id &&
    input.authorization.authorized_by_public_key_der_hex === input.delegation.delegate_public_key_der_hex;
  push("authorization_delegate_matches_delegation", delegateOk, delegateOk ? "delegate agent + key match delegation" : "authorization was signed by a different agent/key than the delegation empowered");
  if (!delegateOk) return { verdict: "NOT_AUTHORIZED_DELEGATE_MISMATCH", checks: Object.freeze([...checks]), reason_summary: "delegate mismatch" };

  // 6 · Authorization expiry
  const authExpMs = Date.parse(input.authorization.authorization_expires_at);
  const authFresh = now_ms < authExpMs;
  push("authorization_not_expired", authFresh, authFresh ? `authorization expires ${input.authorization.authorization_expires_at}` : "authorization expired");
  if (!authFresh) return { verdict: "NOT_AUTHORIZED_AUTHORIZATION_EXPIRED", checks: Object.freeze([...checks]), reason_summary: "authorization expired · STOP" };

  // 7 · Authorization expiry ≤ delegation expiry (delegate cannot extend)
  const noExtension = authExpMs <= delExpMs;
  push("authorization_expiry_within_delegation", noExtension, noExtension ? "authorization expiry ≤ delegation expiry" : "delegate attempted to extend beyond delegation expiry");
  if (!noExtension) return { verdict: "NOT_AUTHORIZED_AUTHORIZATION_EXPIRED", checks: Object.freeze([...checks]), reason_summary: "delegate cannot extend beyond delegation window" };

  // 8 · Proposal binding (authorization must reference the same proposal)
  const propOk = input.authorization.proposal_id === input.proposal.proposal_id;
  push("proposal_binding_matches", propOk, propOk ? "authorization references the correct proposal" : "authorization proposal_id mismatch");
  if (!propOk) return { verdict: "NOT_AUTHORIZED_AUTHORIZATION_INVALID", checks: Object.freeze([...checks]), reason_summary: "proposal binding mismatch" };

  // 9 · Scope hash match
  const scope = input.proposal.authorised_workstation_scope;
  const expectedScopeHash = scope ? hashAuthorisedScope(scope) : "";
  const scopeHashOk = input.authorization.scope_hash === expectedScopeHash;
  push("scope_hash_binding", scopeHashOk, scopeHashOk ? "authorization scope_hash matches proposal scope_hash" : "authorization scope_hash disagrees with proposal");
  if (!scopeHashOk) return { verdict: "NOT_AUTHORIZED_SCOPE_VIOLATION", checks: Object.freeze([...checks]), reason_summary: "scope tamper detected" };

  // 10 · Proposal cap_kind ∈ allowed_cap_kinds (or empty allowed = any)
  const capKind = await capKindForProposal(input.proposal);
  const capOk = input.delegation.allowed.proposal_kinds.length === 0 || (capKind !== null && input.delegation.allowed.proposal_kinds.includes(capKind));
  push("cap_kind_allowed", capOk, capOk ? `cap_kind=${capKind ?? "(none)"} within allowed set` : `cap_kind=${capKind ?? "(none)"} NOT in delegation.allowed.proposal_kinds`);
  if (!capOk) return { verdict: "NOT_AUTHORIZED_CAP_KIND_NOT_ALLOWED", checks: Object.freeze([...checks]), reason_summary: "cap_kind not permitted by delegation" };

  // 11 · cap_kind ∉ forbidden_cap_kinds
  const capForbidden = capKind !== null && input.delegation.forbidden.forbidden_cap_kinds.includes(capKind);
  push("cap_kind_not_forbidden", !capForbidden, capForbidden ? `cap_kind=${capKind} explicitly forbidden` : "cap_kind not in forbidden list");
  if (capForbidden) return { verdict: "NOT_AUTHORIZED_FORBIDDEN_CATEGORY", checks: Object.freeze([...checks]), reason_summary: "cap_kind forbidden" };

  // 12 · Every file path prefix is ⊆ allowed_file_path_prefixes AND ∉ forbidden_path_prefixes
  if (scope) {
    for (const p of scope.files_may_touch) {
      const norm = p.replace(/\\/g, "/");
      const insideAllowed = input.delegation.allowed.file_path_prefixes.length === 0
        ? false
        : input.delegation.allowed.file_path_prefixes.some((a) => norm.startsWith(a.replace(/\\/g, "/")));
      if (!insideAllowed) {
        push("file_path_within_allowed", false, `path ${p} not covered by allowed prefixes`);
        return { verdict: "NOT_AUTHORIZED_SCOPE_VIOLATION", checks: Object.freeze([...checks]), reason_summary: `path ${p} outside delegation` };
      }
      const forbidden = input.delegation.forbidden.forbidden_path_prefixes.some((f) => norm.startsWith(f.replace(/\\/g, "/")) || norm === f.replace(/\\/g, "/"));
      if (forbidden) {
        push("file_path_not_forbidden", false, `path ${p} matches a forbidden prefix`);
        return { verdict: "NOT_AUTHORIZED_FORBIDDEN_CATEGORY", checks: Object.freeze([...checks]), reason_summary: `path ${p} forbidden` };
      }
    }
    push("file_paths_within_scope", true, `all ${scope.files_may_touch.length} path(s) within delegation`);
  } else {
    push("file_paths_within_scope", true, "proposal has no scope · nothing to enforce");
  }

  // 13 · Every stage is in allowed_stages
  if (scope) {
    const stageMissing = scope.stages_required.filter((s) => !input.delegation.allowed.stages_allowed.includes(s as never));
    if (stageMissing.length > 0) {
      push("stages_allowed", false, `stages ${stageMissing.join(",")} not in delegation.allowed.stages_allowed`);
      return { verdict: "NOT_AUTHORIZED_STAGE_NOT_ALLOWED", checks: Object.freeze([...checks]), reason_summary: `stages ${stageMissing.join(",")} not permitted` };
    }
    push("stages_allowed", true, `all stages within delegation`);
  }

  // 14 · Mission ID in allowed set (if delegation restricts)
  if (input.delegation.allowed.mission_ids_allowed.length > 0 && input.authorization.mission_id !== null) {
    if (!input.delegation.allowed.mission_ids_allowed.includes(input.authorization.mission_id)) {
      push("mission_allowed", false, `mission_id=${input.authorization.mission_id} not in delegation.allowed.mission_ids_allowed`);
      return { verdict: "NOT_AUTHORIZED_MISSION_NOT_ALLOWED", checks: Object.freeze([...checks]), reason_summary: "mission_id not permitted" };
    }
  }
  push("mission_allowed", true, "mission binding within delegation");

  // 15 · CAP ID in allowed set (if delegation restricts)
  if (input.delegation.allowed.cap_ids_allowed.length > 0 && input.proposal.cap_id !== null) {
    if (!input.delegation.allowed.cap_ids_allowed.includes(input.proposal.cap_id)) {
      push("cap_id_allowed", false, `cap_id=${input.proposal.cap_id} not in delegation.allowed.cap_ids_allowed`);
      return { verdict: "NOT_AUTHORIZED_SCOPE_VIOLATION", checks: Object.freeze([...checks]), reason_summary: "cap_id not permitted" };
    }
  }
  push("cap_id_allowed", true, "cap_id binding within delegation");

  return {
    verdict: "AUTHORISED",
    checks: Object.freeze([...checks]),
    reason_summary: `all ${checks.length} checks passed · delegation valid + authorization signed + within-scope + not expired + not revoked`,
  };
}

/** Fetch the underlying CAP kind for a proposal · used by scope checks. */
async function capKindForProposal(proposal: CapEngineeringProposal): Promise<string | null> {
  if (!proposal.cap_id) return null;
  const { loadCap } = await import("@/lib/nex-cap/registry");
  const cap = await loadCap(proposal.cap_id);
  return cap?.kind ?? null;
}

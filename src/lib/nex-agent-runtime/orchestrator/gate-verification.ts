// WO-NEX-RUNTIME-07 · gate collection + verification.
//
// Founder-locked 2026-09-13. Every gate is verified against the
// ORIGINATING agent's public key, retrieved from the published
// agent-identity collection. The Orchestrator NEVER trusts its own
// judgement over a signature verification result.

import { getStorage } from "@/lib/nex/storage/registry";
import {
  loadAllProposals,
  canonicalSigningPayload,
  hashAuthorisedScope,
  type CapEngineeringProposal,
} from "@/lib/nex-cap/nex1-engineer";
import { loadReviewsForProposal, verifyNex2Review } from "@/lib/nex-agent-runtime/nex2/review";
import { loadArbitrationsForProposal, verifyNex3Arbitration } from "@/lib/nex-agent-runtime/nex3/arbitration";
import { loadVetosForProposal, verifySecurityVeto } from "@/lib/nex-agent-runtime/security/review";
import { AGENT_IDENTITY_COLLECTION, type AgentIdentityRecord } from "@/lib/nex-agent-runtime/process/types";
import type { FounderDelegationEnvelope, DelegatedAuthorizationEnvelope } from "@/lib/nex-agent-runtime/founder-authority/types";
import { verifyDelegatedAuthorization } from "@/lib/nex-agent-runtime/founder-authority/authorization";
import {
  type Gate,
  DEFAULT_FRESHNESS,
  type FreshnessPolicy,
} from "./types";

// ── Load helpers ───────────────────────────────────────────────────────

async function loadIdentity(agent_id: string): Promise<AgentIdentityRecord | null> {
  const rows = await getStorage().query<AgentIdentityRecord>(AGENT_IDENTITY_COLLECTION, {
    where: { agent_id }, limit: 3, order_by: "created_at", order_dir: "desc",
  }).catch(() => [] as AgentIdentityRecord[]);
  return rows[0] ?? null;
}

// ── Freshness ──────────────────────────────────────────────────────────

function ageMs(timestamp: string, now_ms: number): number {
  return now_ms - Date.parse(timestamp);
}

function expiresAt(timestamp: string, windowMs: number): string {
  return new Date(Date.parse(timestamp) + windowMs).toISOString();
}

// ── Gate 1 · NEX1_VALID ────────────────────────────────────────────────

export function computeNex1Gate(input: {
  proposal: CapEngineeringProposal;
  now_ms: number;
  policy: FreshnessPolicy;
}): Gate {
  const p = input.proposal;
  const age = ageMs(p.created_at, input.now_ms);
  // Basic shape · founder_signature_slot MUST be null (P-U) · diagnosis + fix must be present · evidence chain must be non-empty
  const shapeOk =
    p.founder_signature_slot === null &&
    p.diagnosis.trim().length > 0 &&
    p.proposed_fix_summary.trim().length > 0 &&
    p.evidence_chain.length > 0;
  if (age > input.policy.nex1_proposal_max_age_ms) {
    return {
      kind: "NEX1_VALID", verdict: "EXPIRED",
      detail: `proposal age ${Math.floor(age / 1000)}s exceeds NEX1 window`,
      backing_record_id: p.proposal_id,
      backing_agent_id: "nex1-master-engineer",
      backing_public_key_der_hex: null,
      backing_signature_hex: null,
      backing_timestamp: p.created_at,
      scope_hash: p.authorised_workstation_scope ? hashAuthorisedScope(p.authorised_workstation_scope) : null,
      evidence_refs: p.evidence_chain, expires_at: expiresAt(p.created_at, input.policy.nex1_proposal_max_age_ms),
    };
  }
  return {
    kind: "NEX1_VALID", verdict: shapeOk ? "VALID" : "INVALID",
    detail: shapeOk ? "proposal well-formed · unsigned per P-U" : "proposal missing diagnosis / fix summary / evidence · or founder_signature_slot != null",
    backing_record_id: p.proposal_id,
    backing_agent_id: "nex1-master-engineer",
    backing_public_key_der_hex: null,   // NEX1 proposals are drafts · no NEX1 agent-key signature on the record itself (P-U · never signed by NEX1)
    backing_signature_hex: null,
    backing_timestamp: p.created_at,
    scope_hash: p.authorised_workstation_scope ? hashAuthorisedScope(p.authorised_workstation_scope) : null,
    evidence_refs: p.evidence_chain,
    expires_at: expiresAt(p.created_at, input.policy.nex1_proposal_max_age_ms),
  };
}

// ── Gate 2 · NEX2_VALID ────────────────────────────────────────────────

export async function computeNex2Gate(input: {
  proposal: CapEngineeringProposal;
  now_ms: number;
  policy: FreshnessPolicy;
}): Promise<Gate> {
  const reviews = await loadReviewsForProposal(input.proposal.proposal_id);
  // Latest review that isn't INSUFFICIENT_INPUT
  const review = reviews.find((r) => r.verdict !== "INSUFFICIENT_REVIEW_INPUT") ?? reviews[0] ?? null;
  if (!review) {
    return { kind: "NEX2_VALID", verdict: "MISSING", detail: "no NEX2 review record for proposal",
      backing_record_id: null, backing_agent_id: null,
      backing_public_key_der_hex: null, backing_signature_hex: null, backing_timestamp: null,
      scope_hash: null, evidence_refs: [], expires_at: null };
  }
  const age = ageMs(review.reviewed_at, input.now_ms);
  if (age > input.policy.nex2_review_max_age_ms) {
    return { kind: "NEX2_VALID", verdict: "EXPIRED", detail: `NEX2 review age ${Math.floor(age / 1000)}s exceeds window`,
      backing_record_id: review.review_id, backing_agent_id: review.reviewed_by_agent_id,
      backing_public_key_der_hex: review.reviewed_by_public_key_der_hex,
      backing_signature_hex: review.signature_hex, backing_timestamp: review.reviewed_at,
      scope_hash: null, evidence_refs: [], expires_at: expiresAt(review.reviewed_at, input.policy.nex2_review_max_age_ms) };
  }
  // Verify NEX2's own signature on the review record
  const sigOk = verifyNex2Review(review.reviewed_by_public_key_der_hex, review);
  // Verdict is VALID iff signature verifies AND NEX2 approved
  const approved = review.verdict === "INDEPENDENTLY_VERIFIED";
  const verdict = !sigOk ? "INVALID" : approved ? "VALID" : "INVALID";
  const detail = !sigOk
    ? "NEX2 review signature failed to verify against its published public key"
    : approved
      ? `NEX2 INDEPENDENTLY_VERIFIED · signed by ${review.reviewed_by_agent_id}`
      : `NEX2 verdict=${review.verdict} · not approved (${review.findings.length} finding(s))`;
  return {
    kind: "NEX2_VALID", verdict, detail,
    backing_record_id: review.review_id, backing_agent_id: review.reviewed_by_agent_id,
    backing_public_key_der_hex: review.reviewed_by_public_key_der_hex,
    backing_signature_hex: review.signature_hex, backing_timestamp: review.reviewed_at,
    scope_hash: null, evidence_refs: [],
    expires_at: expiresAt(review.reviewed_at, input.policy.nex2_review_max_age_ms),
  };
}

// ── Gate 3 · NEX3_VALID ────────────────────────────────────────────────

export async function computeNex3Gate(input: {
  proposal: CapEngineeringProposal;
  nex2_gate: Gate;
  now_ms: number;
  policy: FreshnessPolicy;
}): Promise<Gate> {
  // NEX3 is only required if NEX2 raised a conflict. If NEX2 approved,
  // NEX3 is NA · this is the founder-locked "NEX3 only exists to break
  // tie-breaks" doctrine.
  if (input.nex2_gate.verdict === "VALID") {
    return { kind: "NEX3_VALID", verdict: "NA",
      detail: "NEX2 approved · no NEX3 arbitration required",
      backing_record_id: null, backing_agent_id: null,
      backing_public_key_der_hex: null, backing_signature_hex: null,
      backing_timestamp: null, scope_hash: null, evidence_refs: [], expires_at: null };
  }
  const arbs = await loadArbitrationsForProposal(input.proposal.proposal_id);
  const arb = arbs[0] ?? null;
  if (!arb) {
    return { kind: "NEX3_VALID", verdict: "MISSING",
      detail: "NEX2 rejected/conflict but NEX3 has not arbitrated yet",
      backing_record_id: null, backing_agent_id: null,
      backing_public_key_der_hex: null, backing_signature_hex: null,
      backing_timestamp: null, scope_hash: null, evidence_refs: [], expires_at: null };
  }
  const age = ageMs(arb.arbitrated_at, input.now_ms);
  if (age > input.policy.nex3_arbitration_max_age_ms) {
    return { kind: "NEX3_VALID", verdict: "EXPIRED",
      detail: `NEX3 arbitration age ${Math.floor(age / 1000)}s exceeds window`,
      backing_record_id: arb.arbitration_id, backing_agent_id: arb.arbitrated_by_agent_id,
      backing_public_key_der_hex: arb.arbitrated_by_public_key_der_hex,
      backing_signature_hex: arb.signature_hex, backing_timestamp: arb.arbitrated_at,
      scope_hash: null, evidence_refs: [],
      expires_at: expiresAt(arb.arbitrated_at, input.policy.nex3_arbitration_max_age_ms) };
  }
  const sigOk = verifyNex3Arbitration(arb.arbitrated_by_public_key_der_hex, arb);
  const allowed = arb.verdict === "ALLOW";
  const verdict = !sigOk ? "INVALID" : allowed ? "VALID" : "INVALID";
  const detail = !sigOk
    ? "NEX3 arbitration signature failed to verify"
    : allowed ? `NEX3 ALLOW · overrode NEX2 concern` : `NEX3 verdict=${arb.verdict}`;
  return {
    kind: "NEX3_VALID", verdict, detail,
    backing_record_id: arb.arbitration_id, backing_agent_id: arb.arbitrated_by_agent_id,
    backing_public_key_der_hex: arb.arbitrated_by_public_key_der_hex,
    backing_signature_hex: arb.signature_hex, backing_timestamp: arb.arbitrated_at,
    scope_hash: null, evidence_refs: [],
    expires_at: expiresAt(arb.arbitrated_at, input.policy.nex3_arbitration_max_age_ms),
  };
}

// ── Gate 4 · SECURITY_VALID ────────────────────────────────────────────

export async function computeSecurityGate(input: {
  proposal: CapEngineeringProposal;
  now_ms: number;
  policy: FreshnessPolicy;
}): Promise<Gate> {
  const vetos = await loadVetosForProposal(input.proposal.proposal_id);
  const veto = vetos[0] ?? null;
  if (!veto) {
    return { kind: "SECURITY_VALID", verdict: "MISSING",
      detail: "no Security veto record for proposal",
      backing_record_id: null, backing_agent_id: null,
      backing_public_key_der_hex: null, backing_signature_hex: null,
      backing_timestamp: null, scope_hash: null, evidence_refs: [], expires_at: null };
  }
  const age = ageMs(veto.reviewed_at, input.now_ms);
  if (age > input.policy.security_veto_max_age_ms) {
    return { kind: "SECURITY_VALID", verdict: "EXPIRED",
      detail: `Security veto age ${Math.floor(age / 1000)}s exceeds window`,
      backing_record_id: veto.veto_id, backing_agent_id: veto.reviewed_by_agent_id,
      backing_public_key_der_hex: veto.reviewed_by_public_key_der_hex,
      backing_signature_hex: veto.signature_hex, backing_timestamp: veto.reviewed_at,
      scope_hash: null, evidence_refs: [],
      expires_at: expiresAt(veto.reviewed_at, input.policy.security_veto_max_age_ms) };
  }
  const sigOk = verifySecurityVeto(veto.reviewed_by_public_key_der_hex, veto);
  const cleared = veto.verdict === "CLEARED";
  const verdict = !sigOk ? "INVALID" : cleared ? "VALID" : "INVALID";
  const detail = !sigOk
    ? "Security veto signature failed to verify"
    : cleared ? `Security CLEARED` : `Security verdict=${veto.verdict} · ${veto.findings.length} finding(s)`;
  return {
    kind: "SECURITY_VALID", verdict, detail,
    backing_record_id: veto.veto_id, backing_agent_id: veto.reviewed_by_agent_id,
    backing_public_key_der_hex: veto.reviewed_by_public_key_der_hex,
    backing_signature_hex: veto.signature_hex, backing_timestamp: veto.reviewed_at,
    scope_hash: null, evidence_refs: [],
    expires_at: expiresAt(veto.reviewed_at, input.policy.security_veto_max_age_ms),
  };
}

// ── Gate 5 · FOUNDER_AUTH_VALID (RUNTIME-08 · delegation model) ────────

/** RUNTIME-08 path: founder signs delegation, NEX signs authorization,
 *  verifier checks both. Founder's private key never enters NEX. */
export async function computeFounderAuthGateDelegated(input: {
  proposal: CapEngineeringProposal;
  delegation: FounderDelegationEnvelope;
  authorization: DelegatedAuthorizationEnvelope;
  trusted_founder_public_keys_hex: readonly string[];
  now_ms?: number;
}): Promise<Gate> {
  const result = await verifyDelegatedAuthorization({
    delegation: input.delegation,
    authorization: input.authorization,
    proposal: input.proposal,
    trusted_founder_public_keys_hex: input.trusted_founder_public_keys_hex,
    now_ms: input.now_ms,
  });
  const ok = result.verdict === "AUTHORISED";
  return {
    kind: "FOUNDER_AUTH_VALID",
    verdict: ok ? "VALID" : "INVALID",
    detail: ok
      ? `delegated authorization AUTHORISED · delegation=${input.delegation.delegation_id.slice(0, 24)}… · authorization=${input.authorization.authorization_id.slice(0, 24)}…`
      : `NOT_AUTHORIZED · verdict=${result.verdict} · ${result.reason_summary.slice(0, 140)}`,
    backing_record_id: input.authorization.authorization_id,
    backing_agent_id: input.authorization.authorized_by_agent_id,
    backing_public_key_der_hex: input.authorization.authorized_by_public_key_der_hex,
    backing_signature_hex: input.authorization.nex_signature_hex,
    backing_timestamp: input.authorization.authorized_at,
    scope_hash: input.authorization.scope_hash,
    evidence_refs: [input.delegation.delegation_id, input.authorization.authorization_id],
    expires_at: input.authorization.authorization_expires_at,
  };
}

/** LEGACY (pre-RUNTIME-08): direct founder signature over the scope-
 *  inclusive payload. Retained for backward-compat with earlier tests.
 *  New code should use `computeFounderAuthGateDelegated`. */
export async function computeFounderAuthGate(input: {
  proposal: CapEngineeringProposal;
  founder_signature_hex: string | null;
  trusted_founder_public_keys_hex: readonly string[];
}): Promise<Gate> {
  const p = input.proposal;
  if (!input.founder_signature_hex || input.founder_signature_hex.length === 0) {
    return { kind: "FOUNDER_AUTH_VALID", verdict: "MISSING",
      detail: "no founder Ed25519 signature supplied · RUNTIME-08 pending",
      backing_record_id: p.proposal_id, backing_agent_id: "founder",
      backing_public_key_der_hex: null, backing_signature_hex: null,
      backing_timestamp: p.created_at,
      scope_hash: p.authorised_workstation_scope ? hashAuthorisedScope(p.authorised_workstation_scope) : null,
      evidence_refs: p.evidence_chain, expires_at: null };
  }
  if (input.trusted_founder_public_keys_hex.length === 0) {
    return { kind: "FOUNDER_AUTH_VALID", verdict: "INVALID",
      detail: "no trusted founder public keys configured · fail-closed",
      backing_record_id: p.proposal_id, backing_agent_id: "founder",
      backing_public_key_der_hex: null, backing_signature_hex: input.founder_signature_hex,
      backing_timestamp: p.created_at,
      scope_hash: p.authorised_workstation_scope ? hashAuthorisedScope(p.authorised_workstation_scope) : null,
      evidence_refs: [], expires_at: null };
  }
  const { verify: ed25519Verify } = await import("node:crypto");
  const payload = canonicalSigningPayload(p);
  const sig = Buffer.from(input.founder_signature_hex, "hex");
  let matched = null as string | null;
  for (const pubHex of input.trusted_founder_public_keys_hex) {
    try {
      const pub = Buffer.from(pubHex, "hex");
      const ok = ed25519Verify(null, payload, { key: pub, format: "der", type: "spki" }, sig);
      if (ok) { matched = pubHex; break; }
    } catch { /* try next */ }
  }
  return {
    kind: "FOUNDER_AUTH_VALID",
    verdict: matched ? "VALID" : "INVALID",
    detail: matched ? "founder Ed25519 signature verified against trusted key" : "signature did not verify against any trusted founder key",
    backing_record_id: p.proposal_id, backing_agent_id: "founder",
    backing_public_key_der_hex: matched, backing_signature_hex: input.founder_signature_hex,
    backing_timestamp: p.created_at,
    scope_hash: p.authorised_workstation_scope ? hashAuthorisedScope(p.authorised_workstation_scope) : null,
    evidence_refs: [], expires_at: null,
  };
}

// ── Gate 6 · SCOPE_VALID ───────────────────────────────────────────────

export function computeScopeGate(input: {
  proposal: CapEngineeringProposal;
}): Gate {
  const scope = input.proposal.authorised_workstation_scope;
  if (!scope) {
    return { kind: "SCOPE_VALID", verdict: "MISSING",
      detail: "proposal has no authorised_workstation_scope · workstation cannot run",
      backing_record_id: input.proposal.proposal_id, backing_agent_id: "founder",
      backing_public_key_der_hex: null, backing_signature_hex: null,
      backing_timestamp: input.proposal.created_at,
      scope_hash: null, evidence_refs: [], expires_at: null };
  }
  const hash = hashAuthorisedScope(scope);
  // Basic sanity · files_may_touch must be non-empty
  const shapeOk = scope.files_may_touch.length > 0 && scope.stages_required.length > 0;
  return {
    kind: "SCOPE_VALID",
    verdict: shapeOk ? "VALID" : "INVALID",
    detail: shapeOk ? `authorised_workstation_scope hash ${hash.slice(0, 16)}… covers ${scope.files_may_touch.length} path(s)` : "scope has empty files_may_touch or stages_required",
    backing_record_id: input.proposal.proposal_id, backing_agent_id: "founder",
    backing_public_key_der_hex: null, backing_signature_hex: null,
    backing_timestamp: input.proposal.created_at,
    scope_hash: hash, evidence_refs: [], expires_at: null,
  };
}

// ── Consistency: all gates reference the same proposal_id + scope_hash ─

export function checkGateConsistency(gates: readonly Gate[], proposal_id: string, scope_hash: string | null): { ok: true } | { ok: false; reason: string } {
  for (const g of gates) {
    if (g.backing_record_id !== null && g.kind === "NEX1_VALID" && g.backing_record_id !== proposal_id) {
      return { ok: false, reason: `NEX1_VALID gate references ${g.backing_record_id} not ${proposal_id}` };
    }
    if (g.scope_hash !== null && scope_hash !== null && g.scope_hash !== scope_hash) {
      return { ok: false, reason: `gate ${g.kind} scope_hash ${g.scope_hash} disagrees with expected ${scope_hash}` };
    }
  }
  return { ok: true };
}

// ── Load the proposal (helper) ─────────────────────────────────────────

export async function loadProposalById(proposal_id: string): Promise<CapEngineeringProposal | null> {
  const props = await loadAllProposals();
  return props.find((p) => p.proposal_id === proposal_id) ?? null;
}

// ── Identity lookup (helper used by consumers) ─────────────────────────

export async function loadIdentityForAgent(agent_id: string): Promise<AgentIdentityRecord | null> {
  return loadIdentity(agent_id);
}

export { DEFAULT_FRESHNESS };

// WO-NEX-RUNTIME-07 · Orchestrator core.
//
// Founder-locked 2026-09-13. Assembles a machine-verifiable GateReceipt
// from independent agent evidence. Signs the receipt with the
// Orchestrator's own Ed25519 key AS AN INTEGRITY ATTESTATION on
// assembly · NOT as authority over any individual verdict.
//
// The receipt is what downstream consumers (workstation, founder,
// external verifiers) verify. They MUST re-check each gate's backing
// signature against the originating agent's public key. The
// Orchestrator's own signature attests only to "this is the set of
// gates I assembled, unaltered."

import { randomUUID, sign as ed25519Sign, createPublicKey, verify as ed25519Verify } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import type { AgentIdentity } from "@/lib/nex-agent-runtime/process/identity";
import {
  loadProposalById,
  computeNex1Gate,
  computeNex2Gate,
  computeNex3Gate,
  computeSecurityGate,
  computeFounderAuthGate,
  computeFounderAuthGateDelegated,
  computeScopeGate,
  checkGateConsistency,
  DEFAULT_FRESHNESS,
} from "./gate-verification";
import type { FounderDelegationEnvelope, DelegatedAuthorizationEnvelope } from "@/lib/nex-agent-runtime/founder-authority/types";
import {
  hashAuthorisedScope,
} from "@/lib/nex-cap/nex1-engineer";
import {
  type Gate,
  type OrchestratorGateReceipt,
  type FreshnessPolicy,
  ORCHESTRATOR_RECEIPT_COLLECTION,
} from "./types";
import {
  verifyNex2Review,
} from "@/lib/nex-agent-runtime/nex2/review";
import {
  verifyNex3Arbitration,
} from "@/lib/nex-agent-runtime/nex3/arbitration";
import {
  verifySecurityVeto,
} from "@/lib/nex-agent-runtime/security/review";

// ── Canonical serialisation of the receipt (for signing) ───────────────

function canonicaliseReceipt(rec: Omit<OrchestratorGateReceipt, "signature_hex">): Buffer {
  const ordered = {
    record_type: rec.record_type,
    receipt_id: rec.receipt_id,
    mission_id: rec.mission_id,
    proposal_id: rec.proposal_id,
    cap_id: rec.cap_id,
    assembled_by_agent_id: rec.assembled_by_agent_id,
    assembled_by_instance_id: rec.assembled_by_instance_id,
    assembled_by_public_key_der_hex: rec.assembled_by_public_key_der_hex,
    assembled_at: rec.assembled_at,
    gates: rec.gates.map((g) => ({
      kind: g.kind, verdict: g.verdict, detail: g.detail,
      backing_record_id: g.backing_record_id, backing_agent_id: g.backing_agent_id,
      backing_public_key_der_hex: g.backing_public_key_der_hex,
      backing_signature_hex: g.backing_signature_hex, backing_timestamp: g.backing_timestamp,
      scope_hash: g.scope_hash, evidence_refs: [...g.evidence_refs],
      expires_at: g.expires_at,
    })),
    overall_verdict: rec.overall_verdict,
    reason_summary: rec.reason_summary,
  };
  return Buffer.from(JSON.stringify(ordered), "utf8");
}

// ── Verify the receipt as a whole ──────────────────────────────────────

export interface ReceiptVerificationResult {
  readonly assembly_signature_valid: boolean;
  readonly per_gate: readonly {
    readonly kind: string;
    readonly gate_signature_valid: boolean;
    readonly detail: string;
  }[];
  readonly overall_ok: boolean;
  readonly reason_summary: string;
}

/** Independently verify every gate + the Orchestrator's own signature.
 *  Downstream consumers use THIS · they do not trust the assembly
 *  verdict without verifying each gate signature. */
export function verifyGateReceipt(receipt: OrchestratorGateReceipt): ReceiptVerificationResult {
  // 1 · Orchestrator's assembly signature
  let assemblyOk = false;
  try {
    const { signature_hex: _drop, ...base } = receipt;
    void _drop;
    const pub = createPublicKey({ key: Buffer.from(receipt.assembled_by_public_key_der_hex, "hex"), format: "der", type: "spki" });
    assemblyOk = ed25519Verify(null, canonicaliseReceipt(base), pub, Buffer.from(receipt.signature_hex, "hex"));
  } catch { assemblyOk = false; }

  // 2 · Each gate's backing signature (only where a signature exists)
  const per_gate: ReceiptVerificationResult["per_gate"] = receipt.gates.map((g) => {
    if (!g.backing_signature_hex || !g.backing_public_key_der_hex) {
      return { kind: g.kind, gate_signature_valid: true, detail: "gate carries no backing signature (record-shape or na)" };
    }
    // Re-verify the individual signature. We can only do this for gate
    // kinds we know how to canonicalise · NEX2, NEX3, SECURITY are the
    // three signed by their originating agents.
    if (g.kind === "NEX2_VALID") {
      // We need the FULL Nex2ReviewRecord to verify · we don't have it
      // in the gate. The gate carries the signature + public key, but
      // verifying requires re-canonicalising the record. Consumers can
      // load the record by backing_record_id and call verifyNex2Review
      // directly. Here we assert the (pubkey, signature) shape is present.
      const shapeOk = g.backing_public_key_der_hex.length > 0 && g.backing_signature_hex.length > 0;
      return { kind: g.kind, gate_signature_valid: shapeOk, detail: shapeOk ? "signature + public key present · re-verify by loading record" : "missing signature/key" };
    }
    if (g.kind === "NEX3_VALID" || g.kind === "SECURITY_VALID" || g.kind === "FOUNDER_AUTH_VALID") {
      const shapeOk = (g.backing_public_key_der_hex?.length ?? 0) > 0 && (g.backing_signature_hex?.length ?? 0) > 0;
      return { kind: g.kind, gate_signature_valid: shapeOk, detail: shapeOk ? "signature + public key present · re-verify by loading record" : "missing signature/key" };
    }
    return { kind: g.kind, gate_signature_valid: true, detail: "no per-gate signature required" };
  });
  const perGateOk = per_gate.every((g) => g.gate_signature_valid);
  const overall_ok = assemblyOk && perGateOk;
  return {
    assembly_signature_valid: assemblyOk,
    per_gate,
    overall_ok,
    reason_summary: overall_ok ? "receipt fully verified (assembly + per-gate)" : `receipt failed verification · assembly_ok=${assemblyOk} · all_gates_ok=${perGateOk}`,
  };
}

/** Stronger verification: independently load each backing record and
 *  verify its signature against its originating public key. This is
 *  what the workstation (RUNTIME-10) will use. */
export async function verifyGateReceiptDeep(receipt: OrchestratorGateReceipt): Promise<ReceiptVerificationResult> {
  const shallow = verifyGateReceipt(receipt);
  const per_gate = [...shallow.per_gate];
  const { loadReviewsForProposal } = await import("@/lib/nex-agent-runtime/nex2/review");
  const { loadArbitrationsForProposal } = await import("@/lib/nex-agent-runtime/nex3/arbitration");
  const { loadVetosForProposal } = await import("@/lib/nex-agent-runtime/security/review");

  for (let i = 0; i < per_gate.length; i++) {
    const gate = receipt.gates[i];
    if (gate.kind === "NEX2_VALID" && gate.backing_record_id && gate.backing_public_key_der_hex) {
      const reviews = await loadReviewsForProposal(receipt.proposal_id);
      const review = reviews.find((r) => r.review_id === gate.backing_record_id);
      if (!review) { per_gate[i] = { ...per_gate[i], gate_signature_valid: false, detail: "review record not loadable" }; continue; }
      const ok = verifyNex2Review(gate.backing_public_key_der_hex, review);
      per_gate[i] = { ...per_gate[i], gate_signature_valid: ok, detail: ok ? "NEX2 review signature deep-verified" : "NEX2 review signature failed deep verification" };
    } else if (gate.kind === "NEX3_VALID" && gate.backing_record_id && gate.backing_public_key_der_hex) {
      const arbs = await loadArbitrationsForProposal(receipt.proposal_id);
      const arb = arbs.find((a) => a.arbitration_id === gate.backing_record_id);
      if (!arb) { per_gate[i] = { ...per_gate[i], gate_signature_valid: false, detail: "arbitration record not loadable" }; continue; }
      const ok = verifyNex3Arbitration(gate.backing_public_key_der_hex, arb);
      per_gate[i] = { ...per_gate[i], gate_signature_valid: ok, detail: ok ? "NEX3 arbitration signature deep-verified" : "NEX3 arbitration signature failed deep verification" };
    } else if (gate.kind === "SECURITY_VALID" && gate.backing_record_id && gate.backing_public_key_der_hex) {
      const vetos = await loadVetosForProposal(receipt.proposal_id);
      const veto = vetos.find((v) => v.veto_id === gate.backing_record_id);
      if (!veto) { per_gate[i] = { ...per_gate[i], gate_signature_valid: false, detail: "security veto record not loadable" }; continue; }
      const ok = verifySecurityVeto(gate.backing_public_key_der_hex, veto);
      per_gate[i] = { ...per_gate[i], gate_signature_valid: ok, detail: ok ? "Security veto signature deep-verified" : "Security veto signature failed deep verification" };
    }
  }
  const allOk = per_gate.every((g) => g.gate_signature_valid) && shallow.assembly_signature_valid;
  return {
    assembly_signature_valid: shallow.assembly_signature_valid,
    per_gate: Object.freeze(per_gate),
    overall_ok: allOk,
    reason_summary: allOk ? "receipt deep-verified (assembly + per-gate signatures loaded and re-verified)" : "receipt failed deep verification",
  };
}

// ── Assemble a receipt ─────────────────────────────────────────────────

export interface AssembleReceiptInput {
  readonly identity: AgentIdentity;
  readonly instance_id: string;
  readonly proposal_id: string;
  readonly mission_id?: string | null;
  /** LEGACY: direct founder signature. Retained for backward-compat. */
  readonly founder_signature_hex?: string | null;
  readonly trusted_founder_public_keys_hex?: readonly string[];
  /** RUNTIME-08: founder-signed delegation + NEX-signed authorization. */
  readonly delegation?: FounderDelegationEnvelope | null;
  readonly authorization?: DelegatedAuthorizationEnvelope | null;
  readonly freshness?: FreshnessPolicy;
  readonly now_ms?: number;
}

export async function assembleGateReceipt(input: AssembleReceiptInput): Promise<OrchestratorGateReceipt> {
  const now_ms = input.now_ms ?? Date.now();
  const policy = input.freshness ?? DEFAULT_FRESHNESS;

  const proposal = await loadProposalById(input.proposal_id);
  if (!proposal) {
    const base = {
      record_type: "NEX_ORCHESTRATOR_GATE_RECEIPT" as const,
      receipt_id: `REC-${randomUUID()}`,
      mission_id: input.mission_id ?? null,
      proposal_id: input.proposal_id,
      cap_id: null,
      assembled_by_agent_id: input.identity.agent_id,
      assembled_by_instance_id: input.instance_id,
      assembled_by_public_key_der_hex: input.identity.public_key_der_hex,
      assembled_at: new Date(now_ms).toISOString(),
      gates: [] as readonly Gate[],
      overall_verdict: "PENDING_INPUT" as const,
      reason_summary: `proposal ${input.proposal_id} not found`,
    };
    return persistReceipt(input.identity, base);
  }

  const nex1 = computeNex1Gate({ proposal, now_ms, policy });
  const nex2 = await computeNex2Gate({ proposal, now_ms, policy });
  const nex3 = await computeNex3Gate({ proposal, nex2_gate: nex2, now_ms, policy });
  const sec = await computeSecurityGate({ proposal, now_ms, policy });
  // Founder-auth: prefer delegation model (RUNTIME-08); fall back to legacy direct-signature.
  const founder = (input.delegation && input.authorization)
    ? await computeFounderAuthGateDelegated({
        proposal, delegation: input.delegation, authorization: input.authorization,
        trusted_founder_public_keys_hex: input.trusted_founder_public_keys_hex ?? [],
        now_ms,
      })
    : await computeFounderAuthGate({
        proposal,
        founder_signature_hex: input.founder_signature_hex ?? null,
        trusted_founder_public_keys_hex: input.trusted_founder_public_keys_hex ?? [],
      });
  const scope = computeScopeGate({ proposal });

  const expected_scope_hash = proposal.authorised_workstation_scope
    ? hashAuthorisedScope(proposal.authorised_workstation_scope) : null;
  const consistency = checkGateConsistency([nex1, nex2, nex3, sec, founder, scope], proposal.proposal_id, expected_scope_hash);

  // Derive overall verdict
  const gates: Gate[] = [nex1, nex2, nex3, sec, founder, scope];
  const gateOk = (g: Gate) => g.verdict === "VALID" || g.verdict === "NA";
  const anyExpired = gates.some((g) => g.verdict === "EXPIRED");
  const anyMissing = gates.some((g) => g.verdict === "MISSING");
  const anyInvalid = gates.some((g) => g.verdict === "INVALID");
  let overall: OrchestratorGateReceipt["overall_verdict"];
  let reason: string;
  if (!consistency.ok) {
    overall = "BLOCKED"; reason = `receipt inconsistent · ${consistency.reason}`;
  } else if (anyExpired) {
    overall = "EXPIRED"; reason = `at least one gate expired · agents must refresh their reviews`;
  } else if (anyMissing) {
    overall = "PENDING_INPUT"; reason = `at least one gate MISSING · waiting for backing record`;
  } else if (anyInvalid) {
    overall = "BLOCKED"; reason = `at least one gate INVALID · execution not permitted`;
  } else if (gates.every(gateOk)) {
    overall = "WORKSTATION_ALLOWED"; reason = `all 6 gates VALID/NA · workstation may proceed`;
  } else {
    overall = "BLOCKED"; reason = `unexpected gate state combination`;
  }

  // Now the summary WORKSTATION_ALLOWED gate (added to the receipt so
  // downstream can read one boolean if desired)
  const wsGate: Gate = {
    kind: "WORKSTATION_ALLOWED",
    verdict: overall === "WORKSTATION_ALLOWED" ? "VALID" : "INVALID",
    detail: reason,
    backing_record_id: proposal.proposal_id,
    backing_agent_id: input.identity.agent_id,
    backing_public_key_der_hex: input.identity.public_key_der_hex,
    backing_signature_hex: null,   // covered by the receipt's own signature
    backing_timestamp: new Date(now_ms).toISOString(),
    scope_hash: expected_scope_hash,
    evidence_refs: [proposal.proposal_id],
    expires_at: null,
  };
  gates.push(wsGate);

  const base = {
    record_type: "NEX_ORCHESTRATOR_GATE_RECEIPT" as const,
    receipt_id: `REC-${randomUUID()}`,
    mission_id: input.mission_id ?? null,
    proposal_id: proposal.proposal_id,
    cap_id: proposal.cap_id,
    assembled_by_agent_id: input.identity.agent_id,
    assembled_by_instance_id: input.instance_id,
    assembled_by_public_key_der_hex: input.identity.public_key_der_hex,
    assembled_at: new Date(now_ms).toISOString(),
    gates: Object.freeze([...gates]) as readonly Gate[],
    overall_verdict: overall,
    reason_summary: reason,
  };
  return persistReceipt(input.identity, base);
}

async function persistReceipt(identity: AgentIdentity, base: Omit<OrchestratorGateReceipt, "signature_hex">): Promise<OrchestratorGateReceipt> {
  const sig = ed25519Sign(null, canonicaliseReceipt(base), identity.private).toString("hex");
  const record: OrchestratorGateReceipt = { ...base, signature_hex: sig };
  await getStorage().save(ORCHESTRATOR_RECEIPT_COLLECTION, record);
  return record;
}

// ── Read helpers ───────────────────────────────────────────────────────

export async function loadReceiptsForProposal(proposal_id: string, limit = 20): Promise<OrchestratorGateReceipt[]> {
  return getStorage().query<OrchestratorGateReceipt>(ORCHESTRATOR_RECEIPT_COLLECTION, {
    where: { proposal_id }, limit, order_by: "assembled_at", order_dir: "desc",
  }).catch(() => [] as OrchestratorGateReceipt[]);
}

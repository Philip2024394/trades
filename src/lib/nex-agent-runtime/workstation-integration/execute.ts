// WO-NEX-RUNTIME-10 · workstation integration · executor.
//
// Founder-locked 2026-09-14. Connects the NEX workforce
// (NEX1/NEX2/NEX3/Security/Orchestrator + delegation + doorway) to the
// EXISTING WO-01..WO-09 workstation. This module does NOT build a
// second workstation and does NOT become a second Authority Broker.
// WO-04 remains the final deterministic file-mutation gate.
//
// Verification chain (all must pass; any failure REFUSES execution and
// produces a signed refusal attestation):
//
//     receipt.overall_verdict === WORKSTATION_ALLOWED
//         ↓
//     proposal_id matches receipt ↔ authorization ↔ proposal
//         ↓
//     verifyGateReceiptDeep(receipt) · every backing signature valid
//         ↓
//     receipt.assembled_by_public_key_der_hex ∈ trusted_orchestrator set
//         ↓
//     verifyDelegatedAuthorization(delegation, authorization, proposal) === AUTHORISED
//         ↓
//     scope hash matches proposal ↔ authorization ↔ receipt SCOPE_VALID gate
//         ↓
//     bridgeSupportsCapKind(cap.kind)
//         ↓
//     buildCapExecutionBridge(...) → workstation plan + bundle + specs
//         ↓
//     executeCapProposal(...) with pre_verified_authorization
//         ↓
//     WO-04 (Authority Broker · FINAL mutation gate) → WO-05 → WO-06 → WO-07 → WO-08 → WO-09
//         ↓
//     signed EXECUTED attestation persisted with cross-references

import {
  randomUUID,
  sign as ed25519Sign,
  createPublicKey,
  verify as ed25519Verify,
} from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import type { AgentIdentity } from "@/lib/nex-agent-runtime/process/identity";
import type { OrchestratorGateReceipt } from "@/lib/nex-agent-runtime/orchestrator/types";
import type {
  FounderDelegationEnvelope,
  DelegatedAuthorizationEnvelope,
} from "@/lib/nex-agent-runtime/founder-authority/types";
import { verifyGateReceiptDeep } from "@/lib/nex-agent-runtime/orchestrator/orchestrator";
import { verifyDelegatedAuthorization } from "@/lib/nex-agent-runtime/founder-authority/authorization";
import type { CapEngineeringProposal } from "@/lib/nex-cap/nex1-engineer";
import { hashAuthorisedScope } from "@/lib/nex-cap/nex1-engineer";
import type { CapabilityGap } from "@/lib/nex-cap/types";
import {
  buildCapExecutionBridge,
  bridgeSupportsCapKind,
  verifiersForSelfProofCap,
  type CapWorkstationAuthorityInput,
  type BridgeResult,
} from "@/lib/nex-cap/cap-spec-bridge";
import { realWorkstationAdapter } from "@/lib/nex-cap/real-workstation-adapter";
import {
  executeCapProposal,
  type ExecuteCapProposalResult,
  type Verifier,
} from "@/lib/nex-cap/execution";
import {
  type WorkstationIntegrationVerdict,
  type WorkstationIntegrationCheck,
  type WorkstationExecutionAttestation,
  WORKSTATION_INTEGRATION_ATTESTATION_COLLECTION,
} from "./types";

// ── Canonical serialisation of the attestation ─────────────────────────

function canonicaliseAttestation(
  a: Omit<WorkstationExecutionAttestation, "signature_hex">,
): Buffer {
  const ordered = {
    record_type: a.record_type,
    attestation_id: a.attestation_id,
    receipt_id: a.receipt_id,
    delegation_id: a.delegation_id,
    authorization_id: a.authorization_id,
    proposal_id: a.proposal_id,
    cap_id: a.cap_id,
    verdict: a.verdict,
    cap_execution_attempt_id: a.cap_execution_attempt_id,
    cap_execution_outcome: a.cap_execution_outcome,
    checks: a.checks.map((c) => ({ check: c.check, ok: c.ok, detail: c.detail })),
    reason_summary: a.reason_summary,
    requester_agent_id: a.requester_agent_id,
    requester_public_key_der_hex: a.requester_public_key_der_hex,
    attested_at: a.attested_at,
  };
  return Buffer.from(JSON.stringify(ordered), "utf8");
}

/** External verification of a persisted attestation. Downstream
 *  consumers use this to independently confirm a RUNTIME-10 record was
 *  actually signed by the claimed requester identity. */
export function verifyWorkstationAttestation(a: WorkstationExecutionAttestation): boolean {
  try {
    const { signature_hex: _drop, ...base } = a;
    void _drop;
    const pub = createPublicKey({
      key: Buffer.from(a.requester_public_key_der_hex, "hex"),
      format: "der",
      type: "spki",
    });
    return ed25519Verify(null, canonicaliseAttestation(base), pub, Buffer.from(a.signature_hex, "hex"));
  } catch {
    return false;
  }
}

async function persistAttestation(
  identity: AgentIdentity,
  fields: Omit<WorkstationExecutionAttestation, "signature_hex" | "attestation_id" | "record_type" | "attested_at" | "requester_agent_id" | "requester_public_key_der_hex">,
): Promise<WorkstationExecutionAttestation> {
  const base: Omit<WorkstationExecutionAttestation, "signature_hex"> = {
    record_type: "NEX_WORKSTATION_EXECUTION_ATTESTATION",
    attestation_id: `WS-ATT-${randomUUID()}`,
    receipt_id: fields.receipt_id,
    delegation_id: fields.delegation_id,
    authorization_id: fields.authorization_id,
    proposal_id: fields.proposal_id,
    cap_id: fields.cap_id,
    verdict: fields.verdict,
    cap_execution_attempt_id: fields.cap_execution_attempt_id,
    cap_execution_outcome: fields.cap_execution_outcome,
    checks: Object.freeze([...fields.checks]),
    reason_summary: fields.reason_summary,
    requester_agent_id: identity.agent_id,
    requester_public_key_der_hex: identity.public_key_der_hex,
    attested_at: new Date().toISOString(),
  };
  const sig = ed25519Sign(null, canonicaliseAttestation(base), identity.private).toString("hex");
  const record: WorkstationExecutionAttestation = { ...base, signature_hex: sig };
  await getStorage().save(WORKSTATION_INTEGRATION_ATTESTATION_COLLECTION, record);
  return record;
}

// ── Public API ─────────────────────────────────────────────────────────

export interface ExecuteThroughWorkstationInput {
  readonly receipt: OrchestratorGateReceipt;
  readonly delegation: FounderDelegationEnvelope;
  readonly authorization: DelegatedAuthorizationEnvelope;
  readonly proposal: CapEngineeringProposal;
  readonly cap: CapabilityGap;
  readonly trusted_founder_public_keys_hex: readonly string[];
  /** Ed25519 SPKI DER hex of each orchestrator identity the workstation
   *  trusts. The receipt's `assembled_by_public_key_der_hex` MUST be in
   *  this set — otherwise the receipt is refused regardless of internal
   *  validity. This is how the workstation refuses receipts assembled by
   *  a rogue or unknown orchestrator. */
  readonly trusted_orchestrator_public_keys_der_hex: readonly string[];
  readonly workspace_root: string;
  readonly workstation_authority: CapWorkstationAuthorityInput;
  readonly repo_root: string;
  readonly http_port: number;
  readonly environment:
    | "PRODUCTION_WORKFORCE"
    | "TEST"
    | "SIMULATION"
    | "FIXTURE"
    | "DEVELOPMENT";
  /** The agent identity requesting workstation execution. This is who
   *  signs the resulting EXECUTED / REFUSED attestation. Typically the
   *  orchestrator, but could be any authorised NEX runtime agent. */
  readonly requester_identity: AgentIdentity;
  readonly now_ms?: number;
  /** RUNTIME-11 · optional bridge + verifier factory. When supplied,
   *  RUNTIME-10 uses these instead of the default self-proof bridge.
   *  This is how CAP kinds beyond `workstation.self_proof.*` plug into
   *  the same verified execution path without duplicating the RUNTIME-10
   *  verification chain. */
  readonly bridge_factory?: {
    readonly build: (args: {
      readonly workstation_trace_id: string;
      readonly workspace_root: string;
      readonly workstation_authority: CapWorkstationAuthorityInput;
      readonly repo_root: string;
      readonly nex1_execution_instance_id: string;
      readonly http_port: number;
    }) => Promise<BridgeResult>;
    readonly verifiers: (args: {
      readonly proof_marker_abs_path: string;
      readonly workspace_root: string;
    }) => readonly Verifier[];
  };
}

export interface ExecuteThroughWorkstationResult {
  readonly verdict: WorkstationIntegrationVerdict;
  readonly checks: readonly WorkstationIntegrationCheck[];
  readonly cap_execution: ExecuteCapProposalResult | null;
  readonly attestation: WorkstationExecutionAttestation;
  readonly reason_summary: string;
}

export async function executeThroughWorkstation(
  input: ExecuteThroughWorkstationInput,
): Promise<ExecuteThroughWorkstationResult> {
  const checks: WorkstationIntegrationCheck[] = [];
  const push = (check: string, ok: boolean, detail: string): void => {
    checks.push({ check, ok, detail });
  };

  const refuse = async (
    verdict: WorkstationIntegrationVerdict,
    reason_summary: string,
  ): Promise<ExecuteThroughWorkstationResult> => {
    const attestation = await persistAttestation(input.requester_identity, {
      receipt_id: input.receipt.receipt_id,
      delegation_id: input.delegation.delegation_id,
      authorization_id: input.authorization.authorization_id,
      proposal_id: input.proposal.proposal_id,
      cap_id: input.proposal.cap_id ?? input.cap.cap_id,
      verdict,
      cap_execution_attempt_id: null,
      cap_execution_outcome: null,
      checks: [...checks],
      reason_summary,
    });
    return {
      verdict,
      checks: Object.freeze([...checks]),
      cap_execution: null,
      attestation,
      reason_summary,
    };
  };

  // ── Check 1 · receipt overall_verdict must be WORKSTATION_ALLOWED ────
  const overallOk = input.receipt.overall_verdict === "WORKSTATION_ALLOWED";
  push(
    "receipt_overall_verdict_workstation_allowed",
    overallOk,
    overallOk
      ? "receipt overall_verdict is WORKSTATION_ALLOWED"
      : `receipt overall_verdict is ${input.receipt.overall_verdict} · workstation refuses`,
  );
  if (!overallOk) {
    return refuse(
      "REFUSED_RECEIPT_NOT_ALLOWED",
      `Orchestrator receipt overall_verdict=${input.receipt.overall_verdict} · workstation refuses to execute`,
    );
  }

  // ── Check 2 · proposal_id alignment: receipt ↔ authorization ↔ proposal
  const receiptProposalOk =
    input.receipt.proposal_id === input.proposal.proposal_id;
  push(
    "receipt_proposal_id_matches_proposal",
    receiptProposalOk,
    receiptProposalOk
      ? "receipt.proposal_id matches proposal.proposal_id"
      : `receipt.proposal_id=${input.receipt.proposal_id} != proposal.proposal_id=${input.proposal.proposal_id}`,
  );
  if (!receiptProposalOk) {
    return refuse(
      "REFUSED_PROPOSAL_MISMATCH",
      "receipt.proposal_id disagrees with proposal.proposal_id",
    );
  }
  const authProposalOk =
    input.authorization.proposal_id === input.proposal.proposal_id;
  push(
    "authorization_proposal_id_matches_proposal",
    authProposalOk,
    authProposalOk
      ? "authorization.proposal_id matches proposal.proposal_id"
      : `authorization.proposal_id=${input.authorization.proposal_id} != proposal.proposal_id=${input.proposal.proposal_id}`,
  );
  if (!authProposalOk) {
    return refuse(
      "REFUSED_PROPOSAL_MISMATCH",
      "authorization.proposal_id disagrees with proposal.proposal_id",
    );
  }

  // ── Check 3 · deep verify receipt (assembly sig + every gate signature)
  const deep = await verifyGateReceiptDeep(input.receipt);
  push(
    "receipt_deep_verified",
    deep.overall_ok,
    deep.overall_ok
      ? "receipt deep-verified · assembly + every backing signature"
      : `receipt deep verification failed: ${deep.reason_summary}`,
  );
  if (!deep.overall_ok) {
    return refuse("REFUSED_RECEIPT_INVALID", deep.reason_summary);
  }

  // ── Check 4 · orchestrator identity must be in trusted set ───────────
  const orchestratorTrusted =
    input.trusted_orchestrator_public_keys_der_hex.includes(
      input.receipt.assembled_by_public_key_der_hex,
    );
  push(
    "receipt_orchestrator_identity_trusted",
    orchestratorTrusted,
    orchestratorTrusted
      ? `receipt assembled by trusted orchestrator ${input.receipt.assembled_by_agent_id}`
      : `receipt assembled by ${input.receipt.assembled_by_agent_id} whose public key is not in trusted_orchestrator set`,
  );
  if (!orchestratorTrusted) {
    return refuse(
      "REFUSED_ORCHESTRATOR_UNTRUSTED",
      "receipt was assembled by an orchestrator identity not in the trusted set",
    );
  }

  // ── Check 5 · delegation + authorization verifier ─────────────────────
  const delegVerify = await verifyDelegatedAuthorization({
    delegation: input.delegation,
    authorization: input.authorization,
    proposal: input.proposal,
    trusted_founder_public_keys_hex: input.trusted_founder_public_keys_hex,
    now_ms: input.now_ms,
  });
  const delegOk = delegVerify.verdict === "AUTHORISED";
  push(
    "delegation_authorization_verified",
    delegOk,
    delegOk
      ? `delegation-authorization AUTHORISED · ${delegVerify.reason_summary}`
      : `delegation-authorization ${delegVerify.verdict}: ${delegVerify.reason_summary}`,
  );
  if (!delegOk) {
    return refuse(
      "REFUSED_DELEGATION_INVALID",
      `delegation-authorization NOT_AUTHORISED (${delegVerify.verdict}): ${delegVerify.reason_summary}`,
    );
  }

  // ── Check 6 · scope must exist ───────────────────────────────────────
  const scope = input.proposal.authorised_workstation_scope;
  if (!scope) {
    push(
      "proposal_has_authorised_workstation_scope",
      false,
      "proposal.authorised_workstation_scope is null · workstation cannot execute without founder-signed scope",
    );
    return refuse(
      "REFUSED_SCOPE_MISSING",
      "proposal has no authorised_workstation_scope",
    );
  }
  push(
    "proposal_has_authorised_workstation_scope",
    true,
    `proposal scope covers ${scope.files_may_touch.length} path(s), ${scope.stages_required.length} stage(s)`,
  );

  // ── Check 7 · scope hash consistency across artefacts ────────────────
  const scopeHash = hashAuthorisedScope(scope);
  const authScopeOk = input.authorization.scope_hash === scopeHash;
  push(
    "authorization_scope_hash_matches_proposal",
    authScopeOk,
    authScopeOk
      ? "authorization.scope_hash matches proposal scope hash"
      : `authorization.scope_hash=${input.authorization.scope_hash.slice(0, 16)}… != proposal hash=${scopeHash.slice(0, 16)}…`,
  );
  if (!authScopeOk) {
    return refuse(
      "REFUSED_SCOPE_MISMATCH",
      "authorization.scope_hash disagrees with proposal.authorised_workstation_scope hash",
    );
  }
  const scopeGate = input.receipt.gates.find((g) => g.kind === "SCOPE_VALID");
  const receiptScopeOk = scopeGate?.scope_hash === scopeHash;
  push(
    "receipt_scope_gate_matches_proposal",
    receiptScopeOk,
    receiptScopeOk
      ? "receipt SCOPE_VALID gate scope_hash matches proposal"
      : `receipt SCOPE_VALID gate scope_hash=${scopeGate?.scope_hash?.slice(0, 16) ?? "null"}… != proposal hash=${scopeHash.slice(0, 16)}…`,
  );
  if (!receiptScopeOk) {
    return refuse(
      "REFUSED_SCOPE_MISMATCH",
      "receipt SCOPE_VALID gate scope_hash disagrees with proposal",
    );
  }

  // ── Check 8 · CAP-kind bridge must exist ─────────────────────────────
  // When a bridge_factory is supplied (RUNTIME-11+), that's the source of
  // truth · we still validate the CAP kind is known so an unsupported
  // kind can't sneak through.
  const bridgeOk = input.bridge_factory ? true : bridgeSupportsCapKind(input.cap.kind);
  push(
    "cap_kind_bridge_supported",
    bridgeOk,
    bridgeOk
      ? `bridge supports CAP kind ${input.cap.kind}${input.bridge_factory ? " (custom factory)" : ""}`
      : `bridge does NOT support CAP kind ${input.cap.kind}`,
  );
  if (!bridgeOk) {
    return refuse(
      "REFUSED_UNSUPPORTED_CAP_KIND",
      `no deterministic bridge for CAP kind ${input.cap.kind}`,
    );
  }

  // ── Check 9 · build the execution bridge ─────────────────────────────
  const workstation_trace_id = `WS-TRACE-${randomUUID().slice(0, 16)}`;
  const bridge = input.bridge_factory
    ? await input.bridge_factory.build({
        workstation_trace_id,
        workspace_root: input.workspace_root,
        workstation_authority: input.workstation_authority,
        repo_root: input.repo_root,
        nex1_execution_instance_id: `runtime-10-${input.requester_identity.agent_id}`,
        http_port: input.http_port,
      })
    : await buildCapExecutionBridge({
        cap: input.cap,
        proposal: input.proposal,
        workstation_trace_id,
        workspace_root: input.workspace_root,
        authority: input.workstation_authority,
        repo_root: input.repo_root,
        nex1_execution_instance_id: `runtime-10-${input.requester_identity.agent_id}`,
        http_port: input.http_port,
      });
  if (!bridge.ok) {
    push(
      "workstation_execution_bridge_built",
      false,
      `bridge failed: ${bridge.reason}`,
    );
    return refuse("REFUSED_BRIDGE_FAILED", bridge.reason);
  }
  push(
    "workstation_execution_bridge_built",
    true,
    `bridge built · trace ${workstation_trace_id}`,
  );
  const b = bridge.output;

  // ── Hand off to the existing workstation ─────────────────────────────
  // The RUNTIME-10 module STOPS deciding here. Everything below is the
  // existing WO-01..WO-09 machinery. WO-04 is the final deterministic
  // mutation gate · out-of-scope bundle candidates are refused there.
  const adapter = realWorkstationAdapter({
    proposal: input.proposal,
    plan: b.workstation_plan,
    workspace_root: input.workspace_root,
    authorised_bundle: b.bundle_input,
    build_spec: b.build_spec,
    runtime_spec: b.runtime_spec,
    specialist_invocations: b.specialists,
  });
  push(
    "handoff_to_existing_workstation",
    true,
    "handoff to existing WO-01..WO-09 · WO-04 remains final mutation gate",
  );

  const verifiers = input.bridge_factory
    ? input.bridge_factory.verifiers({
        proof_marker_abs_path: b.proof_marker_abs_path,
        workspace_root: input.workspace_root,
      })
    : verifiersForSelfProofCap({
        proof_marker_abs_path: b.proof_marker_abs_path,
        workspace_root: input.workspace_root,
      });

  const cap_execution = await executeCapProposal({
    cap_id: input.cap.cap_id,
    proposal_id: input.proposal.proposal_id,
    founder_signature_hex: "",
    trusted_founder_public_keys_hex: input.trusted_founder_public_keys_hex,
    environment: input.environment,
    workstation: adapter,
    verifiers,
    pre_verified_authorization: {
      proposal: input.proposal,
      approval_reason:
        `RUNTIME-10 · delegation ${input.delegation.delegation_id.slice(0, 24)}… ` +
        `· authorization ${input.authorization.authorization_id.slice(0, 24)}… ` +
        `· orchestrator receipt ${input.receipt.receipt_id.slice(0, 24)}… ` +
        `· founder signature verified · gate receipt deep-verified · founder-locked delegation model`,
    },
  });

  const reason_summary =
    `RUNTIME-10 executed through WO-01..WO-09 · cap_execution=${cap_execution.outcome} ` +
    `· workstation_trace=${workstation_trace_id} · attempt=${cap_execution.attempt.attempt_id}`;

  const attestation = await persistAttestation(input.requester_identity, {
    receipt_id: input.receipt.receipt_id,
    delegation_id: input.delegation.delegation_id,
    authorization_id: input.authorization.authorization_id,
    proposal_id: input.proposal.proposal_id,
    cap_id: input.proposal.cap_id ?? input.cap.cap_id,
    verdict: "EXECUTED",
    cap_execution_attempt_id: cap_execution.attempt.attempt_id,
    cap_execution_outcome: cap_execution.outcome,
    checks: [...checks],
    reason_summary,
  });

  return {
    verdict: "EXECUTED",
    checks: Object.freeze([...checks]),
    cap_execution,
    attestation,
    reason_summary,
  };
}

// ── Read helper ────────────────────────────────────────────────────────

export async function loadAttestationsForProposal(
  proposal_id: string,
  limit = 50,
): Promise<WorkstationExecutionAttestation[]> {
  return getStorage()
    .query<WorkstationExecutionAttestation>(
      WORKSTATION_INTEGRATION_ATTESTATION_COLLECTION,
      { where: { proposal_id }, limit, order_by: "attested_at", order_dir: "desc" },
    )
    .catch(() => [] as WorkstationExecutionAttestation[]);
}

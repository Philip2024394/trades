// WO-NEX-RUNTIME-06 · Security review compose + persist.
//
// Founder-locked 2026-09-13. Runs detection rules, derives verdict,
// signs record with Security's own Ed25519 identity. Read-only ·
// no_files_modified: true is a permanent invariant.

import { randomUUID, sign as ed25519Sign, createPublicKey, verify as ed25519Verify } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import type { AgentIdentity } from "@/lib/nex-agent-runtime/process/identity";
import { loadAllProposals, type CapEngineeringProposal } from "@/lib/nex-cap/nex1-engineer";
import { runAllDetectionRules } from "./detection";
import {
  type SecurityVerdict,
  type SecurityFinding,
  type SecurityVetoRecord,
  SECURITY_VETO_COLLECTION,
} from "./types";

function canonicaliseVeto(rec: Omit<SecurityVetoRecord, "signature_hex">): Buffer {
  const ordered = {
    record_type: rec.record_type,
    veto_id: rec.veto_id,
    proposal_id: rec.proposal_id,
    cap_id: rec.cap_id,
    mission_id: rec.mission_id,
    reviewed_by_agent_id: rec.reviewed_by_agent_id,
    reviewed_by_instance_id: rec.reviewed_by_instance_id,
    reviewed_by_public_key_der_hex: rec.reviewed_by_public_key_der_hex,
    reviewed_at: rec.reviewed_at,
    verdict: rec.verdict,
    findings: rec.findings.map((f) => ({ category: f.category, severity: f.severity, detail: f.detail, offending_target: f.offending_target, evidence_ref: f.evidence_ref })),
    reason_summary: rec.reason_summary,
    no_files_modified: rec.no_files_modified,
  };
  return Buffer.from(JSON.stringify(ordered), "utf8");
}

export function verifySecurityVeto(publicKeyDerHex: string, record: SecurityVetoRecord): boolean {
  try {
    const { signature_hex: _drop, ...base } = record;
    void _drop;
    const pub = createPublicKey({ key: Buffer.from(publicKeyDerHex, "hex"), format: "der", type: "spki" });
    return ed25519Verify(null, canonicaliseVeto(base), pub, Buffer.from(record.signature_hex, "hex"));
  } catch { return false; }
}

// ── Pure verdict derivation ────────────────────────────────────────────

export function deriveSecurityVerdict(findings: readonly SecurityFinding[]): SecurityVerdict {
  if (findings.length === 0) return "CLEARED";
  const has = (cat: SecurityFinding["category"]) => findings.some((f) => f.category === cat);
  // Priority order: malware > protected_root > fs_escape > credential > network > dependency
  if (has("malware")) return "REJECTED_MALWARE";
  if (has("protected_root")) return "REJECTED_PROTECTED_ROOT";
  if (has("fs_escape")) return "REJECTED_FS_ESCAPE";
  if (has("credential")) return "REJECTED_CREDENTIAL_LEAK";
  if (has("network")) return "REJECTED_NETWORK_POLICY";
  if (has("dependency")) return "REJECTED_DEPENDENCY_RISK";
  if (has("input_missing")) return "INSUFFICIENT_INPUT";
  return "REJECTED_UNKNOWN";
}

// ── Public API ─────────────────────────────────────────────────────────

export interface SecurityReviewInput {
  readonly identity: AgentIdentity;
  readonly instance_id: string;
  readonly proposal: CapEngineeringProposal;
  readonly mission_id?: string | null;
  readonly file_write_intents?: readonly { path: string; content_preview: string }[];
  readonly dependency_intents?: readonly { name: string; version: string }[];
  readonly network_intents?: readonly { url: string; method: string }[];
  readonly process_intents?: readonly { command: string; args: readonly string[] }[];
}

/**
 * Run detection rules over a proposal and return a signed veto record.
 * NEVER modifies files. NEVER reaches the workstation. NEVER contacts
 * the Internet. NEVER signs founder authority.
 */
export async function securityReview(input: SecurityReviewInput): Promise<SecurityVetoRecord> {
  const findings = runAllDetectionRules({
    proposal: input.proposal,
    file_write_intents: input.file_write_intents,
    dependency_intents: input.dependency_intents,
    network_intents: input.network_intents,
    process_intents: input.process_intents,
  });
  const verdict = deriveSecurityVerdict(findings);
  const reason_summary = verdict === "CLEARED"
    ? "Security cleared · no findings detected"
    : `Security VETO · verdict ${verdict} · ${findings.length} finding(s): ${findings.map((f) => `${f.severity}:${f.category}`).slice(0, 5).join(" · ")}`;
  return persistVeto({
    identity: input.identity, instance_id: input.instance_id,
    proposal_id: input.proposal.proposal_id, cap_id: input.proposal.cap_id,
    mission_id: input.mission_id ?? null,
    verdict, findings, reason_summary,
  });
}

/**
 * Convenience: review a proposal by id (loads it from storage).
 */
export async function securityReviewProposal(input: {
  identity: AgentIdentity; instance_id: string; proposal_id: string; mission_id?: string | null;
  file_write_intents?: readonly { path: string; content_preview: string }[];
  dependency_intents?: readonly { name: string; version: string }[];
  network_intents?: readonly { url: string; method: string }[];
  process_intents?: readonly { command: string; args: readonly string[] }[];
}): Promise<SecurityVetoRecord> {
  const proposals = await loadAllProposals();
  const proposal = proposals.find((p) => p.proposal_id === input.proposal_id);
  if (!proposal) {
    return persistVeto({
      identity: input.identity, instance_id: input.instance_id,
      proposal_id: input.proposal_id, cap_id: null, mission_id: input.mission_id ?? null,
      verdict: "INSUFFICIENT_INPUT",
      findings: [{ category: "input_missing", severity: "medium",
        detail: `proposal ${input.proposal_id} not found · Security cannot review`,
        offending_target: input.proposal_id, evidence_ref: null }],
      reason_summary: `Security INSUFFICIENT_INPUT · proposal ${input.proposal_id} not found`,
    });
  }
  return securityReview({ ...input, proposal });
}

async function persistVeto(input: {
  identity: AgentIdentity; instance_id: string;
  proposal_id: string; cap_id: string | null; mission_id: string | null;
  verdict: SecurityVerdict; findings: readonly SecurityFinding[]; reason_summary: string;
}): Promise<SecurityVetoRecord> {
  const base = {
    record_type: "NEX_SECURITY_VETO" as const,
    veto_id: `SEC-${input.identity.agent_id}-${randomUUID()}`,
    proposal_id: input.proposal_id,
    cap_id: input.cap_id, mission_id: input.mission_id,
    reviewed_by_agent_id: input.identity.agent_id,
    reviewed_by_instance_id: input.instance_id,
    reviewed_by_public_key_der_hex: input.identity.public_key_der_hex,
    reviewed_at: new Date().toISOString(),
    verdict: input.verdict,
    findings: Object.freeze([...input.findings]) as readonly SecurityFinding[],
    reason_summary: input.reason_summary,
    no_files_modified: true as const,
  };
  const sig = ed25519Sign(null, canonicaliseVeto(base), input.identity.private).toString("hex");
  const record: SecurityVetoRecord = { ...base, signature_hex: sig };
  await getStorage().save(SECURITY_VETO_COLLECTION, record);
  return record;
}

export async function loadVetosForProposal(proposal_id: string, limit = 20): Promise<SecurityVetoRecord[]> {
  return getStorage().query<SecurityVetoRecord>(SECURITY_VETO_COLLECTION, {
    where: { proposal_id }, limit, order_by: "reviewed_at", order_dir: "desc",
  }).catch(() => [] as SecurityVetoRecord[]);
}

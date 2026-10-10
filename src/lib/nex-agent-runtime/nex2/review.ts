// WO-NEX-RUNTIME-04 · NEX2 independent review logic.
//
// Founder-locked 2026-09-13. This is NEX2's reasoning. It is
// deterministic (P-S · no LLM) and it MUST NOT delegate to NEX1's
// brain, NEX1's memory, or NEX1's mission-context chain for its
// verdict. NEX2 reads NEX1's outputs as input evidence, but re-derives
// its own conclusion.
//
// If NEX2 always agrees with NEX1, this module has failed.

import { randomUUID, sign as ed25519Sign, createPublicKey, verify as ed25519Verify } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import { loadCap } from "@/lib/nex-cap/registry";
import { loadAllProposals, type CapEngineeringProposal } from "@/lib/nex-cap/nex1-engineer";
import { loadMissionContextChain } from "@/lib/nex-agent-runtime/nex1/mission-context";
import type { AgentIdentity } from "@/lib/nex-agent-runtime/process/identity";
import type { MissionContextChain } from "@/lib/nex-agent-runtime/nex1/types";
import type { CapabilityGap } from "@/lib/nex-cap/types";
import {
  type Nex2Verdict,
  type Nex2Finding,
  type Nex2ReviewRecord,
  NEX2_REVIEW_COLLECTION,
  NEX2_PROTECTED_ROOTS,
  NEX2_ESCALATE_ONLY_CAP_KINDS,
} from "./types";

// ── Canonical serialisation of a review (for signing) ──────────────────

function canonicaliseReview(rec: Omit<Nex2ReviewRecord, "signature_hex">): Buffer {
  const ordered = {
    record_type: rec.record_type,
    review_id: rec.review_id,
    proposal_id: rec.proposal_id,
    cap_id: rec.cap_id,
    mission_id: rec.mission_id,
    nex1_context_id: rec.nex1_context_id,
    reviewed_by_agent_id: rec.reviewed_by_agent_id,
    reviewed_by_instance_id: rec.reviewed_by_instance_id,
    reviewed_by_public_key_der_hex: rec.reviewed_by_public_key_der_hex,
    reviewed_at: rec.reviewed_at,
    verdict: rec.verdict,
    findings: rec.findings.map((f) => ({ kind: f.kind, severity: f.severity, detail: f.detail, evidence_ref: f.evidence_ref })),
    reason_summary: rec.reason_summary,
    evidence_ref: rec.evidence_ref,
  };
  return Buffer.from(JSON.stringify(ordered), "utf8");
}

export function verifyNex2Review(publicKeyDerHex: string, review: Nex2ReviewRecord): boolean {
  try {
    const { signature_hex: _drop, ...base } = review;
    void _drop;
    const pub = createPublicKey({ key: Buffer.from(publicKeyDerHex, "hex"), format: "der", type: "spki" });
    return ed25519Verify(null, canonicaliseReview(base), pub, Buffer.from(review.signature_hex, "hex"));
  } catch { return false; }
}

// ── Independent review · pure function ────────────────────────────────

export interface Nex2ReviewInput {
  readonly proposal: CapEngineeringProposal;
  readonly cap: CapabilityGap | null;
  readonly nex1_context: MissionContextChain | null;
  readonly mission_id: string | null;
}

export interface Nex2ReviewComputation {
  readonly verdict: Nex2Verdict;
  readonly findings: readonly Nex2Finding[];
  readonly reason_summary: string;
}

/**
 * Pure deterministic review. Same input → same verdict.
 *
 * The specific checks here are chosen to be:
 *   (a) not dependent on NEX1's own reasoning
 *   (b) mechanically detectable from the persisted proposal + CAP + chain
 *   (c) representative of the kinds of failures a distinct reviewer
 *       should independently catch.
 */
export function nex2ReviewCompute(input: Nex2ReviewInput): Nex2ReviewComputation {
  const findings: Nex2Finding[] = [];
  const { proposal, cap, nex1_context } = input;

  // ── Check 1 · founder-signature integrity (proposal MUST be unsigned) ─
  if (proposal.founder_signature_slot !== null) {
    findings.push({
      kind: "founder_signature_slot_not_null",
      severity: "critical",
      detail: "proposal claims founder_signature_slot != null · impossible per P-U doctrine · NEX2 cannot verify authorship",
      evidence_ref: proposal.proposal_id,
    });
  }

  // ── Check 2 · proposal has a non-empty evidence chain ────────────────
  if (proposal.evidence_chain.length === 0) {
    findings.push({
      kind: "empty_evidence_chain",
      severity: "high",
      detail: "proposal.evidence_chain is empty · no supporting evidence to review",
      evidence_ref: proposal.proposal_id,
    });
  }

  // ── Check 3 · diagnosis + fix summary are present ────────────────────
  if (!proposal.diagnosis || proposal.diagnosis.trim().length < 10) {
    findings.push({
      kind: "diagnosis_absent",
      severity: "high",
      detail: `proposal.diagnosis missing or too short (len=${proposal.diagnosis?.length ?? 0})`,
      evidence_ref: proposal.proposal_id,
    });
  }
  if (!proposal.proposed_fix_summary || proposal.proposed_fix_summary.trim().length < 10) {
    findings.push({
      kind: "fix_summary_absent",
      severity: "high",
      detail: "proposal.proposed_fix_summary missing or too short",
      evidence_ref: proposal.proposal_id,
    });
  }

  // ── Check 4 · CAP kind must not require ESCALATE while proposing PROPOSE
  if (cap && NEX2_ESCALATE_ONLY_CAP_KINDS.has(cap.kind) && proposal.resolver_outcome !== "ESCALATE") {
    findings.push({
      kind: "escalate_only_kind_not_escalated",
      severity: "critical",
      detail: `CAP kind ${cap.kind} is security-escalate-only but proposal.resolver_outcome=${proposal.resolver_outcome}`,
      evidence_ref: proposal.proposal_id,
    });
  }

  // ── Check 5 · authorised workstation scope must not touch protected roots
  const scope = proposal.authorised_workstation_scope;
  if (scope) {
    for (const p of scope.files_may_touch) {
      const norm = p.replace(/\\/g, "/");
      const bad = NEX2_PROTECTED_ROOTS.find((root) => norm === root || norm.startsWith(root));
      if (bad) {
        findings.push({
          kind: "workstation_scope_touches_protected_root",
          severity: "critical",
          detail: `authorised_workstation_scope.files_may_touch contains ${p} · matches protected root ${bad}`,
          evidence_ref: proposal.proposal_id,
        });
      }
    }
  }

  // ── Check 6 · CAP status not already terminal ────────────────────────
  if (cap && (cap.status === "RESOLVED" || cap.status === "DISMISSED")) {
    findings.push({
      kind: "cap_status_terminal",
      severity: "high",
      detail: `CAP ${cap.cap_id} already ${cap.status} · proposal cannot legitimately act on it`,
      evidence_ref: cap.cap_id,
    });
  }

  // ── Check 7 · unsupported CAP kind (no resolver template) ────────────
  if (cap) {
    const known = new Set([
      "guardian.te.evidence_source_unregistered",
      "guardian.te.evidence_source_registry_untrusted",
      "guardian.te.evidence_source_test_masquerade",
      "rate_limiter.persistent_backoff",
      "intelligence.growth_stalled",
    ]);
    if (!known.has(cap.kind) && proposal.resolver_outcome !== "ESCALATE") {
      findings.push({
        kind: "unsupported_cap_kind",
        severity: "medium",
        detail: `CAP kind ${cap.kind} has no known deterministic resolver · non-ESCALATE outcome is suspicious`,
        evidence_ref: proposal.proposal_id,
      });
    }
  }

  // ── Check 8 · NEX1 context chain integrity ───────────────────────────
  //  Only applies if the proposal is expected to have come through a
  //  NEX1 mission (i.e., mission_id was supplied). Reviewing a direct
  //  proposal (no mission) legitimately has no chain.
  if (input.mission_id && !nex1_context) {
    findings.push({
      kind: "context_chain_missing",
      severity: "medium",
      detail: `mission ${input.mission_id} was reviewed but no NEX1 mission-context chain found · reasoning trace unavailable`,
      evidence_ref: proposal.proposal_id,
    });
  } else if (nex1_context) {
    if (nex1_context.observations.length === 0) {
      findings.push({
        kind: "context_chain_no_observations",
        severity: "medium",
        detail: "NEX1 chain has no observations · reasoning trace incomplete",
        evidence_ref: nex1_context.context_id,
      });
    }
    if (nex1_context.analysis.length === 0) {
      findings.push({
        kind: "context_chain_no_analysis",
        severity: "medium",
        detail: "NEX1 chain has no analysis · reasoning trace incomplete",
        evidence_ref: nex1_context.context_id,
      });
    }
    if (nex1_context.evidence_refs.length === 0) {
      findings.push({
        kind: "context_chain_no_evidence",
        severity: "medium",
        detail: "NEX1 chain has no evidence_refs · nothing to independently corroborate",
        evidence_ref: nex1_context.context_id,
      });
    }
  }

  // ── Verdict derivation ───────────────────────────────────────────────
  //  1. Any critical finding → REJECTED_UNSAFE
  //  2. Any high finding on evidence completeness → REJECTED_INCOMPLETE_EVIDENCE
  //  3. escalate-only-kind mismatch → ESCALATE_TO_FOUNDER
  //  4. multiple medium findings on context chain → CONFLICT_WITH_NEX1
  //  5. otherwise → INDEPENDENTLY_VERIFIED

  const critical = findings.filter((f) => f.severity === "critical");
  const high = findings.filter((f) => f.severity === "high");
  const medium = findings.filter((f) => f.severity === "medium");

  let verdict: Nex2Verdict;
  if (findings.length === 0) {
    verdict = "INDEPENDENTLY_VERIFIED";
  } else if (critical.some((f) => f.kind === "escalate_only_kind_not_escalated")) {
    verdict = "ESCALATE_TO_FOUNDER";
  } else if (critical.length > 0) {
    verdict = "REJECTED_UNSAFE";
  } else if (high.some((f) => f.kind === "empty_evidence_chain" || f.kind === "diagnosis_absent" || f.kind === "fix_summary_absent" || f.kind === "cap_status_terminal")) {
    verdict = "REJECTED_INCOMPLETE_EVIDENCE";
  } else if (medium.filter((f) => f.kind === "context_chain_missing" || f.kind === "context_chain_no_observations" || f.kind === "context_chain_no_analysis" || f.kind === "context_chain_no_evidence").length >= 2) {
    verdict = "CONFLICT_WITH_NEX1";
  } else {
    // Fallback: at least one medium finding but nothing that gates rejection
    verdict = "INDEPENDENTLY_VERIFIED";
  }

  const reason_summary = findings.length === 0
    ? `NEX2 independently verified proposal ${proposal.proposal_id.slice(0, 24)}… · no findings · verdict INDEPENDENTLY_VERIFIED`
    : `NEX2 verdict ${verdict} · ${findings.length} finding(s): ${findings.map((f) => `${f.severity}:${f.kind}`).slice(0, 6).join(" · ")}`;

  return { verdict, findings: Object.freeze([...findings]) as readonly Nex2Finding[], reason_summary };
}

// ── High-level API: review a proposal by id (loads inputs from storage) ─

export interface Nex2ReviewProposalInput {
  readonly identity: AgentIdentity;
  readonly instance_id: string;
  readonly proposal_id: string;
  readonly mission_id?: string | null;
}

export async function nex2ReviewProposal(input: Nex2ReviewProposalInput): Promise<Nex2ReviewRecord> {
  const proposals = await loadAllProposals();
  const proposal = proposals.find((p) => p.proposal_id === input.proposal_id);
  if (!proposal) {
    // Emit an INSUFFICIENT_REVIEW_INPUT record so the audit trail shows NEX2 was asked
    return persistReviewRecord({
      identity: input.identity,
      instance_id: input.instance_id,
      proposal_id: input.proposal_id,
      cap_id: null, mission_id: input.mission_id ?? null,
      nex1_context_id: null,
      verdict: "INSUFFICIENT_REVIEW_INPUT",
      findings: [],
      reason_summary: `proposal ${input.proposal_id} not found · NEX2 cannot review non-existent proposals`,
      evidence_ref: null,
    });
  }
  const cap = await loadCap(proposal.cap_id).catch(() => null);
  const nex1_context = input.mission_id ? await loadMissionContextChain(input.mission_id).catch(() => null) : null;

  const comp = nex2ReviewCompute({ proposal, cap, nex1_context, mission_id: input.mission_id ?? null });

  return persistReviewRecord({
    identity: input.identity,
    instance_id: input.instance_id,
    proposal_id: proposal.proposal_id,
    cap_id: proposal.cap_id,
    mission_id: input.mission_id ?? null,
    nex1_context_id: nex1_context?.context_id ?? null,
    verdict: comp.verdict,
    findings: comp.findings,
    reason_summary: comp.reason_summary,
    evidence_ref: null,
  });
}

// ── Persistence + signing ──────────────────────────────────────────────

async function persistReviewRecord(input: {
  readonly identity: AgentIdentity;
  readonly instance_id: string;
  readonly proposal_id: string;
  readonly cap_id: string | null;
  readonly mission_id: string | null;
  readonly nex1_context_id: string | null;
  readonly verdict: Nex2Verdict;
  readonly findings: readonly Nex2Finding[];
  readonly reason_summary: string;
  readonly evidence_ref: string | null;
}): Promise<Nex2ReviewRecord> {
  const base = {
    record_type: "NEX2_REVIEW" as const,
    review_id: `REV-${input.identity.agent_id}-${randomUUID()}`,
    proposal_id: input.proposal_id,
    cap_id: input.cap_id,
    mission_id: input.mission_id,
    nex1_context_id: input.nex1_context_id,
    reviewed_by_agent_id: input.identity.agent_id,
    reviewed_by_instance_id: input.instance_id,
    reviewed_by_public_key_der_hex: input.identity.public_key_der_hex,
    reviewed_at: new Date().toISOString(),
    verdict: input.verdict,
    findings: Object.freeze([...input.findings]) as readonly Nex2Finding[],
    reason_summary: input.reason_summary,
    evidence_ref: input.evidence_ref,
  };
  const sig = ed25519Sign(null, canonicaliseReview(base), input.identity.private).toString("hex");
  const record: Nex2ReviewRecord = { ...base, signature_hex: sig };
  await getStorage().save(NEX2_REVIEW_COLLECTION, record);
  return record;
}

// ── Read helpers ───────────────────────────────────────────────────────

export async function loadReviewsForProposal(proposal_id: string, limit = 20): Promise<Nex2ReviewRecord[]> {
  return getStorage().query<Nex2ReviewRecord>(NEX2_REVIEW_COLLECTION, {
    where: { proposal_id }, limit, order_by: "reviewed_at", order_dir: "desc",
  }).catch(() => [] as Nex2ReviewRecord[]);
}

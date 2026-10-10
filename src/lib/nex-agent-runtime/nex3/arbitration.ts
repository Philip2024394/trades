// WO-NEX-RUNTIME-05 · NEX3 evidence-based arbitration.
//
// Founder-locked 2026-09-13. NEX3 does NOT vote-count between NEX1 and
// NEX2. It runs its own signal-based reasoning:
//   - Severity-weighted evaluation of NEX2's findings
//   - Evidence-quality scoring of NEX1's chain
//   - Risk-asymmetry rule for security-critical CAPs
//
// If NEX3 arrived at the exact same conclusion as NEX2 via a different
// mechanism, that is legitimate independence · they can agree so long
// as they reach the agreement independently. Same wire-verdict does
// NOT mean "same reasoning".

import { randomUUID, sign as ed25519Sign, createPublicKey, verify as ed25519Verify } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import type { AgentIdentity } from "@/lib/nex-agent-runtime/process/identity";
import { loadCap } from "@/lib/nex-cap/registry";
import { loadAllProposals, type CapEngineeringProposal } from "@/lib/nex-cap/nex1-engineer";
import { loadReviewsForProposal } from "@/lib/nex-agent-runtime/nex2/review";
import { loadMissionContextChain } from "@/lib/nex-agent-runtime/nex1/mission-context";
import type { CapabilityGap } from "@/lib/nex-cap/types";
import type { Nex2ReviewRecord } from "@/lib/nex-agent-runtime/nex2/types";
import type { MissionContextChain } from "@/lib/nex-agent-runtime/nex1/types";
import {
  type Nex3Verdict,
  type Nex3ArbitrationSignal,
  type Nex3ArbitrationRecord,
  NEX3_ARBITRATION_COLLECTION,
  NEX3_SECURITY_CRITICAL_CAP_KINDS,
} from "./types";

// ── Canonical serialisation ────────────────────────────────────────────

function canonicaliseArbitration(rec: Omit<Nex3ArbitrationRecord, "signature_hex">): Buffer {
  const ordered = {
    record_type: rec.record_type,
    arbitration_id: rec.arbitration_id,
    proposal_id: rec.proposal_id,
    cap_id: rec.cap_id,
    nex2_review_id: rec.nex2_review_id,
    nex1_context_id: rec.nex1_context_id,
    arbitrated_by_agent_id: rec.arbitrated_by_agent_id,
    arbitrated_by_instance_id: rec.arbitrated_by_instance_id,
    arbitrated_by_public_key_der_hex: rec.arbitrated_by_public_key_der_hex,
    arbitrated_at: rec.arbitrated_at,
    verdict: rec.verdict,
    signals: rec.signals.map((s) => ({ kind: s.kind, polarity: s.polarity, weight: s.weight, detail: s.detail, evidence_ref: s.evidence_ref })),
    reject_score: rec.reject_score,
    allow_score: rec.allow_score,
    reason_summary: rec.reason_summary,
  };
  return Buffer.from(JSON.stringify(ordered), "utf8");
}

export function verifyNex3Arbitration(publicKeyDerHex: string, record: Nex3ArbitrationRecord): boolean {
  try {
    const { signature_hex: _drop, ...base } = record;
    void _drop;
    const pub = createPublicKey({ key: Buffer.from(publicKeyDerHex, "hex"), format: "der", type: "spki" });
    return ed25519Verify(null, canonicaliseArbitration(base), pub, Buffer.from(record.signature_hex, "hex"));
  } catch { return false; }
}

// ── Pure arbitration · deterministic ───────────────────────────────────

export interface Nex3ArbitrationInput {
  readonly proposal: CapEngineeringProposal;
  readonly cap: CapabilityGap | null;
  readonly nex2_review: Nex2ReviewRecord | null;
  readonly nex1_context: MissionContextChain | null;
}

export interface Nex3ArbitrationComputation {
  readonly verdict: Nex3Verdict;
  readonly signals: readonly Nex3ArbitrationSignal[];
  readonly reject_score: number;
  readonly allow_score: number;
  readonly reason_summary: string;
}

/**
 * Deterministic arbitration. Same input → same verdict.
 *
 * NEX3 is only invoked when NEX1 has drafted a proposal AND NEX2 has
 * rejected/conflicted. If those preconditions aren't met, arbitration
 * returns INSUFFICIENT_INPUT.
 */
export function nex3ArbitrationCompute(input: Nex3ArbitrationInput): Nex3ArbitrationComputation {
  const signals: Nex3ArbitrationSignal[] = [];

  // ── Precondition: we need a proposal AND a NEX2 review ───────────────
  if (!input.nex2_review) {
    signals.push({
      kind: "unrepeatable_review_input",
      polarity: "gate_escalate",
      weight: 0,
      detail: "no NEX2 review record found · arbitrator has nothing to arbitrate against",
      evidence_ref: input.proposal.proposal_id,
    });
    return { verdict: "INSUFFICIENT_INPUT", signals: Object.freeze([...signals]), reject_score: 0, allow_score: 0,
      reason_summary: `NEX3 cannot arbitrate proposal ${input.proposal.proposal_id.slice(0, 24)}… without a NEX2 review record` };
  }

  const review = input.nex2_review;

  // If NEX2 already INDEPENDENTLY_VERIFIED, there is no conflict to arbitrate
  if (review.verdict === "INDEPENDENTLY_VERIFIED") {
    return {
      verdict: "INSUFFICIENT_INPUT",
      signals: [{ kind: "unrepeatable_review_input", polarity: "gate_escalate", weight: 0,
        detail: `NEX2 already INDEPENDENTLY_VERIFIED · no conflict exists for NEX3 to arbitrate`,
        evidence_ref: review.review_id }],
      reject_score: 0, allow_score: 0,
      reason_summary: "no NEX1/NEX2 conflict · NEX3 arbitration not required",
    };
  }

  // ── Signal 1 · severity-weighted count of NEX2 findings ──────────────
  const critical = review.findings.filter((f) => f.severity === "critical");
  const high = review.findings.filter((f) => f.severity === "high");
  const medium = review.findings.filter((f) => f.severity === "medium");

  if (critical.length > 0) {
    signals.push({
      kind: "nex2_critical_finding_present",
      polarity: "supports_reject",
      weight: 100 * critical.length,
      detail: `${critical.length} critical finding(s): ${critical.map((f) => f.kind).join(", ")}`,
      evidence_ref: review.review_id,
    });
  }
  for (const h of high) {
    if (h.kind === "empty_evidence_chain" || h.kind === "diagnosis_absent" || h.kind === "fix_summary_absent" || h.kind === "cap_status_terminal") {
      signals.push({
        kind: h.kind === "diagnosis_absent" || h.kind === "fix_summary_absent" ? "nex2_high_finding_diagnosis_gap" : "nex2_high_finding_evidence_gap",
        polarity: "supports_reject",
        weight: 25,
        detail: `NEX2 high finding: ${h.kind} · ${h.detail}`,
        evidence_ref: review.review_id,
      });
    }
  }
  if (medium.length > 0 && critical.length === 0 && high.length === 0) {
    // If ALL NEX2 findings are procedural mediums (e.g. chain-integrity),
    // arbitrator gives NEX1 the benefit of the doubt · these findings
    // often reflect a missing chain rather than an unsafe proposal.
    signals.push({
      kind: "nex2_medium_findings_only",
      polarity: "supports_allow",
      weight: 10,
      detail: `NEX2 raised only ${medium.length} medium-severity finding(s) · procedural not substantive`,
      evidence_ref: review.review_id,
    });
  }

  // ── Signal 2 · evidence-quality score of NEX1's chain ────────────────
  if (input.nex1_context) {
    const ctx = input.nex1_context;
    const complete = ctx.observations.length > 0 && ctx.analysis.length > 0 && ctx.evidence_refs.length > 0 && ctx.proposed_solution !== null;
    signals.push({
      kind: complete ? "nex1_chain_complete" : "nex1_chain_incomplete",
      polarity: complete ? "supports_allow" : "supports_reject",
      weight: complete ? 20 : 15,
      detail: complete
        ? `NEX1 chain complete: obs=${ctx.observations.length} · analysis=${ctx.analysis.length} · evidence=${ctx.evidence_refs.length} · proposed_solution set`
        : `NEX1 chain incomplete · obs=${ctx.observations.length} · analysis=${ctx.analysis.length} · evidence=${ctx.evidence_refs.length} · proposed_solution=${ctx.proposed_solution ? "set" : "null"}`,
      evidence_ref: ctx.context_id,
    });
  } else {
    signals.push({
      kind: "nex1_chain_incomplete",
      polarity: "supports_reject",
      weight: 15,
      detail: "no NEX1 mission-context chain available · reasoning trace missing",
      evidence_ref: null,
    });
  }

  // ── Signal 3 · CAP shape ─────────────────────────────────────────────
  if (input.cap) {
    if (input.cap.priority === "CRITICAL") {
      signals.push({
        kind: "cap_priority_critical",
        polarity: "informational",
        weight: 0,
        detail: `CAP priority=${input.cap.priority} · risk-asymmetry rule may apply`,
        evidence_ref: input.cap.cap_id,
      });
    }
    if (input.cap.category === "SECURITY") {
      signals.push({
        kind: "cap_security_sensitive",
        polarity: "informational",
        weight: 0,
        detail: `CAP category=${input.cap.category} · scrutiny threshold raised`,
        evidence_ref: input.cap.cap_id,
      });
    }
  }
  // Evidence chain length signal
  const evLen = input.proposal.evidence_chain.length;
  signals.push({
    kind: "evidence_chain_length",
    polarity: evLen >= 2 ? "supports_allow" : "informational",
    weight: evLen >= 2 ? 5 : 0,
    detail: `proposal.evidence_chain length = ${evLen}`,
    evidence_ref: input.proposal.proposal_id,
  });

  // Deterministic-template-match
  if (input.cap) {
    const known = new Set([
      "guardian.te.evidence_source_unregistered",
      "rate_limiter.persistent_backoff",
      "intelligence.growth_stalled",
    ]);
    if (known.has(input.cap.kind)) {
      signals.push({
        kind: "deterministic_template_match",
        polarity: "supports_allow",
        weight: 10,
        detail: `CAP kind ${input.cap.kind} has a deterministic resolver template`,
        evidence_ref: input.cap.cap_id,
      });
    }
  }

  // ── Risk-asymmetry gate (founder-locked) ─────────────────────────────
  //  If CAP kind is security-critical AND NEX2 raised any critical finding,
  //  NEX3 MUST REJECT regardless of other signals. This is a HARD gate.
  const secGate = input.cap && NEX3_SECURITY_CRITICAL_CAP_KINDS.has(input.cap.kind) && critical.length > 0;
  if (secGate) {
    signals.push({
      kind: "risk_asymmetry_reject",
      polarity: "gate_reject",
      weight: 10_000,
      detail: `RISK-ASYMMETRY GATE: security-critical CAP kind ${input.cap!.kind} + ${critical.length} critical finding(s) · MUST reject`,
      evidence_ref: input.cap!.cap_id,
    });
  }

  // ── Verdict derivation ───────────────────────────────────────────────
  const reject_score = signals.filter((s) => s.polarity === "supports_reject" || s.polarity === "gate_reject").reduce((a, s) => a + s.weight, 0);
  const allow_score = signals.filter((s) => s.polarity === "supports_allow").reduce((a, s) => a + s.weight, 0);

  let verdict: Nex3Verdict;
  if (secGate) {
    verdict = "REJECT";
  } else if (reject_score === 0 && allow_score > 0) {
    verdict = "ALLOW";
  } else if (reject_score > 0 && allow_score === 0) {
    verdict = "REJECT";
  } else if (reject_score >= allow_score * 3) {
    // Clear reject dominance
    verdict = "REJECT";
  } else if (allow_score >= reject_score * 3) {
    // Clear allow dominance
    verdict = "ALLOW";
  } else {
    // Genuinely ambiguous · founder-only
    verdict = "ESCALATE_TO_FOUNDER";
  }

  const reason_summary = `NEX3 verdict ${verdict} · reject_score=${reject_score} · allow_score=${allow_score} · ${signals.length} signal(s) evaluated · NEX2 findings: ${critical.length}c/${high.length}h/${medium.length}m` +
    (secGate ? " · RISK-ASYMMETRY GATE tripped" : "");

  return { verdict, signals: Object.freeze([...signals]) as readonly Nex3ArbitrationSignal[], reject_score, allow_score, reason_summary };
}

// ── High-level API · arbitrate a proposal by id ────────────────────────

export interface Nex3ArbitrateProposalInput {
  readonly identity: AgentIdentity;
  readonly instance_id: string;
  readonly proposal_id: string;
  readonly mission_id?: string | null;
}

export async function nex3ArbitrateProposal(input: Nex3ArbitrateProposalInput): Promise<Nex3ArbitrationRecord> {
  const proposals = await loadAllProposals();
  const proposal = proposals.find((p) => p.proposal_id === input.proposal_id);
  if (!proposal) {
    return persistArbitration({
      identity: input.identity, instance_id: input.instance_id,
      proposal_id: input.proposal_id, cap_id: null,
      nex2_review_id: null, nex1_context_id: null,
      verdict: "INSUFFICIENT_INPUT",
      signals: [{ kind: "unrepeatable_review_input", polarity: "gate_escalate", weight: 0,
        detail: `proposal ${input.proposal_id} not found`, evidence_ref: null }],
      reject_score: 0, allow_score: 0,
      reason_summary: `proposal ${input.proposal_id} not found · NEX3 cannot arbitrate`,
    });
  }
  const cap = await loadCap(proposal.cap_id).catch(() => null);
  const nex2Reviews = await loadReviewsForProposal(proposal.proposal_id).catch(() => []);
  // Pick the newest NEX2 review that produced a non-VERIFIED verdict; that's the conflict.
  const nex2_review = nex2Reviews.find((r) => r.verdict !== "INDEPENDENTLY_VERIFIED") ?? nex2Reviews[0] ?? null;
  const nex1_context = input.mission_id ? await loadMissionContextChain(input.mission_id).catch(() => null) : null;

  const comp = nex3ArbitrationCompute({ proposal, cap, nex2_review, nex1_context });
  return persistArbitration({
    identity: input.identity, instance_id: input.instance_id,
    proposal_id: proposal.proposal_id, cap_id: proposal.cap_id,
    nex2_review_id: nex2_review?.review_id ?? null,
    nex1_context_id: nex1_context?.context_id ?? null,
    verdict: comp.verdict, signals: comp.signals,
    reject_score: comp.reject_score, allow_score: comp.allow_score,
    reason_summary: comp.reason_summary,
  });
}

async function persistArbitration(input: {
  readonly identity: AgentIdentity;
  readonly instance_id: string;
  readonly proposal_id: string;
  readonly cap_id: string | null;
  readonly nex2_review_id: string | null;
  readonly nex1_context_id: string | null;
  readonly verdict: Nex3Verdict;
  readonly signals: readonly Nex3ArbitrationSignal[];
  readonly reject_score: number;
  readonly allow_score: number;
  readonly reason_summary: string;
}): Promise<Nex3ArbitrationRecord> {
  const base = {
    record_type: "NEX3_ARBITRATION" as const,
    arbitration_id: `ARB-${input.identity.agent_id}-${randomUUID()}`,
    proposal_id: input.proposal_id,
    cap_id: input.cap_id,
    nex2_review_id: input.nex2_review_id,
    nex1_context_id: input.nex1_context_id,
    arbitrated_by_agent_id: input.identity.agent_id,
    arbitrated_by_instance_id: input.instance_id,
    arbitrated_by_public_key_der_hex: input.identity.public_key_der_hex,
    arbitrated_at: new Date().toISOString(),
    verdict: input.verdict,
    signals: Object.freeze([...input.signals]) as readonly Nex3ArbitrationSignal[],
    reject_score: input.reject_score,
    allow_score: input.allow_score,
    reason_summary: input.reason_summary,
  };
  const sig = ed25519Sign(null, canonicaliseArbitration(base), input.identity.private).toString("hex");
  const record: Nex3ArbitrationRecord = { ...base, signature_hex: sig };
  await getStorage().save(NEX3_ARBITRATION_COLLECTION, record);
  return record;
}

// ── Read helpers ───────────────────────────────────────────────────────

export async function loadArbitrationsForProposal(proposal_id: string, limit = 20): Promise<Nex3ArbitrationRecord[]> {
  return getStorage().query<Nex3ArbitrationRecord>(NEX3_ARBITRATION_COLLECTION, {
    where: { proposal_id }, limit, order_by: "arbitrated_at", order_dir: "desc",
  }).catch(() => [] as Nex3ArbitrationRecord[]);
}

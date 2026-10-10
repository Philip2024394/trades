// §36-S-4 · WAVE-S4 · 2026-09-14 · improvement-intelligence
//
// Pure function · zero I/O. Consumes verified S1 + S2 + S3 records and produces
// a deterministic structured improvement-proposal list. Never implements
// proposals. Never invokes primitives. Never grants itself authority.
//
// Boundary (verbatim · unamendable):
//   "Wave S4 enables NEX1 to interpret S1+S2+S3 records into a deterministic
//    list of structured improvement proposals with evidence citations,
//    confidence categories, and rollback considerations. It does not permit
//    NEX1 to implement any proposal, modify any file, invoke any primitive,
//    expand authoring vocabulary, infer proposal priority beyond deterministic
//    rules, or grant itself authority."

import { createHash } from "node:crypto";
import type { EvidenceCollectionSuccess } from "./evidence-collector-types";
import type { CapabilityHealthSuccess } from "./health-model-types";
import type { FailureIntelligenceSuccess, FailureRecord } from "./failure-intelligence-types";
import {
  FAILURE_CLASS_TO_PROPOSAL,
  II_MAX_OUTPUT_BYTES,
  type ImprovementIntelligenceFailure,
  type ImprovementIntelligenceRefusalCode,
  type ImprovementIntelligenceRequest,
  type ImprovementIntelligenceResult,
  type ImprovementIntelligenceSuccess,
  type ImprovementProposal,
} from "./improvement-intelligence-types";

function fail(
  code: ImprovementIntelligenceRefusalCode,
  reason: string,
  offendingField?: string,
): ImprovementIntelligenceFailure {
  return offendingField !== undefined
    ? { ok: false, refusal_code: code, reason, offending_field: offendingField }
    : { ok: false, refusal_code: code, reason };
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function validate(request: ImprovementIntelligenceRequest): ImprovementIntelligenceFailure | null {
  if (!request || typeof request !== "object") return fail("II_INVALID_REQUEST", "request must be an object");
  const r1 = request.s1_record;
  if (!r1 || typeof r1 !== "object" || (r1 as { ok?: unknown }).ok !== true) {
    return fail("II_INVALID_S1_RECORD", "s1_record.ok must be true");
  }
  if (typeof r1.evidence_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(r1.evidence_sha256)) {
    return fail("II_INVALID_S1_RECORD", "s1_record.evidence_sha256 invalid");
  }
  const r2 = request.s2_record;
  if (!r2 || typeof r2 !== "object" || (r2 as { ok?: unknown }).ok !== true) {
    return fail("II_INVALID_S2_RECORD", "s2_record.ok must be true");
  }
  if (typeof r2.health_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(r2.health_sha256)) {
    return fail("II_INVALID_S2_RECORD", "s2_record.health_sha256 invalid");
  }
  const r3 = request.s3_record;
  if (!r3 || typeof r3 !== "object" || (r3 as { ok?: unknown }).ok !== true) {
    return fail("II_INVALID_S3_RECORD", "s3_record.ok must be true");
  }
  if (typeof r3.failure_intelligence_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(r3.failure_intelligence_sha256)) {
    return fail("II_INVALID_S3_RECORD", "s3_record.failure_intelligence_sha256 invalid");
  }
  // Chain check: S2 must cite S1's SHA; S3 must cite both S1's and S2's SHAs.
  if (r2.s1_evidence_sha256_verified !== r1.evidence_sha256) {
    return fail("II_CHAIN_SHA_MISMATCH", "s2_record was assessed against a different S1 record");
  }
  if (r3.s1_evidence_sha256_verified !== r1.evidence_sha256) {
    return fail("II_CHAIN_SHA_MISMATCH", "s3_record was assessed against a different S1 record");
  }
  if (r3.s2_health_sha256_verified !== r2.health_sha256) {
    return fail("II_CHAIN_SHA_MISMATCH", "s3_record was assessed against a different S2 record");
  }
  return null;
}

function failureRecordCitation(f: FailureRecord): string {
  return `s3.failures[wave=${f.wave_slug}, class=${f.failure_class}]`;
}

export function proposeImprovements(request: ImprovementIntelligenceRequest): ImprovementIntelligenceResult {
  const check = validate(request);
  if (check) return check;

  const r1 = request.s1_record;
  const r2 = request.s2_record;
  const r3 = request.s3_record;
  const clock = request.clock ?? (() => new Date());
  const now = clock();

  const proposals: ImprovementProposal[] = [];
  for (const f of r3.failures) {
    const entry = FAILURE_CLASS_TO_PROPOSAL[f.failure_class];
    if (!entry) continue; // unreachable · exhaustive
    proposals.push({
      proposal_kind: entry.proposal_kind,
      derived_from_failure_class: f.failure_class,
      wave_slug: f.wave_slug,
      evidence_citations: Object.freeze([failureRecordCitation(f)]),
      confidence: entry.confidence,
      expected_benefit_summary: entry.expected_benefit_summary,
      affected_capability_summary: `wave '${f.wave_slug}' · failure class '${f.failure_class}'`,
      dependencies: [],
      validation_requirement: entry.confidence === "not_derivable"
        ? "founder-authorised execution of the underlying plan"
        : "S1 re-run must show the associated gap note absent",
      rollback_consideration: entry.rollback,
    });
  }

  // Deterministic sort: (wave_slug, proposal_kind, derived_from_failure_class)
  proposals.sort((a, b) => {
    if (a.wave_slug !== b.wave_slug) return a.wave_slug < b.wave_slug ? -1 : 1;
    if (a.proposal_kind !== b.proposal_kind) return a.proposal_kind < b.proposal_kind ? -1 : 1;
    return a.derived_from_failure_class < b.derived_from_failure_class ? -1 : a.derived_from_failure_class > b.derived_from_failure_class ? 1 : 0;
  });

  const canonical = JSON.stringify({
    s1_evidence_sha256_verified: r1.evidence_sha256,
    s2_health_sha256_verified: r2.health_sha256,
    s3_failure_intelligence_sha256_verified: r3.failure_intelligence_sha256,
    proposals,
  });
  const iiSha = sha256Hex(canonical);

  const success: ImprovementIntelligenceSuccess = {
    ok: true,
    assessed_at: now.toISOString(),
    s1_evidence_sha256_verified: r1.evidence_sha256,
    s2_health_sha256_verified: r2.health_sha256,
    s3_failure_intelligence_sha256_verified: r3.failure_intelligence_sha256,
    proposals: Object.freeze(proposals),
    improvement_intelligence_sha256: iiSha,
  };

  const size = Buffer.byteLength(canonical, "utf8") + iiSha.length + 128;
  if (size > II_MAX_OUTPUT_BYTES) {
    return fail("II_OUTPUT_TOO_LARGE", `assembled output ${size} bytes > ${II_MAX_OUTPUT_BYTES}`);
  }

  return success;
}

export type {
  ImprovementIntelligenceFailure,
  ImprovementIntelligenceRefusalCode,
  ImprovementIntelligenceRequest,
  ImprovementIntelligenceResult,
  ImprovementIntelligenceSuccess,
  ImprovementProposal,
  ImprovementProposalKind,
  ProposalConfidence,
} from "./improvement-intelligence-types";

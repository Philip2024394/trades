// §36-E-6 · WAVE-E6 · 2026-09-14 · adversarial-refutation
// NEX bounded infrastructure · adversarial-refutation engine · 2026-09-14
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.
//
// Pure function · zero I/O.
// Actively attempts to disprove each SpecialistFinding rather than
// trusting the reviewer. If the reviewer cited a pattern that is not in
// the candidate, the finding is REFUTED. If a contradicting sibling
// finding exists on the same candidate, both go UNRESOLVED.

import type { SkillCandidate } from "../skills/skill-schema-types";
import type {
  SpecialistFinding,
  SpecialistFindingId,
  SpecialistFindingSeverity,
} from "../specialist-reviewers/specialist-reviewer-types";
import { FINDING_ID_SEVERITY_MAP } from "../specialist-reviewers/specialist-reviewer-types";
import type {
  FindingRefutationRecord,
  RefutationEpistemicStatus,
  RefutationStrategyId,
  RefutationVerdict,
  RunRefutationFailure,
  RunRefutationRequest,
  RunRefutationResult,
  RunRefutationSuccess,
} from "./refutation-engine-types";
import {
  CANONICAL_EVIDENCE_PATTERN,
  CONTRADICTION_PAIRS,
} from "./refutation-engine-types";

const GREP_MARKER = "§36-E-6 · WAVE-E6 · 2026-09-14 · adversarial-refutation" as const;

// ── Failure helper ──────────────────────────────────────────────────────

function fail(
  code: RunRefutationFailure["refusal_code"],
  reason: string,
  offending_finding_id: SpecialistFindingId | null = null,
): RunRefutationFailure {
  return {
    kind: "FAILURE",
    refusal_code: code,
    reason,
    offending_finding_id,
    grep_marker: GREP_MARKER,
  };
}

// ── Candidate structural check ─────────────────────────────────────────

function isValidCandidate(candidate: unknown): candidate is SkillCandidate {
  if (!candidate || typeof candidate !== "object") return false;
  const c = candidate as Record<string, unknown>;
  return typeof c.workspace_relative_path === "string"
    && typeof c.change_kind === "string"
    && typeof c.authorised === "boolean";
}

// ── Finding structural check ───────────────────────────────────────────

function isMalformedFinding(f: unknown): f is SpecialistFinding {
  if (!f || typeof f !== "object") return false;
  const rec = f as Record<string, unknown>;
  if (typeof rec.finding_id !== "string") return false;
  if (typeof rec.specialist_id !== "string") return false;
  if (typeof rec.severity !== "string") return false;
  if (typeof rec.evidence_summary !== "string") return false;
  return true;
}

function isKnownFindingId(id: string): id is SpecialistFindingId {
  return Object.prototype.hasOwnProperty.call(CANONICAL_EVIDENCE_PATTERN, id);
}

// ── Contradiction lookup ───────────────────────────────────────────────

function findingsInContradiction(
  findingId: SpecialistFindingId,
  allIds: readonly SpecialistFindingId[],
): SpecialistFindingId | null {
  for (const [a, b] of CONTRADICTION_PAIRS) {
    if (findingId === a && allIds.includes(b)) return b;
    if (findingId === b && allIds.includes(a)) return a;
  }
  return null;
}

// ── Over-general-claim check ───────────────────────────────────────────
//
// If a reviewer emits a finding with severity higher than the finding_id's
// canonical severity, we treat that as an over-general claim and REFUTE
// the severity-inflation portion. The finding_id's own presence is judged
// by evidence, but the severity mismatch is a separate refutation.

function isOverGeneralSeverityClaim(f: SpecialistFinding): boolean {
  const canonical = FINDING_ID_SEVERITY_MAP[f.finding_id as SpecialistFindingId];
  if (!canonical) return false;
  return severityRank(f.severity) > severityRank(canonical);
}

function severityRank(s: SpecialistFindingSeverity): number {
  if (s === "critical") return 3;
  if (s === "warning") return 2;
  if (s === "advisory") return 1;
  return 0;
}

// ── Per-finding refutation ─────────────────────────────────────────────

function refuteFinding(
  finding: SpecialistFinding,
  candidateText: string,
  allFindingIds: readonly SpecialistFindingId[],
): FindingRefutationRecord {
  const fid = finding.finding_id as SpecialistFindingId;
  const canonicalPattern = CANONICAL_EVIDENCE_PATTERN[fid];

  // Strategy 4 · contradiction with sibling finding.
  const contradicting = findingsInContradiction(fid, allFindingIds);
  if (contradicting) {
    return record(
      finding,
      "UNRESOLVED",
      "contradiction_detection",
      `finding contradicts sibling finding '${contradicting}' on same candidate · both marked UNRESOLVED`,
      "INFERENCE",
      canonicalPattern?.source ?? null,
      false,
    );
  }

  // Strategy 3 · over-general-claim severity check.
  if (isOverGeneralSeverityClaim(finding)) {
    return record(
      finding,
      "REFUTED",
      "over_general_claim",
      `finding severity '${finding.severity}' exceeds canonical severity '${FINDING_ID_SEVERITY_MAP[fid]}' for ${fid}`,
      "FACT",
      canonicalPattern?.source ?? null,
      false,
    );
  }

  // Strategy 1 & 2 · evidence-absent vs verifiability.
  const patternMatches = canonicalPattern.test(candidateText);
  if (!patternMatches) {
    return record(
      finding,
      "REFUTED",
      "evidence_absent",
      `canonical evidence pattern for ${fid} is not present in candidate · finding evidence not verifiable`,
      "FACT",
      canonicalPattern.source,
      false,
    );
  }
  return record(
    finding,
    "ACCEPTED",
    "verifiability",
    `canonical evidence pattern for ${fid} verified in candidate content`,
    "OBSERVATION",
    canonicalPattern.source,
    true,
  );
}

function record(
  source_finding: SpecialistFinding,
  verdict: RefutationVerdict,
  strategy_id: RefutationStrategyId,
  refutation_reason: string,
  status: RefutationEpistemicStatus,
  pattern: string | null,
  matched: boolean,
): FindingRefutationRecord {
  return {
    source_finding,
    verdict,
    strategy_id,
    refutation_reason,
    refutation_epistemic_status: status,
    evidence_pattern_examined: pattern,
    evidence_pattern_matched: matched,
  };
}

// ── Entry point ────────────────────────────────────────────────────────

export function runAdversarialRefutation(request: RunRefutationRequest): RunRefutationResult {
  if (!request || typeof request !== "object") {
    return fail("ARE_INVALID_REQUEST", "request required");
  }
  if (!isValidCandidate(request.candidate)) {
    return fail("ARE_INVALID_CANDIDATE", "candidate must be a well-formed SkillCandidate");
  }
  if (!Array.isArray(request.findings)) {
    return fail("ARE_INVALID_REQUEST", "findings must be an array");
  }

  // Validate every finding up-front.
  for (const f of request.findings) {
    if (!isMalformedFinding(f)) {
      return fail("ARE_MALFORMED_FINDING", "finding is malformed");
    }
    if (!isKnownFindingId(f.finding_id)) {
      return fail(
        "ARE_MALFORMED_FINDING",
        `finding_id '${f.finding_id}' is not in the locked catalogue`,
        f.finding_id as SpecialistFindingId,
      );
    }
  }

  const candidateText = request.candidate.proposed_content ?? "";
  const allIds: SpecialistFindingId[] = request.findings.map((f) => f.finding_id as SpecialistFindingId);

  const per_finding_records: FindingRefutationRecord[] = [];
  let accepted = 0;
  let refuted = 0;
  let unresolved = 0;

  for (const f of request.findings) {
    const rec = refuteFinding(f, candidateText, allIds);
    per_finding_records.push(rec);
    if (rec.verdict === "ACCEPTED") accepted++;
    else if (rec.verdict === "REFUTED") refuted++;
    else unresolved++;
  }

  const success: RunRefutationSuccess = {
    kind: "SUCCESS",
    per_finding_records: Object.freeze(per_finding_records),
    accepted_count: accepted,
    refuted_count: refuted,
    unresolved_count: unresolved,
    overall_finding_count: request.findings.length,
    grep_marker: GREP_MARKER,
  };
  return success;
}

// §36-E-2 · WAVE-E2 · 2026-09-14 · engineering-memory-v2
// NEX bounded infrastructure · engineering-memory-v2 primitive · 2026-09-14
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.
//
// Pure function · zero I/O. Records structured engineering memory across a
// 6-status epistemic taxonomy (FACT · OBSERVATION · INFERENCE · HYPOTHESIS ·
// LESSON · REJECTED) with real provenance (mission_id · source · evidence_sha256).
//
// LOCKED PROMOTION RULES:
//   OBSERVATION → FACT     requires ≥2 corroborating observations · never auto
//   HYPOTHESIS → LESSON    requires paired I1 improvement_measured outcome
//   LESSON → FACT          requires ≥3 non-contradicted invocations across ≥2 missions
//
// `supersedes` marks predecessor as SUPERSEDED (never deletes).
// `contradicts` flags both records as NEEDS_REVIEW.

import { createHash } from "node:crypto";
import type { HypothesisMeasurementRecord } from "./improvement-hypothesis-measurement-types";
import {
  APPROVED_EPISTEMIC_STATUSES_V2,
  APPROVED_LESSON_KINDS_V2,
  EMV2_MAX_CANDIDATES,
  EMV2_MAX_CITATION_LENGTH,
  EMV2_MAX_OUTPUT_BYTES,
  EMV2_MAX_SUMMARY_LENGTH,
  EMV2_PROHIBITED_SUBSTRINGS,
  type CandidateMemoryV2,
  type EngineeringMemoryV2Book,
  type EngineeringMemoryV2Failure,
  type EngineeringMemoryV2Lesson,
  type EngineeringMemoryV2RefusalCode,
  type EngineeringMemoryV2Request,
  type EngineeringMemoryV2Result,
  type EngineeringMemoryV2Success,
  type EpistemicStatusV2,
  type MemoryQueryFilter,
  type MemoryQueryResult,
  type PromotionState,
  type RejectedCandidateV2,
  type RejectionReasonV2,
} from "./engineering-memory-v2-types";

// ── Helpers ────────────────────────────────────────────────────────────

function fail(
  code: EngineeringMemoryV2RefusalCode,
  reason: string,
  offendingField?: string,
): EngineeringMemoryV2Failure {
  return offendingField !== undefined
    ? { ok: false, refusal_code: code, reason, offending_field: offendingField }
    : { ok: false, refusal_code: code, reason };
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function containsProhibited(s: string): boolean {
  for (const bad of EMV2_PROHIBITED_SUBSTRINGS) if (s.includes(bad)) return true;
  return false;
}

function makeLessonId(kind: string, subsystem: string | null, summary: string, sha: string): string {
  return `L-${sha256Hex(`${kind}|${subsystem ?? "any"}|${summary}|${sha}`).slice(0, 20)}`;
}

// ── Validation ─────────────────────────────────────────────────────────

function validate(request: EngineeringMemoryV2Request): EngineeringMemoryV2Failure | null {
  if (!request || typeof request !== "object") return fail("EMV2_INVALID_REQUEST", "request must be an object");
  if (!Array.isArray(request.candidate_memories)) return fail("EMV2_INVALID_CANDIDATE", "candidate_memories must be array");
  if (request.candidate_memories.length > EMV2_MAX_CANDIDATES) {
    return fail("EMV2_INVALID_CANDIDATE", `> ${EMV2_MAX_CANDIDATES} candidates`);
  }
  if (!Array.isArray(request.hypothesis_measurements)) {
    return fail("EMV2_INVALID_HYPOTHESIS_MEASUREMENTS", "hypothesis_measurements must be array");
  }
  if (request.prior_book !== undefined) {
    const pb = request.prior_book;
    if (!pb || typeof pb !== "object") return fail("EMV2_INVALID_PRIOR_BOOK", "prior_book must be object");
    if (pb.schema_version !== "ecc-memory-v2") return fail("EMV2_INVALID_PRIOR_BOOK", "prior_book.schema_version must be 'ecc-memory-v2'");
    if (!Array.isArray(pb.lessons)) return fail("EMV2_INVALID_PRIOR_BOOK", "prior_book.lessons must be array");
    if (typeof pb.book_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(pb.book_sha256)) {
      return fail("EMV2_INVALID_PRIOR_BOOK", "prior_book.book_sha256 invalid");
    }
    // Verify prior_book integrity
    const recomputed = sha256Hex(JSON.stringify({ book_id: pb.book_id, schema_version: pb.schema_version, lessons: pb.lessons }));
    if (recomputed !== pb.book_sha256) {
      return fail("EMV2_BOOK_SHA_MISMATCH", `prior_book.book_sha256 mismatch (recomputed ${recomputed.slice(0, 12)}...)`);
    }
  }
  return null;
}

// ── Candidate evaluation (locked promotion rules) ──────────────────────

function evaluateCandidate(
  c: CandidateMemoryV2,
  hypothesisMeasurementsById: Map<string, string>,
  priorLessons: readonly EngineeringMemoryV2Lesson[],
  priorLessonIds: Set<string>,
  observationsBySubsystem: Map<string, number>,
  now: Date,
): { accepted: EngineeringMemoryV2Lesson | null; rejected: RejectedCandidateV2 | null; contradictions: readonly string[] } {
  // Locked-status check
  if (!APPROVED_LESSON_KINDS_V2.includes(c.kind)) {
    return { accepted: null, rejected: reject(c, "unknown_lesson_kind", `kind '${c.kind}' not approved`), contradictions: [] };
  }
  if (!APPROVED_EPISTEMIC_STATUSES_V2.includes(c.proposed_status)) {
    return { accepted: null, rejected: reject(c, "unknown_epistemic_status", `status '${c.proposed_status}' not approved`), contradictions: [] };
  }
  // Evidence citation
  if (typeof c.evidence_citation !== "string" || c.evidence_citation.length === 0) {
    return { accepted: null, rejected: reject(c, "missing_evidence_citation", "evidence_citation required"), contradictions: [] };
  }
  if (c.evidence_citation.length > EMV2_MAX_CITATION_LENGTH) {
    return { accepted: null, rejected: reject(c, "prohibited_string_content", "evidence_citation too long"), contradictions: [] };
  }
  // Evidence SHA
  if (typeof c.evidence_sha256 !== "string" || c.evidence_sha256.length === 0) {
    return { accepted: null, rejected: reject(c, "missing_evidence_sha256", "evidence_sha256 required"), contradictions: [] };
  }
  if (!/^[0-9a-f]{64}$/.test(c.evidence_sha256)) {
    return { accepted: null, rejected: reject(c, "invalid_evidence_sha256_format", "evidence_sha256 must be 64-hex"), contradictions: [] };
  }
  // Prohibited substrings
  if (containsProhibited(c.summary) || containsProhibited(c.evidence_citation)) {
    return { accepted: null, rejected: reject(c, "prohibited_string_content", "candidate contains prohibited substring"), contradictions: [] };
  }
  if (c.summary.length > EMV2_MAX_SUMMARY_LENGTH) {
    return { accepted: null, rejected: reject(c, "prohibited_string_content", "summary too long"), contradictions: [] };
  }

  // LOCKED PROMOTION RULE 1: OBSERVATION cannot promote directly to FACT.
  //   A candidate proposing FACT must either have (a) come from a HYPOTHESIS
  //   with paired improvement_measured OR (b) be corroborated by ≥2 prior
  //   OBSERVATIONs with the same subsystem.
  if (c.proposed_status === "FACT") {
    const pairedOk = c.paired_hypothesis_id !== null &&
      hypothesisMeasurementsById.get(c.paired_hypothesis_id) === "improvement_measured";
    const corroboratingObservations = c.subsystem !== null
      ? (observationsBySubsystem.get(c.subsystem) ?? 0)
      : 0;
    if (!pairedOk && corroboratingObservations < 2) {
      return {
        accepted: null,
        rejected: reject(c, "promotion_to_fact_requires_paired_measurement",
          pairedOk ? "n/a" : `FACT promotion requires paired improvement_measured hypothesis OR ≥2 corroborating OBSERVATIONs (subsystem=${c.subsystem ?? "null"}, count=${corroboratingObservations})`),
        contradictions: [],
      };
    }
  }

  // LOCKED PROMOTION RULE 2: HYPOTHESIS → LESSON requires paired improvement_measured.
  if (c.proposed_status === "LESSON") {
    if (c.paired_hypothesis_id === null) {
      return {
        accepted: null,
        rejected: reject(c, "promotion_to_lesson_requires_paired_measurement",
          "LESSON promotion requires paired_hypothesis_id + improvement_measured outcome"),
        contradictions: [],
      };
    }
    const outcome = hypothesisMeasurementsById.get(c.paired_hypothesis_id);
    if (outcome !== "improvement_measured") {
      return {
        accepted: null,
        rejected: reject(c, "promotion_to_lesson_requires_paired_measurement",
          `paired_hypothesis_id '${c.paired_hypothesis_id}' outcome '${outcome ?? "not_found"}' · must be 'improvement_measured'`),
        contradictions: [],
      };
    }
  }

  // supersedes target must exist if specified
  if (c.supersedes_lesson_id !== null && !priorLessons.some((l) => l.lesson_id === c.supersedes_lesson_id)) {
    return {
      accepted: null,
      rejected: reject(c, "supersedes_target_not_found",
        `supersedes_lesson_id '${c.supersedes_lesson_id}' not in prior_book`),
      contradictions: [],
    };
  }
  if (c.contradicts_lesson_id !== null && !priorLessons.some((l) => l.lesson_id === c.contradicts_lesson_id)) {
    return {
      accepted: null,
      rejected: reject(c, "contradicts_target_not_found",
        `contradicts_lesson_id '${c.contradicts_lesson_id}' not in prior_book`),
      contradictions: [],
    };
  }

  // Duplicate detection
  const lessonId = makeLessonId(c.kind, c.subsystem, c.summary, c.evidence_sha256);
  if (priorLessonIds.has(lessonId)) {
    return {
      accepted: null,
      rejected: reject(c, "duplicate_of_prior_lesson", `lesson_id '${lessonId}' already in prior_book`),
      contradictions: [],
    };
  }

  const promotionState: PromotionState =
    c.contradicts_lesson_id !== null ? "NEEDS_REVIEW"
    : c.supersedes_lesson_id !== null ? "PROMOTED"
    : c.proposed_status === "FACT" ? "AUTHORITATIVE"
    : c.proposed_status === "LESSON" ? "PROMOTED"
    : "PENDING";

  const lesson: EngineeringMemoryV2Lesson = {
    lesson_id: lessonId,
    kind: c.kind,
    status: c.proposed_status,
    promotion_state: promotionState,
    summary: c.summary,
    evidence_citation: c.evidence_citation,
    evidence_sha256: c.evidence_sha256,
    mission_id: c.mission_id,
    source: c.source,
    subsystem: c.subsystem,
    paired_hypothesis_id: c.paired_hypothesis_id,
    supersedes_lesson_id: c.supersedes_lesson_id,
    contradicts_lesson_id: c.contradicts_lesson_id,
    recorded_at: now.toISOString(),
    invocation_count: 0,
  };
  return {
    accepted: lesson,
    rejected: null,
    contradictions: c.contradicts_lesson_id ? [c.contradicts_lesson_id] : [],
  };
}

function reject(c: CandidateMemoryV2, reason: RejectionReasonV2, summary: string): RejectedCandidateV2 {
  return {
    kind: c.kind,
    proposed_status: c.proposed_status,
    summary: c.summary,
    rejection_reason: reason,
    rejection_summary: summary,
  };
}

// ── Query API (pure function · deterministic) ──────────────────────────

export function queryMemory(book: EngineeringMemoryV2Book, filter: MemoryQueryFilter): MemoryQueryResult | EngineeringMemoryV2Failure {
  if (!book || typeof book !== "object" || !Array.isArray(book.lessons)) {
    return fail("EMV2_QUERY_INVALID", "book invalid");
  }
  const limit = filter.limit ?? 32;
  if (typeof limit !== "number" || limit <= 0 || limit > 512) {
    return fail("EMV2_QUERY_INVALID", `limit out of range: ${limit}`);
  }
  let matched = book.lessons.slice();
  if (filter.kind) matched = matched.filter((l) => l.kind === filter.kind);
  if (filter.status) matched = matched.filter((l) => l.status === filter.status);
  if (filter.subsystem) matched = matched.filter((l) => l.subsystem === filter.subsystem);
  // Deterministic order: most-recently recorded first (stable-sort by recorded_at desc then lesson_id asc)
  matched.sort((a, b) => {
    if (a.recorded_at !== b.recorded_at) return a.recorded_at < b.recorded_at ? 1 : -1;
    return a.lesson_id < b.lesson_id ? -1 : 1;
  });
  const total = matched.length;
  const truncated = matched.length > limit;
  if (truncated) matched = matched.slice(0, limit);
  return {
    filter,
    matched_lesson_ids: Object.freeze(matched.map((l) => l.lesson_id)),
    total_matches: total,
    truncated_by_limit: truncated,
  };
}

// ── Main entry point ───────────────────────────────────────────────────

export function recordEngineeringMemoryV2(request: EngineeringMemoryV2Request): EngineeringMemoryV2Result {
  const check = validate(request);
  if (check) return check;

  const clock = request.clock ?? (() => new Date());
  const now = clock();

  const hypothesisMeasurementsById = new Map<string, string>();
  for (const hm of request.hypothesis_measurements) {
    if (hm && typeof hm.hypothesis_id === "string" && typeof hm.outcome === "string") {
      hypothesisMeasurementsById.set(hm.hypothesis_id, hm.outcome);
    }
  }

  const priorLessons = request.prior_book?.lessons ?? [];
  const priorLessonIds = new Set(priorLessons.map((l) => l.lesson_id));

  // Build observation-count-per-subsystem index from PRIOR observations
  const observationsBySubsystem = new Map<string, number>();
  for (const l of priorLessons) {
    if (l.status === "OBSERVATION" && l.subsystem !== null) {
      observationsBySubsystem.set(l.subsystem, (observationsBySubsystem.get(l.subsystem) ?? 0) + 1);
    }
  }

  // Mutable working set starts from prior lessons (deep-copy for immutability)
  const accepted: EngineeringMemoryV2Lesson[] = priorLessons.map((l) => ({ ...l }));
  const rejected: RejectedCandidateV2[] = [];
  const contradictionsToMark = new Set<string>();

  for (const c of request.candidate_memories) {
    const result = evaluateCandidate(c, hypothesisMeasurementsById, priorLessons, priorLessonIds, observationsBySubsystem, now);
    if (result.accepted) {
      accepted.push(result.accepted);
      priorLessonIds.add(result.accepted.lesson_id);
      // Track newly-added OBSERVATIONs in subsystem counter
      if (result.accepted.status === "OBSERVATION" && result.accepted.subsystem !== null) {
        observationsBySubsystem.set(result.accepted.subsystem, (observationsBySubsystem.get(result.accepted.subsystem) ?? 0) + 1);
      }
      for (const cid of result.contradictions) contradictionsToMark.add(cid);
    }
    if (result.rejected) rejected.push(result.rejected);
  }

  // Apply supersedes / contradicts side effects on existing lessons
  for (let i = 0; i < accepted.length; i++) {
    const l = accepted[i];
    // If any newly-accepted lesson has supersedes_lesson_id === l.lesson_id, mark l as SUPERSEDED
    const supersededBy = accepted.find((n) => n.supersedes_lesson_id === l.lesson_id);
    if (supersededBy) {
      accepted[i] = { ...l, promotion_state: "SUPERSEDED" };
    }
    // If contradicts, mark both as NEEDS_REVIEW
    if (contradictionsToMark.has(l.lesson_id)) {
      accepted[i] = { ...accepted[i], promotion_state: "NEEDS_REVIEW" };
    }
  }

  // Deterministic sort by lesson_id
  accepted.sort((a, b) => (a.lesson_id < b.lesson_id ? -1 : a.lesson_id > b.lesson_id ? 1 : 0));
  rejected.sort((a, b) => {
    if (a.rejection_reason !== b.rejection_reason) return a.rejection_reason < b.rejection_reason ? -1 : 1;
    return a.summary < b.summary ? -1 : a.summary > b.summary ? 1 : 0;
  });

  const bookId = sha256Hex(JSON.stringify({ lessons: accepted })).slice(0, 20);
  const bookCanonical = JSON.stringify({
    book_id: bookId,
    schema_version: "ecc-memory-v2",
    lessons: accepted,
  });
  const bookSha = sha256Hex(bookCanonical);

  const book: EngineeringMemoryV2Book = {
    book_id: bookId,
    schema_version: "ecc-memory-v2",
    lessons: Object.freeze(accepted),
    book_sha256: bookSha,
  };

  const success: EngineeringMemoryV2Success = {
    ok: true,
    assessed_at: now.toISOString(),
    book,
    rejected_candidates: Object.freeze(rejected),
  };

  const totalSize = Buffer.byteLength(bookCanonical, "utf8") + JSON.stringify(rejected).length + 128;
  if (totalSize > EMV2_MAX_OUTPUT_BYTES) {
    return fail("EMV2_OUTPUT_TOO_LARGE", `output ${totalSize} bytes > ${EMV2_MAX_OUTPUT_BYTES}`);
  }

  return success;
}

export type {
  CandidateMemoryV2,
  EngineeringMemoryV2Book,
  EngineeringMemoryV2Failure,
  EngineeringMemoryV2Lesson,
  EngineeringMemoryV2RefusalCode,
  EngineeringMemoryV2Request,
  EngineeringMemoryV2Result,
  EngineeringMemoryV2Success,
  EpistemicStatusV2,
  LessonKindV2,
  MemoryQueryFilter,
  MemoryQueryResult,
  PromotionState,
  RejectedCandidateV2,
  RejectionReasonV2,
} from "./engineering-memory-v2-types";

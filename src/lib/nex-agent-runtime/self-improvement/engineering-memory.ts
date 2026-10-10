// §36-I-2 · WAVE-I2 · 2026-09-14 · engineering-memory
//
// Pure function · zero I/O. Records structured engineering lessons keyed by
// locked epistemic-status taxonomy (FACT / INFERENCE / HYPOTHESIS / REJECTED_IDEA).
//
// LOCKED PROMOTION RULE: promoting HYPOTHESIS → FACT requires a paired I1
// HypothesisMeasurementRecord whose outcome is `improvement_measured` AND whose
// hypothesis_id matches the candidate's paired_hypothesis_id.
//
// Never promotes automatically. Never fabricates evidence. Rejected candidates
// are recorded in `rejected_candidates` with structured reason · not silently dropped.

import { createHash } from "node:crypto";
import {
  APPROVED_EPISTEMIC_STATUSES,
  APPROVED_LESSON_KINDS,
  I2_MAX_CITATION_LENGTH,
  I2_MAX_LESSONS,
  I2_MAX_OUTPUT_BYTES,
  I2_MAX_SUMMARY_LENGTH,
  I2_PROHIBITED_SUBSTRINGS,
  type CandidateLesson,
  type EngineeringLesson,
  type EngineeringMemoryBook,
  type EngineeringMemoryFailure,
  type EngineeringMemoryRefusalCode,
  type EngineeringMemoryRequest,
  type EngineeringMemoryResult,
  type EngineeringMemorySuccess,
  type EpistemicStatus,
  type PromotionEvent,
  type RejectedCandidate,
  type RejectionReason,
} from "./engineering-memory-types";

// ── Helpers ────────────────────────────────────────────────────────────

function fail(
  code: EngineeringMemoryRefusalCode,
  reason: string,
  offendingField?: string,
): EngineeringMemoryFailure {
  return offendingField !== undefined
    ? { ok: false, refusal_code: code, reason, offending_field: offendingField }
    : { ok: false, refusal_code: code, reason };
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function containsProhibited(s: string): boolean {
  for (const bad of I2_PROHIBITED_SUBSTRINGS) if (s.includes(bad)) return true;
  return false;
}

function makeLessonId(kind: string, waveSlug: string | null, summary: string): string {
  const digest = sha256Hex(`${kind}|${waveSlug ?? "none"}|${summary}`).slice(0, 16);
  return `L-${digest}`;
}

// ── Validation ─────────────────────────────────────────────────────────

function validate(request: EngineeringMemoryRequest): EngineeringMemoryFailure | null {
  if (!request || typeof request !== "object") return fail("I2_INVALID_REQUEST", "request must be an object");
  if (!Array.isArray(request.candidate_lessons)) return fail("I2_INVALID_CANDIDATE_LESSON", "candidate_lessons must be array");
  if (request.candidate_lessons.length > I2_MAX_LESSONS) {
    return fail("I2_INVALID_CANDIDATE_LESSON", `too many candidate_lessons (${request.candidate_lessons.length} > ${I2_MAX_LESSONS})`);
  }
  if (!Array.isArray(request.hypothesis_measurements)) return fail("I2_INVALID_HYPOTHESIS_MEASUREMENTS", "hypothesis_measurements must be array");
  if (!Array.isArray(request.hypotheses)) return fail("I2_INVALID_HYPOTHESES", "hypotheses must be array");
  if (request.prior_book !== undefined) {
    if (!request.prior_book || typeof request.prior_book !== "object") return fail("I2_INVALID_PRIOR_BOOK", "prior_book must be object");
    if (typeof request.prior_book.book_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(request.prior_book.book_sha256)) {
      return fail("I2_INVALID_PRIOR_BOOK", "prior_book.book_sha256 invalid");
    }
    if (!Array.isArray(request.prior_book.lessons)) return fail("I2_INVALID_PRIOR_BOOK", "prior_book.lessons must be array");
  }
  return null;
}

// ── Candidate evaluation ───────────────────────────────────────────────

interface CandidateEvaluation {
  readonly accepted: EngineeringLesson | null;
  readonly rejected: RejectedCandidate | null;
}

function evaluateCandidate(
  c: CandidateLesson,
  hypothesisMeasurementsById: Map<string, string /* outcome */>,
  priorLessonIds: Set<string>,
  now: Date,
): CandidateEvaluation {
  // Rule: kind must be in approved set
  if (!APPROVED_LESSON_KINDS.includes(c.kind)) {
    return {
      accepted: null,
      rejected: {
        kind: c.kind,
        proposed_status: c.proposed_status,
        summary: c.summary,
        rejection_reason: "unknown_lesson_kind",
        rejection_summary: `kind '${c.kind}' not in approved set`,
      },
    };
  }
  // Rule: status must be in approved set
  if (!APPROVED_EPISTEMIC_STATUSES.includes(c.proposed_status)) {
    return {
      accepted: null,
      rejected: {
        kind: c.kind,
        proposed_status: c.proposed_status,
        summary: c.summary,
        rejection_reason: "unknown_epistemic_status",
        rejection_summary: `proposed_status '${c.proposed_status}' not in approved set`,
      },
    };
  }
  // Rule: evidence_citation must be non-empty
  if (typeof c.evidence_citation !== "string" || c.evidence_citation.length === 0) {
    return {
      accepted: null,
      rejected: {
        kind: c.kind,
        proposed_status: c.proposed_status,
        summary: c.summary,
        rejection_reason: "missing_evidence_citation",
        rejection_summary: "evidence_citation is required and must be non-empty",
      },
    };
  }
  // Rule: prohibited substring guard
  if (containsProhibited(c.summary) || containsProhibited(c.evidence_citation)) {
    return {
      accepted: null,
      rejected: {
        kind: c.kind,
        proposed_status: c.proposed_status,
        summary: c.summary,
        rejection_reason: "prohibited_string_content",
        rejection_summary: "candidate contains prohibited substring",
      },
    };
  }
  // Rule: LOCKED PROMOTION · FACT status requires paired improvement_measured hypothesis
  if (c.proposed_status === "FACT") {
    const measurement = c.paired_hypothesis_id !== null ? hypothesisMeasurementsById.get(c.paired_hypothesis_id) : undefined;
    if (measurement !== "improvement_measured") {
      return {
        accepted: null,
        rejected: {
          kind: c.kind,
          proposed_status: c.proposed_status,
          summary: c.summary,
          rejection_reason: "promotion_to_fact_requires_paired_improvement_measured_hypothesis",
          rejection_summary: c.paired_hypothesis_id === null
            ? "candidate proposes FACT status but no paired_hypothesis_id supplied"
            : `paired_hypothesis_id '${c.paired_hypothesis_id}' has outcome '${measurement ?? "not_found"}' · needs 'improvement_measured'`,
        },
      };
    }
  }
  // Rule: rely on lesson_id uniqueness (kind + wave + summary hash)
  const lessonId = makeLessonId(c.kind, c.wave_slug, c.summary);
  if (priorLessonIds.has(lessonId)) {
    return {
      accepted: null,
      rejected: {
        kind: c.kind,
        proposed_status: c.proposed_status,
        summary: c.summary,
        rejection_reason: "duplicate_of_prior_lesson",
        rejection_summary: `lesson_id '${lessonId}' already exists in prior_book`,
      },
    };
  }

  // Enforce summary/citation length caps
  if (c.summary.length > I2_MAX_SUMMARY_LENGTH || c.evidence_citation.length > I2_MAX_CITATION_LENGTH) {
    return {
      accepted: null,
      rejected: {
        kind: c.kind,
        proposed_status: c.proposed_status,
        summary: c.summary,
        rejection_reason: "prohibited_string_content",
        rejection_summary: "summary or evidence_citation exceeds length limit",
      },
    };
  }

  const promotionEvent: PromotionEvent = {
    from_status: null,
    to_status: c.proposed_status,
    at: now.toISOString(),
    justification: c.proposed_status === "FACT"
      ? `HYPOTHESIS → FACT promotion authorised by paired hypothesis '${c.paired_hypothesis_id}' with outcome improvement_measured`
      : `initial record with proposed_status ${c.proposed_status}`,
  };

  const lesson: EngineeringLesson = {
    lesson_id: lessonId,
    kind: c.kind,
    status: c.proposed_status,
    summary: c.summary,
    evidence_citation: c.evidence_citation,
    wave_slug: c.wave_slug,
    paired_hypothesis_id: c.paired_hypothesis_id,
    recorded_at: now.toISOString(),
    promotion_history: Object.freeze([promotionEvent]),
  };
  return { accepted: lesson, rejected: null };
}

// ── Main entry point ───────────────────────────────────────────────────

export function recordEngineeringMemory(request: EngineeringMemoryRequest): EngineeringMemoryResult {
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

  const priorLessons: EngineeringLesson[] = request.prior_book?.lessons ? [...request.prior_book.lessons] : [];
  const priorLessonIds = new Set(priorLessons.map((l) => l.lesson_id));

  const accepted: EngineeringLesson[] = [...priorLessons];
  const rejected: RejectedCandidate[] = [];

  for (const c of request.candidate_lessons) {
    const evalResult = evaluateCandidate(c, hypothesisMeasurementsById, priorLessonIds, now);
    if (evalResult.accepted) {
      accepted.push(evalResult.accepted);
      priorLessonIds.add(evalResult.accepted.lesson_id);
    }
    if (evalResult.rejected) {
      rejected.push(evalResult.rejected);
    }
  }

  // Deterministic ordering
  accepted.sort((a, b) => (a.lesson_id < b.lesson_id ? -1 : a.lesson_id > b.lesson_id ? 1 : 0));
  rejected.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
    return a.summary < b.summary ? -1 : a.summary > b.summary ? 1 : 0;
  });

  const bookId = sha256Hex(JSON.stringify({ lessons: accepted })).slice(0, 16);
  const bookCanonical = JSON.stringify({ book_id: bookId, lessons: accepted });
  const bookSha = sha256Hex(bookCanonical);

  const book: EngineeringMemoryBook = {
    book_id: bookId,
    lessons: Object.freeze(accepted),
    book_sha256: bookSha,
  };

  const success: EngineeringMemorySuccess = {
    ok: true,
    assessed_at: now.toISOString(),
    book,
    rejected_candidates: Object.freeze(rejected),
  };

  const totalSize = Buffer.byteLength(bookCanonical, "utf8") + JSON.stringify(rejected).length + 128;
  if (totalSize > I2_MAX_OUTPUT_BYTES) {
    return fail("I2_OUTPUT_TOO_LARGE", `assembled output ${totalSize} bytes > ${I2_MAX_OUTPUT_BYTES}`);
  }

  return success;
}

export type {
  CandidateLesson,
  EngineeringLesson,
  EngineeringMemoryBook,
  EngineeringMemoryFailure,
  EngineeringMemoryRefusalCode,
  EngineeringMemoryRequest,
  EngineeringMemoryResult,
  EngineeringMemorySuccess,
  EpistemicStatus,
  LessonKind,
  PromotionEvent,
  RejectedCandidate,
  RejectionReason,
} from "./engineering-memory-types";

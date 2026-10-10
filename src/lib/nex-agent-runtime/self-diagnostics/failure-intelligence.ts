// §36-S-3 · WAVE-S3 · 2026-09-14 · failure-intelligence
//
// The failure-intelligence primitive.
//
// Pure function · zero I/O. Consumes verified S1 + S2 records and produces a
// deterministic structured failure-intelligence report. Never re-collects
// evidence. Never re-assesses health. Never recommends fixes. Never invents
// causality — where evidence does not prove why, cause_status = "cause_unknown".
//
// Boundary (verbatim · unamendable):
//   "Wave S3 enables NEX1 to interpret S1 evidence + S2 health into a
//    deterministic, evidence-cited structured failure-intelligence report.
//    It does not permit NEX1 to invoke S1, re-collect evidence, re-assess
//    health, recommend improvements, modify any file, read the filesystem,
//    run tests, invoke primitives, expand authoring vocabulary, or infer
//    causality beyond declared evidence."

import { createHash } from "node:crypto";
import type { EvidenceCollectionSuccess, EvidenceGapNote } from "./evidence-collector-types";
import type { CapabilityHealthSuccess, DimensionAssessment, HealthDimension } from "./health-model-types";
import {
  APPROVED_FAILURE_CLASSES,
  FI_MAX_OUTPUT_BYTES,
  FI_MAX_WAVE_FILTER,
  FI_PROHIBITED_SUBSTRINGS,
  type FailureClass,
  type FailureIntelligenceFailure,
  type FailureIntelligenceRefusalCode,
  type FailureIntelligenceRequest,
  type FailureIntelligenceResult,
  type FailureIntelligenceSuccess,
  type FailureRecord,
} from "./failure-intelligence-types";

// ── Helpers ────────────────────────────────────────────────────────────

function fail(
  code: FailureIntelligenceRefusalCode,
  reason: string,
  offendingField?: string,
): FailureIntelligenceFailure {
  return offendingField !== undefined
    ? { ok: false, refusal_code: code, reason, offending_field: offendingField }
    : { ok: false, refusal_code: code, reason };
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function containsProhibited(s: string): boolean {
  for (const bad of FI_PROHIBITED_SUBSTRINGS) if (s.includes(bad)) return true;
  return false;
}

function gapNoteKey(g: EvidenceGapNote): string {
  return `${g.kind}|${g.wave_slug ?? ""}|${g.evidence_kind ?? ""}|${g.path_ref ?? ""}|${g.description}`;
}

function byField<T>(getter: (t: T) => string): (a: T, b: T) => number {
  return (a, b) => {
    const av = getter(a);
    const bv = getter(b);
    return av < bv ? -1 : av > bv ? 1 : 0;
  };
}

// ── Request validation ─────────────────────────────────────────────────

function validate(request: FailureIntelligenceRequest): FailureIntelligenceFailure | null {
  if (!request || typeof request !== "object") return fail("FI_INVALID_REQUEST", "request must be an object");
  const r1 = request.s1_record;
  if (!r1 || typeof r1 !== "object" || (r1 as { ok?: unknown }).ok !== true) {
    return fail("FI_INVALID_S1_RECORD", "s1_record.ok must be true");
  }
  if (typeof r1.evidence_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(r1.evidence_sha256)) {
    return fail("FI_INVALID_S1_RECORD", "s1_record.evidence_sha256 invalid");
  }
  const r2 = request.s2_record;
  if (!r2 || typeof r2 !== "object" || (r2 as { ok?: unknown }).ok !== true) {
    return fail("FI_INVALID_S2_RECORD", "s2_record.ok must be true");
  }
  if (typeof r2.health_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(r2.health_sha256)) {
    return fail("FI_INVALID_S2_RECORD", "s2_record.health_sha256 invalid");
  }
  if (typeof r2.s1_evidence_sha256_verified !== "string" || !/^[0-9a-f]{64}$/.test(r2.s1_evidence_sha256_verified)) {
    return fail("FI_INVALID_S2_RECORD", "s2_record.s1_evidence_sha256_verified invalid");
  }
  if (r2.s1_evidence_sha256_verified !== r1.evidence_sha256) {
    return fail("FI_S1_S2_SHA_MISMATCH", `s2_record was assessed against a different S1 record (${r2.s1_evidence_sha256_verified.slice(0, 12)}... vs ${r1.evidence_sha256.slice(0, 12)}...)`);
  }
  if (request.wave_filter !== undefined) {
    if (!Array.isArray(request.wave_filter)) return fail("FI_INVALID_REQUEST", "wave_filter must be array");
    if (request.wave_filter.length > FI_MAX_WAVE_FILTER) return fail("FI_INVALID_REQUEST", `wave_filter length > ${FI_MAX_WAVE_FILTER}`);
    for (const s of request.wave_filter) {
      if (typeof s !== "string" || s.length === 0) return fail("FI_INVALID_REQUEST", "wave_filter entry must be non-empty string");
      if (containsProhibited(s)) return fail("FI_PROHIBITED_STRING_CONTENT", "wave_filter contains prohibited substring");
      if (s.length > 128 || !/^[a-z0-9\-]+$/.test(s)) return fail("FI_INVALID_REQUEST", `wave_filter entry invalid: ${s}`);
    }
  }
  return null;
}

// ── Derivation helpers ─────────────────────────────────────────────────

/** Locked patterns that indicate a `pattern_mismatch` when S1 gap notes surface them. */
function isPatternMismatchGap(g: EvidenceGapNote): boolean {
  return g.kind === "test_count_source_span_not_locatable" || g.kind === "grep_marker_missing_in_expected_path";
}

/** Locked mapping from S1 gap-note kind → FailureClass. */
function classifyGapNote(g: EvidenceGapNote): FailureClass | null {
  switch (g.kind) {
    case "acceptance_report_referenced_but_missing":
      return "acceptance_report_absent";
    case "baseline_hash_file_missing":
      return "evidence_missing";
    case "grep_marker_missing_in_expected_path":
      return "pattern_mismatch";
    case "governance_amendment_state_unknown":
      return "governance_state_unknown";
    case "test_count_source_span_not_locatable":
      return "pattern_mismatch";
    case "wave_filter_slug_not_matched":
      return "evidence_missing";
    case "capability_promotion_status_ambiguous":
      return g.evidence_kind === "baseline_sha_verification" ? "baseline_conflict" : "evidence_missing";
    default:
      return null;
  }
}

/** The S2 dimension a gap note relates to, if any. */
function s2DimensionForGap(g: EvidenceGapNote): HealthDimension | null {
  switch (g.kind) {
    case "acceptance_report_referenced_but_missing":
      return "acceptance_report_integrity";
    case "grep_marker_missing_in_expected_path":
      return "marker_presence";
    case "governance_amendment_state_unknown":
      return "governance_state";
    case "test_count_source_span_not_locatable":
      return "test_evidence_visibility";
    case "capability_promotion_status_ambiguous":
      return g.evidence_kind === "baseline_sha_verification" ? "baseline_integrity" : null;
    default:
      return null;
  }
}

// ── Main entry point ───────────────────────────────────────────────────

export function classifyFailureIntelligence(request: FailureIntelligenceRequest): FailureIntelligenceResult {
  const failCheck = validate(request);
  if (failCheck) return failCheck;

  const r1 = request.s1_record;
  const r2 = request.s2_record;
  const clock = request.clock ?? (() => new Date());
  const now = clock();

  const waveFilter = request.wave_filter ? new Set(request.wave_filter) : null;
  const failures: FailureRecord[] = [];
  const wavesInS2 = new Set<string>(r2.reports.map((rep) => rep.wave_slug));

  // Derive failures from S1 gap notes (deterministic classifier).
  for (const g of r1.gap_notes) {
    if (g.wave_slug === null) continue;
    if (waveFilter && !waveFilter.has(g.wave_slug)) continue;
    const cls = classifyGapNote(g);
    if (cls === null) continue;
    const s2Dim = s2DimensionForGap(g);
    const isPatternMismatch = cls === "pattern_mismatch" && isPatternMismatchGap(g);
    const record: FailureRecord = {
      wave_slug: g.wave_slug,
      failure_class: cls,
      location_s1_field: `gap_notes[kind=${g.kind}, wave=${g.wave_slug}]`,
      location_s2_dimension: s2Dim,
      demonstrated_by_gap_note_keys: Object.freeze([gapNoteKey(g)]),
      evidence_summary: `S1 emitted gap_note kind '${g.kind}' for wave '${g.wave_slug}'${g.path_ref ? ` (path=${g.path_ref})` : ""}`,
      cause_status: isPatternMismatch ? "known_from_evidence" : "cause_unknown",
      cause_summary: isPatternMismatch
        ? `S1 locked pattern for '${g.kind}' did not match evidence source; drift between locked pattern and real content`
        : null,
      known_facts: Object.freeze([
        `gap_note.kind = ${g.kind}`,
        `gap_note.wave_slug = ${g.wave_slug}`,
        ...(g.path_ref ? [`gap_note.path_ref = ${g.path_ref}`] : []),
      ]),
      unknown_aspects: Object.freeze(isPatternMismatch ? [] : ["root cause · downstream impact"]),
    };
    failures.push(record);
  }

  // Derive failures from S1 capability_inventory (plan_only waves).
  for (const cap of r1.capability_inventory) {
    if (waveFilter && !waveFilter.has(cap.wave_slug)) continue;
    if (cap.promotion_status === "plan_only") {
      failures.push({
        wave_slug: cap.wave_slug,
        failure_class: "capability_not_promoted",
        location_s1_field: `capability_inventory[${cap.wave_slug}].promotion_status`,
        location_s2_dimension: null,
        demonstrated_by_gap_note_keys: [],
        evidence_summary: `capability '${cap.wave_slug}' is plan_only · no promoted paths, no acceptance report`,
        cause_status: "known_from_evidence",
        cause_summary: "capability has not been executed/promoted (plan-only status by design)",
        known_facts: Object.freeze([
          `promotion_status = plan_only`,
          `promoted_paths.length = ${cap.promoted_paths.length}`,
        ]),
        unknown_aspects: [],
      });
    }
  }

  // Derive failures from S2 dimensions that report insufficient_evidence (marker_missing) or absent.
  for (const rep of r2.reports) {
    if (waveFilter && !waveFilter.has(rep.wave_slug)) continue;
    // capability_not_promoted already captured from S1 side; skip plan-only here to avoid duplicates
    if (rep.promotion_status_from_s1 === "plan_only") continue;
    for (const dim of rep.dimensions) {
      if (dim.state === "insufficient_evidence" && dim.dimension === "marker_presence") {
        // Skip if a gap-note-derived record already covers this
        const alreadyCovered = failures.some(
          (f) => f.wave_slug === rep.wave_slug && f.failure_class === "marker_missing",
        );
        if (alreadyCovered) continue;
        failures.push({
          wave_slug: rep.wave_slug,
          failure_class: "marker_missing",
          location_s1_field: `grep_marker_inventory (no marker containing '${rep.wave_slug.toUpperCase()}')`,
          location_s2_dimension: "marker_presence",
          demonstrated_by_gap_note_keys: [],
          evidence_summary: `S2 dimension 'marker_presence' = insufficient_evidence for wave '${rep.wave_slug}'`,
          cause_status: "cause_unknown",
          cause_summary: null,
          known_facts: Object.freeze([`S2.marker_presence.state = insufficient_evidence`]),
          unknown_aspects: Object.freeze(["whether marker was omitted at authoring time OR marker regex fails to match"]),
        });
      }
    }
  }

  // Deterministic ordering: (wave_slug, failure_class, evidence_summary).
  failures.sort((a, b) => {
    if (a.wave_slug !== b.wave_slug) return a.wave_slug < b.wave_slug ? -1 : 1;
    if (a.failure_class !== b.failure_class) return a.failure_class < b.failure_class ? -1 : 1;
    return a.evidence_summary < b.evidence_summary ? -1 : a.evidence_summary > b.evidence_summary ? 1 : 0;
  });

  // Waves-with-no-failures list (from S2's reports, minus waves that have any failure)
  const wavesWithFailures = new Set(failures.map((f) => f.wave_slug));
  const wavesWithNoFailures = [...wavesInS2].filter((w) => !wavesWithFailures.has(w)).sort();

  const canonical = JSON.stringify({
    s1_evidence_sha256_verified: r1.evidence_sha256,
    s2_health_sha256_verified: r2.health_sha256,
    failures,
    waves_with_no_failures: wavesWithNoFailures,
  });
  const fiSha = sha256Hex(canonical);

  const success: FailureIntelligenceSuccess = {
    ok: true,
    assessed_at: now.toISOString(),
    s1_evidence_sha256_verified: r1.evidence_sha256,
    s2_health_sha256_verified: r2.health_sha256,
    failures: Object.freeze(failures),
    waves_with_no_failures: Object.freeze(wavesWithNoFailures),
    failure_intelligence_sha256: fiSha,
  };

  const outputSize = Buffer.byteLength(canonical, "utf8") + fiSha.length + 128;
  if (outputSize > FI_MAX_OUTPUT_BYTES) {
    return fail("FI_OUTPUT_TOO_LARGE", `assembled output ${outputSize} bytes > ${FI_MAX_OUTPUT_BYTES}`);
  }

  return success;
}

export type {
  FailureClass,
  FailureIntelligenceFailure,
  FailureIntelligenceRefusalCode,
  FailureIntelligenceRequest,
  FailureIntelligenceResult,
  FailureIntelligenceSuccess,
  FailureRecord,
} from "./failure-intelligence-types";

// §36-S-2 · WAVE-S2 · 2026-09-14 · capability-health-model
//
// The capability-health-model primitive.
//
// Pure function with zero I/O. Consumes a verified S1 EvidenceCollectionSuccess
// and produces a structured, deterministic, evidence-cited categorical health
// readout per capability wave. Never invokes S1. Never touches the filesystem.
// Never guesses. Never scores numerically.
//
// FOUNDER-LOCKED SEMANTIC CONSTRAINT (unamendable):
//   Dimension state = `verified` means "the locked derivation rule passed on
//   the evidence". It NEVER means "the underlying capability is healthy".
//
// Boundary (verbatim · unamendable):
//   "Wave S2 enables NEX1 to interpret a deterministic S1 evidence record
//    into a structured, evidence-cited, categorical capability-health
//    readout. It does not permit NEX1 to invoke S1, re-collect evidence,
//    read the filesystem, run tests, judge failures, cluster root causes,
//    recommend improvements, invoke any primitive, modify any file, expand
//    its authoring vocabulary, produce numeric strength scores, or infer
//    authority from evidence quality."
//
// See docs/NEX1/BUILD_GATES/WAVE-S2-CAPABILITY-HEALTH-MODEL-PLAN.md (v1)
// and docs/NEX1/SECTION_36_S_2_CAPABILITY_HEALTH_MODEL_AMENDMENT.md.

import { createHash } from "node:crypto";
import type {
  EvidenceCollectionSuccess,
  EvidenceGapNote,
} from "./evidence-collector-types";
import {
  APPROVED_HEALTH_DIMENSIONS,
  EHM_DEFAULT_MAX_STALENESS_HOURS,
  EHM_MAX_MAX_STALENESS_HOURS,
  EHM_MAX_OUTPUT_BYTES,
  EHM_MAX_WAVE_FILTER,
  EHM_PROHIBITED_SUBSTRINGS,
  type CapabilityHealthFailure,
  type CapabilityHealthRefusalCode,
  type CapabilityHealthReport,
  type CapabilityHealthRequest,
  type CapabilityHealthResult,
  type CapabilityHealthSuccess,
  type DimensionAssessment,
  type EvidenceCitation,
  type HealthDimension,
  type HealthState,
} from "./health-model-types";

// ── Helpers ────────────────────────────────────────────────────────────

function fail(
  code: CapabilityHealthRefusalCode,
  reason: string,
  offendingField?: string,
): CapabilityHealthFailure {
  return offendingField !== undefined
    ? { ok: false, refusal_code: code, reason, offending_field: offendingField }
    : { ok: false, refusal_code: code, reason };
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function containsProhibited(s: string): boolean {
  for (const bad of EHM_PROHIBITED_SUBSTRINGS) {
    if (s.includes(bad)) return true;
  }
  return false;
}

/** Canonical serialisation of an S1 record's content (matching S1's own
 *  canonicalForHash formula). Reproduces S1's evidence_sha256. */
function canonicalS1ContentForHash(r: EvidenceCollectionSuccess): string {
  return JSON.stringify({
    workspace_root_sha256: r.workspace_root_sha256,
    evidence_kinds_collected: r.evidence_kinds_collected,
    capability_inventory: r.capability_inventory,
    test_run_summary: r.test_run_summary,
    rollback_proof_inventory: r.rollback_proof_inventory,
    grep_marker_inventory: r.grep_marker_inventory,
    governance_amendment_inventory: r.governance_amendment_inventory,
    baseline_sha_verification: r.baseline_sha_verification,
    gap_notes: r.gap_notes,
  });
}

function gapNoteKey(g: EvidenceGapNote): string {
  return `${g.kind}|${g.wave_slug ?? ""}|${g.evidence_kind ?? ""}|${g.path_ref ?? ""}|${g.description}`;
}

// ── Request validation ─────────────────────────────────────────────────

function validateRequest(request: CapabilityHealthRequest): CapabilityHealthFailure | null {
  if (!request || typeof request !== "object") return fail("EHM_INVALID_REQUEST", "request must be an object");
  const rec = request.s1_record;
  if (!rec || typeof rec !== "object") return fail("EHM_INVALID_S1_RECORD", "s1_record required");
  if ((rec as { ok?: unknown }).ok !== true) return fail("EHM_INVALID_S1_RECORD", "s1_record.ok must be true");
  const requiredFields: readonly (keyof EvidenceCollectionSuccess)[] = [
    "collected_at",
    "workspace_root_sha256",
    "evidence_kinds_collected",
    "capability_inventory",
    "test_run_summary",
    "rollback_proof_inventory",
    "grep_marker_inventory",
    "governance_amendment_inventory",
    "baseline_sha_verification",
    "gap_notes",
    "evidence_sha256",
  ];
  for (const f of requiredFields) {
    if (!(f in rec)) return fail("EHM_INVALID_S1_RECORD", `s1_record.${String(f)} missing`);
  }
  if (typeof rec.evidence_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(rec.evidence_sha256)) {
    return fail("EHM_INVALID_S1_RECORD", "s1_record.evidence_sha256 not a 64-hex-char SHA-256");
  }

  if (request.health_dimensions !== undefined) {
    if (!Array.isArray(request.health_dimensions)) return fail("EHM_UNKNOWN_HEALTH_DIMENSION", "health_dimensions must be array");
    for (const d of request.health_dimensions) {
      if (!APPROVED_HEALTH_DIMENSIONS.includes(d as HealthDimension)) {
        return fail("EHM_UNKNOWN_HEALTH_DIMENSION", `unknown dimension: ${String(d)}`);
      }
    }
  }

  if (request.wave_filter !== undefined) {
    if (!Array.isArray(request.wave_filter)) return fail("EHM_WAVE_FILTER_INVALID", "wave_filter must be array");
    if (request.wave_filter.length > EHM_MAX_WAVE_FILTER) return fail("EHM_WAVE_FILTER_INVALID", `wave_filter length > ${EHM_MAX_WAVE_FILTER}`);
    for (const s of request.wave_filter) {
      if (typeof s !== "string" || s.length === 0) return fail("EHM_WAVE_FILTER_INVALID", "wave_filter entry not a non-empty string");
      if (containsProhibited(s)) return fail("EHM_PROHIBITED_STRING_CONTENT", "wave_filter contains prohibited substring");
      if (s.length > 128) return fail("EHM_WAVE_FILTER_INVALID", "wave_filter entry too long");
      if (!/^[a-z0-9\-]+$/.test(s)) return fail("EHM_WAVE_FILTER_INVALID", `wave_filter entry invalid: ${s}`);
    }
  }

  const staleness = request.max_staleness_hours ?? EHM_DEFAULT_MAX_STALENESS_HOURS;
  if (!Number.isFinite(staleness) || staleness <= 0 || staleness > EHM_MAX_MAX_STALENESS_HOURS) {
    return fail("EHM_INVALID_REQUEST", `max_staleness_hours out of range: ${staleness}`);
  }

  return null;
}

// ── Locked derivation rules (plan v1 §11.2) ────────────────────────────

interface DerivationContext {
  readonly rec: EvidenceCollectionSuccess;
  readonly waveSlug: string;
  readonly promotionStatus: CapabilityHealthReport["promotion_status_from_s1"];
  readonly capabilityRecord: EvidenceCollectionSuccess["capability_inventory"][number] | undefined;
}

function derivePresence(ctx: DerivationContext): DimensionAssessment {
  if (ctx.promotionStatus === "plan_only") {
    return { dimension: "presence", state: "not_applicable", citations: [], gap_note_refs: [] };
  }
  const rec = ctx.capabilityRecord;
  if (!rec) {
    return { dimension: "presence", state: "absent", citations: [], gap_note_refs: [] };
  }
  const citations: EvidenceCitation[] = [];
  // "Promoted" waves: presence is proven by promoted_paths + baseline verifications.
  if (ctx.promotionStatus === "promoted") {
    citations.push({
      s1_field: `capability_inventory[${ctx.waveSlug}].promoted_paths`,
      value_summary: `count=${rec.promoted_paths.length}`,
    });
    if (rec.promoted_paths.length === 0) {
      return { dimension: "presence", state: "absent", citations: Object.freeze(citations), gap_note_refs: [] };
    }
    const verifications = ctx.rec.baseline_sha_verification.filter((v) => rec.promoted_paths.includes(v.protected_path));
    if (verifications.length === rec.promoted_paths.length && verifications.every((v) => v.match)) {
      return { dimension: "presence", state: "verified", citations: Object.freeze(citations), gap_note_refs: [] };
    }
    if (verifications.some((v) => v.match)) {
      return { dimension: "presence", state: "partial", citations: Object.freeze(citations), gap_note_refs: [] };
    }
    return { dimension: "presence", state: "insufficient_evidence", citations: Object.freeze(citations), gap_note_refs: [] };
  }
  // "Infrastructure_only" / "lab_only" waves: presence is proven by acceptance report existence.
  // Their code does not live at "promoted" paths; presence evidence is that a real acceptance report
  // with SHA-256 was produced (which S1 verified before writing capability_inventory).
  if (rec.acceptance_report_sha256 !== null) {
    citations.push({
      s1_field: `capability_inventory[${ctx.waveSlug}].acceptance_report_sha256`,
      value_summary: `sha=${rec.acceptance_report_sha256.slice(0, 12)}...`,
    });
    return { dimension: "presence", state: "verified", citations: Object.freeze(citations), gap_note_refs: [] };
  }
  return { dimension: "presence", state: "insufficient_evidence", citations: [], gap_note_refs: [] };
}

function deriveBaselineIntegrity(ctx: DerivationContext): DimensionAssessment {
  if (ctx.promotionStatus === "plan_only") {
    return { dimension: "baseline_integrity", state: "not_applicable", citations: [], gap_note_refs: [] };
  }
  const rec = ctx.capabilityRecord;
  if (!rec) {
    return { dimension: "baseline_integrity", state: "insufficient_evidence", citations: [], gap_note_refs: [] };
  }
  const citations: EvidenceCitation[] = [];
  const relevantPaths = new Set<string>(rec.promoted_paths);
  // Also include paths declared by any rollback proof whose wave_slug matches.
  for (const proof of ctx.rec.rollback_proof_inventory) {
    if (proof.wave_slug === ctx.waveSlug) {
      for (const p of proof.protected_paths_declared) relevantPaths.add(p);
    }
  }
  if (relevantPaths.size === 0) {
    return { dimension: "baseline_integrity", state: "insufficient_evidence", citations: [], gap_note_refs: [] };
  }
  const verifications = ctx.rec.baseline_sha_verification.filter((v) => relevantPaths.has(v.protected_path));
  if (verifications.length === 0) {
    return { dimension: "baseline_integrity", state: "insufficient_evidence", citations: [], gap_note_refs: [] };
  }
  citations.push({
    s1_field: `baseline_sha_verification[for ${ctx.waveSlug}]`,
    value_summary: `verified_count=${verifications.filter((v) => v.match).length}/${verifications.length}`,
  });
  const allMatch = verifications.every((v) => v.match);
  const conflictGapNotes = ctx.rec.gap_notes.filter(
    (g) => g.kind === "capability_promotion_status_ambiguous" && g.evidence_kind === "baseline_sha_verification" && g.path_ref !== null && relevantPaths.has(g.path_ref),
  );
  const gapNoteRefs = conflictGapNotes.map(gapNoteKey);
  if (allMatch && conflictGapNotes.length === 0) {
    return { dimension: "baseline_integrity", state: "verified", citations: Object.freeze(citations), gap_note_refs: Object.freeze(gapNoteRefs) };
  }
  if (allMatch && conflictGapNotes.length > 0) {
    return { dimension: "baseline_integrity", state: "substantial", citations: Object.freeze(citations), gap_note_refs: Object.freeze(gapNoteRefs) };
  }
  return { dimension: "baseline_integrity", state: "partial", citations: Object.freeze(citations), gap_note_refs: Object.freeze(gapNoteRefs) };
}

function deriveAcceptanceReportIntegrity(ctx: DerivationContext): DimensionAssessment {
  if (ctx.promotionStatus === "plan_only") {
    return { dimension: "acceptance_report_integrity", state: "not_applicable", citations: [], gap_note_refs: [] };
  }
  const rec = ctx.capabilityRecord;
  if (!rec) {
    return { dimension: "acceptance_report_integrity", state: "absent", citations: [], gap_note_refs: [] };
  }
  const missingGap = ctx.rec.gap_notes.find(
    (g) => g.kind === "acceptance_report_referenced_but_missing" && g.wave_slug === ctx.waveSlug,
  );
  const gapNoteRefs = missingGap ? [gapNoteKey(missingGap)] : [];
  if (missingGap !== undefined) {
    return { dimension: "acceptance_report_integrity", state: "absent", citations: [], gap_note_refs: Object.freeze(gapNoteRefs) };
  }
  if (rec.acceptance_report_path === null || rec.acceptance_report_sha256 === null) {
    return { dimension: "acceptance_report_integrity", state: "insufficient_evidence", citations: [], gap_note_refs: [] };
  }
  const citations: EvidenceCitation[] = [
    {
      s1_field: `capability_inventory[${ctx.waveSlug}].acceptance_report_path`,
      value_summary: rec.acceptance_report_path,
    },
    {
      s1_field: `capability_inventory[${ctx.waveSlug}].acceptance_report_sha256`,
      value_summary: `sha=${rec.acceptance_report_sha256.slice(0, 12)}...`,
    },
  ];
  return { dimension: "acceptance_report_integrity", state: "verified", citations: Object.freeze(citations), gap_note_refs: [] };
}

function deriveTestEvidenceVisibility(ctx: DerivationContext): DimensionAssessment {
  if (ctx.promotionStatus === "plan_only") {
    return { dimension: "test_evidence_visibility", state: "not_applicable", citations: [], gap_note_refs: [] };
  }
  const entry = ctx.rec.test_run_summary.find((t) => t.wave_slug === ctx.waveSlug);
  const spanGap = ctx.rec.gap_notes.find(
    (g) => g.kind === "test_count_source_span_not_locatable" && g.wave_slug === ctx.waveSlug,
  );
  const gapNoteRefs = spanGap ? [gapNoteKey(spanGap)] : [];
  if (entry !== undefined && entry.test_count_declared > 0) {
    return {
      dimension: "test_evidence_visibility",
      state: "verified",
      citations: Object.freeze([{
        s1_field: `test_run_summary[${ctx.waveSlug}].test_count_declared`,
        value_summary: `count=${entry.test_count_declared}`,
      }]),
      gap_note_refs: Object.freeze(gapNoteRefs),
    };
  }
  return {
    dimension: "test_evidence_visibility",
    state: "insufficient_evidence",
    citations: [],
    gap_note_refs: Object.freeze(gapNoteRefs),
  };
}

function deriveGovernanceState(ctx: DerivationContext): DimensionAssessment {
  const uppercase = ctx.waveSlug.toUpperCase();
  const matching = ctx.rec.governance_amendment_inventory.find((g) => g.marker.includes(uppercase) || g.marker.includes(`ROUTE-${uppercase}`) || g.marker.includes(`WAVE-${uppercase}`));
  if (matching === undefined) {
    return { dimension: "governance_state", state: "not_applicable", citations: [], gap_note_refs: [] };
  }
  const citations: EvidenceCitation[] = [{
    s1_field: `governance_amendment_inventory[marker=${matching.marker}].cessation_state`,
    value_summary: matching.cessation_state,
  }];
  const stateGap = ctx.rec.gap_notes.find(
    (g) => g.kind === "governance_amendment_state_unknown" && g.path_ref === matching.amendment_path,
  );
  const gapNoteRefs = stateGap ? [gapNoteKey(stateGap)] : [];
  const mapped: HealthState =
    matching.cessation_state === "ceased" ? "verified" :
    matching.cessation_state === "active" ? "partial" :
    "insufficient_evidence";
  return { dimension: "governance_state", state: mapped, citations: Object.freeze(citations), gap_note_refs: Object.freeze(gapNoteRefs) };
}

function deriveMarkerPresence(ctx: DerivationContext): DimensionAssessment {
  const uppercase = ctx.waveSlug.toUpperCase();
  const matching = ctx.rec.grep_marker_inventory.filter((m) => m.marker.includes(uppercase) || m.marker.includes(`ROUTE-${uppercase}`) || m.marker.includes(`WAVE-${uppercase}`));
  if (matching.length === 0) {
    if (ctx.promotionStatus === "plan_only") {
      return { dimension: "marker_presence", state: "not_applicable", citations: [], gap_note_refs: [] };
    }
    return { dimension: "marker_presence", state: "insufficient_evidence", citations: [], gap_note_refs: [] };
  }
  const totalPaths = matching.reduce((n, m) => n + m.paths.length, 0);
  const citations: EvidenceCitation[] = [{
    s1_field: `grep_marker_inventory[for ${ctx.waveSlug}]`,
    value_summary: `markers=${matching.length}, paths=${totalPaths}`,
  }];
  if (totalPaths > 0) {
    return { dimension: "marker_presence", state: "verified", citations: Object.freeze(citations), gap_note_refs: [] };
  }
  return { dimension: "marker_presence", state: "insufficient_evidence", citations: Object.freeze(citations), gap_note_refs: [] };
}

const DERIVATION_TABLE: Record<HealthDimension, (ctx: DerivationContext) => DimensionAssessment> = {
  presence: derivePresence,
  baseline_integrity: deriveBaselineIntegrity,
  acceptance_report_integrity: deriveAcceptanceReportIntegrity,
  test_evidence_visibility: deriveTestEvidenceVisibility,
  governance_state: deriveGovernanceState,
  marker_presence: deriveMarkerPresence,
};

// ── Sorting helpers ────────────────────────────────────────────────────

function byField<T>(getter: (t: T) => string): (a: T, b: T) => number {
  return (a, b) => {
    const av = getter(a);
    const bv = getter(b);
    if (av < bv) return -1;
    if (av > bv) return 1;
    return 0;
  };
}

// ── Main entry point ───────────────────────────────────────────────────

export function assessCapabilityHealth(request: CapabilityHealthRequest): CapabilityHealthResult {
  const reqFail = validateRequest(request);
  if (reqFail) return reqFail;

  const rec = request.s1_record;
  const clock = request.clock ?? (() => new Date());
  const now = clock();
  const maxStaleHours = request.max_staleness_hours ?? EHM_DEFAULT_MAX_STALENESS_HOURS;

  // Self-consistency check: recompute S1's evidence_sha256 from its own content.
  const recomputedSha = sha256Hex(canonicalS1ContentForHash(rec));
  if (recomputedSha !== rec.evidence_sha256) {
    return fail(
      "EHM_S1_EVIDENCE_SHA_MISMATCH",
      `s1_record.evidence_sha256 (${rec.evidence_sha256.slice(0, 16)}...) does not match recomputed hash (${recomputedSha.slice(0, 16)}...) — record may be tampered or corrupted`,
    );
  }

  // Staleness check
  const collectedAt = Date.parse(rec.collected_at);
  if (Number.isFinite(collectedAt)) {
    const ageHours = (now.getTime() - collectedAt) / (1000 * 60 * 60);
    if (ageHours > maxStaleHours) {
      return fail("EHM_S1_RECORD_STALE", `s1_record age ${ageHours.toFixed(2)}h > max_staleness_hours ${maxStaleHours}h`);
    }
  }

  // Determine dimension set (default = all approved)
  const dimensions: readonly HealthDimension[] = request.health_dimensions ?? APPROVED_HEALTH_DIMENSIONS;
  const dimSet = new Set<HealthDimension>(dimensions);

  // Determine wave set: union of capability_inventory slugs and grep-marker-derived
  // slugs. The wave_filter (if provided) narrows this.
  const waveSlugs = new Set<string>();
  for (const cap of rec.capability_inventory) waveSlugs.add(cap.wave_slug);
  if (request.wave_filter && request.wave_filter.length > 0) {
    const filter = new Set<string>(request.wave_filter);
    for (const slug of [...waveSlugs]) if (!filter.has(slug)) waveSlugs.delete(slug);
  }

  const reports: CapabilityHealthReport[] = [];
  for (const waveSlug of [...waveSlugs].sort()) {
    const capabilityRecord = rec.capability_inventory.find((c) => c.wave_slug === waveSlug);
    const promotionStatus = capabilityRecord?.promotion_status ?? "plan_only";
    const ctx: DerivationContext = { rec, waveSlug, promotionStatus, capabilityRecord };

    const assessments: DimensionAssessment[] = [];
    for (const dim of APPROVED_HEALTH_DIMENSIONS) {
      if (!dimSet.has(dim)) continue;
      assessments.push(DERIVATION_TABLE[dim](ctx));
    }
    assessments.sort(byField((a) => a.dimension));

    const strongestDimensions = assessments
      .filter((a) => a.state === "verified")
      .map((a) => a.dimension)
      .sort();
    const weakestDimensions = assessments
      .filter((a) => a.state === "insufficient_evidence" || a.state === "absent")
      .map((a) => a.dimension)
      .sort();

    reports.push({
      wave_slug: waveSlug,
      promotion_status_from_s1: promotionStatus,
      dimensions: Object.freeze(assessments),
      strongest_dimensions: Object.freeze(strongestDimensions),
      weakest_dimensions: Object.freeze(weakestDimensions),
    });
  }

  const collectedAtIso = now.toISOString();
  const canonicalOutput = JSON.stringify({
    s1_evidence_sha256_verified: rec.evidence_sha256,
    reports,
  });
  const healthSha = sha256Hex(canonicalOutput);

  const success: CapabilityHealthSuccess = {
    ok: true,
    assessed_at: collectedAtIso,
    s1_evidence_sha256_verified: rec.evidence_sha256,
    reports: Object.freeze(reports),
    health_sha256: healthSha,
  };

  const outputSize = Buffer.byteLength(canonicalOutput, "utf8") + healthSha.length + 128;
  if (outputSize > EHM_MAX_OUTPUT_BYTES) {
    return fail("EHM_OUTPUT_TOO_LARGE", `assembled output ${outputSize} bytes > ${EHM_MAX_OUTPUT_BYTES}`);
  }

  return success;
}

export type {
  CapabilityHealthFailure,
  CapabilityHealthRefusalCode,
  CapabilityHealthRequest,
  CapabilityHealthResult,
  CapabilityHealthSuccess,
  DimensionAssessment,
  HealthDimension,
  HealthState,
} from "./health-model-types";

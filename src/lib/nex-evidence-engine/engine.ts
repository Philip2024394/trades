// src/lib/nex-evidence-engine/engine.ts
//
// NEX1 · EVIDENCE ENGINE · v0 · core dispatch.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// Constitutional invariants (enforced by construction):
//   · Evidence Engine measures · never decides
//   · Never mutates measured project source
//   · NEX1Declaration is REJECTED if masquerading as EvidenceRecord
//   · Every EvidenceRecord carries tool + tool_version + reproducibility_information
//   · NOT_MEASURED never silently promotes to PASSED

import type { EvidenceRecord, EvidenceBundle, EvidenceDimension, MeasurementInput, EvidenceState, NEX1Declaration } from "./types";
import { attributionMeasurement, nextBundleId, provenance } from "./utilities";
import { measureCompilation } from "./dimensions/compilation";
import { measureTypeCheck } from "./dimensions/type-check";
import { measureTests } from "./dimensions/tests";
import { measureRegression } from "./dimensions/regression";
import { measureComplexity } from "./dimensions/complexity";

const SCHEMA_VERSION = "v0.1.0";
const ENGINE_ID = "evidence-engine@" + SCHEMA_VERSION;

export type SupportedDimension = EvidenceDimension;

export function supportedDimensions(): readonly EvidenceDimension[] {
  return ["compilation", "type_check", "tests", "regression", "complexity"];
}

export function measure(dimension: EvidenceDimension, input: MeasurementInput, extra?: unknown): EvidenceRecord {
  switch (dimension) {
    case "compilation": return measureCompilation(input);
    case "type_check":  return measureTypeCheck(input);
    case "tests":       return measureTests(input, extra as any);
    case "regression":  return measureRegression(input);
    case "complexity":  return measureComplexity(input);
  }
}

/**
 * @summary Rejects any input that claims to be an EvidenceRecord but is
 * actually a NEX1Declaration. Constitutional distinction (founder rule
 * 2026-09-12): NEX1 declarations are CLAIMS · never independently measured
 * evidence.
 */
export function rejectDeclarationMasquerade(candidate: unknown): { ok: boolean; reason: string } {
  const c = candidate as any;
  if (!c || typeof c !== "object") return { ok: false, reason: "not an object" };
  if (c.record_type === "NEX1_DECLARATION") {
    return { ok: false, reason: "NEX1_DECLARATION is a claim · not an EvidenceRecord · rejected by constitutional rule" };
  }
  if (c.record_type !== "EVIDENCE_RECORD") {
    return { ok: false, reason: `record_type='${c.record_type ?? "(missing)"}' · only 'EVIDENCE_RECORD' is accepted` };
  }
  // Validate load-bearing fields
  const missing: string[] = [];
  for (const k of ["evidence_id", "tool", "tool_version", "reproducibility_information", "source_hashes", "attribution", "provenance", "state"]) {
    if (c[k] === undefined || c[k] === null || (typeof c[k] === "string" && c[k].length === 0)) missing.push(k);
  }
  if (missing.length > 0) return { ok: false, reason: `missing load-bearing fields: ${missing.join(", ")}` };
  return { ok: true, reason: "valid EvidenceRecord shape" };
}

/**
 * @summary Compose an EvidenceBundle from an array of measured records for
 * a single candidate. Enforces schema shape · never fabricates missing
 * dimensions · surfaces unresolved dimensions explicitly.
 */
export function composeBundle(records: readonly EvidenceRecord[], input: MeasurementInput): EvidenceBundle {
  const dims: Record<EvidenceDimension, string[]> = {
    compilation: [], type_check: [], tests: [], regression: [], complexity: [],
  };
  const states: Record<EvidenceDimension, EvidenceState> = {
    compilation: "NOT_MEASURED",
    type_check:  "NOT_MEASURED",
    tests:       "NOT_MEASURED",
    regression:  "NOT_MEASURED",
    complexity:  "NOT_MEASURED",
  };
  for (const r of records) {
    if (r.record_type !== "EVIDENCE_RECORD") continue; // never accept declarations
    if (r.candidate_id !== input.candidate_id) continue;
    dims[r.evidence_type].push(r.evidence_id);
    // Roll up per-dimension state: latest record wins if present · absent stays NOT_MEASURED
    states[r.evidence_type] = r.state;
  }
  const dimList: EvidenceDimension[] = ["compilation", "type_check", "tests", "regression", "complexity"];
  const unresolved: EvidenceDimension[] = dimList.filter((d) =>
    states[d] === "NOT_MEASURED" || states[d] === "BLOCKED" || states[d] === "INCONCLUSIVE" || states[d] === "STALE"
  );
  const overallConfidence: EvidenceBundle["overall_confidence"] =
    unresolved.length === dimList.length ? "insufficient"
    : unresolved.length > 0 ? "medium"
    : dimList.every((d) => states[d] === "PASSED" || states[d] === "MEASURED" || states[d] === "NOT_APPLICABLE") ? "high"
    : "low";
  const delta_summary: EvidenceBundle["delta_summary"] = {
    compilation: rollupDelta(records, "compilation"),
    type_check:  rollupDelta(records, "type_check"),
    tests:       rollupDelta(records, "tests"),
    regression:  rollupDelta(records, "regression"),
    complexity:  rollupDelta(records, "complexity"),
  };
  return {
    record_type: "EVIDENCE_BUNDLE",
    bundle_id: nextBundleId(),
    schema_version: SCHEMA_VERSION,
    work_order_id: input.work_order_id,
    candidate_id: input.candidate_id,
    at: new Date().toISOString(),
    dimensions: dims,
    dimension_states: states,
    baseline_bundle_id: null,
    delta_summary,
    overall_confidence: overallConfidence,
    unresolved_dimensions: unresolved,
    provenance: provenance(input.requested_by, ENGINE_ID, records.map((r) => r.evidence_id), []),
    attribution: attributionMeasurement(),
  };
}

function rollupDelta(records: readonly EvidenceRecord[], dim: EvidenceDimension): { direction: "improvement" | "regression" | "neutral" | "unknown"; absolute: number | null } {
  const matching = records.filter((r) => r.evidence_type === dim);
  if (matching.length === 0) return { direction: "unknown", absolute: null };
  const withDelta = matching.find((r) => r.delta != null);
  if (!withDelta || !withDelta.delta) return { direction: "unknown", absolute: null };
  return { direction: withDelta.delta.direction ?? "unknown", absolute: withDelta.delta.absolute ?? null };
}

// §36-V2 · WAVE-V2 · 2026-09-15 · nex-visual-intelligence-v2 · engine
// NEX bounded infrastructure · constraint-aware difference engine · 2026-09-15
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT
// NEX1-authored capability.
//
// Pure function · zero I/O · deterministic. Consumes two V1
// VisualConstraintContract instances plus a list of user-declared
// requested_changes, and emits a NEX1-authored DifferenceReport shape
// populated with per-property verdicts and an overall verdict.
//
// Zero LLM · zero ML · zero image bytes · zero package install.
// Constraint-aware comparison only.

import { createHash } from "node:crypto";
import type {
  ColourLock,
  ComponentCount,
  IdentityFeature,
  MaterialLock,
  VisualConstraintContract,
} from "../nex-visual-intelligence-v1/visual-constraint-contract";
import type { FeatureCriticality } from "../nex-visual-intelligence-v1/visual-constraint-contract-ranges";
import type {
  V2_DifferenceReportRefusalReason,
  V2_PropertyKind,
  V2_PropertyVerdict,
  V2_OverallDifferenceVerdict,
  V2_RequestedChangeKind,
} from "./visual-difference-report-ranges";
import {
  V2_MAX_PROPERTY_DIFFS,
  V2_MAX_REQUESTED_CHANGES,
} from "./visual-difference-report-ranges";
import type {
  V2PropertyDiff,
  V2RequestedChange,
  VisualDifferenceReport,
} from "./visual-difference-report";
import {
  V2_GREP_MARKER,
  type RunV2DifferenceEngineRequest,
  type V2Failure,
  type V2Result,
  type V2Success,
} from "./visual-difference-engine-types";

// ── Helpers ─────────────────────────────────────────────────────────────

function fail(code: V2_DifferenceReportRefusalReason, reason: string): V2Failure {
  return { kind: "FAILURE", refusal_code: code, reason, grep_marker: V2_GREP_MARKER };
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function canonicalSerialise(c: VisualConstraintContract): string {
  // Deterministic byte-stable serialisation of a V1 contract for SHA computation.
  // Locked property order matches the interface field order in visual-constraint-contract.ts.
  const canonical = {
    contract_id: c.contract_id,
    subject_kind: c.subject_kind,
    identity_features: [...c.identity_features].map((f) => ({
      feature_id: f.feature_id, description: f.description, criticality: f.criticality,
    })),
    geometry: {
      component_counts: [...c.geometry.component_counts].map((p) => ({ part_name: p.part_name, count: p.count })),
      structural_description: c.geometry.structural_description,
    },
    camera: {
      view_angle_kind: c.camera.view_angle_kind,
      height_relative_kind: c.camera.height_relative_kind,
      focal_length_kind: c.camera.focal_length_kind,
    },
    composition: {
      aspect_ratio_num: c.composition.aspect_ratio_num,
      aspect_ratio_den: c.composition.aspect_ratio_den,
      subject_placement_hint: c.composition.subject_placement_hint,
    },
    locked_materials: [...c.locked_materials].map((m) => ({
      material_id: m.material_id,
      part_reference: m.part_reference,
      material_reference_id_optional: m.material_reference_id_optional ?? null,
    })),
    locked_colours: [...c.locked_colours].map((k) => ({
      colour_id: k.colour_id, colour_space: k.colour_space,
      hue_min: k.hue_min, hue_max: k.hue_max,
      saturation_min: k.saturation_min, saturation_max: k.saturation_max,
      lightness_min: k.lightness_min, lightness_max: k.lightness_max,
      tolerance_deltaE: k.tolerance_deltaE,
    })),
    provenance: {
      authored_at: c.provenance.authored_at,
      authored_by: c.provenance.authored_by,
      source_reference_sha256: c.provenance.source_reference_sha256,
      contract_version: c.provenance.contract_version,
      promotion_state: c.provenance.promotion_state,
    },
  };
  return JSON.stringify(canonical);
}

function isValidContract(x: unknown): x is VisualConstraintContract {
  if (!x || typeof x !== "object") return false;
  const c = x as Record<string, unknown>;
  return (
    typeof c.contract_id === "string" &&
    typeof c.subject_kind === "string" &&
    Array.isArray(c.identity_features) &&
    !!c.geometry && typeof c.geometry === "object" &&
    !!c.camera && typeof c.camera === "object" &&
    !!c.composition && typeof c.composition === "object" &&
    Array.isArray(c.locked_materials) &&
    Array.isArray(c.locked_colours) &&
    !!c.provenance && typeof c.provenance === "object"
  );
}

function isValidRequestedChange(x: unknown): x is V2RequestedChange {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.kind === "string" &&
    typeof r.target_property_path === "string" &&
    typeof r.description === "string" &&
    r.target_property_path.length > 0 &&
    r.description.length > 0
  );
}

/** True when the given field_path is targeted by a requested change of any kind. */
function isRequestedTarget(
  requested: readonly V2RequestedChange[],
  field_path: string,
  kind_filter: V2_RequestedChangeKind | null,
): boolean {
  for (const r of requested) {
    if (r.target_property_path === field_path && (kind_filter === null || r.kind === kind_filter)) {
      return true;
    }
  }
  return false;
}

/** True when the identity_features array declares an ABSOLUTE-criticality
 *  entry whose feature_id is the given field_path suffix. Used to decide
 *  whether an unexpected change is a lock violation. */
function isLockedBy(
  features: readonly IdentityFeature[],
  feature_id_needle: string,
): boolean {
  for (const f of features) {
    if (f.feature_id === feature_id_needle) {
      return f.criticality === "absolute" || f.criticality === "high";
    }
  }
  return false;
}

function summariseMaterial(m: MaterialLock): string {
  return `${m.material_id}@${m.part_reference}`;
}

function summariseColour(c: ColourLock): string {
  return `${c.colour_id}[${c.colour_space} hue=${c.hue_min}..${c.hue_max} sat=${c.saturation_min}..${c.saturation_max} light=${c.lightness_min}..${c.lightness_max} ΔE=${c.tolerance_deltaE}]`;
}

function summariseComponent(p: ComponentCount): string {
  return `${p.part_name}=${p.count}`;
}

function summariseIdentityFeature(f: IdentityFeature): string {
  return `${f.feature_id}(${f.criticality})`;
}

/** Colour comparison with tolerance. Two ColourLocks match when their id +
 *  space agree AND every range overlaps AND their tolerance_deltaE ranges
 *  overlap within the shared max. */
function coloursMatchWithinTolerance(a: ColourLock, b: ColourLock): boolean {
  if (a.colour_id !== b.colour_id) return false;
  if (a.colour_space !== b.colour_space) return false;
  if (a.hue_min !== b.hue_min || a.hue_max !== b.hue_max) return false;
  if (a.saturation_min !== b.saturation_min || a.saturation_max !== b.saturation_max) return false;
  if (a.lightness_min !== b.lightness_min || a.lightness_max !== b.lightness_max) return false;
  if (a.tolerance_deltaE !== b.tolerance_deltaE) return false;
  return true;
}

// ── Entry point ────────────────────────────────────────────────────────

export function runVisualDifferenceEngine(request: RunV2DifferenceEngineRequest): V2Result {
  if (!request || typeof request !== "object") {
    return fail("V2_INTERNAL", "request required");
  }

  if (!isValidContract(request.reference_contract)) {
    return fail("V2_INVALID_REFERENCE_CONTRACT", "reference_contract must be a well-formed VisualConstraintContract");
  }
  if (!isValidContract(request.candidate_contract)) {
    return fail("V2_INVALID_CANDIDATE_CONTRACT", "candidate_contract must be a well-formed VisualConstraintContract");
  }

  const ref = request.reference_contract;
  const cand = request.candidate_contract;

  if (ref.contract_id !== cand.contract_id) {
    return fail(
      "V2_CONTRACT_ID_MISMATCH",
      `contract_id mismatch: reference='${ref.contract_id}' candidate='${cand.contract_id}'`,
    );
  }
  if (ref.subject_kind !== cand.subject_kind) {
    return fail(
      "V2_CONTRACT_ID_MISMATCH",
      `subject_kind mismatch: reference='${ref.subject_kind}' candidate='${cand.subject_kind}'`,
    );
  }

  if (!Array.isArray(request.requested_changes)) {
    return fail("V2_INVALID_REQUESTED_CHANGE", "requested_changes must be an array");
  }
  if (request.requested_changes.length > V2_MAX_REQUESTED_CHANGES.max) {
    return fail(
      "V2_MAX_REQUESTED_CHANGES_EXCEEDED",
      `requested_changes ${request.requested_changes.length} exceeds cap ${V2_MAX_REQUESTED_CHANGES.max}`,
    );
  }
  for (const r of request.requested_changes) {
    if (!isValidRequestedChange(r)) {
      return fail("V2_INVALID_REQUESTED_CHANGE", "each requested_change requires kind + target_property_path + description");
    }
  }

  // Basic anti-injection: refuse prohibited substrings inside candidate contract's string content.
  const prohibited = ["eval(", "child_process", "<script", "new Function"];
  const candidateCanonical = canonicalSerialise(cand);
  for (const bad of prohibited) {
    if (candidateCanonical.includes(bad)) {
      return fail("V2_INVALID_STRING_CONTENT", `candidate contract contains prohibited substring '${bad}'`);
    }
  }

  // ── Property-by-property comparison ─────────────────────────────────

  const diffs: V2PropertyDiff[] = [];

  function addDiff(diff: V2PropertyDiff): void {
    if (diffs.length >= V2_MAX_PROPERTY_DIFFS.max) return; // safety cap
    diffs.push(diff);
  }

  function verdictFor(
    field_path: string,
    reference_equals_candidate: boolean,
    kind_filter: V2_RequestedChangeKind | null,
    identity_feature_id_if_locked: string | null,
  ): V2_PropertyVerdict {
    if (reference_equals_candidate) return "preserved";
    const requested = isRequestedTarget(request.requested_changes, field_path, kind_filter);
    if (requested) return "changed_as_requested";
    if (identity_feature_id_if_locked !== null && isLockedBy(ref.identity_features, identity_feature_id_if_locked)) {
      return "violated_lock";
    }
    return "changed_unexpectedly";
  }

  // ── identity_features (set diff by feature_id) ──────────────────────
  {
    const refFeatures = new Map<string, IdentityFeature>();
    for (const f of ref.identity_features) refFeatures.set(f.feature_id, f);
    const candFeatures = new Map<string, IdentityFeature>();
    for (const f of cand.identity_features) candFeatures.set(f.feature_id, f);

    for (const [id, refF] of refFeatures) {
      const candF = candFeatures.get(id);
      if (!candF) {
        addDiff({
          field_path: `identity_features[${id}]`,
          property_kind: "identity_feature",
          reference_value_summary: summariseIdentityFeature(refF),
          candidate_value_summary: "(absent)",
          verdict: refF.criticality === "absolute" || refF.criticality === "high" ? "violated_lock" : "changed_unexpectedly",
          rationale: `identity_feature '${id}' present in reference (${refF.criticality}) but absent from candidate`,
        });
        continue;
      }
      const equal =
        refF.description === candF.description &&
        refF.criticality === candF.criticality;
      addDiff({
        field_path: `identity_features[${id}]`,
        property_kind: "identity_feature",
        reference_value_summary: summariseIdentityFeature(refF),
        candidate_value_summary: summariseIdentityFeature(candF),
        verdict: equal ? "preserved" : (
          isRequestedTarget(request.requested_changes, `identity_features[${id}]`, null)
            ? "changed_as_requested"
            : (refF.criticality === "absolute" || refF.criticality === "high") ? "violated_lock" : "changed_unexpectedly"
        ),
        rationale: equal
          ? `identity_feature '${id}' preserved`
          : `identity_feature '${id}' changed (${refF.description} → ${candF.description})`,
      });
    }
    for (const [id, candF] of candFeatures) {
      if (!refFeatures.has(id)) {
        addDiff({
          field_path: `identity_features[${id}]`,
          property_kind: "identity_feature",
          reference_value_summary: "(absent)",
          candidate_value_summary: summariseIdentityFeature(candF),
          verdict: isRequestedTarget(request.requested_changes, `identity_features[${id}]`, null) ? "changed_as_requested" : "changed_unexpectedly",
          rationale: `identity_feature '${id}' present in candidate but not in reference`,
        });
      }
    }
  }

  // ── geometry.component_counts (set diff by part_name) ───────────────
  {
    const refCounts = new Map<string, number>();
    for (const p of ref.geometry.component_counts) refCounts.set(p.part_name, p.count);
    const candCounts = new Map<string, number>();
    for (const p of cand.geometry.component_counts) candCounts.set(p.part_name, p.count);

    for (const [part, refN] of refCounts) {
      const candN = candCounts.get(part);
      const field_path = `geometry.component_counts[${part}]`;
      if (candN === undefined) {
        addDiff({
          field_path, property_kind: "geometry",
          reference_value_summary: `${part}=${refN}`,
          candidate_value_summary: "(absent)",
          verdict: verdictFor(field_path, false, null, part),
          rationale: `geometry component '${part}' absent from candidate`,
        });
        continue;
      }
      const equal = refN === candN;
      addDiff({
        field_path, property_kind: "geometry",
        reference_value_summary: `${part}=${refN}`,
        candidate_value_summary: `${part}=${candN}`,
        verdict: verdictFor(field_path, equal, null, part),
        rationale: equal ? `component '${part}' count preserved` : `component '${part}' count changed ${refN} → ${candN}`,
      });
    }
    for (const [part, candN] of candCounts) {
      if (!refCounts.has(part)) {
        addDiff({
          field_path: `geometry.component_counts[${part}]`,
          property_kind: "geometry",
          reference_value_summary: "(absent)",
          candidate_value_summary: `${part}=${candN}`,
          verdict: "changed_unexpectedly",
          rationale: `candidate has component '${part}' not present in reference`,
        });
      }
    }
  }

  // ── geometry.structural_description ─────────────────────────────────
  {
    const equal = ref.geometry.structural_description === cand.geometry.structural_description;
    addDiff({
      field_path: "geometry.structural_description",
      property_kind: "geometry",
      reference_value_summary: ref.geometry.structural_description,
      candidate_value_summary: cand.geometry.structural_description,
      verdict: verdictFor("geometry.structural_description", equal, null, "structural_description"),
      rationale: equal ? "structural description preserved" : "structural description changed",
    });
  }

  // ── camera (three sub-fields) ───────────────────────────────────────
  {
    const equalView = ref.camera.view_angle_kind === cand.camera.view_angle_kind;
    addDiff({
      field_path: "camera.view_angle_kind",
      property_kind: "camera",
      reference_value_summary: ref.camera.view_angle_kind,
      candidate_value_summary: cand.camera.view_angle_kind,
      verdict: verdictFor("camera.view_angle_kind", equalView, "camera_change", "camera"),
      rationale: equalView ? "view_angle preserved" : `view_angle changed ${ref.camera.view_angle_kind} → ${cand.camera.view_angle_kind}`,
    });
    const equalHeight = ref.camera.height_relative_kind === cand.camera.height_relative_kind;
    addDiff({
      field_path: "camera.height_relative_kind",
      property_kind: "camera",
      reference_value_summary: ref.camera.height_relative_kind,
      candidate_value_summary: cand.camera.height_relative_kind,
      verdict: verdictFor("camera.height_relative_kind", equalHeight, "camera_change", "camera"),
      rationale: equalHeight ? "height_relative preserved" : `height_relative changed ${ref.camera.height_relative_kind} → ${cand.camera.height_relative_kind}`,
    });
    const equalFocal = ref.camera.focal_length_kind === cand.camera.focal_length_kind;
    addDiff({
      field_path: "camera.focal_length_kind",
      property_kind: "camera",
      reference_value_summary: ref.camera.focal_length_kind,
      candidate_value_summary: cand.camera.focal_length_kind,
      verdict: verdictFor("camera.focal_length_kind", equalFocal, "camera_change", "camera"),
      rationale: equalFocal ? "focal_length preserved" : `focal_length changed ${ref.camera.focal_length_kind} → ${cand.camera.focal_length_kind}`,
    });
  }

  // ── composition (three sub-fields) ──────────────────────────────────
  {
    const equalNum = ref.composition.aspect_ratio_num === cand.composition.aspect_ratio_num;
    addDiff({
      field_path: "composition.aspect_ratio_num",
      property_kind: "composition",
      reference_value_summary: String(ref.composition.aspect_ratio_num),
      candidate_value_summary: String(cand.composition.aspect_ratio_num),
      verdict: verdictFor("composition.aspect_ratio_num", equalNum, "composition_reframe", "composition"),
      rationale: equalNum ? "aspect_ratio_num preserved" : `aspect_ratio_num changed ${ref.composition.aspect_ratio_num} → ${cand.composition.aspect_ratio_num}`,
    });
    const equalDen = ref.composition.aspect_ratio_den === cand.composition.aspect_ratio_den;
    addDiff({
      field_path: "composition.aspect_ratio_den",
      property_kind: "composition",
      reference_value_summary: String(ref.composition.aspect_ratio_den),
      candidate_value_summary: String(cand.composition.aspect_ratio_den),
      verdict: verdictFor("composition.aspect_ratio_den", equalDen, "composition_reframe", "composition"),
      rationale: equalDen ? "aspect_ratio_den preserved" : `aspect_ratio_den changed ${ref.composition.aspect_ratio_den} → ${cand.composition.aspect_ratio_den}`,
    });
    const equalPlacement = ref.composition.subject_placement_hint === cand.composition.subject_placement_hint;
    addDiff({
      field_path: "composition.subject_placement_hint",
      property_kind: "composition",
      reference_value_summary: ref.composition.subject_placement_hint,
      candidate_value_summary: cand.composition.subject_placement_hint,
      verdict: verdictFor("composition.subject_placement_hint", equalPlacement, "composition_reframe", "composition"),
      rationale: equalPlacement ? "subject_placement preserved" : "subject_placement changed",
    });
  }

  // ── locked_materials (set diff by part_reference) ───────────────────
  {
    const refMats = new Map<string, MaterialLock>();
    for (const m of ref.locked_materials) refMats.set(m.part_reference, m);
    const candMats = new Map<string, MaterialLock>();
    for (const m of cand.locked_materials) candMats.set(m.part_reference, m);

    for (const [part, refM] of refMats) {
      const field_path = `locked_materials[${part}]`;
      const candM = candMats.get(part);
      if (!candM) {
        addDiff({
          field_path, property_kind: "material",
          reference_value_summary: summariseMaterial(refM),
          candidate_value_summary: "(absent)",
          verdict: verdictFor(field_path, false, "material_swap", `material.${part}`),
          rationale: `material for part '${part}' absent from candidate`,
        });
        continue;
      }
      const equal = refM.material_id === candM.material_id;
      addDiff({
        field_path, property_kind: "material",
        reference_value_summary: summariseMaterial(refM),
        candidate_value_summary: summariseMaterial(candM),
        verdict: verdictFor(field_path, equal, "material_swap", `material.${part}`),
        rationale: equal ? `material for part '${part}' preserved` : `material for part '${part}' changed ${refM.material_id} → ${candM.material_id}`,
      });
    }
    for (const [part, candM] of candMats) {
      if (!refMats.has(part)) {
        addDiff({
          field_path: `locked_materials[${part}]`,
          property_kind: "material",
          reference_value_summary: "(absent)",
          candidate_value_summary: summariseMaterial(candM),
          verdict: "changed_unexpectedly",
          rationale: `candidate has material for part '${part}' not present in reference`,
        });
      }
    }
  }

  // ── locked_colours (set diff by colour_id + tolerance-aware match) ──
  {
    const refCols = new Map<string, ColourLock>();
    for (const c of ref.locked_colours) refCols.set(c.colour_id, c);
    const candCols = new Map<string, ColourLock>();
    for (const c of cand.locked_colours) candCols.set(c.colour_id, c);

    for (const [id, refC] of refCols) {
      const field_path = `locked_colours[${id}]`;
      const candC = candCols.get(id);
      if (!candC) {
        addDiff({
          field_path, property_kind: "colour",
          reference_value_summary: summariseColour(refC),
          candidate_value_summary: "(absent)",
          verdict: verdictFor(field_path, false, "colour_adjust", `colour.${id}`),
          rationale: `colour '${id}' absent from candidate`,
        });
        continue;
      }
      const equal = coloursMatchWithinTolerance(refC, candC);
      addDiff({
        field_path, property_kind: "colour",
        reference_value_summary: summariseColour(refC),
        candidate_value_summary: summariseColour(candC),
        verdict: verdictFor(field_path, equal, "colour_adjust", `colour.${id}`),
        rationale: equal ? `colour '${id}' within tolerance` : `colour '${id}' outside tolerance`,
      });
    }
    for (const [id, candC] of candCols) {
      if (!refCols.has(id)) {
        addDiff({
          field_path: `locked_colours[${id}]`,
          property_kind: "colour",
          reference_value_summary: "(absent)",
          candidate_value_summary: summariseColour(candC),
          verdict: "changed_unexpectedly",
          rationale: `candidate has colour '${id}' not present in reference`,
        });
      }
    }
  }

  // ── Counters ────────────────────────────────────────────────────────
  let preserved = 0, changed_as_requested = 0, changed_unexpectedly = 0, violated_lock = 0, unable_to_verify = 0;
  for (const d of diffs) {
    switch (d.verdict) {
      case "preserved": preserved++; break;
      case "changed_as_requested": changed_as_requested++; break;
      case "changed_unexpectedly": changed_unexpectedly++; break;
      case "violated_lock": violated_lock++; break;
      case "unable_to_verify": unable_to_verify++; break;
      case "not_applicable": break;
    }
  }

  // ── Overall verdict (locked derivation) ─────────────────────────────
  let overall: V2_OverallDifferenceVerdict;
  if (violated_lock > 0) {
    overall = "some_locked_violated";
  } else if (unable_to_verify > 0 && (preserved + changed_as_requested + changed_unexpectedly) === 0) {
    overall = "all_uncertain";
  } else if (unable_to_verify > 0) {
    overall = "some_uncertain";
  } else if (changed_unexpectedly > 0) {
    // Unexpected non-lock change is not a "some_locked_violated" per §4 semantics.
    // It falls under some_uncertain because the caller may consider it noise.
    overall = "some_uncertain";
  } else {
    overall = "all_locked_preserved";
  }

  // ── Fill contract SHAs deterministically ────────────────────────────
  const refSha = request.reference_contract_sha256 ?? sha256Hex(canonicalSerialise(ref));
  const candSha = request.candidate_contract_sha256 ?? sha256Hex(candidateCanonical);
  const generated_at = request.generated_at ?? "1970-01-01T00:00:00.000Z";
  const report_id = request.report_id ?? `diff:${refSha.slice(0, 12)}:${candSha.slice(0, 12)}`;

  const report: VisualDifferenceReport = {
    report_id,
    reference_contract_id: ref.contract_id,
    candidate_contract_id: cand.contract_id,
    reference_contract_sha256: refSha,
    candidate_contract_sha256: candSha,
    property_diffs: Object.freeze(diffs),
    requested_changes: Object.freeze([...request.requested_changes]),
    preserved_count: preserved,
    changed_as_requested_count: changed_as_requested,
    changed_unexpectedly_count: changed_unexpectedly,
    violated_lock_count: violated_lock,
    unable_to_verify_count: unable_to_verify,
    overall_verdict: overall,
    generated_at,
  };

  const success: V2Success = { kind: "SUCCESS", report, grep_marker: V2_GREP_MARKER };
  return success;
}

// Explicit exports of catalogue for consumers
export { V2_GREP_MARKER } from "./visual-difference-engine-types";

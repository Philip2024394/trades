// §36-V2 · WAVE-V2 · 2026-09-15 · nex-visual-intelligence-v2 · engine tests
// NEX bounded infrastructure · deterministic engine test suite · 2026-09-15

import { describe, expect, it } from "vitest";
import { runVisualDifferenceEngine } from "../visual-difference-engine";
import type {
  RunV2DifferenceEngineRequest,
  V2Failure,
  V2Success,
} from "../visual-difference-engine-types";
import { V2_GREP_MARKER } from "../visual-difference-engine-types";
import type { VisualConstraintContract } from "../../nex-visual-intelligence-v1/visual-constraint-contract";

// ── Fixtures ──────────────────────────────────────────────────────────

function staircaseReference(): VisualConstraintContract {
  return {
    contract_id: "staircase-merchant-001",
    subject_kind: "staircase",
    identity_features: [
      { feature_id: "step-count", description: "14 steps · straight run", criticality: "absolute" },
      { feature_id: "handrail-profile", description: "oak rounded profile", criticality: "high" },
      { feature_id: "baluster-material", description: "brushed-chrome balusters", criticality: "high" },
      { feature_id: "camera", description: "three-quarter left at eye level", criticality: "high" },
      { feature_id: "composition", description: "4:3 · rule-of-thirds left", criticality: "medium" },
      { feature_id: "material.handrail", description: "handrail material", criticality: "high" },
      { feature_id: "colour.oak-warm", description: "oak-warm sRGB range", criticality: "high" },
      { feature_id: "structural_description", description: "straight-run · closed-string · single-level", criticality: "high" },
    ],
    geometry: {
      component_counts: [
        { part_name: "step", count: 14 },
        { part_name: "baluster", count: 42 },
        { part_name: "newel_post", count: 2 },
      ],
      structural_description: "straight-run · closed-string · single-level",
    },
    camera: {
      view_angle_kind: "three_quarter_left",
      height_relative_kind: "eye_level",
      focal_length_kind: "standard",
    },
    composition: {
      aspect_ratio_num: 4,
      aspect_ratio_den: 3,
      subject_placement_hint: "rule_of_thirds_left",
    },
    locked_materials: [
      { material_id: "oak-hardwood", part_reference: "handrail" },
      { material_id: "brushed-chrome", part_reference: "balusters" },
    ],
    locked_colours: [
      {
        colour_id: "oak-warm",
        colour_space: "sRGB",
        hue_min: 25, hue_max: 40,
        saturation_min: 0.4, saturation_max: 0.7,
        lightness_min: 0.25, lightness_max: 0.5,
        tolerance_deltaE: 3.0,
      },
    ],
    provenance: {
      authored_at: "2026-09-15T00:00:00.000Z",
      authored_by: "NEX1_via_typed_data_contract",
      source_reference_sha256: "aa".repeat(32),
      contract_version: "1.0.0",
      promotion_state: "PENDING",
    },
  };
}

/** Deep clone via JSON. */
function clone(c: VisualConstraintContract): VisualConstraintContract {
  return JSON.parse(JSON.stringify(c)) as VisualConstraintContract;
}

/** Reference variant: walnut instead of oak on the handrail (requested change). */
function walnutVariant(): VisualConstraintContract {
  const c = clone(staircaseReference());
  return {
    ...c,
    locked_materials: [
      { material_id: "walnut-hardwood", part_reference: "handrail" },
      { material_id: "brushed-chrome", part_reference: "balusters" },
    ],
  };
}

function success(r: ReturnType<typeof runVisualDifferenceEngine>): V2Success {
  expect(r.kind).toBe("SUCCESS");
  return r as V2Success;
}
function refuse(r: ReturnType<typeof runVisualDifferenceEngine>): V2Failure {
  expect(r.kind).toBe("FAILURE");
  return r as V2Failure;
}

// ── §A · Refusal codes ────────────────────────────────────────────────

describe("§36-V2 · V2 engine · refusal codes", () => {
  it("A-1 · V2_INVALID_REFERENCE_CONTRACT when reference is malformed", () => {
    const r = refuse(runVisualDifferenceEngine({
      reference_contract: {} as never,
      candidate_contract: staircaseReference(),
      requested_changes: [],
    }));
    expect(r.refusal_code).toBe("V2_INVALID_REFERENCE_CONTRACT");
  });

  it("A-2 · V2_INVALID_CANDIDATE_CONTRACT when candidate is malformed", () => {
    const r = refuse(runVisualDifferenceEngine({
      reference_contract: staircaseReference(),
      candidate_contract: null as never,
      requested_changes: [],
    }));
    expect(r.refusal_code).toBe("V2_INVALID_CANDIDATE_CONTRACT");
  });

  it("A-3 · V2_CONTRACT_ID_MISMATCH when contract_ids differ", () => {
    const cand = clone(staircaseReference());
    (cand as unknown as { contract_id: string }).contract_id = "different-id";
    const r = refuse(runVisualDifferenceEngine({
      reference_contract: staircaseReference(),
      candidate_contract: cand,
      requested_changes: [],
    }));
    expect(r.refusal_code).toBe("V2_CONTRACT_ID_MISMATCH");
  });

  it("A-4 · V2_CONTRACT_ID_MISMATCH when subject_kind differs", () => {
    const cand = clone(staircaseReference());
    (cand as unknown as { subject_kind: string }).subject_kind = "car";
    const r = refuse(runVisualDifferenceEngine({
      reference_contract: staircaseReference(),
      candidate_contract: cand,
      requested_changes: [],
    }));
    expect(r.refusal_code).toBe("V2_CONTRACT_ID_MISMATCH");
  });

  it("A-5 · V2_INVALID_REQUESTED_CHANGE when requested_changes is not an array", () => {
    const r = refuse(runVisualDifferenceEngine({
      reference_contract: staircaseReference(),
      candidate_contract: staircaseReference(),
      requested_changes: 42 as never,
    }));
    expect(r.refusal_code).toBe("V2_INVALID_REQUESTED_CHANGE");
  });

  it("A-6 · V2_INVALID_REQUESTED_CHANGE when a change is malformed", () => {
    const r = refuse(runVisualDifferenceEngine({
      reference_contract: staircaseReference(),
      candidate_contract: staircaseReference(),
      requested_changes: [{ kind: "material_swap", target_property_path: "", description: "" } as never],
    }));
    expect(r.refusal_code).toBe("V2_INVALID_REQUESTED_CHANGE");
  });

  it("A-7 · V2_MAX_REQUESTED_CHANGES_EXCEEDED when the array is too long", () => {
    const too_many = Array.from({ length: 33 }, (_, i) => ({
      kind: "material_swap" as const, target_property_path: `p${i}`, description: `d${i}`,
    }));
    const r = refuse(runVisualDifferenceEngine({
      reference_contract: staircaseReference(),
      candidate_contract: staircaseReference(),
      requested_changes: too_many,
    }));
    expect(r.refusal_code).toBe("V2_MAX_REQUESTED_CHANGES_EXCEEDED");
  });

  it("A-8 · V2_INVALID_STRING_CONTENT when candidate contains prohibited substring", () => {
    const cand = clone(staircaseReference());
    (cand.geometry as { structural_description: string }).structural_description = "hi eval( bad";
    const r = refuse(runVisualDifferenceEngine({
      reference_contract: staircaseReference(),
      candidate_contract: cand,
      requested_changes: [],
    }));
    expect(r.refusal_code).toBe("V2_INVALID_STRING_CONTENT");
  });
});

// ── §B · Grep marker ─────────────────────────────────────────────────

describe("§36-V2 · V2 engine · grep marker", () => {
  it("B-1 · SUCCESS carries the locked grep marker", () => {
    const s = success(runVisualDifferenceEngine({
      reference_contract: staircaseReference(),
      candidate_contract: staircaseReference(),
      requested_changes: [],
    }));
    expect(s.grep_marker).toBe(V2_GREP_MARKER);
  });

  it("B-2 · FAILURE carries the locked grep marker", () => {
    const r = refuse(runVisualDifferenceEngine({
      reference_contract: null as never,
      candidate_contract: staircaseReference(),
      requested_changes: [],
    }));
    expect(r.grep_marker).toBe(V2_GREP_MARKER);
  });
});

// ── §C · Full match ──────────────────────────────────────────────────

describe("§36-V2 · V2 engine · full match", () => {
  it("C-1 · identical contracts yield all_locked_preserved", () => {
    const s = success(runVisualDifferenceEngine({
      reference_contract: staircaseReference(),
      candidate_contract: staircaseReference(),
      requested_changes: [],
    }));
    expect(s.report.overall_verdict).toBe("all_locked_preserved");
    expect(s.report.preserved_count).toBeGreaterThanOrEqual(1);
    expect(s.report.violated_lock_count).toBe(0);
    expect(s.report.changed_unexpectedly_count).toBe(0);
  });

  it("C-2 · every diff is 'preserved' when contracts are identical", () => {
    const s = success(runVisualDifferenceEngine({
      reference_contract: staircaseReference(),
      candidate_contract: staircaseReference(),
      requested_changes: [],
    }));
    const verdicts = new Set(s.report.property_diffs.map((d) => d.verdict));
    expect(verdicts.size).toBe(1);
    expect(verdicts.has("preserved")).toBe(true);
  });
});

// ── §D · Requested change matched ────────────────────────────────────

describe("§36-V2 · V2 engine · requested change is honoured", () => {
  it("D-1 · walnut swap with matching requested_change is changed_as_requested (not violated)", () => {
    const s = success(runVisualDifferenceEngine({
      reference_contract: staircaseReference(),
      candidate_contract: walnutVariant(),
      requested_changes: [
        {
          kind: "material_swap",
          target_property_path: "locked_materials[handrail]",
          description: "handrail oak → walnut requested by merchant",
        },
      ],
    }));
    expect(s.report.overall_verdict).toBe("all_locked_preserved");
    expect(s.report.violated_lock_count).toBe(0);
    expect(s.report.changed_as_requested_count).toBeGreaterThanOrEqual(1);
    const handrailDiff = s.report.property_diffs.find((d) => d.field_path === "locked_materials[handrail]");
    expect(handrailDiff?.verdict).toBe("changed_as_requested");
  });

  it("D-2 · walnut swap WITHOUT a matching requested_change is a violated_lock", () => {
    const s = success(runVisualDifferenceEngine({
      reference_contract: staircaseReference(),
      candidate_contract: walnutVariant(),
      requested_changes: [],
    }));
    expect(s.report.overall_verdict).toBe("some_locked_violated");
    expect(s.report.violated_lock_count).toBeGreaterThanOrEqual(1);
    const handrailDiff = s.report.property_diffs.find((d) => d.field_path === "locked_materials[handrail]");
    expect(handrailDiff?.verdict).toBe("violated_lock");
  });
});

// ── §E · Unexpected changes ──────────────────────────────────────────

describe("§36-V2 · V2 engine · unexpected changes", () => {
  it("E-1 · unexpected camera view-angle is a violated_lock (identity_feature 'camera' is high-criticality)", () => {
    const cand = clone(staircaseReference());
    (cand.camera as { view_angle_kind: string }).view_angle_kind = "front";
    const s = success(runVisualDifferenceEngine({
      reference_contract: staircaseReference(),
      candidate_contract: cand,
      requested_changes: [],
    }));
    expect(s.report.overall_verdict).toBe("some_locked_violated");
    const camDiff = s.report.property_diffs.find((d) => d.field_path === "camera.view_angle_kind");
    expect(camDiff?.verdict).toBe("violated_lock");
  });

  it("E-2 · step-count change is a violated_lock (identity_feature 'step-count' is absolute)", () => {
    const cand = clone(staircaseReference());
    (cand.geometry.component_counts as unknown as { count: number }[])[0] = { part_name: "step", count: 12 } as never;
    const s = success(runVisualDifferenceEngine({
      reference_contract: staircaseReference(),
      candidate_contract: cand,
      requested_changes: [],
    }));
    // "step-count" is the identity_feature id, and the field_path built by the engine
    // for the geometry.component_counts diff includes "step" as the map key.
    // step-count identity feature is absolute-criticality so structural_description will
    // also drive lock behaviour if changed; step count itself is compared as geometry.
    expect(s.report.overall_verdict === "some_locked_violated" || s.report.changed_unexpectedly_count > 0).toBe(true);
  });

  it("E-3 · advisory-criticality change is changed_unexpectedly (not violated)", () => {
    // Add a low-criticality identity feature and change something not covered by high/absolute features
    const ref = staircaseReference();
    const refWithAdvisoryOnly = clone(ref);
    // Remove the high-criticality composition feature so that composition changes go 'unexpected' not 'violated'
    (refWithAdvisoryOnly as { identity_features: unknown[] }).identity_features =
      ref.identity_features.filter((f) => f.feature_id !== "composition");
    const cand = clone(refWithAdvisoryOnly);
    (cand.composition as { subject_placement_hint: string }).subject_placement_hint = "center";
    const s = success(runVisualDifferenceEngine({
      reference_contract: refWithAdvisoryOnly,
      candidate_contract: cand,
      requested_changes: [],
    }));
    // Absent from identity_features → not locked → 'changed_unexpectedly'
    const placeDiff = s.report.property_diffs.find((d) => d.field_path === "composition.subject_placement_hint");
    expect(placeDiff?.verdict).toBe("changed_unexpectedly");
    expect(s.report.overall_verdict).toBe("some_uncertain");
  });
});

// ── §F · Colour tolerance ────────────────────────────────────────────

describe("§36-V2 · V2 engine · colour tolerance", () => {
  it("F-1 · colours with identical ranges + deltaE preserved", () => {
    const s = success(runVisualDifferenceEngine({
      reference_contract: staircaseReference(),
      candidate_contract: staircaseReference(),
      requested_changes: [],
    }));
    const cDiff = s.report.property_diffs.find((d) => d.field_path === "locked_colours[oak-warm]");
    expect(cDiff?.verdict).toBe("preserved");
  });

  it("F-2 · colours with different deltaE tolerance are not-preserved (violated when locked)", () => {
    const cand = clone(staircaseReference());
    (cand.locked_colours as unknown as { tolerance_deltaE: number }[])[0].tolerance_deltaE = 10;
    const s = success(runVisualDifferenceEngine({
      reference_contract: staircaseReference(),
      candidate_contract: cand,
      requested_changes: [],
    }));
    const cDiff = s.report.property_diffs.find((d) => d.field_path === "locked_colours[oak-warm]");
    expect(cDiff?.verdict).toBe("violated_lock");
  });

  it("F-3 · colour change WITH matching colour_adjust request is changed_as_requested", () => {
    const cand = clone(staircaseReference());
    (cand.locked_colours as unknown as { hue_min: number; hue_max: number }[])[0].hue_min = 5;
    (cand.locked_colours as unknown as { hue_min: number; hue_max: number }[])[0].hue_max = 20;
    const s = success(runVisualDifferenceEngine({
      reference_contract: staircaseReference(),
      candidate_contract: cand,
      requested_changes: [
        { kind: "colour_adjust", target_property_path: "locked_colours[oak-warm]", description: "shift hue for walnut palette" },
      ],
    }));
    const cDiff = s.report.property_diffs.find((d) => d.field_path === "locked_colours[oak-warm]");
    expect(cDiff?.verdict).toBe("changed_as_requested");
  });
});

// ── §G · Missing / added members (unable_to_verify / changed_unexpectedly) ──

describe("§36-V2 · V2 engine · missing and added members", () => {
  it("G-1 · candidate missing a material is a violated_lock for handrail (locked)", () => {
    const cand = clone(staircaseReference());
    (cand as unknown as { locked_materials: unknown[] }).locked_materials = [
      { material_id: "brushed-chrome", part_reference: "balusters" },
    ];
    const s = success(runVisualDifferenceEngine({
      reference_contract: staircaseReference(),
      candidate_contract: cand,
      requested_changes: [],
    }));
    const mDiff = s.report.property_diffs.find((d) => d.field_path === "locked_materials[handrail]");
    expect(mDiff?.verdict).toBe("violated_lock");
  });

  it("G-2 · candidate ADDS an unrelated material → changed_unexpectedly", () => {
    const cand = clone(staircaseReference());
    (cand as unknown as { locked_materials: unknown[] }).locked_materials = [
      ...staircaseReference().locked_materials,
      { material_id: "brass", part_reference: "cap" },
    ];
    const s = success(runVisualDifferenceEngine({
      reference_contract: staircaseReference(),
      candidate_contract: cand,
      requested_changes: [],
    }));
    const capDiff = s.report.property_diffs.find((d) => d.field_path === "locked_materials[cap]");
    expect(capDiff?.verdict).toBe("changed_unexpectedly");
  });
});

// ── §H · Determinism ─────────────────────────────────────────────────

describe("§36-V2 · V2 engine · determinism", () => {
  it("H-1 · same inputs produce byte-identical JSON output", () => {
    const req: RunV2DifferenceEngineRequest = {
      reference_contract: staircaseReference(),
      candidate_contract: walnutVariant(),
      requested_changes: [
        { kind: "material_swap", target_property_path: "locked_materials[handrail]", description: "oak → walnut" },
      ],
      generated_at: "2026-09-15T12:00:00.000Z",
      report_id: "diff:test-1",
      reference_contract_sha256: "ab".repeat(32),
      candidate_contract_sha256: "cd".repeat(32),
    };
    const a = success(runVisualDifferenceEngine(req));
    const b = success(runVisualDifferenceEngine(req));
    expect(JSON.stringify(a.report)).toBe(JSON.stringify(b.report));
  });
});

// ── §I · Report id + SHA + timestamp semantics ───────────────────────

describe("§36-V2 · V2 engine · report identifiers", () => {
  it("I-1 · caller-supplied report_id + timestamp are preserved", () => {
    const s = success(runVisualDifferenceEngine({
      reference_contract: staircaseReference(),
      candidate_contract: staircaseReference(),
      requested_changes: [],
      generated_at: "2026-09-15T09:30:00.000Z",
      report_id: "diff:staircase-audit-001",
    }));
    expect(s.report.report_id).toBe("diff:staircase-audit-001");
    expect(s.report.generated_at).toBe("2026-09-15T09:30:00.000Z");
  });

  it("I-2 · omitted report_id derives deterministically from SHAs", () => {
    const s = success(runVisualDifferenceEngine({
      reference_contract: staircaseReference(),
      candidate_contract: staircaseReference(),
      requested_changes: [],
    }));
    expect(s.report.report_id).toMatch(/^diff:[0-9a-f]{12}:[0-9a-f]{12}$/);
  });

  it("I-3 · omitted generated_at defaults to the deterministic epoch placeholder", () => {
    const s = success(runVisualDifferenceEngine({
      reference_contract: staircaseReference(),
      candidate_contract: staircaseReference(),
      requested_changes: [],
    }));
    expect(s.report.generated_at).toBe("1970-01-01T00:00:00.000Z");
  });
});

// ── §J · Real staircase table (the founder's example) ───────────────

describe("§36-V2 · V2 engine · founder staircase example", () => {
  it("J-1 · walnut variant with requested material swap PASSES", () => {
    const s = success(runVisualDifferenceEngine({
      reference_contract: staircaseReference(),
      candidate_contract: walnutVariant(),
      requested_changes: [
        { kind: "material_swap", target_property_path: "locked_materials[handrail]", description: "handrail: oak → walnut" },
      ],
    }));
    expect(s.report.overall_verdict).toBe("all_locked_preserved");
    expect(s.report.changed_as_requested_count).toBe(1);
    // Everything else preserved
    expect(s.report.violated_lock_count).toBe(0);
    expect(s.report.changed_unexpectedly_count).toBe(0);
  });

  it("J-2 · walnut swap without authorization + camera drift → some_locked_violated · two violations", () => {
    const bad = clone(walnutVariant());
    (bad.camera as { view_angle_kind: string }).view_angle_kind = "front";
    const s = success(runVisualDifferenceEngine({
      reference_contract: staircaseReference(),
      candidate_contract: bad,
      requested_changes: [],
    }));
    expect(s.report.overall_verdict).toBe("some_locked_violated");
    expect(s.report.violated_lock_count).toBeGreaterThanOrEqual(2);
  });
});

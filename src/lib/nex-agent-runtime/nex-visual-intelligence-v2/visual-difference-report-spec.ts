// §36-V2 · WAVE-V2 · 2026-09-15 · nex-visual-intelligence-v2 · spec
// NEX bounded infrastructure · Visual Difference Report spec module · 2026-09-15
// Authored as bounded NEX infrastructure per Perpetual Coder Rule.
//
// This module holds the TypedDataContractSpec pair that NEX1 uses to
// author the DifferenceReport shape (V2's typed data output). The specs
// themselves are MAI infrastructure; the BYTES emitted by
// authorTypedDataContract are NEX1-authored capability bytes.
//
// Wave V2 emits TWO capability files:
//   1. visual-difference-report-ranges.ts — 2 numeric ranges + 4 literal
//      unions + 1 refusal reason union (7 declarations)
//   2. visual-difference-report.ts — 3 interfaces (type-only imports
//      from ranges)
//
// The V2 comparator function (visual-difference-engine.ts) is separate
// MAI infrastructure that CONSUMES V1 contracts + POPULATES the NEX1-
// authored DifferenceReport shape.

import type { TypedDataContractSpec, StyleProfile } from "../programming-mission/types";

export const V2_STYLE: StyleProfile = {
  naming_convention: "camelCase",
  export_style: "named",
  semicolons: "yes",
  quote_style: "double",
  test_framework: "vitest",
  detected_from_files: [],
  detection_confidence: "high",
};

export const V2_RANGES_TARGET_PATH = "output/visual-difference-report-ranges.ts" as const;
export const V2_REPORT_TARGET_PATH = "output/visual-difference-report.ts" as const;

const V2_HEADER = (
  "// §36-V2 · WAVE-V2 · 2026-09-15 · nex-visual-intelligence-v2\n" +
  "// Coded by NEX1 via typed_data_contract · 2026-09-15\n" +
  "// This file's BYTES were emitted by authorTypedDataContract from a MAI-authored spec.\n" +
  "// The spec lives at src/lib/nex-agent-runtime/nex-visual-intelligence-v2/visual-difference-report-spec.ts (MAI infrastructure).\n" +
  "// The bytes below are NEX1-authored capability. Do not hand-edit."
);

export function buildV2RangesSpec(): TypedDataContractSpec {
  return {
    contract_name: "VisualDifferenceReportRanges",
    header_comment: V2_HEADER,
    type_only_imports: [],
    declarations: [
      { declaration_kind: "numeric_range_constant", name: "V2_MAX_PROPERTY_DIFFS", min: 0, max: 128, exported: true },
      { declaration_kind: "numeric_range_constant", name: "V2_MAX_REQUESTED_CHANGES", min: 0, max: 32, exported: true },
      {
        declaration_kind: "literal_union",
        name: "V2_PropertyKind",
        literals: [
          "identity_feature",
          "geometry",
          "camera",
          "composition",
          "material",
          "colour",
          "provenance",
          "free_property",
        ],
        exported: true,
      },
      {
        declaration_kind: "literal_union",
        name: "V2_PropertyVerdict",
        literals: [
          "preserved",
          "changed_as_requested",
          "changed_unexpectedly",
          "violated_lock",
          "unable_to_verify",
          "not_applicable",
        ],
        exported: true,
      },
      {
        declaration_kind: "literal_union",
        name: "V2_RequestedChangeKind",
        literals: [
          "material_swap",
          "camera_change",
          "environment_change",
          "colour_adjust",
          "composition_reframe",
          "motion_activate",
          "none",
        ],
        exported: true,
      },
      {
        declaration_kind: "literal_union",
        name: "V2_OverallDifferenceVerdict",
        literals: [
          "all_locked_preserved",
          "some_locked_violated",
          "some_uncertain",
          "all_uncertain",
        ],
        exported: true,
      },
      {
        declaration_kind: "refusal_reason_union",
        name: "V2_DifferenceReportRefusalReason",
        reasons: [
          "V2_INVALID_REFERENCE_CONTRACT",
          "V2_INVALID_CANDIDATE_CONTRACT",
          "V2_CONTRACT_ID_MISMATCH",
          "V2_INVALID_REQUESTED_CHANGE",
          "V2_MAX_PROPERTY_DIFFS_EXCEEDED",
          "V2_MAX_REQUESTED_CHANGES_EXCEEDED",
          "V2_INVALID_STRING_CONTENT",
          "V2_INTERNAL",
        ],
        exported: true,
      },
    ],
  };
}

export function buildV2ReportSpec(): TypedDataContractSpec {
  return {
    contract_name: "VisualDifferenceReport",
    header_comment: V2_HEADER,
    type_only_imports: [
      { symbol: "V2_PropertyKind", from_specifier: "./visual-difference-report-ranges" },
      { symbol: "V2_PropertyVerdict", from_specifier: "./visual-difference-report-ranges" },
      { symbol: "V2_RequestedChangeKind", from_specifier: "./visual-difference-report-ranges" },
      { symbol: "V2_OverallDifferenceVerdict", from_specifier: "./visual-difference-report-ranges" },
    ],
    declarations: [
      {
        declaration_kind: "interface",
        name: "V2RequestedChange",
        exported: true,
        fields: [
          { name: "kind", type: { kind: "reference", to: "V2_RequestedChangeKind" }, optional: false, readonly_modifier: true },
          { name: "target_property_path", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "description", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
        ],
      },
      {
        declaration_kind: "interface",
        name: "V2PropertyDiff",
        exported: true,
        fields: [
          { name: "field_path", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "property_kind", type: { kind: "reference", to: "V2_PropertyKind" }, optional: false, readonly_modifier: true },
          { name: "reference_value_summary", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "candidate_value_summary", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "verdict", type: { kind: "reference", to: "V2_PropertyVerdict" }, optional: false, readonly_modifier: true },
          { name: "rationale", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
        ],
      },
      {
        declaration_kind: "interface",
        name: "VisualDifferenceReport",
        exported: true,
        fields: [
          { name: "report_id", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "reference_contract_id", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "candidate_contract_id", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "reference_contract_sha256", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "candidate_contract_sha256", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          {
            name: "property_diffs",
            type: { kind: "array", element: { kind: "reference", to: "V2PropertyDiff" } },
            optional: false,
            readonly_modifier: true,
          },
          {
            name: "requested_changes",
            type: { kind: "array", element: { kind: "reference", to: "V2RequestedChange" } },
            optional: false,
            readonly_modifier: true,
          },
          { name: "preserved_count", type: { kind: "primitive", type: "number" }, optional: false, readonly_modifier: true },
          { name: "changed_as_requested_count", type: { kind: "primitive", type: "number" }, optional: false, readonly_modifier: true },
          { name: "changed_unexpectedly_count", type: { kind: "primitive", type: "number" }, optional: false, readonly_modifier: true },
          { name: "violated_lock_count", type: { kind: "primitive", type: "number" }, optional: false, readonly_modifier: true },
          { name: "unable_to_verify_count", type: { kind: "primitive", type: "number" }, optional: false, readonly_modifier: true },
          { name: "overall_verdict", type: { kind: "reference", to: "V2_OverallDifferenceVerdict" }, optional: false, readonly_modifier: true },
          { name: "generated_at", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
        ],
      },
    ],
  };
}

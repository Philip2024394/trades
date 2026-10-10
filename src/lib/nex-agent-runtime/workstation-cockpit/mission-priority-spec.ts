// §36-W-2 · WAVE-W2 · 2026-09-14 · workstation-cockpit · mission-priority spec
// NEX bounded infrastructure · mission-priority-contract spec (fixture) · 2026-09-14
// Authored as bounded NEX infrastructure per Perpetual Coder Rule.
//
// This file holds the exact TypedDataContractSpec that NEX1 uses to author
// the MissionPriorityContract. The spec itself is MAI infrastructure; the
// BYTES emitted by authorTypedDataContract(spec, ...) are what NEX1 authored.
// The distinction is preserved by shipping the spec here but the emitted
// contract file at src/lib/nex-agent-runtime/mission-priority-contract/
// which carries an explicit "Coded by NEX1 via typed_data_contract" header.

import type { TypedDataContractSpec, StyleProfile } from "../programming-mission/types";

export const MISSION_PRIORITY_STYLE: StyleProfile = {
  naming_convention: "camelCase",
  export_style: "named",
  semicolons: "yes",
  quote_style: "double",
  test_framework: "vitest",
  detected_from_files: [],
  detection_confidence: "high",
};

export const MISSION_PRIORITY_TARGET_PATH = "output/mission-priority-contract.ts" as const;

export function buildMissionPrioritySpec(): TypedDataContractSpec {
  return {
    contract_name: "MissionPriorityContract",
    header_comment:
      "// §36-W-2 · WAVE-W2 · 2026-09-14 · mission-priority-contract\n" +
      "// Coded by NEX1 via typed_data_contract · 2026-09-14\n" +
      "// This file's BYTES were emitted by the authorTypedDataContract primitive from a spec.\n" +
      "// The spec lives at src/lib/nex-agent-runtime/workstation-cockpit/mission-priority-spec.ts (MAI infrastructure).\n" +
      "// The bytes are NEX1-authored capability. Do not hand-edit.",
    type_only_imports: [],
    declarations: [
      {
        declaration_kind: "numeric_range_constant",
        name: "MISSION_PRIORITY_BOUNDS",
        min: 0,
        max: 100,
        exported: true,
      },
      {
        declaration_kind: "literal_union",
        name: "MissionPriorityBand",
        literals: ["low", "medium", "high", "critical"],
        exported: true,
      },
      {
        declaration_kind: "refusal_reason_union",
        name: "MissionPriorityRefusalReason",
        reasons: [
          "MP_PRIORITY_OUT_OF_BOUNDS",
          "MP_BAND_UNKNOWN",
          "MP_MISSION_ID_INVALID",
        ],
        exported: true,
      },
      {
        declaration_kind: "interface",
        name: "MissionPriorityRecord",
        exported: true,
        fields: [
          { name: "mission_id", type: { kind: "primitive", type: "string" }, optional: false, readonly_modifier: true },
          { name: "priority_score", type: { kind: "primitive", type: "number" }, optional: false, readonly_modifier: true },
          { name: "band", type: { kind: "reference", to: "MissionPriorityBand" }, optional: false, readonly_modifier: true },
        ],
      },
    ],
  };
}

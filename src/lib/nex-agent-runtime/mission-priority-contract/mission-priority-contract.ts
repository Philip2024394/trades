// §36-A · ROUTE-2 · 2026-09-14 · typed-data-contract authored file.
// Contract: MissionPriorityContract
// Deterministic byte-stable output. Do not edit by hand.
//
// // §36-W-2 · WAVE-W2 · 2026-09-14 · mission-priority-contract
// // Coded by NEX1 via typed_data_contract · 2026-09-14
// // This file's BYTES were emitted by the authorTypedDataContract primitive from a spec.
// // The spec lives at src/lib/nex-agent-runtime/workstation-cockpit/mission-priority-spec.ts (MAI infrastructure).
// // The bytes are NEX1-authored capability. Do not hand-edit.

export const MISSION_PRIORITY_BOUNDS: { readonly min: number; readonly max: number } = Object.freeze({ min: 0, max: 100 });

export type MissionPriorityBand =
  | "low"
  | "medium"
  | "high"
  | "critical";

export const MissionPriorityBand_MEMBERS: readonly MissionPriorityBand[] = Object.freeze(["low", "medium", "high", "critical"]);

export type MissionPriorityRefusalReason =
  | "MP_PRIORITY_OUT_OF_BOUNDS"
  | "MP_BAND_UNKNOWN"
  | "MP_MISSION_ID_INVALID";

export const MissionPriorityRefusalReason_MEMBERS: readonly MissionPriorityRefusalReason[] = Object.freeze(["MP_PRIORITY_OUT_OF_BOUNDS", "MP_BAND_UNKNOWN", "MP_MISSION_ID_INVALID"]);

export interface MissionPriorityRecord {
  readonly mission_id: string;
  readonly priority_score: number;
  readonly band: MissionPriorityBand;
}

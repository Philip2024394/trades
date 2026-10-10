// §36-V2 · WAVE-V2 · 2026-09-15 · nex-visual-intelligence-v2 · engine types
// NEX bounded infrastructure · engine request/response types · 2026-09-15
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT
// NEX1-authored capability.
//
// The engine's request/response shape is a runtime discriminated union
// (SUCCESS | FAILURE) which is outside the typed_data_contract grammar.
// The DifferenceReport itself (produced INSIDE a SUCCESS) is NEX1-authored
// via typed_data_contract (see visual-difference-report-spec.ts).

import type { VisualConstraintContract } from "../nex-visual-intelligence-v1/visual-constraint-contract";
import type {
  V2_DifferenceReportRefusalReason,
} from "./visual-difference-report-ranges";
import type {
  V2RequestedChange,
  VisualDifferenceReport,
} from "./visual-difference-report";

export const V2_GREP_MARKER = "§36-V2 · WAVE-V2 · 2026-09-15 · nex-visual-intelligence-v2" as const;
export type V2GrepMarker = typeof V2_GREP_MARKER;

export interface RunV2DifferenceEngineRequest {
  readonly reference_contract: VisualConstraintContract;
  readonly candidate_contract: VisualConstraintContract;
  readonly requested_changes: readonly V2RequestedChange[];
  /** Optional pre-computed SHAs. If omitted, the engine computes them from
   *  the canonical serialisation. Callers with pre-persisted contracts can
   *  pass these to save a hash. */
  readonly reference_contract_sha256?: string;
  readonly candidate_contract_sha256?: string;
  /** ISO-8601 timestamp; caller-supplied for determinism in tests.
   *  If omitted the engine uses a fixed placeholder rather than Date.now()
   *  to preserve deterministic output. */
  readonly generated_at?: string;
  /** Optional report id. If omitted the engine derives a deterministic id
   *  from the two contract ids. */
  readonly report_id?: string;
}

export interface V2Success {
  readonly kind: "SUCCESS";
  readonly report: VisualDifferenceReport;
  readonly grep_marker: V2GrepMarker;
}

export interface V2Failure {
  readonly kind: "FAILURE";
  readonly refusal_code: V2_DifferenceReportRefusalReason;
  readonly reason: string;
  readonly grep_marker: V2GrepMarker;
}

export type V2Result = V2Success | V2Failure;

// §36-V3 · WAVE-V3 · 2026-09-15 · nex-visual-intelligence-v3 · adapter types
// NEX bounded infrastructure · engine adapter runtime types · 2026-09-15
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT
// NEX1-authored capability.
//
// The adapter's request/response shape is a runtime discriminated union
// (SUCCESS | FAILURE) which is outside the typed_data_contract grammar.
// The generation shapes CONSUMED by SUCCESS (V3GenerationOutcome) are
// NEX1-authored via typed_data_contract.

import type { V3_EngineAdapterRefusalReason } from "./visual-generation-contract-ranges";
import type { V3GenerationOutcome, V3GenerationRequest } from "./visual-generation-contract";

export const V3_GREP_MARKER = "§36-V3 · WAVE-V3 · 2026-09-15 · nex-visual-intelligence-v3" as const;
export const V3_ADAPTER_VERSION = "1.0.0" as const;
export type V3GrepMarker = typeof V3_GREP_MARKER;

export interface V3AdapterInvocationOptions {
  /** Optional explicit engine slug. When absent, adapter chooses the
   *  default registered engine (there is none in this wave). */
  readonly engine_slug?: string;
  /** Optional ISO-8601 caller-supplied timestamp. When absent, adapter
   *  uses the deterministic epoch placeholder. */
  readonly invoked_at?: string;
  /** Optional caller-supplied outcome id. When absent, adapter derives a
   *  deterministic id from the request_id + reference SHA. */
  readonly outcome_id?: string;
}

export interface RunV3EngineAdapterRequest {
  readonly request: V3GenerationRequest;
  readonly options?: V3AdapterInvocationOptions;
}

export interface V3AdapterSuccess {
  readonly kind: "SUCCESS";
  readonly outcome: V3GenerationOutcome;
  readonly grep_marker: V3GrepMarker;
  readonly adapter_version: typeof V3_ADAPTER_VERSION;
}

export interface V3AdapterFailure {
  readonly kind: "FAILURE";
  readonly refusal_code: V3_EngineAdapterRefusalReason;
  readonly reason: string;
  readonly grep_marker: V3GrepMarker;
  readonly adapter_version: typeof V3_ADAPTER_VERSION;
}

export type V3AdapterResult = V3AdapterSuccess | V3AdapterFailure;

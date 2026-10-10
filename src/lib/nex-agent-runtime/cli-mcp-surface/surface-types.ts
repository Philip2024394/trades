// §36-E-8 · WAVE-E8 · 2026-09-14 · cli-mcp-surface
// NEX bounded infrastructure · cli-mcp surface types · 2026-09-14
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.

// ── Locked operation ids (6) ────────────────────────────────────────────

export type SurfaceOperationId =
  | "RUN_SKILL_ROUTER"
  | "RUN_SPECIALIST_REVIEWERS"
  | "RUN_ADVERSARIAL_REFUTATION"
  | "APPLY_LIFECYCLE_EVENT"
  | "RECORD_ENGINEERING_MEMORY"
  | "PROPOSE_EXECUTION_BRIDGE";

export const SURFACE_OPERATIONS: readonly SurfaceOperationId[] = Object.freeze([
  "RUN_SKILL_ROUTER",
  "RUN_SPECIALIST_REVIEWERS",
  "RUN_ADVERSARIAL_REFUTATION",
  "APPLY_LIFECYCLE_EVENT",
  "RECORD_ENGINEERING_MEMORY",
  "PROPOSE_EXECUTION_BRIDGE",
]);

// ── Refusal codes (10) ──────────────────────────────────────────────────

export type SurfaceRefusalCode =
  | "E8_INVALID_REQUEST"
  | "E8_MISSING_AUTHORISATION"
  | "E8_UNSUPPORTED_OPERATION"
  | "E8_MISSING_MISSION_ID"
  | "E8_STALE_MISSION"
  | "E8_PATH_TRAVERSAL_REJECTED"
  | "E8_ARBITRARY_COMMAND_REJECTED"
  | "E8_FILESYSTEM_REQUEST_REJECTED"
  | "E8_MALFORMED_PAYLOAD"
  | "E8_AUTHORITY_ESCALATION_REJECTED";

export const SURFACE_REFUSAL_CODES: readonly SurfaceRefusalCode[] = Object.freeze([
  "E8_INVALID_REQUEST",
  "E8_MISSING_AUTHORISATION",
  "E8_UNSUPPORTED_OPERATION",
  "E8_MISSING_MISSION_ID",
  "E8_STALE_MISSION",
  "E8_PATH_TRAVERSAL_REJECTED",
  "E8_ARBITRARY_COMMAND_REJECTED",
  "E8_FILESYSTEM_REQUEST_REJECTED",
  "E8_MALFORMED_PAYLOAD",
  "E8_AUTHORITY_ESCALATION_REJECTED",
]);

// ── Request / response shapes ───────────────────────────────────────────

export interface SurfaceRequest {
  readonly operation: SurfaceOperationId;
  readonly mission_id: string;
  readonly authorisation_ref: string;
  readonly payload: unknown;
}

export interface SurfaceDispatchSuccess {
  readonly kind: "SUCCESS";
  readonly operation: SurfaceOperationId;
  readonly mission_id: string;
  readonly result: unknown;
  readonly grep_marker: "§36-E-8 · WAVE-E8 · 2026-09-14 · cli-mcp-surface";
}

export interface SurfaceDispatchFailure {
  readonly kind: "FAILURE";
  readonly operation: SurfaceOperationId | null;
  readonly mission_id: string | null;
  readonly refusal_code: SurfaceRefusalCode;
  readonly reason: string;
  readonly offending_field: string | null;
  readonly grep_marker: "§36-E-8 · WAVE-E8 · 2026-09-14 · cli-mcp-surface";
}

export type SurfaceDispatchResult = SurfaceDispatchSuccess | SurfaceDispatchFailure;

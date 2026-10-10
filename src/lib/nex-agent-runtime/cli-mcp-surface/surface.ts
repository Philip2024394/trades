// §36-E-8 · WAVE-E8 · 2026-09-14 · cli-mcp-surface
// NEX bounded infrastructure · cli-mcp surface dispatcher · 2026-09-14
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.
//
// External-surface guard + dispatcher. Every request passes through
// (in order): shape → authorisation → operation → mission → path-traversal
// → arbitrary-command → authority-escalation → payload-shape → dispatch.
// Any failure returns a refusal record with the offending field.
//
// Zero shell execution · zero eval · zero network provider · zero I/O.

import { routeSkillsAgainstCandidate } from "../skills/skill-router";
import { runSpecialistReviewers } from "../specialist-reviewers/specialist-reviewers";
import { runAdversarialRefutation } from "../adversarial-refutation/refutation-engine";
import { applyLifecycleEvent } from "../session-lifecycle/lifecycle";
import { bridgeExecution } from "../workstation-live/execution-bridge";
import { recordEngineeringMemoryV2 } from "../self-improvement/engineering-memory-v2";
import type {
  SurfaceDispatchFailure,
  SurfaceDispatchResult,
  SurfaceDispatchSuccess,
  SurfaceOperationId,
  SurfaceRefusalCode,
  SurfaceRequest,
} from "./surface-types";
import { SURFACE_OPERATIONS } from "./surface-types";

const GREP_MARKER = "§36-E-8 · WAVE-E8 · 2026-09-14 · cli-mcp-surface" as const;

// ── Failure helper ──────────────────────────────────────────────────────

function fail(
  operation: SurfaceOperationId | null,
  mission_id: string | null,
  code: SurfaceRefusalCode,
  reason: string,
  offending_field: string | null = null,
): SurfaceDispatchFailure {
  return {
    kind: "FAILURE",
    operation,
    mission_id,
    refusal_code: code,
    reason,
    offending_field,
    grep_marker: GREP_MARKER,
  };
}

// ── Guard: path traversal ──────────────────────────────────────────────

const TRAVERSAL_SEGMENTS = [
  /\.\.\/|\/\.\.$|\/\.\.\/|\\\.\.\\|\\\.\.$|^\.\.\//,
  /^\/|^\\/,
  /^[a-zA-Z]:[\\/]/, // Windows drive-letter absolute path
  /\0/,
  /%2e%2e/i,
  /%2f/i,
];

function containsPathTraversal(value: string): boolean {
  for (const re of TRAVERSAL_SEGMENTS) {
    if (re.test(value)) return true;
  }
  return false;
}

// ── Guard: arbitrary command ───────────────────────────────────────────

const ARBITRARY_COMMAND_PATTERNS: readonly RegExp[] = [
  /\bexec\s*\(/,
  /\bexecSync\s*\(/,
  /\bspawn\s*\(/,
  /\bspawnSync\s*\(/,
  /\bfork\s*\(/,
  /child_process/,
  /`[^`]{0,200}`/, // backticks that look like shell templating
  /\beval\s*\(/,
  /\bnew\s+Function\s*\(/,
  /\bFunction\s*\(\s*["']/,
];

function containsArbitraryCommand(value: string): boolean {
  for (const re of ARBITRARY_COMMAND_PATTERNS) {
    if (re.test(value)) return true;
  }
  return false;
}

// ── Guard: authority escalation ────────────────────────────────────────

const ESCALATION_FIELD_NAMES: readonly string[] = [
  "grant_all",
  "superuser",
  "bypass_auth",
  "escalate",
];

function scanForEscalation(obj: unknown, breadcrumb: string = "payload"): string | null {
  if (obj === null || typeof obj !== "object") return null;
  const rec = obj as Record<string, unknown>;
  for (const key of Object.keys(rec)) {
    if (ESCALATION_FIELD_NAMES.includes(key)) return `${breadcrumb}.${key}`;
    // Any *_authorisation field other than the top-level authorisation_ref
    if (/_authorisation$/.test(key)) return `${breadcrumb}.${key}`;
    // Wildcard authorisation values
    const val = rec[key];
    if (key === "authorisation_ref" && val === "*") return `${breadcrumb}.${key}`;
    if (typeof val === "object" && val !== null) {
      const inner = scanForEscalation(val, `${breadcrumb}.${key}`);
      if (inner) return inner;
    }
  }
  return null;
}

// ── Field-name-scoped guard scanners ────────────────────────────────────
//
// The guards are applied only to fields whose NAMES indicate a path or a
// command-injection vector. String content of analysis fields
// (proposed_content, evidence_summary, regex patterns inside skill
// definitions) legitimately contains substrings like "eval(" — those must
// not be flagged by a universal scan. Scanning by field name preserves
// meaningful guard coverage without false positives.

const PATH_FIELD_NAMES: readonly string[] = [
  "workspace_relative_path",
  "target_path",
  "output_path",
  "file_path",
  "path",
  "canonicalisePath",
];

const COMMAND_FIELD_NAMES: readonly RegExp[] = [
  /_command$/,
  /_shell$/,
  /_exec$/,
  /^shell_/,
  /^exec_/,
];

function fieldNameLooksLikePath(name: string): boolean {
  return PATH_FIELD_NAMES.includes(name);
}

function fieldNameLooksLikeCommand(name: string): boolean {
  return COMMAND_FIELD_NAMES.some((re) => re.test(name));
}

function scanPayloadFieldsByName(
  obj: unknown,
  breadcrumb: string = "payload",
): { code: SurfaceRefusalCode; field: string } | null {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const res = scanPayloadFieldsByName(obj[i], `${breadcrumb}[${i}]`);
      if (res) return res;
    }
    return null;
  }
  if (typeof obj === "object") {
    const rec = obj as Record<string, unknown>;
    for (const key of Object.keys(rec)) {
      const val = rec[key];
      const childBreadcrumb = `${breadcrumb}.${key}`;
      if (typeof val === "string") {
        if (fieldNameLooksLikePath(key) && containsPathTraversal(val)) {
          return { code: "E8_PATH_TRAVERSAL_REJECTED", field: childBreadcrumb };
        }
        if (fieldNameLooksLikeCommand(key) && containsArbitraryCommand(val)) {
          return { code: "E8_ARBITRARY_COMMAND_REJECTED", field: childBreadcrumb };
        }
      } else if (typeof val === "object" && val !== null) {
        const res = scanPayloadFieldsByName(val, childBreadcrumb);
        if (res) return res;
      }
    }
  }
  return null;
}

// ── Entry point ────────────────────────────────────────────────────────

export function dispatchSurfaceRequest(request: SurfaceRequest): SurfaceDispatchResult {
  // Shape check.
  if (!request || typeof request !== "object") {
    return fail(null, null, "E8_INVALID_REQUEST", "request must be an object");
  }
  const op = request.operation;
  const missionId = request.mission_id;
  const authRef = request.authorisation_ref;

  // Authorisation check.
  if (typeof authRef !== "string" || authRef.length === 0) {
    return fail(op ?? null, missionId ?? null, "E8_MISSING_AUTHORISATION", "authorisation_ref is required");
  }
  if (authRef === "*") {
    return fail(op ?? null, missionId ?? null, "E8_AUTHORITY_ESCALATION_REJECTED", "wildcard authorisation_ref rejected", "authorisation_ref");
  }

  // Operation check.
  if (typeof op !== "string" || !SURFACE_OPERATIONS.includes(op as SurfaceOperationId)) {
    return fail(null, missionId ?? null, "E8_UNSUPPORTED_OPERATION", `operation '${op}' is not in the locked list`, "operation");
  }

  // Mission-id check.
  if (typeof missionId !== "string" || missionId.length === 0) {
    return fail(op, null, "E8_MISSING_MISSION_ID", "mission_id is required");
  }

  // Authority-escalation guard on payload structure.
  const escalation = scanForEscalation(request.payload);
  if (escalation) {
    return fail(op, missionId, "E8_AUTHORITY_ESCALATION_REJECTED", `payload contains escalation field '${escalation}'`, escalation);
  }

  // Field-name-scoped scanners: path traversal on path-shaped fields;
  // arbitrary-command on command-shaped fields. Analysis-content fields
  // (proposed_content, evidence_summary, regex patterns) are NOT scanned —
  // they legitimately contain the substrings the guards look for.
  const fieldScan = scanPayloadFieldsByName(request.payload);
  if (fieldScan) {
    return fail(op, missionId, fieldScan.code, `payload field '${fieldScan.field}' violates surface guard`, fieldScan.field);
  }

  // Payload-shape validation + dispatch, per operation.
  return dispatchOperation(op as SurfaceOperationId, missionId, request.payload);
}

// ── Per-operation dispatch ─────────────────────────────────────────────

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object";
}

function dispatchOperation(
  op: SurfaceOperationId,
  mission_id: string,
  payload: unknown,
): SurfaceDispatchResult {
  if (!isRecord(payload)) {
    return fail(op, mission_id, "E8_MALFORMED_PAYLOAD", "payload must be an object");
  }
  switch (op) {
    case "RUN_SKILL_ROUTER": {
      const r = routeSkillsAgainstCandidate(payload as never);
      return success(op, mission_id, r);
    }
    case "RUN_SPECIALIST_REVIEWERS": {
      const r = runSpecialistReviewers(payload as never);
      return success(op, mission_id, r);
    }
    case "RUN_ADVERSARIAL_REFUTATION": {
      const r = runAdversarialRefutation(payload as never);
      return success(op, mission_id, r);
    }
    case "APPLY_LIFECYCLE_EVENT": {
      const r = applyLifecycleEvent(payload as never);
      return success(op, mission_id, r);
    }
    case "RECORD_ENGINEERING_MEMORY": {
      const r = recordEngineeringMemoryV2(payload as never);
      return success(op, mission_id, r);
    }
    case "PROPOSE_EXECUTION_BRIDGE": {
      const r = bridgeExecution(payload as never);
      return success(op, mission_id, r);
    }
    default: {
      // Exhaustiveness check — unreachable in practice.
      return fail(op, mission_id, "E8_UNSUPPORTED_OPERATION", `unreachable dispatch for '${op as string}'`);
    }
  }
}

function success(op: SurfaceOperationId, mission_id: string, result: unknown): SurfaceDispatchSuccess {
  return {
    kind: "SUCCESS",
    operation: op,
    mission_id,
    result,
    grep_marker: GREP_MARKER,
  };
}

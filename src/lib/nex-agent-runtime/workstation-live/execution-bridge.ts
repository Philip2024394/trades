// §36-E-1 · WAVE-E1 · 2026-09-14 · execution-bridge
// NEX bounded infrastructure · execution-bridge primitive · 2026-09-14
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.
//
// Pure function · zero I/O. Bridges the orchestrator's authorised work-order
// into a byte-emission proposal by invoking the existing typed_data_contract
// authoring primitive under a caller-supplied authorised_file_set. Never
// writes to disk. Returns the proposed bytes + provenance; downstream (WO-04
// broker-write via workstation-integration) is responsible for actual writes.
//
// LOCKED SAFETY: target_path MUST appear in authorised_file_set. Any target
// outside → WE_UNAUTHORISED_TARGET, whole-run refusal.
//
// Boundary (verbatim · unamendable):
//   "Wave E1 enables NEX1 to convert an execution-authorised mission work-order
//    plus a typed_data_contract spec plus a caller-supplied authorised_file_set
//    into a deterministic byte-emission proposal with SHA pre-verification,
//    per-file provenance, and refusal-first path safety. It does not permit
//    NEX1 to write files, execute shells, invoke networks, expand authoring
//    vocabulary beyond typed_data_contract, or grant itself authority beyond
//    the caller-supplied authorised_file_set."

import { createHash } from "node:crypto";
import { authorTypedDataContract } from "../programming-mission/typed-data-contract-authoring";
import {
  WE_MAX_AUTHORISED_TARGETS,
  WE_MAX_OUTPUT_BYTES,
  WE_MAX_PATH_LENGTH,
  WE_PROHIBITED_PATH_SUBSTRINGS,
  type AuthorisedTarget,
  type EmittedFile,
  type ExecutionBridgeFailure,
  type ExecutionBridgeRefusalCode,
  type ExecutionBridgeRequest,
  type ExecutionBridgeResult,
  type ExecutionBridgeSuccess,
} from "./execution-bridge-types";

// ── Helpers ────────────────────────────────────────────────────────────

function fail(
  code: ExecutionBridgeRefusalCode,
  reason: string,
  offendingField?: string,
): ExecutionBridgeFailure {
  return offendingField !== undefined
    ? { ok: false, refusal_code: code, reason, offending_field: offendingField }
    : { ok: false, refusal_code: code, reason };
}

function sha256Hex(s: string | Buffer): string {
  return createHash("sha256").update(s).digest("hex");
}

function pathHasProhibited(p: string): boolean {
  for (const bad of WE_PROHIBITED_PATH_SUBSTRINGS) if (p.includes(bad)) return true;
  return false;
}

function isValidWorkspacePath(p: string): boolean {
  if (typeof p !== "string") return false;
  if (p.length === 0 || p.length > WE_MAX_PATH_LENGTH) return false;
  if (pathHasProhibited(p)) return false;
  if (p.startsWith("/")) return false;              // no absolute
  if (/^[A-Za-z]:[\\/]/.test(p)) return false;      // no Windows absolute
  if (/^[a-z][a-z0-9+.\-]*:/i.test(p)) return false; // no protocol schemes
  if (!p.includes("/")) return false;                // must be nested
  return true;
}

// ── Validation ─────────────────────────────────────────────────────────

function validate(request: ExecutionBridgeRequest): ExecutionBridgeFailure | null {
  if (!request || typeof request !== "object") return fail("WE_INVALID_REQUEST", "request must be an object");
  if (typeof request.mission_id !== "string" || request.mission_id.length === 0 || request.mission_id.length > 128) {
    return fail("WE_INVALID_REQUEST", "mission_id invalid");
  }
  if (!/^[a-zA-Z0-9_\-]+$/.test(request.mission_id)) {
    return fail("WE_INVALID_REQUEST", `mission_id has invalid characters: ${request.mission_id}`);
  }
  if (typeof request.workspace_root !== "string" || request.workspace_root.length === 0) {
    return fail("WE_INVALID_REQUEST", "workspace_root required");
  }
  if (typeof request.target_path !== "string" || !isValidWorkspacePath(request.target_path)) {
    return fail("WE_INVALID_REQUEST", `target_path invalid: ${String(request.target_path).slice(0, 80)}`);
  }
  if (!Array.isArray(request.authorised_file_set)) {
    return fail("WE_INVALID_REQUEST", "authorised_file_set must be array");
  }
  if (request.authorised_file_set.length === 0) {
    return fail("WE_INVALID_REQUEST", "authorised_file_set must be non-empty");
  }
  if (request.authorised_file_set.length > WE_MAX_AUTHORISED_TARGETS) {
    return fail("WE_INVALID_REQUEST", `authorised_file_set length > ${WE_MAX_AUTHORISED_TARGETS}`);
  }
  // Validate each target
  for (const t of request.authorised_file_set) {
    if (!t || typeof t !== "object") return fail("WE_INVALID_AUTHORISED_TARGET", "target must be object");
    if (!isValidWorkspacePath(t.workspace_relative_path)) {
      return fail("WE_INVALID_AUTHORISED_TARGET", `target path invalid: ${String(t.workspace_relative_path).slice(0, 80)}`);
    }
    if (t.expected_change_kind !== "file_new" && t.expected_change_kind !== "file_content") {
      return fail("WE_INVALID_AUTHORISED_TARGET", `expected_change_kind invalid: ${String(t.expected_change_kind)}`);
    }
    if (t.expected_change_kind === "file_new" && t.current_sha256_hex !== null) {
      return fail("WE_INVALID_AUTHORISED_TARGET", `file_new target must have current_sha256_hex = null`);
    }
    if (t.expected_change_kind === "file_content") {
      if (typeof t.current_sha256_hex !== "string" || !/^[0-9a-f]{64}$/.test(t.current_sha256_hex)) {
        return fail("WE_INVALID_AUTHORISED_TARGET", `file_content target must have valid current_sha256_hex`);
      }
    }
  }
  if (!request.spec || typeof request.spec !== "object") {
    return fail("WE_INVALID_SPEC", "spec required");
  }
  if (typeof request.spec.contract_name !== "string" || request.spec.contract_name.length === 0) {
    return fail("WE_INVALID_SPEC", "spec.contract_name required");
  }
  if (!Array.isArray(request.spec.declarations) || request.spec.declarations.length === 0) {
    return fail("WE_INVALID_SPEC", "spec.declarations must be non-empty");
  }
  if (!request.style || typeof request.style !== "object") {
    return fail("WE_INVALID_REQUEST", "style required");
  }
  return null;
}

// ── Authorisation check ────────────────────────────────────────────────

function findAuthorisedTarget(
  target_path: string,
  authorised_file_set: readonly AuthorisedTarget[],
): AuthorisedTarget | null {
  for (const t of authorised_file_set) {
    if (t.workspace_relative_path === target_path) return t;
  }
  return null;
}

// ── Main entry point ───────────────────────────────────────────────────

export function bridgeExecution(request: ExecutionBridgeRequest): ExecutionBridgeResult {
  const check = validate(request);
  if (check) return check;

  // Authorisation: target_path must appear in authorised_file_set.
  const authorised = findAuthorisedTarget(request.target_path, request.authorised_file_set);
  if (!authorised) {
    return fail(
      "WE_UNAUTHORISED_TARGET",
      `target_path '${request.target_path}' is not in authorised_file_set (locked whitelist)`,
      request.target_path,
    );
  }

  // Invoke the existing typed_data_contract authoring primitive.
  // The primitive is zero-I/O · deterministic · refusal-first. Any refusal
  // propagates verbatim under WE_TYPED_DATA_CONTRACT_REFUSED.
  //
  // Note: authorTypedDataContract's request shape is a superset of what E1
  // provides · we adapt to it directly (it accepts spec + style + target
  // path). See typed-data-contract-authoring.ts for the exact contract.
  //
  // Call goes through the SAME primitive C1 used · no new authoring
  // vocabulary is introduced by E1.

  let tdcResult: ReturnType<typeof authorTypedDataContract>;
  try {
    tdcResult = authorTypedDataContract({
      spec: request.spec,
      style: request.style,
      target_path: request.target_path,
    });
  } catch (e) {
    return fail(
      "WE_TYPED_DATA_CONTRACT_REFUSED",
      `typed_data_contract threw: ${(e as Error).message.slice(0, 200)}`,
    );
  }

  if (!tdcResult.ok) {
    return {
      ok: false,
      refusal_code: "WE_TYPED_DATA_CONTRACT_REFUSED",
      reason: `typed_data_contract refused authoring for '${request.target_path}'`,
      propagated_refusal_code: tdcResult.refusal_code,
      propagated_reason: tdcResult.reason,
    };
  }

  // Success · assemble the emitted-file record + evidence hash.
  const proposedContent = tdcResult.content;
  const contentBytes = Buffer.byteLength(proposedContent, "utf8");
  if (contentBytes > WE_MAX_OUTPUT_BYTES) {
    return fail("WE_OUTPUT_TOO_LARGE", `proposed content ${contentBytes} bytes > ${WE_MAX_OUTPUT_BYTES}`);
  }

  const emittedFile: EmittedFile = {
    workspace_relative_path: request.target_path,
    kind: authorised.expected_change_kind,
    proposed_bytes_sha256: sha256Hex(proposedContent),
    proposed_bytes_length: contentBytes,
    current_sha256_declared: authorised.current_sha256_hex,
    typed_data_contract_source: "authorTypedDataContract",
  };

  const clock = request.clock ?? (() => new Date());
  const now = clock();
  const emitted_files: readonly EmittedFile[] = Object.freeze([emittedFile]);

  const canonical = JSON.stringify({
    mission_id: request.mission_id,
    emitted_files,
    proposed_bytes_sha256: emittedFile.proposed_bytes_sha256,
  });
  const evidence_sha256 = sha256Hex(canonical);

  const success: ExecutionBridgeSuccess = {
    ok: true,
    mission_id: request.mission_id,
    assessed_at: now.toISOString(),
    emitted_files,
    proposed_content: proposedContent,
    evidence_sha256,
  };

  return success;
}

export type {
  AuthorisedTarget,
  EmittedFile,
  ExecutionBridgeFailure,
  ExecutionBridgeRefusalCode,
  ExecutionBridgeRequest,
  ExecutionBridgeResult,
  ExecutionBridgeSuccess,
} from "./execution-bridge-types";

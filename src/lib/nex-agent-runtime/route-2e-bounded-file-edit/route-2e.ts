// §36-ROUTE-2E · ROUTE-2E · 2026-09-15 · route-2e-bounded-file-edit
// NEX bounded infrastructure · Route 2e bounded existing-file edit primitive · 2026-09-15
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.
//
// Pure function · zero I/O · deterministic. Applies exactly one locked
// operation (add_named_export | insert_import | replace_matched_region)
// to a supplied file content string. Never writes to disk; disk I/O is
// performed by the caller outside this primitive.
//
// Entry point: applyRoute2eEdit(request) → Route2eResult (SUCCESS | FAILURE).

import { createHash } from "node:crypto";
import {
  R2E_MAX_OUTPUT_BYTES,
  R2E_MAX_STRING_ARG_LENGTH,
  R2E_MIN_ANCHOR_LENGTH,
  ROUTE_2E_GREP_MARKER,
  ROUTE_2E_OPERATION_KINDS,
  ROUTE_2E_PROHIBITED_SUBSTRINGS,
  ROUTE_2E_PROTECTED_PREFIXES,
  type Route2eFailure,
  type Route2eOperation,
  type Route2eRefusalCode,
  type Route2eRequest,
  type Route2eResult,
  type Route2eSuccess,
} from "./route-2e-types";

// ── Helpers ─────────────────────────────────────────────────────────────

function fail(code: Route2eRefusalCode, reason: string): Route2eFailure {
  return {
    kind: "FAILURE",
    refusal_code: code,
    reason,
    grep_marker: ROUTE_2E_GREP_MARKER,
  };
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function isNonEmptyBoundedString(v: unknown, maxLen: number = R2E_MAX_STRING_ARG_LENGTH): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= maxLen;
}

function normaliseWorkspacePath(p: string): string {
  return p.replace(/\\/g, "/");
}

function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let idx = 0;
  while (true) {
    const found = haystack.indexOf(needle, idx);
    if (found === -1) break;
    count++;
    idx = found + needle.length;
  }
  return count;
}

// ── Path validation ────────────────────────────────────────────────────

function validatePath(p: string): Route2eFailure | null {
  if (!isNonEmptyBoundedString(p, 512)) return fail("R2E_INVALID_REQUEST", "workspace_relative_path required");
  if (p.startsWith("/") || /^[A-Za-z]:[\\/]/.test(p)) return fail("R2E_PATH_OUTSIDE_WORKSPACE", "path must be workspace-relative");
  const n = normaliseWorkspacePath(p);
  if (n.includes("..")) return fail("R2E_PATH_OUTSIDE_WORKSPACE", "path must not contain '..'");
  for (const prefix of ROUTE_2E_PROTECTED_PREFIXES) {
    if (n.startsWith(prefix)) return fail("R2E_PATH_PROTECTED_MODULE", `path '${n}' is under protected prefix '${prefix}' · requires §36 amendment`);
  }
  // Allowed roots: src/**, docs/**, data/**, tests/**, public/**
  const allowedRoots = ["src/", "docs/", "data/", "tests/", "public/", "scripts/"];
  if (!allowedRoots.some((r) => n.startsWith(r))) {
    return fail("R2E_PATH_DENIED_ROOT", `path '${n}' is not under any allowed root (${allowedRoots.join(", ")})`);
  }
  return null;
}

// ── Operation validation ───────────────────────────────────────────────

function validateOperation(op: unknown): Route2eFailure | null {
  if (!op || typeof op !== "object") return fail("R2E_INVALID_OPERATION_ARGS", "operation required");
  const kind = (op as { kind?: unknown }).kind;
  if (typeof kind !== "string" || !ROUTE_2E_OPERATION_KINDS.includes(kind as never)) {
    return fail("R2E_INVALID_OPERATION_ARGS", `unknown operation kind '${String(kind)}'`);
  }
  switch (kind) {
    case "add_named_export": {
      const o = op as { export_name?: unknown; export_declaration?: unknown; must_not_already_exist?: unknown };
      if (!isNonEmptyBoundedString(o.export_name) || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(o.export_name)) {
        return fail("R2E_INVALID_OPERATION_ARGS", "export_name must be a valid identifier");
      }
      if (!isNonEmptyBoundedString(o.export_declaration)) return fail("R2E_INVALID_OPERATION_ARGS", "export_declaration required");
      if (o.must_not_already_exist !== true) return fail("R2E_INVALID_OPERATION_ARGS", "must_not_already_exist must be true");
      break;
    }
    case "insert_import": {
      const o = op as { import_line?: unknown; must_not_already_exist?: unknown };
      if (!isNonEmptyBoundedString(o.import_line)) return fail("R2E_INVALID_OPERATION_ARGS", "import_line required");
      if (!/^import\s/.test(o.import_line as string)) return fail("R2E_INVALID_OPERATION_ARGS", "import_line must start with 'import '");
      if (o.must_not_already_exist !== true) return fail("R2E_INVALID_OPERATION_ARGS", "must_not_already_exist must be true");
      break;
    }
    case "replace_matched_region": {
      const o = op as { anchor?: unknown; replacement?: unknown; must_be_unique?: unknown };
      if (!isNonEmptyBoundedString(o.anchor) || (o.anchor as string).length < R2E_MIN_ANCHOR_LENGTH) {
        return fail("R2E_INVALID_OPERATION_ARGS", `anchor must be at least ${R2E_MIN_ANCHOR_LENGTH} characters`);
      }
      if (typeof o.replacement !== "string" || o.replacement.length > R2E_MAX_STRING_ARG_LENGTH) {
        return fail("R2E_INVALID_OPERATION_ARGS", "replacement invalid");
      }
      if (o.must_be_unique !== true) return fail("R2E_INVALID_OPERATION_ARGS", "must_be_unique must be true");
      break;
    }
  }
  return null;
}

// ── Prohibited-content check ───────────────────────────────────────────

function checkProhibitedIntroduction(oldContent: string, newContent: string): Route2eFailure | null {
  for (const bad of ROUTE_2E_PROHIBITED_SUBSTRINGS) {
    const inOld = oldContent.includes(bad);
    const inNew = newContent.includes(bad);
    if (inNew && !inOld) {
      return fail("R2E_PROHIBITED_CONTENT", `edit would introduce prohibited substring '${bad}'`);
    }
  }
  return null;
}

// ── Operation appliers ────────────────────────────────────────────────

function applyAddNamedExport(content: string, op: { export_name: string; export_declaration: string }): { ok: true; new: string } | Route2eFailure {
  // Refuse if export_name already appears in an export statement.
  const exportRe = new RegExp(
    `(^|\\n)\\s*export\\s+(?:const|let|var|function|async\\s+function|type|interface|class|enum|default)?\\s*` +
    op.export_name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
    `\\b`,
  );
  if (exportRe.test(content)) {
    return fail("R2E_POSTCONDITION_ALREADY_SATISFIED", `export '${op.export_name}' already declared in file`);
  }
  const trimmed = content.replace(/\s+$/, "");
  const newContent = trimmed + "\n" + op.export_declaration + "\n";
  return { ok: true, new: newContent };
}

function applyInsertImport(content: string, op: { import_line: string }): { ok: true; new: string } | Route2eFailure {
  if (content.includes(op.import_line)) {
    return fail("R2E_POSTCONDITION_ALREADY_SATISFIED", "import line already present");
  }
  const lines = content.split("\n");
  // Find last line that starts with `import `.
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^import\s/.test(lines[i])) lastImportIdx = i;
  }
  if (lastImportIdx >= 0) {
    lines.splice(lastImportIdx + 1, 0, op.import_line);
  } else {
    // Insert at top followed by blank line
    lines.unshift(op.import_line, "");
  }
  return { ok: true, new: lines.join("\n") };
}

function applyReplaceMatchedRegion(content: string, op: { anchor: string; replacement: string }): { ok: true; new: string } | Route2eFailure {
  const count = countOccurrences(content, op.anchor);
  if (count === 0) return fail("R2E_NO_ANCHOR_MATCH", `anchor not found in content`);
  if (count > 1) return fail("R2E_MULTIPLE_ANCHOR_MATCHES", `anchor matches ${count} times · must be unique`);
  const idx = content.indexOf(op.anchor);
  const newContent = content.slice(0, idx) + op.replacement + content.slice(idx + op.anchor.length);
  return { ok: true, new: newContent };
}

// ── Entry point ────────────────────────────────────────────────────────

export function applyRoute2eEdit(request: Route2eRequest): Route2eResult {
  if (!request || typeof request !== "object") {
    return fail("R2E_INVALID_REQUEST", "request required");
  }
  const pathCheck = validatePath(request.workspace_relative_path);
  if (pathCheck) return pathCheck;

  if (typeof request.current_content !== "string") return fail("R2E_INVALID_REQUEST", "current_content must be a string");
  if (request.current_content.length > R2E_MAX_OUTPUT_BYTES) return fail("R2E_INVALID_REQUEST", `current_content exceeds ${R2E_MAX_OUTPUT_BYTES} bytes`);

  if (typeof request.current_sha256_hex !== "string" || !/^[0-9a-f]{64}$/.test(request.current_sha256_hex)) {
    return fail("R2E_INVALID_REQUEST", "current_sha256_hex must be 64-char lowercase hex");
  }
  const actualSha = sha256Hex(request.current_content);
  if (actualSha !== request.current_sha256_hex) {
    return fail("R2E_SHA_MISMATCH", `declared SHA ${request.current_sha256_hex.slice(0, 12)}... does not match actual SHA ${actualSha.slice(0, 12)}...`);
  }

  const opCheck = validateOperation(request.operation);
  if (opCheck) return opCheck;

  if (typeof request.expected_postcondition_substring !== "string" || request.expected_postcondition_substring.length === 0) {
    return fail("R2E_INVALID_REQUEST", "expected_postcondition_substring required (non-empty)");
  }

  // Apply operation
  const op: Route2eOperation = request.operation;
  let applied: { ok: true; new: string } | Route2eFailure;
  switch (op.kind) {
    case "add_named_export":
      applied = applyAddNamedExport(request.current_content, op);
      break;
    case "insert_import":
      applied = applyInsertImport(request.current_content, op);
      break;
    case "replace_matched_region":
      applied = applyReplaceMatchedRegion(request.current_content, op);
      break;
  }
  if ("kind" in applied && applied.kind === "FAILURE") return applied;
  const newContent = (applied as { ok: true; new: string }).new;

  // Size cap
  if (newContent.length > R2E_MAX_OUTPUT_BYTES) {
    return fail("R2E_OUTPUT_TOO_LARGE", `output ${newContent.length} bytes exceeds cap ${R2E_MAX_OUTPUT_BYTES}`);
  }

  // Prohibited introduction gate
  const contaminationCheck = checkProhibitedIntroduction(request.current_content, newContent);
  if (contaminationCheck) return contaminationCheck;

  // Post-condition
  if (!newContent.includes(request.expected_postcondition_substring)) {
    return fail("R2E_POSTCONDITION_UNSATISFIABLE", `expected substring '${request.expected_postcondition_substring.slice(0, 60)}' not found in produced content`);
  }

  const success: Route2eSuccess = {
    kind: "SUCCESS",
    workspace_relative_path: normaliseWorkspacePath(request.workspace_relative_path),
    operation_kind: op.kind,
    new_content: newContent,
    new_sha256_hex: sha256Hex(newContent),
    bytes_added: newContent.length - request.current_content.length,
    grep_marker: ROUTE_2E_GREP_MARKER,
  };
  return success;
}

// Re-export catalogue for consumers
export {
  R2E_MAX_OUTPUT_BYTES,
  R2E_MAX_STRING_ARG_LENGTH,
  R2E_MIN_ANCHOR_LENGTH,
  ROUTE_2E_GREP_MARKER,
  ROUTE_2E_OPERATION_KINDS,
  ROUTE_2E_PROHIBITED_SUBSTRINGS,
  ROUTE_2E_PROTECTED_PREFIXES,
  ROUTE_2E_REFUSAL_CODES,
} from "./route-2e-types";

// §36-W-3 · W-3 · 2026-09-15 · workstation-execution-bridge
// NEX bounded infrastructure · execute-command primitive · 2026-09-15 (SERVER-ONLY)
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.
//
// Node-only primitive. Reads current style-overrides state, applies the
// structured command, invokes authorSmallApplication (Route 2d), verifies
// every emitted path resolves under the authorised target root via
// canonicalisePath, writes the emitted bytes, persists overrides, spawns
// real vitest with a hard 30s timeout, and returns a real lifecycle
// history. Every path is guarded, every write is bounded, every test is
// executed for real. No mocks.

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";

import { authorSmallApplication } from "../route-2d-small-app-authoring/route-2d";
import { buildTinyCalculatorSpec } from "../route-2d-small-app-authoring/first-app-tiny-calculator-spec";
import type { StructuredCommand } from "../command-parser/command-parser-types";
import { applyOverridesToTinyCalculatorSpec, applyStructuredCommandToOverrides } from "./style-overrides";
import { COMMAND_MATRIX_V1 } from "./execution-bridge-types";
import type {
  ExecuteStructuredCommandFailure,
  ExecuteStructuredCommandRequest,
  ExecuteStructuredCommandResult,
  ExecuteStructuredCommandSuccess,
  ExecutionBridgeRefusalCode,
  FileWriteRecord,
  StyleOverridesFile,
  TestRunRecord,
} from "./execution-bridge-types";

const GREP_MARKER = "§36-W-3 · W-3 · 2026-09-15 · workstation-execution-bridge" as const;

const AUTHORISED_TARGET_FILES: readonly string[] = Object.freeze([
  "page.tsx",
  "TinyCalculator.tsx",
  "TinyCalculator.test.tsx",
]);

// Never touch these · they carry protected-baseline SHAs recorded in S1
const PROTECTED_ROOTS: readonly string[] = Object.freeze([
  "src/lib/nex-agent-runtime/programming-mission/",
  "src/lib/nex-agent-runtime/c1-nex-facial-state-model/",
  "src/lib/nex-agent-runtime/route-2d-small-app-authoring/",
]);

// ── Helpers ────────────────────────────────────────────────────────────

function sha256Hex(s: string | Buffer): string {
  return createHash("sha256").update(s).digest("hex");
}

function canonicalisePath(basePath: string, sub: string): { ok: true; abs: string } | { ok: false; reason: string } {
  const resolved = path.resolve(basePath, sub);
  const normalisedBase = path.resolve(basePath) + path.sep;
  if (!(resolved + path.sep).startsWith(normalisedBase)) {
    return { ok: false, reason: `resolved '${resolved}' escapes base '${basePath}'` };
  }
  if (resolved.includes("\0")) return { ok: false, reason: "null byte in path" };
  return { ok: true, abs: resolved };
}

function isProtectedPath(abs: string, repoRoot: string): boolean {
  const rel = path.relative(repoRoot, abs).replace(/\\/g, "/");
  return PROTECTED_ROOTS.some((r) => rel === r || rel.startsWith(r));
}

function fail(
  refusal_code: ExecutionBridgeRefusalCode,
  reason: string,
  offending_field: string | null,
  lifecycle_history: ExecuteStructuredCommandFailure["lifecycle_history"],
  diagnosis: ExecuteStructuredCommandFailure["diagnosis"] = null,
): ExecuteStructuredCommandFailure {
  return { ok: false, refusal_code, reason, offending_field, diagnosis, lifecycle_history, grep_marker: GREP_MARKER };
}

// ── Matrix check ──────────────────────────────────────────────────────

function validateMatrix(cmd: StructuredCommand): ExecutionBridgeRefusalCode | null {
  if (cmd.target_app !== "tiny-calculator") return "WRE_UNKNOWN_TARGET_APP";
  const entry = COMMAND_MATRIX_V1.find((e) => e.element === cmd.element && e.property === cmd.property);
  if (!entry) return "WRE_UNKNOWN_ELEMENT";
  if (!entry.valid_values.includes(cmd.value)) return "WRE_INVALID_VALUE_FOR_PROPERTY";
  return null;
}

// ── Real vitest spawn (30s hard timeout) ──────────────────────────────

function runVitestFile(repoRoot: string, testFileRelative: string, timeoutMs: number): Promise<TestRunRecord> {
  return new Promise((resolve) => {
    const started = Date.now();
    const command = `npx vitest run ${testFileRelative}`;
    let timedOut = false;
    const child = spawn("npx", ["vitest", "run", testFileRelative], {
      cwd: repoRoot,
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, CI: "true" },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    const killer = setTimeout(() => {
      timedOut = true;
      try { child.kill("SIGKILL"); } catch { /* noop */ }
    }, timeoutMs);
    child.on("close", (code) => {
      clearTimeout(killer);
      const duration_ms = Date.now() - started;
      const record: TestRunRecord = {
        command,
        exit_code: code,
        duration_ms,
        timed_out: timedOut,
        passed: !timedOut && code === 0,
        stdout_tail: stdout.slice(-2000),
        stderr_tail: stderr.slice(-1000),
      };
      resolve(record);
    });
    child.on("error", (err) => {
      clearTimeout(killer);
      const duration_ms = Date.now() - started;
      resolve({
        command,
        exit_code: null,
        duration_ms,
        timed_out: false,
        passed: false,
        stdout_tail: stdout.slice(-2000),
        stderr_tail: (stderr + "\nspawn error: " + err.message).slice(-1000),
      });
    });
  });
}

// ── Entry point ────────────────────────────────────────────────────────

export async function executeStructuredCommand(
  request: ExecuteStructuredCommandRequest,
  repoRoot: string,
): Promise<ExecuteStructuredCommandResult> {
  const lifecycle: {
    at: string;
    state: "CREATED" | "PREPARED" | "AUTHORISED" | "EXECUTING" | "TESTING" | "VERIFIED" | "COMPLETED" | "FAILED" | "REFUSED";
    note: string;
  }[] = [];
  const at = (): string => new Date().toISOString();
  lifecycle.push({ at: at(), state: "CREATED", note: `mission ${request.mission_id} · phrase ${request.matched_phrase_id}` });

  // Shape check
  if (!request || typeof request !== "object") {
    return fail("WRE_INVALID_REQUEST", "request required", null, [...lifecycle, { at: at(), state: "REFUSED", note: "invalid request" }]);
  }
  if (typeof request.authorisation_ref !== "string" || request.authorisation_ref.length === 0) {
    return fail("WRE_MISSING_AUTHORISATION", "authorisation_ref required", "authorisation_ref", [...lifecycle, { at: at(), state: "REFUSED", note: "missing auth" }]);
  }

  // Matrix check
  const matrixFail = validateMatrix(request.structured);
  if (matrixFail) {
    return fail(matrixFail, `structured command failed matrix validation: element=${request.structured.element} property=${request.structured.property} value=${request.structured.value}`, "structured", [...lifecycle, { at: at(), state: "REFUSED", note: matrixFail }]);
  }

  lifecycle.push({ at: at(), state: "PREPARED", note: "matrix validated · loading base spec" });

  // Load base spec + compute merged spec
  let baseSpec;
  try { baseSpec = buildTinyCalculatorSpec(); } catch (e) {
    return fail("WRE_SPEC_MERGE_FAILED", `base spec load failed: ${(e as Error).message}`, null, [...lifecycle, { at: at(), state: "FAILED", note: "spec load" }]);
  }
  const nextOverrides: StyleOverridesFile = applyStructuredCommandToOverrides(request.current_overrides, request.structured, request.clock_iso);
  const mergedSpec = applyOverridesToTinyCalculatorSpec(baseSpec, nextOverrides);

  lifecycle.push({ at: at(), state: "AUTHORISED", note: `authorisation_ref ${request.authorisation_ref} · applying diff for ${request.structured.value}` });

  // Author bytes via Route 2d
  const authorResult = authorSmallApplication({ spec: mergedSpec, emit_tests: true });
  if (!authorResult.ok) {
    return fail("WRE_AUTHORING_REFUSED", `authorSmallApplication refused: ${authorResult.refusal_code} · ${authorResult.reason}`, authorResult.offending_field ?? null, [...lifecycle, { at: at(), state: "FAILED", note: "authoring refused" }]);
  }

  lifecycle.push({ at: at(), state: "EXECUTING", note: `authoring produced ${authorResult.emitted_files.length} files · verifying paths + writing` });

  // Verify + write each file
  const targetRoot = request.authorised_target_root;
  const writes: FileWriteRecord[] = [];
  for (const f of authorResult.emitted_files) {
    // Emitted path is workspace-relative like "src/app/nex-generated/tiny-calculator/TinyCalculator.tsx"
    const emittedBaseName = path.basename(f.path);
    if (!AUTHORISED_TARGET_FILES.includes(emittedBaseName)) {
      return fail("WRE_TARGET_PATH_OUTSIDE_ROOT", `emitted file '${emittedBaseName}' not in authorised set`, "emitted_files", [...lifecycle, { at: at(), state: "FAILED", note: "path not authorised" }], { attempted_writes: writes });
    }
    const canonical = canonicalisePath(targetRoot, emittedBaseName);
    if (!canonical.ok) {
      return fail("WRE_TARGET_PATH_OUTSIDE_ROOT", `canonicalisePath: ${canonical.reason}`, "target_path", [...lifecycle, { at: at(), state: "FAILED", note: "canonical path escaped" }], { attempted_writes: writes });
    }
    if (isProtectedPath(canonical.abs, repoRoot)) {
      return fail("WRE_PROTECTED_TARGET_PATH", `target is under a protected baseline root`, "target_path", [...lifecycle, { at: at(), state: "FAILED", note: "protected target" }], { attempted_writes: writes });
    }
    // Compute action label
    let action: FileWriteRecord["action"] = "CREATED";
    if (fs.existsSync(canonical.abs)) {
      const prev = fs.readFileSync(canonical.abs, "utf8");
      action = prev === f.content ? "UNCHANGED" : "MODIFIED";
    }
    if (action !== "UNCHANGED") {
      try {
        fs.mkdirSync(path.dirname(canonical.abs), { recursive: true });
        fs.writeFileSync(canonical.abs, f.content, "utf8");
      } catch (e) {
        return fail("WRE_FILE_WRITE_FAILED", `write failed: ${(e as Error).message}`, "target_path", [...lifecycle, { at: at(), state: "FAILED", note: "write failed" }], { attempted_writes: writes });
      }
    }
    writes.push({ path: path.relative(repoRoot, canonical.abs).replace(/\\/g, "/"), action, byte_size: f.byte_size, sha256_hex: f.sha256_hex });
  }

  // Persist overrides file
  try {
    fs.mkdirSync(path.dirname(request.authorised_state_file_path), { recursive: true });
    fs.writeFileSync(request.authorised_state_file_path, JSON.stringify(nextOverrides, null, 2) + "\n", "utf8");
  } catch (e) {
    return fail("WRE_FILE_WRITE_FAILED", `state file write failed: ${(e as Error).message}`, "state_file", [...lifecycle, { at: at(), state: "FAILED", note: "state write failed" }], { attempted_writes: writes });
  }

  lifecycle.push({ at: at(), state: "TESTING", note: `running vitest on ${request.authorised_test_file_relative_path}` });

  // Run vitest for real
  const testTimeoutMs = request.test_timeout_ms ?? 30000;
  const testRun = await runVitestFile(repoRoot, request.authorised_test_file_relative_path, testTimeoutMs);

  if (testRun.timed_out) {
    return fail("WRE_TEST_RUN_TIMEOUT", `vitest exceeded ${testTimeoutMs}ms`, "test_run", [...lifecycle, { at: at(), state: "FAILED", note: "test timeout" }], { attempted_writes: writes, test_run: testRun });
  }
  if (!testRun.passed) {
    return fail("WRE_TEST_RUN_FAILED", `vitest exit ${testRun.exit_code}`, "test_run", [...lifecycle, { at: at(), state: "FAILED", note: `test exit ${testRun.exit_code}` }], { attempted_writes: writes, test_run: testRun });
  }

  lifecycle.push({ at: at(), state: "VERIFIED", note: `vitest passed in ${testRun.duration_ms}ms · files written · overrides persisted` });
  lifecycle.push({ at: at(), state: "COMPLETED", note: "mission complete · preview refresh triggered" });

  const success: ExecuteStructuredCommandSuccess = {
    ok: true,
    mission_id: request.mission_id,
    matched_phrase_id: request.matched_phrase_id,
    next_overrides: nextOverrides,
    file_writes: Object.freeze(writes),
    test_run: testRun,
    preview_refresh_nonce: Date.now(),
    lifecycle_history: Object.freeze(lifecycle) as ExecuteStructuredCommandSuccess["lifecycle_history"],
    grep_marker: GREP_MARKER,
  };
  return success;
}

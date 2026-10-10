// §36-VISUAL-STRUCTURAL-LOCK · M-3 · structural validator Node bridge · 2026-09-15
// Spawns scripts/nex-structural-validate.py and returns the validation
// receipt as a NEX-native NexStructuralValidationResult.
//
// Founder-locked behaviours preserved:
//   * Anti-chaining · validator compares generated_image against the
//     reference_profile · which is anchored to the master reference's
//     SHA-256. Validator NEVER accepts another generated image as the
//     comparison baseline.
//   * NOT_IMPLEMENTED overrides visual-resemblance · Python receipt is
//     surfaced without transformation · consumers must respect the
//     Python-side aggregation rule (NOT_IMPLEMENTED overall when any
//     required component is untested).

import { spawn } from "node:child_process";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import * as path from "node:path";
import {
  NEX_STRUCTURAL_VALIDATOR_GREP_MARKER,
  NEX_STRUCTURAL_VALIDATOR_VERSION,
  type NexStructuralValidationFailure,
  type NexStructuralValidationRefusalCode,
  type NexStructuralValidationResult,
  type NexStructuralValidationSuccess,
  type NexValidationReceipt,
  type RunNexStructuralValidationRequest,
} from "./nex-structural-validation-types";

function fail(
  code: NexStructuralValidationRefusalCode,
  reason: string,
  stdout_tail: string | null = null,
  stderr_tail: string | null = null,
): NexStructuralValidationFailure {
  return {
    kind: "FAILURE",
    refusal_code: code,
    reason,
    stdout_tail,
    stderr_tail,
    grep_marker: NEX_STRUCTURAL_VALIDATOR_GREP_MARKER,
    validator_version: NEX_STRUCTURAL_VALIDATOR_VERSION,
  };
}

function parseLastJson(stdout: string): Record<string, unknown> | null {
  const lines = stdout.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i]?.trim() ?? "";
    if (l.startsWith("{") && l.endsWith("}")) {
      try {
        return JSON.parse(l) as Record<string, unknown>;
      } catch {
        continue;
      }
    }
  }
  return null;
}

export async function runNexStructuralValidation(
  request: RunNexStructuralValidationRequest,
): Promise<NexStructuralValidationResult> {
  if (!request || typeof request !== "object") return fail("NEX_VAL_INVALID_REQUEST", "request required");
  if (typeof request.python_exe !== "string" || request.python_exe.length === 0) return fail("NEX_VAL_INVALID_REQUEST", "python_exe required");
  if (typeof request.script_path !== "string" || request.script_path.length === 0) return fail("NEX_VAL_INVALID_REQUEST", "script_path required");
  if (typeof request.reference_profile_json_path !== "string" || request.reference_profile_json_path.length === 0) return fail("NEX_VAL_INVALID_REQUEST", "reference_profile_json_path required");
  if (typeof request.generated_image_path !== "string" || request.generated_image_path.length === 0) return fail("NEX_VAL_INVALID_REQUEST", "generated_image_path required");
  if (typeof request.output_dir !== "string" || request.output_dir.length === 0) return fail("NEX_VAL_INVALID_REQUEST", "output_dir required");
  if (!existsSync(request.python_exe)) return fail("NEX_VAL_PYTHON_NOT_AVAILABLE", `python_exe not found: ${request.python_exe}`);
  if (!existsSync(request.script_path)) return fail("NEX_VAL_SCRIPT_MISSING", `script_path not found: ${request.script_path}`);
  if (!existsSync(request.reference_profile_json_path)) return fail("NEX_VAL_REFERENCE_PROFILE_MISSING", `reference profile not found: ${request.reference_profile_json_path}`);
  if (!existsSync(request.generated_image_path)) return fail("NEX_VAL_GENERATED_ASSET_MISSING", `generated image not found: ${request.generated_image_path}`);
  if (!existsSync(request.output_dir)) mkdirSync(request.output_dir, { recursive: true });

  const args: string[] = [
    request.script_path,
    "--reference-profile-json", request.reference_profile_json_path,
    "--generated-image", request.generated_image_path,
    "--output-dir", request.output_dir,
  ];
  if (request.reference_asset_id) args.push("--reference-asset-id", request.reference_asset_id);
  if (request.generated_asset_id) args.push("--generated-asset-id", request.generated_asset_id);
  if (typeof request.threshold_depth_correlation === "number") args.push("--threshold-depth-correlation", String(request.threshold_depth_correlation));
  if (typeof request.threshold_edge_ssim === "number") args.push("--threshold-edge-ssim", String(request.threshold_edge_ssim));
  if (typeof request.threshold_foreground_iou === "number") args.push("--threshold-foreground-iou", String(request.threshold_foreground_iou));

  const child = spawn(request.python_exe, args, { windowsHide: true });
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  child.stdout.on("data", (b: Buffer) => stdoutChunks.push(b.toString("utf8")));
  child.stderr.on("data", (b: Buffer) => stderrChunks.push(b.toString("utf8")));

  const timeout_ms = request.timeout_ms ?? 20 * 60 * 1000;
  const exit = await new Promise<{ code: number | null; timed_out: boolean }>((resolve) => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeout_ms);
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ code, timed_out: timedOut });
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve({ code: -1, timed_out: false });
    });
  });

  const stdout = stdoutChunks.join("");
  const stderr = stderrChunks.join("");
  const stdout_tail = stdout.slice(-2048);
  const stderr_tail = stderr.slice(-2048);

  if (exit.timed_out) return fail("NEX_VAL_PROCESS_TIMEOUT", `validator exceeded ${timeout_ms}ms`, stdout_tail, stderr_tail);
  if (exit.code !== 0) return fail("NEX_VAL_PROCESS_NON_ZERO_EXIT", `validator exit ${exit.code}`, stdout_tail, stderr_tail);

  const parsed = parseLastJson(stdout);
  if (!parsed) return fail("NEX_VAL_OUTPUT_UNPARSEABLE", "could not find single-line JSON receipt in stdout", stdout_tail, stderr_tail);

  const receiptPathRel = parsed["receipt_path"];
  if (typeof receiptPathRel !== "string" || receiptPathRel.length === 0) {
    return fail("NEX_VAL_RECEIPT_MISSING", "receipt did not name receipt_path", stdout_tail, stderr_tail);
  }
  const receiptPathAbs = path.resolve(path.dirname(request.script_path), "..", receiptPathRel);
  if (!existsSync(receiptPathAbs)) {
    return fail("NEX_VAL_RECEIPT_MISSING", `receipt file not found at ${receiptPathAbs}`, stdout_tail, stderr_tail);
  }
  const receipt = JSON.parse(readFileSync(receiptPathAbs, "utf8")) as NexValidationReceipt;

  const success: NexStructuralValidationSuccess = {
    kind: "SUCCESS",
    receipt,
    receipt_path_relative: receiptPathRel,
    python_stdout_last_line_json: stdout.trim().split(/\r?\n/).filter(Boolean).slice(-1)[0] ?? "",
    grep_marker: NEX_STRUCTURAL_VALIDATOR_GREP_MARKER,
    validator_version: NEX_STRUCTURAL_VALIDATOR_VERSION,
  };
  return success;
}

export {
  NEX_STRUCTURAL_VALIDATOR_GREP_MARKER,
  NEX_STRUCTURAL_VALIDATOR_VERSION,
  NEX_STRUCTURAL_VALIDATOR_NAME,
} from "./nex-structural-validation-types";

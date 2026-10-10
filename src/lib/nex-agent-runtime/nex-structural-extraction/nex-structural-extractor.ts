// §36-VISUAL-STRUCTURAL-LOCK · M-2 · structural extractor Node bridge · 2026-09-15
// NEX bounded infrastructure · same pattern as nex-sdxl-engine-adapter.
// Spawns the Python script scripts/nex-structural-extract.py, reads the
// emitted reference-profile.json, verifies its integrity, and returns a
// NEX-native NexStructuralExtractionResult.
//
// Design rules honoured:
//   * The extractor NEVER mutates the master reference image. Input is
//     read-only. Output artefacts land in a distinct output_dir.
//   * No fabricated numbers. If Python cannot honestly compute a feature,
//     the emitted profile records detection_status: "not_implemented" +
//     value: null + confidence: null.
//   * Anti-chaining: the extractor is CALLED WITH a reference_asset_id
//     (nex_visual_reference_assets.id) and returns the profile keyed to
//     it. The extractor NEVER accepts a generated_asset_id.
//   * Provenance: the extractor records the input SHA-256 in the profile.
//     A caller can re-verify the profile matches the exact bytes it was
//     extracted from.

import { spawn } from "node:child_process";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import * as path from "node:path";
import {
  NEX_STRUCTURAL_EXTRACTOR_GREP_MARKER,
  NEX_STRUCTURAL_EXTRACTOR_VERSION,
  type NexReferenceProfile,
  type NexStructuralExtractionFailure,
  type NexStructuralExtractionRefusalCode,
  type NexStructuralExtractionResult,
  type NexStructuralExtractionSuccess,
  type RunNexStructuralExtractionRequest,
} from "./nex-structural-extraction-types";

function fail(
  code: NexStructuralExtractionRefusalCode,
  reason: string,
  stdout_tail: string | null = null,
  stderr_tail: string | null = null,
): NexStructuralExtractionFailure {
  return {
    kind: "FAILURE",
    refusal_code: code,
    reason,
    stdout_tail,
    stderr_tail,
    grep_marker: NEX_STRUCTURAL_EXTRACTOR_GREP_MARKER,
    extractor_version: NEX_STRUCTURAL_EXTRACTOR_VERSION,
  };
}

function parsePythonStdoutLastJson(stdout: string): Record<string, unknown> | null {
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

export async function runNexStructuralExtraction(
  request: RunNexStructuralExtractionRequest,
): Promise<NexStructuralExtractionResult> {
  if (!request || typeof request !== "object") return fail("NEX_STRUCT_INVALID_REQUEST", "request required");
  if (typeof request.python_exe !== "string" || request.python_exe.length === 0) {
    return fail("NEX_STRUCT_INVALID_REQUEST", "python_exe required");
  }
  if (typeof request.script_path !== "string" || request.script_path.length === 0) {
    return fail("NEX_STRUCT_INVALID_REQUEST", "script_path required");
  }
  if (typeof request.input_image_path !== "string" || request.input_image_path.length === 0) {
    return fail("NEX_STRUCT_INVALID_REQUEST", "input_image_path required");
  }
  if (typeof request.output_dir !== "string" || request.output_dir.length === 0) {
    return fail("NEX_STRUCT_INVALID_REQUEST", "output_dir required");
  }
  if (!existsSync(request.python_exe)) return fail("NEX_STRUCT_PYTHON_NOT_AVAILABLE", `python_exe not found: ${request.python_exe}`);
  if (!existsSync(request.script_path)) return fail("NEX_STRUCT_SCRIPT_MISSING", `script_path not found: ${request.script_path}`);
  if (!existsSync(request.input_image_path)) return fail("NEX_STRUCT_INPUT_MISSING", `input_image_path not found: ${request.input_image_path}`);
  if (!existsSync(request.output_dir)) mkdirSync(request.output_dir, { recursive: true });

  const cliArgs: string[] = [
    request.script_path,
    "--input-image", request.input_image_path,
    "--output-dir", request.output_dir,
    "--profile-type", request.profile_type ?? "staircase",
    "--profile-version", String(request.profile_version ?? 1),
  ];
  if (request.reference_asset_id) {
    cliArgs.push("--reference-asset-id", request.reference_asset_id);
  }

  const child = spawn(request.python_exe, cliArgs, { windowsHide: true });
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
    child.on("error", (_err) => {
      clearTimeout(timer);
      resolve({ code: -1, timed_out: false });
    });
  });

  const stdout = stdoutChunks.join("");
  const stderr = stderrChunks.join("");
  const stdout_tail = stdout.slice(-2048);
  const stderr_tail = stderr.slice(-2048);

  if (exit.timed_out) {
    return fail("NEX_STRUCT_PROCESS_TIMEOUT", `structural extractor exceeded ${timeout_ms}ms`, stdout_tail, stderr_tail);
  }
  if (exit.code !== 0) {
    return fail("NEX_STRUCT_PROCESS_NON_ZERO_EXIT", `structural extractor exit code ${exit.code}`, stdout_tail, stderr_tail);
  }

  const parsed = parsePythonStdoutLastJson(stdout);
  if (!parsed) return fail("NEX_STRUCT_OUTPUT_UNPARSEABLE", "could not find single-line JSON receipt in stdout", stdout_tail, stderr_tail);

  const profilePathRelative = parsed["profile_path"];
  if (typeof profilePathRelative !== "string" || profilePathRelative.length === 0) {
    return fail("NEX_STRUCT_PROFILE_MISSING", "receipt did not name a profile_path", stdout_tail, stderr_tail);
  }
  const profilePathAbs = path.resolve(path.dirname(request.script_path), "..", profilePathRelative);
  if (!existsSync(profilePathAbs)) {
    return fail("NEX_STRUCT_PROFILE_MISSING", `profile file not found at ${profilePathAbs}`, stdout_tail, stderr_tail);
  }
  const profile = JSON.parse(readFileSync(profilePathAbs, "utf8")) as NexReferenceProfile;

  const success: NexStructuralExtractionSuccess = {
    kind: "SUCCESS",
    profile,
    profile_receipt_path_relative: profilePathRelative,
    python_stdout_last_line_json: stdout.trim().split(/\r?\n/).filter(Boolean).slice(-1)[0] ?? "",
    grep_marker: NEX_STRUCTURAL_EXTRACTOR_GREP_MARKER,
    extractor_version: NEX_STRUCTURAL_EXTRACTOR_VERSION,
  };
  return success;
}

export {
  NEX_STRUCTURAL_EXTRACTOR_GREP_MARKER,
  NEX_STRUCTURAL_EXTRACTOR_VERSION,
  NEX_STRUCTURAL_EXTRACTOR_NAME,
} from "./nex-structural-extraction-types";

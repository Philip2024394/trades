// §36-V3-SDXL · WAVE-P1-CAMPAIGN · 2026-09-15 · nex-sdxl-engine-adapter
// NEX bounded infrastructure · SDXL adapter (Node → Python subprocess) · 2026-09-15
// Authored as bounded NEX infrastructure per Perpetual Coder Rule.
//
// This module deliberately exempts itself from the nex-agent-runtime-boundary
// zero-subprocess rule for exactly this bounded reason: it is the sanctioned
// bridge to the external SDXL runtime. It follows the same pattern as
// workstation-execution-bridge/execute-command.ts.
//
// The external model identifier "stable-diffusion-xl-base-1.0" appears only
// inside the licence manifest (data/nex-visual-model-licences.json) and the
// Python subprocess script (scripts/nex-sdxl-generate.py). The NEX-facing
// identifier the rest of NEX interacts with is `nex-visual-engine-primary`.

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import * as path from "node:path";
import type {
  V3GenerationOutcome,
  V3GenerationRequest,
} from "../nex-visual-intelligence-v3/visual-generation-contract";
import {
  NEX_SDXL_ADAPTER_GREP_MARKER,
  NEX_SDXL_ADAPTER_VERSION,
  NEX_SDXL_NATIVE_SLUG,
  type NexSdxlAdapterFailure,
  type NexSdxlAdapterRefusalCode,
  type NexSdxlAdapterResult,
  type NexSdxlAdapterSuccess,
  type RunNexSdxlAdapterRequest,
} from "./nex-sdxl-adapter-types";

const PROHIBITED_PROMPT_SUBSTRINGS: readonly string[] = Object.freeze([
  "eval(",
  "new Function",
  "child_process",
  "<script>",
  "</script>",
  "__proto__",
  "constructor.prototype",
]);

function fail(
  code: NexSdxlAdapterRefusalCode,
  reason: string,
  stdout_tail: string | null = null,
  stderr_tail: string | null = null,
): NexSdxlAdapterFailure {
  return {
    kind: "FAILURE",
    refusal_code: code,
    reason,
    stdout_tail,
    stderr_tail,
    grep_marker: NEX_SDXL_ADAPTER_GREP_MARKER,
    adapter_version: NEX_SDXL_ADAPTER_VERSION,
  };
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function isValidV3Request(x: unknown): x is V3GenerationRequest {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.request_id === "string" && r.request_id.length > 0 &&
    typeof r.prompt === "string" && r.prompt.length > 0 &&
    typeof r.output_format === "string" &&
    typeof r.max_output_images === "number"
  );
}

interface PythonStdoutSuccess {
  kind: "SUCCESS";
  request_id: string;
  output_image_path: string;
  output_bytes: number;
  output_sha256: string;
  engine: Record<string, unknown>;
  generation: Record<string, unknown>;
  timing_seconds: Record<string, number>;
  generated_at: string;
}

interface PythonStdoutFailure {
  kind: "FAILURE";
  refusal_code: string;
  reason: string;
}

type PythonStdout = PythonStdoutSuccess | PythonStdoutFailure;

function parsePythonStdout(stdout: string): PythonStdout | null {
  // The Python script writes many lines · the LAST non-empty line must be the JSON receipt.
  const lines = stdout.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return null;
  const last = lines[lines.length - 1];
  try {
    const parsed = JSON.parse(last);
    if (parsed && typeof parsed === "object" && (parsed.kind === "SUCCESS" || parsed.kind === "FAILURE")) {
      return parsed as PythonStdout;
    }
  } catch {
    return null;
  }
  return null;
}

/** Bounded async entry point. Node → Python subprocess bridge for SDXL inference.
 *  Callers own the paths (python_exe · script_path · output_dir · request_json_path)
 *  so this adapter has no hidden discovery of Python / models / paths. */
export async function runNexSdxlAdapter(request: RunNexSdxlAdapterRequest): Promise<NexSdxlAdapterResult> {
  // ── Structural validation ─────────────────────────────────────────
  if (!request || typeof request !== "object") return fail("NEX_SDXL_INVALID_REQUEST", "request required");
  if (!isValidV3Request(request.request)) return fail("NEX_SDXL_INVALID_REQUEST", "request.request must be a well-formed V3GenerationRequest");
  const opts = request.options;
  if (!opts || typeof opts !== "object") return fail("NEX_SDXL_INVALID_REQUEST", "options required");
  if (typeof opts.python_exe !== "string" || opts.python_exe.length === 0) return fail("NEX_SDXL_INVALID_REQUEST", "options.python_exe required");
  if (typeof opts.script_path !== "string" || opts.script_path.length === 0) return fail("NEX_SDXL_INVALID_REQUEST", "options.script_path required");
  if (typeof opts.output_dir !== "string" || opts.output_dir.length === 0) return fail("NEX_SDXL_INVALID_REQUEST", "options.output_dir required");
  if (typeof opts.request_json_path !== "string" || opts.request_json_path.length === 0) return fail("NEX_SDXL_INVALID_REQUEST", "options.request_json_path required");

  const prompt = request.request.prompt;
  for (const bad of PROHIBITED_PROMPT_SUBSTRINGS) {
    if (prompt.includes(bad)) return fail("NEX_SDXL_PROHIBITED_STRING_CONTENT", `prompt contains prohibited substring '${bad}'`);
  }

  if (!existsSync(opts.python_exe)) return fail("NEX_SDXL_PYTHON_NOT_AVAILABLE", `python_exe not found: ${opts.python_exe}`);
  if (!existsSync(opts.script_path)) return fail("NEX_SDXL_SCRIPT_MISSING", `script_path not found: ${opts.script_path}`);

  // ── Write request JSON for Python to read ─────────────────────────
  const requestJsonDir = path.dirname(opts.request_json_path);
  if (!existsSync(requestJsonDir)) mkdirSync(requestJsonDir, { recursive: true });
  const pythonRequest = {
    request_id: request.request.request_id,
    prompt: prompt,
    seed: opts.seed ?? 42,
    height: opts.height ?? 512,
    width: opts.width ?? 512,
    num_inference_steps: opts.num_inference_steps ?? 20,
    guidance_scale: opts.guidance_scale ?? 5.0,
  };
  writeFileSync(opts.request_json_path, JSON.stringify(pythonRequest, null, 2), "utf8");
  if (!existsSync(opts.output_dir)) mkdirSync(opts.output_dir, { recursive: true });

  const timeout_ms = opts.timeout_ms ?? 30 * 60 * 1000; // 30 min default

  // ── Spawn Python ──────────────────────────────────────────────────
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];

  const child = spawn(
    opts.python_exe,
    [opts.script_path, "--request-json", opts.request_json_path, "--output-dir", opts.output_dir],
    { windowsHide: true },
  );

  child.stdout.on("data", (b: Buffer) => stdoutChunks.push(b.toString("utf8")));
  child.stderr.on("data", (b: Buffer) => stderrChunks.push(b.toString("utf8")));

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
    return fail("NEX_SDXL_PROCESS_TIMEOUT", `SDXL subprocess exceeded ${timeout_ms}ms`, stdout_tail, stderr_tail);
  }
  if (exit.code !== 0) {
    return fail("NEX_SDXL_PROCESS_NON_ZERO_EXIT", `SDXL subprocess exit code ${exit.code}`, stdout_tail, stderr_tail);
  }

  const parsed = parsePythonStdout(stdout);
  if (!parsed) return fail("NEX_SDXL_OUTPUT_UNPARSEABLE", "could not parse last-line JSON from Python stdout", stdout_tail, stderr_tail);
  if (parsed.kind === "FAILURE") return fail("NEX_SDXL_PROCESS_NON_ZERO_EXIT", `python refused: ${parsed.refusal_code} · ${parsed.reason}`, stdout_tail, stderr_tail);

  // ── Verify the output image bytes exist and match the reported SHA ──
  const outAbs = path.resolve(path.dirname(opts.script_path), "..", parsed.output_image_path);
  if (!existsSync(outAbs)) return fail("NEX_SDXL_OUTPUT_FILE_MISSING", `expected output at ${outAbs}`, stdout_tail, stderr_tail);
  const image_bytes = readFileSync(outAbs);
  const output_sha_recomputed = sha256Hex(image_bytes);
  if (output_sha_recomputed !== parsed.output_sha256) {
    return fail("NEX_SDXL_INTERNAL", `output SHA mismatch: python reported ${parsed.output_sha256} · adapter computed ${output_sha_recomputed}`, stdout_tail, stderr_tail);
  }

  // ── Build V3GenerationOutcome ─────────────────────────────────────
  const outcome: V3GenerationOutcome = {
    outcome_id: `outcome:${request.request.request_id}:${output_sha_recomputed.slice(0, 12)}`,
    request_id: request.request.request_id,
    response_kind: "engine_invocation_success",
    engine_registration_status: "registered",
    perception_verification_status: "pending_perceptual_layer",
    reason_summary:
      "SDXL adapter invoked local Python subprocess · image bytes produced. " +
      "Perception (PCE V1) has not yet been invoked on the output · downstream caller must invoke it.",
    candidate_asset_ids: Object.freeze([parsed.output_image_path]),
    generated_at: parsed.generated_at,
  };

  const success: NexSdxlAdapterSuccess = {
    kind: "SUCCESS",
    outcome,
    output_image_path_relative: parsed.output_image_path,
    output_bytes: image_bytes.length,
    output_sha256: output_sha_recomputed,
    python_stdout_last_line_json: stdout.trim().split(/\r?\n/).filter(Boolean).slice(-1)[0] ?? "",
    grep_marker: NEX_SDXL_ADAPTER_GREP_MARKER,
    adapter_version: NEX_SDXL_ADAPTER_VERSION,
  };
  return success;
}

export {
  NEX_SDXL_ADAPTER_GREP_MARKER,
  NEX_SDXL_ADAPTER_VERSION,
  NEX_SDXL_NATIVE_SLUG,
} from "./nex-sdxl-adapter-types";

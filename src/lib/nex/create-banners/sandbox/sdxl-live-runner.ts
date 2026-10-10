// src/lib/nex/create-banners/sandbox/sdxl-live-runner.ts
//
// NEX Create Banners · Sandbox live SDXL invocation · 2026-09-23
// ==============================================================
// Wraps the existing SDXL Python subprocess adapter behind a simple
// "runOneGeneration" async function the job runner can await. Sandbox-
// only. Always uses the Founder-authorised Cat 1 reference.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import * as path from "node:path";
import {
  sandboxJobDirAbsolute,
  sandboxReferenceAbsolutePath,
  SANDBOX_ONLY_REFERENCE_RELATIVE_PATH,
} from "./sandbox-doctrine";

export interface SdxlLiveRunInput {
  readonly jobId: string;
  readonly variantId: string;
  readonly seed: number;
  readonly prompt: string;
  readonly negative_prompt: string;
}

export interface SdxlLiveRunOutcome {
  readonly kind: "SUCCESS" | "FAILURE";
  readonly output_image_absolute_path: string | null;
  readonly output_bytes: number | null;
  readonly output_sha256: string | null;
  readonly duration_ms: number;
  readonly model_weights_sha256_fingerprint: string | null;
  readonly failure_reason: string | null;
  readonly stdout_tail: string | null;
  readonly stderr_tail: string | null;
}

/**
 * Resolve absolute paths. All sandbox jobs use the Founder-authorised
 * Cat 1 reference · never anything else.
 */
function resolvePaths(jobId: string, variantId: string) {
  const cwd = process.cwd();
  const jobDir = sandboxJobDirAbsolute(jobId);
  const rawDir = path.join(jobDir, "raw");
  mkdirSync(rawDir, { recursive: true });
  return {
    python_exe: process.env.NEX_SANDBOX_PYTHON_EXE
      ? process.env.NEX_SANDBOX_PYTHON_EXE
      : "C:/Users/Victus/AppData/Local/Programs/Python/Python312/python.exe",
    script_path: path.join(cwd, "scripts", "nex-sdxl-generate.py"),
    output_dir: rawDir,
    request_json_path: path.join(jobDir, `request-${variantId}.json`),
    output_image_absolute_path_expected: path.join(
      rawDir,
      `sandbox-${variantId}.png`
    ),
  };
}

/**
 * Run one SDXL generation using the sandbox reference. Fixed to 1024x1024
 * regardless of target format — the target format is applied at the
 * composition step via Sharp resize/crop. This dramatically reduces
 * VRAM pressure and lets 12 variants complete faster.
 */
export async function runOneSandboxGeneration(
  input: SdxlLiveRunInput
): Promise<SdxlLiveRunOutcome> {
  const started = Date.now();
  const paths = resolvePaths(input.jobId, input.variantId);

  // Doctrine safeguard: the reference file MUST exist and be Cat 1.
  const refAbs = sandboxReferenceAbsolutePath();
  if (!existsSync(refAbs)) {
    return {
      kind: "FAILURE",
      output_image_absolute_path: null,
      output_bytes: null,
      output_sha256: null,
      duration_ms: Date.now() - started,
      model_weights_sha256_fingerprint: null,
      failure_reason: `Sandbox Cat 1 reference not found at ${refAbs}`,
      stdout_tail: null,
      stderr_tail: null,
    };
  }

  if (!existsSync(paths.script_path)) {
    return {
      kind: "FAILURE",
      output_image_absolute_path: null,
      output_bytes: null,
      output_sha256: null,
      duration_ms: Date.now() - started,
      model_weights_sha256_fingerprint: null,
      failure_reason: `SDXL script not found at ${paths.script_path}`,
      stdout_tail: null,
      stderr_tail: null,
    };
  }

  const requestJson = {
    request_id: input.variantId,
    prompt: input.prompt,
    negative_prompt: input.negative_prompt,
    seed: input.seed,
    height: 1024,
    width: 1024,
    num_inference_steps: 20,
    guidance_scale: 5.0,
    scheduler: "EulerDiscreteScheduler",
    precision: "float16",
    offload_mode: "sequential",
    enable_vae_tiling: true,
    enable_vae_slicing: true,
    enable_attention_slicing: false,
    enable_lightning_lora: false,
    enable_nf4_quantisation: false,
    enable_ip_adapter: true,
    ip_adapter_repo: "h94/IP-Adapter",
    ip_adapter_subfolder: "sdxl_models",
    ip_adapter_weight_name: "ip-adapter-plus_sdxl_vit-h.safetensors",
    ip_adapter_image_encoder_folder: "models/image_encoder",
    ip_adapter_scale: 0.4,
    ip_adapter_reference_image_path: SANDBOX_ONLY_REFERENCE_RELATIVE_PATH,
    enable_controlnet_depth: false,
    output_path: path.relative(
      process.cwd(),
      paths.output_image_absolute_path_expected
    ).replace(/\\/g, "/"),
    evidence_path: path
      .relative(
        process.cwd(),
        path.join(paths.output_dir, `sandbox-${input.variantId}-evidence.json`)
      )
      .replace(/\\/g, "/"),
  };

  mkdirSync(path.dirname(paths.request_json_path), { recursive: true });
  writeFileSync(paths.request_json_path, JSON.stringify(requestJson, null, 2));

  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];

  const outcome = await new Promise<SdxlLiveRunOutcome>((resolve) => {
    const proc = spawn(
      paths.python_exe,
      [
        paths.script_path,
        "--request-json",
        paths.request_json_path,
        "--output-dir",
        paths.output_dir,
      ],
      { cwd: process.cwd(), windowsHide: true }
    );
    proc.stdout.on("data", (d: Buffer) => stdoutChunks.push(d.toString()));
    proc.stderr.on("data", (d: Buffer) => stderrChunks.push(d.toString()));
    proc.on("error", (err) => {
      resolve({
        kind: "FAILURE",
        output_image_absolute_path: null,
        output_bytes: null,
        output_sha256: null,
        duration_ms: Date.now() - started,
        model_weights_sha256_fingerprint: null,
        failure_reason: `Python spawn error: ${err.message}`,
        stdout_tail: stdoutChunks.join("").slice(-500),
        stderr_tail: stderrChunks.join("").slice(-500),
      });
    });
    proc.on("close", (code) => {
      const stdout = stdoutChunks.join("");
      const stderr = stderrChunks.join("");
      if (code !== 0) {
        resolve({
          kind: "FAILURE",
          output_image_absolute_path: null,
          output_bytes: null,
          output_sha256: null,
          duration_ms: Date.now() - started,
          model_weights_sha256_fingerprint: null,
          failure_reason: `Python exited with code ${code}`,
          stdout_tail: stdout.slice(-500),
          stderr_tail: stderr.slice(-500),
        });
        return;
      }
      // Parse last JSON line of stdout for receipt
      const lines = stdout.split(/\r?\n/).filter((l) => l.trim().length > 0);
      let receipt: Record<string, unknown> | null = null;
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i]!.trim();
        if (line.startsWith("{") && line.endsWith("}")) {
          try {
            receipt = JSON.parse(line) as Record<string, unknown>;
            break;
          } catch {
            /* keep scanning */
          }
        }
      }
      if (!receipt) {
        resolve({
          kind: "FAILURE",
          output_image_absolute_path: null,
          output_bytes: null,
          output_sha256: null,
          duration_ms: Date.now() - started,
          model_weights_sha256_fingerprint: null,
          failure_reason: "no JSON receipt on stdout",
          stdout_tail: stdout.slice(-500),
          stderr_tail: stderr.slice(-500),
        });
        return;
      }
      const kind = String(receipt["kind"] ?? "FAILURE");
      if (kind !== "SUCCESS") {
        resolve({
          kind: "FAILURE",
          output_image_absolute_path: null,
          output_bytes: null,
          output_sha256: null,
          duration_ms: Date.now() - started,
          model_weights_sha256_fingerprint: null,
          failure_reason: String(receipt["reason"] ?? receipt["refusal_code"] ?? "unknown"),
          stdout_tail: stdout.slice(-500),
          stderr_tail: stderr.slice(-500),
        });
        return;
      }
      const outputRel = String(receipt["output_image_path"] ?? "");
      const outputAbs = path.join(process.cwd(), outputRel);
      let bytes: number | null = null;
      let sha: string | null = null;
      try {
        bytes = statSync(outputAbs).size;
        sha = createHash("sha256")
          .update(readFileSync(outputAbs))
          .digest("hex");
      } catch {
        /* leave nulls */
      }
      const cfg = (receipt["config_fingerprint"] ?? {}) as Record<string, unknown>;
      const engine = (receipt["engine"] ?? {}) as Record<string, unknown>;
      resolve({
        kind: "SUCCESS",
        output_image_absolute_path: outputAbs,
        output_bytes: bytes,
        output_sha256: sha ?? String(receipt["output_sha256"] ?? ""),
        duration_ms: Date.now() - started,
        model_weights_sha256_fingerprint: String(
          engine["unet_fp16_safetensors_fingerprint_sha256"] ??
            cfg["unet_fp16_safetensors_fingerprint_sha256"] ??
            "unknown"
        ),
        failure_reason: null,
        stdout_tail: stdout.slice(-500),
        stderr_tail: stderr.slice(-500),
      });
    });
  });
  return outcome;
}

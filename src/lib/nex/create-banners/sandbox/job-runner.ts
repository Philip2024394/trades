// src/lib/nex/create-banners/sandbox/job-runner.ts
//
// NEX Create Banners · Sandbox job runner · 2026-09-23
// ====================================================
// Orchestrates one sandbox job end-to-end:
//   1. Plan 12 variants across formats × seeds
//   2. For each distinct seed, run ONE SDXL generation at 1024x1024
//      (VRAM-safe; sequential)
//   3. For each variant, compose target-format banner via Sharp using
//      the SDXL raw as source, overlaying headline + CTA + UNPROVEN watermark
//   4. Save results to sandbox output directory
//   5. Update job state as work progresses (in-memory)
//
// NEVER writes to `data/nex-image-manifest.json`.
// NEVER hands off to Social Poster.
// NEVER promotes quality above UNPROVEN.

import * as path from "node:path";
import { randomBytes } from "node:crypto";
import { BANNER_FORMAT_IDS, type BannerFormatId, getBannerFormat } from "../formats";
import type { CopyRequirements } from "../types";
import {
  sandboxJobDirAbsolute,
  SANDBOX_ONLY_REFERENCE_SHA256,
} from "./sandbox-doctrine";
import {
  runOneSandboxGeneration,
  type SdxlLiveRunOutcome,
} from "./sdxl-live-runner";
import { composeSandboxBanner } from "./composition-sharp";
import {
  getJob,
  putJob,
  type SandboxJob,
  type SandboxVariantResult,
} from "./job-store";

export interface SandboxJobInput {
  readonly business_display_name: string;
  readonly product_or_service_label: string;
  readonly campaign_objective: string;
  readonly headline: string;
  readonly cta: string;
  /**
   * Number of distinct SDXL generations to perform. Each generation feeds
   * 12/N format variants via composition. Default 3 → 3 SDXL runs × 4
   * formats each = 12 variants total. Range 1..4 for VRAM/time safety.
   */
  readonly distinct_seeds?: number;
}

const DEFAULT_SEEDS: readonly number[] = [42, 137, 271, 314];

function newJobId(): string {
  return `sbx-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
}

function newVariantId(seed: number, formatId: string, ordinal: number): string {
  return `v${ordinal.toString().padStart(2, "0")}-s${seed}-${formatId}`;
}

/**
 * Build a text prompt from the campaign brief. NEX-controlled.
 * Never renders text in the pixels (D9 text-safety); the CTA/headline
 * are composited on top by Sharp.
 */
function buildPrompt(input: SandboxJobInput): string {
  return (
    `Professional commercial photograph for a ${input.business_display_name} campaign. ` +
    `Subject: ${input.product_or_service_label}. ` +
    `Objective: ${input.campaign_objective}. ` +
    `Wide-shot exterior UK context, clean composition, bright natural daylight, ` +
    `no people visible, high resolution architectural photography, sharp focus, ` +
    `commercial marketing quality, leave clear space at top and bottom for headline and CTA overlay.`
  );
}

function buildNegativePrompt(): string {
  return "cartoon, illustration, painting, low quality, blurry, distorted, watermark, text, logo, people, workers, hi-vis";
}

/**
 * Plan variants: distinct seeds × formats. If distinct_seeds=3 and there
 * are 12 formats, produce 3 seeds × 4 formats = 12 variants. Seeds are
 * cycled deterministically.
 */
function planVariants(input: SandboxJobInput) {
  const seedsN = Math.max(1, Math.min(4, input.distinct_seeds ?? 3));
  const seeds = DEFAULT_SEEDS.slice(0, seedsN);
  const totalFormats = BANNER_FORMAT_IDS.length; // 12
  const formatsPerSeed = Math.ceil(totalFormats / seeds.length);

  const variants: {
    variant_id: string;
    seed: number;
    format_id: BannerFormatId;
  }[] = [];
  let ordinal = 0;
  seeds.forEach((seed, seedIdx) => {
    const start = seedIdx * formatsPerSeed;
    const end = Math.min(start + formatsPerSeed, totalFormats);
    for (let i = start; i < end; i++) {
      const formatId = BANNER_FORMAT_IDS[i]!;
      ordinal += 1;
      variants.push({
        variant_id: newVariantId(seed, formatId, ordinal),
        seed,
        format_id: formatId,
      });
    }
  });
  return { seeds, variants };
}

/**
 * Create a sandbox job (synchronous) and start the background runner.
 * Returns the job_id immediately. Progress is fetched via `getJob(job_id)`.
 */
export function startSandboxJob(input: SandboxJobInput): SandboxJob {
  const plan = planVariants(input);
  const jobId = newJobId();
  const nowIso = new Date().toISOString();

  const initialVariants: SandboxVariantResult[] = plan.variants.map((v) => ({
    variant_id: v.variant_id,
    format_id: v.format_id,
    seed: v.seed,
    state: "queued",
    raw_generation_relative_path: null,
    composed_relative_path: null,
    composed_public_url: null,
    duration_ms: null,
    failure_reason: null,
    raw_sha256: null,
    composed_sha256: null,
    model_weights_sha256_fingerprint: null,
  }));

  const job: SandboxJob = {
    job_id: jobId,
    created_at: nowIso,
    campaign_summary: {
      business_display_name: input.business_display_name,
      product_or_service_label: input.product_or_service_label,
      campaign_objective: input.campaign_objective,
      headline: input.headline,
      cta: input.cta,
    },
    total_variants: initialVariants.length,
    state: "created",
    started_at: null,
    completed_at: null,
    variants: initialVariants,
    quality_status: "UNPROVEN",
    publication_allowed: false,
    reference_sha256_used: SANDBOX_ONLY_REFERENCE_SHA256,
  };
  putJob(job);

  // Kick off runner in background. Fire-and-forget · caller polls.
  void runJobInBackground(jobId, input, plan.seeds);
  return job;
}

async function runJobInBackground(
  jobId: string,
  input: SandboxJobInput,
  seeds: readonly number[]
): Promise<void> {
  const job = getJob(jobId);
  if (!job) return;
  job.state = "running";
  job.started_at = new Date().toISOString();
  putJob(job);

  const copy: CopyRequirements = {
    headline: input.headline,
    offer: null,
    cta: input.cta,
    phone: null,
    url: null,
  };
  const prompt = buildPrompt(input);
  const negative = buildNegativePrompt();

  // For each distinct seed, run ONE SDXL generation, then compose all
  // variants that share that seed.
  const rawBySeed: Map<number, SdxlLiveRunOutcome> = new Map();

  for (const seed of seeds) {
    // Mark all variants of this seed as `generating`
    for (const v of job.variants) {
      if (v.seed === seed) v.state = "generating";
    }
    putJob(job);

    // Pick a representative variant_id for the generation cache key
    const rep = job.variants.find((v) => v.seed === seed);
    if (!rep) continue;

    const gen = await runOneSandboxGeneration({
      jobId,
      variantId: `seed-${seed}`,
      seed,
      prompt,
      negative_prompt: negative,
    });
    rawBySeed.set(seed, gen);

    if (gen.kind !== "SUCCESS" || !gen.output_image_absolute_path) {
      // Fail every variant of this seed
      for (const v of job.variants) {
        if (v.seed === seed) {
          v.state = "failed";
          v.failure_reason =
            gen.failure_reason ?? "SDXL generation failed";
          v.duration_ms = gen.duration_ms;
        }
      }
      putJob(job);
      continue;
    }

    // Compose all variants that share this seed
    for (const v of job.variants) {
      if (v.seed !== seed) continue;
      v.state = "composing";
      v.raw_generation_relative_path = path
        .relative(process.cwd(), gen.output_image_absolute_path!)
        .replace(/\\/g, "/");
      v.raw_sha256 = gen.output_sha256;
      v.model_weights_sha256_fingerprint =
        gen.model_weights_sha256_fingerprint;
      putJob(job);

      const format = getBannerFormat(v.format_id);
      const composedRel = `${path
        .relative(process.cwd(), sandboxJobDirAbsolute(jobId))
        .replace(/\\/g, "/")}/composed/${v.variant_id}.png`;
      const composedAbs = path.join(process.cwd(), composedRel);
      const comp = await composeSandboxBanner({
        raw_generated_asset_absolute_path: gen.output_image_absolute_path,
        format,
        copy,
        output_absolute_path: composedAbs,
      });
      if (comp.kind !== "SUCCESS") {
        v.state = "failed";
        v.failure_reason = comp.failure_reason ?? "composition failed";
        v.duration_ms = (v.duration_ms ?? 0) + comp.duration_ms;
      } else {
        v.state = "complete";
        v.composed_relative_path = composedRel;
        v.composed_public_url = `/api/nex/create-banners/sandbox/asset?path=${encodeURIComponent(
          composedRel
        )}`;
        v.composed_sha256 = comp.composed_asset_sha256;
        v.duration_ms = (v.duration_ms ?? 0) + comp.duration_ms;
      }
      putJob(job);
    }
  }

  const anyFailed = job.variants.some((v) => v.state === "failed");
  const allTerminal = job.variants.every(
    (v) => v.state === "complete" || v.state === "failed"
  );
  if (allTerminal) {
    job.state = anyFailed ? "failed" : "complete";
    job.completed_at = new Date().toISOString();
    putJob(job);
  }
}

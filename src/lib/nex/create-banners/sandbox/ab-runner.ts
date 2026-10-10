// src/lib/nex/create-banners/sandbox/ab-runner.ts
//
// NEX Composition Engineering Wave · A/B runner
// =============================================
// Uses the EXISTING three raw SDXL generations (seeds 42/137/271) from
// the previous sandbox job · runs both compositors (v1 and v2) across
// all 12 formats · never touches SDXL · never regenerates.

import * as path from "node:path";
import * as fs from "node:fs";

import { BANNER_FORMAT_IDS, getBannerFormat } from "../formats";
import { sandboxJobDirAbsolute } from "./sandbox-doctrine";
import { composeSandboxBanner } from "./composition-sharp";
import { composeBannerV2 } from "./composition-v2/compositor-v2";
import { DEFAULT_BRAND_TOKENS } from "./composition-v2/types";

export interface ABRunInput {
  readonly source_job_id: string; // job that already produced the raw SDXL generations
  readonly ab_job_id: string;
  readonly headline: string;
  readonly cta: string;
  readonly eyebrow?: string;
  readonly subheadline?: string;
  readonly trust_element?: string;
  readonly footer_line?: string;
}

export interface ABVariantResult {
  readonly variant_id: string;
  readonly format_id: string;
  readonly seed: number;
  readonly source_raw_path: string;
  readonly v1: {
    readonly composed_path: string | null;
    readonly composed_sha256: string | null;
    readonly duration_ms: number;
    readonly failure_reason: string | null;
  };
  readonly v2: {
    readonly composed_path: string | null;
    readonly composed_sha256: string | null;
    readonly duration_ms: number;
    readonly failure_reason: string | null;
    readonly chosen_candidate_id: string | null;
    readonly chosen_score_total: number | null;
    readonly candidates_considered: number;
    readonly headline_font_size_px: number | null;
    readonly headline_wrapped_lines: readonly string[] | null;
    readonly crop_source_bbox: {
      x: number;
      y: number;
      w: number;
      h: number;
    } | null;
    readonly busy_fraction: number;
  };
}

export interface ABRunOutcome {
  readonly ab_job_id: string;
  readonly source_job_id: string;
  readonly started_at: string;
  readonly completed_at: string;
  readonly total_variants: number;
  readonly results: readonly ABVariantResult[];
  readonly output_root_absolute: string;
  readonly output_root_relative: string;
}

const SEEDS: readonly number[] = [42, 137, 271];

function newVariantId(seed: number, formatId: string, ordinal: number): string {
  return `v${ordinal.toString().padStart(2, "0")}-s${seed}-${formatId}`;
}

export async function runAB(input: ABRunInput): Promise<ABRunOutcome> {
  const started = new Date().toISOString();
  const sourceDir = sandboxJobDirAbsolute(input.source_job_id);
  const abDir = sandboxJobDirAbsolute(input.ab_job_id);
  const v1Dir = path.join(abDir, "v1-composed");
  const v2Dir = path.join(abDir, "v2-composed");
  fs.mkdirSync(v1Dir, { recursive: true });
  fs.mkdirSync(v2Dir, { recursive: true });

  const results: ABVariantResult[] = [];
  const totalFormats = BANNER_FORMAT_IDS.length; // 12
  const formatsPerSeed = Math.ceil(totalFormats / SEEDS.length); // 4

  let ordinal = 0;
  for (let seedIdx = 0; seedIdx < SEEDS.length; seedIdx++) {
    const seed = SEEDS[seedIdx]!;
    const rawPath = path.join(sourceDir, "raw", `sdxl-seed-${seed}.png`);
    if (!fs.existsSync(rawPath)) {
      throw new Error(`Missing raw SDXL asset for seed ${seed}: ${rawPath}`);
    }
    const startIdx = seedIdx * formatsPerSeed;
    const endIdx = Math.min(startIdx + formatsPerSeed, totalFormats);

    for (let fi = startIdx; fi < endIdx; fi++) {
      const formatId = BANNER_FORMAT_IDS[fi]!;
      const format = getBannerFormat(formatId);
      ordinal += 1;
      const variantId = newVariantId(seed, formatId, ordinal);

      // v1 composition (existing crude fixed-band compositor)
      const v1OutRel = path
        .relative(process.cwd(), path.join(v1Dir, `${variantId}.png`))
        .replace(/\\/g, "/");
      const v1OutAbs = path.join(process.cwd(), v1OutRel);
      const v1 = await composeSandboxBanner({
        raw_generated_asset_absolute_path: rawPath,
        format,
        copy: {
          headline: input.headline,
          offer: null,
          cta: input.cta,
          phone: null,
          url: null,
        },
        output_absolute_path: v1OutAbs,
      });

      // v2 composition (intelligent compositor)
      const v2OutRel = path
        .relative(process.cwd(), path.join(v2Dir, `${variantId}.png`))
        .replace(/\\/g, "/");
      const v2OutAbs = path.join(process.cwd(), v2OutRel);
      const v2 = await composeBannerV2({
        raw_generated_asset_absolute_path: rawPath,
        format,
        headline: input.headline,
        cta: input.cta,
        eyebrow: input.eyebrow,
        subheadline: input.subheadline,
        trust_element: input.trust_element,
        footer_line: input.footer_line,
        brand_tokens: DEFAULT_BRAND_TOKENS,
        logo_asset_absolute_path: null,
        output_absolute_path: v2OutAbs,
      });

      results.push({
        variant_id: variantId,
        format_id: formatId,
        seed,
        source_raw_path: path
          .relative(process.cwd(), rawPath)
          .replace(/\\/g, "/"),
        v1: {
          composed_path: v1.composed_asset_absolute_path
            ? path
                .relative(process.cwd(), v1.composed_asset_absolute_path)
                .replace(/\\/g, "/")
            : null,
          composed_sha256: v1.composed_asset_sha256,
          duration_ms: v1.duration_ms,
          failure_reason: v1.failure_reason,
        },
        v2: {
          composed_path: v2.composed_asset_absolute_path
            ? path
                .relative(process.cwd(), v2.composed_asset_absolute_path)
                .replace(/\\/g, "/")
            : null,
          composed_sha256: v2.composed_asset_sha256,
          duration_ms: v2.duration_ms,
          failure_reason: v2.failure_reason,
          chosen_candidate_id: v2.chosen_candidate_id,
          chosen_score_total: v2.chosen_score?.total ?? null,
          candidates_considered: v2.candidates_considered.length,
          headline_font_size_px:
            v2.typography.headline?.font_size_px ?? null,
          headline_wrapped_lines:
            v2.typography.headline?.wrapped_lines ?? null,
          crop_source_bbox: v2.crop_applied
            ? {
                x: v2.crop_applied.source_x,
                y: v2.crop_applied.source_y,
                w: v2.crop_applied.source_w,
                h: v2.crop_applied.source_h,
              }
            : null,
          busy_fraction: v2.negative_space_summary.busy_fraction,
        },
      });
    }
  }

  const outcome: ABRunOutcome = {
    ab_job_id: input.ab_job_id,
    source_job_id: input.source_job_id,
    started_at: started,
    completed_at: new Date().toISOString(),
    total_variants: results.length,
    results,
    output_root_absolute: abDir,
    output_root_relative: path.relative(process.cwd(), abDir).replace(/\\/g, "/"),
  };

  // Persist a summary JSON for inspection
  fs.writeFileSync(
    path.join(abDir, "ab-summary.json"),
    JSON.stringify(outcome, null, 2)
  );

  return outcome;
}

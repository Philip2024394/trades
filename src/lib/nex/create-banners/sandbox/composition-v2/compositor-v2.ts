// src/lib/nex/create-banners/sandbox/composition-v2/compositor-v2.ts
//
// NEX Composition Engineering Wave · main compositor
// ==================================================
// Ties negative-space + typography + contrast + candidates + scorer +
// crop into a single deterministic composition step.
// Every output stamped UNPROVEN · watermarked · sandbox-only.

import sharp from "sharp";
import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";

import { SANDBOX_WATERMARK_TEXT } from "../sandbox-doctrine";
import type {
  CompositionV2Input,
  CompositionV2Result,
  ContrastPlan,
  NegativeSpaceMap,
  Region,
  TypographyPlan,
} from "./types";
import { DEFAULT_BRAND_TOKENS } from "./types";
import {
  analyseNegativeSpace,
  globalBusyFraction,
  regionBusyScore,
} from "./negative-space-analyzer";
import { autoFitTypography, formatMinFontPx } from "./typography-engine";
import { planContrast } from "./contrast-analyzer";
import { generateLayoutCandidates } from "./layout-candidates";
import { pickBestCandidate, scoreLayoutCandidate } from "./layout-scorer";
import { planCrop } from "./crop-engine";

const FONT_STACK =
  "Inter, 'Segoe UI', Roboto, Arial, sans-serif" as const;

// Some Unicode punctuation (U+00B7 middle dot, U+2022 bullet, U+2027
// hyphenation point) is not always present in the font fallback chain
// used by librsvg/pango on Windows, which renders as U+FFFD (a tofu
// diamond). We swap those for ASCII " | " before SVG emission so the
// output is deterministic regardless of host font install state.
function sanitiseTextForSvgFont(s: string): string {
  return s
    .replace(/[·•‧∙⋅]/g, " | ")
    .replace(/\s+\|\s+/g, " | ");
}

function escapeXml(s: string): string {
  return sanitiseTextForSvgFont(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function backingRect(
  region: Region,
  gradientId: string,
  plan: ContrastPlan
): string {
  if (plan.backing.kind === "none") return "";
  if (plan.backing.kind === "solid") {
    return `<rect x="${region.x}" y="${region.y}" width="${region.w}" height="${region.h}" fill="${plan.backing.color}" opacity="${plan.backing.opacity}" />`;
  }
  const stops = plan.backing.stops
    .map(
      (s) =>
        `<stop offset="${(s.offset * 100).toFixed(0)}%" stop-color="${s.color}" />`
    )
    .join("");
  return `<linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>
<rect x="${region.x}" y="${region.y}" width="${region.w}" height="${region.h}" fill="url(#${gradientId})" />`;
}

function textElement(
  region: Region,
  plan: TypographyPlan,
  contrast: ContrastPlan,
  align: "left" | "centre" | "right" = "left"
): string {
  const lines = plan.wrapped_lines;
  const line_h = plan.line_height_px;
  const start_y =
    region.y + Math.round(plan.font_size_px * 0.9); // baseline of first line
  const x_anchor =
    align === "left"
      ? region.x
      : align === "right"
      ? region.x + region.w
      : region.x + region.w / 2;
  const text_anchor =
    align === "left" ? "start" : align === "right" ? "end" : "middle";
  const filter = contrast.shadow ? ` filter="url(#txt_shadow)"` : "";
  const strokeAttrs =
    contrast.stroke_color && contrast.stroke_width_px > 0
      ? ` stroke="${contrast.stroke_color}" stroke-width="${contrast.stroke_width_px}"`
      : "";
  const tspans = lines
    .map(
      (line, i) =>
        `<tspan x="${x_anchor}" ${
          i === 0 ? `y="${start_y}"` : `dy="${line_h}"`
        }>${escapeXml(line)}</tspan>`
    )
    .join("");
  return `<text font-family="${plan.font_family}" font-size="${plan.font_size_px}" font-weight="${plan.font_weight}" fill="${contrast.text_color}" text-anchor="${text_anchor}"${strokeAttrs}${filter}>${tspans}</text>`;
}

function ctaButton(
  region: Region,
  plan: TypographyPlan,
  fill: string,
  textColor: string
): string {
  const radius = Math.round(Math.min(region.h * 0.35, 24));
  // Join all wrapped lines defensively — the typography engine is now
  // run with no_wrap:true for CTAs so lines.length should always be 1,
  // but a defensive join guarantees no trailing word is silently dropped
  // even if a future caller forgets the flag.
  const label = plan.wrapped_lines.join(" ").trim();
  const centre_x = region.x + region.w / 2;
  const baseline_y = region.y + Math.round(region.h * 0.62);
  return `<g>
    <rect x="${region.x}" y="${region.y}" width="${region.w}" height="${region.h}" rx="${radius}" ry="${radius}" fill="${fill}" />
    <text x="${centre_x}" y="${baseline_y}" font-family="${plan.font_family}" font-size="${plan.font_size_px}" font-weight="${plan.font_weight}" fill="${textColor}" text-anchor="middle">${escapeXml(label)}</text>
  </g>`;
}

function watermarkOverlay(w: number, h: number): string {
  const wm = escapeXml(SANDBOX_WATERMARK_TEXT);
  const font_size = Math.max(14, Math.round(h * 0.035));
  return `<g transform="translate(${w / 2}, ${h / 2}) rotate(-30)">
    <text x="0" y="0" text-anchor="middle" font-family="${FONT_STACK}" font-size="${font_size * 2}" font-weight="800" fill="rgba(220,38,38,0.5)" stroke="rgba(0,0,0,0.3)" stroke-width="1">${wm}</text>
  </g>
  <text x="${w - Math.round(w * 0.04)}" y="${h - Math.round(w * 0.02)}" text-anchor="end" font-family="${FONT_STACK}" font-size="${Math.round(h * 0.02)}" font-weight="700" fill="#ffffff" opacity="0.85">${escapeXml("NEX SANDBOX v2 · UNPROVEN")}</text>`;
}

export async function composeBannerV2(
  input: CompositionV2Input
): Promise<CompositionV2Result> {
  const started = Date.now();
  try {
    const tokens = input.brand_tokens ?? DEFAULT_BRAND_TOKENS;
    const format = input.format;

    // 1 · analyse the source image
    const source_ns = await analyseNegativeSpace(
      input.raw_generated_asset_absolute_path
    );

    // 2 · plan the crop for target aspect
    const crop = planCrop({
      negative_space: source_ns,
      target_width: format.width,
      target_height: format.height,
    });

    // 3 · realise the cropped image at the target format dims
    const cropped_buffer = await sharp(input.raw_generated_asset_absolute_path)
      .extract({
        left: crop.source_x,
        top: crop.source_y,
        width: crop.source_w,
        height: crop.source_h,
      })
      .resize(format.width, format.height, { fit: "fill" })
      .sharpen(0.5, 1, 0.7)
      .toBuffer();

    // Write temp cropped file for re-analysis at target dimensions
    const tmp_cropped_path = input.output_absolute_path + ".crop.tmp.png";
    fs.mkdirSync(path.dirname(tmp_cropped_path), { recursive: true });
    fs.writeFileSync(tmp_cropped_path, cropped_buffer);

    const target_ns = await analyseNegativeSpace(tmp_cropped_path);

    // 4 · generate candidates
    const candidates = generateLayoutCandidates({
      format,
      has_logo: Boolean(input.logo_asset_absolute_path),
      has_eyebrow: Boolean(input.eyebrow),
      has_subheadline: Boolean(input.subheadline),
      has_benefits: false,
      has_trust: Boolean(input.trust_element),
      has_footer: Boolean(input.footer_line),
    });

    // 5 · score each
    const score_by_id = new Map<string, ReturnType<typeof scoreLayoutCandidate>>();
    for (const c of candidates) {
      score_by_id.set(
        c.candidate_id,
        scoreLayoutCandidate({
          candidate: c,
          negative_space: target_ns,
          target_width: format.width,
          target_height: format.height,
        })
      );
    }
    const { candidate: chosen, score: chosen_score } = pickBestCandidate(
      candidates,
      score_by_id
    );

    // 6 · typography auto-fit for headline + CTA
    const headline_region = chosen.regions.headline!;
    const headline_typo = autoFitTypography({
      text: input.headline,
      available_width_px: headline_region.w,
      available_height_px: headline_region.h,
      font_family: FONT_STACK,
      font_weight: 800,
      min_font_size_px: formatMinFontPx(format.height),
      max_font_size_px: Math.round(format.height * 0.09),
      line_height_ratio: 1.12,
      max_lines: 3,
    });

    const cta_region = chosen.regions.cta!;
    const cta_typo = autoFitTypography({
      text: input.cta,
      available_width_px: Math.round(cta_region.w * 0.9),
      available_height_px: cta_region.h,
      font_family: FONT_STACK,
      font_weight: 700,
      // Allow a lower floor for CTA — button labels tolerate small
      // reduction better than losing trailing words entirely.
      min_font_size_px: 10,
      max_font_size_px: Math.round(cta_region.h * 0.5),
      line_height_ratio: 1.1,
      no_wrap: true,
    });

    // 7 · contrast plans
    const busy_frac = globalBusyFraction(target_ns);
    const headline_busy =
      regionBusyScore(target_ns, headline_region) > 0.2;
    const headline_contrast = planContrast({
      region: headline_region,
      negative_space: target_ns,
      tokens,
      region_is_busy: headline_busy,
    });
    const cta_contrast = planContrast({
      region: cta_region,
      negative_space: target_ns,
      tokens,
      region_is_busy: false,
    });

    // 8 · build overlay SVG
    const defsFilter = `<defs><filter id="txt_shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="1.6" flood-color="rgba(0,0,0,0.55)" /></filter></defs>`;
    const backingSvg = backingRect(
      headline_region,
      "grad_headline",
      headline_contrast
    );
    const headlineSvg = textElement(
      headline_region,
      headline_typo,
      headline_contrast,
      "left"
    );
    const ctaSvg = ctaButton(
      cta_region,
      cta_typo,
      tokens.cta_fill,
      tokens.cta_text
    );

    // Optional subheadline
    let subSvg = "";
    if (input.subheadline && chosen.regions.subheadline) {
      const sub_region = chosen.regions.subheadline;
      const sub_typo = autoFitTypography({
        text: input.subheadline,
        available_width_px: sub_region.w,
        available_height_px: sub_region.h,
        font_family: FONT_STACK,
        font_weight: 500,
        min_font_size_px: formatMinFontPx(format.height) - 2,
        max_font_size_px: Math.round(format.height * 0.035),
        line_height_ratio: 1.2,
        max_lines: 2,
      });
      const sub_contrast = planContrast({
        region: sub_region,
        negative_space: target_ns,
        tokens,
        region_is_busy:
          regionBusyScore(target_ns, sub_region) > 0.2,
      });
      subSvg = textElement(sub_region, sub_typo, sub_contrast, "left");
    }

    // Optional eyebrow
    let eyebrowSvg = "";
    if (input.eyebrow && chosen.regions.eyebrow) {
      const e_region = chosen.regions.eyebrow;
      const e_typo = autoFitTypography({
        text: input.eyebrow.toUpperCase(),
        available_width_px: e_region.w,
        available_height_px: e_region.h,
        font_family: FONT_STACK,
        font_weight: 700,
        min_font_size_px: 9,
        max_font_size_px: Math.round(e_region.h * 0.8),
        line_height_ratio: 1,
        no_wrap: true,
      });
      const e_contrast = planContrast({
        region: e_region,
        negative_space: target_ns,
        tokens,
        region_is_busy: false,
      });
      eyebrowSvg = `<text x="${e_region.x}" y="${
        e_region.y + Math.round(e_typo.font_size_px * 0.9)
      }" font-family="${FONT_STACK}" font-size="${e_typo.font_size_px}" font-weight="700" fill="${
        tokens.accent
      }" letter-spacing="2">${escapeXml(input.eyebrow.toUpperCase())}</text>`;
    }

    // Optional footer
    let footerSvg = "";
    if (input.footer_line && chosen.regions.footer) {
      const f_region = chosen.regions.footer;
      const f_contrast = planContrast({
        region: f_region,
        negative_space: target_ns,
        tokens,
        region_is_busy: false,
      });
      const f_font = Math.max(11, Math.round(f_region.h * 0.55));
      footerSvg = `<text x="${f_region.x}" y="${
        f_region.y + Math.round(f_font * 0.9)
      }" font-family="${FONT_STACK}" font-size="${f_font}" font-weight="500" fill="${
        f_contrast.text_color
      }" opacity="0.9">${escapeXml(input.footer_line)}</text>`;
    }

    // Optional trust element
    let trustSvg = "";
    if (input.trust_element && chosen.regions.trust) {
      const t_region = chosen.regions.trust;
      const t_contrast = planContrast({
        region: t_region,
        negative_space: target_ns,
        tokens,
        region_is_busy: false,
      });
      const t_font = Math.max(10, Math.round(t_region.h * 0.55));
      trustSvg = `<text x="${t_region.x + t_region.w}" y="${
        t_region.y + Math.round(t_font * 0.9)
      }" font-family="${FONT_STACK}" font-size="${t_font}" font-weight="600" fill="${
        t_contrast.text_color
      }" text-anchor="end" opacity="0.9">${escapeXml(input.trust_element)}</text>`;
    }

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${format.width}" height="${format.height}" viewBox="0 0 ${format.width} ${format.height}">
  ${defsFilter}
  ${backingSvg}
  ${eyebrowSvg}
  ${headlineSvg}
  ${subSvg}
  ${ctaSvg}
  ${footerSvg}
  ${trustSvg}
  ${watermarkOverlay(format.width, format.height)}
</svg>`;

    const composedBuffer = await sharp(cropped_buffer)
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .png()
      .toBuffer();

    fs.mkdirSync(path.dirname(input.output_absolute_path), {
      recursive: true,
    });
    fs.writeFileSync(input.output_absolute_path, composedBuffer);
    try {
      fs.unlinkSync(tmp_cropped_path);
    } catch {
      /* ignore */
    }

    const sha = createHash("sha256").update(composedBuffer).digest("hex");
    return {
      kind: "SUCCESS",
      composed_asset_absolute_path: input.output_absolute_path,
      composed_asset_sha256: sha,
      composed_asset_bytes: composedBuffer.length,
      duration_ms: Date.now() - started,
      failure_reason: null,
      chosen_candidate_id: chosen.candidate_id,
      chosen_score: chosen_score,
      candidates_considered: Array.from(score_by_id.values()),
      typography: { headline: headline_typo, cta: cta_typo },
      contrast: { headline: headline_contrast, cta: cta_contrast },
      crop_applied: {
        source_x: crop.source_x,
        source_y: crop.source_y,
        source_w: crop.source_w,
        source_h: crop.source_h,
      },
      negative_space_summary: {
        busy_fraction: busy_frac,
        primary_subject_bbox: target_ns.primary_subject_bbox,
      },
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return {
      kind: "FAILURE",
      composed_asset_absolute_path: null,
      composed_asset_sha256: null,
      composed_asset_bytes: null,
      duration_ms: Date.now() - started,
      failure_reason: reason,
      chosen_candidate_id: null,
      chosen_score: null,
      candidates_considered: [],
      typography: { headline: null, cta: null },
      contrast: { headline: null, cta: null },
      crop_applied: null,
      negative_space_summary: { busy_fraction: 0, primary_subject_bbox: null },
    };
  }
}

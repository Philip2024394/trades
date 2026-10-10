// src/lib/nex/create-banners/sandbox/composition-v2/layout-candidates.ts
//
// NEX Composition Engineering Wave · layout candidate generator
// =============================================================
// Produce multiple deterministic layout candidates per composition.
// The scorer picks the best. NEVER produces a layout by AI. Every
// candidate is a fixed geometric proposal driven by the format
// dimensions and element requirements.

import type { LayoutCandidate, Region } from "./types";
import type { BannerFormat } from "../../formats";

export interface CandidateRequest {
  readonly format: BannerFormat;
  readonly has_logo: boolean;
  readonly has_eyebrow: boolean;
  readonly has_subheadline: boolean;
  readonly has_benefits: boolean;
  readonly has_trust: boolean;
  readonly has_footer: boolean;
}

export function generateLayoutCandidates(
  req: CandidateRequest
): readonly LayoutCandidate[] {
  const w = req.format.width;
  const h = req.format.height;
  const marginX = Math.round(w * 0.05);
  const marginY = Math.round(h * 0.05);

  // Reserved sizes (per format · scale by height)
  const logo_h = Math.round(h * 0.08);
  const eyebrow_h = Math.round(h * 0.04);
  const headline_h = Math.round(h * 0.18);
  const subheadline_h = Math.round(h * 0.06);
  const benefits_h = Math.round(h * 0.14);
  const cta_h = Math.round(h * 0.1);
  const trust_h = Math.round(h * 0.04);
  const footer_h = Math.round(h * 0.04);

  const inner_w = w - marginX * 2;

  // ─────────────────────────────────────────────────────────────────
  // Candidate A · Top-left hierarchy stack
  // ─────────────────────────────────────────────────────────────────
  const candidateA_TopLeft = (): LayoutCandidate => {
    let y = marginY;
    const regions: LayoutCandidate["regions"] = {};
    if (req.has_logo) {
      regions.logo = {
        x: marginX,
        y,
        w: Math.round(inner_w * 0.35),
        h: logo_h,
      };
      y += logo_h + Math.round(h * 0.015);
    }
    if (req.has_eyebrow) {
      regions.eyebrow = { x: marginX, y, w: inner_w, h: eyebrow_h };
      y += eyebrow_h + Math.round(h * 0.005);
    }
    regions.headline = { x: marginX, y, w: inner_w, h: headline_h };
    y += headline_h + Math.round(h * 0.01);
    if (req.has_subheadline) {
      regions.subheadline = { x: marginX, y, w: inner_w, h: subheadline_h };
      y += subheadline_h + Math.round(h * 0.01);
    }
    // CTA anchored below headline block (still top-half)
    regions.cta = {
      x: marginX,
      y,
      w: Math.round(inner_w * 0.45),
      h: cta_h,
    };
    if (req.has_footer) {
      regions.footer = {
        x: marginX,
        y: h - marginY - footer_h,
        w: inner_w,
        h: footer_h,
      };
    }
    if (req.has_trust) {
      regions.trust = {
        x: w - marginX - Math.round(inner_w * 0.3),
        y: h - marginY - trust_h - (req.has_footer ? footer_h + 6 : 0),
        w: Math.round(inner_w * 0.3),
        h: trust_h,
      };
    }
    return {
      candidate_id: "A-top-left-stack",
      anchor: "top-left",
      regions,
      targets_region_of_interest: "top",
    };
  };

  // ─────────────────────────────────────────────────────────────────
  // Candidate B · Bottom-left hierarchy stack (image-dominant top)
  // ─────────────────────────────────────────────────────────────────
  const candidateB_BottomLeft = (): LayoutCandidate => {
    let y = h - marginY;
    const regions: LayoutCandidate["regions"] = {};
    if (req.has_footer) {
      y -= footer_h;
      regions.footer = { x: marginX, y, w: inner_w, h: footer_h };
      y -= Math.round(h * 0.01);
    }
    y -= cta_h;
    regions.cta = {
      x: marginX,
      y,
      w: Math.round(inner_w * 0.5),
      h: cta_h,
    };
    y -= Math.round(h * 0.015);
    if (req.has_subheadline) {
      y -= subheadline_h;
      regions.subheadline = { x: marginX, y, w: inner_w, h: subheadline_h };
      y -= Math.round(h * 0.005);
    }
    y -= headline_h;
    regions.headline = { x: marginX, y, w: inner_w, h: headline_h };
    if (req.has_logo) {
      regions.logo = {
        x: marginX,
        y: marginY,
        w: Math.round(inner_w * 0.3),
        h: logo_h,
      };
    }
    if (req.has_trust) {
      regions.trust = {
        x: w - marginX - Math.round(inner_w * 0.3),
        y: marginY,
        w: Math.round(inner_w * 0.3),
        h: trust_h,
      };
    }
    return {
      candidate_id: "B-bottom-left-stack",
      anchor: "bottom-left",
      regions,
      targets_region_of_interest: "bottom",
    };
  };

  // ─────────────────────────────────────────────────────────────────
  // Candidate C · Right-side hierarchy (image on left · text on right)
  // ─────────────────────────────────────────────────────────────────
  const candidateC_TopRight = (): LayoutCandidate => {
    const right_w = Math.round(inner_w * 0.55);
    const rx = w - marginX - right_w;
    let y = marginY;
    const regions: LayoutCandidate["regions"] = {};
    if (req.has_logo) {
      regions.logo = { x: rx, y, w: Math.round(right_w * 0.4), h: logo_h };
      y += logo_h + Math.round(h * 0.015);
    }
    regions.headline = { x: rx, y, w: right_w, h: headline_h };
    y += headline_h + Math.round(h * 0.01);
    if (req.has_subheadline) {
      regions.subheadline = { x: rx, y, w: right_w, h: subheadline_h };
      y += subheadline_h + Math.round(h * 0.01);
    }
    regions.cta = {
      x: rx,
      y,
      w: Math.round(right_w * 0.6),
      h: cta_h,
    };
    if (req.has_footer) {
      regions.footer = {
        x: rx,
        y: h - marginY - footer_h,
        w: right_w,
        h: footer_h,
      };
    }
    return {
      candidate_id: "C-top-right-side",
      anchor: "top-right",
      regions,
      targets_region_of_interest: "right",
    };
  };

  // ─────────────────────────────────────────────────────────────────
  // Candidate D · Bottom-right stack
  // ─────────────────────────────────────────────────────────────────
  const candidateD_BottomRight = (): LayoutCandidate => {
    const right_w = Math.round(inner_w * 0.55);
    const rx = w - marginX - right_w;
    let y = h - marginY;
    const regions: LayoutCandidate["regions"] = {};
    if (req.has_footer) {
      y -= footer_h;
      regions.footer = { x: rx, y, w: right_w, h: footer_h };
      y -= Math.round(h * 0.01);
    }
    y -= cta_h;
    regions.cta = { x: rx, y, w: Math.round(right_w * 0.6), h: cta_h };
    y -= Math.round(h * 0.015);
    y -= headline_h;
    regions.headline = { x: rx, y, w: right_w, h: headline_h };
    if (req.has_logo) {
      regions.logo = {
        x: marginX,
        y: marginY,
        w: Math.round(inner_w * 0.3),
        h: logo_h,
      };
    }
    return {
      candidate_id: "D-bottom-right-stack",
      anchor: "bottom-right",
      regions,
      targets_region_of_interest: "right",
    };
  };

  // ─────────────────────────────────────────────────────────────────
  // Candidate E · Centre horizontal strip (for wide landscape formats)
  // ─────────────────────────────────────────────────────────────────
  const candidateE_CentreStrip = (): LayoutCandidate => {
    const strip_h = Math.round(h * 0.45);
    const sy = Math.round((h - strip_h) / 2);
    let y = sy + Math.round(h * 0.02);
    const regions: LayoutCandidate["regions"] = {};
    if (req.has_logo) {
      regions.logo = {
        x: marginX,
        y,
        w: Math.round(inner_w * 0.25),
        h: logo_h,
      };
      y += logo_h + Math.round(h * 0.01);
    }
    regions.headline = { x: marginX, y, w: inner_w, h: headline_h };
    y += headline_h + Math.round(h * 0.01);
    regions.cta = {
      x: marginX,
      y,
      w: Math.round(inner_w * 0.5),
      h: cta_h,
    };
    return {
      candidate_id: "E-centre-strip",
      anchor: "centre-strip",
      regions,
      targets_region_of_interest: "centre",
    };
  };

  return [
    candidateA_TopLeft(),
    candidateB_BottomLeft(),
    candidateC_TopRight(),
    candidateD_BottomRight(),
    candidateE_CentreStrip(),
  ];
}

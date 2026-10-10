// src/lib/nex/create-banners/sandbox/composition-v2/layout-scorer.ts
//
// NEX Composition Engineering Wave · deterministic layout scorer
// ==============================================================
// Score each candidate layout using engineering rules only. NOT an AI
// quality score · NOT a Banner Evaluation Plan verdict · this is
// layout-VALIDITY only.

import type {
  LayoutCandidate,
  LayoutScore,
  NegativeSpaceMap,
  Region,
} from "./types";
import { regionBusyScore } from "./negative-space-analyzer";

export interface ScoreContext {
  readonly candidate: LayoutCandidate;
  /** Negative-space map from the cropped source image (matched to target format dims). */
  readonly negative_space: NegativeSpaceMap;
  readonly target_width: number;
  readonly target_height: number;
}

function overlapArea(a: Region, b: Region): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const w = Math.max(0, x2 - x1);
  const h = Math.max(0, y2 - y1);
  return w * h;
}

function regionsInCandidate(c: LayoutCandidate): Array<[string, Region]> {
  const out: Array<[string, Region]> = [];
  const r = c.regions;
  if (r.logo) out.push(["logo", r.logo]);
  if (r.eyebrow) out.push(["eyebrow", r.eyebrow]);
  if (r.headline) out.push(["headline", r.headline]);
  if (r.subheadline) out.push(["subheadline", r.subheadline]);
  if (r.benefits) out.push(["benefits", r.benefits]);
  if (r.cta) out.push(["cta", r.cta]);
  if (r.trust) out.push(["trust", r.trust]);
  if (r.footer) out.push(["footer", r.footer]);
  return out;
}

export function scoreLayoutCandidate(ctx: ScoreContext): LayoutScore {
  const { candidate, negative_space, target_width, target_height } = ctx;
  const regions = regionsInCandidate(candidate);
  const reasons: string[] = [];

  // 1 · Safe-zone fit · every region must be inside the canvas
  let safe_zone_fit = 1;
  for (const [name, r] of regions) {
    if (r.x < 0 || r.y < 0 || r.x + r.w > target_width || r.y + r.h > target_height) {
      safe_zone_fit -= 0.25;
      reasons.push(`${name} out of canvas`);
    }
  }
  safe_zone_fit = Math.max(0, safe_zone_fit);

  // 2 · Negative-space alignment · every text region should sit in low-busy area
  let ns_sum = 0;
  let ns_count = 0;
  for (const [name, r] of regions) {
    if (name === "logo") continue;
    const busy = regionBusyScore(negative_space, r);
    ns_sum += 1 - busy;
    ns_count += 1;
  }
  const negative_space_alignment = ns_count > 0 ? ns_sum / ns_count : 0.5;

  // 3 · Contrast readability · headline region should not be extreme mid-luminance
  //     (mid-tones without backing are the hardest to read). We reward regions
  //     that are clearly dark or clearly light.
  let contrast_readability = 0.5;
  if (candidate.regions.headline) {
    const r = candidate.regions.headline;
    const busy = regionBusyScore(negative_space, r);
    contrast_readability = Math.max(0, 1 - busy);
  }

  // 4 · Hierarchy · headline present + CTA present + headline visually above/left of CTA
  let hierarchy_preserved = 0;
  if (candidate.regions.headline && candidate.regions.cta) {
    hierarchy_preserved = 1;
    const hy = candidate.regions.headline.y;
    const cy = candidate.regions.cta.y;
    if (hy > cy && candidate.anchor.startsWith("top")) {
      hierarchy_preserved -= 0.4;
      reasons.push("headline placed below CTA in top anchor");
    }
  } else {
    reasons.push("missing headline or CTA");
  }
  hierarchy_preserved = Math.max(0, hierarchy_preserved);

  // 5 · No-collisions · pairwise overlap between regions must be zero
  let no_collisions = 1;
  for (let i = 0; i < regions.length; i++) {
    for (let j = i + 1; j < regions.length; j++) {
      const [na, ra] = regions[i]!;
      const [nb, rb] = regions[j]!;
      const o = overlapArea(ra, rb);
      if (o > 0) {
        const ra_area = ra.w * ra.h;
        const frac = ra_area > 0 ? o / ra_area : 0;
        no_collisions -= 0.5 * frac;
        reasons.push(`${na} overlaps ${nb}`);
      }
    }
  }
  no_collisions = Math.max(0, no_collisions);

  // 6 · Alignment consistency · left-anchored candidates share x-left
  let alignment_consistency = 1;
  if (
    candidate.anchor === "top-left" ||
    candidate.anchor === "bottom-left" ||
    candidate.anchor === "centre-strip"
  ) {
    const xs = regions
      .filter(([n]) => n !== "logo" && n !== "trust")
      .map(([, r]) => r.x);
    if (xs.length >= 2) {
      const max_diff = Math.max(...xs) - Math.min(...xs);
      if (max_diff > 4) {
        alignment_consistency -= Math.min(0.5, max_diff / 100);
        reasons.push("left-edge inconsistency");
      }
    }
  }
  alignment_consistency = Math.max(0, alignment_consistency);

  // 7 · Balance · reject candidates that put all weight in one corner
  //     (measured by centroid distance from centre)
  let balance = 1;
  const cx_target = target_width / 2;
  const cy_target = target_height / 2;
  let total_area = 0;
  let cx_sum = 0;
  let cy_sum = 0;
  for (const [, r] of regions) {
    const a = r.w * r.h;
    total_area += a;
    cx_sum += (r.x + r.w / 2) * a;
    cy_sum += (r.y + r.h / 2) * a;
  }
  if (total_area > 0) {
    const cx = cx_sum / total_area;
    const cy = cy_sum / total_area;
    const dx = Math.abs(cx - cx_target) / cx_target;
    const dy = Math.abs(cy - cy_target) / cy_target;
    balance = Math.max(0, 1 - (dx + dy) / 2.5);
  }

  const total =
    safe_zone_fit * 0.15 +
    negative_space_alignment * 0.3 +
    contrast_readability * 0.15 +
    hierarchy_preserved * 0.15 +
    no_collisions * 0.15 +
    alignment_consistency * 0.05 +
    balance * 0.05;

  return {
    candidate_id: candidate.candidate_id,
    total,
    breakdown: {
      safe_zone_fit,
      negative_space_alignment,
      contrast_readability,
      hierarchy_preserved,
      no_collisions,
      alignment_consistency,
      balance,
    },
    reasons,
  };
}

export function pickBestCandidate(
  candidates: readonly LayoutCandidate[],
  scoresById: Map<string, LayoutScore>
): { candidate: LayoutCandidate; score: LayoutScore } {
  let best: { candidate: LayoutCandidate; score: LayoutScore } | null = null;
  for (const c of candidates) {
    const s = scoresById.get(c.candidate_id)!;
    if (!best || s.total > best.score.total) {
      best = { candidate: c, score: s };
    }
  }
  return best!;
}

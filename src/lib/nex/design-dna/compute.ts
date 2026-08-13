// Design DNA Engine · compute + similarity.
//
// Doctrine: docs/brains/nex-phase-e10-e15-reconstruction-udl-multimodal-philip-2026-08-04.md

import type { DesignDNAFingerprint, ComplexityLabel, ContrastLabel, SymmetryLabel } from "./types";
import type { VisionAnalysis } from "../vision-intelligence";

const ENGINE_VERSION = "e12_design_dna_mvp_1.0";

function classifyComplexity(objectCount: number): ComplexityLabel {
  if (objectCount <= 2) return "very_low";
  if (objectCount <= 5) return "low";
  if (objectCount <= 12) return "medium";
  if (objectCount <= 25) return "high";
  return "very_high";
}

function classifySymmetry(analyses: readonly VisionAnalysis[]): SymmetryLabel {
  // Rough proxy: single-object scenes lean high · many-relationship scenes lean medium/low.
  const meanRels = analyses.length ? analyses.reduce((s, a) => s + a.relationships.length, 0) / analyses.length : 0;
  if (meanRels <= 1) return "high";
  if (meanRels <= 5) return "medium";
  return "low";
}

function normalise(weights: Record<string, number>): Record<string, number> {
  const sum = Object.values(weights).reduce((s, v) => s + v, 0) || 1;
  const out: Record<string, number> = {};
  for (const k of Object.keys(weights)) {
    out[k] = Math.round((weights[k] / sum) * 100) / 100;
  }
  return out;
}

export function computeDesignDNA(project_id: string, analyses: readonly VisionAnalysis[]): DesignDNAFingerprint {
  const styleAccum: Record<string, number> = {};
  let warmthSum = 0;
  const timbers: Record<string, number> = {};
  const paletteMap = new Set<string>();
  const hardwareMap: Record<string, number> = {};
  const lightingMap: Record<string, number> = {};
  const moodMap: Record<string, number> = {};
  let totalObjects = 0;
  const contrastVotes: Record<ContrastLabel, number> = { low: 0, medium: 0, high: 0 };

  for (const a of analyses) {
    for (const [k, v] of Object.entries(a.style_dna.weights)) {
      styleAccum[k] = (styleAccum[k] ?? 0) + v;
    }
    warmthSum += a.mood.overall_warmth_score;
    contrastVotes[a.mood.contrast] += 1;
    if (a.style_dna.timber) timbers[a.style_dna.timber] = (timbers[a.style_dna.timber] ?? 0) + 1;
    if (a.style_dna.hardware) hardwareMap[a.style_dna.hardware] = (hardwareMap[a.style_dna.hardware] ?? 0) + 1;
    if (a.style_dna.lighting) lightingMap[a.style_dna.lighting] = (lightingMap[a.style_dna.lighting] ?? 0) + 1;
    if (a.style_dna.mood) moodMap[a.style_dna.mood] = (moodMap[a.style_dna.mood] ?? 0) + 1;
    for (const c of a.mood.dominant_palette) paletteMap.add(c);
    totalObjects += a.objects.length;
  }

  const style_weights = normalise(styleAccum);
  const warmth = analyses.length ? Math.round(warmthSum / analyses.length) : 0;
  const dominant = (map: Record<string, number>): string | undefined => {
    const entries = Object.entries(map);
    if (entries.length === 0) return undefined;
    return entries.sort((a, b) => b[1] - a[1])[0][0];
  };
  const contrast = Object.entries(contrastVotes).sort((a, b) => b[1] - a[1])[0][0] as ContrastLabel;

  return {
    project_id,
    captured_at: new Date().toISOString(),
    style_weights,
    warmth_score: warmth,
    complexity: classifyComplexity(totalObjects),
    contrast,
    symmetry: classifySymmetry(analyses),
    timber: dominant(timbers),
    palette: Array.from(paletteMap),
    hardware: dominant(hardwareMap),
    lighting: dominant(lightingMap),
    mood: dominant(moodMap),
    sample_size: analyses.length,
    provenance: { engine_version: ENGINE_VERSION, generated_at: new Date().toISOString() },
  };
}

/** Cosine similarity of style_weights + warmth agreement + contrast/complexity/symmetry agreement.
 *  Returns 0..1 · higher = more alike. */
export function similarity(a: DesignDNAFingerprint, b: DesignDNAFingerprint): number {
  const keys = new Set([...Object.keys(a.style_weights), ...Object.keys(b.style_weights)]);
  let dot = 0, ma = 0, mb = 0;
  for (const k of keys) {
    const av = a.style_weights[k] ?? 0;
    const bv = b.style_weights[k] ?? 0;
    dot += av * bv;
    ma += av * av;
    mb += bv * bv;
  }
  const cosine = ma && mb ? dot / (Math.sqrt(ma) * Math.sqrt(mb)) : 0;
  const warmthAgree = 1 - Math.abs(a.warmth_score - b.warmth_score) / 100;
  const contrastAgree = a.contrast === b.contrast ? 1 : 0.5;
  const complexityAgree = a.complexity === b.complexity ? 1 : 0.5;
  const symmetryAgree = a.symmetry === b.symmetry ? 1 : 0.5;
  const composite = cosine * 0.5 + warmthAgree * 0.2 + contrastAgree * 0.1 + complexityAgree * 0.1 + symmetryAgree * 0.1;
  return Math.round(composite * 100) / 100;
}

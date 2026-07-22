// Brand Identity Fingerprint — deterministic hash from a merchant's
// profile that seeds every downstream design decision. Two merchants
// with identical inputs produce identical fingerprints; any change
// produces a stable new one. Ensures uniqueness by construction, not
// by random noise (per ChatGPT batch 2, answer 1c).
//
// Fingerprint composition (in order, joined with '|'):
//   industry · personality · geometry · construction · primary_shape
//   secondary_shape · style · symmetry · complexity · colour · accent
//   letterform
//
// Hash: SHA-256, first 24 hex chars. Enough entropy for 10^18 distinct
// fingerprints; collision probability effectively zero at merchant scale.

import { createHash } from "node:crypto";

export type FingerprintInput = {
  industry:       string;
  personality:    string[];      // 1-4 traits, sorted alphabetically before hashing
  geometry:       string;        // 'hexagon' | 'circle' | 'square' | 'diamond' | 'triangle'
  construction:   string;        // 'negative-space' | 'stacked' | 'monogram' | 'crest' | 'wordmark'
  primary_shape:  string;        // trade-native primary icon ('pipe' | 'plane' | 'brick' | ...)
  secondary_shape: string;       // supporting element or 'none'
  style:          string;        // 'architectural' | 'organic' | 'geometric' | 'heritage'
  symmetry:       string;        // 'vertical' | 'horizontal' | 'radial' | 'asymmetric'
  complexity:     string;        // 'minimal' | 'medium' | 'rich'
  colour:         string;        // primary colour name (not hex — names hash stably across renders)
  accent:         string;        // accent colour name or 'none'
  letterform:     string;        // initial letter for monogram, or 'none'
};

/** Compute a stable, uniqueness-preserving fingerprint. */
export function computeFingerprint(input: FingerprintInput): string {
  const parts = [
    normalise(input.industry),
    input.personality.map(normalise).sort().join(","),
    normalise(input.geometry),
    normalise(input.construction),
    normalise(input.primary_shape),
    normalise(input.secondary_shape),
    normalise(input.style),
    normalise(input.symmetry),
    normalise(input.complexity),
    normalise(input.colour),
    normalise(input.accent),
    normalise(input.letterform)
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24);
}

function normalise(s: string): string {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, "-");
}

/** Produce the human-readable description of the fingerprint inputs.
 *  Useful for the Decision Engine's "explain why" output. */
export function describeFingerprint(input: FingerprintInput): string {
  return [
    `Industry: ${input.industry}`,
    `Personality: ${input.personality.join(", ")}`,
    `Geometry: ${input.geometry}`,
    `Construction: ${input.construction}`,
    `Primary shape: ${input.primary_shape}`,
    `Secondary: ${input.secondary_shape}`,
    `Style: ${input.style}`,
    `Symmetry: ${input.symmetry}`,
    `Complexity: ${input.complexity}`,
    `Colour: ${input.colour}`,
    `Accent: ${input.accent}`,
    `Letterform: ${input.letterform}`
  ].join("\n");
}

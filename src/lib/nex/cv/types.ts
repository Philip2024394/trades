// Nex Construction Vision — contracts.
//
// Vision analysis is FUNDAMENTALLY DIFFERENT from the other engines
// because vision models can hallucinate. Every claim in this module
// carries a confidence field so callers surface uncertainty rather
// than pretending certainty.
//
// Guardrails baked into the type system:
//   • RegulationQuery returns "checks to make" — never a yes/no
//     compliance verdict (Nex is not a building inspector).
//   • SafetyObservation always appends human_verification_note.
//   • MeasurementEstimate requires a calibration source — otherwise
//     the estimate is labelled "unscaled".

import type { Evidence } from "../pi/types";
export type { Evidence };

export type Confidence = "low" | "medium" | "high";

/** Optional context the caller can pass to sharpen the analysis. */
export type AnalysisContext = {
  merchantSlug?: string;
  projectId?:    string;
  trade?:        string;                    // "plastering" | "roofing" | …
  /** Free-text hint from the user ("this is the kitchen ceiling"). */
  hint?:         string;
};

// ─── Core analysis ───────────────────────────────────────────────

export type DetectedItem = {
  label:      string;                       // "plasterboard", "quarter-turn staircase", "PVA primer"
  category:   "material" | "structure" | "tool" | "plant" | "vehicle" | "person" | "hazard" | "finish" | "unknown";
  confidence: Confidence;
};

export type ImageObservation = {
  key:        string;
  headline:   string;                       // "Skim coat visibly uneven on the left wall"
  detail?:    string;
  confidence: Confidence;
};

export type NextStep = {
  action:     string;
  reason:     string;
};

export type VisionAnalysis = {
  /** One-line human summary. */
  summary:            string;
  /** The most likely primary trade for this image. */
  primary_trade:      string | null;
  /** The likely stage of work. */
  stage:              "before" | "in-progress" | "after" | "unknown";
  detected:           DetectedItem[];
  observations:       ImageObservation[];
  defects:            ImageObservation[];   // problems noticed
  safety:             SafetyObservation[];
  next_steps:         NextStep[];
  overall_confidence: Confidence;
  /** Explicit disclaimer surfaced on every reply. */
  disclaimer:         string;
  /** Meta — how the analysis was produced. */
  evidence:           Evidence;
  /** When null the analysis couldn't run (no OpenAI key / model
   *  refused / rate-limited). Callers must handle this without
   *  fabricating a response. */
  error?:             string;
};

// ─── Specialised outputs ─────────────────────────────────────────

export type DamageReport = {
  summary:          string;
  damage:           Array<{ label: string; likely_cause: string; severity: "low" | "medium" | "high"; confidence: Confidence }>;
  recommended_action: string;
  disclaimer:       string;
  evidence:         Evidence;
  error?:           string;
};

export type SafetyObservation = {
  hazard:                   string;
  severity:                 "low" | "medium" | "high";
  recommended_action:       string;
  confidence:               Confidence;
  human_verification_note:  string;         // always present
};

export type SafetyReport = {
  summary:      string;
  observations: SafetyObservation[];
  disclaimer:   string;
  evidence:     Evidence;
  error?:       string;
};

export type MeasurementEstimate = {
  summary:           string;
  /** True when the image includes a scale reference (ruler / known
   *  object). Otherwise measurements are labelled "unscaled" and
   *  presented as ratios only. */
  scaled:            boolean;
  scale_reference?:  string;
  estimates:         Array<{ label: string; value: string; confidence: Confidence }>;
  disclaimer:        string;
  evidence:          Evidence;
  error?:            string;
};

export type OCRResult = {
  summary:      string;
  document_kind: "receipt" | "invoice" | "certificate" | "delivery_note" | "risk_assessment" | "other" | "unknown";
  fields:       Array<{ key: string; value: string; confidence: Confidence }>;
  raw_text?:    string;
  disclaimer:   string;
  evidence:     Evidence;
  error?:       string;
};

export type ImageComparison = {
  summary:      string;
  changes:      Array<{ label: string; detail: string; confidence: Confidence }>;
  improvements: string[];
  concerns:     string[];
  disclaimer:   string;
  evidence:     Evidence;
  error?:       string;
};

export function evidenceFor(source: string, tables: string[] = []): Evidence {
  return {
    source,
    tables,
    computed_at: new Date().toISOString()
  };
}

// ─── Standard disclaimers (must appear on every reply) ───────────

export const DISCLAIMERS = {
  general:
    "Vision analysis is a first look, not a formal inspection. Always confirm with your own eyes before acting on anything safety-critical or regulated.",
  regulation:
    "Nex is not a building inspector. This is a list of checks to consider, not a compliance verdict — get a qualified inspector for the sign-off.",
  measurement:
    "Measurements from a photograph are indicative only unless the image contains a known scale reference. Take a tape measure to anything that matters.",
  safety:
    "Every safety observation must be verified in person. A photo can miss context (edge protection just out of frame, PPE the person is about to put on, etc.).",
  ocr:
    "OCR from photos can misread digits and characters. Double-check every figure against the source document before entering it into your books."
};

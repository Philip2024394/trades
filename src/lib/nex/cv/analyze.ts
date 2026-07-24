// General construction-image analysis.
//
// Takes an image URL + optional context, calls the vision model via
// the existing reviewImage() primitive, validates the JSON, wraps it
// in a schema-safe VisionAnalysis, adds the disclaimer.
//
// Failure paths (all return VisionAnalysis with an `error` field):
//   • No OPENAI_API_KEY  → error: "no_vision_key"
//   • Model refused / returned unparseable JSON → error: "model_failed"
//   • Cache hit          → returns cached snapshot

import { reviewImage } from "@/lib/openai/vision";
import { cacheKey, getCached, setCached } from "./cache";
import { ANALYZE_SYSTEM, analyzePrompt } from "./prompts";
import {
  DISCLAIMERS,
  evidenceFor,
  type AnalysisContext,
  type Confidence,
  type DetectedItem,
  type ImageObservation,
  type NextStep,
  type SafetyObservation,
  type VisionAnalysis
} from "./types";

// Raw model response shape (what the JSON prompt asks for).
type ModelAnalysis = {
  summary?:            unknown;
  primary_trade?:      unknown;
  stage?:              unknown;
  detected?:           unknown;
  observations?:       unknown;
  defects?:            unknown;
  safety?:             unknown;
  next_steps?:         unknown;
  overall_confidence?: unknown;
};

export type AnalyzeInput = {
  imageUrl: string;
  context?: AnalysisContext;
};

export async function analyzeConstructionImage(input: AnalyzeInput): Promise<VisionAnalysis> {
  const ctx = input.context ?? {};
  const key = cacheKey(input.imageUrl, "analyze", { trade: ctx.trade, hint: ctx.hint });
  const cached = getCached<VisionAnalysis>(key);
  if (cached) return cached;

  const evidence = evidenceFor("OpenAI GPT-4o vision", []);

  const res = await reviewImage<ModelAnalysis>({
    system:   ANALYZE_SYSTEM,
    prompt:   analyzePrompt(ctx),
    image:    { url: input.imageUrl },
    jsonMode: true
  });

  if (!res) {
    return emptyResult(evidence, "no_vision_key");
  }
  if (!res.parsed) {
    return emptyResult(evidence, "model_failed");
  }

  const validated = validate(res.parsed, evidence);
  setCached(key, validated);
  return validated;
}

// ─── Validation + normalisation ────────────────────────────────

function validate(m: ModelAnalysis, evidence: ReturnType<typeof evidenceFor>): VisionAnalysis {
  return {
    summary:            asString(m.summary, "No summary produced."),
    primary_trade:      m.primary_trade == null ? null : asString(m.primary_trade, ""),
    stage:              stageOf(m.stage),
    detected:           asArray(m.detected, detectedItemOf),
    observations:       asArray(m.observations, observationOf).map((o, i) => ({ ...o, key: `obs_${i}` })),
    defects:            asArray(m.defects,      observationOf).map((o, i) => ({ ...o, key: `def_${i}` })),
    safety:             asArray(m.safety,       safetyOf),
    next_steps:         asArray(m.next_steps,   nextStepOf),
    overall_confidence: confidenceOf(m.overall_confidence),
    disclaimer:         DISCLAIMERS.general,
    evidence
  };
}

function emptyResult(evidence: ReturnType<typeof evidenceFor>, err: string): VisionAnalysis {
  return {
    summary:            err === "no_vision_key"
      ? "Vision needs an OpenAI key set on the server — I can't analyse the image right now."
      : "I wasn't able to analyse that image (the vision model didn't return a usable response).",
    primary_trade:      null,
    stage:              "unknown",
    detected:           [],
    observations:       [],
    defects:            [],
    safety:             [],
    next_steps:         [],
    overall_confidence: "low",
    disclaimer:         DISCLAIMERS.general,
    evidence,
    error:              err
  };
}

function asString(v: unknown, fallback: string): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

function asArray<T>(v: unknown, mapper: (item: unknown) => T | null): T[] {
  if (!Array.isArray(v)) return [];
  const out: T[] = [];
  for (const item of v) {
    const m = mapper(item);
    if (m !== null) out.push(m);
  }
  return out;
}

function confidenceOf(v: unknown): Confidence {
  if (v === "high" || v === "medium" || v === "low") return v;
  return "low";
}

function stageOf(v: unknown): VisionAnalysis["stage"] {
  if (v === "before" || v === "in-progress" || v === "after") return v;
  return "unknown";
}

function detectedItemOf(item: unknown): DetectedItem | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  const label = asString(o.label, "");
  if (!label) return null;
  const catRaw = o.category;
  const category: DetectedItem["category"] =
    catRaw === "material" || catRaw === "structure" || catRaw === "tool" ||
    catRaw === "plant"    || catRaw === "vehicle"   || catRaw === "person" ||
    catRaw === "hazard"   || catRaw === "finish"    ? catRaw : "unknown";
  return { label, category, confidence: confidenceOf(o.confidence) };
}

function observationOf(item: unknown): Omit<ImageObservation, "key"> | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  const headline = asString(o.headline, "");
  if (!headline) return null;
  const detail = typeof o.detail === "string" && o.detail.length > 0 ? o.detail : undefined;
  return { headline, detail, confidence: confidenceOf(o.confidence) };
}

function safetyOf(item: unknown): SafetyObservation | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  const hazard = asString(o.hazard, "");
  if (!hazard) return null;
  const sev = o.severity;
  const severity: SafetyObservation["severity"] =
    sev === "high" || sev === "medium" || sev === "low" ? sev : "low";
  return {
    hazard,
    severity,
    recommended_action:      asString(o.recommended_action, "Confirm on site."),
    confidence:              confidenceOf(o.confidence),
    human_verification_note: DISCLAIMERS.safety
  };
}

function nextStepOf(item: unknown): NextStep | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  const action = asString(o.action, "");
  if (!action) return null;
  return { action, reason: asString(o.reason, "") };
}

// Re-export for tests + advanced callers.
export { validate as _validateAnalysis };

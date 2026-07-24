// Measurement estimation. Never invents scale — if no reference is in
// the image, `scaled: false` and all estimates are ratios only.

import { reviewImage } from "@/lib/openai/vision";
import { cacheKey, getCached, setCached } from "./cache";
import { MEASURE_PROMPT, MEASURE_SYSTEM } from "./prompts";
import { DISCLAIMERS, evidenceFor, type Confidence, type MeasurementEstimate } from "./types";

type ModelMeasure = {
  summary?:          unknown;
  scaled?:           unknown;
  scale_reference?:  unknown;
  estimates?:        unknown;
};

export type EstimateMeasurementsInput = {
  imageUrl: string;
  hint?:    string;
};

export async function estimateMeasurements(input: EstimateMeasurementsInput): Promise<MeasurementEstimate> {
  const key = cacheKey(input.imageUrl, "measure", { hint: input.hint });
  const cached = getCached<MeasurementEstimate>(key);
  if (cached) return cached;

  const evidence = evidenceFor("OpenAI GPT-4o vision (measure prompt)", []);

  const res = await reviewImage<ModelMeasure>({
    system:   MEASURE_SYSTEM,
    prompt:   input.hint ? `${MEASURE_PROMPT} User note: ${input.hint}` : MEASURE_PROMPT,
    image:    { url: input.imageUrl },
    jsonMode: true
  });

  if (!res)        return emptyMeasure(evidence, "no_vision_key");
  if (!res.parsed) return emptyMeasure(evidence, "model_failed");

  const m = res.parsed;
  const scaled = m.scaled === true;
  const estimate: MeasurementEstimate = {
    summary:         typeof m.summary === "string" && m.summary ? m.summary : "No measurement summary produced.",
    scaled,
    scale_reference: typeof m.scale_reference === "string" ? m.scale_reference : undefined,
    estimates:       normaliseEstimates(m.estimates, scaled),
    disclaimer:      DISCLAIMERS.measurement,
    evidence
  };
  setCached(key, estimate);
  return estimate;
}

function normaliseEstimates(v: unknown, scaled: boolean): MeasurementEstimate["estimates"] {
  if (!Array.isArray(v)) return [];
  const out: MeasurementEstimate["estimates"] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label : "";
    const value = typeof o.value === "string" ? o.value : "";
    if (!label || !value) continue;
    // If unscaled the model must present ratios, not absolute units.
    // We can't fully validate that, but we downgrade confidence to
    // "low" as an honest signal.
    const confidence: Confidence = scaled
      ? (o.confidence === "high" || o.confidence === "medium" ? o.confidence : "low")
      : "low";
    out.push({ label, value, confidence });
  }
  return out;
}

function emptyMeasure(evidence: ReturnType<typeof evidenceFor>, err: string): MeasurementEstimate {
  return {
    summary:    err === "no_vision_key"
      ? "Vision needs an OpenAI key set on the server — can't estimate measurements right now."
      : "Measurement analysis didn't produce a usable response.",
    scaled:     false,
    estimates:  [],
    disclaimer: DISCLAIMERS.measurement,
    evidence,
    error:      err
  };
}

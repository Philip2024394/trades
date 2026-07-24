// Safety-focused analysis. Every observation returns with the
// human-verification note baked in — safety calls MUST NOT be treated
// as authoritative.

import { reviewImage } from "@/lib/openai/vision";
import { cacheKey, getCached, setCached } from "./cache";
import { SAFETY_PROMPT, SAFETY_SYSTEM } from "./prompts";
import { DISCLAIMERS, evidenceFor, type Confidence, type SafetyObservation, type SafetyReport } from "./types";

type ModelSafety = {
  summary?:      unknown;
  observations?: unknown;
};

export type AnalyzeSafetyInput = {
  imageUrl: string;
  hint?:    string;
};

export async function analyzeSafety(input: AnalyzeSafetyInput): Promise<SafetyReport> {
  const key = cacheKey(input.imageUrl, "safety", { hint: input.hint });
  const cached = getCached<SafetyReport>(key);
  if (cached) return cached;

  const evidence = evidenceFor("OpenAI GPT-4o vision (safety prompt)", []);

  const res = await reviewImage<ModelSafety>({
    system:   SAFETY_SYSTEM,
    prompt:   input.hint ? `${SAFETY_PROMPT} User note: ${input.hint}` : SAFETY_PROMPT,
    image:    { url: input.imageUrl },
    jsonMode: true
  });

  if (!res)        return emptySafety(evidence, "no_vision_key");
  if (!res.parsed) return emptySafety(evidence, "model_failed");

  const m = res.parsed;
  const report: SafetyReport = {
    summary:      typeof m.summary === "string" && m.summary ? m.summary : "No safety summary produced.",
    observations: normaliseSafety(m.observations),
    disclaimer:   DISCLAIMERS.safety,
    evidence
  };
  setCached(key, report);
  return report;
}

function normaliseSafety(v: unknown): SafetyObservation[] {
  if (!Array.isArray(v)) return [];
  const out: SafetyObservation[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const hazard = typeof o.hazard === "string" ? o.hazard : "";
    if (!hazard) continue;
    const sev = o.severity;
    out.push({
      hazard,
      severity:                sev === "high" || sev === "medium" || sev === "low" ? sev : "low",
      recommended_action:      typeof o.recommended_action === "string" ? o.recommended_action : "Confirm on site.",
      confidence:              confidenceOf(o.confidence),
      human_verification_note: DISCLAIMERS.safety
    });
  }
  return out;
}

function confidenceOf(v: unknown): Confidence {
  return v === "high" || v === "medium" || v === "low" ? v : "low";
}

function emptySafety(evidence: ReturnType<typeof evidenceFor>, err: string): SafetyReport {
  return {
    summary:      err === "no_vision_key"
      ? "Vision needs an OpenAI key set on the server — can't run a safety scan right now."
      : "Safety analysis didn't produce a usable response.",
    observations: [],
    disclaimer:   DISCLAIMERS.safety,
    evidence,
    error:        err
  };
}

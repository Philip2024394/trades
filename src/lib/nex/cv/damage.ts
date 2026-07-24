// Damage-focused analysis. Uses a narrower prompt so the model
// concentrates on defects rather than general observations.

import { reviewImage } from "@/lib/openai/vision";
import { cacheKey, getCached, setCached } from "./cache";
import { DAMAGE_PROMPT, DAMAGE_SYSTEM } from "./prompts";
import { DISCLAIMERS, evidenceFor, type Confidence, type DamageReport } from "./types";

type ModelDamage = {
  summary?:            unknown;
  damage?:             unknown;
  recommended_action?: unknown;
};

export type AnalyzeDamageInput = {
  imageUrl: string;
  hint?:    string;
};

export async function analyzeDamage(input: AnalyzeDamageInput): Promise<DamageReport> {
  const key = cacheKey(input.imageUrl, "damage", { hint: input.hint });
  const cached = getCached<DamageReport>(key);
  if (cached) return cached;

  const evidence = evidenceFor("OpenAI GPT-4o vision (damage prompt)", []);

  const res = await reviewImage<ModelDamage>({
    system:   DAMAGE_SYSTEM,
    prompt:   input.hint ? `${DAMAGE_PROMPT} User note: ${input.hint}` : DAMAGE_PROMPT,
    image:    { url: input.imageUrl },
    jsonMode: true
  });

  if (!res)         return emptyDamage(evidence, "no_vision_key");
  if (!res.parsed)  return emptyDamage(evidence, "model_failed");

  const m = res.parsed;
  const report: DamageReport = {
    summary:            typeof m.summary === "string" && m.summary ? m.summary : "No damage summary produced.",
    damage:             normaliseDamage(m.damage),
    recommended_action: typeof m.recommended_action === "string" ? m.recommended_action : "Have a qualified tradesperson inspect on site.",
    disclaimer:         DISCLAIMERS.general,
    evidence
  };
  setCached(key, report);
  return report;
}

function normaliseDamage(v: unknown): DamageReport["damage"] {
  if (!Array.isArray(v)) return [];
  const out: DamageReport["damage"] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label : "";
    if (!label) continue;
    const sev = o.severity;
    out.push({
      label,
      likely_cause: typeof o.likely_cause === "string" ? o.likely_cause : "Cause not identified from the image alone.",
      severity:     sev === "high" || sev === "medium" || sev === "low" ? sev : "low",
      confidence:   confidenceOf(o.confidence)
    });
  }
  return out;
}

function confidenceOf(v: unknown): Confidence {
  return v === "high" || v === "medium" || v === "low" ? v : "low";
}

function emptyDamage(evidence: ReturnType<typeof evidenceFor>, err: string): DamageReport {
  return {
    summary:            err === "no_vision_key"
      ? "Vision needs an OpenAI key set on the server — can't analyse for damage right now."
      : "Damage analysis didn't produce a usable response.",
    damage:             [],
    recommended_action: "Have a qualified tradesperson inspect on site.",
    disclaimer:         DISCLAIMERS.general,
    evidence,
    error:              err
  };
}

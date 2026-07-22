// Design Critic — the quality gate per V3 Q12.
//
// Runs after every generation, before the merchant sees output.
// Scores on 12 axes. Below 92 → regenerate with feedback. Below 85
// → escalate to human review. Above 92 → approve.
//
// Returns null on missing OPENAI_API_KEY so callers can pass through
// unrated (with `approved: false` outcome so the merchant still sees
// something during dev).

import { reasonJson } from "@/lib/openai/reasoning";
import type { CriticInput } from "./prompts/creative-director";
import { CREATIVE_DIRECTOR_SYSTEM, buildCriticPrompt } from "./prompts/creative-director";
import {
  computeOverall,
  REGENERATE_THRESHOLD,
  HUMAN_ESCALATION_THRESHOLD,
  type CriticResult,
  type CriticScores
} from "./rubric";

export const CRITIC_VERSION = "1.0.0";

type RawCriticResponse = {
  scores?:     Partial<CriticScores>;
  strengths?:  string[];
  weaknesses?: string[];
  actions?:    string[];
};

/** Review a generated asset. Returns null when the AI reasoning key
 *  is missing (dev fallback). */
export async function review(input: CriticInput): Promise<CriticResult | null> {
  const raw = await reasonJson<RawCriticResponse>({
    system:      CREATIVE_DIRECTOR_SYSTEM,
    messages:    [{ role: "user", content: buildCriticPrompt(input) }],
    temperature: 0.2,
    maxTokens:   1200
  });

  if (!raw || !raw.scores) return null;

  const scores: CriticScores = {
    brand:        clamp(raw.scores.brand),
    hierarchy:    clamp(raw.scores.hierarchy),
    layout:       clamp(raw.scores.layout),
    spacing:      clamp(raw.scores.spacing),
    typography:   clamp(raw.scores.typography),
    colour:       clamp(raw.scores.colour),
    trade:        clamp(raw.scores.trade),
    premium:      clamp(raw.scores.premium),
    trust:        clamp(raw.scores.trust),
    legibility:   clamp(raw.scores.legibility),
    printability: clamp(raw.scores.printability),
    commercial:   clamp(raw.scores.commercial)
  };

  const overall  = computeOverall(scores);
  const approved = overall >= REGENERATE_THRESHOLD;
  const escalate = overall <  HUMAN_ESCALATION_THRESHOLD;

  return {
    overall,
    scores,
    strengths:     raw.strengths  ?? [],
    weaknesses:    raw.weaknesses ?? [],
    actions:       raw.actions    ?? [],
    approved,
    escalate,
    criticVersion: CRITIC_VERSION
  };
}

function clamp(v: number | undefined): number {
  if (typeof v !== "number" || Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

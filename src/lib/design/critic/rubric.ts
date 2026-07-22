// Design Critic scoring rubric — 12 axes per V3 Q12.
// Weights per the spec. Overall = weighted average.
// Below 92 → auto-regenerate. Below 85 → escalate to human.

export type ScoreAxis =
  | "brand"
  | "hierarchy"
  | "spacing"
  | "typography"
  | "colour"
  | "trust"
  | "premium"
  | "legibility"
  | "printability"
  | "trade"
  | "commercial"
  | "layout";  // vehicle_layout in the spec, renamed for cross-surface use

export const AXIS_WEIGHTS: Record<ScoreAxis, number> = {
  brand:        10,
  hierarchy:    10,
  layout:       10,
  spacing:       8,
  typography:   10,
  colour:        8,
  trade:         8,
  premium:      10,
  trust:         8,
  legibility:   10,
  printability: 10,
  commercial:    8
};

export const REGENERATE_THRESHOLD = 92;
export const HUMAN_ESCALATION_THRESHOLD = 85;

export type CriticScores = Record<ScoreAxis, number>;

export type CriticResult = {
  overall:     number;
  scores:      CriticScores;
  strengths:   string[];
  weaknesses:  string[];
  actions:     string[];
  approved:    boolean;
  escalate:    boolean;
  criticVersion: string;
};

/** Compute the weighted-average overall score. */
export function computeOverall(scores: CriticScores): number {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const axis of Object.keys(AXIS_WEIGHTS) as ScoreAxis[]) {
    const weight = AXIS_WEIGHTS[axis];
    weightedSum  += (scores[axis] ?? 0) * weight;
    totalWeight  += weight;
  }
  return Math.round((weightedSum / totalWeight) * 10) / 10;
}

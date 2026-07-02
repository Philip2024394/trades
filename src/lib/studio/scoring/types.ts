// Design Score types.
//
// Client-safe — no server-only imports. Both the client-side scorer
// and any future server endpoint (that adds AI-augmented dimensions
// through the gateway) return this exact shape.

export type ScoreDimension =
  | "loading"
  | "accessibility"
  | "sales"
  | "seo"
  | "mobile"
  | "brandConsistency";

export const SCORE_DIMENSIONS: ScoreDimension[] = [
  "loading",
  "accessibility",
  "sales",
  "seo",
  "mobile",
  "brandConsistency"
];

export const SCORE_DIMENSION_LABELS: Record<ScoreDimension, string> = {
  loading: "Loading",
  accessibility: "Accessibility",
  sales: "Sales",
  seo: "SEO",
  mobile: "Mobile",
  brandConsistency: "Brand consistency"
};

export type ScoreSeverity = "info" | "warn" | "error";

export type ScoreFinding = {
  dimension: ScoreDimension;
  severity: ScoreSeverity;
  message: string;
  fieldKey?: string;
};

export type SectionScoreResult = {
  instanceId: string;
  sectionId: string;
  sectionName: string;
  dimensions: Record<ScoreDimension, number>;
  overall: number;
  findings: ScoreFinding[];
};

export type PageScoreResult = {
  overall: number;
  dimensions: Record<ScoreDimension, number>;
  sectionScores: SectionScoreResult[];
  pageFindings: ScoreFinding[];
};

// src/lib/nex/idea-lab/types.ts
//
// Stage 10 · Idea Lab · per feedback_nex_idea_lab_pipeline.md:
//   Founder → Research → Evaluation → Score (1-100) → Founder Decision → Build Queue
//
// 11 evaluation dimensions with visible reasoning per dimension.
// Score is ADVICE · founder's SEND TO CODING is the authority.

export type IdeaDimension =
  | "user_value"
  | "strategic_fit"
  | "technical_feasibility"
  | "boundary_safety"
  | "integration_cost"
  | "measurability"
  | "reversibility"
  | "constitutional_alignment"
  | "founder_effort"
  | "differentiation"
  | "urgency";

export interface DimensionScore {
  readonly dimension: IdeaDimension;
  readonly score: number;                     // 0..100
  readonly reasoning: string;                 // visible reasoning · no hidden judgement
  readonly evidence: readonly string[];       // pointers to code/docs/ADRs supporting the score
}

export interface IdeaEvaluation {
  readonly ideaId: string;
  readonly title: string;
  readonly summary: string;
  readonly dimensionScores: readonly DimensionScore[];
  readonly compositeScore: number;            // weighted mean · 0..100
  readonly enhancedConcept: string | null;
  readonly evaluatedAt: string;
  readonly evaluatedBy: string;
}

export type IdeaDecision =
  | { readonly kind: "SEND_TO_CODING"; readonly signedBy: string; readonly at: string; readonly targetCapabilityId: string }
  | { readonly kind: "SAVE_FOR_LATER"; readonly signedBy: string; readonly at: string; readonly note: string | null }
  | { readonly kind: "REJECT"; readonly signedBy: string; readonly at: string; readonly reason: string };

export type IdeaValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: string; readonly reason: string };

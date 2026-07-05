// Strategy Explainer — barrel.

export {
  explainDecision,
  explainStrategy,
  groupDecisionsByBucket
} from "./explain";
export { StrategyExplainerPanel } from "./StrategyExplainerPanel";
export type { StrategyExplainerPanelProps } from "./StrategyExplainerPanel";
export type {
  DecisionExplanation,
  ExplanationBucket,
  ExplanationLine,
  StrategyExplanation
} from "./types";
export { labelForGoal, labelForTrade, PHRASE_RULES } from "./vocabulary";

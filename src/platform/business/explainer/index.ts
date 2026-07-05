// Strategy Explainer — barrel.

export { explainStrategy, groupDecisionsByBucket } from "./explain";
export { StrategyExplainerPanel } from "./StrategyExplainerPanel";
export type { StrategyExplainerPanelProps } from "./StrategyExplainerPanel";
export type {
  ExplanationBucket,
  ExplanationLine,
  StrategyExplanation
} from "./types";
export { labelForGoal, labelForTrade, PHRASE_RULES } from "./vocabulary";

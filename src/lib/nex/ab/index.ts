// Nex Autonomous Business — public barrel.

export type {
  ApprovalQueue,
  AutomationRule,
  AutomationRuleContext,
  AutomationRuleResult,
  AutonomyMode,
  AutonomySettings,
  Evidence,
  NexAgent,
  OvernightRun,
  PreparedAction,
  PreparedActionCategory,
  PreparedActionSeverity
} from "./types";
export { AGENT_DESCRIPTIONS, MODE_LABELS, evidenceFor } from "./types";

export { DEFAULT_MODE, DEFAULT_TRUSTED_CATEGORIES, isAutoApprovable, resolveAutonomy } from "./modes";
export type { ResolveAutonomyInput } from "./modes";

export { evaluateRule, evaluateRules } from "./rules";

export { buildApprovalQueue } from "./queue";
export type { BuildQueueInput } from "./queue";

export { approvalQueueToText, buildOvernightRun, overnightRunToText } from "./overnight";
export type { BuildOvernightInput } from "./overnight";

export { detectAgent, routeToAgent } from "./agents";
export type { RouteAgentInput } from "./agents";

export { answerAB, classifyABQuestion } from "./answer";
export type { ABQuestion, AnswerABInput } from "./answer";

// src/lib/nex-agent/code-engine/index.ts
//
// NEX1 Code Authoring Engine · Sprint 1 · public surface.
//
// NEX1 is the accountable programming agent. Adapters may assist within the
// code-proposal sub-step only. The template-only adapter is the identity
// floor · not a fallback.

export type * from "./types";
export { NEX1_ENGINE_ERRORS } from "./types";
export { Nex1ReasoningRegistry, nex1InvokeAdapter } from "./registry";
export { TemplateOnlyAdapter, TEMPLATE_ONLY_ID } from "./adapters/template-only";
export { AstSemanticAdapter, AST_SEMANTIC_ID } from "./adapters/ast-semantic";
export {
  parseTscOutput,
  extractMissingPropertyFindings,
  composeRepairDirective,
  composeRepairDirectiveTypeAware,
  type TscDiagnostic,
  type MissingPropertyFinding,
  type ComposeRepairResult,
} from "./consequence-reasoner";
export {
  resolveTypeAwareRepairValue,
  type Nex1TypeAwareValueResult,
  type Nex1TypeAwareValueKind,
} from "./capability-c-type-aware-repair";
export {
  discoverRelevantSources,
  type Nex1DiscoveryScope,
  type Nex1DiscoveryResult,
  type Nex1DiscoveredFile,
  type Nex1DiscoveryAmbiguity,
} from "./capability-f-discovery";
export {
  planGoalToDirective,
  type Nex1GoalRecord,
  type Nex1PlanResult,
  type Nex1PlanKind,
  type Nex1DesiredKind,
} from "./capability-h-planning";
export {
  planMultiGoal,
  executeMultiPlan,
  type Nex1MultiGoalRecord,
  type Nex1SubGoalRecord,
  type Nex1MultiPlan,
  type Nex1MultiPlanKind,
  type Nex1MultiPlanStep,
  type Nex1MultiExecutionResult,
  type Nex1MultiExecutionInput,
  type Nex1MultiExecutionVerdict,
} from "./capability-h3-multigoal-planning";
export {
  synthesiseTestForType,
  type Nex1TestGoal,
  type Nex1TestPlan,
  type Nex1TestPlanKind,
  type Nex1TestFieldRecord,
} from "./capability-i-test-synthesis";
export {
  synthesiseNegativeProof,
  type Nex1NegativeProofGoal,
  type Nex1NegativeProofPlan,
  type Nex1NegativeProofPlanKind,
} from "./capability-i2-negative-proof";
export {
  extractRuntimeFailures,
  type Nex1RuntimeFailureFinding,
  type Nex1RuntimeFailureKind,
  type Nex1RuntimeExtractResult,
  type Nex1RuntimeRefusalClass,
} from "./capability-j-runtime-diagnosis";
export {
  diagnoseAndPropose,
  type Nex1FailureDiagnosis,
  type Nex1RepairProposal,
  type Nex1CauseAnalysisKind,
} from "./capability-j2-cause-analysis";
export {
  executeAndVerifyRepair,
  type Nex1J3Verdict,
  type Nex1J3Result,
  type Nex1J3RunSpec,
} from "./capability-j3-verify-repair";
export {
  executeLongRun,
  type Nex1LongRunRecord,
  type Nex1LongRunGoal,
  type Nex1LongRunResult,
  type Nex1LongRunGoalResult,
  type Nex1LongRunVerdict,
  type Nex1LongRunExecutor,
  type Nex1GoalState,
} from "./capability-j4-long-run";
export {
  executeLongRunWithRecovery,
  type Nex1LongRunRecoveryRecord,
  type Nex1LongRunItem,
  type Nex1LongRunAddFieldItem,
  type Nex1LongRunFixFailingTestItem,
  type Nex1LongRunRecoveryResult,
  type Nex1LongRunRecoveryGoalResult,
  type Nex1LongRunRecoveryVerdict,
  type Nex1LongRunRecoveryExecutor,
  type Nex1GoalStateWithRecovery,
} from "./capability-j42-long-run-with-recovery";
export {
  executeMultiHopRecovery,
  type Nex1MultiHopResult,
  type Nex1MultiHopVerdict,
  type Nex1MultiHopHopRecord,
} from "./capability-j23-multi-hop-recovery";
export { buildContext, sha256, containsSecret } from "./context-builder";
export { normaliseDiff, applyWholeFileDiff } from "./diff-normaliser";
export { enforceScope, isProtected, extractTouchedPaths } from "./scope-enforcer";
export { Nex1DecisionTrailBuilder } from "./nex1-decision-trail";
export { recordProvenance, type Nex1AttemptProvenance } from "./provenance-recorder";
export { appendAudit, auditPath, type AuditEntry } from "./audit";
export { computeIndependenceStats, type IndependenceStats } from "./independent-score";
export {
  extractGapDescriptor,
  type Nex1GapDescriptor,
  type Nex1GapKind,
  type AttemptedRepair,
} from "./capability-d-introspection";

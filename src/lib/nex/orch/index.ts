// Nex Orchestrator — public barrel.

export type {
  Agent,
  AgentCategory,
  AgentId,
  AgentInvocationContext,
  AgentPermission,
  AgentResult,
  AgentSpeciality,
  CountryCode,
  Evidence,
  OrchestrationPlan,
  OrchestrationResult,
  PlanStep
} from "./types";
export { evidenceFor } from "./types";

export { AGENTS, _auditFindings, _invoke, agentsByCategory, getAgent } from "./registry";
export { REQUIRED_PERMISSIONS, auditRegistry, canAgentPerform } from "./permissions";
export type { AuditFinding } from "./permissions";

export { planForAsk } from "./planner";
export { runPlan } from "./runner";
export type { RunPlanInput } from "./runner";

export { formatOrchestration, isCompoundAsk, orchestrate } from "./answer";
export type { OrchestrateInput } from "./answer";

// Phase 24 — multi-agent mesh
export { buildSpecialistAgent, SPECIALIST_AGENTS, SPECIALIST_SPECS } from "./catalog";
export {
  detectConflicts,
  rankConfidence,
  resolveConflict,
  rollupConfidence,
  stepDown,
  stepUp
} from "./confidence";
export type { Confidence, Conflict } from "./confidence";
export { composeNexReply, normaliseContribution, stripAgentLabel, stripEmDash } from "./voice";
export { explain } from "./explain";
export type { ExplainInput } from "./explain";
export { answerMesh, asksForExplanation, runMesh } from "./mesh";
export type { AnswerMeshInput, AnswerMeshResult, MeshInput, MeshResult } from "./mesh";

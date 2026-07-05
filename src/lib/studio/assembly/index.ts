// Assembly Rule Runtime — barrel.

export {
  resolveAssemblyPlan,
  applyDecisions,
  resolveWholePlatformPlan
} from "./resolver";
export type {
  AssemblyProposal,
  AssemblySlotConflict,
  ResolvedAssemblyPlan
} from "./types";
export type { ResolverInput } from "./resolver";
export { executeDecision } from "./executor";
export { runExecutorForBrand } from "./executorRunner";
export type {
  ExecutorContext,
  ExecutorOutcome,
  PendingDecisionRow
} from "./executor";
export { getAssemblyCta, loadAssemblyCtasForBrand } from "./ctaResolver";
export type { ResolvedAssemblyCta } from "./ctaResolver";
export { loadAssemblyNavEntriesForBrand } from "./navResolver";
export type { ResolvedAssemblyNavEntry } from "./navResolver";

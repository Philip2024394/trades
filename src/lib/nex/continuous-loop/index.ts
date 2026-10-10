// src/lib/nex/continuous-loop/index.ts
//
// UWI · Wave 7 · Continuous loop + purity contract public API.
// Founder-authorised programme.

export * from "./types";
export {
  TriggerRouter,
  UnhandledTriggerError,
  type TriggerHandler,
} from "./trigger-router";
export { evaluateStoppingRules } from "./stopping-rules";
export {
  runPurityContract,
  assertRuntimePurity,
  RuntimePurityViolationError,
  type PurityScanOptions,
} from "./runtime-purity-contract";

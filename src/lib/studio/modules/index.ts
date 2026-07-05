// Business Modules — barrel loader.
//
// Importing this file registers every Module + runs the DNA validator
// once. Any invariant violation THROWS at import time so bad content
// never ships to a merchant.

import { validateModules } from "./validator";
import { BUSINESS_MODULES } from "./registry";

// Boot validation — throws on first bad module.
validateModules();

export { BUSINESS_MODULES };
export type {
  BusinessModule,
  ModuleCategory,
  ModuleState
} from "./types";
export {
  getModule,
  modulesByState,
  modulesForTrade,
  modulesForDomain,
  modulesForCapability,
  moduleCoverageByDomain
} from "./registry";

// ─── DNA types (S2.A) ────────────────────────────────────────
export type {
  AssemblyAction,
  AssemblyActionKind,
  AssemblyRule,
  AssemblyTrigger,
  BusinessGoal,
  DataLifecycle,
  MobileBehaviour,
  ModuleBehaviour,
  ModuleDna,
  ModuleEvent,
  ModuleIntelligence,
  ModuleIntent,
  ModulePresentation,
  ModuleRuntime,
  OfflineBehaviour,
  SeoImpact
} from "./dnaTypes";
export { validateModules } from "./validator";
export {
  SLOT_REGISTRY,
  getSlot,
  isKnownSlot,
  listSlotsBySurface
} from "./slots";
export type { SlotDefinition } from "./slots";

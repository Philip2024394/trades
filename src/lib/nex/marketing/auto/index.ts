// src/lib/nex/marketing/auto/index.ts
//
// NEX Managed Email Marketing · Stage 5 · AUTO lane public API
// Founder-authorised programme (three-lane operating doctrine · ADR-0003a).

export * from "./types";
export {
  DEFAULT_JURISDICTION_RULES,
  evaluateEligibility,
  type EligibilityInput,
} from "./eligibility";
export {
  createBudget,
  loadBudgetById,
  loadBudgetByName,
  deriveBudgetAttributionKey,
  reserveBudget,
  consumeBudget,
  releaseBudget,
  type OperatingBudget,
  type BudgetStatus,
  type BudgetAttribution,
  type BudgetAttributionState,
  type ReserveBudgetInput,
  type ReserveBudgetOutcome,
} from "./operating-budget";
export {
  loadPolicyById,
  listActivePolicies,
  checkPolicy,
  checkPolicyPure,
  mkPolicyRow,
  type PolicyDecision,
  type PolicyDenialReason,
  type PolicyCheckInput,
} from "./policy";
export {
  createAutoCampaign,
  populateAutoCampaignQueue,
  deriveAutoCampaignKey,
  type AutoCampaignIntent,
  type AutoCampaignOutcome,
} from "./campaign-service";
export {
  matchesAutoMarketingEvent,
  extractAutoCampaignIntent,
  processAutoMarketingTrigger,
  registerAutoMarketingTrigger,
  type AutoMarketingTriggerDeps,
  type AutoMarketingTriggerResult,
} from "./trigger-integration";

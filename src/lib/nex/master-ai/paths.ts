// src/lib/nex/master-ai/paths.ts
//
// NEX Master AI Engineer · persistent file paths
// Philip 2026-09-07 · AUTHORIZE · Master AI construction mission
//
// Same discipline as src/lib/nex/agent-runtime/paths.ts: all state lives
// under data/master-ai/ (a NEW root · never inside a specialist agent's
// data path). Never inside Next.js dev-server cache. NEVER mixes with
// existing programmer-learning / agent-runtime paths.

import path from "node:path";

/** Repo-root anchor. Callers may override via `NEX_MASTER_AI_DATA_ROOT`
 *  for test isolation (matches the pattern proven in Slice A0). */
export function masterAiDataRoot(): string {
  const override = process.env.NEX_MASTER_AI_DATA_ROOT;
  if (override && override.length > 0) return override;
  return path.join(process.cwd(), "data", "master-ai");
}

// M1 · agent registry
export const agentCataloguePath = () => path.join(masterAiDataRoot(), "agent_catalogue.jsonl");

// M2 · capability model
export const capabilityLedgerPath = () => path.join(masterAiDataRoot(), "capability_ledger.jsonl");

// M3 · observation
export const observationsPath = () => path.join(masterAiDataRoot(), "observations.jsonl");

// M4 · knowledge
export const knowledgeLedgerPath = () => path.join(masterAiDataRoot(), "knowledge_ledger.jsonl");

// M5 · research
export const sourceRegistryPath = () => path.join(masterAiDataRoot(), "source_registry.jsonl");
export const researchQueuePath = () => path.join(masterAiDataRoot(), "research_queue.jsonl");
export const researchFindingsPath = () => path.join(masterAiDataRoot(), "research_findings.jsonl");

// M6 · benchmark
export const benchmarkRegistryPath = () => path.join(masterAiDataRoot(), "benchmark_registry.jsonl");
export const benchmarkRunsPath = () => path.join(masterAiDataRoot(), "benchmark_runs.jsonl");

// M7 · teaching
export const capabilityProposalsPath = () => path.join(masterAiDataRoot(), "capability_proposals.jsonl");

// M8 · factory
export const agentSpecificationsPath = () => path.join(masterAiDataRoot(), "agent_specifications.jsonl");

// M9 · Philip intelligence
export const philipIntelClaimsPath = () => path.join(masterAiDataRoot(), "philip_intel_claims.jsonl");

// M10 · offline reservoir
export const offlineCacheDir = () => path.join(masterAiDataRoot(), "offline_cache");
export const offlineModeFlagPath = () => path.join(masterAiDataRoot(), "offline_mode.json");

// M11 · autonomous evolution
export const autonomousInvocationsPath = () => path.join(masterAiDataRoot(), "autonomous_invocations.jsonl");
export const promotionApprovalQueuePath = () => path.join(masterAiDataRoot(), "promotion_approval_queue.jsonl");

// ═══════════════════════════════════════════════════════════════════
// WAVE 2 ledgers
// ═══════════════════════════════════════════════════════════════════

// Observatory (§6)
export const agentHealthReportsPath = () => path.join(masterAiDataRoot(), "agent_health_reports.jsonl");

// Source federation (§7)
export const sourceHealthPath = () => path.join(masterAiDataRoot(), "source_health.jsonl");

// Cost intelligence (§25 §44)
export const quotaPoliciesPath = () => path.join(masterAiDataRoot(), "quota_policies.jsonl");
export const usageEventsPath = () => path.join(masterAiDataRoot(), "usage_events.jsonl");

// Reconciliation (§9)
export const reconciliationsPath = () => path.join(masterAiDataRoot(), "reconciliations.jsonl");

// Failure intelligence (§18)
export const failurePatternsPath = () => path.join(masterAiDataRoot(), "failure_patterns.jsonl");

// Experiment engine (§16)
export const experimentComparisonsPath = () => path.join(masterAiDataRoot(), "experiment_comparisons.jsonl");

// Statistics / Trend (§20)
export const trendReportsPath = () => path.join(masterAiDataRoot(), "trend_reports.jsonl");

// Daily intelligence roll-up (§39)
export const dailyReportsPath = () => path.join(masterAiDataRoot(), "daily_reports.jsonl");

// ═══════════════════════════════════════════════════════════════════
// WAVE 3 ledgers
// ═══════════════════════════════════════════════════════════════════

// Self-criticism (§23)
export const selfCriticismReportsPath = () => path.join(masterAiDataRoot(), "self_criticism.jsonl");

// Research prioritisation (§10)
export const researchPrioritiesPath = () => path.join(masterAiDataRoot(), "research_priorities.jsonl");

// Offline reservoir proof (§18 §19)
export const reservoirDemonstrationsPath = () => path.join(masterAiDataRoot(), "reservoir_demos.jsonl");

// Master AI runtime lifecycle (§5)
export const masterAiLifecyclePath = () => path.join(masterAiDataRoot(), "lifecycle.jsonl");

// ═══════════════════════════════════════════════════════════════════
// WAVE 4 ledgers · NEX Connectivity + Delegation + Learning Cycle
// ═══════════════════════════════════════════════════════════════════

// W4-B · NEX Connectivity Intelligence
export const connectivityFindingsPath      = () => path.join(masterAiDataRoot(), "connectivity_findings.jsonl");
export const connectivityInvestigationsPath = () => path.join(masterAiDataRoot(), "connectivity_investigations.jsonl");

// W4-C · Programmer delegation
export const delegationLedgerPath          = () => path.join(masterAiDataRoot(), "delegation_ledger.jsonl");

// W4-D · Learning cycle reports
export const learningCycleReportsPath      = () => path.join(masterAiDataRoot(), "learning_cycle_reports.jsonl");

// W4-E · Connectivity economics simulations
export const economicsSimulationsPath      = () => path.join(masterAiDataRoot(), "economics_simulations.jsonl");

// Deep-Feasibility · NEX subsidisation architecture assessments
export const architectureAssessmentsPath   = () => path.join(masterAiDataRoot(), "architecture_assessments.jsonl");

// YES-Hunt Mission · candidate architectures + reservoir sweet-spots + verdict history
export const yesHuntArchitecturesPath      = () => path.join(masterAiDataRoot(), "yes_hunt_architectures.jsonl");
export const yesHuntSweetSpotsPath         = () => path.join(masterAiDataRoot(), "yes_hunt_sweetspots.jsonl");
export const yesHuntVerdictsPath           = () => path.join(masterAiDataRoot(), "yes_hunt_verdicts.jsonl");
export const yesHuntSelfCriticismPath      = () => path.join(masterAiDataRoot(), "yes_hunt_selfcriticism.jsonl");

// W4-6 Primary-Evidence Mission
export const w4_6_activityMatrixPath       = () => path.join(masterAiDataRoot(), "w4_6_activity_matrix.jsonl");
export const w4_6_usageStressPath          = () => path.join(masterAiDataRoot(), "w4_6_usage_stress.jsonl");
export const w4_6_attackSurvivalPath       = () => path.join(masterAiDataRoot(), "w4_6_attack_survival.jsonl");
export const w4_6_primaryFetchLogPath      = () => path.join(masterAiDataRoot(), "w4_6_primary_fetch_log.jsonl");

// Wholesale/Satellite Provider Comparison Mission
export const providerComparisonsPath       = () => path.join(masterAiDataRoot(), "provider_comparisons.jsonl");
export const providerCostAssumptionsPath   = () => path.join(masterAiDataRoot(), "provider_cost_assumptions.jsonl");

// Bandwidth Market Mission
export const bandwidthPricesPath           = () => path.join(masterAiDataRoot(), "bandwidth_prices.jsonl");
export const bandwidthComputationsPath     = () => path.join(masterAiDataRoot(), "bandwidth_computations.jsonl");

// Carrier Selection Mission
export const carrierScoresPath             = () => path.join(masterAiDataRoot(), "carrier_scores.jsonl");
export const carrierRankingsPath           = () => path.join(masterAiDataRoot(), "carrier_rankings.jsonl");

// F-Wave finalization ledgers
export const multilingualTranslationsPath  = () => path.join(masterAiDataRoot(), "multilingual_translations.jsonl");
export const decisionsPath                 = () => path.join(masterAiDataRoot(), "decisions.jsonl");
export const failureTrajectoriesPath       = () => path.join(masterAiDataRoot(), "failure_trajectories.jsonl");
export const agentCapabilityProfilesPath   = () => path.join(masterAiDataRoot(), "agent_capability_profiles.jsonl");
export const storageRotationsPath          = () => path.join(masterAiDataRoot(), "storage_rotations.jsonl");
export const integratedLoopTicksPath       = () => path.join(masterAiDataRoot(), "integrated_loop_ticks.jsonl");

// World-Class capability ledgers
export const storageProvidersPath          = () => path.join(masterAiDataRoot(), "storage_providers.jsonl");
export const storageUtilizationPath        = () => path.join(masterAiDataRoot(), "storage_utilization.jsonl");
export const storageForecastsPath          = () => path.join(masterAiDataRoot(), "storage_forecasts.jsonl");
export const storagePlacementsPath         = () => path.join(masterAiDataRoot(), "storage_placements.jsonl");
export const localKnowledgeProfilesPath    = () => path.join(masterAiDataRoot(), "local_knowledge_profiles.jsonl");
export const crossAgentFlowsPath           = () => path.join(masterAiDataRoot(), "cross_agent_flows.jsonl");

// World-First capability ledgers
export const taskComplexityClassificationsPath = () => path.join(masterAiDataRoot(), "task_complexity_classifications.jsonl");
export const ecosystemErrorsPath           = () => path.join(masterAiDataRoot(), "ecosystem_errors.jsonl");
export const autoRepairProposalsPath       = () => path.join(masterAiDataRoot(), "auto_repair_proposals.jsonl");
export const selfImprovementCandidatesPath = () => path.join(masterAiDataRoot(), "self_improvement_candidates.jsonl");
export const offlineResilienceStatesPath   = () => path.join(masterAiDataRoot(), "offline_resilience_states.jsonl");

// src/lib/nex/capability-runtime/index.ts
//
// NEX Capability Runtime · barrel export
// Stage 2 · Additive · Founder-authorised 2026-09-23.

export type {
  CapabilityName,
  CapabilityDefinition,
  CapabilityProvider,
  CapabilityConsumer,
  CapabilityRegistry,
} from "./contract";

export {
  KNOWN_CAPABILITIES,
  _CAPABILITY_RUNTIME_WRAPS_AOF_NEVER_DUPLICATES,
  _CAPABILITY_RUNTIME_PROXIES_REQUIRE_CAPABILITY,
  _CAPABILITY_RUNTIME_IS_ADDITIVE_ONLY,
} from "./contract";

// Stage 3 · Domains + Consumers (metadata read views)
export type { CapabilityDomain } from "./domain";
export {
  DOMAIN_ASSIGNMENTS,
  KNOWN_DOMAINS,
  capabilitiesInDomain,
  _DOMAIN_TAXONOMY_IS_METADATA_ONLY,
  _EVERY_CAPABILITY_HAS_EXACTLY_ONE_DOMAIN,
} from "./domain";

export type { AgentRoleConsumerSpec } from "./consumers";
export {
  AGENT_CONSUMERS,
  getAgentConsumer,
  consumersOfCapability,
  _AGENT_CONSUMERS_ARE_DECLARATIVE_ONLY,
  _RUNTIME_ENFORCEMENT_STAYS_IN_AOF_CAPABILITY_TS,
} from "./consumers";

export { NexCapabilityRegistry } from "./registry";
export type { NexCapabilityRegistryInput } from "./registry";

// Stage 4 · Event architecture (typed envelope + durability contract)
export type {
  EventDomain,
  EventDurability,
  EventEnvelope,
  DurableEventEnvelope,
  LiveEventEnvelope,
  EventEnvelopeBase,
  ValidationResult,
} from "./event-contract";
export {
  KNOWN_EVENT_DOMAINS,
  fromAofAgentEvent,
  aofEventKindToDomain,
  validateEventEnvelope,
  _EVENT_DURABILITY_IS_A_HARD_INVARIANT,
  _EVENT_CONTRACT_IS_READ_ONLY,
  _EVENT_CONTRACT_DOES_NOT_STORE_ANYTHING,
  _EVENT_CONTRACT_NEVER_MODIFIES_PROTECTED_AOF,
} from "./event-contract";

// Stage 13 · Goal / Workflow / Schedule contracts (declarative · orbiting-agent stays authoritative)
export type {
  Goal,
  Workflow,
  WorkflowStep,
  Schedule,
  ScheduleCadence,
  OrchestrationValidationResult,
} from "./orchestration";
export {
  SCAFFOLDING_HARVEST_GOAL,
  SCAFFOLDING_HARVEST_WORKFLOW,
  SCAFFOLDING_HARVEST_SCHEDULE,
  validateGoal,
  validateWorkflow,
  validateSchedule,
  _ORCHESTRATION_TYPES_ARE_DECLARATIVE_ONLY,
  _ORCHESTRATION_NEVER_DISPATCHES_OR_EXECUTES,
  _ORCHESTRATION_STEPS_REFERENCE_KNOWN_CAPABILITIES_ONLY,
} from "./orchestration";

// Stage 12 · Discovery lane separation (read-only lane catalogue)
export type { DiscoveryLane, LaneModule } from "./discovery-lanes";
export {
  KNOWN_DISCOVERY_LANES,
  HONESTLY_ABSENT_LANES,
  LANE_MODULES,
  modulesInLane,
  lanesForModule,
  abstractionsInLane,
  concreteImplementationsInLane,
  _DISCOVERY_LANES_ARE_METADATA_ONLY,
  _DISCOVERY_LANES_CITE_REAL_MODULES_ONLY,
  _DISCOVERY_LANES_HONESTLY_OMIT_MISSING_LANES,
} from "./discovery-lanes";

// Stage 11 · Governed capability-proposal contract (inert · describes only · never operational)
export type {
  ProposalStatus,
  ProposalAuthor,
  BuildLaneEvidence,
  ProposedDefinition,
  CapabilityProposal,
  AuditVerdictKind,
  AuditVerdict,
} from "./capability-proposal";
export {
  PROTECTED_PATH_PREFIXES,
  EXISTING_IMPLEMENTING_MODULES,
  auditProposal,
  isPromotable,
  blockingVerdicts,
  acknowledgeProposedNameIsNotYetACapability,
  _CAPABILITY_PROPOSAL_IS_INERT_DESCRIPTION_ONLY,
  _CAPABILITY_PROPOSAL_NEVER_REGISTERS_ANYTHING,
  _CAPABILITY_PROPOSAL_NEVER_GRANTS_ANYTHING,
  _CAPABILITY_PROPOSAL_NEVER_PROMOTES_ANYTHING,
} from "./capability-proposal";

// Stage 10 · Agent profile composition (view over Stage 2/3/7/9 seams · no new state)
export type {
  AgentProfile,
  CapabilityCoverage,
  BuildAgentProfileInput,
} from "./agent-profile";
export {
  buildAgentProfile,
  _AGENT_PROFILE_IS_A_COMPOSITION_NOT_A_REGISTRY,
  _AGENT_PROFILE_INTRODUCES_NO_NEW_SOURCE_OF_TRUTH,
  _AGENT_PROFILE_IS_PURE_NO_READS_NO_WRITES,
} from "./agent-profile";

// Stage 9 · Execution policy metadata + enforcement gate catalogue (no enforcement)
export type {
  ExecutionLevel,
  ExecutionLevelDescription,
  Reversibility,
  EnforcementKind,
  EnforcementGate,
} from "./execution-level";
export {
  KNOWN_EXECUTION_LEVELS,
  EXECUTION_LEVEL_DESCRIPTIONS,
  ENFORCEMENT_GATES,
  describe as describeExecutionLevel,
  ordinalOf,
  isAtLeast,
  gateById,
  gatesForLevel,
  gatesByKind,
  gatesForCapability,
  _EXECUTION_LEVEL_IS_METADATA_ONLY,
  _EXECUTION_LEVEL_CATALOGUE_CITES_REAL_FILES,
  _EXECUTION_LEVEL_NEVER_DUPLICATES_ENFORCEMENT,
} from "./execution-level";

// Stage 8 · JobHandle · typed accessor bundle over HarvestJob + related durable refs
export type { JobHandle } from "./job-handle";
export {
  jobHandleFromHarvestJob,
  _JOB_HANDLE_IS_A_HANDLE_NOT_A_QUEUE,
  _JOB_HANDLE_PROVENANCE_POINTERS_ONLY,
  _JOB_HANDLE_YIELD_LINK_IS_DB_PROVEN,
  _JOB_HANDLE_WORKER_LINK_IS_LOOSE,
} from "./job-handle";

// Stage 7 · Agent + task lifecycle contracts (read-only views over AofAgent + HarvestJob)
export type { AgentLifecycleStatus, AgentLifecycleSnapshot } from "./agent-lifecycle";
export {
  KNOWN_LIFECYCLE_STATUSES,
  ALLOWED_TRANSITIONS,
  canTransition,
  fromAofAgent,
  _AGENT_LIFECYCLE_IS_READ_ONLY,
  _AGENT_LIFECYCLE_TRANSITIONS_MIRROR_AOF,
  _AGENT_LIFECYCLE_DOES_NOT_INVENT_STATE,
} from "./agent-lifecycle";

export type { AgentLinkKind, AgentTopologyEvidence, AgentTopologyLink } from "./agent-topology";
export {
  AGENT_TOPOLOGY,
  childrenOf,
  parentsOf,
  linksBetween,
  hasRelationship,
  _AGENT_TOPOLOGY_IS_CODE_DERIVED_NOT_DB_PROVEN,
  _AGENT_TOPOLOGY_LINKS_MUST_CARRY_EVIDENCE,
  _AGENT_TOPOLOGY_IS_DECLARATIVE_ONLY,
} from "./agent-topology";

export type { TaskLifecycleStatus, TaskLifecycleSnapshot, TaskRecoveryView } from "./task-lifecycle";
export {
  KNOWN_TASK_STATUSES,
  TERMINAL_TASK_STATUSES,
  isTerminalStatus,
  fromHarvestJob,
  toRecoveryView,
  _TASK_LIFECYCLE_IS_READ_ONLY,
  _TASK_LIFECYCLE_DOES_NOT_INVENT_STATE,
  _TASK_PARENT_CHILD_IS_DB_AUTHORITATIVE,
} from "./task-lifecycle";

// Stage 6 · Runtime projection engine
export type {
  ProjectionEngine,
  ProjectionResult,
  ProjectionFreshness,
} from "./projection-engine";
export {
  okResult,
  staleResult,
  unavailableResult,
  errorResult,
  validateProjectionInvariant,
  _PROJECTION_IS_READ_ONLY,
  _PROJECTION_IS_NOT_A_SECOND_SOURCE_OF_TRUTH,
  _PROJECTION_NEVER_SILENT_ZERO_ON_ERROR,
  _PROJECTION_COMPUTE_NEVER_THROWS,
} from "./projection-engine";

// Stage 6 · First concrete projection · wraps scaffolding-programme-status
export {
  ScaffoldingProgrammeProjection,
  SCAFFOLDING_PROGRAMME_PROJECTION_NAME,
  SCAFFOLDING_PROGRAMME_PROJECTION_VERSION,
  _SCAFFOLDING_PROJECTION_READS_ONLY_NEVER_WRITES,
  _SCAFFOLDING_PROJECTION_NEVER_FABRICATES_ON_ERROR,
} from "./projections/scaffolding-programme-projection";
export type {
  ScaffoldingProgrammeLoader,
  ScaffoldingProgrammeProjectionInput,
} from "./projections/scaffolding-programme-projection";

// Stage 5 · Model-visible = Logged (LoggedFact wrapper + validation)
export type { LoggedFact, DurableProvenanceRef } from "./logged-fact";
export {
  validateLoggedFact,
  validateProvenanceRef,
  loggedFactFromRows,
  loggedFactFromQuery,
  _MODEL_VISIBLE_IS_LOGGED,
  _LOGGED_FACT_PROVENANCE_IS_REQUIRED,
  _LOGGED_FACT_NEVER_INTRODUCES_NEW_STORE,
  _LIVE_SIGNAL_IS_NOT_A_LOGGED_FACT,
} from "./logged-fact";

// Re-export the authoritative denial class for callers that catch it.
export { CapabilityDenied } from "../aof/capability";

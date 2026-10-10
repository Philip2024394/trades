// src/lib/nex/capability-runtime/execution-level.ts
//
// NEX Execution Policy Contract · Stage 9 · Typed vocabulary + gate catalogue
// Founder-authorised build-lane addition · 2026-09-23.
//
// This module DOES NOT enforce anything. Every enforcement mechanism cited
// here already exists in NEX and remains authoritative. Stage 9 adds a
// shared vocabulary + a catalogue mapping each existing gate to its
// execution level — so HQ, agents, and future consumers can talk about
// authority without inventing labels.
//
// HARD RULES:
//   _EXECUTION_LEVEL_IS_METADATA_ONLY — no enforce/apply/override helpers
//   _EXECUTION_LEVEL_CATALOGUE_CITES_REAL_FILES — every gate's
//     implementing_module is a real path on disk (verified by test)
//   _EXECUTION_LEVEL_NEVER_DUPLICATES_ENFORCEMENT — this module has no
//     capability check · no signing check · no allowlist read

import type { CapabilityName } from "./contract";

// ═══════════════════════════════════════════════════════════════════════
// EXECUTION LEVELS
// ═══════════════════════════════════════════════════════════════════════

/**
 * The six execution authority levels used across NEX doctrine.
 *
 * Ordering is deliberate: higher-numbered levels have broader effect and
 * are progressively harder to reverse. `E5_DESTRUCTIVE_IRREVERSIBLE` is
 * the terminal band — anything that cannot be rolled back locally.
 */
export type ExecutionLevel =
  | "E0_OBSERVE"
  | "E1_ISOLATED_BUILD"
  | "E2_TESTED_MUTATION"
  | "E3_PROTECTED_PROMOTION"
  | "E4_PRODUCTION_OPERATION"
  | "E5_DESTRUCTIVE_IRREVERSIBLE";

export const KNOWN_EXECUTION_LEVELS: readonly ExecutionLevel[] = [
  "E0_OBSERVE",
  "E1_ISOLATED_BUILD",
  "E2_TESTED_MUTATION",
  "E3_PROTECTED_PROMOTION",
  "E4_PRODUCTION_OPERATION",
  "E5_DESTRUCTIVE_IRREVERSIBLE",
] as const;

export type Reversibility = "reversible" | "reversible_with_procedure" | "irreversible";

export interface ExecutionLevelDescription {
  readonly level: ExecutionLevel;
  readonly ordinal: number;             // 0..5
  readonly short_name: string;
  readonly description: string;
  readonly reversibility: Reversibility;
  readonly requires_founder_authority: boolean;
}

export const EXECUTION_LEVEL_DESCRIPTIONS: readonly ExecutionLevelDescription[] = [
  {
    level: "E0_OBSERVE",
    ordinal: 0,
    short_name: "Observe",
    description:
      "Read-only queries against authoritative NEX stores · no state mutation · no external side effects",
    reversibility: "reversible",
    requires_founder_authority: false,
  },
  {
    level: "E1_ISOLATED_BUILD",
    ordinal: 1,
    short_name: "Isolated Build",
    description:
      "Modifications inside the build lane · not yet promoted to protected/main · no production effect",
    reversibility: "reversible",
    requires_founder_authority: false,
  },
  {
    level: "E2_TESTED_MUTATION",
    ordinal: 2,
    short_name: "Tested Mutation",
    description:
      "Build-lane changes with green tests · typecheck · regression · ready for promotion review",
    reversibility: "reversible",
    requires_founder_authority: false,
  },
  {
    level: "E3_PROTECTED_PROMOTION",
    ordinal: 3,
    short_name: "Protected Promotion",
    description:
      "Founder-signed promotion of build-lane work into the protected/main lane · reversible via rollback procedure",
    reversibility: "reversible_with_procedure",
    requires_founder_authority: true,
  },
  {
    level: "E4_PRODUCTION_OPERATION",
    ordinal: 4,
    short_name: "Production Operation",
    description:
      "Running production paths against the real world under Founder-authorised gates · reversible per activation flag",
    reversibility: "reversible_with_procedure",
    requires_founder_authority: true,
  },
  {
    level: "E5_DESTRUCTIVE_IRREVERSIBLE",
    ordinal: 5,
    short_name: "Destructive / Irreversible",
    description:
      "Data deletion · credential rotation · publication to external systems · force-push · not locally recoverable",
    reversibility: "irreversible",
    requires_founder_authority: true,
  },
];

const DESCRIPTIONS_BY_LEVEL = new Map<ExecutionLevel, ExecutionLevelDescription>(
  EXECUTION_LEVEL_DESCRIPTIONS.map((d) => [d.level, d] as const),
);

export function describe(level: ExecutionLevel): ExecutionLevelDescription {
  const d = DESCRIPTIONS_BY_LEVEL.get(level);
  if (!d) throw new Error(`unknown_execution_level:${level}`);
  return d;
}

export function ordinalOf(level: ExecutionLevel): number {
  return describe(level).ordinal;
}

export function isAtLeast(level: ExecutionLevel, threshold: ExecutionLevel): boolean {
  return ordinalOf(level) >= ordinalOf(threshold);
}

// ═══════════════════════════════════════════════════════════════════════
// ENFORCEMENT GATE CATALOGUE
// ═══════════════════════════════════════════════════════════════════════

/**
 * Bounded taxonomy of enforcement kinds NEX currently uses.
 * Adding a new kind requires a corresponding real gate.
 */
export type EnforcementKind =
  | "capability_grant"
  | "founder_signing"
  | "activation_env"
  | "founder_signed_allowlist"
  | "ip_classification"
  | "publication_gate"
  | "doctrine_lock"
  | "rate_policy"
  | "cooldown_policy"
  | "failover_policy"
  | "scheduler_policy";

/**
 * A declared enforcement gate. Every entry MUST reference a real file
 * path on disk (asserted by test). The declaration itself does NOT
 * enforce · the cited module already does.
 */
export interface EnforcementGate {
  readonly gate_id: string;
  readonly display_name: string;
  readonly implementing_module: string;
  readonly execution_level: ExecutionLevel;
  readonly enforcement_kind: EnforcementKind;
  readonly capability_names?: readonly CapabilityName[];
  readonly note: string;
}

export const ENFORCEMENT_GATES: readonly EnforcementGate[] = [
  {
    gate_id: "aof_capability_grant",
    display_name: "AOF capability grant enforcement",
    implementing_module: "src/lib/nex/aof/capability.ts",
    execution_level: "E4_PRODUCTION_OPERATION",
    enforcement_kind: "capability_grant",
    note:
      "requireCapability(client, agent_id, capability) throws CapabilityDenied when the grant is absent · the sole authoritative capability check for AOF agents",
  },
  {
    gate_id: "aof_founder_signing",
    display_name: "AOF agent Founder-signing gate",
    implementing_module: "src/lib/nex/aof/agent-registry.ts",
    execution_level: "E3_PROTECTED_PROMOTION",
    enforcement_kind: "founder_signing",
    note:
      "setAgentStatus() blocks registered→active transitions unless founder_signed = true and founder_signed_at is present",
  },
  {
    gate_id: "page_fetcher_activation",
    display_name: "NEX_PAGE_FETCHER_ACTIVATION env gate",
    implementing_module: "src/lib/nex/harvest/production-boot.ts",
    execution_level: "E4_PRODUCTION_OPERATION",
    enforcement_kind: "activation_env",
    note:
      "resolveProductionHarvestAdapters returns null_defaults unless env === \"on\" · strict equality · wrong case rejected",
  },
  {
    gate_id: "discovery_cron_activation",
    display_name: "NEX_DISCOVERY_CRON_ACTIVATION env gate",
    implementing_module: "src/app/api/cron/nex-harvest-tick/route.ts",
    execution_level: "E4_PRODUCTION_OPERATION",
    enforcement_kind: "activation_env",
    note:
      "cron endpoint remains dormant unless the activation env is explicitly on · Founder-controlled",
  },
  {
    gate_id: "founder_signed_allowlist",
    display_name: "Founder-signed page-fetcher allowlist",
    implementing_module: "data/nex-page-fetcher-allowlist.json",
    execution_level: "E4_PRODUCTION_OPERATION",
    enforcement_kind: "founder_signed_allowlist",
    note:
      "production-boot verifies signed_by === \"founder\" · signed_at present · non-empty allowed_hosts · per-host max_bytes + min_interval_ms",
  },
  {
    gate_id: "ip_classification_registry",
    display_name: "NEX IP classification registry",
    implementing_module: "src/lib/nex-security/nex-ip-registry.ts",
    execution_level: "E3_PROTECTED_PROMOTION",
    enforcement_kind: "ip_classification",
    note:
      "classifies files as IP_CORE · IP_SUPPORT · IP_DATA · SECURITY_SECRET · PUBLIC_CANDIDATE · NON_IP · UNKNOWN · governs what may leave the local repository",
  },
  {
    gate_id: "publication_gate",
    display_name: "NEX publication preflight gate",
    implementing_module: "src/lib/nex-security/nex-publication-gate.ts",
    execution_level: "E5_DESTRUCTIVE_IRREVERSIBLE",
    enforcement_kind: "publication_gate",
    note:
      "Founder-authorised preflight for any external publication · pushing IP_CORE without approval is irreversible once external mirrors read",
  },
  {
    gate_id: "security_agent_doctrine_locks",
    display_name: "Security agent doctrine enforcement",
    implementing_module: "src/lib/nex/security-agent/security-agent.ts",
    execution_level: "E3_PROTECTED_PROMOTION",
    enforcement_kind: "doctrine_lock",
    note:
      "inspects code mutations against ADR-locked doctrines · refuses changes that violate immutable rules",
  },
  {
    gate_id: "rate_governor",
    display_name: "AOF rate governor (concurrency + min-interval + backoff)",
    implementing_module: "src/lib/nex/aof/governors/rate-governor.ts",
    execution_level: "E4_PRODUCTION_OPERATION",
    enforcement_kind: "rate_policy",
    capability_names: ["manage_cooldown"],
    note:
      "decideCanProceed enforces per-host concurrency + politeness min-interval · never bypasses cooldown · SLOW→COOLDOWN→RETRY→FAILOVER→RECORD, never BYPASS→EVADE→ROTATE→FORCE",
  },
  {
    gate_id: "source_cooldown",
    display_name: "AOF source cooldown enforcement",
    implementing_module: "src/lib/nex/aof/governors/source-cooldown.ts",
    execution_level: "E4_PRODUCTION_OPERATION",
    enforcement_kind: "cooldown_policy",
    capability_names: ["manage_cooldown"],
    note:
      "applyCooldown escalates on repeated failure · expiry alone lifts · never overridden by code path",
  },
  {
    gate_id: "failover_governor",
    display_name: "AOF failover selection (never bypasses cooldown)",
    implementing_module: "src/lib/nex/aof/governors/failover.ts",
    execution_level: "E4_PRODUCTION_OPERATION",
    enforcement_kind: "failover_policy",
    capability_names: ["failover_source"],
    note:
      "selectNextSource prioritises signed + enabled sources · refuses to return cooled-down or unsigned candidates",
  },
  {
    gate_id: "asia_last_scheduler",
    display_name: "Country scheduler Asia-last hard-lock",
    implementing_module: "src/lib/nex/harvest/country-scheduler.ts",
    execution_level: "E4_PRODUCTION_OPERATION",
    enforcement_kind: "scheduler_policy",
    capability_names: ["schedule_country"],
    note:
      "hard-lock refuses any Asia country while non_asia_remaining > 0 · sourced from world_country.region",
  },
];

const GATES_BY_ID = new Map<string, EnforcementGate>(
  ENFORCEMENT_GATES.map((g) => [g.gate_id, g] as const),
);

// ═══════════════════════════════════════════════════════════════════════
// LOOKUPS (read-only helpers)
// ═══════════════════════════════════════════════════════════════════════

export function gateById(gate_id: string): EnforcementGate | null {
  return GATES_BY_ID.get(gate_id) ?? null;
}

export function gatesForLevel(level: ExecutionLevel): readonly EnforcementGate[] {
  return ENFORCEMENT_GATES.filter((g) => g.execution_level === level);
}

export function gatesByKind(kind: EnforcementKind): readonly EnforcementGate[] {
  return ENFORCEMENT_GATES.filter((g) => g.enforcement_kind === kind);
}

/**
 * For a given capability, list the enforcement gates that cite it.
 * (Some gates operate at rate/cooldown level and reference the capability
 *  they gate · not every gate names a capability.)
 */
export function gatesForCapability(cap: CapabilityName): readonly EnforcementGate[] {
  return ENFORCEMENT_GATES.filter((g) => (g.capability_names ?? []).includes(cap));
}

// ═══════════════════════════════════════════════════════════════════════
// DOCTRINE LOCKS (Stage 9)
// ═══════════════════════════════════════════════════════════════════════

export const _EXECUTION_LEVEL_IS_METADATA_ONLY =
  "stage_9_adds_a_shared_vocabulary_no_enforce_no_apply_no_override_helpers_exported";

export const _EXECUTION_LEVEL_CATALOGUE_CITES_REAL_FILES =
  "every_EnforcementGate_implementing_module_is_verified_to_exist_on_disk";

export const _EXECUTION_LEVEL_NEVER_DUPLICATES_ENFORCEMENT =
  "this_module_never_reads_or_writes_authoritative_gates_the_cited_modules_remain_the_only_enforcers";

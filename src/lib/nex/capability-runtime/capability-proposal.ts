// src/lib/nex/capability-runtime/capability-proposal.ts
//
// NEX Governed Runtime Extension · Stage 11 · Capability proposal contract
// Founder-authorised build-lane addition · 2026-09-23.
//
// This module describes the SHAPE of a proposed new capability and the
// verdicts an audit produces. It DOES NOTHING beyond producing those
// verdicts. Specifically:
//
//   · It does NOT register a capability with any registry
//   · It does NOT grant a capability to any agent
//   · It does NOT activate anything
//   · It does NOT promote a proposal into the protected lane
//   · It does NOT execute proposed code
//
// A proposal existing does not make a capability operational. The
// existing NEX chain — `nex1-builder` → build lane → tests → security-
// agent → world-activation-pack promotion — remains the only path to
// operational authority. Stage 11 gives that chain a shared typed
// vocabulary for describing proposals + refusal reasons.
//
// HARD RULES:
//   _CAPABILITY_PROPOSAL_IS_INERT_DESCRIPTION_ONLY
//   _CAPABILITY_PROPOSAL_NEVER_REGISTERS_ANYTHING
//   _CAPABILITY_PROPOSAL_NEVER_GRANTS_ANYTHING
//   _CAPABILITY_PROPOSAL_NEVER_PROMOTES_ANYTHING

import { KNOWN_CAPABILITIES, type CapabilityName } from "./contract";
import type { CapabilityDomain } from "./domain";
import type { ExecutionLevel, Reversibility } from "./execution-level";

// ═══════════════════════════════════════════════════════════════════════
// PROPOSAL SHAPE
// ═══════════════════════════════════════════════════════════════════════

/**
 * Where the proposal is in its lifecycle. These are pure labels — no
 * function in this module transitions a proposal between them. NEX1 /
 * Founder / human reviewers control transitions elsewhere.
 */
export type ProposalStatus =
  | "drafted"     // authored, not yet audited
  | "audited"     // audits produced (may be positive or negative)
  | "candidate"   // audits green, awaits governance gate (Founder decision)
  | "rejected"    // any verdict said no
  | "withdrawn";  // author or Founder rescinded

export type ProposalAuthor = "nex1" | "founder" | "human_reviewer";

/**
 * The evidence NEX1 (or a human reviewer) reports about the proposal's
 * build-lane state. `unknown` is a legitimate value — better to admit not
 * having tests yet than to pretend.
 */
export interface BuildLaneEvidence {
  readonly test_files: readonly string[];
  readonly typecheck_status: "unknown" | "passing" | "failing";
  readonly regression_status: "unknown" | "green" | "regressions_present";
  readonly stage_attributable_regressions: number;
}

/**
 * The proposed capability's definition · mirrors Stage 2
 * `CapabilityDefinition` fields with the crucial difference that the
 * NAME is a string, not a `CapabilityName` — the name is unknown to the
 * type system until the capability is admitted.
 */
export interface ProposedDefinition {
  readonly proposed_name: string;
  readonly description: string;
  readonly implementing_module: string;
  readonly scope_keys: readonly string[];
  readonly example_grant_scope: Record<string, unknown>;
  readonly domain: CapabilityDomain;
}

export interface CapabilityProposal {
  readonly proposal_id: string;
  readonly proposed_by: ProposalAuthor;
  readonly authored_at: string;
  readonly rationale: string;
  readonly proposed_definition: ProposedDefinition;
  readonly required_execution_level: ExecutionLevel;
  readonly reversibility: Reversibility;
  readonly build_lane_evidence: BuildLaneEvidence;
  readonly status: ProposalStatus;
}

// ═══════════════════════════════════════════════════════════════════════
// AUDIT VERDICTS
// ═══════════════════════════════════════════════════════════════════════

export type AuditVerdictKind =
  | "acceptable"
  | "duplicates_existing_capability_name"
  | "duplicates_existing_implementing_module"
  | "protected_path_modification"
  | "insufficient_evidence"
  | "failing_tests_or_typecheck"
  | "unbounded_execution_level_without_founder"
  | "malformed_proposal";

export interface AuditVerdict {
  readonly proposal_id: string;
  readonly verdict: AuditVerdictKind;
  readonly reason: string;
  readonly recorded_at: string;
}

// ═══════════════════════════════════════════════════════════════════════
// PROTECTED PATHS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Paths under which a proposed `implementing_module` is considered a
 * protected-path modification. The list is deliberately concrete:
 * every entry names a proven zone whose behaviour must not change via
 * runtime extension.
 */
export const PROTECTED_PATH_PREFIXES: readonly string[] = [
  "src/lib/nex/aof/",
  "src/lib/nex/harvest/",
  "src/lib/nex/discovery-world/",
  "scripts/nex-verified-discovery-engine",
  "scripts/nex-worldwide-discovery-engine",
  "db/migrations/",
  "data/nex-page-fetcher-allowlist.json",
];

/**
 * Known implementing_module paths currently owned by KNOWN_CAPABILITIES.
 * Sourced from Stage 2 definitions manually — the audit does not import
 * the registry to avoid coupling. Kept in lockstep with definitions in
 * `registry.ts`.
 */
export const EXISTING_IMPLEMENTING_MODULES: readonly string[] = [
  "src/lib/nex/harvest/source-probe-executor.ts",
  "src/lib/nex/harvest/website-walk-executor.ts",
  "src/lib/nex/discovery-world/business-evidence.ts",
  "src/lib/nex/aof/governors/source-cooldown.ts",
  "src/lib/nex/harvest/country-scheduler.ts",
  "src/lib/nex/aof/governors/failover.ts",
  "src/lib/nex/harvest/reaper.ts",
  "src/lib/nex/aof/lifecycle.ts",
  "src/lib/nex/aof/agents/live-streaming-agent.ts",
  "src/lib/nex/aof/adapters/registry.ts",
  "src/lib/nex/aof/agents/evidence-audit-agent.ts",
  "src/lib/nex/aof/agents/orbiting-agent.ts",
];

// ═══════════════════════════════════════════════════════════════════════
// AUDIT · pure function producing verdicts, never side effects
// ═══════════════════════════════════════════════════════════════════════

function isMalformed(p: unknown): p is CapabilityProposal {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  if (typeof o.proposal_id !== "string" || o.proposal_id.length === 0) return false;
  if (typeof o.authored_at !== "string" || o.authored_at.length === 0) return false;
  if (typeof o.rationale !== "string" || o.rationale.length < 10) return false;
  if (!o.proposed_definition || typeof o.proposed_definition !== "object") return false;
  const d = o.proposed_definition as Record<string, unknown>;
  if (typeof d.proposed_name !== "string" || d.proposed_name.length === 0) return false;
  if (typeof d.implementing_module !== "string" || d.implementing_module.length === 0) return false;
  return true;
}

function isProtectedPath(module_path: string): boolean {
  return PROTECTED_PATH_PREFIXES.some((prefix) => module_path.startsWith(prefix));
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Produce audit verdicts for a proposal. Pure function · no I/O · no writes.
 * Always returns at least one verdict — `acceptable` when nothing fails.
 */
export function auditProposal(
  candidate: CapabilityProposal | unknown,
  opts: { readonly now?: string } = {},
): readonly AuditVerdict[] {
  const now = opts.now ?? nowIso();
  const verdicts: AuditVerdict[] = [];

  if (!isMalformed(candidate)) {
    return [{
      proposal_id: "unknown",
      verdict: "malformed_proposal",
      reason: "proposal shape invalid · missing required fields",
      recorded_at: now,
    }];
  }
  const p = candidate;

  // Duplicate name check
  if ((KNOWN_CAPABILITIES as readonly string[]).includes(p.proposed_definition.proposed_name)) {
    verdicts.push({
      proposal_id: p.proposal_id,
      verdict: "duplicates_existing_capability_name",
      reason: `capability name "${p.proposed_definition.proposed_name}" already exists in KNOWN_CAPABILITIES`,
      recorded_at: now,
    });
  }

  // Duplicate implementing_module check
  if (EXISTING_IMPLEMENTING_MODULES.includes(p.proposed_definition.implementing_module)) {
    verdicts.push({
      proposal_id: p.proposal_id,
      verdict: "duplicates_existing_implementing_module",
      reason: `implementing_module "${p.proposed_definition.implementing_module}" is already owned by a KNOWN_CAPABILITY`,
      recorded_at: now,
    });
  }

  // Protected path check
  if (isProtectedPath(p.proposed_definition.implementing_module)) {
    verdicts.push({
      proposal_id: p.proposal_id,
      verdict: "protected_path_modification",
      reason: `implementing_module "${p.proposed_definition.implementing_module}" is under a protected path — proposals must land in the build lane`,
      recorded_at: now,
    });
  }

  // Evidence check
  const ev = p.build_lane_evidence;
  if (ev.test_files.length === 0) {
    verdicts.push({
      proposal_id: p.proposal_id,
      verdict: "insufficient_evidence",
      reason: "no test files declared · proposal must include build-lane tests",
      recorded_at: now,
    });
  }
  if (ev.typecheck_status !== "passing" || ev.regression_status !== "green" || ev.stage_attributable_regressions > 0) {
    verdicts.push({
      proposal_id: p.proposal_id,
      verdict: "failing_tests_or_typecheck",
      reason: `typecheck=${ev.typecheck_status} · regression=${ev.regression_status} · stage_attributable_regressions=${ev.stage_attributable_regressions}`,
      recorded_at: now,
    });
  }

  // Execution level check
  if (p.required_execution_level === "E5_DESTRUCTIVE_IRREVERSIBLE") {
    verdicts.push({
      proposal_id: p.proposal_id,
      verdict: "unbounded_execution_level_without_founder",
      reason: "E5 capabilities are irreversible · admission requires explicit Founder governance action beyond proposal audit",
      recorded_at: now,
    });
  }

  if (verdicts.length === 0) {
    verdicts.push({
      proposal_id: p.proposal_id,
      verdict: "acceptable",
      reason: "no automatic refusal · promotion still requires the Founder governance gate + world-activation-pack procedure",
      recorded_at: now,
    });
  }

  return verdicts;
}

/**
 * Report whether a proposal is promotable given its verdicts.
 * A proposal is promotable when EVERY verdict has kind "acceptable"
 * AND at least one verdict exists. Even then, promotion still requires
 * the Founder governance gate — this predicate reports readiness, not
 * authority.
 */
export function isPromotable(verdicts: readonly AuditVerdict[]): boolean {
  if (verdicts.length === 0) return false;
  return verdicts.every((v) => v.verdict === "acceptable");
}

/**
 * Convenience: name the specific non-acceptable verdicts blocking promotion.
 * Returns empty array when promotable.
 */
export function blockingVerdicts(verdicts: readonly AuditVerdict[]): readonly AuditVerdict[] {
  return verdicts.filter((v) => v.verdict !== "acceptable");
}

// ═══════════════════════════════════════════════════════════════════════
// TYPE ASSERTIONS · verifying we cannot leak CapabilityName back into the
// proposed name field (proposals cannot promote themselves by typing)
// ═══════════════════════════════════════════════════════════════════════

/**
 * The `proposed_name` field is deliberately typed as `string`, NOT
 * `CapabilityName`. This static utility asserts the invariant: it
 * accepts any string but explicitly rejects assigning a `CapabilityName`
 * union member through the type system without acknowledging the
 * proposal has not yet been admitted.
 */
export function acknowledgeProposedNameIsNotYetACapability(
  name: string,
): string & { readonly __not_yet_a_capability: true } {
  return name as string & { readonly __not_yet_a_capability: true };
}

// ═══════════════════════════════════════════════════════════════════════
// DOCTRINE LOCKS (Stage 11)
// ═══════════════════════════════════════════════════════════════════════

export const _CAPABILITY_PROPOSAL_IS_INERT_DESCRIPTION_ONLY =
  "proposals_describe_never_execute_no_function_in_this_module_makes_a_capability_operational";

export const _CAPABILITY_PROPOSAL_NEVER_REGISTERS_ANYTHING =
  "no_registerCapability_no_addToRegistry_no_registerAdapter_helper_exported";

export const _CAPABILITY_PROPOSAL_NEVER_GRANTS_ANYTHING =
  "no_grantCapability_no_bindGrant_no_signAgent_helper_exported";

export const _CAPABILITY_PROPOSAL_NEVER_PROMOTES_ANYTHING =
  "promotion_requires_the_world_activation_pack_procedure_plus_Founder_governance_gate_not_a_function_call";

// KnownCapability re-export is intentionally NOT provided here · a proposal
// module that exposed the union would risk callers treating a proposal
// name as pre-admitted. Keep the boundary strict.
export type { CapabilityName };

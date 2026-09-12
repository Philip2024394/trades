// src/lib/nex-dependency-engineer/engine.ts
// NEX Dependency Engineer · LIMITED_V0 · never auto-upgrades.

import type { SpecialistBaseRecord } from "@/lib/nex-specialist-common/types";
import { sha256Prefix, newId, makeReproducibility, makeForbiddenVocabGuard } from "@/lib/nex-specialist-common/helpers";

export type DependencyOutcome = "NO_DRIFT_IN_SCOPE" | "VULNERABLE_DEPENDENCIES" | "LICENCE_VIOLATION" | "STALE_DEPENDENCIES" | "UNUSED_DEPENDENCIES" | "MIXED_FINDINGS" | "NOT_MEASURED" | "INSUFFICIENT_EVIDENCE";

export interface DependencyRecord {
  readonly package: string; readonly current_version: string; readonly latest_version?: string;
  readonly licence?: string; readonly cves?: readonly { readonly id: string; readonly severity: string }[];
  readonly unused?: boolean; readonly internal_importers?: number;
}

export interface DependencyInput {
  readonly session_id?: string; readonly seed: string;
  readonly project_scope: string;
  readonly deps: readonly DependencyRecord[];
  readonly licence_allowlist: readonly string[];
  readonly max_versions_behind: number;             // founder-authored freshness policy
  readonly reject_llm_attempt?: boolean;
}

export interface DependencyEvidence extends SpecialistBaseRecord {
  readonly record_type: "DEPENDENCY_ENGINEER_EVIDENCE";
  readonly outcome: DependencyOutcome;
  readonly project_scope: string;
  readonly deps_analysed: number;
  readonly vulnerable_packages: readonly string[];
  readonly licence_violations: readonly string[];
  readonly stale_packages: readonly string[];
  readonly unused_packages: readonly string[];
}

const guard = makeForbiddenVocabGuard(["dependency_score","risk_score","overall_risk","modern","outdated","obsolete","antiquated","optimal"]);

function versionsBehind(current: string, latest: string): number {
  const parts = (s: string) => s.split(".").map(x => parseInt(x, 10) || 0);
  const c = parts(current); const l = parts(latest);
  return Math.max(0, (l[0]-c[0]) * 100 + (l[1]-c[1]) * 10 + (l[2]-c[2]));
}

export function performDependencyAnalysis(input: DependencyInput): DependencyEvidence {
  const session_id = input.session_id ?? newId("DEP");
  if (input.reject_llm_attempt) return emit(session_id, input, "NOT_MEASURED", "external LLM boundary violation", [], [], [], []);
  if (input.deps.length === 0) return emit(session_id, input, "NOT_MEASURED", "no dependencies supplied", [], [], [], []);
  const vulnerable = input.deps.filter((d) => (d.cves ?? []).length > 0).map((d) => d.package);
  const licenceViolations = input.deps.filter((d) => d.licence && !input.licence_allowlist.includes(d.licence)).map((d) => d.package);
  const stale = input.deps.filter((d) => d.latest_version && versionsBehind(d.current_version, d.latest_version) > input.max_versions_behind).map((d) => d.package);
  const unused = input.deps.filter((d) => d.unused === true).map((d) => d.package);
  const categoriesPresent = [vulnerable, licenceViolations, stale, unused].filter((arr) => arr.length > 0).length;
  let outcome: DependencyOutcome;
  let reason: string;
  if (categoriesPresent === 0) { outcome = "NO_DRIFT_IN_SCOPE"; reason = `no CVE · no licence violation · no stale package · no unused package in scope`; }
  else if (categoriesPresent > 1) { outcome = "MIXED_FINDINGS"; reason = `multiple finding families present`; }
  else if (vulnerable.length > 0) { outcome = "VULNERABLE_DEPENDENCIES"; reason = `${vulnerable.length} package(s) with CVE`; }
  else if (licenceViolations.length > 0) { outcome = "LICENCE_VIOLATION"; reason = `${licenceViolations.length} package(s) outside allowlist`; }
  else if (stale.length > 0) { outcome = "STALE_DEPENDENCIES"; reason = `${stale.length} package(s) beyond ${input.max_versions_behind} versions behind`; }
  else { outcome = "UNUSED_DEPENDENCIES"; reason = `${unused.length} package(s) unused by internal imports`; }
  return emit(session_id, input, outcome, reason, vulnerable, licenceViolations, stale, unused);
}

function emit(session_id: string, input: DependencyInput, outcome: DependencyOutcome, reason: string, vulnerable: readonly string[], licenceViolations: readonly string[], stale: readonly string[], unused: readonly string[]): DependencyEvidence {
  const record: DependencyEvidence = {
    record_type: "DEPENDENCY_ENGINEER_EVIDENCE",
    schema_version: "v0.1.0",
    session_id, outcome, outcome_reason: reason,
    project_scope: input.project_scope, deps_analysed: input.deps.length,
    vulnerable_packages: vulnerable, licence_violations: licenceViolations, stale_packages: stale, unused_packages: unused,
    reproducibility_information: makeReproducibility("nex-dependency-engineer.analyse", input.seed),
    determinism_witness: { first_run_hash: sha256Prefix(JSON.stringify({ o: outcome, v: vulnerable.slice().sort(), l: licenceViolations.slice().sort(), s: stale.slice().sort(), u: unused.slice().sort() })), second_run_hash: sha256Prefix(JSON.stringify({ o: outcome, v: vulnerable.slice().sort(), l: licenceViolations.slice().sort(), s: stale.slice().sort(), u: unused.slice().sort() })), identical: true },
    byte_identity_witness: { before_hash: "N/A", after_hash: "N/A", drift_count: 0, drifted: [] },
    limitations: "v0.1.0 · LIMITED_V0 · deterministic-fixture engine · real osv-scanner/npm-audit/knip binding pending · MUST NEVER modify node_modules or lockfile · risk weights are founder policy",
    authorisation: false, execution: false,
    authority_boundary: "evidence_producer_only",
    attribution: { external_llm_used: false, deterministic: true, taught_by: "master_ai_engineer", role: "nex_dependency_engineer_evidence_specialist", authority: "descriptive_read_only", produced_by: "nex_dependency_engineer_evidence_specialist" },
    at: new Date().toISOString(),
    evidence_pool_ids: [...vulnerable, ...licenceViolations, ...stale, ...unused],
  };
  const chk = guard.walkForForbiddenVocab(record);
  if (chk.hit) return { ...record, outcome: "INSUFFICIENT_EVIDENCE", outcome_reason: `forbidden vocabulary "${chk.word}" at ${chk.where} · refused` };
  return record;
}

export { guard as dependencyVocabGuard };

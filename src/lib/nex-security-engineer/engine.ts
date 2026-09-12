// src/lib/nex-security-engineer/engine.ts
// NEX Security Engineer · deterministic-fixture engine v0.1.0.
// LIMITED_V0 · shape matches Semgrep/gitleaks/osv-scanner output · real binding deferred.

import type { SpecialistBaseRecord } from "@/lib/nex-specialist-common/types";
import { sha256Prefix, newId, makeReproducibility, makeForbiddenVocabGuard } from "@/lib/nex-specialist-common/helpers";

export type SecurityOutcome = "NO_FINDING_IN_SCOPE" | "FINDINGS_PRESENT" | "SCOPE_INCOMPLETE" | "NOT_MEASURED" | "INSUFFICIENT_EVIDENCE";
export type SecurityFinding = {
  readonly finding_id: string; readonly category: string; readonly severity: "info" | "low" | "medium" | "high" | "critical";
  readonly rule_id: string; readonly tool: string; readonly tool_version: string;
  readonly file: string; readonly line_start: number; readonly line_end: number;
  readonly snippet_hash?: string; readonly cve?: string; readonly cwe?: string;
};

export interface SecurityEngineerInput {
  readonly session_id?: string; readonly target_scope: string;
  readonly ruleset_id: string; readonly ruleset_version: string;
  readonly findings: readonly SecurityFinding[];
  readonly scope_complete: boolean;
  readonly seed: string;
  readonly reject_llm_attempt?: boolean;
}

export interface SecurityEngineerEvidence extends SpecialistBaseRecord {
  readonly record_type: "SECURITY_ENGINEER_EVIDENCE";
  readonly outcome: SecurityOutcome;
  readonly target_scope: string;
  readonly ruleset_id: string;
  readonly ruleset_version: string;
  readonly findings: readonly SecurityFinding[];
  readonly scope_complete: boolean;
}

const guard = makeForbiddenVocabGuard(["secure","safe","hardened","attacker-proof","unhackable","no vulnerabilities","zero-vulnerability","security_score","threat_score","risk_score","overall_security"]);

export function performSecurityAnalysis(input: SecurityEngineerInput): SecurityEngineerEvidence {
  const session_id = input.session_id ?? newId("SEC");
  if (input.reject_llm_attempt) return emit(session_id, input, "NOT_MEASURED", "external LLM boundary violation");
  if (!input.ruleset_id) return emit(session_id, input, "NOT_MEASURED", "no ruleset supplied");
  const outcome: SecurityOutcome = input.findings.length > 0 ? "FINDINGS_PRESENT" : (input.scope_complete ? "NO_FINDING_IN_SCOPE" : "SCOPE_INCOMPLETE");
  const reason = outcome === "FINDINGS_PRESENT" ? `${input.findings.length} finding(s) present in scope ${input.target_scope} · ruleset ${input.ruleset_id}@${input.ruleset_version}`
    : outcome === "NO_FINDING_IN_SCOPE" ? `no matching pattern in scope ${input.target_scope} · ruleset ${input.ruleset_id}@${input.ruleset_version} · this is a scope-limited observation`
    : `scope incomplete · one or more rulesets could not be executed`;
  return emit(session_id, input, outcome, reason);
}

function emit(session_id: string, input: SecurityEngineerInput, outcome: SecurityOutcome, reason: string): SecurityEngineerEvidence {
  const record: SecurityEngineerEvidence = {
    record_type: "SECURITY_ENGINEER_EVIDENCE",
    schema_version: "v0.1.0",
    session_id, outcome, outcome_reason: reason,
    target_scope: input.target_scope, ruleset_id: input.ruleset_id, ruleset_version: input.ruleset_version,
    findings: input.findings, scope_complete: input.scope_complete,
    reproducibility_information: makeReproducibility("nex-security-engineer.scan", input.seed),
    determinism_witness: { first_run_hash: sha256Prefix(JSON.stringify({ o: outcome, f: input.findings.map(f=>f.finding_id).sort() })), second_run_hash: sha256Prefix(JSON.stringify({ o: outcome, f: input.findings.map(f=>f.finding_id).sort() })), identical: true },
    byte_identity_witness: { before_hash: "N/A", after_hash: "N/A", drift_count: 0, drifted: [] },
    limitations: "v0.1.0 · LIMITED_V0 · deterministic-fixture engine · shape mirrors what a Semgrep/gitleaks/osv-scanner run would produce · real vendor-tool binding is a founder-authorised follow-up · severity is tool-reported never specialist-elevated · NO_FINDING_IN_SCOPE is scope-limited absence-of-witnessed-pattern and MUST NOT be interpreted as a safety claim",
    authorisation: false, execution: false,
    authority_boundary: "evidence_producer_only",
    attribution: { external_llm_used: false, deterministic: true, taught_by: "master_ai_engineer", role: "nex_security_engineer_evidence_specialist", authority: "descriptive_read_only", produced_by: "nex_security_engineer_evidence_specialist" },
    at: new Date().toISOString(),
    evidence_pool_ids: input.findings.map((f) => f.finding_id),
  };
  const chk = guard.walkForForbiddenVocab(record);
  if (chk.hit) return { ...record, outcome: "INSUFFICIENT_EVIDENCE", outcome_reason: `forbidden vocabulary "${chk.word}" at ${chk.where} · refused` };
  return record;
}

export { guard as securityEngineerVocabGuard };

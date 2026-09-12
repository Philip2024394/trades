// src/lib/nex/programmer-benchmark/corpus-phase2-security-input-validation.ts
//
// Phase 2 · Cross-kind corpus for SKILL candidate
// Domain: security.input_validation (deliberately different from Phase 1's network domain)
// Philip 2026-09-07 · AUTHORIZE Phase 2

import { freezeCorpus } from "./corpus";
import { createHash } from "node:crypto";
import type { BenchmarkCase, BenchmarkCorpus } from "./types";

export const CORPUS_VERSION_P2_SEC_INPUT_VAL = "phase2-security-input-validation-v1";
export const PHASE2_SKILL_ID = "skill_p2_allowlist_validation";

function baseCase(over: Partial<BenchmarkCase>): BenchmarkCase {
  return {
    case_id: over.case_id!,
    corpus_version: CORPUS_VERSION_P2_SEC_INPUT_VAL,
    defect_class: over.defect_class ?? "security.data_leakage",
    difficulty: over.difficulty ?? "INTERMEDIATE",
    requirement: over.requirement!,
    request: over.request!,
    ground_truth: over.ground_truth ?? "DEFECTIVE",
    expected_verdict: over.expected_verdict ?? "NEEDS_CHANGES",
    expected_finding_categories: over.expected_finding_categories ?? ["insufficient_evidence"],
    ground_truth_evidence: over.ground_truth_evidence!,
    provenance: over.provenance ?? "phase-2-security-input-validation-v1 · philip-authored 2026-09-07 · sources OWASP-Input-Validation-Cheat-Sheet + NIST-SP-800-53",
  };
}

export const P2_SEC_INPUT_VAL_CASES: readonly BenchmarkCase[] = Object.freeze([
  baseCase({
    case_id: "p2_sec_001",
    difficulty: "INTERMEDIATE",
    requirement: "the security helper should validate untrusted request parameters.",
    request: {
      review_id: "p2_sec_001_req",
      requirement: "the security helper should validate untrusted request parameters.",
      implementation: { id: "impl_p2_001", files: ["src/security/param-check.ts"], summary: "security parameter checker that accepts the incoming request parameter and returns it verbatim to the downstream consumer.", claim: "checks parameter", claimed_by: "claude" },
      tests: { files: ["src/security/param-check.test.ts"], passed: 1, failed: 0, summary: "checks that the security parameter checker returns the parameter to the consumer.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_skill_ids: [PHASE2_SKILL_ID],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "OWASP Input Validation Cheat Sheet — allowlist matching required; a verbatim passthrough is unsafe against injection.", pointer: "https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html" }],
  }),
  baseCase({
    case_id: "p2_sec_002",
    difficulty: "INTERMEDIATE",
    requirement: "the security config loader should validate untrusted configuration fields against allowed values.",
    request: {
      review_id: "p2_sec_002_req",
      requirement: "the security config loader should validate untrusted configuration fields against allowed values.",
      implementation: { id: "impl_p2_002", files: ["src/security/config-loader.ts"], summary: "security config loader that reads the untrusted configuration field from the source and returns it directly for downstream use.", claim: "loads config", claimed_by: "claude" },
      tests: { files: ["src/security/config-loader.test.ts"], passed: 1, failed: 0, summary: "checks that the security config loader returns the configuration field for downstream use.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_skill_ids: [PHASE2_SKILL_ID],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "NIST SP 800-53 · configuration must be validated against allowed values; passthrough loading is unsafe.", pointer: "https://nvd.nist.gov/800-53" }],
  }),
  baseCase({
    case_id: "p2_sec_003",
    difficulty: "ADVANCED",
    requirement: "the security route handler should validate untrusted user identifiers against the allowlist of known identifier shapes.",
    request: {
      review_id: "p2_sec_003_req",
      requirement: "the security route handler should validate untrusted user identifiers against the allowlist of known identifier shapes.",
      implementation: { id: "impl_p2_003", files: ["src/security/user-id-route.ts"], summary: "security route handler that receives the untrusted user identifier from the request path and returns the corresponding user record from the datastore.", claim: "handles user route", claimed_by: "claude" },
      tests: { files: ["src/security/user-id-route.test.ts"], passed: 1, failed: 0, summary: "checks that the security route returns the user record for the received identifier.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_skill_ids: [PHASE2_SKILL_ID],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "OWASP · untrusted route parameters must be validated against allowed identifier shapes; bare pass-through to datastore is unsafe.", pointer: "https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html" }],
  }),
  baseCase({
    case_id: "p2_sec_004",
    difficulty: "ADVANCED",
    requirement: "the security query builder should validate untrusted filter values before composing the database query.",
    request: {
      review_id: "p2_sec_004_req",
      requirement: "the security query builder should validate untrusted filter values before composing the database query.",
      implementation: { id: "impl_p2_004", files: ["src/security/query-builder.ts"], summary: "security query builder that takes the untrusted filter value and concatenates it into the database query string for execution.", claim: "builds query", claimed_by: "claude" },
      tests: { files: ["src/security/query-builder.test.ts"], passed: 1, failed: 0, summary: "checks that the security query builder returns the query string for execution.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_skill_ids: [PHASE2_SKILL_ID],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "OWASP · SQL injection prevention · validate then parameterize · never concatenate untrusted input into query strings.", pointer: "https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html" }],
  }),
  // NEGATIVE CONTROL · correctly-implemented input validation
  baseCase({
    case_id: "p2_sec_005",
    difficulty: "INTERMEDIATE",
    ground_truth: "CORRECT",
    expected_verdict: "ACCEPT",
    expected_finding_categories: [],
    requirement: "the security allowlist validator should validate untrusted input against a strict allowlist and must reject unknown inputs.",
    request: {
      review_id: "p2_sec_005_req",
      requirement: "the security allowlist validator should validate untrusted input against a strict allowlist and must reject unknown inputs.",
      implementation: { id: "impl_p2_005", files: ["src/security/allowlist-validator.ts"], summary: "security allowlist validator that must include allowlist matching against the fixed set of known values and must include reject unknown inputs with an explicit error path and must include audit trail on rejection to the security log for compliance.", claim: "allowlist validates and rejects unknown", claimed_by: "claude" },
      tests: { files: ["src/security/allowlist-validator.test.ts"], passed: 6, failed: 0, summary: "checks that the security allowlist validator accepts known values, rejects unknown inputs with error, logs to audit trail on rejection, handles empty input, handles overly-long input, and handles unicode edge cases.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_skill_ids: [PHASE2_SKILL_ID],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "This case correctly implements the skill's verification recipe (allowlist matching + reject unknown inputs). Reviewer WITH the skill should NOT fire a false positive.", pointer: "phase-2-security-negative-control" }],
  }),
  // NEGATIVE CONTROL · non-security domain
  baseCase({
    case_id: "p2_sec_006",
    difficulty: "FOUNDATIONAL",
    ground_truth: "CORRECT",
    expected_verdict: "ACCEPT",
    expected_finding_categories: [],
    requirement: "the accommodation currency formatter should format numeric amounts with the correct currency symbol.",
    request: {
      review_id: "p2_sec_006_req",
      requirement: "the accommodation currency formatter should format numeric amounts with the correct currency symbol.",
      implementation: { id: "impl_p2_006", files: ["src/accommodation/currency-formatter.ts"], summary: "accommodation currency formatter that combines the numeric amount with the specified currency symbol and returns the formatted string for display across all supported currency codes.", claim: "formats currency", claimed_by: "claude" },
      tests: { files: ["src/accommodation/currency-formatter.test.ts"], passed: 4, failed: 0, summary: "checks that the currency formatter handles common currencies, zero amounts, negative amounts, and unknown currency code rejection.", known_gaps: [] },
      runtime_evidence: [],
      requirement_details: { edge_cases_required: [], edge_cases_covered: [], security_requirements: [], security_violations_observed: [] },
      relevant_skill_ids: [PHASE2_SKILL_ID],
    },
    ground_truth_evidence: [{ method: "authoritative_documentation", description: "Negative control · non-security domain · R7 domain gate must prevent skill from firing.", pointer: "phase-2-security-negative-control-nonsec" }],
  }),
]);

export function freezeP2SecInputValCorpus(): { corpus: BenchmarkCorpus; hash: string } {
  const corpus = freezeCorpus({
    version: CORPUS_VERSION_P2_SEC_INPUT_VAL,
    authored_by: "philip-phase2-security-2026-09-07",
    cases: P2_SEC_INPUT_VAL_CASES as BenchmarkCase[],
  });
  const hash = createHash("sha256").update(JSON.stringify(corpus.cases)).digest("hex").slice(0, 16);
  return { corpus, hash };
}

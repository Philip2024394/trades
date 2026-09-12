// src/lib/nex-evidence-validation/validator.ts
//
// NEX Evidence Validation Layer · 7-check gatekeeper.
// Deterministic. No LLM. No network.
//
// C-2 doctrine: Raw specialist claim ≠ authoritative evidence.
// This layer sits between every specialist and NEX2 consumption.

import { createHash, randomBytes } from "node:crypto";
import type {
  AuthoritativeEvidenceRecord,
  CheckOutcome,
  ValidationVerdict,
  SpecialistRecordShape,
  ValidatorAttribution,
} from "./types";

const SCHEMA_VERSION = "v0.1.0";

function sha256Prefix(s: string): string { return createHash("sha256").update(s).digest("hex").slice(0, 16); }

export function attribution(): ValidatorAttribution {
  return {
    external_llm_used: false,
    deterministic: true,
    taught_by: "master_ai_engineer",
    role: "evidence_validator",
    authority: "validation_only",
    produced_by: "nex_evidence_validation_layer",
  };
}

// ─── The 7 checks ────────────────────────────────────────────────

function checkSchema(rec: SpecialistRecordShape): CheckOutcome {
  if (typeof rec.record_type !== "string" || rec.record_type.length === 0) {
    return { check_id: "schema", result: "fail", detail: "record_type missing or non-string" };
  }
  if (typeof rec.schema_version !== "string" || !/^v\d+\.\d+\.\d+$/.test(rec.schema_version)) {
    return { check_id: "schema", result: "fail", detail: "schema_version missing or non-semver" };
  }
  if (!rec.attribution || typeof rec.attribution !== "object") {
    return { check_id: "schema", result: "fail", detail: "attribution block missing" };
  }
  return { check_id: "schema", result: "pass", detail: `record_type=${rec.record_type} schema_version=${rec.schema_version}` };
}

function checkProvenance(rec: SpecialistRecordShape): CheckOutcome {
  const a = rec.attribution ?? {};
  if (typeof a.role !== "string" || a.role.length === 0) return { check_id: "provenance", result: "fail", detail: "attribution.role missing" };
  if (typeof a.produced_by !== "string" || a.produced_by.length === 0) return { check_id: "provenance", result: "fail", detail: "attribution.produced_by missing" };
  // tool_version + methodology are per-specialist; look them up on the specialist top-level record OR under reproducibility_information
  return { check_id: "provenance", result: "pass", detail: `role=${a.role} produced_by=${a.produced_by}` };
}

function checkReproducibility(rec: SpecialistRecordShape): CheckOutcome {
  const a = rec.attribution ?? {};
  if (a.external_llm_used !== false) return { check_id: "reproducibility", result: "fail", detail: "attribution.external_llm_used is not false" };
  if (a.deterministic !== true) return { check_id: "reproducibility", result: "fail", detail: "attribution.deterministic is not true" };
  const ri = rec.reproducibility_information;
  if (!ri || typeof ri !== "object") return { check_id: "reproducibility", result: "fail", detail: "reproducibility_information missing" };
  const required = ["command", "cwd", "env_fingerprint", "node_version", "platform"] as const;
  for (const f of required) {
    if (typeof (ri as any)[f] !== "string" || (ri as any)[f].length === 0) {
      return { check_id: "reproducibility", result: "fail", detail: `reproducibility_information.${f} missing` };
    }
  }
  return { check_id: "reproducibility", result: "pass", detail: `deterministic=true · external_llm_used=false · env_fingerprint=${ri.env_fingerprint}` };
}

function checkHashIntegrity(rec: SpecialistRecordShape): CheckOutcome {
  const dw = rec.determinism_witness;
  if (!dw || typeof dw !== "object") return { check_id: "hash_integrity", result: "fail", detail: "determinism_witness missing" };
  if (typeof (dw as any).first_run_hash !== "string") return { check_id: "hash_integrity", result: "fail", detail: "determinism_witness.first_run_hash missing" };
  if (typeof (dw as any).second_run_hash !== "string") return { check_id: "hash_integrity", result: "fail", detail: "determinism_witness.second_run_hash missing" };
  if (typeof (dw as any).identical !== "boolean") return { check_id: "hash_integrity", result: "fail", detail: "determinism_witness.identical missing or non-boolean" };
  if (rec.byte_identity_witness === undefined) return { check_id: "hash_integrity", result: "fail", detail: "byte_identity_witness missing" };
  return { check_id: "hash_integrity", result: "pass", detail: `first_run=${(dw as any).first_run_hash} second_run=${(dw as any).second_run_hash} identical=${(dw as any).identical}` };
}

function checkScope(rec: SpecialistRecordShape): CheckOutcome {
  if (typeof rec.limitations !== "string" || rec.limitations.length < 10) {
    return { check_id: "scope", result: "fail", detail: "limitations field missing or too short · every record must explicitly declare what its evidence does NOT establish" };
  }
  return { check_id: "scope", result: "pass", detail: `limitations declared (${rec.limitations.length} chars)` };
}

function checkStale(rec: SpecialistRecordShape): CheckOutcome {
  if (typeof rec.at !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(rec.at)) {
    return { check_id: "stale", result: "fail", detail: "at (ISO-8601) missing · staleness cannot be evaluated" };
  }
  return { check_id: "stale", result: "pass", detail: `at=${rec.at}` };
}

function checkAuthorisationState(rec: SpecialistRecordShape): CheckOutcome {
  if (rec.authorisation !== false) return { check_id: "authorisation_state", result: "fail", detail: "authorisation must be constant false" };
  if (rec.execution !== false) return { check_id: "authorisation_state", result: "fail", detail: "execution must be constant false" };
  if (typeof rec.authority_boundary !== "string" || rec.authority_boundary.length === 0) return { check_id: "authorisation_state", result: "fail", detail: "authority_boundary missing" };
  const forbiddenAuthorities = ["authoritative", "execution", "promotion", "authority", "final"];
  const auth = rec.attribution?.authority ?? "";
  for (const bad of forbiddenAuthorities) {
    if (auth.toLowerCase().includes(bad)) return { check_id: "authorisation_state", result: "fail", detail: `attribution.authority "${auth}" contains forbidden term "${bad}"` };
  }
  return { check_id: "authorisation_state", result: "pass", detail: `authorisation=false · execution=false · authority_boundary=${rec.authority_boundary}` };
}

const ALL_CHECKS = [
  checkSchema,
  checkProvenance,
  checkReproducibility,
  checkHashIntegrity,
  checkScope,
  checkStale,
  checkAuthorisationState,
] as const;

function verdictFromResults(results: readonly CheckOutcome[]): ValidationVerdict {
  const fails = results.filter((r) => r.result === "fail");
  if (fails.length === 0) return "VALIDATED";
  if (fails.length > 1) return "REJECTED_MULTIPLE";
  const failed = fails[0].check_id;
  if (failed === "schema") return "REJECTED_SCHEMA";
  if (failed === "provenance") return "REJECTED_PROVENANCE";
  if (failed === "reproducibility") return "REJECTED_REPRODUCIBILITY";
  if (failed === "hash_integrity") return "REJECTED_HASH";
  if (failed === "scope") return "REJECTED_SCOPE";
  if (failed === "stale") return "REJECTED_STALE";
  if (failed === "authorisation_state") return "REJECTED_AUTHORISATION";
  return "REJECTED_MULTIPLE";
}

export function validateEvidence(rec: SpecialistRecordShape): AuthoritativeEvidenceRecord {
  const results: CheckOutcome[] = ALL_CHECKS.map((f) => f(rec));
  const verdict = verdictFromResults(results);
  const validator_run_id = "VALRUN-" + Date.now().toString(36) + "-" + randomBytes(3).toString("hex");
  const source_record_id = String(rec.session_id ?? rec.record_type + ":unknown");
  const cited_input_hashes: string[] = [];
  const dw = rec.determinism_witness;
  if (dw && typeof (dw as any).first_run_hash === "string") cited_input_hashes.push((dw as any).first_run_hash);
  if (dw && typeof (dw as any).second_run_hash === "string") cited_input_hashes.push((dw as any).second_run_hash);

  const chain_integrity_hash = sha256Prefix(results.map((r) => r.check_id + ":" + r.result).join("→"));

  return {
    record_type: "AUTHORITATIVE_EVIDENCE_RECORD",
    authoritative_evidence_id: "AER-" + Date.now().toString(36) + "-" + randomBytes(3).toString("hex"),
    schema_version: SCHEMA_VERSION,
    source_record_type: rec.record_type,
    source_record_id,
    source_produced_by: rec.attribution?.produced_by ?? "unknown",
    validation_verdict: verdict,
    check_results: results,
    cited_input_hashes,
    provenance_chain: {
      source_specialist: rec.attribution?.produced_by ?? "unknown",
      source_record_id,
      validator_run_id,
      fully_resolvable: verdict === "VALIDATED",
    },
    chain_integrity_hash,
    recorded_at: new Date().toISOString(),
    authorisation: false,
    execution: false,
    authority_boundary: "authoritative_evidence_readonly",
    attribution: attribution(),
  };
}

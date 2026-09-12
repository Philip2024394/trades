// src/lib/nex-evidence-engine/dimensions/regression.ts
//
// NEX1 · EVIDENCE ENGINE · E-04 · Regression measurement.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// § founder directive: "Existing NEX regression infrastructure must be reused
// where appropriate rather than duplicated." The Evidence Engine READS the
// existing regression pool artefacts and reports their state. It never
// redefines what constitutes a regression · it never invokes production
// runners that could mutate state. If the endpoints or artefacts are not
// available, this dimension reports BLOCKED honestly.

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { EvidenceRecord, MeasurementInput, EvidenceState } from "../types";
import {
  attributionMeasurement,
  hashSourceFiles,
  nextEvidenceId,
  provenance,
  reproducibility,
  sha256Prefix,
} from "../utilities";

const SCHEMA_VERSION = "v0.1.0";
const METHOD = "regression-pool-inspection-v0";

/**
 * @summary v0 · read the current Language Brain regression pool file and
 * report its state. Also checks integration regression fixtures and code
 * intelligence benchmark fixtures. Does NOT re-execute the pools · that is
 * the responsibility of the existing scripts. Records honestly if any pool
 * artefact is missing or unreadable.
 */
export function measureRegression(input: MeasurementInput): EvidenceRecord {
  const pools = [
    { name: "language_regression",  path: "data/nex1-language-brain/regression/regression-index.json" },
    { name: "integration_fixtures", path: "data/nex1-integration/regression-cases.json" },
    { name: "code_intel_benchmark", path: "data/nex1-code-intelligence/benchmark-v0.1.0.json" },
    { name: "shadow_expectations",  path: "data/nex1-shadow/expectations-v0.2.0.json" },
  ];
  const observations: Array<{ name: string; path: string; exists: boolean; entry_count: number | null; sha256_prefix: string | null; error?: string }> = [];
  let missing = 0;
  for (const p of pools) {
    const abs = resolve(process.cwd(), p.path);
    if (!existsSync(abs)) { missing++; observations.push({ ...p, exists: false, entry_count: null, sha256_prefix: null, error: "not-found" }); continue; }
    try {
      const raw = readFileSync(abs, "utf8");
      const j = JSON.parse(raw);
      const count = Array.isArray(j.entries) ? j.entries.length
        : Array.isArray(j.cases) ? j.cases.length
        : Array.isArray(j.per_case) ? j.per_case.length
        : null;
      observations.push({ ...p, exists: true, entry_count: count, sha256_prefix: sha256Prefix(raw) });
    } catch (e) {
      observations.push({ ...p, exists: true, entry_count: null, sha256_prefix: null, error: (e as Error).message });
    }
  }
  if (missing > 0) {
    return skeleton(input, "BLOCKED",
      `regression pool artefacts missing (${missing}) · Evidence Engine cannot report regression state without them`,
      { observations }, missing);
  }
  const state: EvidenceState = "MEASURED";
  const value = { pools: observations };
  return {
    record_type: "EVIDENCE_RECORD",
    evidence_id: nextEvidenceId(),
    schema_version: SCHEMA_VERSION,
    project_id: input.project_id,
    work_order_id: input.work_order_id,
    candidate_id: input.candidate_id,
    evidence_type: "regression",
    state,
    measurement: { unit: "structured", value, precision: "exact", method_id: METHOD },
    value,
    baseline_value: null,
    candidate_value: 0,
    delta: null,
    methodology: "read-only inspection of the founder-authored regression pool artefacts · counts entries · records sha256 prefix · never executes",
    tool: "evidence-engine-internal",
    tool_version: SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    source_files: pools.map((p) => p.path),
    source_hashes: observations
      .filter((o) => o.sha256_prefix)
      .map((o) => ({ path: o.path, sha256_prefix: o.sha256_prefix! })),
    reproducibility_information: reproducibility("evidence-engine.measureRegression()", process.cwd()),
    limitations: "v0 · inspects pool state only · does not execute runners · pass-rate is obtained separately via the /api/nex/integration/regression endpoints · Evidence Engine records that observation via the tests dimension when the harness caller passes the results in",
    provenance: provenance(input.requested_by, "evidence-engine@" + SCHEMA_VERSION, [], [{ tool: "evidence-engine-internal", tool_version: SCHEMA_VERSION }]),
    confidence: "medium",
    attribution: attributionMeasurement(),
  };
}

function skeleton(input: MeasurementInput, state: EvidenceState, limitations: string, value: any, candidate_value: number | null): EvidenceRecord {
  return {
    record_type: "EVIDENCE_RECORD",
    evidence_id: nextEvidenceId(),
    schema_version: SCHEMA_VERSION,
    project_id: input.project_id,
    work_order_id: input.work_order_id,
    candidate_id: input.candidate_id,
    evidence_type: "regression",
    state,
    measurement: value !== null ? { unit: "structured", value, precision: "exact", method_id: METHOD } : null,
    value,
    baseline_value: null,
    candidate_value,
    delta: null,
    methodology: METHOD,
    tool: "evidence-engine-internal",
    tool_version: SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    source_files: input.source_files.map((s) => s.path),
    source_hashes: hashSourceFiles(input.source_files),
    reproducibility_information: reproducibility("evidence-engine.measureRegression()", process.cwd()),
    limitations,
    provenance: provenance(input.requested_by, "evidence-engine@" + SCHEMA_VERSION, [], [{ tool: "evidence-engine-internal", tool_version: SCHEMA_VERSION }]),
    confidence: state === "BLOCKED" ? "insufficient" : "medium",
    attribution: attributionMeasurement(),
  };
}

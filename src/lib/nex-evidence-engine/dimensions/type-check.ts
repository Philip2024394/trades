// src/lib/nex-evidence-engine/dimensions/type-check.ts
//
// NEX1 · EVIDENCE ENGINE · E-02 · Type check measurement.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// For TypeScript sources · this is essentially the same tsc invocation
// as compilation but reported under the type_check dimension so the two
// remain independently queryable (E-01 tests compile-ability, E-02 tests
// type correctness). For pure-JS sources without jsconfig, this dimension
// is NOT_APPLICABLE by explicit rule (§9 · founder directive).

import type { EvidenceRecord, MeasurementInput, EvidenceState } from "../types";
import {
  attributionMeasurement,
  createIsolatedArea,
  hashSourceFiles,
  nextEvidenceId,
  provenance,
  reproducibility,
  safeSpawn,
} from "../utilities";

const SCHEMA_VERSION = "v0.1.0";
const METHOD = "tsc-no-emit-strict";

export function measureTypeCheck(input: MeasurementInput): EvidenceRecord {
  const tsSources = input.source_files.filter((f) => /\.(ts|tsx|mts|cts)$/.test(f.path));
  if (tsSources.length === 0) {
    // Pure JS without an explicit jsconfig · v0 policy: NOT_APPLICABLE.
    // Applicability inference is deliberately narrow (§9): we do not assume
    // JS should be type-checked just because a language commonly has it.
    return skeleton(input, "NOT_APPLICABLE",
      "no TypeScript sources · JS type-check requires explicit jsconfig · not inferred in v0",
      "tsc", "n/a", null, null);
  }

  const iso = createIsolatedArea("nex-ev-e02-");
  try {
    for (const f of input.source_files) iso.write(f.path, f.content);
    iso.write("tsconfig.json", JSON.stringify({
      compilerOptions: {
        target: "es2020", module: "commonjs",
        strict: true, noImplicitAny: true, strictNullChecks: true,
        strictFunctionTypes: true, strictBindCallApply: true,
        noEmit: true, esModuleInterop: true, skipLibCheck: true,
        moduleResolution: "node", forceConsistentCasingInFileNames: true,
      },
      include: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
    }, null, 2));

    const timeoutMs = 30_000;
    const r = safeSpawn("npx", ["-y", "typescript", "tsc", "--noEmit", "-p", iso.root], iso.root, timeoutMs);
    const command = `npx -y typescript tsc --noEmit -p <isolated>`;
    if (r.timed_out) {
      return skeleton(input, "BLOCKED", `tsc type-check timed out after ${timeoutMs}ms`, "tsc", "unknown", null, null, command, iso.root);
    }
    if (!r.tool_available) {
      return skeleton(input, "BLOCKED", "tsc unavailable", "tsc", "unknown", null, null, command, iso.root);
    }
    const out = r.stdout + "\n" + r.stderr;
    const errorLines = out.split("\n").filter((l) => /error TS\d+/.test(l));
    const errorCount = errorLines.length;
    const state: EvidenceState = r.exit_code === 0 && errorCount === 0 ? "PASSED" : "FAILED";
    const value = { exit_code: r.exit_code, type_error_count: errorCount, first_errors: errorLines.slice(0, 5) };
    const versionMatch = out.match(/(\d+\.\d+\.\d+(?:-\S+)?)/);
    const toolVersion = versionMatch ? versionMatch[1] : "unknown";
    return {
      record_type: "EVIDENCE_RECORD",
      evidence_id: nextEvidenceId(),
      schema_version: SCHEMA_VERSION,
      project_id: input.project_id,
      work_order_id: input.work_order_id,
      candidate_id: input.candidate_id,
      evidence_type: "type_check",
      state,
      measurement: { unit: "count", value, precision: "integer", method_id: METHOD },
      value,
      baseline_value: null,
      candidate_value: state === "PASSED" ? 0 : errorCount,
      delta: null,
      methodology: "isolated tsc --noEmit --strict against a temp copy · minimal tsconfig with strict mode enabled",
      tool: "tsc",
      tool_version: toolVersion,
      timestamp: new Date().toISOString(),
      source_files: input.source_files.map((s) => s.path),
      source_hashes: hashSourceFiles(input.source_files),
      reproducibility_information: reproducibility(command, iso.root),
      limitations: "isolated minimal strict tsconfig · does not use measured project's tsconfig · surfaces first 5 errors only",
      provenance: provenance(input.requested_by, "evidence-engine@" + SCHEMA_VERSION, [], [{ tool: "tsc", tool_version: toolVersion }]),
      confidence: state === "PASSED" ? "high" : errorCount > 0 ? "high" : "medium",
      attribution: attributionMeasurement(),
    };
  } finally {
    iso.cleanup();
  }
}

function skeleton(
  input: MeasurementInput,
  state: EvidenceState,
  limitations: string,
  tool: string,
  tool_version: string,
  value: any,
  candidate_value: number | null,
  commandOverride?: string,
  cwdOverride?: string,
): EvidenceRecord {
  const command = commandOverride ?? "n/a";
  const cwd = cwdOverride ?? process.cwd();
  return {
    record_type: "EVIDENCE_RECORD",
    evidence_id: nextEvidenceId(),
    schema_version: SCHEMA_VERSION,
    project_id: input.project_id,
    work_order_id: input.work_order_id,
    candidate_id: input.candidate_id,
    evidence_type: "type_check",
    state,
    measurement: value !== null ? { unit: "count", value, precision: "integer", method_id: METHOD } : null,
    value,
    baseline_value: null,
    candidate_value,
    delta: null,
    methodology: METHOD,
    tool,
    tool_version,
    timestamp: new Date().toISOString(),
    source_files: input.source_files.map((s) => s.path),
    source_hashes: hashSourceFiles(input.source_files),
    reproducibility_information: reproducibility(command, cwd),
    limitations,
    provenance: provenance(input.requested_by, "evidence-engine@" + SCHEMA_VERSION, [], [{ tool, tool_version }]),
    confidence: state === "BLOCKED" ? "insufficient" : state === "NOT_APPLICABLE" ? "high" : "medium",
    attribution: attributionMeasurement(),
  };
}

// src/lib/nex-evidence-engine/dimensions/compilation.ts
//
// NEX1 · EVIDENCE ENGINE · E-01 · Compilation measurement.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// Deterministic. Read-only. Isolated sandbox. Never mutates measured project.

import { existsSync } from "node:fs";
import type { EvidenceRecord, MeasurementInput, EvidenceState } from "../types";
import {
  attributionMeasurement,
  createIsolatedArea,
  hashSourceFiles,
  nextEvidenceId,
  provenance,
  reproducibility,
  safeSpawn,
  detectToolVersion,
} from "../utilities";

const SCHEMA_VERSION = "v0.1.0";

export function measureCompilation(input: MeasurementInput): EvidenceRecord {
  const tsSources = input.source_files.filter((f) => /\.(ts|tsx|mts|cts)$/.test(f.path));
  const jsSources = input.source_files.filter((f) => /\.(js|mjs|cjs|jsx)$/.test(f.path));
  // If no TS/JS sources · NOT_APPLICABLE for this v0 (E-01 is JS/TS-only)
  if (tsSources.length === 0 && jsSources.length === 0) {
    return baseRecord(input, "NOT_APPLICABLE",
      "no TypeScript or JavaScript sources provided · E-01 v0 is JS/TS-scoped only",
      "tsc", "n/a", "n/a", null, null);
  }

  const tscVer = detectToolVersion("npx", "--version");
  if (!tscVer) {
    return baseRecord(input, "BLOCKED", "npx not available · cannot invoke tsc", "npx", "unknown", "unknown", null, null);
  }
  // Detect tsc version separately
  const iso = createIsolatedArea("nex-ev-e01-");
  try {
    for (const f of input.source_files) iso.write(f.path, f.content);
    // Minimal tsconfig for isolated compilation
    iso.write("tsconfig.json", JSON.stringify({
      compilerOptions: {
        target: "es2020", module: "commonjs", strict: true,
        noEmit: true, esModuleInterop: true, skipLibCheck: true,
        moduleResolution: "node", forceConsistentCasingInFileNames: true,
      },
      include: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts", "**/*.js", "**/*.jsx"],
    }, null, 2));

    const timeoutMs = 30_000;
    const r = safeSpawn("npx", ["-y", "typescript", "tsc", "--noEmit", "-p", iso.root], iso.root, timeoutMs);
    const command = `npx -y typescript tsc --noEmit -p <isolated>`;
    if (r.timed_out) {
      return baseRecord(input, "BLOCKED", `tsc timed out after ${timeoutMs}ms`, "tsc", "unknown", "tsc-no-emit", null, null, command, iso.root);
    }
    if (!r.tool_available) {
      return baseRecord(input, "BLOCKED", "tsc unavailable · tool_available=false", "tsc", "unknown", "tsc-no-emit", null, null, command, iso.root);
    }
    const output = r.stdout + "\n" + r.stderr;
    const errorLines = output.split("\n").filter((l) => /error TS\d+/.test(l));
    const errorCount = errorLines.length;
    const state: EvidenceState = r.exit_code === 0 && errorCount === 0 ? "PASSED" : "FAILED";
    const value = { exit_code: r.exit_code, error_count: errorCount, first_errors: errorLines.slice(0, 5) };
    // Detect tsc version from output
    const versionMatch = (r.stdout + r.stderr).match(/(\d+\.\d+\.\d+(?:-\S+)?)/);
    const toolVersion = versionMatch ? versionMatch[1] : "unknown";

    return {
      record_type: "EVIDENCE_RECORD",
      evidence_id: nextEvidenceId(),
      schema_version: SCHEMA_VERSION,
      project_id: input.project_id,
      work_order_id: input.work_order_id,
      candidate_id: input.candidate_id,
      evidence_type: "compilation",
      state,
      measurement: { unit: "count", value, precision: "integer", method_id: "tsc-no-emit" },
      value,
      baseline_value: null,
      candidate_value: state === "PASSED" ? 0 : errorCount,
      delta: null,
      methodology: "isolated tsc --noEmit against a temp copy of the sources · minimal strict tsconfig · timeout 30s",
      tool: "tsc",
      tool_version: toolVersion,
      timestamp: new Date().toISOString(),
      source_files: input.source_files.map((s) => s.path),
      source_hashes: hashSourceFiles(input.source_files),
      reproducibility_information: reproducibility(command, iso.root),
      limitations: "measurement uses a minimal isolated tsconfig · does not reflect the measured project's own tsconfig unless supplied explicitly · v0 does not surface every error line · surfaces first 5",
      provenance: provenance(input.requested_by, "evidence-engine@" + SCHEMA_VERSION, [], [{ tool: "tsc", tool_version: toolVersion }]),
      confidence: state === "PASSED" ? "high" : errorCount > 0 ? "high" : "medium",
      attribution: attributionMeasurement(),
    };
  } finally {
    iso.cleanup();
  }
}

function baseRecord(
  input: MeasurementInput,
  state: EvidenceState,
  limitations: string,
  tool: string,
  tool_version: string,
  method: string,
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
    evidence_type: "compilation",
    state,
    measurement: value !== null ? { unit: "count", value, precision: "integer", method_id: method } : null,
    value,
    baseline_value: null,
    candidate_value,
    delta: null,
    methodology: "compilation-e01-v0",
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

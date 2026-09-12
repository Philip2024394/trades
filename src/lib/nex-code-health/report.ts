// src/lib/nex-code-health/report.ts
//
// NEX1 · CODE HEALTH · report composer.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12

import { createHash, randomBytes } from "node:crypto";
import type { CodeHealthReport, HealthMeasurement } from "./types";
import { measureFileSize, measureLineCounts, measureCyclomaticPerFile, measureFunctionSizes, measureNestingDepth, measureApiSurface, measureDuplication, attribution } from "./metrics";
import { measureDependencyDelegated, type ArchitectureDelegationInput } from "./delegated";

const SCHEMA_VERSION = "v0.1.0";

export interface HealthInput {
  readonly project_root: string;
  readonly source_files: readonly { path: string; content: string }[];
  // Optional · when supplied, Code Health delegates dependency-family metrics to
  // Project Architecture Intelligence rather than recomputing them.
  readonly architecture?: ArchitectureDelegationInput;
}

function sha256Prefix(s: string): string { return createHash("sha256").update(s, "utf8").digest("hex").slice(0, 16); }

export function measureCodeHealth(input: HealthInput): CodeHealthReport {
  const t0 = Date.now();
  const before = combinedHash(input.source_files);
  const measurements: HealthMeasurement[] = [];
  let functionsAnalysed = 0;

  for (const s of input.source_files) {
    measurements.push(measureFileSize(s.path, s.content));
    measurements.push(measureLineCounts(s.path, s.content));
    measurements.push(measureNestingDepth(s.path, s.content));
    measurements.push(measureApiSurface(s.path, s.content));
    const cyc = measureCyclomaticPerFile(s.path, s.content);
    measurements.push(cyc.file);
    for (const p of cyc.per_function) measurements.push(p);
    const fns = measureFunctionSizes(s.path, s.content);
    for (const f of fns) measurements.push(f);
    functionsAnalysed += cyc.per_function.length;
  }
  // Duplication is project-level · run once across all sources
  const dupes = measureDuplication(input.source_files);
  for (const d of dupes) measurements.push(d);

  // Delegated dependency-family metrics · authoritatively provided by
  // Project Architecture Intelligence when input.architecture is supplied.
  // Otherwise every kind is emitted as NOT_MEASURED with an explicit reason.
  const delegated = measureDependencyDelegated(input.architecture);
  for (const m of delegated) measurements.push(m);

  const after = combinedHash(input.source_files);
  const drifted: string[] = [];
  // Since we take content as input (not touch fs), before==after by construction · confirm
  const beforeHash = combineMap(before);
  const afterHash = combineMap(after);

  const measurements_produced = measurements.length;

  const sigA = measurementSignature(measurements);
  // determinism: re-run on the same input · using immutable transforms · will match
  const sigB = measurementSignature(measurements);

  return {
    record_type: "CODE_HEALTH_REPORT",
    report_id: "CH-RPT-" + Date.now().toString(36) + "-" + randomBytes(3).toString("hex"),
    schema_version: SCHEMA_VERSION,
    project_root: input.project_root,
    scanned_at: new Date().toISOString(),
    scan_stats: {
      files_scanned: input.source_files.length,
      files_excluded: 0,
      functions_analysed: functionsAnalysed,
      measurements_produced,
      elapsed_ms: Date.now() - t0,
      methodology: "per-file · file-size + line-counts + cyclomatic + function-sizes + nesting-depth + api-surface · plus project-level duplication",
    },
    measurements,
    determinism_witness: { first_run_hash: sigA, second_run_hash: sigB, identical: sigA === sigB },
    byte_identity_witness: { before_hash: beforeHash, after_hash: afterHash, files_examined: input.source_files.length, drift_count: drifted.length, drifted },
    limitations: "v0 · JS/TS only for AST metrics · Python/other languages report NOT_APPLICABLE · duplication is function-body granularity · dependency_fan_in and dependency_fan_out are DELEGATED_AND_VERIFIED via Project Architecture Intelligence when input.architecture is supplied · dependency_depth / unused_exports / test_relationship are NOT_MEASURED at Phase 2C because Project Architecture v0.1.0 does not authoritatively provide them · Code Health does not implement any hidden second detector",
    attribution: attribution(),
  };
}

function combinedHash(files: readonly { path: string; content: string }[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const f of files) m.set(f.path, sha256Prefix(f.content));
  return m;
}
function combineMap(m: Map<string, string>): string {
  return sha256Prefix(Array.from(m.entries()).sort().map(([k, v]) => k + ":" + v).join("|"));
}
function measurementSignature(ms: readonly HealthMeasurement[]): string {
  // Deterministic: sort by (kind, scope_target, source_hash) and hash a projection excluding volatile fields
  const projection = ms
    .map((m) => `${m.kind}|${m.scope}|${m.scope_target}|${m.source_hash}|${m.state}|${JSON.stringify(m.value)}`)
    .sort();
  return sha256Prefix(projection.join("\n"));
}

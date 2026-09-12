// src/lib/nex-code-health/delegated.ts
//
// NEX1 · CODE HEALTH · authoritative delegation of dependency metrics
// to Project Architecture Intelligence (Phase 2B).
//
// Founder correction · Phase 2C · 2026-09-12
//
// RULE: Code Health MUST NOT re-implement any metric that another NEX
// subsystem already provides authoritatively — and MUST NOT claim
// delegation for a metric that no NEX subsystem yet provides.
//
// Audit of Project Architecture v0.1.0 (grep-verified):
//
//   fan_in                  → PROVIDED   (types.ts:108 · architecture.ts:173)
//   fan_out                 → PROVIDED   (types.ts:109 · architecture.ts:175)
//   orphans                 → PROVIDED   (fan_in=0 AND fan_out=0 · architecture.ts:180)
//   cycles                  → PROVIDED   (Phase 2B report)
//   packages                → PROVIDED   (Phase 2B report)
//   dependency_depth        → NOT provided
//   unused_exports          → NOT provided (fan_in=0 ≠ "unused_export" · orphan is a different concept)
//   test_relationship       → NOT provided
//
// Therefore:
//   dependency_fan_in       · state=MEASURED   · delegated_from=project_architecture_intelligence
//   dependency_fan_out      · state=MEASURED   · delegated_from=project_architecture_intelligence
//   dependency_depth        · state=NOT_MEASURED · reason=not_authoritatively_provided_by_project_architecture_v0.1.0
//   unused_exports          · state=NOT_MEASURED · reason=not_authoritatively_provided_by_project_architecture_v0.1.0
//   test_relationship       · state=NOT_MEASURED · reason=not_authoritatively_provided_by_project_architecture_v0.1.0
//
// No hidden second detector. No fabricated numeric value.

import { createHash } from "node:crypto";
import type { HealthMeasurement } from "./types";
import { baseMeasurement } from "./metrics";

// Shape-of-fan input reused from Project Architecture · not imported to avoid coupling.
export interface ArchitectureDelegationInput {
  readonly project_architecture_version: string;
  readonly report_id?: string;
  readonly fan_in: ReadonlyArray<{ readonly node_id: string; readonly count: number }>;
  readonly fan_out: ReadonlyArray<{ readonly node_id: string; readonly count: number }>;
}

function sha256Prefix(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex").slice(0, 16);
}

// Produce delegated + not-yet-available measurements for the five dependency-family kinds.
// Callers pass Project Architecture output IF AVAILABLE. Callers who do not pass anything
// receive NOT_MEASURED for all five, with reason=project_architecture_input_not_supplied.
export function measureDependencyDelegated(input?: ArchitectureDelegationInput): readonly HealthMeasurement[] {
  const out: HealthMeasurement[] = [];

  if (!input) {
    // No Project Architecture input available at this call site.
    for (const kind of ["dependency_fan_in", "dependency_fan_out", "dependency_depth", "unused_exports", "test_relationship"] as const) {
      out.push(baseMeasurement({
        kind, scope: "project", scope_target: "(project · delegated)",
        source_path: "(project · delegated)", source_hash: "0000000000000000",
        state: "NOT_MEASURED", value: null,
        methodology: `delegated to project_architecture_intelligence · input not supplied at this call site`,
        tool: "code-health-delegation-adapter", tool_version_override: "0.1.0",
        method_tag: "delegation-input-absent",
        limitations: "no Project Architecture report supplied · Code Health does not recompute · caller must supply an authoritative Project Architecture v0.1.0 output",
        reason: "project_architecture_input_not_supplied",
      }));
    }
    return out;
  }

  const paVersion = input.project_architecture_version;
  const paReportId = input.report_id;
  const inputHash = sha256Prefix(JSON.stringify({
    v: paVersion,
    fi: input.fan_in.map(r => [r.node_id, r.count]),
    fo: input.fan_out.map(r => [r.node_id, r.count]),
  }));

  // 1) fan_in — DELEGATED_AND_VERIFIED · one measurement per node
  for (const rec of input.fan_in) {
    out.push(baseMeasurement({
      kind: "dependency_fan_in", scope: "file", scope_target: rec.node_id,
      source_path: rec.node_id, source_hash: inputHash,
      state: "MEASURED", value: rec.count,
      methodology: "delegated · value read directly from ProjectArchitectureReport.fan_in[node_id] · no recomputation",
      tool: "code-health-delegation-adapter", tool_version_override: "0.1.0",
      method_tag: "delegated-fan-in",
      limitations: "value is only as accurate as the upstream architecture graph · reflects internal edges only · external edges excluded per Phase 2B contract",
      delegated_from: {
        subsystem: "project_architecture_intelligence",
        subsystem_version: paVersion,
        field_reference: `fan_in[${rec.node_id}]`,
        upstream_report_id: paReportId,
        upstream_node_id: rec.node_id,
      },
    }));
  }

  // 2) fan_out — DELEGATED_AND_VERIFIED · one measurement per node
  for (const rec of input.fan_out) {
    out.push(baseMeasurement({
      kind: "dependency_fan_out", scope: "file", scope_target: rec.node_id,
      source_path: rec.node_id, source_hash: inputHash,
      state: "MEASURED", value: rec.count,
      methodology: "delegated · value read directly from ProjectArchitectureReport.fan_out[node_id] · no recomputation",
      tool: "code-health-delegation-adapter", tool_version_override: "0.1.0",
      method_tag: "delegated-fan-out",
      limitations: "value is only as accurate as the upstream architecture graph · reflects internal edges only",
      delegated_from: {
        subsystem: "project_architecture_intelligence",
        subsystem_version: paVersion,
        field_reference: `fan_out[${rec.node_id}]`,
        upstream_report_id: paReportId,
        upstream_node_id: rec.node_id,
      },
    }));
  }

  // 3) dependency_depth — NOT_YET_AVAILABLE
  out.push(baseMeasurement({
    kind: "dependency_depth", scope: "project", scope_target: "(project)",
    source_path: "(project)", source_hash: inputHash,
    state: "NOT_MEASURED", value: null,
    methodology: "would delegate to project_architecture_intelligence · but the subsystem does NOT currently provide an authoritative dependency-depth field · Code Health refuses to fabricate one",
    tool: "code-health-delegation-adapter", tool_version_override: "0.1.0",
    method_tag: "delegation-target-absent",
    limitations: "Project Architecture v0.1.0 exposes fan_in / fan_out / orphans / cycles / packages · does NOT expose a dependency-depth traversal · Code Health will not implement a hidden second detector",
    reason: "not_authoritatively_provided_by_project_architecture_v0.1.0",
  }));

  // 4) unused_exports — NOT_YET_AVAILABLE
  out.push(baseMeasurement({
    kind: "unused_exports", scope: "project", scope_target: "(project)",
    source_path: "(project)", source_hash: inputHash,
    state: "NOT_MEASURED", value: null,
    methodology: "would delegate to project_architecture_intelligence · but the subsystem does NOT currently provide unused-export detection · orphan(fan_in=0∧fan_out=0) is a distinct concept and MUST NOT be silently reinterpreted as 'unused export'",
    tool: "code-health-delegation-adapter", tool_version_override: "0.1.0",
    method_tag: "delegation-target-absent",
    limitations: "Project Architecture v0.1.0 does NOT compute per-export usage · Code Health will not implement a hidden second detector · a future authorised subsystem must resolve this",
    reason: "not_authoritatively_provided_by_project_architecture_v0.1.0",
  }));

  // 5) test_relationship — NOT_YET_AVAILABLE
  out.push(baseMeasurement({
    kind: "test_relationship", scope: "project", scope_target: "(project)",
    source_path: "(project)", source_hash: inputHash,
    state: "NOT_MEASURED", value: null,
    methodology: "would delegate to a test-relationship subsystem · no such authoritative NEX subsystem exists at Phase 2C · Code Health refuses to infer test coverage or test-to-source mapping",
    tool: "code-health-delegation-adapter", tool_version_override: "0.1.0",
    method_tag: "delegation-target-absent",
    limitations: "no authorised NEX subsystem currently exposes test-relationship data · Code Health MUST NOT claim adequately-tested / under-tested / test coverage",
    reason: "not_authoritatively_provided_by_project_architecture_v0.1.0",
  }));

  return out;
}

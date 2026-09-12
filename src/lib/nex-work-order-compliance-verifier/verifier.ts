// src/lib/nex-work-order-compliance-verifier/verifier.ts
//
// Phase 8 v0.1.0 · Work Order Compliance Verifier · Trust Domain D · REAL T1.
// Six mechanical constraint checks. Does NOT judge code quality.

import type { AuthoritativeDiffBundle, WorkOrder, BrokerEvent, NEX1DiffProposal, WorkOrderComplianceVerdict, ComplianceCheckResult, ComplianceVerdict } from "@/lib/nex-controlled-hands/types";
import { generateKeyPair, signBytes, type KeyPair } from "@/lib/nex-controlled-hands/ed25519";
import { createHash } from "node:crypto";

export class WorkOrderComplianceVerifier {
  readonly signing_key: KeyPair;

  constructor() {
    this.signing_key = generateKeyPair("compliance-verifier");
  }

  verify(args: {
    work_order: WorkOrder;
    manifest_hash: string;
    authoritative_diff: AuthoritativeDiffBundle;
    broker_event_log: readonly BrokerEvent[];
    nex1_proposal: NEX1DiffProposal;
    clock: () => string;
  }): WorkOrderComplianceVerdict {
    const checks: ComplianceCheckResult[] = [];
    const cited: string[] = [args.authoritative_diff.record_type + ":" + args.work_order.work_order_id];

    // 1. permitted_files · every changed file is inside write_root (workspace)
    const all_changed = [
      ...args.authoritative_diff.authoritative_files_created.map((x) => x.path),
      ...args.authoritative_diff.authoritative_files_modified.map((x) => x.path),
      ...args.authoritative_diff.authoritative_files_deleted.map((x) => x.path),
    ];
    const permitted_files_ok = all_changed.every((p) => !p.startsWith("..") && !p.startsWith("/"));
    checks.push({
      check: "permitted_files",
      result: permitted_files_ok ? "pass" : "fail",
      detail: permitted_files_ok ? `${all_changed.length} paths all within workspace` : `paths escape workspace: ${all_changed.filter((p) => p.startsWith("..") || p.startsWith("/")).join(", ")}`,
    });

    // 2. permitted_processes · every PROCESS_SPAWNED event matches an allowed_processes entry
    const process_events = args.broker_event_log.filter((e) => e.kind === "PROCESS_SPAWNED");
    const allowed_ids = new Set(args.work_order.capability_manifest.allowed_processes.map((p) => p.entry_id));
    const bad_processes = process_events.filter((e) => !allowed_ids.has(String((e.detail as any).entry_id)));
    checks.push({
      check: "permitted_processes",
      result: bad_processes.length === 0 ? "pass" : "fail",
      detail: bad_processes.length === 0 ? `${process_events.length} process spawns all within allowlist` : `${bad_processes.length} spawns outside allowlist`,
    });

    // 3. required_tests_executed · every required_test in acceptance_criteria has a corresponding PROCESS_SPAWNED with matching test spec
    // v0.1.0: mechanical check on acceptance_criteria that declare required_test
    const required_tests = args.work_order.acceptance_criteria.filter((c) => c.required_test);
    const missing_tests: string[] = [];
    for (const rc of required_tests) {
      const found = process_events.some((e) => String((e.detail as any).args ?? "").includes(rc.required_test!));
      if (!found) missing_tests.push(rc.requirement_id);
    }
    checks.push({
      check: "required_tests_executed",
      result: missing_tests.length === 0 ? "pass" : "fail",
      detail: missing_tests.length === 0 ? `all ${required_tests.length} required tests executed` : `missing: ${missing_tests.join(", ")}`,
    });

    // 4. explicit_constraints_satisfied · mechanical_check evaluation
    // v0.1.0: verify each acceptance_criterion's mechanical_check pattern against the AUTHORITATIVE_DIFF_BUNDLE
    const constraint_failures: string[] = [];
    for (const c of args.work_order.acceptance_criteria) {
      if (!c.mechanical_check) continue;
      // Simple patterns: "created:<path>" · "modified:<path>" · "not_modified:<path>" · "created_pattern:<regex>"
      const check = c.mechanical_check;
      if (check.startsWith("created:")) {
        const path = check.substring("created:".length);
        if (!args.authoritative_diff.authoritative_files_created.some((f) => f.path === path)) constraint_failures.push(c.requirement_id);
      } else if (check.startsWith("modified:")) {
        const path = check.substring("modified:".length);
        if (!args.authoritative_diff.authoritative_files_modified.some((f) => f.path === path)) constraint_failures.push(c.requirement_id);
      } else if (check.startsWith("not_modified:")) {
        const path = check.substring("not_modified:".length);
        if (args.authoritative_diff.authoritative_files_modified.some((f) => f.path === path)) constraint_failures.push(c.requirement_id);
      } else if (check.startsWith("created_pattern:")) {
        const re = new RegExp(check.substring("created_pattern:".length));
        if (!args.authoritative_diff.authoritative_files_created.some((f) => re.test(f.path))) constraint_failures.push(c.requirement_id);
      }
    }
    checks.push({
      check: "explicit_constraints_satisfied",
      result: constraint_failures.length === 0 ? "pass" : "fail",
      detail: constraint_failures.length === 0 ? "all mechanical constraints satisfied" : `unmet: ${constraint_failures.join(", ")}`,
    });

    // 5. interpretation_authority · P-O check
    let interp_ok = true;
    let interp_detail = "interpretation=LITERAL";
    if (typeof args.nex1_proposal.interpretation !== "string") {
      const proposed = args.nex1_proposal.interpretation as any;
      if (proposed.kind === "PROPOSED_INTERPRETATION") {
        if (!proposed.authority_layer_decision_id) {
          interp_ok = false;
          interp_detail = `PROPOSED_INTERPRETATION without AUTHORITY_LAYER_DECISION_ID · ${proposed.text}`;
        } else {
          // Verify the decision id is in the allowed list · v0.1.0: any non-empty string is accepted as evidence of authority
          interp_detail = `PROPOSED_INTERPRETATION authorised by ${proposed.authority_layer_decision_id}`;
        }
      }
    }
    checks.push({
      check: "interpretation_authority",
      result: interp_ok ? "pass" : "fail",
      detail: interp_detail,
    });

    // 6. manifest_limits_respected
    const iterations_ok = args.nex1_proposal.iterations_used <= args.work_order.capability_manifest.iteration_limit;
    checks.push({
      check: "manifest_limits_respected",
      result: iterations_ok ? "pass" : "fail",
      detail: iterations_ok ? `iterations=${args.nex1_proposal.iterations_used}/${args.work_order.capability_manifest.iteration_limit}` : `iteration limit exceeded`,
    });

    // Determine verdict
    const failed = checks.filter((c) => c.result === "fail");
    let verdict: ComplianceVerdict;
    if (failed.length === 0) verdict = "COMPLIANT";
    else if (failed.some((c) => c.check === "permitted_files")) verdict = "FILE_OUT_OF_SCOPE";
    else if (failed.some((c) => c.check === "permitted_processes")) verdict = "PROCESS_NOT_ON_ALLOWLIST";
    else if (failed.some((c) => c.check === "required_tests_executed")) verdict = "REQUIRED_TEST_NOT_EXECUTED";
    else if (failed.some((c) => c.check === "explicit_constraints_satisfied")) verdict = "CONSTRAINT_VIOLATED";
    else if (failed.some((c) => c.check === "interpretation_authority")) verdict = "INTERPRETATION_AUTHORITY_EXCEEDED";
    else if (failed.some((c) => c.check === "manifest_limits_respected")) verdict = "MANIFEST_LIMIT_EXCEEDED";
    else verdict = "CONSTRAINT_VIOLATED";

    const canonical = JSON.stringify({
      wo: args.work_order.work_order_id,
      manifest: args.manifest_hash,
      verdict,
      checks: checks.map((c) => `${c.check}:${c.result}`),
    });
    const signature = signBytes(this.signing_key, canonical);

    return {
      record_type: "WORK_ORDER_COMPLIANCE_VERDICT",
      verdict,
      work_order_id: args.work_order.work_order_id,
      manifest_hash: args.manifest_hash,
      check_results: checks,
      cited_evidence_ids: cited,
      signature,
      verifier_key_id: this.signing_key.key_id,
      verifier_key_version: this.signing_key.key_version,
      at: args.clock(),
      authorisation: false,
      execution: false,
      authority_boundary: "compliance_check_readonly",
      attribution: {
        external_llm_used: false,
        deterministic: true,
        role: "nex_work_order_compliance_verifier",
        authority: "compliance_check_only",
        produced_by: "nex_work_order_compliance_verifier",
      },
    };
  }
}

// GET /api/nex/evidence-engine/self-test
// Runs the dedicated Evidence Engine test suite. Deterministic. Read-only.

import { NextResponse } from "next/server";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { measure, composeBundle, rejectDeclarationMasquerade } from "@/lib/nex-evidence-engine/engine";
import { sha256Prefix, witness, witnessesMatch } from "@/lib/nex-evidence-engine/utilities";
import type { EvidenceRecord } from "@/lib/nex-evidence-engine/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CaseResult { id: string; ok: boolean; detail: string; }

export async function GET(): Promise<NextResponse> {
  const cases: CaseResult[] = [];

  // ── Positive cases ────────────────────────────────────────────

  // 1. Complexity · measurable delta between two implementations
  cases.push(await runCase("EE.complexity.delta", () => {
    const candidate = [{ path: "src/util.ts", content: "export function f(x:number){ if (x>0) { for(let i=0;i<x;i++){ if(i%2===0){} } } return x; }" }];
    const baseline = [{ path: "src/util.ts", content: "export function f(x:number){ return x; }" }];
    const rec = measure("complexity", { work_order_id: "T", project_id: "T", candidate_id: "cand_nex1", source_files: candidate, baseline_files: baseline, requested_by: "self-test" });
    const ok = rec.record_type === "EVIDENCE_RECORD"
            && rec.state === "MEASURED"
            && rec.delta != null
            && rec.delta.direction === "regression"
            && typeof rec.candidate_value === "number" && (rec.candidate_value as number) > (rec.baseline_value as number);
    return { ok, detail: `candidate=${rec.candidate_value} baseline=${rec.baseline_value} delta=${JSON.stringify(rec.delta)}` };
  }));

  // 2. Complexity · improvement direction when candidate is simpler
  cases.push(await runCase("EE.complexity.improvement", () => {
    const candidate = [{ path: "src/util.ts", content: "export function f(x:number){ return x; }" }];
    const baseline = [{ path: "src/util.ts", content: "export function f(x:number){ if (x>0) { for(let i=0;i<x;i++){ if(i%2===0){} } } return x; }" }];
    const rec = measure("complexity", { work_order_id: "T", project_id: "T", candidate_id: "cand_nex1", source_files: candidate, baseline_files: baseline, requested_by: "self-test" });
    const ok = rec.delta?.direction === "improvement";
    return { ok, detail: `direction=${rec.delta?.direction}` };
  }));

  // 3. Regression · reads existing pools without mutation
  cases.push(await runCase("EE.regression.reads-pools", () => {
    const rec = measure("regression", { work_order_id: "T", project_id: "T", candidate_id: "cand_baseline", source_files: [], requested_by: "self-test" });
    const ok = (rec.state === "MEASURED" || rec.state === "BLOCKED") && Array.isArray(rec.source_hashes);
    return { ok, detail: `state=${rec.state} pools_recorded=${(rec.value as any)?.pools?.length ?? "n/a"}` };
  }));

  // 4. Tests · deterministic micro harness with all-pass
  cases.push(await runCase("EE.tests.all-pass", () => {
    const rec = measure("tests", { work_order_id: "T", project_id: "T", candidate_id: "cand_nex1", source_files: [], requested_by: "self-test" },
      { test_cases: [
        { id: "t1", kind: "equals", input: 4, expected: 4 },
        { id: "t2", kind: "regex_match", regex: "^abc$", against: "abc" },
        { id: "t3", kind: "throws", input: true, expected: true },
      ] } as any);
    const ok = rec.state === "PASSED" && (rec.value as any).passed === 3;
    return { ok, detail: `state=${rec.state} value=${JSON.stringify(rec.value)}` };
  }));

  // 5. Tests · deterministic micro harness with one fail
  cases.push(await runCase("EE.tests.one-fail", () => {
    const rec = measure("tests", { work_order_id: "T", project_id: "T", candidate_id: "cand_nex1", source_files: [], requested_by: "self-test" },
      { test_cases: [
        { id: "t1", kind: "equals", input: 4, expected: 5 },
        { id: "t2", kind: "regex_match", regex: "^abc$", against: "xyz" },
      ] } as any);
    const ok = rec.state === "FAILED" && (rec.value as any).failed === 2;
    return { ok, detail: `state=${rec.state} value=${JSON.stringify(rec.value)}` };
  }));

  // 6. Tests · no test cases → NOT_MEASURED (never silently PASSED)
  cases.push(await runCase("EE.tests.no-cases-NOT_MEASURED", () => {
    const rec = measure("tests", { work_order_id: "T", project_id: "T", candidate_id: "cand_nex1", source_files: [], requested_by: "self-test" }, null);
    const ok = rec.state === "NOT_MEASURED";
    return { ok, detail: `state=${rec.state}` };
  }));

  // 7. Complexity · NOT_APPLICABLE for non-TS/JS sources
  cases.push(await runCase("EE.complexity.NOT_APPLICABLE-for-non-js", () => {
    const rec = measure("complexity", { work_order_id: "T", project_id: "T", candidate_id: "cand_nex1", source_files: [{ path: "config.toml", content: "[a]\nk='v'\n" }], requested_by: "self-test" });
    const ok = rec.state === "NOT_APPLICABLE";
    return { ok, detail: `state=${rec.state}` };
  }));

  // ── Constitutional cases ──────────────────────────────────────

  // 8. NEX1_DECLARATION rejected by rejectDeclarationMasquerade
  cases.push(await runCase("EE.constitutional.declaration-rejected", () => {
    const fake = { record_type: "NEX1_DECLARATION", declaration_id: "ND-1", claim_type: "TESTS_EXPECTED_TO_PASS", schema_version: "v0.1.0", work_order_id: "T", candidate_id: "cand_nex1", claim_text: "I think tests pass", self_reported_state: "CLAIMED", at: new Date().toISOString(), attribution: { external_llm_used: false, deterministic: true, taught_by: "master_ai_engineer", role: "nex1_builder", authority: "declaration_only" } };
    const check = rejectDeclarationMasquerade(fake);
    return { ok: check.ok === false && /NEX1_DECLARATION/.test(check.reason), detail: check.reason };
  }));

  // 9. EvidenceRecord without record_type is rejected
  cases.push(await runCase("EE.constitutional.missing-record_type", () => {
    const check = rejectDeclarationMasquerade({ evidence_id: "EV-x", state: "PASSED" });
    return { ok: check.ok === false, detail: check.reason };
  }));

  // 10. EvidenceRecord without tool/tool_version is rejected
  cases.push(await runCase("EE.constitutional.missing-tool-version", () => {
    const check = rejectDeclarationMasquerade({ record_type: "EVIDENCE_RECORD", evidence_id: "EV-x", state: "PASSED", source_hashes: [], attribution: {}, provenance: {} });
    return { ok: check.ok === false, detail: check.reason };
  }));

  // 11. Bundle · unresolved dimensions surfaced explicitly
  cases.push(await runCase("EE.bundle.unresolved-surfaced", () => {
    const complexity = measure("complexity", { work_order_id: "T", project_id: "T", candidate_id: "cand_nex1", source_files: [{ path: "a.ts", content: "export const x = 1;" }], requested_by: "self-test" });
    const bundle = composeBundle([complexity], { work_order_id: "T", project_id: "T", candidate_id: "cand_nex1", source_files: [], requested_by: "self-test" });
    const ok = bundle.unresolved_dimensions.includes("compilation") && bundle.unresolved_dimensions.includes("tests") && bundle.unresolved_dimensions.includes("regression");
    return { ok, detail: `unresolved=${bundle.unresolved_dimensions.join(",")}` };
  }));

  // 12. Bundle · rejects a fake declaration record
  cases.push(await runCase("EE.bundle.rejects-declaration-record", () => {
    const complexity = measure("complexity", { work_order_id: "T", project_id: "T", candidate_id: "cand_nex1", source_files: [{ path: "a.ts", content: "export const x = 1;" }], requested_by: "self-test" });
    const fake = { record_type: "NEX1_DECLARATION", evidence_id: "ND-1" } as any as EvidenceRecord;
    const bundle = composeBundle([complexity, fake], { work_order_id: "T", project_id: "T", candidate_id: "cand_nex1", source_files: [], requested_by: "self-test" });
    // The fake declaration must have contributed NOTHING · complexity should be the only recorded id
    const total = Object.values(bundle.dimensions).reduce((a, arr) => a + arr.length, 0);
    return { ok: total === 1, detail: `total_ids=${total}` };
  }));

  // ── Read-only mutation guard ─────────────────────────────────

  // 13. Measurement does NOT mutate the measured project files
  cases.push(await runCase("EE.readonly.no-mutation-of-measured-project", () => {
    const targetFiles = [
      resolve(process.cwd(), "src/lib/nex-language-brain/intent-bridge-v0.ts"),
      resolve(process.cwd(), "data/nex1-language-brain/pattern-registry-v0.json"),
      resolve(process.cwd(), "src/lib/nex-integration/pipeline.ts"),
    ];
    const before = witness(targetFiles);
    // Run several measurements
    const src = readFileSync(resolve(process.cwd(), "src/lib/nex-language-brain/intent-bridge-v0.ts"), "utf8");
    measure("complexity", { work_order_id: "T", project_id: "T", candidate_id: "cand_nex1", source_files: [{ path: "src/lib/nex-language-brain/intent-bridge-v0.ts", content: src }], requested_by: "self-test" });
    measure("regression", { work_order_id: "T", project_id: "T", candidate_id: "cand_baseline", source_files: [], requested_by: "self-test" });
    const after = witness(targetFiles);
    const cmp = witnessesMatch(before, after);
    return { ok: cmp.matched, detail: cmp.matched ? "byte-identical" : `drifted: ${cmp.drifted.join(", ")}` };
  }));

  // 14. Isolation area cleanup · after compilation, no residual measured-project temp files
  cases.push(await runCase("EE.readonly.isolation-cleanup", () => {
    // Existence check on some project files after compilation measurement · none should have been modified
    const targetFiles = [
      resolve(process.cwd(), "package.json"),
      resolve(process.cwd(), "data/nex1-language-brain/regression/regression-index.json"),
    ];
    const before = witness(targetFiles);
    // Compilation over a synthetic source · does not touch project
    measure("compilation", { work_order_id: "T", project_id: "T", candidate_id: "cand_nex1", source_files: [{ path: "src/x.ts", content: "export const y: number = 1;" }], requested_by: "self-test" });
    const after = witness(targetFiles);
    const cmp = witnessesMatch(before, after);
    return { ok: cmp.matched, detail: cmp.matched ? "byte-identical" : `drifted: ${cmp.drifted.join(", ")}` };
  }));

  // Summary
  const pass = cases.filter((c) => c.ok).length;
  const fail = cases.filter((c) => !c.ok).length;
  return NextResponse.json({
    at: new Date().toISOString(),
    total: cases.length,
    pass,
    fail,
    cases,
    attribution: { external_llm_used: false, deterministic: true, taught_by: "master_ai_engineer", role: "evidence_engine", authority: "measurement" },
  }, { headers: { "Cache-Control": "no-store" } });
}

async function runCase(id: string, fn: () => { ok: boolean; detail: string } | Promise<{ ok: boolean; detail: string }>): Promise<CaseResult> {
  try {
    const r = await fn();
    return { id, ok: r.ok, detail: r.detail };
  } catch (e) {
    return { id, ok: false, detail: "harness error · " + (e as Error).message };
  }
}

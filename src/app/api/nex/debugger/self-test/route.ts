// GET /api/nex/debugger/self-test
// 20+ adversarial + constitutional test cases for Debugger + Evidence Validation.
// Read-only. Deterministic. Never mutates.

import { NextResponse } from "next/server";
import { performDiagnosis, walkForForbiddenVocab } from "@/lib/nex-debugger/debugger";
import { registerFixture, clearFixtures, type ReproductionFixture, type ReproductionObservation } from "@/lib/nex-debugger/reproducer";
import { validateEvidence } from "@/lib/nex-evidence-validation/validator";
import type { DebuggerEvidence, CoverageEntry, SourceSnapshot } from "@/lib/nex-debugger/types";
import type { SpecialistRecordShape } from "@/lib/nex-evidence-validation/types";
import { createHash } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Case { id: string; ok: boolean; detail: string; }

function sh(s: string): string { return createHash("sha256").update(s).digest("hex").slice(0, 16); }

// ─── Fixtures ────────────────────────────────────────────────────

function setupFixtures(): void {
  clearFixtures();

  // Fixture 1: always fails deterministically at step 2 · state hashes deterministic per input+seed
  registerFixture({
    id: "fx.always_fails",
    run(input, seed): ReproductionObservation {
      const ops = ["init", "load", "process", "finalise"];
      const stateHashes = ops.map((op, i) => sh(seed + ":" + op + ":" + JSON.stringify(input) + ":" + i));
      return {
        failed: true,
        kind: "assertion_failure",
        observed_output: { file: "src/foo.ts", line: 42, message: "assert failed" },
        stack_trace_hash: sh("stack:" + seed),
        step_operations: ops,
        step_state_hashes: stateHashes,
        failure_step_index: 2,
      };
    },
  });

  // Fixture 2: never fails (used for NOT_REPRODUCIBLE test)
  registerFixture({
    id: "fx.never_fails",
    run(_input, _seed): ReproductionObservation {
      return { failed: false, kind: "no_failure_observed" };
    },
  });

  // Fixture 3: reduces cleanly under ddmin · fails whenever "bad_op" is present
  registerFixture({
    id: "fx.ddmin_reducible",
    run(input: any, seed): ReproductionObservation {
      const ops: readonly string[] = Array.isArray(input?.ops) ? input.ops : ["a", "b", "bad_op", "c", "d", "e"];
      const failed = ops.includes("bad_op");
      const stateHashes = ops.map((op, i) => sh(seed + ":" + op + ":" + i));
      return {
        failed,
        kind: failed ? "wrong_output" : "no_failure_observed",
        observed_output: failed ? { file: "src/bar.ts", line: 7, ops: ops.slice() } : undefined,
        step_operations: ops.slice(),
        step_state_hashes: stateHashes,
        failure_step_index: failed ? ops.indexOf("bad_op") : undefined,
      };
    },
  });

  // Fixture 4: fails but state hashes match expected timeline (no divergence)
  registerFixture({
    id: "fx.matches_expected",
    run(input, seed): ReproductionObservation {
      const ops = ["init", "load", "process"];
      const stateHashes = ops.map((op, i) => "EXPECTED_" + i);
      return {
        failed: true,
        kind: "exception",
        observed_output: { file: "src/baz.ts", line: 10 },
        step_operations: ops,
        step_state_hashes: stateHashes,
        failure_step_index: 2,
      };
    },
  });
}

// ─── Test cases ──────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  setupFixtures();
  const cases: Case[] = [];

  // 1. Clear root cause · SBFL top matches AST-diff churn → ROOT_CAUSE_SUPPORTED
  cases.push(await runCase("DBG.clear-root-cause-SUPPORTED", () => {
    const coverage: CoverageEntry[] = [
      { test_id: "t1", passed: false, executed_locations: ["src/foo.ts::42", "src/foo.ts::10"] },
      { test_id: "t2", passed: false, executed_locations: ["src/foo.ts::42"] },
      { test_id: "t3", passed: true,  executed_locations: ["src/foo.ts::10", "src/bar.ts::1"] },
    ];
    const baseline: SourceSnapshot[] = [{ path: "src/foo.ts", content: "export function f(){ return 1; }\n" }];
    const candidate: SourceSnapshot[] = [{ path: "src/foo.ts", content: "export function f(){ /*L2*/\n /*L3*/\n /*L4*/\n /*L5*/\n /*L6*/\n /*L7*/\n /*L8*/\n /*L9*/\n /*L10*/\n /*L11*/\n /*L12*/\n /*L13*/\n /*L14*/\n /*L15*/\n /*L16*/\n /*L17*/\n /*L18*/\n /*L19*/\n /*L20*/\n /*L21*/\n /*L22*/\n /*L23*/\n /*L24*/\n /*L25*/\n /*L26*/\n /*L27*/\n /*L28*/\n /*L29*/\n /*L30*/\n /*L31*/\n /*L32*/\n /*L33*/\n /*L34*/\n /*L35*/\n /*L36*/\n /*L37*/\n /*L38*/\n /*L39*/\n /*L40*/\n /*L41*/\n /*L42*/\n return 2; }\n" }];
    const r = performDiagnosis({
      failing_input: "x",
      reproduction_fixture_id: "fx.always_fails",
      coverage,
      baseline_sources: baseline,
      candidate_sources: candidate,
      seed: "seed-1",
    });
    return { ok: r.outcome === "ROOT_CAUSE_SUPPORTED" && r.authoritative_top_candidate !== null && r.authoritative_top_candidate.confidence_class === "strong", detail: `outcome=${r.outcome} confidence_class=${r.authoritative_top_candidate?.confidence_class}` };
  }));

  // 2. SBFL top does NOT intersect AST-diff → ROOT_CAUSE_PLAUSIBLE
  cases.push(await runCase("DBG.sbfl-only-PLAUSIBLE", () => {
    const coverage: CoverageEntry[] = [
      { test_id: "t1", passed: false, executed_locations: ["src/foo.ts::42"] },
      { test_id: "t2", passed: true,  executed_locations: ["src/foo.ts::99"] },
    ];
    // AST-diff includes an unrelated file so no intersection
    const baseline: SourceSnapshot[] = [{ path: "src/unrelated.ts", content: "export const x = 1;\n" }];
    const candidate: SourceSnapshot[] = [{ path: "src/unrelated.ts", content: "export const x = 2;\n" }];
    const r = performDiagnosis({
      failing_input: "x",
      reproduction_fixture_id: "fx.always_fails",
      coverage,
      baseline_sources: baseline,
      candidate_sources: candidate,
      seed: "seed-2",
    });
    return { ok: r.outcome === "ROOT_CAUSE_PLAUSIBLE" && r.authoritative_top_candidate?.confidence_class === "plausible", detail: `outcome=${r.outcome}` };
  }));

  // 3. Ambiguous causes · SBFL yields no top candidate → ROOT_CAUSE_UNRESOLVED (first-class success)
  cases.push(await runCase("DBG.ambiguous-ROOT_CAUSE_UNRESOLVED", () => {
    // Coverage where every location has zero failing coverage → SBFL top_candidate=null
    const coverage: CoverageEntry[] = [
      { test_id: "t1", passed: true, executed_locations: ["src/foo.ts::42"] },
      { test_id: "t2", passed: true, executed_locations: ["src/foo.ts::10"] },
    ];
    const r = performDiagnosis({
      failing_input: "x",
      reproduction_fixture_id: "fx.always_fails",
      coverage,
      seed: "seed-3",
    });
    return { ok: r.outcome === "ROOT_CAUSE_UNRESOLVED" && r.authoritative_top_candidate === null, detail: `outcome=${r.outcome} top=${r.authoritative_top_candidate?.candidate_id ?? "null"}` };
  }));

  // 4. Not reproducible · fixture never fails → NOT_REPRODUCIBLE (first-class success)
  cases.push(await runCase("DBG.NOT_REPRODUCIBLE-first-class-success", () => {
    const r = performDiagnosis({
      failing_input: "x",
      reproduction_fixture_id: "fx.never_fails",
      seed: "seed-4",
    });
    return { ok: r.outcome === "NOT_REPRODUCIBLE" && r.reproduction.attempted && !r.reproduction.reproduced, detail: `outcome=${r.outcome}` };
  }));

  // 5. Broken fixture id · INSUFFICIENT_EVIDENCE
  cases.push(await runCase("DBG.broken-fixture-INSUFFICIENT_EVIDENCE", () => {
    const r = performDiagnosis({
      failing_input: "x",
      reproduction_fixture_id: "fx.does_not_exist",
      seed: "seed-5",
    });
    return { ok: r.outcome === "INSUFFICIENT_EVIDENCE", detail: `outcome=${r.outcome}` };
  }));

  // 6. LLM boundary breach → INSUFFICIENT_EVIDENCE
  cases.push(await runCase("DBG.llm-attempt-INSUFFICIENT_EVIDENCE", () => {
    const r = performDiagnosis({
      failing_input: "x",
      reproduction_fixture_id: "fx.always_fails",
      seed: "seed-6",
      reject_llm_attempt: true,
    });
    return { ok: r.outcome === "INSUFFICIENT_EVIDENCE" && /LLM/.test(r.outcome_reason), detail: `outcome=${r.outcome}` };
  }));

  // 7. ddmin reduces successfully
  cases.push(await runCase("DBG.ddmin-reduces-successfully", () => {
    const r = performDiagnosis({
      failing_input: { ops: ["a","b","bad_op","c","d","e"] },
      reproduction_fixture_id: "fx.ddmin_reducible",
      seed: "seed-7",
    });
    return { ok: r.minimised_repro !== null && (r.minimised_repro.reduction_ratio > 0 || r.minimised_repro.ddmin_iterations > 0), detail: `minimised=${r.minimised_repro ? `ratio=${r.minimised_repro.reduction_ratio.toFixed(2)} iter=${r.minimised_repro.ddmin_iterations}` : "null"}` };
  }));

  // 8. Failure timeline records steps + first-divergence when expected differs
  cases.push(await runCase("DBG.first-divergence-detected", () => {
    // Expected timeline says state after step 1 should be "EXPECTED_1" but fixture will emit "EXPECTED_1"
    // We deliberately mismatch step 0 to trigger divergence
    const r = performDiagnosis({
      failing_input: "x",
      reproduction_fixture_id: "fx.matches_expected",
      seed: "seed-8",
      expected_timeline: {
        steps: [
          { step_index: 0, expected_state_hash: "DIFFERENT_FROM_ACTUAL" },
          { step_index: 1, expected_state_hash: "EXPECTED_1" },
          { step_index: 2, expected_state_hash: "EXPECTED_2" },
        ],
      },
    });
    return { ok: r.failure_timeline?.first_divergence !== null && r.failure_timeline?.first_divergence?.step_index === 0, detail: `first_divergence step_index=${r.failure_timeline?.first_divergence?.step_index}` };
  }));

  // 9. No first-divergence when expected matches actual
  cases.push(await runCase("DBG.no-divergence-when-expected-matches", () => {
    const r = performDiagnosis({
      failing_input: "x",
      reproduction_fixture_id: "fx.matches_expected",
      seed: "seed-9",
      expected_timeline: {
        steps: [
          { step_index: 0, expected_state_hash: "EXPECTED_0" },
          { step_index: 1, expected_state_hash: "EXPECTED_1" },
          { step_index: 2, expected_state_hash: "EXPECTED_2" },
        ],
      },
    });
    return { ok: r.failure_timeline?.first_divergence === null, detail: `first_divergence=${r.failure_timeline?.first_divergence ? "present" : "null"}` };
  }));

  // 10. Symptom-vs-cause discrimination · symptom_frame is captured separately from root cause location
  cases.push(await runCase("DBG.symptom-vs-cause-discrimination", () => {
    const coverage: CoverageEntry[] = [
      { test_id: "t1", passed: false, executed_locations: ["src/foo.ts::42"] },
      { test_id: "t2", passed: true,  executed_locations: ["src/foo.ts::99"] },
    ];
    const baseline: SourceSnapshot[] = [{ path: "src/foo.ts", content: "export function f(){ return 1; }\n" }];
    const candidate: SourceSnapshot[] = [{ path: "src/foo.ts", content: "export function f(){ /*L2*/\n /*L3*/\n /*L4*/\n /*L5*/\n /*L6*/\n /*L7*/\n /*L8*/\n /*L9*/\n /*L10*/\n /*L11*/\n /*L12*/\n /*L13*/\n /*L14*/\n /*L15*/\n /*L16*/\n /*L17*/\n /*L18*/\n /*L19*/\n /*L20*/\n /*L21*/\n /*L22*/\n /*L23*/\n /*L24*/\n /*L25*/\n /*L26*/\n /*L27*/\n /*L28*/\n /*L29*/\n /*L30*/\n /*L31*/\n /*L32*/\n /*L33*/\n /*L34*/\n /*L35*/\n /*L36*/\n /*L37*/\n /*L38*/\n /*L39*/\n /*L40*/\n /*L41*/\n /*L42*/\n return 2; }\n" }];
    const r = performDiagnosis({
      failing_input: "x",
      reproduction_fixture_id: "fx.always_fails",  // symptom_frame will be src/foo.ts:42 per fixture
      coverage,
      baseline_sources: baseline,
      candidate_sources: candidate,
      seed: "seed-10",
    });
    const cand = r.authoritative_top_candidate;
    // The candidate has both a location AND a distinct symptom_frame field
    return { ok: cand !== null && cand.symptom_frame.file === "src/foo.ts" && cand.symptom_frame.line === 42 && cand.location.path === "src/foo.ts", detail: `symptom=${cand?.symptom_frame.file}:${cand?.symptom_frame.line} cause=${cand?.location.path}:${cand?.location.line}` };
  }));

  // 11. Determinism · two runs of the same diagnosis yield identical determinism_witness first_run_hash
  cases.push(await runCase("DBG.deterministic-idempotent", () => {
    const params = {
      failing_input: "x",
      reproduction_fixture_id: "fx.always_fails",
      seed: "seed-11",
    };
    const r1 = performDiagnosis(params);
    const r2 = performDiagnosis(params);
    return { ok: r1.failure_timeline?.determinism_witness.first_run_hash === r2.failure_timeline?.determinism_witness.first_run_hash, detail: `r1=${r1.failure_timeline?.determinism_witness.first_run_hash} r2=${r2.failure_timeline?.determinism_witness.first_run_hash}` };
  }));

  // 12. Attribution correct · authority=descriptive_read_only · produced_by=nex_debugger_evidence_specialist
  cases.push(await runCase("DBG.attribution-locked", () => {
    const r = performDiagnosis({ failing_input: "x", reproduction_fixture_id: "fx.always_fails", seed: "seed-12" });
    const ok = r.attribution.role === "nex_debugger_evidence_specialist"
      && r.attribution.authority === "descriptive_read_only"
      && r.attribution.produced_by === "nex_debugger_evidence_specialist"
      && r.attribution.external_llm_used === false
      && r.attribution.deterministic === true
      && r.authorisation === false
      && r.execution === false
      && r.authority_boundary === "evidence_producer_only";
    return { ok, detail: `authority=${r.attribution.authority} produced_by=${r.attribution.produced_by} boundary=${r.authority_boundary}` };
  }));

  // 13. Constitutional · no forbidden vocabulary anywhere
  cases.push(await runCase("DBG.constitutional.no-forbidden-vocabulary", () => {
    const r = performDiagnosis({ failing_input: "x", reproduction_fixture_id: "fx.always_fails", seed: "seed-13" });
    const chk = walkForForbiddenVocab(r);
    return { ok: !chk.hit, detail: chk.hit ? `HIT '${chk.word}' at ${chk.where}` : "clean · full-tree walk found zero" };
  }));

  // 14. Ordinal confidence_class only · never a percent or numeric score field
  cases.push(await runCase("DBG.ordinal-confidence-only", () => {
    const coverage: CoverageEntry[] = [
      { test_id: "t1", passed: false, executed_locations: ["src/foo.ts::42"] },
      { test_id: "t2", passed: true,  executed_locations: ["src/foo.ts::99"] },
    ];
    const r = performDiagnosis({
      failing_input: "x",
      reproduction_fixture_id: "fx.always_fails",
      coverage,
      seed: "seed-14",
    });
    const allowed = new Set(["strong","plausible","weak","insufficient"]);
    const ok = r.root_cause_candidates.every(c => allowed.has(c.confidence_class)) && r.root_cause_candidates.every(c => !("confidence_percent" in (c as any)) && !("confidence_score" in (c as any)));
    return { ok, detail: `classes: ${r.root_cause_candidates.map(c => c.confidence_class).join(",")}` };
  }));

  // 15. Six outcomes only · no invented outcome ever
  cases.push(await runCase("DBG.only-six-outcomes-emitted", () => {
    const allowed = new Set(["REPRODUCED","ROOT_CAUSE_SUPPORTED","ROOT_CAUSE_PLAUSIBLE","ROOT_CAUSE_UNRESOLVED","NOT_REPRODUCIBLE","INSUFFICIENT_EVIDENCE"]);
    const params = [
      { failing_input: "a", reproduction_fixture_id: "fx.always_fails",     seed: "s-a" },
      { failing_input: "b", reproduction_fixture_id: "fx.never_fails",      seed: "s-b" },
      { failing_input: "c", reproduction_fixture_id: "fx.ddmin_reducible", seed: "s-c" },
      { failing_input: "d", reproduction_fixture_id: "fx.does_not_exist", seed: "s-d" },
    ];
    const outcomes = params.map(p => performDiagnosis(p).outcome);
    const ok = outcomes.every(o => allowed.has(o));
    return { ok, detail: `outcomes: ${outcomes.join(", ")}` };
  }));

  // ── Evidence Validation self-tests ────────────────────────────

  // 16. Valid Debugger record → VALIDATED
  cases.push(await runCase("EV.debugger-record-VALIDATED", () => {
    const dbg = performDiagnosis({ failing_input: "x", reproduction_fixture_id: "fx.always_fails", seed: "seed-16" });
    const aer = validateEvidence(dbg as unknown as SpecialistRecordShape);
    const allPass = aer.check_results.every(r => r.result === "pass");
    return { ok: aer.validation_verdict === "VALIDATED" && allPass && aer.provenance_chain.fully_resolvable, detail: `verdict=${aer.validation_verdict} · checks=${aer.check_results.map(r=>r.check_id+":"+r.result).join(" ")}` };
  }));

  // 17. Missing schema_version → REJECTED_SCHEMA
  cases.push(await runCase("EV.missing-schema-version-REJECTED_SCHEMA", () => {
    const bad: SpecialistRecordShape = {
      record_type: "SOMETHING",
      attribution: { external_llm_used: false, deterministic: true, role: "x", produced_by: "y", authority: "descriptive_read_only" },
      authorisation: false, execution: false, authority_boundary: "evidence_producer_only",
      reproducibility_information: { command: "x", cwd: "y", env_fingerprint: "z", node_version: "20", platform: "win32" },
      determinism_witness: { first_run_hash: "a", second_run_hash: "a", identical: true },
      byte_identity_witness: {},
      limitations: "a full and meaningful limitations statement",
      at: new Date().toISOString(),
    };
    const aer = validateEvidence(bad);
    return { ok: aer.validation_verdict === "REJECTED_SCHEMA", detail: `verdict=${aer.validation_verdict}` };
  }));

  // 18. external_llm_used=true → REJECTED_REPRODUCIBILITY
  cases.push(await runCase("EV.external-llm-REJECTED_REPRODUCIBILITY", () => {
    const dbg = performDiagnosis({ failing_input: "x", reproduction_fixture_id: "fx.always_fails", seed: "seed-18" });
    const tampered: SpecialistRecordShape = { ...(dbg as unknown as SpecialistRecordShape), attribution: { ...(dbg.attribution as any), external_llm_used: true as unknown as false } };
    const aer = validateEvidence(tampered);
    return { ok: aer.validation_verdict === "REJECTED_REPRODUCIBILITY", detail: `verdict=${aer.validation_verdict}` };
  }));

  // 19. authorisation=true → REJECTED_AUTHORISATION
  cases.push(await runCase("EV.authorisation-true-REJECTED_AUTHORISATION", () => {
    const dbg = performDiagnosis({ failing_input: "x", reproduction_fixture_id: "fx.always_fails", seed: "seed-19" });
    const tampered: SpecialistRecordShape = { ...(dbg as unknown as SpecialistRecordShape), authorisation: true };
    const aer = validateEvidence(tampered);
    return { ok: aer.validation_verdict === "REJECTED_AUTHORISATION", detail: `verdict=${aer.validation_verdict}` };
  }));

  // 20. attribution.authority contains "authoritative" → REJECTED_AUTHORISATION
  cases.push(await runCase("EV.forbidden-authority-REJECTED_AUTHORISATION", () => {
    const dbg = performDiagnosis({ failing_input: "x", reproduction_fixture_id: "fx.always_fails", seed: "seed-20" });
    const tampered: SpecialistRecordShape = { ...(dbg as unknown as SpecialistRecordShape), attribution: { ...(dbg.attribution as any), authority: "authoritative_final" } };
    const aer = validateEvidence(tampered);
    return { ok: aer.validation_verdict === "REJECTED_AUTHORISATION", detail: `verdict=${aer.validation_verdict}` };
  }));

  // 21. missing limitations → REJECTED_SCOPE
  cases.push(await runCase("EV.missing-limitations-REJECTED_SCOPE", () => {
    const dbg = performDiagnosis({ failing_input: "x", reproduction_fixture_id: "fx.always_fails", seed: "seed-21" });
    const tampered: SpecialistRecordShape = { ...(dbg as unknown as SpecialistRecordShape), limitations: "" };
    const aer = validateEvidence(tampered);
    return { ok: aer.validation_verdict === "REJECTED_SCOPE", detail: `verdict=${aer.validation_verdict}` };
  }));

  // 22. missing at (staleness) → REJECTED_STALE
  cases.push(await runCase("EV.missing-at-REJECTED_STALE", () => {
    const dbg = performDiagnosis({ failing_input: "x", reproduction_fixture_id: "fx.always_fails", seed: "seed-22" });
    const tampered: SpecialistRecordShape = { ...(dbg as unknown as SpecialistRecordShape), at: undefined };
    const aer = validateEvidence(tampered);
    return { ok: aer.validation_verdict === "REJECTED_STALE", detail: `verdict=${aer.validation_verdict}` };
  }));

  // 23. Multiple failures → REJECTED_MULTIPLE
  cases.push(await runCase("EV.multiple-failures-REJECTED_MULTIPLE", () => {
    const bad: SpecialistRecordShape = {
      record_type: "BAD",
      // schema_version missing · limitations missing · authorisation wrong · everything wrong
      attribution: { external_llm_used: true as any, deterministic: false as any, role: "", produced_by: "", authority: "authoritative" },
      authorisation: true as any,
      execution: true as any,
      authority_boundary: "",
    };
    const aer = validateEvidence(bad);
    return { ok: aer.validation_verdict === "REJECTED_MULTIPLE", detail: `verdict=${aer.validation_verdict}` };
  }));

  // 24. Validator attribution locked
  cases.push(await runCase("EV.validator-attribution-locked", () => {
    const dbg = performDiagnosis({ failing_input: "x", reproduction_fixture_id: "fx.always_fails", seed: "seed-24" });
    const aer = validateEvidence(dbg as unknown as SpecialistRecordShape);
    const ok = aer.attribution.role === "evidence_validator"
      && aer.attribution.authority === "validation_only"
      && aer.attribution.produced_by === "nex_evidence_validation_layer"
      && aer.attribution.external_llm_used === false
      && aer.attribution.deterministic === true
      && aer.authorisation === false
      && aer.execution === false
      && aer.authority_boundary === "authoritative_evidence_readonly";
    return { ok, detail: `role=${aer.attribution.role} authority=${aer.attribution.authority}` };
  }));

  // 25. Validator produces AER with chain_integrity_hash · deterministic for same input
  cases.push(await runCase("EV.validator-deterministic-integrity-hash", () => {
    const dbg = performDiagnosis({ failing_input: "x", reproduction_fixture_id: "fx.always_fails", seed: "seed-25" });
    const a = validateEvidence(dbg as unknown as SpecialistRecordShape);
    const b = validateEvidence(dbg as unknown as SpecialistRecordShape);
    // chain_integrity_hash depends only on check_id + result sequence · should be identical
    return { ok: a.chain_integrity_hash === b.chain_integrity_hash, detail: `a=${a.chain_integrity_hash} b=${b.chain_integrity_hash}` };
  }));

  const pass = cases.filter(c => c.ok).length;
  const fail = cases.filter(c => !c.ok).length;
  return NextResponse.json({
    at: new Date().toISOString(),
    total: cases.length, pass, fail, cases,
    attribution: { external_llm_used: false, deterministic: true, taught_by: "master_ai_engineer", role: "nex_debugger_evidence_specialist", authority: "descriptive_read_only", produced_by: "nex_debugger_evidence_specialist" },
  }, { headers: { "Cache-Control": "no-store" } });
}

async function runCase(id: string, fn: () => { ok: boolean; detail: string } | Promise<{ ok: boolean; detail: string }>): Promise<Case> {
  try { const r = await fn(); return { id, ok: r.ok, detail: r.detail }; }
  catch (e) { return { id, ok: false, detail: "harness error · " + (e as Error).message }; }
}

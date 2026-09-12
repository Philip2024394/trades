import { NextResponse } from "next/server";
import { performTestEngineerAnalysis, testEngineerVocabGuard } from "@/lib/nex-test-engineer/engine";
import { validateEvidence } from "@/lib/nex-evidence-validation/validator";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cases: { id: string; ok: boolean; detail: string }[] = [];
  const run = (id: string, fn: () => { ok: boolean; detail: string }) => { try { cases.push({ id, ...fn() }); } catch (e) { cases.push({ id, ok: false, detail: "harness: " + (e as Error).message }); } };
  run("TE.probes-held", () => { const r = performTestEngineerAnalysis({ target_scope: "src/x", probe_results: [{ probe_id: "p1", held: true }, { probe_id: "p2", held: true }], seed: "s1" }); return { ok: r.outcome === "PROBES_HELD", detail: "outcome=" + r.outcome }; });
  run("TE.probes-failed", () => { const r = performTestEngineerAnalysis({ target_scope: "src/x", probe_results: [{ probe_id: "p1", held: true }, { probe_id: "p2", held: false, shrunk_input_hash: "abc" }], seed: "s2" }); return { ok: r.outcome === "PROBES_FAILED" && r.counterexamples.length === 1, detail: "outcome=" + r.outcome }; });
  run("TE.mutants-survived", () => { const r = performTestEngineerAnalysis({ target_scope: "src/x", probe_results: [{ probe_id: "p1", held: true }], mutation_results: [{ mutant_id: "m1", killed: false }, { mutant_id: "m2", killed: true }], seed: "s3" }); return { ok: r.outcome === "MUTANTS_SURVIVED", detail: "outcome=" + r.outcome }; });
  run("TE.mutants-killed", () => { const r = performTestEngineerAnalysis({ target_scope: "src/x", probe_results: [{ probe_id: "p1", held: true }], mutation_results: [{ mutant_id: "m1", killed: true }], seed: "s4" }); return { ok: r.outcome === "MUTANTS_KILLED", detail: "outcome=" + r.outcome }; });
  run("TE.mixed", () => { const r = performTestEngineerAnalysis({ target_scope: "src/x", probe_results: [{ probe_id: "p1", held: false, shrunk_input_hash: "z" }], mutation_results: [{ mutant_id: "m1", killed: false }], seed: "s5" }); return { ok: r.outcome === "MIXED", detail: "outcome=" + r.outcome }; });
  run("TE.not-measured", () => { const r = performTestEngineerAnalysis({ target_scope: "src/x", probe_results: [], seed: "s6" }); return { ok: r.outcome === "NOT_MEASURED", detail: "outcome=" + r.outcome }; });
  run("TE.llm-rejected", () => { const r = performTestEngineerAnalysis({ target_scope: "src/x", probe_results: [{ probe_id: "p1", held: true }], seed: "s7", reject_llm_attempt: true }); return { ok: r.outcome === "NOT_MEASURED", detail: "outcome=" + r.outcome }; });
  run("TE.attribution-locked", () => { const r = performTestEngineerAnalysis({ target_scope: "src/x", probe_results: [{ probe_id: "p1", held: true }], seed: "s8" }); return { ok: r.attribution.produced_by === "nex_test_engineer_evidence_specialist" && r.authorisation === false && r.execution === false, detail: "auth=" + r.attribution.authority }; });
  run("TE.no-forbidden-vocab", () => { const r = performTestEngineerAnalysis({ target_scope: "src/x", probe_results: [{ probe_id: "p1", held: true }], seed: "s9" }); const chk = testEngineerVocabGuard.walkForForbiddenVocab(r); return { ok: !chk.hit, detail: chk.hit ? "HIT " + chk.word : "clean" }; });
  run("TE.evidence-validation-passes", () => { const r = performTestEngineerAnalysis({ target_scope: "src/x", probe_results: [{ probe_id: "p1", held: true }], seed: "s10" }); const aer = validateEvidence(r as any); return { ok: aer.validation_verdict === "VALIDATED", detail: aer.validation_verdict }; });
  run("TE.deterministic", () => { const p = { target_scope: "src/x", probe_results: [{ probe_id: "p1", held: true }], seed: "s11" }; const a = performTestEngineerAnalysis(p); const b = performTestEngineerAnalysis(p); return { ok: a.determinism_witness.first_run_hash === b.determinism_witness.first_run_hash, detail: "both=" + a.determinism_witness.first_run_hash }; });
  const pass = cases.filter(c => c.ok).length;
  return NextResponse.json({ at: new Date().toISOString(), total: cases.length, pass, fail: cases.length - pass, cases }, { headers: { "Cache-Control": "no-store" } });
}

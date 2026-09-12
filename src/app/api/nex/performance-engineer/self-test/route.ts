import { NextResponse } from "next/server";
import { performPerformanceAnalysis, performanceVocabGuard } from "@/lib/nex-performance-engineer/engine";
import { validateEvidence } from "@/lib/nex-evidence-validation/validator";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const base = (baselineVals: number[], candVals: number[], noise = 5, min = 3): any => ({ seed: "s", target_scope: "src/x", samples: [{ metric: "cpu_ms_p95", unit: "ms", baseline_values: baselineVals, candidate_values: candVals, noise_floor: noise }], min_sample_count: min, environment_fingerprint: "env1" });

export async function GET() {
  const cases: { id: string; ok: boolean; detail: string }[] = [];
  const run = (id: string, fn: () => { ok: boolean; detail: string }) => { try { cases.push({ id, ...fn() }); } catch (e) { cases.push({ id, ok: false, detail: "harness: " + (e as Error).message }); } };
  run("PERF.improvement", () => { const r = performPerformanceAnalysis(base([100,100,100],[50,50,50])); return { ok: r.outcome === "IMPROVEMENT_MEASURED", detail: r.outcome }; });
  run("PERF.regression", () => { const r = performPerformanceAnalysis(base([50,50,50],[100,100,100])); return { ok: r.outcome === "REGRESSION_MEASURED", detail: r.outcome }; });
  run("PERF.equal-within-noise", () => { const r = performPerformanceAnalysis(base([50,50,50],[52,52,52])); return { ok: r.outcome === "EQUAL_WITHIN_NOISE", detail: r.outcome }; });
  run("PERF.insufficient-samples", () => { const r = performPerformanceAnalysis(base([50],[100],5,3)); return { ok: r.outcome === "INSUFFICIENT_EVIDENCE", detail: r.outcome }; });
  run("PERF.not-measured-empty", () => { const r = performPerformanceAnalysis({ seed: "s", target_scope: "src/x", samples: [], min_sample_count: 3, environment_fingerprint: "env1" }); return { ok: r.outcome === "NOT_MEASURED", detail: r.outcome }; });
  run("PERF.llm-rejected", () => { const r = performPerformanceAnalysis({ ...base([50,50,50],[100,100,100]), reject_llm_attempt: true }); return { ok: r.outcome === "NOT_MEASURED", detail: r.outcome }; });
  run("PERF.attribution", () => { const r = performPerformanceAnalysis(base([50,50,50],[50,50,50])); return { ok: r.attribution.produced_by === "nex_performance_engineer_evidence_specialist", detail: r.attribution.authority }; });
  run("PERF.no-forbidden-vocab", () => { const r = performPerformanceAnalysis(base([50,50,50],[100,100,100])); const chk = performanceVocabGuard.walkForForbiddenVocab(r); return { ok: !chk.hit, detail: chk.hit ? "HIT " + chk.word : "clean" }; });
  run("PERF.evidence-validation-passes", () => { const r = performPerformanceAnalysis(base([50,50,50],[100,100,100])); const aer = validateEvidence(r as any); return { ok: aer.validation_verdict === "VALIDATED", detail: aer.validation_verdict }; });
  run("PERF.deterministic", () => { const p = base([50,50,50],[100,100,100]); const a = performPerformanceAnalysis(p); const b = performPerformanceAnalysis(p); return { ok: a.determinism_witness.first_run_hash === b.determinism_witness.first_run_hash, detail: a.determinism_witness.first_run_hash }; });
  const pass = cases.filter(c => c.ok).length;
  return NextResponse.json({ at: new Date().toISOString(), total: cases.length, pass, fail: cases.length - pass, cases }, { headers: { "Cache-Control": "no-store" } });
}

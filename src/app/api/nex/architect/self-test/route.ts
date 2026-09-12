import { NextResponse } from "next/server";
import { performArchitectAnalysis, architectVocabGuard } from "@/lib/nex-architect/engine";
import { validateEvidence } from "@/lib/nex-evidence-validation/validator";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const baseInput = (): any => ({ seed: "s", pai_report_id: "PA-1", pai_version: "v0.1.0", baseline_cycles: [], candidate_cycles: [], baseline_fan_out: [], candidate_fan_out: [], founder_authored_rules: [], proposed_edges: [] });

export async function GET() {
  const cases: { id: string; ok: boolean; detail: string }[] = [];
  const run = (id: string, fn: () => { ok: boolean; detail: string }) => { try { cases.push({ id, ...fn() }); } catch (e) { cases.push({ id, ok: false, detail: "harness: " + (e as Error).message }); } };
  run("ARCH.fits", () => { const r = performArchitectAnalysis({ ...baseInput(), founder_authored_rules: [{ rule_id: "R1", forbidden_edges: [{ from: "a", to: "b" }] }] }); return { ok: r.outcome === "FITS_INTENDED_ARCHITECTURE", detail: r.outcome }; });
  run("ARCH.boundary-violation", () => { const r = performArchitectAnalysis({ ...baseInput(), founder_authored_rules: [{ rule_id: "R1", forbidden_edges: [{ from: "a", to: "b" }] }], proposed_edges: [{ from: "a", to: "b" }] }); return { ok: r.outcome === "BOUNDARY_VIOLATION", detail: r.outcome }; });
  run("ARCH.cycle-introduced", () => { const r = performArchitectAnalysis({ ...baseInput(), baseline_cycles: [], candidate_cycles: ["c1"] }); return { ok: r.outcome === "CYCLE_INTRODUCED", detail: r.outcome }; });
  run("ARCH.drift", () => { const r = performArchitectAnalysis({ ...baseInput(), founder_authored_rules: [{ rule_id: "R1", max_fan_out: 10 }], baseline_fan_out: [{ node_id: "n1", count: 5 }], candidate_fan_out: [{ node_id: "n1", count: 9 }] }); return { ok: r.outcome === "DRIFT_DETECTED", detail: r.outcome }; });
  run("ARCH.not-measured-no-pai", () => { const r = performArchitectAnalysis({ ...baseInput(), pai_report_id: "" }); return { ok: r.outcome === "NOT_MEASURED", detail: r.outcome }; });
  run("ARCH.llm-rejected", () => { const r = performArchitectAnalysis({ ...baseInput(), reject_llm_attempt: true }); return { ok: r.outcome === "NOT_MEASURED", detail: r.outcome }; });
  run("ARCH.attribution", () => { const r = performArchitectAnalysis(baseInput()); return { ok: r.attribution.produced_by === "nex_architect_evidence_specialist", detail: r.attribution.authority }; });
  run("ARCH.no-forbidden-vocab", () => { const r = performArchitectAnalysis(baseInput()); const chk = architectVocabGuard.walkForForbiddenVocab(r); return { ok: !chk.hit, detail: chk.hit ? "HIT " + chk.word : "clean" }; });
  run("ARCH.evidence-validation-passes", () => { const r = performArchitectAnalysis(baseInput()); const aer = validateEvidence(r as any); return { ok: aer.validation_verdict === "VALIDATED", detail: aer.validation_verdict }; });
  run("ARCH.deterministic", () => { const a = performArchitectAnalysis(baseInput()); const b = performArchitectAnalysis(baseInput()); return { ok: a.determinism_witness.first_run_hash === b.determinism_witness.first_run_hash, detail: a.determinism_witness.first_run_hash }; });
  const pass = cases.filter(c => c.ok).length;
  return NextResponse.json({ at: new Date().toISOString(), total: cases.length, pass, fail: cases.length - pass, cases }, { headers: { "Cache-Control": "no-store" } });
}

import { NextResponse } from "next/server";
import { performDependencyAnalysis, dependencyVocabGuard } from "@/lib/nex-dependency-engineer/engine";
import { validateEvidence } from "@/lib/nex-evidence-validation/validator";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const base = (deps: any[] = []): any => ({ seed: "s", project_scope: "root", deps, licence_allowlist: ["MIT","Apache-2.0"], max_versions_behind: 5 });

export async function GET() {
  const cases: { id: string; ok: boolean; detail: string }[] = [];
  const run = (id: string, fn: () => { ok: boolean; detail: string }) => { try { cases.push({ id, ...fn() }); } catch (e) { cases.push({ id, ok: false, detail: "harness: " + (e as Error).message }); } };
  run("DEP.no-drift", () => { const r = performDependencyAnalysis(base([{ package: "a", current_version: "1.0.0", licence: "MIT" }])); return { ok: r.outcome === "NO_DRIFT_IN_SCOPE", detail: r.outcome }; });
  run("DEP.vulnerable", () => { const r = performDependencyAnalysis(base([{ package: "a", current_version: "1.0.0", licence: "MIT", cves: [{ id: "CVE-1", severity: "high" }] }])); return { ok: r.outcome === "VULNERABLE_DEPENDENCIES", detail: r.outcome }; });
  run("DEP.licence-violation", () => { const r = performDependencyAnalysis(base([{ package: "a", current_version: "1.0.0", licence: "GPL-3.0" }])); return { ok: r.outcome === "LICENCE_VIOLATION", detail: r.outcome }; });
  run("DEP.stale", () => { const r = performDependencyAnalysis(base([{ package: "a", current_version: "1.0.0", latest_version: "2.0.0", licence: "MIT" }])); return { ok: r.outcome === "STALE_DEPENDENCIES", detail: r.outcome }; });
  run("DEP.unused", () => { const r = performDependencyAnalysis(base([{ package: "a", current_version: "1.0.0", licence: "MIT", unused: true }])); return { ok: r.outcome === "UNUSED_DEPENDENCIES", detail: r.outcome }; });
  run("DEP.mixed", () => { const r = performDependencyAnalysis(base([{ package: "a", current_version: "1.0.0", licence: "MIT", cves: [{ id: "CVE-1", severity: "high" }] }, { package: "b", current_version: "1.0.0", licence: "GPL-3.0" }])); return { ok: r.outcome === "MIXED_FINDINGS", detail: r.outcome }; });
  run("DEP.not-measured-empty", () => { const r = performDependencyAnalysis(base([])); return { ok: r.outcome === "NOT_MEASURED", detail: r.outcome }; });
  run("DEP.llm-rejected", () => { const r = performDependencyAnalysis({ ...base([{ package: "a", current_version: "1.0.0", licence: "MIT" }]), reject_llm_attempt: true }); return { ok: r.outcome === "NOT_MEASURED", detail: r.outcome }; });
  run("DEP.attribution", () => { const r = performDependencyAnalysis(base([{ package: "a", current_version: "1.0.0", licence: "MIT" }])); return { ok: r.attribution.produced_by === "nex_dependency_engineer_evidence_specialist", detail: r.attribution.authority }; });
  run("DEP.no-forbidden-vocab", () => { const r = performDependencyAnalysis(base([{ package: "a", current_version: "1.0.0", licence: "MIT" }])); const chk = dependencyVocabGuard.walkForForbiddenVocab(r); return { ok: !chk.hit, detail: chk.hit ? "HIT " + chk.word : "clean" }; });
  run("DEP.evidence-validation-passes", () => { const r = performDependencyAnalysis(base([{ package: "a", current_version: "1.0.0", licence: "MIT" }])); const aer = validateEvidence(r as any); return { ok: aer.validation_verdict === "VALIDATED", detail: aer.validation_verdict }; });
  const pass = cases.filter(c => c.ok).length;
  return NextResponse.json({ at: new Date().toISOString(), total: cases.length, pass, fail: cases.length - pass, cases }, { headers: { "Cache-Control": "no-store" } });
}

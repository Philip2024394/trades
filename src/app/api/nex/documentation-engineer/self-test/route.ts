import { NextResponse } from "next/server";
import { performDocsAnalysis, documentationVocabGuard } from "@/lib/nex-documentation-engineer/engine";
import { validateEvidence } from "@/lib/nex-evidence-validation/validator";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cases: { id: string; ok: boolean; detail: string }[] = [];
  const run = (id: string, fn: () => { ok: boolean; detail: string }) => { try { cases.push({ id, ...fn() }); } catch (e) { cases.push({ id, ok: false, detail: "harness: " + (e as Error).message }); } };
  run("DOC.in-sync", () => { const r = performDocsAnalysis({ seed: "s", scope: "root", api_surface_hash_current: "h1", api_surface_hash_committed: "h1" }); return { ok: r.outcome === "DOCS_IN_SYNC", detail: r.outcome }; });
  run("DOC.api-drift", () => { const r = performDocsAnalysis({ seed: "s", scope: "root", api_surface_hash_current: "h1", api_surface_hash_committed: "h2" }); return { ok: r.outcome === "API_SURFACE_DRIFT", detail: r.outcome }; });
  run("DOC.openapi-drift", () => { const r = performDocsAnalysis({ seed: "s", scope: "root", openapi_diff_findings: 3 }); return { ok: r.outcome === "OPENAPI_DRIFT", detail: r.outcome }; });
  run("DOC.schema-drift", () => { const r = performDocsAnalysis({ seed: "s", scope: "root", schema_drift_findings: 1 }); return { ok: r.outcome === "SCHEMA_DRIFT", detail: r.outcome }; });
  run("DOC.prose-drift", () => { const r = performDocsAnalysis({ seed: "s", scope: "root", prose_symbol_missing_ids: ["fooBar"] }); return { ok: r.outcome === "PROSE_SYMBOL_DRIFT", detail: r.outcome }; });
  run("DOC.tests-gap", () => { const r = performDocsAnalysis({ seed: "s", scope: "root", tests_missing_for_documented: ["fooBar"] }); return { ok: r.outcome === "TESTS_COVERAGE_GAP", detail: r.outcome }; });
  run("DOC.multiple", () => { const r = performDocsAnalysis({ seed: "s", scope: "root", api_surface_hash_current: "h1", api_surface_hash_committed: "h2", openapi_diff_findings: 1 }); return { ok: r.outcome === "MULTIPLE_DRIFTS", detail: r.outcome }; });
  run("DOC.llm-rejected", () => { const r = performDocsAnalysis({ seed: "s", scope: "root", reject_llm_attempt: true }); return { ok: r.outcome === "NOT_MEASURED", detail: r.outcome }; });
  run("DOC.attribution", () => { const r = performDocsAnalysis({ seed: "s", scope: "root" }); return { ok: r.attribution.produced_by === "nex_documentation_engineer_evidence_specialist", detail: r.attribution.authority }; });
  run("DOC.no-forbidden-vocab", () => { const r = performDocsAnalysis({ seed: "s", scope: "root", api_surface_hash_current: "h1", api_surface_hash_committed: "h2" }); const chk = documentationVocabGuard.walkForForbiddenVocab(r); return { ok: !chk.hit, detail: chk.hit ? "HIT " + chk.word : "clean" }; });
  run("DOC.evidence-validation-passes", () => { const r = performDocsAnalysis({ seed: "s", scope: "root" }); const aer = validateEvidence(r as any); return { ok: aer.validation_verdict === "VALIDATED", detail: aer.validation_verdict }; });
  const pass = cases.filter(c => c.ok).length;
  return NextResponse.json({ at: new Date().toISOString(), total: cases.length, pass, fail: cases.length - pass, cases }, { headers: { "Cache-Control": "no-store" } });
}

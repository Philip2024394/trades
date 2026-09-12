import { NextResponse } from "next/server";
import { registerCandidate, transition, listCandidates, clearLabForTests, labIntegrityHash } from "@/lib/nex-lab/engine";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cases: { id: string; ok: boolean; detail: string }[] = [];
  const run = (id: string, fn: () => { ok: boolean; detail: string }) => { try { cases.push({ id, ...fn() }); } catch (e) { cases.push({ id, ok: false, detail: "harness: " + (e as Error).message }); } };
  clearLabForTests();
  const c = registerCandidate("test pattern", "ref-1");
  run("LAB.register", () => ({ ok: c.state === "DISCOVERED" && c.authorisation === false && c.execution === false, detail: c.state }));
  run("LAB.forward-transition", () => { const r = transition(c.candidate_id, "EVIDENCE_GATHERED"); return { ok: r?.state === "EVIDENCE_GATHERED", detail: r?.state ?? "null" }; });
  run("LAB.no-skip-stages", () => { const r = transition(c.candidate_id, "ADMITTED_TO_STANDARDS_FEED"); return { ok: r === null, detail: r === null ? "correctly refused" : r.state }; });
  run("LAB.no-backwards", () => { const r = transition(c.candidate_id, "DISCOVERED"); return { ok: r === null, detail: r === null ? "correctly refused" : r.state }; });
  run("LAB.rejection-first-class", () => { const c2 = registerCandidate("bad pattern"); const r = transition(c2.candidate_id, "REJECTED"); return { ok: r?.state === "REJECTED", detail: r?.state ?? "null" }; });
  run("LAB.full-lifecycle-forward-only", () => {
    const c3 = registerCandidate("full lifecycle");
    const stages: any[] = ["EVIDENCE_GATHERED","EXPERIMENT_COMPLETE","AWAITING_NEX2","AWAITING_NEX3","AWAITING_FOUNDER","ADMITTED_TO_STANDARDS_FEED"];
    let ok = true;
    for (const s of stages) { const r = transition(c3.candidate_id, s); if (r?.state !== s) { ok = false; break; } }
    return { ok, detail: ok ? "full lifecycle passed" : "lifecycle broke" };
  });
  run("LAB.integrity-hash-deterministic", () => { const h1 = labIntegrityHash(); const h2 = labIntegrityHash(); return { ok: h1 === h2, detail: h1 }; });
  run("LAB.list-preserves", () => { const count = listCandidates().length; return { ok: count >= 3, detail: "count=" + count }; });
  const pass = cases.filter(c => c.ok).length;
  return NextResponse.json({ at: new Date().toISOString(), total: cases.length, pass, fail: cases.length - pass, cases }, { headers: { "Cache-Control": "no-store" } });
}

import { NextResponse } from "next/server";
import { admitStandard, listStandards, clearFeedForTests, feedIntegrityHash, type ApprovedStandard } from "@/lib/nex-standards-feed/engine";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const okStd = (id = "STD-1"): ApprovedStandard => ({
  standard_id: id, title: "T", state: "APPROVED", version: "1.0.0",
  authored_by: "founder", authored_at: new Date().toISOString(),
  scope: "src/*", applicability: ["src/x"], exclusion_list: [],
  cited_evidence_ids: ["AER-1"], arbitration_id: "N3-1",
  rollback_reference: "rev-1",
  provenance_chain: ["specialist","validation","nex2","nex3","founder"],
  founder_authorisation_token: "FA-TOKEN",
});

export async function GET() {
  const cases: { id: string; ok: boolean; detail: string }[] = [];
  const run = (id: string, fn: () => { ok: boolean; detail: string }) => { try { cases.push({ id, ...fn() }); } catch (e) { cases.push({ id, ok: false, detail: "harness: " + (e as Error).message }); } };
  clearFeedForTests();
  run("SF.admit-valid", () => { const r = admitStandard(okStd()); return { ok: r.admitted === true, detail: r.admitted ? "admitted" : r.reason }; });
  run("SF.reject-no-arbitration", () => { const s = { ...okStd("STD-2"), arbitration_id: "" }; const r = admitStandard(s); return { ok: !r.admitted && (r as any).reason.includes("arbitration_id"), detail: (r as any).reason ?? "" }; });
  run("SF.reject-no-founder-token", () => { const s = { ...okStd("STD-3"), founder_authorisation_token: "" }; const r = admitStandard(s); return { ok: !r.admitted, detail: (r as any).reason ?? "" }; });
  run("SF.reject-no-evidence", () => { const s = { ...okStd("STD-4"), cited_evidence_ids: [] }; const r = admitStandard(s); return { ok: !r.admitted, detail: (r as any).reason ?? "" }; });
  run("SF.reject-no-rollback", () => { const s = { ...okStd("STD-5"), rollback_reference: "" }; const r = admitStandard(s); return { ok: !r.admitted, detail: (r as any).reason ?? "" }; });
  run("SF.reject-broken-provenance", () => { const s = { ...okStd("STD-6"), provenance_chain: ["specialist"] }; const r = admitStandard(s); return { ok: !r.admitted, detail: (r as any).reason ?? "" }; });
  run("SF.append-only-blocks-mutation", () => { admitStandard({ ...okStd("STD-7") }); const r = admitStandard({ ...okStd("STD-7"), title: "MUTATED" }); return { ok: !r.admitted, detail: (r as any).reason ?? "" }; });
  run("SF.integrity-hash-deterministic", () => { const h1 = feedIntegrityHash(); const h2 = feedIntegrityHash(); return { ok: h1 === h2, detail: h1 }; });
  run("SF.list-preserves-history", () => { const count = listStandards().length; return { ok: count >= 2, detail: "count=" + count }; });
  const pass = cases.filter(c => c.ok).length;
  return NextResponse.json({ at: new Date().toISOString(), total: cases.length, pass, fail: cases.length - pass, cases }, { headers: { "Cache-Control": "no-store" } });
}

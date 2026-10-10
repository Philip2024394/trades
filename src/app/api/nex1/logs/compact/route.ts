// POST /api/nex1/logs/compact
//
// Compacts append-only JSONL logs · rewrites each as one line per
// current-state entry. Match_count history + dismiss/undismiss history
// are LOST by design · this is the trade the founder chooses when they
// hit compact.
//
// Body (optional): { "scope": "paraphrase" | "dismissals" | "all" }
// Default scope is "all".
//
// Returns a receipt per touched log showing before/after byte + event counts.
// Deterministic · zero LLM · no external process.

import { NextResponse } from "next/server";
import { compactParaphraseLog } from "@/lib/nex-agent/language/capability-paraphrase-persistence";
import { compactDismissalLog } from "@/lib/nex-agent/code-engine/capability-banner-dismissals-persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body { scope?: "paraphrase" | "dismissals" | "all" }

export async function POST(req: Request) {
  let body: Body = {};
  try { body = await req.json(); } catch { /* default scope */ }
  const scope = body.scope ?? "all";
  const results: Record<string, unknown> = {};
  if (scope === "paraphrase" || scope === "all") {
    results.paraphrase = compactParaphraseLog();
  }
  if (scope === "dismissals" || scope === "all") {
    results.dismissals = compactDismissalLog();
  }
  const allOk = Object.values(results).every((r) => {
    if (typeof r === "object" && r !== null && "ok" in r) return (r as { ok: boolean }).ok;
    return true;
  });
  return NextResponse.json({ ok: allOk, source: "NEX1_NATIVE", zero_llm: true, scope, results });
}

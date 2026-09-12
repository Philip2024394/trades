// GET /api/nex/origin-canon/status
// Public-safe canon projection · founder-authorised · Lab-internal viewing.
// RESTRICTED_CANON semantic_meanings are redacted at the projection layer.

import { NextResponse } from "next/server";
import { loadCanon, loadKnowledgeStates, loadHistoricalLayers, publicSafeProjection } from "@/lib/nex-origin-canon/canon-store";
import { listRules } from "@/lib/nex-origin-canon/origin-protection-classifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const canon = loadCanon();
  return NextResponse.json({
    canon_version: canon.canon_version,
    authored_at: canon.authored_at,
    total_claims: canon.claims.length,
    counts_by_status: countBy(canon.claims.map((c) => c.status)),
    counts_by_knowledge_state: countBy(canon.claims.map((c) => c.knowledge_state)),
    counts_by_layer: countBy(canon.claims.map((c) => `L${c.layer}`)),
    knowledge_states: loadKnowledgeStates(),
    historical_layers: loadHistoricalLayers(),
    origin_protection_rules_count: listRules().length,
    projection: publicSafeProjection(),
    taught_by: "master_ai_engineer",
    at: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}

function countBy(arr: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of arr) out[v] = (out[v] ?? 0) + 1;
  return out;
}

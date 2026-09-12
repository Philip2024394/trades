// src/app/api/nex/trust-score/[entity_ref]/route.ts
//
// Founder Phase 6 · P6-5 · NEX Trust Score endpoint.
// GET /api/nex/trust-score/[entity_ref] returns composite trust score
// from measured signals only. Read-only. Zero side effects.

import { NextResponse } from "next/server";
import { computeTrustScore } from "@/lib/nex/trust-score";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ entity_ref: string }> }) {
  const params = await ctx.params;
  const raw = params?.entity_ref ? decodeURIComponent(params.entity_ref) : "";
  if (!raw) return NextResponse.json({ error: "entity_ref_required" }, { status: 400 });
  try {
    const detail = await computeTrustScore(raw);
    return NextResponse.json({
      generated_at: new Date().toISOString(),
      trust_score: detail,
      doctrine_ref: "docs/DECISIONS/0120-nex-live-chat-completion-brain-architecture-and-four-doctrines.md",
      note: "Composite trust score in [0..1] from measured signals only. Zero fabrication. See supporting_data for the numbers behind each component.",
    });
  } catch (e) {
    return NextResponse.json({
      error: "trust_score_error",
      detail: e instanceof Error ? e.message.slice(0, 200) : "unknown",
    }, { status: 500 });
  }
}

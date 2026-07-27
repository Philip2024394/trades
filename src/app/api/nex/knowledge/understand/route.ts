// POST /api/nex/knowledge/understand
//
// Phase 2 of the NEX Knowledge Engine Roadmap. Takes a user query,
// decomposes it into intent fragments, combines evidence across
// multiple manifest rows, and returns a Gold-Standard response that
// NEVER says "0 results found" — always demonstrates understanding.
//
// Per ADR-0034: "The user must never feel that NEX does not understand
// their request." Per ADR-0035: reads ALL bands by default; caller
// filters by min_band when they want quality-only.

import { NextResponse } from "next/server";
import { decomposeQuery, combineEvidence } from "@/lib/nex/knowledge/queryDecomposer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let payload: { query?: string; min_band?: string; max_evidence?: number };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const query = (payload.query ?? "").trim();
  if (!query) {
    return NextResponse.json({ ok: false, error: "query_required" }, { status: 400 });
  }

  const understanding = decomposeQuery(query);
  const answer = await combineEvidence(understanding, {
    minBand: payload.min_band,
    maxEvidence: payload.max_evidence ?? 8,
  });

  return NextResponse.json({ ok: true, ...answer });
}

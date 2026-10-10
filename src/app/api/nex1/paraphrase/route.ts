// /api/nex1/paraphrase · C2 diagnostic surface · 2026-09-17.
//
// GET  ?q=<message>         → returns lookup result (hit or null)
// GET                        → returns full library snapshot
// POST { source, target_slug, provenance, kind? } → upsert a paraphrase entry
//
// Zero LLM · deterministic · in-memory (Phase 1). Persistence is future work.

import { NextResponse } from "next/server";
import {
  addParaphrase, lookupParaphrase, snapshotParaphrases,
} from "@/lib/nex-agent/language/capability-paraphrase-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  if (q) {
    const hit = lookupParaphrase(q);
    return NextResponse.json({
      ok: true,
      source: "NEX1_NATIVE",
      zero_llm: true,
      query: q,
      hit,
    });
  }
  const snap = snapshotParaphrases();
  return NextResponse.json({
    ok: true,
    source: "NEX1_NATIVE",
    zero_llm: true,
    ...snap,
  });
}

interface PostBody {
  source?: string;
  target_slug?: string;
  provenance?: string;
  kind?: "seed" | "founder_correction" | "harvested" | "manual";
}

export async function POST(req: Request) {
  let body: PostBody = {};
  try { body = await req.json(); } catch { /* empty */ }
  const source = typeof body.source === "string" ? body.source : "";
  const target_slug = typeof body.target_slug === "string" ? body.target_slug : "";
  const provenance = typeof body.provenance === "string" ? body.provenance : "";
  const kind = (body.kind === "seed" || body.kind === "founder_correction" || body.kind === "harvested" || body.kind === "manual")
    ? body.kind : "manual";
  if (!source || !target_slug || !provenance) {
    return NextResponse.json({ ok: false, error: "source + target_slug + provenance all required" }, { status: 400 });
  }
  try {
    const entry = addParaphrase({ source, target_slug, kind, provenance });
    return NextResponse.json({ ok: true, entry });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message.slice(0, 200) }, { status: 500 });
  }
}

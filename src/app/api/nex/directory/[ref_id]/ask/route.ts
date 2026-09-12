// src/app/api/nex/directory/[ref_id]/ask/route.ts
//
// Founder Phase 28 · P28-2 · Fast-info-finder endpoint.
// POST { question, language?, scan_site? }

import { NextResponse } from "next/server";
import { askListing } from "@/lib/nex/directory/ask";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ ref_id: string }> }) {
  const { ref_id } = await ctx.params;
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty body */ }
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question || question.length > 500) {
    return NextResponse.json({ error: "invalid_question" }, { status: 400 });
  }
  const language = typeof body.language === "string" ? body.language : "en";
  const scan_site = body.scan_site !== false;
  const out = await askListing({
    ref_id: decodeURIComponent(ref_id),
    question, language, scan_site,
  });
  if (!out) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({
    ...out,
    doctrine_note: "Doctrine #6 · Truth or Unconfirmed · answer sourced from structured NEX fields + optional honesty audit. Never fabricated. Unverified segments are labeled.",
  });
}

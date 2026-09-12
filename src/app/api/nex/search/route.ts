// src/app/api/nex/search/route.ts
//
// Founder Phase 26 · P26-1 · NEX Search endpoint.
//
// GET  ?q=&limit=&verified_only=&city=
// POST { q, limit?, verified_only?, city? }
//
// Every result carries a Doctrine #6 label · this is the surface that
// makes "verified vs unconfirmed" visible outside the chat pipeline.

import { NextResponse } from "next/server";
import { search } from "@/lib/nex/search";

export const runtime = "nodejs";

function coerceBool(v: string | null | undefined): boolean {
  if (!v) return false;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ error: "missing_query" }, { status: 400 });
  const out = await search({
    q,
    limit: Number(url.searchParams.get("limit") ?? 12),
    verified_only: coerceBool(url.searchParams.get("verified_only")),
    city: url.searchParams.get("city"),
  });
  return NextResponse.json({
    ...out,
    doctrine_note: "Doctrine #6 · Truth or Unconfirmed · every result carries verified|unconfirmed classification. NEX never presents unconfirmed results as fact.",
  });
}

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty body */ }
  const q = typeof body.q === "string" ? body.q.trim() : "";
  if (!q) return NextResponse.json({ error: "missing_query" }, { status: 400 });
  const out = await search({
    q,
    limit: typeof body.limit === "number" ? body.limit : 12,
    verified_only: body.verified_only === true,
    city: typeof body.city === "string" ? body.city : null,
  });
  return NextResponse.json({
    ...out,
    doctrine_note: "Doctrine #6 · Truth or Unconfirmed · every result carries verified|unconfirmed classification. NEX never presents unconfirmed results as fact.",
  });
}

// src/app/api/nex/directory/route.ts
//
// Founder Phase 27 · P27-2 · Directory landscape cards endpoint.
//
// GET  ?q=&limit=&verified_only=&city=
// POST { q, limit?, verified_only?, city? }

import { NextResponse } from "next/server";
import { getDirectoryCards } from "@/lib/nex/directory";

export const runtime = "nodejs";

function coerceBool(v: string | null | undefined): boolean {
  if (!v) return false;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

const DOCTRINE_NOTE =
  "Doctrine #6 · Truth or Unconfirmed · every card carries verified|unconfirmed chip + trust_layer badge. NEX never presents unverified listings as fact.";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ error: "missing_query" }, { status: 400 });
  const out = await getDirectoryCards({
    q,
    limit: Number(url.searchParams.get("limit") ?? 18),
    verified_only: coerceBool(url.searchParams.get("verified_only")),
    city: url.searchParams.get("city"),
  });
  return NextResponse.json({ ...out, doctrine_note: DOCTRINE_NOTE });
}

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty body */ }
  const q = typeof body.q === "string" ? body.q.trim() : "";
  if (!q) return NextResponse.json({ error: "missing_query" }, { status: 400 });
  const out = await getDirectoryCards({
    q,
    limit: typeof body.limit === "number" ? body.limit : 18,
    verified_only: body.verified_only === true,
    city: typeof body.city === "string" ? body.city : null,
  });
  return NextResponse.json({ ...out, doctrine_note: DOCTRINE_NOTE });
}

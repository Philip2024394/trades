// src/app/api/nex/lab/language-room/countries/route.ts
//
// GET /api/nex/lab/language-room/countries
// Returns the founder-authored country candidate table. Read-only.
// Country ≠ language (country can host multiple languages).

import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const p = resolve(process.cwd(), "data/nex1-language-brain/country-candidates.json");
  const doc = JSON.parse(readFileSync(p, "utf8"));
  return NextResponse.json(doc, { headers: { "Cache-Control": "no-store" } });
}

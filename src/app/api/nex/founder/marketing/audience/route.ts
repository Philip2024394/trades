// POST /api/nex/founder/marketing/audience
//
// Returns audience counts for a Founder-selected country + category + language.
// Never returns email addresses.

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { resolveFounderAuth, assertFounder } from "@/lib/nex/marketing/founder";
import { countAudience } from "@/lib/nex/marketing/member/audience";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
  const body = await req.json().catch(() => ({} as any));
  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  const client = await pool.connect();
  try {
    assertFounder(auth);
    const count = await countAudience(client, {
      country: body.country,
      city: body.city,
      category: body.category,
      language: body.language,
    });
    return NextResponse.json({ ok: true, count });
  } finally {
    client.release();
  }
}

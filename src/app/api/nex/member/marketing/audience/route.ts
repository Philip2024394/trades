// POST /api/nex/member/marketing/audience
//
// Returns audience COUNTS for (country · category · language). Never
// returns contact addresses. Never returns individual contact records.
// Body: { country?, category?, language? }
// Response: AudienceCount (integers + reasons only)

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { resolveMemberAuth, countAudience } from "@/lib/nex/marketing/member";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = resolveMemberAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null) as { country?: string; category?: string; language?: string } | null;
  if (!body) return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });

  const client = await pool.connect();
  try {
    const count = await countAudience(client, {
      country: body.country?.trim() || undefined,
      category: body.category?.trim() || undefined,
      language: body.language?.trim() || undefined,
    });
    return NextResponse.json({ ok: true, count });
  } finally {
    client.release();
  }
}

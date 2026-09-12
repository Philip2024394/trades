import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isFounderRequest(req: Request): boolean {
  const url = new URL(req.url);
  const host = url.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  const cookie = req.headers.get("cookie") ?? "";
  if (cookie.includes("admin_authed=1") || /x-admin-sig|nex_session=/.test(cookie)) return true;
  return false;
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  if (!isFounderRequest(req)) return NextResponse.json({ error: "no_founder_credential" }, { status: 401 });
  const { slug } = await ctx.params;
  const pool = await getPool();
  if (!pool) return NextResponse.json({ error: "postgres_unavailable" }, { status: 500 });
  const c = await pool.connect();
  try {
    const r = await c.query(
      `UPDATE nex.authorization_policy SET active=false, revoked_at=now(), revoked_by='founder', revocation_reason='revoked via UI'
       WHERE slug=$1 AND revoked_at IS NULL RETURNING policy_id`,
      [slug]
    );
    return NextResponse.json({ ok: r.rowCount > 0 });
  } finally { c.release(); }
}

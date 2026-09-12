// POST /api/nex/lab/promotions/:id/rollback
// Body: { rolled_back_at_iso, signature_hmac }
// Requires admin cookie OR NEX_LAB_PROMOTION_TOKEN header.

import { NextResponse } from "next/server";
import { rollbackPromotion } from "@/lib/nex/lab/rollback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadPool() {
  try {
    const { Pool } = await import("pg");
    return new Pool({
      connectionString: process.env.NEX_TAXONOMY_POSTGRES_URL
        ?? process.env.NEX_POSTGRES_URL
        ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev",
      max: 3,
      connectionTimeoutMillis: 5000,
    });
  } catch { return null; }
}

function isAuthed(req: Request): { ok: boolean; user_id: string | null } {
  const cookie = req.headers.get("cookie") ?? "";
  const hasAdmin = /(?:^|;\s*)(x-admin-sig|admin_authed|nex_session)=/i.test(cookie);
  const provided = req.headers.get("x-lab-promotion-token") ?? "";
  const envToken = process.env.NEX_LAB_PROMOTION_TOKEN ?? "";
  const tokenOk = envToken.length >= 16 && provided === envToken;
  return { ok: hasAdmin || tokenOk, user_id: hasAdmin ? "founder_cookie" : (tokenOk ? "token_holder" : null) };
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = isAuthed(request);
  if (!auth.ok) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const { id } = await ctx.params;
  const pool = await loadPool();
  if (!pool) return NextResponse.json({ error: "pg_missing" }, { status: 500 });
  try {
    const body = await request.json().catch(() => null) as {
      signature_hmac?: string;
      rolled_back_at_iso?: string;
    } | null;
    if (!body?.signature_hmac || !body?.rolled_back_at_iso) {
      return NextResponse.json({ error: "missing_fields · signature_hmac + rolled_back_at_iso required" }, { status: 400 });
    }
    const result = await rollbackPromotion(pool, {
      promotion_id: id,
      rolled_back_by_user_id: auth.user_id ?? "founder_cookie",
      rolled_back_at_iso: body.rolled_back_at_iso,
      signature_hmac: body.signature_hmac,
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.startsWith("signature_") || msg === "promotion_not_found" || msg.startsWith("no_rollback_") ? 400
                 : msg.startsWith("cannot_rollback_") ? 409
                 : 500;
    return NextResponse.json({ error: msg }, { status });
  } finally {
    await pool.end().catch(() => { /* ignore */ });
  }
}

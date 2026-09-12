// src/app/api/nex/lab/promotions/[id]/approve/route.ts
//
// POST /api/nex/lab/promotions/:id/approve
// Body: { approved_at_iso, signature_hmac }
// Requires: admin cookie OR NEX_LAB_PROMOTION_TOKEN header.
// Verifies HMAC signature · fires the copy · returns final record.

import { NextResponse } from "next/server";
import { approvePromotion } from "@/lib/nex/lab/promotions";

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
      approved_at_iso?: string;
    } | null;
    if (!body?.signature_hmac || !body?.approved_at_iso) {
      return NextResponse.json({ error: "missing_fields · signature_hmac + approved_at_iso required" }, { status: 400 });
    }
    const record = await approvePromotion(pool, {
      promotion_id: id,
      approved_by_user_id: auth.user_id ?? "founder_cookie",
      approved_at_iso: body.approved_at_iso,
      signature_hmac: body.signature_hmac,
    });
    return NextResponse.json({ ok: true, promotion: record });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.startsWith("signature_") || msg === "promotion_not_found" ? 400
                 : msg.startsWith("already_") ? 409
                 : 500;
    return NextResponse.json({ error: msg }, { status });
  } finally {
    await pool.end().catch(() => { /* ignore */ });
  }
}

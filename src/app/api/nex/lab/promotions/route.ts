// src/app/api/nex/lab/promotions/route.ts
//
// Founder ADR-0304 · Promotion endpoints.
//
//   GET  /api/nex/lab/promotions              → list all (any status)
//   GET  /api/nex/lab/promotions?status=pending → list one status
//   POST /api/nex/lab/promotions              → propose
//   POST /api/nex/lab/promotions/:id/approve  → approve (separate route)
//
// Founder gate: POST requires either the admin cookie OR
// X-Lab-Promotion-Token header matching NEX_LAB_PROMOTION_TOKEN env.
// Zero anon writes.

import { NextResponse } from "next/server";
import { listPromotions, proposePromotion, signPromotionPayload } from "@/lib/nex/lab/promotions";

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

export async function GET(request: Request) {
  const auth = isAuthed(request);
  if (!auth.ok) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const pool = await loadPool();
  if (!pool) return NextResponse.json({ error: "pg_missing" }, { status: 500 });
  const url = new URL(request.url);
  const status = url.searchParams.get("status") as "pending" | "succeeded" | "failed" | "rolled_back" | null;
  try {
    const rows = await listPromotions(pool, status ?? undefined);
    return NextResponse.json({ ts_iso: new Date().toISOString(), status_filter: status, count: rows.length, promotions: rows }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: String(err).slice(0, 200) }, { status: 500 });
  } finally {
    await pool.end().catch(() => { /* ignore */ });
  }
}

export async function POST(request: Request) {
  const auth = isAuthed(request);
  if (!auth.ok) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const pool = await loadPool();
  if (!pool) return NextResponse.json({ error: "pg_missing" }, { status: 500 });
  try {
    const body = await request.json().catch(() => null) as {
      brief_id?: string;
      room_slug?: string;
      target_schema?: string;
      metrics_snapshot?: Record<string, unknown>;
    } | null;
    if (!body?.brief_id || !body?.room_slug || !body?.target_schema) {
      return NextResponse.json({ error: "missing_fields · brief_id, room_slug, target_schema required" }, { status: 400 });
    }
    const result = await proposePromotion(pool, {
      brief_id: body.brief_id,
      room_slug: body.room_slug,
      target_schema: body.target_schema,
      metrics_snapshot: body.metrics_snapshot ?? {},
    });
    // Pre-compute the signature the founder will need to pass to approve.
    let hint = "signature_secret_not_configured";
    try {
      const approved_at_iso = new Date().toISOString();
      const sig = signPromotionPayload({
        brief_id: body.brief_id,
        room_slug: body.room_slug,
        approved_at_iso,
        user_id: auth.user_id ?? "founder_cookie",
      });
      hint = `To approve: POST /api/nex/lab/promotions/${result.promotion_id}/approve with approved_at_iso=${approved_at_iso} and signature_hmac=${sig}`;
    } catch { /* secret missing · leave hint */ }
    return NextResponse.json({ ok: true, promotion_id: result.promotion_id, approval_hint: hint }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err).slice(0, 200) }, { status: 500 });
  } finally {
    await pool.end().catch(() => { /* ignore */ });
  }
}

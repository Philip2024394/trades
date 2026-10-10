// GET /api/nex/unsubscribe/[token]  ·  one-click unsubscribe
// POST /api/nex/unsubscribe/[token] ·  RFC 8058 one-click POST
//
// Adds the email_address to nex.founder_email_suppression so future batches
// filter it out. Real DB write. Idempotent.

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function processUnsubscribe(token: string) {
  const pool = await getPool();
  if (!pool) return { ok: false, error: "database_unavailable", email: null };
  const client = await pool.connect();
  try {
    const rec = await client.query(
      `SELECT r.recipient_id, r.email_address, r.batch_id
         FROM nex.founder_email_recipient r
        WHERE r.unsubscribe_token = $1
        LIMIT 1`,
      [token],
    );
    if (rec.rowCount === 0) return { ok: false, error: "unknown_token", email: null };
    const { email_address, batch_id } = rec.rows[0];
    await client.query(
      `INSERT INTO nex.founder_email_suppression (email_address, reason, batch_id)
       VALUES ($1, 'unsubscribe', $2)
       ON CONFLICT (email_address) DO UPDATE SET suppressed_at = now()`,
      [email_address, batch_id],
    );
    return { ok: true, error: null, email: email_address };
  } catch (e) {
    return { ok: false, error: (e as Error).message, email: null };
  } finally { client.release(); }
}

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const outcome = await processUnsubscribe(token);
  const html = outcome.ok
    ? `<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribed</title></head>
<body style="font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;padding:40px;background:#f7f7f7">
<div style="max-width:520px;margin:0 auto;background:#fff;padding:32px;border-radius:8px;border:1px solid #e5e5e5">
<h1 style="font-size:18px;margin:0 0 12px">Unsubscribed</h1>
<p style="color:#333">You will no longer receive messages at <b>${outcome.email}</b>.</p>
</div></body></html>`
    : `<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribe error</title></head>
<body style="font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;padding:40px;background:#f7f7f7">
<div style="max-width:520px;margin:0 auto;background:#fff;padding:32px;border-radius:8px;border:1px solid #e5e5e5">
<h1 style="font-size:18px;margin:0 0 12px">Unsubscribe error</h1>
<p style="color:#a11">Reason: ${outcome.error}</p>
</div></body></html>`;
  return new NextResponse(html, {
    status: outcome.ok ? 200 : 404,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function POST(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const outcome = await processUnsubscribe(token);
  return NextResponse.json({ ok: outcome.ok, email: outcome.email, error: outcome.error });
}

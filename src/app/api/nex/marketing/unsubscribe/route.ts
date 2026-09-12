// src/app/api/nex/marketing/unsubscribe/route.ts
//
// GET /api/nex/marketing/unsubscribe?e=<email>&s=<hmac>
// POST /api/nex/marketing/unsubscribe (List-Unsubscribe-Post one-click compliant)
//
// Public route · unauthenticated · HMAC-guarded so recipients can't
// forge each other's unsubs. Every request records to marketing_opt_out
// and flips marketing_contact.opt_out=TRUE. Idempotent.

import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { getPool } from "@/lib/nex/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function verifySig(email: string, sig: string): boolean {
  const secret = process.env.NEX_MARKETING_UNSUB_SECRET ?? process.env.NEX_LAB_PROMOTION_SECRET ?? "";
  if (secret.length < 32) return false;
  const expected = createHmac("sha256", secret).update(email.toLowerCase()).digest("hex").slice(0, 32);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

async function unsubscribe(email: string): Promise<{ ok: boolean; reason?: string }> {
  const pool = await getPool();
  if (!pool) return { ok: false, reason: "postgres_unavailable" };
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(
      `INSERT INTO nex.marketing_opt_out (email, reason, channel) VALUES ($1, 'unsubscribe_link', 'email')
       ON CONFLICT ((LOWER(email))) DO NOTHING`,
      [email]
    );
    await c.query(
      `UPDATE nex.marketing_contact SET opt_out=TRUE, opt_out_at=now(), opt_out_reason='unsubscribe_link'
       WHERE LOWER(email) = LOWER($1)`,
      [email]
    );
    // Also mark any queued sends as skipped
    await c.query(
      `UPDATE nex.marketing_send_queue SET status='skipped_opt_out' WHERE LOWER(email) = LOWER($1) AND status IN ('pending','claimed')`,
      [email]
    );
    // Emit event
    await c.query(
      `INSERT INTO nex.founder_window_event (subsystem, event_kind, status, actor, message, reference)
       VALUES ('notification', 'action_authorized', 'ok', 'unsubscribe_endpoint', $1, $2::jsonb)`,
      [`unsubscribe ${email}`, JSON.stringify({ email })]
    );
    await c.query("COMMIT");
    return { ok: true };
  } catch (err) {
    try { await c.query("ROLLBACK"); } catch { /* ignore */ }
    return { ok: false, reason: String(err).slice(0, 200) };
  } finally { c.release(); }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get("e");
  const sig = url.searchParams.get("s");
  if (!email || !sig) {
    return new NextResponse("Missing parameters.", { status: 400 });
  }
  if (!verifySig(email, sig)) {
    return new NextResponse("Invalid signature. This unsubscribe link is not valid.", { status: 403 });
  }
  const r = await unsubscribe(email);
  if (!r.ok) return new NextResponse(`Unsubscribe failed: ${r.reason}`, { status: 500 });
  return new NextResponse(
    `<!DOCTYPE html><html><body style="font-family:system-ui;max-width:520px;margin:80px auto;padding:24px;text-align:center">
     <h1 style="color:#111">Unsubscribed</h1>
     <p style="color:#666">You will no longer receive marketing emails at ${email}.</p>
     <p style="color:#999;font-size:12px">This action is permanent and immediate.</p>
     </body></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get("e");
  const sig = url.searchParams.get("s");
  if (!email || !sig || !verifySig(email, sig)) {
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 403 });
  }
  const r = await unsubscribe(email);
  return NextResponse.json({ ok: r.ok, reason: r.reason });
}

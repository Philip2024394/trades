// GET  /api/nex/founder/marketing/senders → list Founder-lane senders
// POST /api/nex/founder/marketing/senders → add Founder-lane sender
//
// NEX Email Marketing HQ · Founder Control Centre

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { resolveFounderAuth, listFounderSenders, addFounderSender, FounderAccessError, FounderValidationError } from "@/lib/nex/marketing/founder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  const client = await pool.connect();
  try {
    const senders = await listFounderSenders(client, auth);
    return NextResponse.json({ ok: true, senders });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/does not exist/i.test(msg)) return NextResponse.json({ ok: true, senders: [], warning: "schema_not_applied", detail: msg });
    return NextResponse.json({ ok: false, error: "internal_error", detail: msg }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(req: Request) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  const client = await pool.connect();
  try {
    const sender = await addFounderSender(client, auth, {
      email: String(body.email ?? ""),
      display_name: body.display_name,
      reply_to: body.reply_to,
      sending_domain: body.sending_domain,
      provider: String(body.provider ?? "resend"),
      provider_account_ref: body.provider_account_ref,
      daily_capacity: body.daily_capacity,
      hourly_capacity: body.hourly_capacity,
      capacity_source: String(body.capacity_source ?? ""),
    });
    return NextResponse.json({ ok: true, sender }, { status: 201 });
  } catch (e) {
    if (e instanceof FounderAccessError) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
    if (e instanceof FounderValidationError) return NextResponse.json({ ok: false, error: e.reason, detail: e.detail }, { status: 400 });
    return NextResponse.json({ ok: false, error: "internal_error", detail: String((e as Error).message) }, { status: 500 });
  } finally {
    client.release();
  }
}

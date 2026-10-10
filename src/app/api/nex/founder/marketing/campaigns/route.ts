// GET  /api/nex/founder/marketing/campaigns → list Founder-lane campaigns
// POST /api/nex/founder/marketing/campaigns → create Founder draft

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import {
  resolveFounderAuth, listFounderCampaigns, createFounderDraft,
  FounderAccessError, FounderLaneViolationError, FounderValidationError,
} from "@/lib/nex/marketing/founder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  const client = await pool.connect();
  try {
    const campaigns = await listFounderCampaigns(client, auth);
    return NextResponse.json({ ok: true, campaigns });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/does not exist/i.test(msg)) return NextResponse.json({ ok: true, campaigns: [], warning: "schema_not_applied", detail: msg });
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
    const campaign = await createFounderDraft(client, auth, {
      display_name: String(body.display_name ?? ""),
      subject_line: String(body.subject_line ?? ""),
      preheader: body.preheader,
      from_email: String(body.from_email ?? ""),
      from_name: body.from_name,
      reply_to: body.reply_to,
      content_blocks: body.content_blocks,
      mjml_source: body.mjml_source,
      banner_image_url: body.banner_image_url,
      cta_url: body.cta_url,
      cta_label: body.cta_label,
      footer_text: body.footer_text,
      attachment_urls: body.attachment_urls,
      audience: body.audience ?? {},
      sender_id: String(body.sender_id ?? ""),
      scheduled_for: body.scheduled_for,
    });
    return NextResponse.json({ ok: true, campaign }, { status: 201 });
  } catch (e) {
    if (e instanceof FounderAccessError) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
    if (e instanceof FounderLaneViolationError) return NextResponse.json({ ok: false, error: "lane_violation", detail: e.message }, { status: 403 });
    if (e instanceof FounderValidationError) return NextResponse.json({ ok: false, error: e.reason, detail: e.detail }, { status: 400 });
    return NextResponse.json({ ok: false, error: "internal_error", detail: String((e as Error).message) }, { status: 500 });
  } finally {
    client.release();
  }
}

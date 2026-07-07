// POST /api/inbox/reply
//
// Trade replies to a homeowner brief from the inbox. Verifies the
// inbox token, records the reply on the project via a timeline event,
// and sends the homeowner an email with the reply.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyInboxToken } from "@/lib/inboxToken";
import { notifyHomeownerReply } from "@/lib/projectNotify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  projectId?: string;
  token?: string;
  message?: string;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400 }
    );
  }

  const message = (body.message ?? "").trim();
  if (!body.token || !body.projectId || !message) {
    return NextResponse.json(
      { ok: false, error: "missing_fields" },
      { status: 400 }
    );
  }
  if (message.length > 4000) {
    return NextResponse.json(
      { ok: false, error: "message_too_long" },
      { status: 400 }
    );
  }

  const payload = verifyInboxToken(body.token);
  if (!payload) {
    return NextResponse.json(
      { ok: false, error: "invalid_token" },
      { status: 401 }
    );
  }

  // Confirm this merchant was actually invited to this project — a
  // valid token for a different project is not enough to reply here.
  const { data: participant } = await supabaseAdmin
    .from("os_project_participants")
    .select("id")
    .eq("project_id", body.projectId)
    .eq("business_id", payload.businessId)
    .maybeSingle();

  if (!participant) {
    return NextResponse.json(
      { ok: false, error: "not_invited_to_project" },
      { status: 403 }
    );
  }

  // Load merchant + project + homeowner for the reply email.
  const [{ data: merchant }, { data: project }] = await Promise.all([
    supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("display_name")
      .eq("id", payload.businessId)
      .maybeSingle(),
    supabaseAdmin
      .from("os_projects")
      .select("id, title, primary_party_id, property_id")
      .eq("id", body.projectId)
      .single()
  ]);

  if (!merchant || !project) {
    return NextResponse.json(
      { ok: false, error: "target_missing" },
      { status: 404 }
    );
  }

  const { data: homeowner } = project.primary_party_id
    ? await supabaseAdmin
        .from("os_parties")
        .select("display_name, email")
        .eq("id", project.primary_party_id)
        .maybeSingle()
    : { data: null };

  // Record the reply as a timeline event so both sides see it in
  // their notebooks.
  await supabaseAdmin
    .from("os_home_timeline_events")
    .insert({
      property_id: project.property_id,
      verb: "project.reply",
      subject_type: "project",
      subject_id: project.id,
      headline: `${merchant.display_name} replied to your brief`,
      payload: {
        business_id: payload.businessId,
        merchant_name: merchant.display_name,
        message
      }
    })
    .then(
      () => null,
      () => null
    );

  // Fire email to the homeowner if we have one — non-fatal on failure.
  let emailed = false;
  if (homeowner?.email) {
    emailed = await notifyHomeownerReply({
      homeownerEmail: homeowner.email,
      homeownerName: homeowner.display_name ?? "there",
      merchantName: merchant.display_name,
      projectTitle: project.title,
      message,
      projectId: project.id
    });
  }

  return NextResponse.json({ ok: true, emailed });
}

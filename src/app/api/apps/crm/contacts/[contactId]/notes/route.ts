// POST /api/apps/crm/contacts/[contactId]/notes — merchant logs a
// manual note or interaction (call, WhatsApp sent, meeting).
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdFromRequest } from "@/lib/os/merchantSession";
import { logCrmActivity } from "@/lib/crm/upsertContact";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { kind?: unknown; headline?: unknown; body?: unknown };

const KINDS = new Set([
  "note",
  "call",
  "whatsapp_sent",
  "email_sent",
  "meeting",
  "manual"
]);

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ contactId: string }> }
) {
  const { contactId } = await ctx.params;
  const merchantId = await getMerchantIdFromRequest(null);
  if (!merchantId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }
  const { data: contact } = await supabaseAdmin
    .from("app_crm_contacts")
    .select("id, merchant_id")
    .eq("id", contactId)
    .maybeSingle();
  if (!contact || contact.merchant_id !== merchantId) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const kind = typeof body.kind === "string" && KINDS.has(body.kind) ? body.kind : "note";
  const headline = typeof body.headline === "string" ? body.headline.trim() : "";
  const text = typeof body.body === "string" ? body.body : null;
  if (headline.length < 2) {
    return NextResponse.json({ ok: false, error: "Headline required." }, { status: 400 });
  }
  await logCrmActivity({
    contactId,
    merchantId,
    kind,
    headline,
    body: text
  });
  // If merchant proactively reached out, bump last_touch_at
  if (
    kind === "whatsapp_sent" ||
    kind === "email_sent" ||
    kind === "call" ||
    kind === "meeting"
  ) {
    await supabaseAdmin
      .from("app_crm_contacts")
      .update({ last_touch_at: new Date().toISOString() })
      .eq("id", contactId);
  }
  return NextResponse.json({ ok: true });
}

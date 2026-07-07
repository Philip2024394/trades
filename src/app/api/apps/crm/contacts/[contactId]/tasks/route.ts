// POST /api/apps/crm/contacts/[contactId]/tasks — create a task.
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdFromRequest } from "@/lib/os/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  title?: unknown;
  description?: unknown;
  dueAt?: unknown;
  channelHint?: unknown;
};

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
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (title.length < 2) {
    return NextResponse.json(
      { ok: false, error: "Title required." },
      { status: 400 }
    );
  }
  const dueAt =
    typeof body.dueAt === "string" && !Number.isNaN(Date.parse(body.dueAt))
      ? body.dueAt
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const channelHint =
    typeof body.channelHint === "string" &&
    ["whatsapp", "email", "sms", "call", "in_person"].includes(body.channelHint)
      ? body.channelHint
      : null;
  const { data: task, error } = await supabaseAdmin
    .from("app_crm_tasks")
    .insert({
      contact_id: contactId,
      merchant_id: merchantId,
      title,
      description: typeof body.description === "string" ? body.description : null,
      due_at: dueAt,
      channel_hint: channelHint
    })
    .select("id")
    .single();
  if (error || !task) {
    return NextResponse.json(
      { ok: false, error: "Could not create task." },
      { status: 500 }
    );
  }
  // Reflect next-follow-up on contact
  await supabaseAdmin
    .from("app_crm_contacts")
    .update({ next_follow_up_at: dueAt })
    .eq("id", contactId);
  return NextResponse.json({ ok: true, taskId: task.id });
}

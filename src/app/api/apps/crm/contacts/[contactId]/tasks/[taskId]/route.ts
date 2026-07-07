// PATCH /api/apps/crm/contacts/[contactId]/tasks/[taskId]
//   body: { status: 'completed' | 'cancelled' | 'snoozed', dueAt? }
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdFromRequest } from "@/lib/os/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { status?: unknown; dueAt?: unknown };

const NEXT = new Set(["completed", "cancelled", "snoozed"]);

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ contactId: string; taskId: string }> }
) {
  const { contactId, taskId } = await ctx.params;
  const merchantId = await getMerchantIdFromRequest(null);
  if (!merchantId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }
  const { data: task } = await supabaseAdmin
    .from("app_crm_tasks")
    .select("id, contact_id, merchant_id, status")
    .eq("id", taskId)
    .maybeSingle();
  if (!task || task.merchant_id !== merchantId || task.contact_id !== contactId) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }
  const status = typeof body.status === "string" && NEXT.has(body.status) ? body.status : null;
  const patch: Record<string, unknown> = {};
  if (status) {
    patch.status = status;
    if (status === "completed")
      patch.completed_at = new Date().toISOString();
    if (status === "snoozed" && typeof body.dueAt === "string") {
      patch.due_at = body.dueAt;
      patch.status = "open"; // snooze = reopen at new time
    }
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "Nothing to update." }, { status: 400 });
  }
  await supabaseAdmin.from("app_crm_tasks").update(patch).eq("id", taskId);
  return NextResponse.json({ ok: true });
}

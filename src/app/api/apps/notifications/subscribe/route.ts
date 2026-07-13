// POST /api/apps/notifications/subscribe
// DELETE /api/apps/notifications/subscribe
//
// Client posts the browser PushSubscription JSON. We upsert by endpoint
// so re-subscribing on the same device just refreshes the row.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCurrentTrade } from "@/lib/tradeAuth";
import { loadMerchantSession } from "@/lib/os/merchantSession";

export const dynamic = "force-dynamic";

async function resolveRecipient() {
  const [trade, merchant] = await Promise.all([
    getCurrentTrade().catch(() => null),
    loadMerchantSession().catch(() => null)
  ]);
  if (trade) return { kind: "trade" as const, id: trade.id };
  if (merchant) return { kind: "merchant" as const, id: merchant.merchantId };
  return null;
}

export async function POST(req: Request) {
  const recipient = await resolveRecipient();
  if (!recipient) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const endpoint = String((payload as { endpoint?: string }).endpoint ?? "");
  const keys = (payload as { keys?: { p256dh?: string; auth?: string } }).keys ?? {};
  if (!endpoint || !keys.p256dh || !keys.auth) {
    return NextResponse.json({ error: "invalid_subscription" }, { status: 400 });
  }

  const userAgent = req.headers.get("user-agent") ?? null;

  const { data, error } = await supabaseAdmin
    .from("app_push_subscriptions")
    .upsert(
      {
        recipient_kind: recipient.kind,
        recipient_id:   recipient.id,
        endpoint,
        p256dh:         keys.p256dh,
        auth:           keys.auth,
        user_agent:     userAgent,
        enabled:        true,
        failure_count:  0
      },
      { onConflict: "endpoint" }
    )
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, subscriptionId: data.id });
}

export async function DELETE(req: Request) {
  const recipient = await resolveRecipient();
  if (!recipient) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const url = new URL(req.url);
  const endpoint = url.searchParams.get("endpoint");
  if (!endpoint) return NextResponse.json({ error: "missing_endpoint" }, { status: 400 });

  await supabaseAdmin
    .from("app_push_subscriptions")
    .update({ enabled: false })
    .eq("endpoint", endpoint)
    .eq("recipient_kind", recipient.kind)
    .eq("recipient_id",   recipient.id);
  return NextResponse.json({ ok: true });
}

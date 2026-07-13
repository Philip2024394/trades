// GET /api/apps/notifications
//
// Lists notifications for the current user (trade or merchant).
// Detects the persona from whichever session is active. Client polls
// this endpoint via useNotifications().

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCurrentTrade } from "@/lib/tradeAuth";
import { loadMerchantSession } from "@/lib/os/merchantSession";

export const dynamic = "force-dynamic";

export async function GET() {
  const [trade, merchant] = await Promise.all([
    getCurrentTrade().catch(() => null),
    loadMerchantSession().catch(() => null)
  ]);

  const rows: Array<{ kind: "trade" | "merchant"; id: string; }> = [];
  if (trade)    rows.push({ kind: "trade",    id: trade.id });
  if (merchant) rows.push({ kind: "merchant", id: merchant.merchantId });
  if (rows.length === 0) return NextResponse.json({ notifications: [], unread: 0 });

  const orFilter = rows
    .map((r) => `and(recipient_kind.eq.${r.kind},recipient_id.eq.${r.id})`)
    .join(",");

  const { data, error } = await supabaseAdmin
    .from("app_notifications")
    .select("*")
    .or(orFilter)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const unread = (data ?? []).filter((n) => n.read_at === null).length;
  return NextResponse.json({ notifications: data ?? [], unread });
}

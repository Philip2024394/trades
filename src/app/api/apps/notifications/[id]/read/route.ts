// POST /api/apps/notifications/[id]/read — mark one as read
// POST /api/apps/notifications/read-all (?all=1) — via query param

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCurrentTrade } from "@/lib/tradeAuth";
import { loadMerchantSession } from "@/lib/os/merchantSession";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const [trade, merchant] = await Promise.all([
    getCurrentTrade().catch(() => null),
    loadMerchantSession().catch(() => null)
  ]);
  if (!trade && !merchant) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const nowIso = new Date().toISOString();
  const filters = [] as Array<{ kind: string; id: string }>;
  if (trade)    filters.push({ kind: "trade",    id: trade.id });
  if (merchant) filters.push({ kind: "merchant", id: merchant.merchantId });

  if (id === "all") {
    for (const f of filters) {
      await supabaseAdmin
        .from("app_notifications")
        .update({ read_at: nowIso })
        .eq("recipient_kind", f.kind)
        .eq("recipient_id",   f.id)
        .is("read_at", null);
    }
    return NextResponse.json({ ok: true });
  }

  // Single-notification path — only succeeds if the row belongs to caller
  const orFilter = filters
    .map((f) => `and(recipient_kind.eq.${f.kind},recipient_id.eq.${f.id})`)
    .join(",");
  const { error } = await supabaseAdmin
    .from("app_notifications")
    .update({ read_at: nowIso })
    .eq("id", id)
    .or(orFilter);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

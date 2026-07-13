// PATCH  /api/apps/notebook/basket/[itemKey]  — update qty for one item
// DELETE /api/apps/notebook/basket/[itemKey]  — remove one item

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getTradeSession } from "@/apps/notebook/server/tradeSession";
import { publish } from "@/lib/os/events/bus";

export const dynamic = "force-dynamic";

const TABLE = "app_notebook_quote_basket_items";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ itemKey: string }> }
) {
  const { itemKey } = await ctx.params;
  const { tradeId } = await getTradeSession();
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (payload.qty !== undefined) {
    patch.qty = Math.max(1, Math.min(9999, Number(payload.qty)));
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "empty_patch" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .update(patch)
    .eq("trade_id", tradeId)
    .eq("item_key", decodeURIComponent(itemKey))
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ itemKey: string }> }
) {
  const { itemKey } = await ctx.params;
  const { tradeId } = await getTradeSession();
  const key = decodeURIComponent(itemKey);
  const { error } = await supabaseAdmin
    .from(TABLE)
    .delete()
    .eq("trade_id", tradeId)
    .eq("item_key", key);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await publish({
    eventType:       "notebook.basket.item_removed",
    publisherApp:    "notebook",
    dedupKey:        `notebook-basket-remove-${tradeId}-${key}-${Date.now()}`,
    actorBusinessId: tradeId,
    subjectType:     "notebook_basket_item",
    subjectId:       key,
    payload: { itemKey: key }
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}

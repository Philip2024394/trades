// PATCH  /api/apps/notebook/items/[id]   — edit qty / spec / unit / category
// DELETE /api/apps/notebook/items/[id]   — soft-archive

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getTradeSession } from "@/apps/notebook/server/tradeSession";

export const dynamic = "force-dynamic";

const TABLE = "app_notebook_items";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const { tradeId } = await getTradeSession();
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof payload.productName === "string" && payload.productName.trim()) {
    patch.product_name = payload.productName.trim();
  }
  if (typeof payload.spec === "string") patch.spec = payload.spec.trim() || null;
  if (typeof payload.categorySlug === "string") patch.category_slug = payload.categorySlug.trim() || null;
  if (payload.usualQty !== undefined) patch.usual_qty = Math.max(1, Math.min(9999, Number(payload.usualQty)));
  if (typeof payload.unit === "string" && payload.unit.trim()) patch.unit = payload.unit.trim();
  if (typeof payload.imageUrl === "string") patch.image_url = payload.imageUrl.trim() || null;
  if (typeof payload.sortOrder === "number") patch.sort_order = payload.sortOrder;
  if (payload.lastOrderedIso !== undefined) patch.last_ordered_iso = payload.lastOrderedIso ? String(payload.lastOrderedIso) : null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "empty_patch" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .update(patch)
    .eq("trade_id", tradeId)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const { tradeId } = await getTradeSession();
  const { error } = await supabaseAdmin
    .from(TABLE)
    .update({ archived: true })
    .eq("trade_id", tradeId)
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

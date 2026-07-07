// PUT /api/apps/quote-workspace/[id]/items
//
// Bulk-replaces line items on a quote + recomputes totals. Simpler than
// per-item CRUD when the merchant edits the whole quote in a form.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdFromRequest } from "@/lib/os/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ItemInput = {
  position?: unknown;
  kind?: unknown;
  label?: unknown;
  description?: unknown;
  qty?: unknown;
  unit?: unknown;
  unitPricePence?: unknown;
  sku?: unknown;
};

type Body = {
  items?: unknown;
  vatRate?: unknown; // 0.20 default
  discountPence?: unknown;
};

const KINDS = new Set(["material", "labour", "fee", "discount", "note"]);

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const merchantId = await getMerchantIdFromRequest(null);
  if (!merchantId) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated." },
      { status: 401 }
    );
  }
  const { data: quote } = await supabaseAdmin
    .from("app_quote_workspace_quotes")
    .select("id, merchant_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!quote || quote.merchant_id !== merchantId) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  if (quote.status !== "draft") {
    return NextResponse.json(
      { ok: false, error: "Can only edit items on drafts." },
      { status: 409 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  if (!Array.isArray(body.items)) {
    return NextResponse.json({ ok: false, error: "items must be an array." }, { status: 400 });
  }
  const vatRate =
    typeof body.vatRate === "number" &&
    body.vatRate >= 0 &&
    body.vatRate <= 1
      ? body.vatRate
      : 0.2;
  const discountPence =
    typeof body.discountPence === "number" ? Math.max(0, body.discountPence) : 0;

  const rows: Array<Record<string, unknown>> = [];
  let materialsPence = 0;
  let labourPence = 0;

  body.items.forEach((raw: unknown, idx) => {
    const item = raw as ItemInput;
    const kind = typeof item.kind === "string" ? item.kind : "material";
    if (!KINDS.has(kind)) return;
    const label = typeof item.label === "string" ? item.label.trim() : "";
    if (!label) return;
    const qty = typeof item.qty === "number" && item.qty > 0 ? item.qty : 1;
    const unit = typeof item.unit === "string" ? item.unit : null;
    const unitPrice =
      typeof item.unitPricePence === "number" ? Math.round(item.unitPricePence) : null;
    const total = unitPrice != null ? Math.round(unitPrice * qty) : 0;
    if (kind === "material" || kind === "fee") materialsPence += total;
    if (kind === "labour") labourPence += total;
    if (kind === "discount") materialsPence -= Math.abs(total);
    rows.push({
      quote_id: id,
      position: typeof item.position === "number" ? item.position : idx + 1,
      kind,
      label,
      description:
        typeof item.description === "string" ? item.description : null,
      qty,
      unit,
      unit_price_pence: unitPrice,
      total_pence: total,
      sku: typeof item.sku === "string" ? item.sku : null
    });
  });

  // Recompute totals
  const subtotal = Math.max(0, materialsPence + labourPence - discountPence);
  const vatPence = Math.round(subtotal * vatRate);
  const totalPence = subtotal + vatPence;

  // Replace items
  await supabaseAdmin
    .from("app_quote_workspace_quote_items")
    .delete()
    .eq("quote_id", id);
  if (rows.length > 0) {
    await supabaseAdmin.from("app_quote_workspace_quote_items").insert(rows);
  }
  await supabaseAdmin
    .from("app_quote_workspace_quotes")
    .update({
      materials_pence: Math.max(0, materialsPence),
      labour_pence: labourPence,
      discount_pence: discountPence,
      vat_pence: vatPence,
      total_pence: totalPence
    })
    .eq("id", id);

  return NextResponse.json({
    ok: true,
    totals: {
      materialsPence: Math.max(0, materialsPence),
      labourPence,
      discountPence,
      vatPence,
      totalPence
    }
  });
}

// GET  /api/apps/quote-workspace/[id]  — merchant reads their draft/sent quote
// PATCH /api/apps/quote-workspace/[id] — merchant edits header fields
//         (line-item edits go through /items routes)

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdFromRequest } from "@/lib/os/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadOwned(id: string, merchantId: string) {
  const { data: quote } = await supabaseAdmin
    .from("app_quote_workspace_quotes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!quote || quote.merchant_id !== merchantId) return null;
  return quote;
}

export async function GET(
  _req: NextRequest,
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
  const quote = await loadOwned(id, merchantId);
  if (!quote) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  const [items, events] = await Promise.all([
    supabaseAdmin
      .from("app_quote_workspace_quote_items")
      .select("*")
      .eq("quote_id", id)
      .order("position"),
    supabaseAdmin
      .from("app_quote_workspace_quote_events")
      .select("*")
      .eq("quote_id", id)
      .order("occurred_at", { ascending: false })
      .limit(50)
  ]);
  return NextResponse.json({
    ok: true,
    quote,
    items: items.data || [],
    events: events.data || []
  });
}

type PatchBody = {
  title?: unknown;
  notes?: unknown;
  timelineEstimate?: unknown;
  depositPence?: unknown;
  expiresAt?: unknown;
};

export async function PATCH(
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
  const quote = await loadOwned(id, merchantId);
  if (!quote) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  if (quote.status !== "draft" && quote.status !== "sent") {
    return NextResponse.json(
      { ok: false, error: "Quote is locked in its current state." },
      { status: 409 }
    );
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") patch.title = body.title.trim();
  if (typeof body.notes === "string") patch.notes = body.notes;
  if (typeof body.timelineEstimate === "string")
    patch.timeline_estimate = body.timelineEstimate;
  if (typeof body.depositPence === "number")
    patch.deposit_pence = body.depositPence;
  if (typeof body.expiresAt === "string") patch.expires_at = body.expiresAt;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true, noop: true });
  }
  await supabaseAdmin
    .from("app_quote_workspace_quotes")
    .update(patch)
    .eq("id", id);
  return NextResponse.json({ ok: true });
}

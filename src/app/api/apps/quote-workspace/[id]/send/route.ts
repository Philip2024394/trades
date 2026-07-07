// POST /api/apps/quote-workspace/[id]/send  {channel: 'whatsapp' | 'email'}
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdFromRequest } from "@/lib/os/merchantSession";
import { sendQuote } from "@/lib/quote-workspace/sendQuote";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
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
      { ok: false, error: "Quote already sent." },
      { status: 409 }
    );
  }
  const body = (await req.json().catch(() => ({}))) as {
    channel?: unknown;
  };
  const channel =
    body.channel === "whatsapp" || body.channel === "email"
      ? body.channel
      : null;
  if (!channel) {
    return NextResponse.json(
      { ok: false, error: "channel must be 'whatsapp' or 'email'." },
      { status: 400 }
    );
  }
  const result = await sendQuote({ quoteId: id, channel });
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}

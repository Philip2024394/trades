// GET/POST/DELETE /api/auth/trade/recovery/channels
//
// Manage the current trade's list of backup sign-in channels. Adding a
// channel requires proving the destination via OTP first — this route
// only lists / marks-verified / removes. The OTP-to-verify a new
// recovery channel goes through the standard /otp/send + /otp/verify
// endpoints with `intent: "add-recovery-channel"` on the payload.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCurrentTrade } from "@/lib/tradeAuth";

export const dynamic = "force-dynamic";

const TABLE = "app_trade_recovery_channels";

export async function GET() {
  const trade = await getCurrentTrade();
  if (!trade) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select("id, channel, destination, verified_at, is_primary, created_at")
    .eq("trade_id", trade.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ channels: data ?? [] });
}

export async function POST(req: Request) {
  const trade = await getCurrentTrade();
  if (!trade) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const channel = String(payload.channel ?? "");
  const destination = String(payload.destination ?? "").trim();
  if (!["whatsapp", "sms", "email"].includes(channel)) {
    return NextResponse.json({ error: "invalid_channel" }, { status: 400 });
  }
  if (!destination) return NextResponse.json({ error: "missing_destination" }, { status: 400 });

  // Cap at 2 backup channels + 1 primary
  const { count } = await supabaseAdmin
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("trade_id", trade.id);
  if ((count ?? 0) >= 3) {
    return NextResponse.json({ error: "too_many_channels" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .upsert(
      {
        trade_id:    trade.id,
        channel,
        destination: channel === "email" ? destination.toLowerCase() : destination,
        // Verified must be re-established via OTP after adding
        verified_at: null
      },
      { onConflict: "trade_id,channel,destination" }
    )
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ channel: data });
}

export async function DELETE(req: Request) {
  const trade = await getCurrentTrade();
  if (!trade) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  // Never let a trade remove their last channel — they'd get locked out.
  const { count } = await supabaseAdmin
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("trade_id", trade.id);
  if ((count ?? 0) <= 1) {
    return NextResponse.json({ error: "cannot_remove_last_channel" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from(TABLE)
    .delete()
    .eq("trade_id", trade.id)
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

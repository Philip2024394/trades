// POST /api/trade-off/logout — clears the xrated_trade_session cookie.
// The dashboard's "Log out" button posts here, then the client
// hard-navigates to '/' (or wherever). We always return { ok: true }
// even when there was no cookie; logout is idempotent.
import { NextResponse } from "next/server";
import { clearTradeSessionCookie } from "@/lib/tradeSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true });
  clearTradeSessionCookie(response);
  return response;
}

// GET /api/auth/trade/whoami — cheap session probe for the client guard.

import { NextResponse } from "next/server";
import { getCurrentTrade } from "@/lib/tradeAuth";

export const dynamic = "force-dynamic";

export async function GET() {
  const trade = await getCurrentTrade();
  if (!trade) return NextResponse.json({ authenticated: false });
  return NextResponse.json({
    authenticated:    true,
    tradeId:          trade.id,
    displayName:      trade.displayName,
    tradeDiscipline:  trade.tradeDiscipline,
    homePostcode:     trade.homePostcode,
    identityComplete: trade.identityComplete,
    viewerRole:       trade.viewerRole
  });
}

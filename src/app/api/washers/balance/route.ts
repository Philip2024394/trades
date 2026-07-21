// GET /api/washers/balance
//
// Public thin wrapper — returns { balance: number, autoTopup: boolean }
// for the signed-in merchant. Feeds the wallet-balance chip in the
// AppShell + the Counter composer's boost picker. No PII exposed.

import { NextResponse } from "next/server";
import { getMerchantSlug } from "@/lib/merchantSession";
import { loadWasherBag } from "@/lib/washers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const slug = await getMerchantSlug();
  if (!slug) return NextResponse.json({ balance: 0, autoTopup: false });
  const bag = await loadWasherBag(slug);
  if (!bag) return NextResponse.json({ balance: 0, autoTopup: false });
  return NextResponse.json({
    balance:   bag.balance,
    autoTopup: bag.autoTopup
  });
}

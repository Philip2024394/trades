// GET /api/washers/history?limit=N
//
// Returns the signed-in merchant's most recent washer transactions.
// Feeds the wallet popover in the AppShell header. Read-only, no PII.

import { NextResponse } from "next/server";
import { getMerchantSlug } from "@/lib/merchantSession";
import { loadRecentTransactions } from "@/lib/washers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const slug = await getMerchantSlug();
  if (!slug) return NextResponse.json({ transactions: [] });
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "10"), 50);
  const txs = await loadRecentTransactions(slug, limit);
  return NextResponse.json({ transactions: txs });
}

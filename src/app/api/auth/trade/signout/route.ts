// POST /api/auth/trade/signout — clear the trade's session cookies.

import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/tradeAuth";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}

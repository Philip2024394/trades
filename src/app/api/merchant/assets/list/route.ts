// GET /api/merchant/assets/list
//
// Returns every asset this merchant has generated + counters
// (scan/download counts) + next-free-refresh timestamps for the
// dashboard tabs. Ordered newest first.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const slug = await getMerchantSlug();
  if (!slug) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("hammerex_merchant_assets")
    .select("id, kind, template_slug, headline, refresh_number, created_at, next_free_refresh_at, footer_removed_paid_at, instant_refresh_paid_at, scan_count, download_count")
    .eq("merchant_slug", slug)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, assets: data ?? [] });
}

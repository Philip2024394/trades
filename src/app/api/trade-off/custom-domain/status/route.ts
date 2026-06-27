// GET /api/trade-off/custom-domain/status?slug=…&token=…
// Magic-link authenticated. Cheap status read for the editor's
// 30-second polling loop. Returns the DB-cached status + verification
// records. Does NOT call Vercel — the verify route + the 6-hour
// health-check cron are the only writers.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const slug = (sp.get("slug") ?? "").trim();
  const token = (sp.get("token") ?? "").trim();

  if (!slug || !token) {
    return NextResponse.json(
      { ok: false, error: "Missing slug or token." },
      { status: 400 }
    );
  }

  const row = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select(
      "id, edit_token, custom_domain, custom_domain_apex, custom_domain_status, custom_domain_verification, custom_domain_last_error, custom_domain_last_check_at, custom_domain_verified_at, custom_domain_ssl_verified_at"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!row.data) {
    return NextResponse.json(
      { ok: false, error: "Listing not found." },
      { status: 404 }
    );
  }
  if (!constantTimeEq(row.data.edit_token, token)) {
    return NextResponse.json(
      { ok: false, error: "Invalid edit token." },
      { status: 403 }
    );
  }

  return NextResponse.json({
    ok: true,
    domain: row.data.custom_domain,
    apex: row.data.custom_domain_apex,
    status: row.data.custom_domain_status,
    verification: row.data.custom_domain_verification ?? [],
    last_error: row.data.custom_domain_last_error,
    last_check_at: row.data.custom_domain_last_check_at,
    verified_at: row.data.custom_domain_verified_at,
    ssl_verified_at: row.data.custom_domain_ssl_verified_at
  });
}

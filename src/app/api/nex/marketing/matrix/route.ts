// src/app/api/nex/marketing/matrix/route.ts
//
// GET /api/nex/marketing/matrix
//
// Returns the category × country contact-count matrix. Every count is
// a real Postgres query over nex.marketing_contact excluding opt_out
// and hard_bounced. Zero fabrication.

import { NextResponse } from "next/server";
import { computeCategoryCountryMatrix } from "@/lib/nex/marketing/segments";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isFounderRequest(req: Request): boolean {
  const url = new URL(req.url);
  const host = url.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  const cookie = req.headers.get("cookie") ?? "";
  if (cookie.includes("admin_authed=1") || /x-admin-sig|nex_session=/.test(cookie)) return true;
  const token = req.headers.get("x-hq-token") ?? url.searchParams.get("hq_token");
  const expected = process.env.NEX_HQ_DASHBOARD_TOKEN;
  if (expected && expected.length >= 16 && token && token === expected) return true;
  return false;
}

export async function GET(req: Request) {
  if (!isFounderRequest(req)) return NextResponse.json({ error: "no_founder_credential" }, { status: 401 });
  const t0 = Date.now();
  const matrix = await computeCategoryCountryMatrix();
  return NextResponse.json({
    generated_at: new Date().toISOString(),
    compute_ms: Date.now() - t0,
    ...matrix,
  }, { headers: { "Cache-Control": "no-store" } });
}

// GET /api/affiliates/dashboard/tax-report?year=YYYY
//
// CSV of THIS affiliate's paid commissions for the year. One row per
// commission. Use this as raw evidence for self-assessment.
import { NextResponse, type NextRequest } from "next/server";
import { readAffiliateSession } from "@/lib/affiliateSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = readAffiliateSession(req);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Not signed in." },
      { status: 401 }
    );
  }
  const url = new URL(req.url);
  const yearRaw = Number(url.searchParams.get("year"));
  const year =
    Number.isFinite(yearRaw) && yearRaw > 2020 && yearRaw < 2100
      ? yearRaw
      : new Date().getUTCFullYear();
  const from = new Date(Date.UTC(year, 0, 1)).toISOString();
  const to = new Date(Date.UTC(year + 1, 0, 1)).toISOString();

  const { data: rows } = await supabaseAdmin
    .from("hammerex_affiliate_commissions")
    .select("id, listing_id, amount_pence, currency, paid_at, paid_method, paid_reference")
    .eq("affiliate_id", session.affiliate_id)
    .eq("status", "paid")
    .gte("paid_at", from)
    .lt("paid_at", to)
    .order("paid_at", { ascending: true });

  const header = [
    "commission_id",
    "listing_id",
    "paid_at",
    "amount_gbp",
    "currency",
    "paid_method",
    "paid_reference"
  ]
    .map(csvEscape)
    .join(",");
  const lines = [header];
  let totalPence = 0;
  for (const r of rows ?? []) {
    totalPence += r.amount_pence;
    lines.push(
      [
        r.id,
        r.listing_id,
        r.paid_at ?? "",
        (Number(r.amount_pence) / 100).toFixed(2),
        r.currency,
        r.paid_method ?? "",
        r.paid_reference ?? ""
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  lines.push("");
  lines.push(`Total,,,${(totalPence / 100).toFixed(2)}`);

  return new NextResponse(`${lines.join("\n")}\n`, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="affiliate-${session.affiliate_id}-tax-${year}.csv"`
    }
  });
}

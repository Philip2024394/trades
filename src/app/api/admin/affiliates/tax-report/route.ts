// GET /api/admin/affiliates/tax-report?year=YYYY
//
// CSV of every affiliate's total paid commissions for the year, plus
// their declared country + trading status. One row per affiliate.
import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
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
  if (!(await isAdminAuthed())) {
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 }
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

  const { data: commissions } = await supabaseAdmin
    .from("hammerex_affiliate_commissions")
    .select("affiliate_id, amount_pence")
    .eq("status", "paid")
    .gte("paid_at", from)
    .lt("paid_at", to);
  const tally = new Map<number, number>();
  for (const c of commissions ?? []) {
    tally.set(c.affiliate_id, (tally.get(c.affiliate_id) ?? 0) + c.amount_pence);
  }
  const ids = Array.from(tally.keys());

  const affMap = new Map<
    number,
    {
      first_name: string | null;
      last_name: string | null;
      company_name: string | null;
      country: string | null;
      email: string | null;
    }
  >();
  const pmMap = new Map<
    number,
    { legal_name: string | null; trading_status: string | null }
  >();
  if (ids.length > 0) {
    const { data: affs } = await supabaseAdmin
      .from("hammerex_affiliates")
      .select("affiliate_id, first_name, last_name, company_name, country, email")
      .in("affiliate_id", ids);
    for (const a of affs ?? []) affMap.set(a.affiliate_id, a);
    const { data: pms } = await supabaseAdmin
      .from("hammerex_affiliate_payment_methods")
      .select("affiliate_id, legal_name, trading_status")
      .in("affiliate_id", ids);
    for (const p of pms ?? []) pmMap.set(p.affiliate_id, p);
  }

  const header = [
    "affiliate_id",
    "name",
    "legal_name",
    "country",
    "trading_status",
    "email",
    "total_paid_gbp",
    "year"
  ]
    .map(csvEscape)
    .join(",");
  const lines = [header];
  for (const [id, pence] of tally.entries()) {
    const a = affMap.get(id);
    const p = pmMap.get(id);
    const name =
      [a?.first_name, a?.last_name].filter(Boolean).join(" ") ||
      a?.company_name ||
      `Affiliate ${id}`;
    lines.push(
      [
        id,
        name,
        p?.legal_name ?? "",
        a?.country ?? "",
        p?.trading_status ?? "",
        a?.email ?? "",
        (pence / 100).toFixed(2),
        year
      ]
        .map(csvEscape)
        .join(",")
    );
  }

  return new NextResponse(`${lines.join("\n")}\n`, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="tax-report-${year}.csv"`
    }
  });
}

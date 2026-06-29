// GET /api/admin/affiliates/export
//
// Streams a CSV (we don't have ExcelJS in package.json, so xlsx is
// deferred to Phase 4 — passing format=xlsx falls back to CSV and
// renames the file with the explanatory suffix). Three kinds of
// export:
//
//   kind=commissions  — every commission, filterable by status/period
//   kind=payouts      — every payout
//   kind=affiliates   — every affiliate (no money columns; admin use)
//
// Querystring:
//   format  csv | xlsx  (xlsx returns CSV with .csv-only filename)
//   kind    commissions | payouts | affiliates
//   status  optional — filters commissions/payouts by status
//   period  optional — YYYY-MM, filters by created_at month
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

function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const header = cols.map(csvEscape).join(",");
  const body = rows
    .map((r) => cols.map((c) => csvEscape(r[c])).join(","))
    .join("\n");
  return `${header}\n${body}\n`;
}

function periodBounds(period: string | null): { from: string; to: string } | null {
  if (!period) return null;
  const m = period.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const from = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const to = new Date(Date.UTC(year, month, 1)).toISOString();
  return { from, to };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await isAdminAuthed())) {
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 }
    );
  }
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "commissions";
  const status = url.searchParams.get("status");
  const period = url.searchParams.get("period");
  const window = periodBounds(period);

  let rows: Record<string, unknown>[] = [];
  let filenameStem = "export";

  if (kind === "commissions") {
    let q = supabaseAdmin
      .from("hammerex_affiliate_commissions")
      .select(
        "id, affiliate_id, listing_id, amount_pence, currency, status, created_at, approved_at, paid_at, paid_method, paid_reference, campaign_id"
      )
      .order("created_at", { ascending: false });
    if (status) q = q.eq("status", status);
    if (window) q = q.gte("created_at", window.from).lt("created_at", window.to);
    const { data } = await q;
    rows = (data ?? []).map((r) => ({
      ...r,
      amount_gbp: (Number(r.amount_pence) / 100).toFixed(2)
    }));
    filenameStem = `commissions${status ? `-${status}` : ""}${period ? `-${period}` : ""}`;
  } else if (kind === "payouts") {
    let q = supabaseAdmin
      .from("hammerex_affiliate_payouts")
      .select(
        "id, affiliate_id, total_pence, status, period_month, paid_at, reference, created_at"
      )
      .order("created_at", { ascending: false });
    if (status) q = q.eq("status", status);
    if (period) q = q.eq("period_month", period);
    const { data } = await q;
    rows = (data ?? []).map((r) => ({
      ...r,
      total_gbp: (Number(r.total_pence) / 100).toFixed(2)
    }));
    filenameStem = `payouts${status ? `-${status}` : ""}${period ? `-${period}` : ""}`;
  } else if (kind === "affiliates") {
    const { data } = await supabaseAdmin
      .from("hammerex_affiliates")
      .select(
        "affiliate_id, first_name, last_name, company_name, country, email, whatsapp, level, status, created_at, last_login_at"
      )
      .order("affiliate_id", { ascending: true });
    rows = (data ?? []) as Record<string, unknown>[];
    filenameStem = "affiliates";
  } else {
    return NextResponse.json(
      { ok: false, error: "Unknown kind." },
      { status: 400 }
    );
  }

  const csv = rowsToCsv(rows);
  const filename = `${filenameStem}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "x-export-note":
        url.searchParams.get("format") === "xlsx"
          ? "xlsx requested but ExcelJS not yet installed; CSV returned"
          : "csv"
    }
  });
}

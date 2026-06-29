// GET /api/admin/affiliates/payouts/bank-export?period=YYYY-MM
//
// Emits a Faster Payments style CSV for bulk-payment upload at most
// UK high-street banks. One row per payout for the requested period:
//   Beneficiary Name, Sort Code, Account Number, Amount, Reference
//
// We deliberately only include payouts where the affiliate's payment
// method is "bank" — PayPal / Wise payouts are handled separately by
// the (stubbed) external integrations.
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
  const period =
    url.searchParams.get("period") ?? new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(period)) {
    return NextResponse.json(
      { ok: false, error: "Invalid period (use YYYY-MM)." },
      { status: 400 }
    );
  }

  const { data: payouts } = await supabaseAdmin
    .from("hammerex_affiliate_payouts")
    .select("id, affiliate_id, total_pence, reference, status")
    .eq("period_month", period)
    .in("status", ["pending", "paid"]);

  const ids = (payouts ?? []).map((p) => p.affiliate_id);
  const methods = new Map<
    number,
    {
      legal_name: string;
      bank_account_name: string | null;
      bank_account_number: string | null;
      bank_sort_code: string | null;
      payment_method: string;
    }
  >();
  if (ids.length > 0) {
    const { data: m } = await supabaseAdmin
      .from("hammerex_affiliate_payment_methods")
      .select(
        "affiliate_id, legal_name, bank_account_name, bank_account_number, bank_sort_code, payment_method"
      )
      .in("affiliate_id", ids);
    for (const row of m ?? []) {
      methods.set(row.affiliate_id, row);
    }
  }

  const header = [
    "Beneficiary Name",
    "Sort Code",
    "Account Number",
    "Amount",
    "Reference"
  ]
    .map(csvEscape)
    .join(",");
  const lines = [header];
  let included = 0;
  let skipped = 0;
  for (const p of payouts ?? []) {
    const m = methods.get(p.affiliate_id);
    if (
      !m ||
      m.payment_method !== "bank" ||
      !m.bank_account_number ||
      !m.bank_sort_code
    ) {
      skipped += 1;
      continue;
    }
    const beneficiary =
      m.bank_account_name?.trim() || m.legal_name || `Affiliate ${p.affiliate_id}`;
    const ref = (p.reference ?? `XR${p.affiliate_id}${period.replace("-", "")}`).slice(
      0,
      18
    );
    lines.push(
      [
        beneficiary,
        m.bank_sort_code,
        m.bank_account_number,
        (Number(p.total_pence) / 100).toFixed(2),
        ref
      ]
        .map(csvEscape)
        .join(",")
    );
    included += 1;
  }

  void skipped;
  return new NextResponse(`${lines.join("\n")}\n`, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="bank-export-${period}.csv"`,
      "x-included": String(included),
      "x-skipped": String(skipped)
    }
  });
}

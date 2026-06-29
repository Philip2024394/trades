// Affiliate-side tax report. Lets the signed-in affiliate download a
// CSV of their own paid commissions for any year. Surfaces totals
// per-year on the page.
import { readAffiliateSessionServer } from "@/lib/affiliateSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PageExplainer } from "@/components/xrated/affiliate/PageExplainer";

export const dynamic = "force-dynamic";

function pounds(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

type SearchParams = Promise<{ year?: string }>;

export default async function AffiliateTaxReportPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const session = await readAffiliateSessionServer();
  if (!session) return null;
  const id = session.affiliate_id;

  const sp = await searchParams;
  const yearRaw = Number(sp.year);
  const year =
    Number.isFinite(yearRaw) && yearRaw > 2020 && yearRaw < 2100
      ? yearRaw
      : new Date().getUTCFullYear();

  const { data: rows } = await supabaseAdmin
    .from("hammerex_affiliate_commissions")
    .select("amount_pence, paid_at")
    .eq("affiliate_id", id)
    .eq("status", "paid");

  const totals = new Map<number, number>();
  for (const r of rows ?? []) {
    if (!r.paid_at) continue;
    const y = new Date(r.paid_at).getUTCFullYear();
    totals.set(y, (totals.get(y) ?? 0) + r.amount_pence);
  }
  const yearTotal = totals.get(year) ?? 0;
  const allYears = Array.from(totals.entries()).sort((a, b) => b[0] - a[0]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Tax report</h1>
        <p className="mt-1 text-[13px] text-brand-muted">
          A simple per-year summary of your paid commissions. Use this to
          file your self-assessment or pass to your accountant.
        </p>
      </header>

      <PageExplainer
        title="Year-end summary for your records"
        description="Download a CSV of every commission you earned in the chosen tax year. Use it for your self-assessment or hand it to your accountant. We don't file taxes for you — that's your responsibility."
        steps={[
          "Pick the year",
          "Click Download",
          "Open the CSV in Excel / Google Sheets",
          "Add it to your bookkeeping"
        ]}
      />

      <p className="text-[12px] text-neutral-500">
        Only commissions in the &quot;Paid&quot; status show up here.
        Pending and approved earnings are not yet taxable income.
      </p>

      <section className="rounded-xl border border-brand-line bg-brand-surface p-5">
        <form method="GET" className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-[13px] font-bold text-brand-text">Year</span>
            <input
              type="number"
              name="year"
              min={2020}
              max={2100}
              defaultValue={year}
              className="mt-1 block h-10 w-32 rounded-lg border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text"
            />
          </label>
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-accent px-3 text-[13px] font-bold text-black"
          >
            View
          </button>
          <a
            href={`/api/affiliates/dashboard/tax-report?year=${year}`}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-brand-line bg-brand-bg px-3 text-[13px] font-bold text-brand-text hover:bg-brand-line"
          >
            Download CSV
          </a>
        </form>
        <p className="mt-4 text-[13px] text-brand-muted">
          Total paid for {year}:{" "}
          <strong className="text-brand-accent">{pounds(yearTotal)}</strong>
        </p>
      </section>

      <section className="rounded-xl border border-brand-line bg-brand-surface">
        <table className="min-w-full text-[13px]">
          <thead className="bg-brand-bg/40 text-left text-[13px] uppercase tracking-wider text-brand-muted">
            <tr>
              <th className="px-3 py-2">Year</th>
              <th className="px-3 py-2">Total paid</th>
            </tr>
          </thead>
          <tbody>
            {allYears.map(([y, pence]) => (
              <tr key={y} className="border-t border-brand-line">
                <td className="px-3 py-2 font-mono font-bold">{y}</td>
                <td className="px-3 py-2 font-bold text-brand-accent">
                  {pounds(pence)}
                </td>
              </tr>
            ))}
            {allYears.length === 0 && (
              <tr>
                <td colSpan={2} className="px-3 py-6 text-center text-brand-muted">
                  No paid commissions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

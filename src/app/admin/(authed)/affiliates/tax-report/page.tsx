// Admin — affiliate tax report.
//
// For each affiliate, sum total paid commissions in the requested
// calendar year + show their declared country + trading status.
// Includes a CSV download button.
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ year?: string }>;

function pounds(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

export default async function AdminTaxReportPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const yearRaw = Number(sp.year);
  const year =
    Number.isFinite(yearRaw) && yearRaw > 2020 && yearRaw < 2100
      ? yearRaw
      : new Date().getUTCFullYear();
  const from = new Date(Date.UTC(year, 0, 1)).toISOString();
  const to = new Date(Date.UTC(year + 1, 0, 1)).toISOString();

  const { data: commissions } = await supabaseAdmin
    .from("hammerex_affiliate_commissions")
    .select("affiliate_id, amount_pence, paid_at")
    .eq("status", "paid")
    .gte("paid_at", from)
    .lt("paid_at", to);

  const tally = new Map<number, number>();
  for (const c of commissions ?? []) {
    tally.set(
      c.affiliate_id,
      (tally.get(c.affiliate_id) ?? 0) + c.amount_pence
    );
  }
  const ids = Array.from(tally.keys());
  const detailMap = new Map<
    number,
    {
      name: string;
      country: string | null;
      trading_status: string | null;
      legal_name: string | null;
      email: string | null;
    }
  >();
  if (ids.length > 0) {
    const { data: affs } = await supabaseAdmin
      .from("hammerex_affiliates")
      .select("affiliate_id, first_name, last_name, company_name, country, email")
      .in("affiliate_id", ids);
    for (const a of affs ?? []) {
      const name =
        [a.first_name, a.last_name].filter(Boolean).join(" ") ||
        a.company_name ||
        `Affiliate ${a.affiliate_id}`;
      detailMap.set(a.affiliate_id, {
        name,
        country: a.country,
        trading_status: null,
        legal_name: null,
        email: a.email
      });
    }
    const { data: pms } = await supabaseAdmin
      .from("hammerex_affiliate_payment_methods")
      .select("affiliate_id, trading_status, legal_name")
      .in("affiliate_id", ids);
    for (const p of pms ?? []) {
      const cur = detailMap.get(p.affiliate_id);
      if (cur) {
        cur.trading_status = p.trading_status;
        cur.legal_name = p.legal_name;
      }
    }
  }

  const rows = Array.from(tally.entries())
    .map(([id, pence]) => ({
      affiliate_id: id,
      ...detailMap.get(id),
      total_pence: pence
    }))
    .sort((a, b) => b.total_pence - a.total_pence);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] text-brand-muted">
            <Link href="/admin/affiliates" className="hover:underline">
              &larr; Affiliates
            </Link>
          </p>
          <h1 className="text-2xl font-extrabold">Tax report — {year}</h1>
          <p className="mt-1 text-[13px] text-brand-muted">
            Total paid commissions by affiliate, by calendar year.
          </p>
        </div>
        <form className="flex items-center gap-2" method="GET">
          <input
            type="number"
            name="year"
            min={2020}
            max={2100}
            defaultValue={year}
            className="h-10 w-28 rounded-lg border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text"
          />
          <button
            type="submit"
            className="rounded-lg bg-brand-accent px-3 text-[13px] font-bold text-black"
          >
            View
          </button>
          <a
            href={`/api/admin/affiliates/tax-report?year=${year}`}
            className="rounded-lg border border-brand-line bg-brand-surface px-3 py-1.5 text-[13px] font-bold text-brand-text hover:bg-brand-line"
          >
            Download CSV
          </a>
        </form>
      </header>

      <div className="overflow-x-auto rounded-xl border border-brand-line bg-brand-surface">
        <table className="min-w-full text-[13px]">
          <thead className="bg-brand-bg/40 text-left text-[13px] uppercase tracking-wider text-brand-muted">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Affiliate</th>
              <th className="px-3 py-2">Legal name</th>
              <th className="px-3 py-2">Country</th>
              <th className="px-3 py-2">Trading status</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Total paid</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.affiliate_id} className="border-t border-brand-line">
                <td className="px-3 py-2 font-mono font-bold">
                  #{r.affiliate_id}
                </td>
                <td className="px-3 py-2">{r.name ?? "—"}</td>
                <td className="px-3 py-2">{r.legal_name ?? "—"}</td>
                <td className="px-3 py-2">{r.country ?? "—"}</td>
                <td className="px-3 py-2">{r.trading_status ?? "—"}</td>
                <td className="px-3 py-2">{r.email ?? "—"}</td>
                <td className="px-3 py-2 font-bold text-brand-accent">
                  {pounds(r.total_pence)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-6 text-center text-brand-muted"
                >
                  No paid commissions in {year}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

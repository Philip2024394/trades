// Admin — affiliate list. Sortable table of every affiliate with
// search, signup count, paid count, lifetime earnings.
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string }>;

function pounds(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

export default async function AdminAffiliatesPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  let query = supabaseAdmin
    .from("hammerex_affiliates")
    .select(
      "affiliate_id, first_name, last_name, company_name, whatsapp, country, status, last_login_at, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (q) {
    // Match by numeric ID, whatsapp digits, name fragment.
    const numeric = Number(q.replace(/\D/g, ""));
    if (Number.isFinite(numeric) && numeric > 0) {
      query = query.or(`affiliate_id.eq.${numeric},whatsapp.ilike.%${q.replace(/\D/g, "")}%`);
    } else {
      query = query.or(
        `first_name.ilike.%${q}%,last_name.ilike.%${q}%,company_name.ilike.%${q}%`
      );
    }
  }

  const { data: affs, count } = await query;

  // For each affiliate, count their referred listings + paid + sum of
  // lifetime earnings. Done as a single bulk query then mapped.
  const affiliateIds = (affs ?? []).map((a) => a.affiliate_id);
  const lifetimeMap = new Map<
    number,
    { signups: number; paid: number; lifetime_pence: number }
  >();
  for (const id of affiliateIds) {
    lifetimeMap.set(id, { signups: 0, paid: 0, lifetime_pence: 0 });
  }
  if (affiliateIds.length > 0) {
    const signupsAgg = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("affiliate_referrer_id, tier")
      .in("affiliate_referrer_id", affiliateIds);
    for (const row of signupsAgg.data ?? []) {
      const rec = lifetimeMap.get(row.affiliate_referrer_id);
      if (!rec) continue;
      rec.signups += 1;
      if (row.tier === "app_paid" || row.tier === "app_verified") rec.paid += 1;
    }
    const commAgg = await supabaseAdmin
      .from("hammerex_affiliate_commissions")
      .select("affiliate_id, amount_pence, status")
      .in("affiliate_id", affiliateIds);
    for (const row of commAgg.data ?? []) {
      if (row.status === "approved" || row.status === "paid") {
        const rec = lifetimeMap.get(row.affiliate_id);
        if (rec) rec.lifetime_pence += row.amount_pence;
      }
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Affiliates</h1>
          <p className="text-[13px] text-brand-muted">
            {count ?? 0} affiliates total
          </p>
        </div>
        <nav className="flex flex-wrap gap-2 text-[13px]">
          <Link
            href="/admin/affiliates/commissions"
            className="rounded-lg border border-brand-line bg-brand-surface px-3 py-1.5 font-bold text-brand-text hover:bg-brand-line"
          >
            Commission queue
          </Link>
          <Link
            href="/admin/affiliates/payouts"
            className="rounded-lg border border-brand-line bg-brand-surface px-3 py-1.5 font-bold text-brand-text hover:bg-brand-line"
          >
            Payouts
          </Link>
          <Link
            href="/admin/affiliates/marketing"
            className="rounded-lg border border-brand-line bg-brand-surface px-3 py-1.5 font-bold text-brand-text hover:bg-brand-line"
          >
            Marketing pack
          </Link>
          <Link
            href="/admin/affiliates/reports"
            className="rounded-lg border border-brand-line bg-brand-surface px-3 py-1.5 font-bold text-brand-text hover:bg-brand-line"
          >
            Reports
          </Link>
          <Link
            href="/admin/affiliates/password-recovery"
            className="rounded-lg border border-brand-line bg-brand-surface px-3 py-1.5 font-bold text-brand-text hover:bg-brand-line"
          >
            Password reset
          </Link>
          <Link
            href="/admin/affiliates/campaigns"
            className="rounded-lg border border-brand-line bg-brand-surface px-3 py-1.5 font-bold text-brand-text hover:bg-brand-line"
          >
            Campaigns
          </Link>
          <Link
            href="/admin/affiliates/review-queue"
            className="rounded-lg border border-brand-line bg-brand-surface px-3 py-1.5 font-bold text-brand-text hover:bg-brand-line"
          >
            Review queue
          </Link>
          <Link
            href="/admin/affiliates/tax-report"
            className="rounded-lg border border-brand-line bg-brand-surface px-3 py-1.5 font-bold text-brand-text hover:bg-brand-line"
          >
            Tax report
          </Link>
          <Link
            href="/admin/affiliates/audit-log"
            className="rounded-lg border border-brand-line bg-brand-surface px-3 py-1.5 font-bold text-brand-text hover:bg-brand-line"
          >
            Audit log
          </Link>
        </nav>
      </header>

      <form className="flex gap-2" method="GET">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by ID, WhatsApp, or name…"
          className="h-10 w-full max-w-md rounded-lg border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text"
        />
        <button
          type="submit"
          className="rounded-lg bg-brand-accent px-3 text-[13px] font-bold text-black"
        >
          Search
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-brand-line bg-brand-surface">
        <table className="min-w-full text-[13px]">
          <thead className="bg-brand-bg/40 text-left text-[13px] uppercase tracking-wider text-brand-muted">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">WhatsApp</th>
              <th className="px-3 py-2">Country</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Signups</th>
              <th className="px-3 py-2">Paid</th>
              <th className="px-3 py-2">Lifetime</th>
              <th className="px-3 py-2">Last login</th>
            </tr>
          </thead>
          <tbody>
            {(affs ?? []).map((a) => {
              const stats = lifetimeMap.get(a.affiliate_id) ?? {
                signups: 0,
                paid: 0,
                lifetime_pence: 0
              };
              const name =
                [a.first_name, a.last_name].filter(Boolean).join(" ") ||
                a.company_name ||
                "—";
              return (
                <tr key={a.affiliate_id} className="border-t border-brand-line">
                  <td className="px-3 py-2 font-mono font-bold">
                    <Link
                      href={`/admin/affiliates/${a.affiliate_id}`}
                      className="text-brand-accent hover:underline"
                    >
                      #{a.affiliate_id}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{name}</td>
                  <td className="px-3 py-2 font-mono text-[13px]">
                    {a.whatsapp}
                  </td>
                  <td className="px-3 py-2">{a.country ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-[13px] font-bold ${
                        a.status === "active"
                          ? "bg-green-900/40 text-green-400"
                          : "bg-red-900/40 text-red-400"
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">{stats.signups}</td>
                  <td className="px-3 py-2">{stats.paid}</td>
                  <td className="px-3 py-2 font-bold text-brand-accent">
                    {pounds(stats.lifetime_pence)}
                  </td>
                  <td className="px-3 py-2 text-brand-muted">
                    {a.last_login_at
                      ? new Date(a.last_login_at).toLocaleDateString("en-GB")
                      : "—"}
                  </td>
                </tr>
              );
            })}
            {!affs?.length && (
              <tr>
                <td
                  colSpan={9}
                  className="px-3 py-6 text-center text-brand-muted"
                >
                  No affiliates yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

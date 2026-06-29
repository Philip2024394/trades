// Admin — affiliate reports. Top performers, top countries, best
// traffic sources (clicks→conversion), monthly growth, conversion-rate
// distribution.
//
// Everything is computed server-side with targeted Supabase queries
// and rolled up in TypeScript. No chart library yet — chart-ish things
// render as text/ASCII rows so the report ships now.
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function pounds(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function pct(num: number, den: number): string {
  if (!den) return "—";
  return `${((num / den) * 100).toFixed(2)}%`;
}

function ymKey(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function AdminAffiliateReportsPage() {
  const [affs, commissions, clicks, listings] = await Promise.all([
    supabaseAdmin
      .from("hammerex_affiliates")
      .select("affiliate_id, first_name, last_name, company_name, country, created_at"),
    supabaseAdmin
      .from("hammerex_affiliate_commissions")
      .select("affiliate_id, amount_pence, status"),
    supabaseAdmin
      .from("hammerex_affiliate_clicks")
      .select("affiliate_id, landing_page"),
    supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("affiliate_referrer_id, tier")
      .not("affiliate_referrer_id", "is", null)
  ]);

  // --- Top affiliates by lifetime earnings.
  const lifetime = new Map<number, number>();
  for (const c of commissions.data ?? []) {
    if (c.status === "approved" || c.status === "paid") {
      lifetime.set(
        c.affiliate_id,
        (lifetime.get(c.affiliate_id) ?? 0) + c.amount_pence
      );
    }
  }
  const affLookup = new Map<number, { name: string; country: string | null }>();
  for (const a of affs.data ?? []) {
    const name =
      [a.first_name, a.last_name].filter(Boolean).join(" ") ||
      a.company_name ||
      `Affiliate #${a.affiliate_id}`;
    affLookup.set(a.affiliate_id, { name, country: a.country });
  }
  const topAffs = Array.from(lifetime.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([id, pence]) => ({
      id,
      name: affLookup.get(id)?.name ?? `#${id}`,
      country: affLookup.get(id)?.country ?? null,
      pence
    }));

  // --- Top countries by signup count.
  const countryCount = new Map<string, number>();
  for (const a of affs.data ?? []) {
    const k = a.country ?? "Unknown";
    countryCount.set(k, (countryCount.get(k) ?? 0) + 1);
  }
  const topCountries = Array.from(countryCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  // --- Best traffic sources by landing_page → conversion ratio.
  // Conversion = paid signups attributed to clicks with that landing_page
  // (proxied as: any affiliate whose clicks include this landing_page
  // contributes a fraction of their paid signups equal to the share of
  // their clicks on that page). Good enough for v1; deeper attribution
  // requires per-click cookies.
  const landingClickCount = new Map<string, number>();
  const landingAffShare = new Map<string, Map<number, number>>();
  for (const c of clicks.data ?? []) {
    const lp = (c.landing_page ?? "/").slice(0, 80) || "/";
    landingClickCount.set(lp, (landingClickCount.get(lp) ?? 0) + 1);
    const inner = landingAffShare.get(lp) ?? new Map();
    inner.set(c.affiliate_id, (inner.get(c.affiliate_id) ?? 0) + 1);
    landingAffShare.set(lp, inner);
  }
  const affPaidCount = new Map<number, number>();
  for (const l of listings.data ?? []) {
    if (l.tier === "app_paid" || l.tier === "app_verified") {
      affPaidCount.set(
        l.affiliate_referrer_id,
        (affPaidCount.get(l.affiliate_referrer_id) ?? 0) + 1
      );
    }
  }
  const sources = Array.from(landingClickCount.entries()).map(([lp, clk]) => {
    let weightedPaid = 0;
    const inner = landingAffShare.get(lp) ?? new Map();
    for (const [affId, affClicks] of inner) {
      const affTotal =
        Array.from((landingAffShare.get(lp) ?? new Map()).values()).reduce(
          (a, b) => a + b,
          0
        ) || 1;
      // Each affiliate contributes paidCount * (their clicks on this lp / their total clicks on this lp)
      // simplified: paidCount * (affClicks / sum of clicks for this lp from this aff) — assume one
      const paid = affPaidCount.get(affId) ?? 0;
      weightedPaid += paid * (affClicks / affTotal);
    }
    return { lp, clicks: clk, paid: weightedPaid, rate: clk ? weightedPaid / clk : 0 };
  });
  sources.sort((a, b) => b.rate - a.rate);
  const topSources = sources.slice(0, 20);

  // --- Monthly growth: signups per month, last 12 months.
  const monthCount = new Map<string, number>();
  for (const a of affs.data ?? []) {
    const key = ymKey(a.created_at);
    monthCount.set(key, (monthCount.get(key) ?? 0) + 1);
  }
  const months: { ym: string; count: number }[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    months.push({ ym, count: monthCount.get(ym) ?? 0 });
  }
  const maxMonth = Math.max(1, ...months.map((m) => m.count));

  // --- Conversion-rate distribution per affiliate (P25/P50/P75).
  const perAffRate: number[] = [];
  const clicksByAff = new Map<number, number>();
  for (const c of clicks.data ?? []) {
    clicksByAff.set(c.affiliate_id, (clicksByAff.get(c.affiliate_id) ?? 0) + 1);
  }
  for (const [id, clk] of clicksByAff) {
    const paid = affPaidCount.get(id) ?? 0;
    if (clk > 0) perAffRate.push(paid / clk);
  }
  perAffRate.sort((a, b) => a - b);
  function quantile(p: number): number {
    if (perAffRate.length === 0) return 0;
    const idx = Math.max(
      0,
      Math.min(perAffRate.length - 1, Math.floor(p * perAffRate.length))
    );
    return perAffRate[idx];
  }
  const p25 = quantile(0.25);
  const p50 = quantile(0.5);
  const p75 = quantile(0.75);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] text-brand-muted">
            <Link href="/admin/affiliates" className="hover:underline">
              &larr; Affiliates
            </Link>
          </p>
          <h1 className="text-2xl font-extrabold">Affiliate reports</h1>
          <p className="mt-1 text-[13px] text-brand-muted">
            Snapshots over the lifetime of the programme.
          </p>
        </div>
      </header>

      <Card title="Top affiliates by lifetime earnings (top 20)">
        <table className="min-w-full text-[13px]">
          <thead className="text-left text-[13px] uppercase tracking-wider text-brand-muted">
            <tr>
              <th className="px-2 py-1">Rank</th>
              <th className="px-2 py-1">ID</th>
              <th className="px-2 py-1">Name</th>
              <th className="px-2 py-1">Country</th>
              <th className="px-2 py-1">Earnings</th>
            </tr>
          </thead>
          <tbody>
            {topAffs.map((a, i) => (
              <tr key={a.id} className="border-t border-brand-line">
                <td className="px-2 py-1">{i + 1}</td>
                <td className="px-2 py-1 font-mono">
                  <Link
                    href={`/admin/affiliates/${a.id}`}
                    className="text-brand-accent hover:underline"
                  >
                    #{a.id}
                  </Link>
                </td>
                <td className="px-2 py-1">{a.name}</td>
                <td className="px-2 py-1">{a.country ?? "—"}</td>
                <td className="px-2 py-1 font-bold text-brand-accent">
                  {pounds(a.pence)}
                </td>
              </tr>
            ))}
            {topAffs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-2 py-4 text-center text-brand-muted">
                  No earnings recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card title="Top countries by signup count (top 20)">
        <table className="min-w-full text-[13px]">
          <thead className="text-left text-[13px] uppercase tracking-wider text-brand-muted">
            <tr>
              <th className="px-2 py-1">Country</th>
              <th className="px-2 py-1">Signups</th>
            </tr>
          </thead>
          <tbody>
            {topCountries.map(([country, count]) => (
              <tr key={country} className="border-t border-brand-line">
                <td className="px-2 py-1">{country}</td>
                <td className="px-2 py-1 font-bold">{count}</td>
              </tr>
            ))}
            {topCountries.length === 0 && (
              <tr>
                <td colSpan={2} className="px-2 py-4 text-center text-brand-muted">
                  No data yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card title="Best traffic sources by conversion (top 20)">
        <table className="min-w-full text-[13px]">
          <thead className="text-left text-[13px] uppercase tracking-wider text-brand-muted">
            <tr>
              <th className="px-2 py-1">Landing page</th>
              <th className="px-2 py-1">Clicks</th>
              <th className="px-2 py-1">Paid signups (weighted)</th>
              <th className="px-2 py-1">Conversion rate</th>
            </tr>
          </thead>
          <tbody>
            {topSources.map((s) => (
              <tr key={s.lp} className="border-t border-brand-line">
                <td className="px-2 py-1 font-mono text-[13px] text-brand-text">
                  {s.lp}
                </td>
                <td className="px-2 py-1">{s.clicks}</td>
                <td className="px-2 py-1">{s.paid.toFixed(1)}</td>
                <td className="px-2 py-1 font-bold text-brand-accent">
                  {pct(s.paid, s.clicks)}
                </td>
              </tr>
            ))}
            {topSources.length === 0 && (
              <tr>
                <td colSpan={4} className="px-2 py-4 text-center text-brand-muted">
                  No click data yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card title="Monthly growth — new affiliate signups (last 12 months)">
        <ul className="space-y-1 text-[13px] font-mono">
          {months.map((m) => {
            const barWidth = Math.round((m.count / maxMonth) * 40);
            return (
              <li key={m.ym} className="flex items-center gap-3">
                <span className="w-20">{m.ym}</span>
                <span
                  aria-hidden
                  className="inline-block bg-brand-accent"
                  style={{ width: `${Math.max(2, barWidth * 6)}px`, height: 10 }}
                />
                <span className="w-12 text-brand-muted">{m.count}</span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="Conversion-rate distribution across affiliates">
        <ul className="space-y-1 text-[13px]">
          <li>P25 (bottom quartile): {(p25 * 100).toFixed(2)}%</li>
          <li>P50 (median): {(p50 * 100).toFixed(2)}%</li>
          <li>P75 (top quartile): {(p75 * 100).toFixed(2)}%</li>
          <li className="text-brand-muted">
            Sample: {perAffRate.length} affiliates with at least one click.
          </li>
        </ul>
      </Card>
    </div>
  );
}

function Card({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-brand-line bg-brand-surface p-5">
      <h2 className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-accent">
        {title}
      </h2>
      <div className="mt-3 overflow-x-auto">{children}</div>
    </section>
  );
}

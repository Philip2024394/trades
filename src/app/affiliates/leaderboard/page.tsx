// Public leaderboard — top 10 affiliates by paid referrals this month.
//
// Forced dynamic so the figures recompute on every page load.
// Anonymised name = first name + last initial (or company name). We
// never publish full surnames here.
import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { LEVEL_META, type AffiliateLevel } from "@/lib/affiliateLevel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Affiliate leaderboard | Thenetworkers"
};

function pounds(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function anonName(
  first: string | null,
  last: string | null,
  company: string | null,
  id: number
): string {
  if (company && !first && !last) return company;
  if (first || last) {
    const f = (first ?? "").trim() || "";
    const lInitial = (last ?? "").trim().charAt(0).toUpperCase();
    if (f && lInitial) return `${f} ${lInitial}.`;
    if (f) return f;
    if (lInitial) return `— ${lInitial}.`;
  }
  return `Affiliate #${id}`;
}

export default async function AffiliateLeaderboardPage() {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  // Paid commissions THIS month, grouped by affiliate.
  const { data: commissions } = await supabaseAdmin
    .from("hammerex_affiliate_commissions")
    .select("affiliate_id, amount_pence")
    .eq("status", "paid")
    .gte("paid_at", monthStart.toISOString());

  const tally = new Map<number, { count: number; pence: number }>();
  for (const c of commissions ?? []) {
    const cur = tally.get(c.affiliate_id) ?? { count: 0, pence: 0 };
    cur.count += 1;
    cur.pence += c.amount_pence;
    tally.set(c.affiliate_id, cur);
  }
  const ranked = Array.from(tally.entries())
    .sort((a, b) => b[1].count - a[1].count || b[1].pence - a[1].pence)
    .slice(0, 10);

  // Pull display names + avatar + bio for the ranked subset only.
  const ids = ranked.map(([id]) => id);
  type RowMeta = {
    first: string | null;
    last: string | null;
    company: string | null;
    avatar: string | null;
    bio: string | null;
  };
  const namesMap = new Map<number, RowMeta>();
  const levelMap = new Map<number, AffiliateLevel>();
  if (ids.length > 0) {
    const { data: names } = await supabaseAdmin
      .from("hammerex_affiliates")
      .select(
        "affiliate_id, first_name, last_name, company_name, avatar_url, bio, level"
      )
      .in("affiliate_id", ids);
    for (const n of names ?? []) {
      namesMap.set(n.affiliate_id, {
        first: n.first_name,
        last: n.last_name,
        company: n.company_name,
        avatar: n.avatar_url ?? null,
        bio: n.bio ?? null
      });
      levelMap.set(
        n.affiliate_id,
        (n.level ?? "bronze") as AffiliateLevel
      );
    }
  }

  const periodLabel = new Date().toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric"
  });

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <XratedHeader />
      <section className="mx-auto max-w-3xl px-4 pb-16 pt-12">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-accent">
          Affiliate Programme
        </p>
        <h1 className="mt-1 text-3xl font-extrabold leading-tight sm:text-4xl">
          Top affiliates this month
        </h1>
        <p className="mt-2 text-[13px] leading-snug text-brand-muted">
          Ranked by paid referrals in {periodLabel}. Updates on every page
          load.
        </p>

        <div className="mt-8 overflow-hidden rounded-xl border border-brand-line bg-brand-surface">
          <table className="min-w-full text-[13px]">
            <thead className="bg-brand-bg/40 text-left text-[13px] uppercase tracking-wider text-brand-muted">
              <tr>
                <th className="px-3 py-2">Rank</th>
                <th className="px-3 py-2">Affiliate</th>
                <th className="px-3 py-2">Level</th>
                <th className="px-3 py-2">Paid referrals</th>
                <th className="px-3 py-2">Earnings</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(([id, stats], i) => {
                const meta = namesMap.get(id);
                const display = anonName(
                  meta?.first ?? null,
                  meta?.last ?? null,
                  meta?.company ?? null,
                  id
                );
                const bioSnippet = (meta?.bio ?? "").trim();
                const initial = display.charAt(0).toUpperCase();
                return (
                  <tr
                    key={id}
                    className="border-t border-brand-line align-top"
                  >
                    <td className="px-3 py-3 text-[13px] font-extrabold text-brand-accent">
                      #{i + 1}
                    </td>
                    <td className="px-3 py-3 font-bold text-brand-text">
                      <div className="flex items-start gap-3">
                        <div
                          aria-hidden="true"
                          className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-brand-line bg-brand-bg"
                        >
                          {meta?.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={meta.avatar}
                              alt=""
                              width={40}
                              height={40}
                              className="h-10 w-10 object-cover"
                            />
                          ) : (
                            <span className="flex h-10 w-10 items-center justify-center text-[13px] font-bold text-brand-muted">
                              {initial}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-brand-text">{display}</p>
                          {bioSnippet && (
                            <p className="mt-0.5 line-clamp-2 max-w-[260px] text-[13px] font-normal leading-snug text-brand-muted">
                              {bioSnippet}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {(() => {
                        const lvl = levelMap.get(id) ?? "bronze";
                        const meta = LEVEL_META[lvl];
                        return (
                          <span
                            className="rounded px-2 py-0.5 text-[13px] font-bold"
                            style={{
                              backgroundColor: `${meta.accent}22`,
                              color: meta.accent
                            }}
                          >
                            {meta.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-3">{stats.count}</td>
                    <td className="px-3 py-3 font-bold text-brand-accent">
                      {pounds(stats.pence)}
                    </td>
                  </tr>
                );
              })}
              {ranked.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-[13px] text-brand-muted"
                  >
                    No paid referrals yet this month. Be the first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-[13px] leading-relaxed text-brand-muted">
          Not on the board?{" "}
          <a
            href="/affiliates"
            className="font-semibold text-brand-accent hover:underline"
          >
            Sign up
          </a>{" "}
          or{" "}
          <a
            href="/affiliates/dashboard"
            className="font-semibold text-brand-accent hover:underline"
          >
            view your dashboard
          </a>
          .
        </p>
      </section>
      <XratedFooter />
    </main>
  );
}

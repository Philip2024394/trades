// Affiliate dashboard — Referrals tab.
//
// Joins clicks against listings on affiliate_referrer_id and the
// 30-day cookie window. Anti-spec safeguard: we cap at 200 most-recent
// clicks for the join so the page doesn't choke for power-users.
import { readAffiliateSessionServer } from "@/lib/affiliateSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PageExplainer } from "@/components/xrated/affiliate/PageExplainer";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type SearchParams = Promise<{ page?: string }>;

export default async function AffiliateReferralsPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const session = await readAffiliateSessionServer();
  if (!session) return null;
  const id = session.affiliate_id;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const offset = (page - 1) * PAGE_SIZE;

  const clicks = await supabaseAdmin
    .from("hammerex_affiliate_clicks")
    .select("id, country, created_at, cookie_expires_at", { count: "exact" })
    .eq("affiliate_id", id)
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  // Pull every listing this affiliate referred — small dataset per
  // affiliate, so we hydrate a Map for in-memory join below.
  const listings = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, display_name, tier, created_at, paid_expires_at")
    .eq("affiliate_referrer_id", id)
    .order("created_at", { ascending: false });

  const total = clicks.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Referrals</h1>
        <p className="mt-1 text-[13px] text-brand-muted">
          Every click on your link, with the matched tradesperson signup
          where one happened inside the 30-day window.
        </p>
      </header>

      <PageExplainer
        title="Everyone who's used your referral link"
        description="Each row is one person who clicked your referral link and signed up. They might still be on the free tier — earnings only count when they upgrade to a paid Pro membership."
        steps={[
          "Find rows marked 'Paid' — that's a £10 commission",
          "Pending rows mean they signed up but haven't paid yet",
          "Country tells you where your audience is",
          "Click any row to see the full referral path"
        ]}
      />

      <p className="text-[12px] text-neutral-500">
        Showing your most recent clicks. Rows with a matched listing are
        the ones that turned into signups.
      </p>

      <div className="overflow-x-auto rounded-xl border border-brand-line bg-brand-surface">
        <table className="min-w-full text-[13px]">
          <thead className="bg-brand-bg/40 text-left text-[13px] uppercase tracking-wider text-brand-muted">
            <tr>
              <th className="px-3 py-2">Click ID</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Country</th>
              <th className="px-3 py-2">Listing matched</th>
              <th className="px-3 py-2">Tier</th>
              <th className="px-3 py-2">Cookie expires</th>
            </tr>
          </thead>
          <tbody>
            {(clicks.data ?? []).map((c) => {
              // Match a listing if it was created within the cookie
              // window after this click and tagged with this affiliate.
              const clickAt = new Date(c.created_at).getTime();
              const expiresAt = new Date(c.cookie_expires_at).getTime();
              const match = (listings.data ?? []).find((l) => {
                const created = new Date(l.created_at).getTime();
                return created >= clickAt && created <= expiresAt;
              });
              return (
                <tr
                  key={c.id}
                  className="border-t border-brand-line align-top"
                >
                  <td className="px-3 py-2 font-mono text-[13px] text-brand-muted">
                    {c.id.slice(0, 8)}
                  </td>
                  <td className="px-3 py-2">{formatDate(c.created_at)}</td>
                  <td className="px-3 py-2">{c.country ?? "—"}</td>
                  <td className="px-3 py-2">
                    {match ? (
                      <a
                        href={`/trade/${match.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-brand-accent hover:underline"
                      >
                        {match.display_name ?? match.slug}
                      </a>
                    ) : (
                      <span className="text-brand-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {match ? (
                      <span className="rounded bg-brand-line px-2 py-0.5 text-[13px] font-bold text-brand-text">
                        {match.tier}
                      </span>
                    ) : (
                      <span className="text-brand-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-brand-muted">
                    {formatDate(c.cookie_expires_at)}
                  </td>
                </tr>
              );
            })}
            {!clicks.data?.length && (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-brand-muted"
                >
                  No clicks yet. Share your link to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav className="flex justify-between text-[13px] text-brand-muted">
          <a
            href={`?page=${Math.max(1, page - 1)}`}
            className={`font-semibold ${page === 1 ? "pointer-events-none opacity-50" : "text-brand-accent hover:underline"}`}
          >
            ← Previous
          </a>
          <span>
            Page {page} of {pages}
          </span>
          <a
            href={`?page=${Math.min(pages, page + 1)}`}
            className={`font-semibold ${page === pages ? "pointer-events-none opacity-50" : "text-brand-accent hover:underline"}`}
          >
            Next →
          </a>
        </nav>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  } catch {
    return iso.slice(0, 10);
  }
}

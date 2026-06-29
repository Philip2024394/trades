// Affiliate dashboard — Commissions tab.
//
// Tabs by status: Pending / Approved / Paid / Cancelled. Each tab is
// a separate query so the row count stays predictable.
import { readAffiliateSessionServer } from "@/lib/affiliateSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PageExplainer } from "@/components/xrated/affiliate/PageExplainer";

export const dynamic = "force-dynamic";

type Tab = "pending" | "approved" | "paid" | "cancelled";
type SearchParams = Promise<{ tab?: string }>;

const TABS: { value: Tab; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" }
];

function pounds(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
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

export default async function AffiliateCommissionsPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const session = await readAffiliateSessionServer();
  if (!session) return null;
  const id = session.affiliate_id;
  const sp = await searchParams;
  const rawTab = sp.tab ?? "pending";
  const tab: Tab = (TABS.find((t) => t.value === rawTab)?.value ?? "pending");

  const rows = await supabaseAdmin
    .from("hammerex_affiliate_commissions")
    .select(
      "id, amount_pence, listing_id, status, created_at, approved_at, paid_at, cancelled_reason"
    )
    .eq("affiliate_id", id)
    .eq("status", tab)
    .order("created_at", { ascending: false });

  // Best-effort listing slug lookup for the table.
  const listingIds = Array.from(
    new Set((rows.data ?? []).map((r) => r.listing_id))
  );
  const listingsMap = new Map<string, { slug: string; display_name: string | null }>();
  if (listingIds.length > 0) {
    const ls = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id, slug, display_name")
      .in("id", listingIds);
    for (const l of ls.data ?? []) {
      listingsMap.set(l.id, { slug: l.slug, display_name: l.display_name });
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Commissions</h1>
        <p className="mt-1 text-[13px] text-brand-muted">
          Each row is a £10 commission earned when a referred tradesperson
          upgraded to a paid plan.
        </p>
      </header>

      <PageExplainer
        title="Your earnings from referrals"
        description="Every successful referral earns you £10. We give it 14 days to make sure the customer doesn't refund, then it becomes Approved. Approved earnings get paid monthly once you cross £50."
        steps={[
          "Pending — waiting for the customer's 14-day refund window to close",
          "Approved — safe to pay out",
          "Paid — money's been sent",
          "Refunded or Cancelled — no commission earned"
        ]}
      />

      <p className="text-[12px] text-neutral-500">
        Switch tabs to view commissions in each status. Amounts on every row
        are the £10 commission you earned for that referral.
      </p>

      <nav className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <a
            key={t.value}
            href={`?tab=${t.value}`}
            className={`rounded-lg px-3 py-2 text-[13px] font-bold ${
              tab === t.value
                ? "bg-brand-accent text-black"
                : "border border-brand-line bg-brand-surface text-brand-text hover:bg-brand-line"
            }`}
          >
            {t.label}
          </a>
        ))}
      </nav>

      <div className="overflow-x-auto rounded-xl border border-brand-line bg-brand-surface">
        <table className="min-w-full text-[13px]">
          <thead className="bg-brand-bg/40 text-left text-[13px] uppercase tracking-wider text-brand-muted">
            <tr>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Listing</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Approved</th>
              <th className="px-3 py-2">Paid</th>
              {tab === "cancelled" && <th className="px-3 py-2">Reason</th>}
            </tr>
          </thead>
          <tbody>
            {(rows.data ?? []).map((r) => {
              const listing = listingsMap.get(r.listing_id);
              return (
                <tr key={r.id} className="border-t border-brand-line">
                  <td className="px-3 py-2 font-bold text-brand-accent">
                    {pounds(r.amount_pence)}
                  </td>
                  <td className="px-3 py-2">
                    {listing ? (
                      <a
                        href={`/trade/${listing.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-brand-accent hover:underline"
                      >
                        {listing.display_name ?? listing.slug}
                      </a>
                    ) : (
                      <span className="text-brand-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{formatDate(r.created_at)}</td>
                  <td className="px-3 py-2">{formatDate(r.approved_at)}</td>
                  <td className="px-3 py-2">{formatDate(r.paid_at)}</td>
                  {tab === "cancelled" && (
                    <td className="px-3 py-2 text-brand-muted">
                      {r.cancelled_reason ?? "—"}
                    </td>
                  )}
                </tr>
              );
            })}
            {!rows.data?.length && (
              <tr>
                <td
                  colSpan={tab === "cancelled" ? 6 : 5}
                  className="px-3 py-6 text-center text-brand-muted"
                >
                  No {tab} commissions.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

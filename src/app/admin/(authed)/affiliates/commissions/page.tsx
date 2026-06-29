// Admin — commission queue. Tabs by status, plus bulk approve / bulk
// mark-paid actions on the pending and approved tabs respectively. The
// CommissionsTable client island carries the selection state and
// triggers /api/admin/affiliates/commissions/bulk.
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CommissionsTable } from "./CommissionsTable";

export const dynamic = "force-dynamic";

type Tab = "pending" | "approved" | "paid" | "cancelled" | "refunded";
type SearchParams = Promise<{ tab?: string }>;

const TABS: Tab[] = ["pending", "approved", "paid", "cancelled", "refunded"];

function pounds(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

export default async function AdminAffiliateCommissionsPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const tab: Tab =
    (TABS.find((t) => t === sp.tab) as Tab | undefined) ?? "pending";

  const { data: rows } = await supabaseAdmin
    .from("hammerex_affiliate_commissions")
    .select(
      "id, affiliate_id, listing_id, amount_pence, status, created_at, approved_at, paid_at, stripe_subscription_id, cancelled_reason"
    )
    .eq("status", tab)
    .order("created_at", { ascending: false })
    .limit(500);

  const total = (rows ?? []).reduce((sum, r) => sum + r.amount_pence, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] text-brand-muted">
            <Link href="/admin/affiliates" className="hover:underline">
              &larr; Affiliates
            </Link>
          </p>
          <h1 className="text-2xl font-extrabold">Commission queue</h1>
          <p className="mt-1 text-[13px] text-brand-muted">
            {(rows ?? []).length} {tab} commissions &middot; {pounds(total)} total
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/admin/affiliates/export?format=csv&kind=commissions&status=${tab}`}
            className="rounded-lg border border-brand-line bg-brand-surface px-3 py-1.5 text-[13px] font-bold text-brand-text hover:bg-brand-line"
          >
            Export CSV
          </a>
          <a
            href={`/api/admin/affiliates/payouts/bank-export?period=${new Date().toISOString().slice(0, 7)}`}
            className="rounded-lg border border-brand-line bg-brand-surface px-3 py-1.5 text-[13px] font-bold text-brand-text hover:bg-brand-line"
          >
            Bank export (this month)
          </a>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`?tab=${t}`}
            className={`rounded-lg px-3 py-2 text-[13px] font-bold ${
              tab === t
                ? "bg-brand-accent text-black"
                : "border border-brand-line bg-brand-surface text-brand-text hover:bg-brand-line"
            }`}
          >
            {t}
          </Link>
        ))}
      </nav>

      <CommissionsTable tab={tab} rows={rows ?? []} />
    </div>
  );
}

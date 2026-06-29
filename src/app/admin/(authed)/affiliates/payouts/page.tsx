// Admin — payouts. Groups approved commissions per affiliate where
// total >= £50 AND payment details are complete. Admin clicks
// "Generate payout" to create a hammerex_affiliate_payouts row, then
// "Mark paid" once the bank transfer goes through.
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PayoutGeneratorButton } from "./PayoutGeneratorButton";
import { PayoutMarkPaidButton } from "./PayoutMarkPaidButton";

export const dynamic = "force-dynamic";

function pounds(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB");
  } catch {
    return iso;
  }
}

const MIN_PAYOUT_PENCE = 5000;

export default async function AdminAffiliatePayoutsPage() {
  // Eligible: approved commissions, grouped per affiliate, total >= £50,
  // payment_details_completed_at IS NOT NULL.
  const [{ data: approved }, { data: payouts }] = await Promise.all([
    supabaseAdmin
      .from("hammerex_affiliate_commissions")
      .select("id, affiliate_id, amount_pence")
      .eq("status", "approved")
      .is("payout_id", null),
    supabaseAdmin
      .from("hammerex_affiliate_payouts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100)
  ]);

  const eligibleByAffiliate = new Map<
    number,
    { total: number; ids: string[] }
  >();
  for (const c of approved ?? []) {
    const rec = eligibleByAffiliate.get(c.affiliate_id) ?? { total: 0, ids: [] };
    rec.total += c.amount_pence;
    rec.ids.push(c.id);
    eligibleByAffiliate.set(c.affiliate_id, rec);
  }

  const eligibleIds = Array.from(eligibleByAffiliate.keys());
  const affDataMap = new Map<
    number,
    { payment_details_completed_at: string | null; name: string }
  >();
  if (eligibleIds.length > 0) {
    const { data: affs } = await supabaseAdmin
      .from("hammerex_affiliates")
      .select(
        "affiliate_id, first_name, last_name, company_name, payment_details_completed_at"
      )
      .in("affiliate_id", eligibleIds);
    for (const a of affs ?? []) {
      const name =
        [a.first_name, a.last_name].filter(Boolean).join(" ") ||
        a.company_name ||
        `Affiliate #${a.affiliate_id}`;
      affDataMap.set(a.affiliate_id, {
        payment_details_completed_at: a.payment_details_completed_at,
        name
      });
    }
  }

  const periodMonth = (() => {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  })();

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header>
        <p className="text-[13px] text-brand-muted">
          <Link href="/admin/affiliates" className="hover:underline">
            ← Affiliates
          </Link>
        </p>
        <h1 className="text-2xl font-extrabold">Payouts</h1>
        <p className="mt-1 text-[13px] text-brand-muted">
          Generate monthly payouts for affiliates with approved commissions
          ≥ £50 and complete payment details.
        </p>
      </header>

      <section>
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-accent">
          Eligible for this month ({periodMonth})
        </h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-brand-line bg-brand-surface">
          <table className="min-w-full text-[13px]">
            <thead className="bg-brand-bg/40 text-left text-[13px] uppercase tracking-wider text-brand-muted">
              <tr>
                <th className="px-3 py-2">Affiliate</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Commissions</th>
                <th className="px-3 py-2">Payment details</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(eligibleByAffiliate.entries()).map(
                ([affId, { total, ids }]) => {
                  const aff = affDataMap.get(affId);
                  const meetsMin = total >= MIN_PAYOUT_PENCE;
                  const detailsComplete = Boolean(
                    aff?.payment_details_completed_at
                  );
                  const eligible = meetsMin && detailsComplete;
                  return (
                    <tr key={affId} className="border-t border-brand-line">
                      <td className="px-3 py-2 font-mono">
                        <Link
                          href={`/admin/affiliates/${affId}`}
                          className="text-brand-accent hover:underline"
                        >
                          #{affId}
                        </Link>{" "}
                        <span className="text-brand-muted">
                          {aff?.name ?? ""}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-bold text-brand-accent">
                        {pounds(total)}
                      </td>
                      <td className="px-3 py-2 text-brand-muted">
                        {ids.length}
                      </td>
                      <td className="px-3 py-2">
                        {detailsComplete ? (
                          <span className="text-green-400">complete</span>
                        ) : (
                          <span className="text-red-400">missing</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {eligible ? (
                          <PayoutGeneratorButton
                            affiliateId={affId}
                            commissionIds={ids}
                            totalPence={total}
                            periodMonth={periodMonth}
                          />
                        ) : (
                          <span className="text-brand-muted">
                            {meetsMin ? "Needs details" : "Below £50"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                }
              )}
              {eligibleByAffiliate.size === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-brand-muted"
                  >
                    Nothing eligible right now.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-accent">
          Recent payouts
        </h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-brand-line bg-brand-surface">
          <table className="min-w-full text-[13px]">
            <thead className="bg-brand-bg/40 text-left text-[13px] uppercase tracking-wider text-brand-muted">
              <tr>
                <th className="px-3 py-2">Affiliate</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Period</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Paid</th>
                <th className="px-3 py-2">Reference</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(payouts ?? []).map((p) => (
                <tr key={p.id} className="border-t border-brand-line">
                  <td className="px-3 py-2 font-mono">#{p.affiliate_id}</td>
                  <td className="px-3 py-2 font-bold text-brand-accent">
                    {pounds(p.total_pence)}
                  </td>
                  <td className="px-3 py-2 text-brand-muted">{p.period_month}</td>
                  <td className="px-3 py-2">{p.status}</td>
                  <td className="px-3 py-2 text-brand-muted">{fmt(p.created_at)}</td>
                  <td className="px-3 py-2 text-brand-muted">{fmt(p.paid_at)}</td>
                  <td className="px-3 py-2 font-mono text-[13px] text-brand-muted">
                    {p.reference ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    {p.status === "pending" && (
                      <PayoutMarkPaidButton payoutId={p.id} />
                    )}
                  </td>
                </tr>
              ))}
              {!payouts?.length && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-6 text-center text-brand-muted"
                  >
                    No payouts yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// /admin/revenue — Revenue Centre.
//
// MRR / ARR / active-count / cancelling / new-30d / churned-30d.
// Split by tier + separate homeowner subs line. Reconciliation table
// shows every DB↔Stripe drift issue for triage.

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Wallet, AlertTriangle } from "lucide-react";
import { assertAdminRole } from "@/lib/admin/rbac";
import { loadRevenueSnapshot, penceToGbp } from "@/lib/revenue/engine";
import { loadReconciliationIssues } from "@/lib/revenue/reconcile";
import { TIER_CATALOG } from "@/lib/tierCatalog";

export const dynamic = "force-dynamic";

const BRAND_YELLOW = "#FFB300";

export default async function RevenueCentre() {
  const auth = await assertAdminRole(["admin", "finance"]);
  if (!auth.ok) redirect("/admin/login?next=/admin/revenue");

  const [snap, issues] = await Promise.all([
    loadRevenueSnapshot(),
    loadReconciliationIssues()
  ]);

  const netMovement30d = snap.new30dCount - snap.churned30dCount;

  return (
    <main className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-5xl">
        <Link href="/admin" className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900">
          <ArrowLeft size={11}/> Network Health
        </Link>
        <div className="mt-3 mb-5">
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: BRAND_YELLOW }}>Revenue Centre</p>
          <h1 className="mt-1 flex items-center gap-2 text-[24px] font-black text-neutral-900">
            <Wallet size={22}/> Money
          </h1>
          <p className="mt-1 text-[12px] text-neutral-600">
            Live from os_billing_subscriptions + os_homeowner_subscriptions. Every figure derived — no estimates.
          </p>
        </div>

        {/* Row 1 · Headline */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <BigTile label="MRR"          value={penceToGbp(snap.mrrGbpPence)}                    accent="#166534"/>
          <BigTile label="ARR"          value={penceToGbp(snap.arrGbpPence)}                    accent="#166534"/>
          <BigTile label="Active subs"  value={snap.activeCount.toLocaleString("en-GB")}        accent="#0A0A0A"/>
          <BigTile label="Net 30d"      value={(netMovement30d >= 0 ? "+" : "") + netMovement30d} accent={netMovement30d >= 0 ? "#166534" : "#B91C1C"}/>
        </div>

        {/* Row 2 · Motion */}
        <div className="mt-3 grid grid-cols-3 gap-3">
          <MotionTile label="New · 30d"           value={snap.new30dCount}      colour="#166534"/>
          <MotionTile label="Churned · 30d"       value={snap.churned30dCount}  colour="#B91C1C"/>
          <MotionTile label="Cancelling this period" value={snap.cancellingCount} colour="#F59E0B"/>
        </div>

        {/* Row 3 · MRR by tier */}
        <section className="mt-6 rounded-2xl border-2 bg-white p-4" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <p className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-neutral-700">MRR by tier</p>
          {snap.byTier.length === 0 ? (
            <p className="rounded-lg bg-neutral-50 p-3 text-[11.5px] text-neutral-600">No active paid subscriptions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11.5px]">
                <thead>
                  <tr className="text-left text-[10px] font-black uppercase tracking-wider text-neutral-500">
                    <th className="pb-2 pr-3">Tier</th>
                    <th className="pb-2 pr-3 text-right">Active</th>
                    <th className="pb-2 pr-3 text-right">£/month each</th>
                    <th className="pb-2 pr-3 text-right">MRR</th>
                    <th className="pb-2 pr-3 text-right">% of total</th>
                  </tr>
                </thead>
                <tbody>
                  {snap.byTier.map(row => {
                    const tier    = row.tier === "unknown" ? null : TIER_CATALOG[row.tier];
                    const percent = snap.mrrGbpPence === 0 ? 0 : Math.round((row.monthlyGbpPence / snap.mrrGbpPence) * 100);
                    return (
                      <tr key={row.tier} className="border-t border-neutral-100">
                        <td className="py-2 pr-3 font-black text-neutral-900">{tier?.label ?? row.tier}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{row.activeCount}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{tier ? `£${tier.monthlyGbp.toFixed(2)}` : "—"}</td>
                        <td className="py-2 pr-3 text-right tabular-nums font-black text-neutral-900">{penceToGbp(row.monthlyGbpPence)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-neutral-500">{percent}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border-2 bg-white p-4" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.22em] text-neutral-700">Homeowner subscriptions</p>
          <p className="text-[13.5px] font-black tabular-nums text-neutral-900">{snap.homeownerActive}</p>
          <p className="text-[10.5px] text-neutral-500">SiteBook Pro etc. Tracked separately from merchant plans.</p>
        </section>

        {/* Row 4 · Reconciliation */}
        <section className="mt-6 rounded-2xl border-2 bg-white p-4" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <div className="mb-3 flex items-baseline gap-2">
            <AlertTriangle size={14} className="text-amber-500"/>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-neutral-700">Stripe reconciliation</p>
            <span className="text-[10.5px] text-neutral-500">{issues.length} issue{issues.length === 1 ? "" : "s"}</span>
          </div>
          {issues.length === 0 ? (
            <p className="rounded-lg bg-green-50 p-3 text-[11.5px] font-bold text-green-900">Zero drift. DB and expected Stripe state agree.</p>
          ) : (
            <ul className="space-y-2">
              {issues.slice(0, 40).map(i => (
                <li key={`${i.subscriptionId}-${i.issueKind}`} className="flex items-start justify-between gap-3 rounded-lg border border-neutral-100 p-2.5">
                  <div>
                    <p className="text-[12px] font-black text-neutral-900">{i.issueKind.replace(/_/g, " ")}</p>
                    <p className="mt-0.5 text-[10.5px] text-neutral-600">{i.detail}</p>
                    <p className="mt-0.5 text-[10px] text-neutral-500 tabular-nums">
                      sub {i.subscriptionId.slice(0, 8)} · merchant {i.merchantId?.slice(0, 8) ?? "—"} · stripe {i.stripeSubId?.slice(0, 12) ?? "—"}
                    </p>
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white"
                    style={{ backgroundColor: i.severity === "high" ? "#B91C1C" : i.severity === "normal" ? "#F59E0B" : "#6B7280" }}
                  >{i.severity}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function BigTile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl border-2 bg-white p-4" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <p className="text-[9px] font-black uppercase tracking-[0.24em]" style={{ color: accent }}>{label}</p>
      <p className="mt-1 text-[22px] font-black tabular-nums text-neutral-900">{value}</p>
    </div>
  );
}

function MotionTile({ label, value, colour }: { label: string; value: number; colour: string }) {
  return (
    <div className="rounded-2xl border-2 bg-white p-3" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <p className="text-[9px] font-black uppercase tracking-[0.24em]" style={{ color: colour }}>{label}</p>
      <p className="mt-1 text-[18px] font-black tabular-nums text-neutral-900">{value.toLocaleString("en-GB")}</p>
    </div>
  );
}

// /trade-hq
//
// Trade-side dashboard. Every engagement they've been hired on, every
// payment recorded to them, with confirm/dispute controls. Shown only
// when the signed-in party owns a business listing.

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ChevronLeft,
  HardHat,
  ClipboardCheck,
  PoundSterling,
  Sparkles,
  ExternalLink,
  ArrowRight,
  Building2
} from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadHomeownerSession } from "@/lib/os/homeownerSession";
import { loadTradeSession } from "@/lib/os/tradeSession";
import { PaymentConfirmButtons } from "./PaymentConfirmButtons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Trade HQ · My Notebook" };

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-400/15 text-amber-200",
  accepted: "bg-blue-400/15 text-blue-200",
  in_progress: "bg-emerald-500/15 text-emerald-200",
  completed: "bg-emerald-500/25 text-emerald-100",
  signed_off: "bg-emerald-600/25 text-emerald-100",
  disputed: "bg-red-500/15 text-red-200",
  cancelled: "bg-[#1B1A17]/5 text-[#1B1A17]/55"
};

export default async function TradeHQ() {
  const party = await loadHomeownerSession();
  if (!party) redirect("/home/sign-in?next=/trade-hq");

  const trade = await loadTradeSession();

  if (!trade) {
    return (
      <main className="relative min-h-screen bg-[#FBF6EC] text-[#1B1A17]">
        <div className="relative mx-auto max-w-xl px-6 py-16">
          <Link
            href="/home"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            My Notebook
          </Link>
          <div className="mt-8 rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-6">
            <div className="flex items-start gap-3">
              <Building2 className="mt-0.5 h-6 w-6 shrink-0 text-[#1B1A17]/45" aria-hidden />
              <div>
                <h1 className="text-[20px] font-bold text-[#1B1A17]">
                  You&apos;re not a listed trade yet.
                </h1>
                <p className="mt-2 text-[13px] text-[#1B1A17]/60">
                  Trade HQ is where sub-trades see the sites and jobs they&apos;ve
                  been hired for. Join as a trade to get your public Notebook and
                  start receiving engagements.
                </p>
                <Link
                  href="/join/start"
                  className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-amber-400 px-5 text-[13px] font-bold text-neutral-900 hover:bg-amber-300"
                >
                  Open a free trade Notebook
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Engagements assigned to this trade.
  const { data: engagements } = await supabaseAdmin
    .from("os_site_engagements")
    .select(
      `id, site_id, hired_display_name, hired_trade, service_description,
       agreed_price_pence, deposit_pence, agreed_start_date, agreed_end_date,
       status, owner_entity_id, created_at,
       site:os_sites(name, postcode),
       entity:os_entities(display_name, tier)`
    )
    .eq("business_id", trade.primaryListingId)
    .order("created_at", { ascending: false });

  // Payments recorded to this trade.
  const { data: payments } = await supabaseAdmin
    .from("os_project_payments")
    .select(
      `id, amount_pence, currency, payment_method, status, paid_at,
       merchant_confirmed_at, payment_reference, notes, engagement_id,
       paying_entity_id`
    )
    .eq("to_business_id", trade.primaryListingId)
    .order("paid_at", { ascending: false, nullsFirst: false });

  const pendingConfirmations = (payments ?? []).filter(
    (p) => p.status === "recorded"
  );
  const totalConfirmed = (payments ?? [])
    .filter((p) => p.status === "both_confirmed")
    .reduce((sum, p) => sum + p.amount_pence, 0);
  const activeCount = (engagements ?? []).filter(
    (e) => !["signed_off", "cancelled"].includes(e.status)
  ).length;

  return (
    <main className="relative min-h-screen bg-[#FBF6EC] text-[#1B1A17]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 40% at 50% 0%, rgba(255,179,0,0.14) 0%, transparent 60%)"
        }}
      />

      <div className="relative mx-auto max-w-4xl px-5 py-8 md:px-10 md:py-12">
        <div className="flex items-center justify-between">
          <Link
            href="/home"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            My Notebook
          </Link>
          <a
            href={`/trade/${trade.primaryListingSlug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-amber-300 hover:text-amber-200"
          >
            View public Notebook
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </div>

        <div className="mt-8">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-300">
            <HardHat className="h-3 w-3" aria-hidden />
            Trade HQ
          </p>
          <h1 className="mt-3 text-[32px] font-bold leading-[1.05] tracking-tight md:text-[42px]">
            {trade.primaryListingDisplayName}.<br />
            <span className="text-[#1B1A17]/70">Every job you&apos;re on.</span>
          </h1>
        </div>

        {/* KPI strip */}
        <section className="mt-10 grid gap-3 sm:grid-cols-3">
          <Kpi
            label="Active engagements"
            value={String(activeCount)}
            sublabel={`${(engagements ?? []).length} total`}
            icon={<ClipboardCheck className="h-4 w-4" aria-hidden />}
          />
          <Kpi
            label="Confirmed received"
            value={`£${(totalConfirmed / 100).toLocaleString("en-GB")}`}
            sublabel={`${(payments ?? []).filter((p) => p.status === "both_confirmed").length} payments`}
            icon={<PoundSterling className="h-4 w-4" aria-hidden />}
            accent
          />
          <Kpi
            label="Awaiting your confirm"
            value={String(pendingConfirmations.length)}
            sublabel={
              pendingConfirmations.length > 0 ? "Tap to confirm below" : "All clear"
            }
            icon={<Sparkles className="h-4 w-4" aria-hidden />}
          />
        </section>

        {/* Pending payment confirmations — top of mind */}
        {pendingConfirmations.length > 0 ? (
          <section className="mt-12">
            <h2 className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-300">
              Payments awaiting your confirmation
            </h2>
            <p className="mt-1 text-[13px] text-[#1B1A17]/60">
              The bill-payer has recorded these. Tap confirm when you&apos;ve
              actually received the money.
            </p>
            <ul className="mt-4 space-y-3">
              {pendingConfirmations.map((p) => (
                <li
                  key={p.id}
                  className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[18px] font-black text-[#1B1A17]">
                        £{(p.amount_pence / 100).toLocaleString("en-GB")}
                      </div>
                      {p.notes ? (
                        <p className="mt-1 text-[13px] text-[#1B1A17]/70">
                          {p.notes}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[11px] uppercase tracking-wider text-[#1B1A17]/55">
                        {p.payment_method?.replace(/_/g, " ") ?? "unknown"} ·{" "}
                        {p.paid_at
                          ? new Date(p.paid_at).toLocaleDateString("en-GB")
                          : "no date"}
                        {p.payment_reference ? ` · ${p.payment_reference}` : ""}
                      </p>
                    </div>
                    <PaymentConfirmButtons paymentId={p.id} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Engagements */}
        <section className="mt-14">
          <h2 className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#1B1A17]/55">
            Every engagement
          </h2>
          {(engagements ?? []).length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[#1B1A17]/15 p-8 text-center">
              <ClipboardCheck className="mx-auto h-8 w-8 text-[#1B1A17]/35" aria-hidden />
              <p className="mt-3 text-[14px] text-[#1B1A17]/60">
                No engagements yet — when a foreman hires you, it lands here.
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {(engagements ?? []).map((e) => {
                const siteRow = Array.isArray(e.site) ? e.site[0] : e.site;
                const entityRow = Array.isArray(e.entity) ? e.entity[0] : e.entity;
                return (
                  <li
                    key={e.id}
                    className="rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/trade-hq/engagements/${e.id}`}
                            className="text-[15px] font-bold text-[#1B1A17] hover:text-amber-200"
                          >
                            {siteRow?.name ?? "Site"}
                          </Link>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              STATUS_STYLE[e.status] ?? "bg-[#1B1A17]/5 text-[#1B1A17]/60"
                            }`}
                          >
                            {e.status.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="mt-1 text-[13px] text-[#1B1A17]/70">
                          {e.service_description ?? e.hired_trade.replace(/-/g, " ")}
                        </p>
                        <p className="mt-1 text-[11px] uppercase tracking-wider text-[#1B1A17]/45">
                          {entityRow?.display_name ?? "Unknown entity"}
                          {siteRow?.postcode ? ` · ${siteRow.postcode}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        {e.agreed_price_pence ? (
                          <div className="text-[16px] font-black text-amber-300">
                            £{(e.agreed_price_pence / 100).toLocaleString("en-GB")}
                          </div>
                        ) : null}
                        {e.agreed_start_date ? (
                          <div className="mt-1 text-[11px] text-[#1B1A17]/55">
                            {new Date(e.agreed_start_date).toLocaleDateString("en-GB")}
                            {e.agreed_end_date
                              ? ` → ${new Date(e.agreed_end_date).toLocaleDateString("en-GB")}`
                              : ""}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function Kpi({
  label,
  value,
  sublabel,
  icon,
  accent
}: {
  label: string;
  value: string;
  sublabel: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        accent
          ? "border-amber-400/30 bg-amber-400/5"
          : "border-[#1B1A17]/12 bg-[#1B1A17]/4"
      }`}
    >
      <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#1B1A17]/55">
        <span aria-hidden className={accent ? "text-amber-300" : "text-[#1B1A17]/55"}>
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-2 text-[24px] font-black leading-none text-[#1B1A17]">
        {value}
      </div>
      <div className="mt-1 text-[11px] text-[#1B1A17]/55">{sublabel}</div>
    </div>
  );
}


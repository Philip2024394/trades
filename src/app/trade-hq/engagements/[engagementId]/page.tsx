// /trade-hq/engagements/[engagementId]
//
// Trade-side view of ONE engagement they've been hired on. Confirm or
// dispute, see the money, see the site.

import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import {
  ChevronLeft,
  Calendar,
  PoundSterling,
  ClipboardCheck,
  Building2,
  ImageIcon,
  MessageSquareText
} from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadHomeownerSession } from "@/lib/os/homeownerSession";
import { loadTradeSession } from "@/lib/os/tradeSession";
import { TradeEngagementActions } from "./TradeEngagementActions";

export const dynamic = "force-dynamic";

type Params = { engagementId: string };

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-400/15 text-amber-200",
  accepted: "bg-blue-400/15 text-blue-200",
  in_progress: "bg-emerald-500/15 text-emerald-200",
  completed: "bg-emerald-500/25 text-emerald-100",
  signed_off: "bg-emerald-600/25 text-emerald-100",
  disputed: "bg-red-500/15 text-red-200",
  cancelled: "bg-[#1B1A17]/5 text-[#1B1A17]/55"
};

export default async function TradeEngagementDetail({
  params
}: {
  params: Promise<Params>;
}) {
  const party = await loadHomeownerSession();
  const { engagementId } = await params;
  if (!party) redirect(`/home/sign-in?next=/trade-hq/engagements/${engagementId}`);
  const trade = await loadTradeSession();
  if (!trade) redirect("/trade-hq");

  const { data: engagement } = await supabaseAdmin
    .from("os_site_engagements")
    .select(
      `id, hired_display_name, hired_trade, service_description,
       agreed_price_pence, deposit_pence, currency,
       agreed_start_date, agreed_end_date, actual_start_date, actual_end_date,
       captured_via, captured_source_url, status, notes, business_id,
       owner_entity_id, signed_off_at,
       site:os_sites(name, postcode),
       entity:os_entities(display_name, tier)`
    )
    .eq("id", engagementId)
    .maybeSingle();

  if (!engagement || engagement.business_id !== trade.primaryListingId) notFound();

  const site = Array.isArray(engagement.site) ? engagement.site[0] : engagement.site;
  const entity = Array.isArray(engagement.entity)
    ? engagement.entity[0]
    : engagement.entity;

  const { data: engagementPayments } = await supabaseAdmin
    .from("os_project_payments")
    .select("id, amount_pence, status, payment_type, paid_at, payment_reference, notes")
    .eq("engagement_id", engagementId)
    .order("paid_at", { ascending: true });

  return (
    <main className="relative min-h-screen bg-[#FBF6EC] text-[#1B1A17]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 40% at 50% 0%, rgba(255,179,0,0.10) 0%, transparent 60%)"
        }}
      />

      <div className="relative mx-auto max-w-3xl px-5 py-8 md:px-10 md:py-12">
        <div className="flex items-center justify-between">
          <Link
            href="/trade-hq"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Trade HQ
          </Link>
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              STATUS_STYLE[engagement.status] ?? "bg-[#1B1A17]/5 text-[#1B1A17]/60"
            }`}
          >
            {engagement.status.replace(/_/g, " ")}
          </span>
        </div>

        <div className="mt-8">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-300">
            <Building2 className="h-3 w-3" aria-hidden />
            Hired by {entity?.display_name ?? "the site owner"}
          </p>
          <h1 className="mt-3 text-[26px] font-bold leading-[1.1] tracking-tight md:text-[34px]">
            {site?.name ?? "Site"}
          </h1>
          {site?.postcode ? (
            <p className="mt-1 text-[13px] text-[#1B1A17]/60">{site.postcode}</p>
          ) : null}
        </div>

        {engagement.service_description ? (
          <p className="mt-6 rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-4 text-[14px] leading-[1.55] text-[#1B1A17]/80">
            {engagement.service_description}
          </p>
        ) : null}

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <Stat
            label="Agreed total"
            value={
              engagement.agreed_price_pence
                ? `£${(engagement.agreed_price_pence / 100).toLocaleString("en-GB")}`
                : "—"
            }
            icon={<PoundSterling className="h-4 w-4" aria-hidden />}
          />
          <Stat
            label="Deposit"
            value={
              engagement.deposit_pence
                ? `£${(engagement.deposit_pence / 100).toLocaleString("en-GB")}`
                : "—"
            }
            icon={<ClipboardCheck className="h-4 w-4" aria-hidden />}
          />
          <Stat
            label="Dates"
            value={
              engagement.agreed_start_date
                ? `${new Date(engagement.agreed_start_date).toLocaleDateString(
                    "en-GB"
                  )}${
                    engagement.agreed_end_date
                      ? ` → ${new Date(engagement.agreed_end_date).toLocaleDateString("en-GB")}`
                      : ""
                  }`
                : "—"
            }
            icon={<Calendar className="h-4 w-4" aria-hidden />}
          />
        </section>

        {engagement.captured_source_url ? (
          <section className="mt-6">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#1B1A17]/55">
              Original agreement (captured by the foreman)
            </p>
            <div className="relative mt-3 aspect-video overflow-hidden rounded-2xl border border-[#1B1A17]/12 bg-[#FBF6EC]">
              <Image
                src={engagement.captured_source_url}
                alt="Agreement source"
                fill
                className="object-contain"
                unoptimized
              />
              {engagement.captured_via === "ai_vision" ? (
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-200">
                  <ImageIcon className="h-2.5 w-2.5" aria-hidden />
                  AI captured
                </span>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="mt-8">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#1B1A17]/55">
            Direct message
          </p>
          <div className="mt-3">
            <Link
              href={`/trade-hq/engagements/${engagementId}/chat`}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#1B1A17]/4 border border-[#1B1A17]/15 px-5 text-[13px] font-semibold text-[#1B1A17] hover:bg-[#1B1A17]/5"
            >
              <MessageSquareText className="h-4 w-4" aria-hidden />
              Open thread with {entity?.display_name ?? "the site owner"}
            </Link>
          </div>
        </section>

        {/* Actions */}
        <section className="mt-8">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#1B1A17]/55">
            Your response
          </p>
          <div className="mt-3">
            <TradeEngagementActions
              engagementId={engagementId}
              currentStatus={engagement.status}
            />
          </div>
        </section>

        {/* Payments recorded */}
        {(engagementPayments ?? []).length > 0 ? (
          <section className="mt-8">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#1B1A17]/55">
              Payments recorded on this engagement
            </p>
            <ul className="mt-3 space-y-2">
              {(engagementPayments ?? []).map((p) => (
                <li
                  key={p.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-bold text-[#1B1A17]">
                      £{(p.amount_pence / 100).toLocaleString("en-GB")}
                      <span className="ml-2 text-[11px] font-normal uppercase tracking-wider text-[#1B1A17]/45">
                        {p.payment_type}
                      </span>
                    </div>
                    {p.notes ? (
                      <p className="mt-1 text-[12px] text-[#1B1A17]/55">{p.notes}</p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-[#1B1A17]/45">
                      {p.paid_at
                        ? new Date(p.paid_at).toLocaleDateString("en-GB")
                        : "not yet paid"}
                      {p.payment_reference ? ` · ${p.payment_reference}` : ""}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      p.status === "both_confirmed"
                        ? "bg-emerald-500/15 text-emerald-200"
                        : p.status === "recorded"
                          ? "bg-amber-400/15 text-amber-200"
                          : "bg-red-500/15 text-red-200"
                    }`}
                  >
                    {p.status.replace(/_/g, " ")}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  icon
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-4">
      <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#1B1A17]/55">
        <span aria-hidden className="text-amber-300">
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-2 text-[16px] font-black leading-tight text-[#1B1A17]">
        {value}
      </div>
    </div>
  );
}

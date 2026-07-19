// /home/trades/[tradeId]
//
// Sarah's file on one specific trade — Mike the Carpenter. Aggregates
// every project she's done with him, every payment recorded, every
// note. Owner-only.

import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import {
  ChevronLeft,
  Phone,
  Mail,
  MessageCircle,
  MapPin,
  BadgeCheck,
  FolderKanban,
  Receipt,
  MessageSquareText,
  Plus,
  Info,
  ExternalLink
} from "lucide-react";
import { loadHomeownerSession } from "@/lib/os/homeownerSession";
import { loadActiveMembership } from "@/lib/os/entitySession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type Params = { tradeId: string };

export async function generateMetadata({
  params
}: {
  params: Promise<Params>;
}) {
  const { tradeId } = await params;
  const { data } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("display_name")
    .eq("id", tradeId)
    .maybeSingle();
  return {
    title: data
      ? `${data.display_name} · Trade file · Notebook`
      : "Trade file · Notebook"
  };
}

export default async function TradeFilePage({
  params
}: {
  params: Promise<Params>;
}) {
  const party = await loadHomeownerSession();
  const { tradeId } = await params;
  if (!party) {
    redirect(`/home/sign-in?next=/home/trades/${tradeId}`);
  }

  const { data: trade } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select(
      "id, slug, display_name, primary_trade, city, postcode_prefix, whatsapp, phone, email, website, avatar_url, photos, bio, years_in_trade, hammerex_standard_verified"
    )
    .eq("id", tradeId)
    .maybeSingle();

  if (!trade) {
    notFound();
  }

  // Look up the OS business row by slug — os_project_participants uses this.
  const { data: osBusiness } = await supabaseAdmin
    .from("os_business_listings")
    .select("id, verified, tier")
    .eq("slug", trade.slug)
    .maybeSingle();

  // Projects Sarah + this trade have participated in together.
  const { data: participations } = osBusiness
    ? await supabaseAdmin
        .from("os_project_participants")
        .select("project_id, role, joined_at")
        .eq("business_id", osBusiness.id)
        .in(
          "project_id",
          (
            await supabaseAdmin
              .from("os_project_participants")
              .select("project_id")
              .eq("party_id", party.id)
          ).data?.map((r) => r.project_id) ?? []
        )
    : { data: [] };

  const projectIds = (participations ?? [])
    .map((p) => p.project_id)
    .filter(Boolean);

  const { data: projects } = projectIds.length
    ? await supabaseAdmin
        .from("os_projects")
        .select("id, title, status, leaf_slug, created_at, notes")
        .in("id", projectIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  // Payments Sarah has recorded to this trade, scoped to the active
  // entity when we have one so contexts don't bleed into each other.
  const active = await loadActiveMembership();
  const paymentsQ = osBusiness
    ? supabaseAdmin
        .from("os_project_payments")
        .select(
          "id, project_id, amount_pence, currency, payment_method, status, paid_at, notes, created_at, merchant_confirmed_at, homeowner_confirmed_at"
        )
        .eq("to_business_id", osBusiness.id)
        .order("paid_at", { ascending: false, nullsFirst: false })
    : null;
  const { data: payments } = paymentsQ
    ? active
      ? await paymentsQ.eq("paying_entity_id", active.entity_id)
      : await paymentsQ.eq("from_party_id", party.id)
    : { data: [] };

  const totalPaidPence = (payments ?? []).reduce(
    (sum, p) =>
      sum +
      (p.status === "both_confirmed" || p.status === "recorded"
        ? p.amount_pence
        : 0),
    0
  );

  const projectCount = (projects ?? []).length;
  const firstJob = (projects ?? []).at(-1);

  return (
    <main className="relative min-h-screen bg-[#FBF6EC] text-[#1B1A17]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 40% at 50% 0%, rgba(255,179,0,0.12) 0%, transparent 60%)"
        }}
      />

      <div className="relative mx-auto max-w-4xl px-5 py-8 md:px-10 md:py-12">
        <div className="flex items-center justify-between">
          <Link
            href="/home/trades/invite"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Trade Circle
          </Link>
          <a
            href={`/trade/${trade.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-amber-300 hover:text-amber-200"
          >
            View public Notebook
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>

        {/* Trade header */}
        <section className="mt-8 flex items-start gap-4 md:gap-6">
          {trade.avatar_url ? (
            <Image
              src={trade.avatar_url}
              alt=""
              width={80}
              height={80}
              className="h-20 w-20 shrink-0 rounded-2xl object-cover md:h-24 md:w-24"
              unoptimized
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-[28px] font-black text-amber-300 md:h-24 md:w-24">
              {trade.display_name.charAt(0)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[26px] font-bold leading-tight md:text-[32px]">
                {trade.display_name}
              </h1>
              {(osBusiness?.verified || trade.hammerex_standard_verified) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
                  <BadgeCheck className="h-3 w-3" aria-hidden />
                  Verified
                </span>
              )}
            </div>
            <p className="mt-1 text-[14px] capitalize text-[#1B1A17]/60">
              {trade.primary_trade.replace(/-/g, " ")}
            </p>
            <p className="mt-1 inline-flex items-center gap-1 text-[13px] text-[#1B1A17]/55">
              <MapPin className="h-3 w-3" aria-hidden />
              {trade.city}
              {trade.postcode_prefix ? ` · ${trade.postcode_prefix}` : ""}
            </p>
          </div>
        </section>

        {/* Contact strip */}
        <section className="mt-6 flex flex-wrap gap-2">
          {trade.whatsapp ? (
            <a
              href={`https://wa.me/${trade.whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[40px] items-center gap-2 rounded-full bg-emerald-500/15 px-4 text-[13px] font-semibold text-emerald-200 hover:bg-emerald-500/25"
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden />
              WhatsApp
            </a>
          ) : null}
          {trade.phone ? (
            <a
              href={`tel:${trade.phone}`}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-[#1B1A17]/15 bg-[#1B1A17]/4 px-4 text-[13px] font-semibold text-[#1B1A17]/80 hover:bg-[#1B1A17]/5"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden />
              Call
            </a>
          ) : null}
          {trade.email ? (
            <a
              href={`mailto:${trade.email}`}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-[#1B1A17]/15 bg-[#1B1A17]/4 px-4 text-[13px] font-semibold text-[#1B1A17]/80 hover:bg-[#1B1A17]/5"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden />
              Email
            </a>
          ) : null}
        </section>

        {/* Stat strip */}
        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          <Stat
            label="Projects together"
            value={String(projectCount)}
            icon={<FolderKanban className="h-4 w-4" aria-hidden />}
          />
          <Stat
            label="Total paid"
            value={
              totalPaidPence > 0
                ? `£${(totalPaidPence / 100).toLocaleString("en-GB")}`
                : "—"
            }
            icon={<Receipt className="h-4 w-4" aria-hidden />}
          />
          <Stat
            label="First job"
            value={
              firstJob
                ? new Date(firstJob.created_at).toLocaleDateString("en-GB", {
                    month: "short",
                    year: "numeric"
                  })
                : "—"
            }
            icon={<MessageSquareText className="h-4 w-4" aria-hidden />}
          />
        </section>

        {/* Projects */}
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#1B1A17]/55">
              Projects
            </h2>
            <Link
              href="/homeowners/signup?intent=create-project"
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-amber-300 hover:text-amber-200"
            >
              <Plus className="h-3 w-3" aria-hidden />
              Start a new project
            </Link>
          </div>

          {projects && projects.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {projects.map((p) => (
                <li
                  key={p.id}
                  className="rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/home/vault/project/${p.id}`}
                        className="text-[15px] font-bold text-[#1B1A17] hover:text-amber-200"
                      >
                        {p.title}
                      </Link>
                      <p className="mt-0.5 text-[12px] text-[#1B1A17]/45">
                        {new Date(p.created_at).toLocaleDateString("en-GB")}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                        p.status === "signed_off"
                          ? "bg-emerald-500/15 text-emerald-200"
                          : p.status === "specced"
                            ? "bg-amber-400/15 text-amber-200"
                            : "bg-[#1B1A17]/5 text-[#1B1A17]/60"
                      }`}
                    >
                      {p.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-[#1B1A17]/15 p-6 text-center text-[13px] text-[#1B1A17]/55">
              No projects together yet. Start one to begin the record.
            </div>
          )}
        </section>

        {/* Payments */}
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#1B1A17]/55">
              Payments recorded
            </h2>
            <Link
              href={`/home/trades/${tradeId}/pay`}
              className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-3 py-1.5 text-[12px] font-bold text-neutral-900 hover:bg-amber-300"
            >
              <Plus className="h-3 w-3" aria-hidden />
              Record payment
            </Link>
          </div>

          {payments && payments.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {payments.map((p) => (
                <li
                  key={p.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-bold text-[#1B1A17]">
                      £{(p.amount_pence / 100).toLocaleString("en-GB")}
                      <span className="ml-2 text-[11px] font-normal uppercase tracking-wider text-[#1B1A17]/45">
                        {p.payment_method || "unknown"}
                      </span>
                    </div>
                    {p.notes ? (
                      <p className="mt-1 text-[12px] text-[#1B1A17]/55">
                        {p.notes}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-[#1B1A17]/45">
                      {p.paid_at
                        ? new Date(p.paid_at).toLocaleDateString("en-GB")
                        : "not marked paid"}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      p.status === "both_confirmed"
                        ? "bg-emerald-500/15 text-emerald-200"
                        : "bg-amber-400/15 text-amber-200"
                    }`}
                  >
                    {p.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-[#1B1A17]/15 p-6 text-center text-[13px] text-[#1B1A17]/55">
              No payments recorded yet. When you pay, screenshot the receipt and
              add it to this project so the total, date and method are on record.
            </div>
          )}
        </section>

        {/* Coming next */}
        <section className="mt-10 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-300">
            Coming next
          </p>
          <ul className="mt-3 space-y-2 text-[13px] leading-[1.55] text-[#1B1A17]/70">
            <li className="flex items-start gap-2">
              <MessageSquareText
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-300"
                aria-hidden
              />
              <span>
                <b className="text-[#1B1A17]">Chat with {trade.display_name}.</b>{" "}
                A 1:1 thread inside this file — every quote, screenshot, and
                message on the record.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Receipt
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-300"
                aria-hidden
              />
              <span>
                <b className="text-[#1B1A17]">Add a payment.</b> Attach a screenshot
                of your bank transfer, mark it as deposit or full, split
                materials from labour.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Info
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-300"
                aria-hidden
              />
              <span>
                <b className="text-[#1B1A17]">Auto-parse receipts.</b> Snap or
                upload — we&apos;ll pull total, date, and reference out of the
                image so you don&apos;t re-type it.
              </span>
            </li>
          </ul>
        </section>
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
      <div className="mt-2 text-[24px] font-black leading-none text-[#1B1A17]">
        {value}
      </div>
    </div>
  );
}

// /home/sites/[siteId]/engagements/[engagementId]
//
// One engagement's full record — the hire, the money, the timeline, the
// invite status, and the "invite Dave to Notebook" CTA.

import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import {
  ChevronLeft,
  Calendar,
  ClipboardCheck,
  UserPlus,
  ImageIcon,
  CheckCircle2,
  ExternalLink,
  MessageSquareText
} from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadHomeownerSession } from "@/lib/os/homeownerSession";
import { loadActiveMembership } from "@/lib/os/entitySession";
import { hasFinancialAccess, meetsRole } from "@/lib/os/entities";
import { InviteTradeForm } from "./InviteTradeForm";
import { EngagementControls } from "./EngagementControls";

export const dynamic = "force-dynamic";

type Params = { siteId: string; engagementId: string };

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-400/15 text-amber-200",
  accepted: "bg-blue-400/15 text-blue-200",
  in_progress: "bg-emerald-500/15 text-emerald-200",
  completed: "bg-emerald-500/25 text-emerald-100",
  disputed: "bg-red-500/15 text-red-200",
  cancelled: "bg-[#1B1A17]/5 text-[#1B1A17]/55"
};

export default async function EngagementPage({
  params
}: {
  params: Promise<Params>;
}) {
  const party = await loadHomeownerSession();
  const { siteId, engagementId } = await params;
  if (!party) {
    redirect(
      `/home/sign-in?next=/home/sites/${siteId}/engagements/${engagementId}`
    );
  }

  const active = await loadActiveMembership();
  if (!active) redirect("/home/entity");

  const { data: engagement } = await supabaseAdmin
    .from("os_site_engagements")
    .select(
      `id, site_id, hired_display_name, hired_trade, service_description,
       agreed_price_pence, deposit_pence, currency,
       agreed_start_date, agreed_end_date, actual_start_date, actual_end_date,
       captured_via, captured_source_url, status, notes,
       business_id, owner_entity_id, created_at,
       site:os_sites(name, postcode)`
    )
    .eq("id", engagementId)
    .eq("site_id", siteId)
    .maybeSingle();

  if (!engagement || engagement.owner_entity_id !== active.entity_id) {
    notFound();
  }

  // If the engagement is linked to a real listing, load its slug + name.
  let linkedListing: { id: string; display_name: string; slug: string; hammerex_id: string } | null = null;
  if (engagement.business_id) {
    const { data: osBiz } = await supabaseAdmin
      .from("os_business_listings")
      .select("id, slug, display_name")
      .eq("id", engagement.business_id)
      .maybeSingle();
    if (osBiz) {
      const { data: hammerex } = await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select("id")
        .eq("slug", osBiz.slug)
        .maybeSingle();
      linkedListing = {
        id: osBiz.id,
        slug: osBiz.slug,
        display_name: osBiz.display_name,
        hammerex_id: hammerex?.id ?? ""
      };
    }
  }

  // Pending invite for this engagement?
  const { data: pendingInvite } = engagement.business_id
    ? { data: null }
    : await supabaseAdmin
        .from("os_homeowner_trade_invites")
        .select("id, invited_email, sent_at, expires_at")
        .eq("engagement_id", engagementId)
        .eq("status", "pending")
        .maybeSingle();

  const site = Array.isArray(engagement.site) ? engagement.site[0] : engagement.site;
  const showFinancials = hasFinancialAccess(active);
  const canSignOff = showFinancials;
  const canTransition = meetsRole(active.role, "foreman");

  // Prior payments on this engagement — powers the balance shown in the sign-off form.
  const { data: engagementPayments } = await supabaseAdmin
    .from("os_project_payments")
    .select("id, amount_pence, status, payment_type, paid_at, notes")
    .eq("engagement_id", engagementId)
    .order("paid_at", { ascending: true });
  const priorPaidPence = (engagementPayments ?? [])
    .filter(
      (p) => p.status === "both_confirmed" || p.status === "recorded"
    )
    .reduce((sum, p) => sum + p.amount_pence, 0);

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
            href={`/home/sites/${siteId}`}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            {site?.name ?? "Site"}
          </Link>
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              STATUS_STYLE[engagement.status] ?? "bg-[#1B1A17]/5 text-[#1B1A17]/60"
            }`}
          >
            {engagement.status.replace(/_/g, " ")}
          </span>
        </div>

        <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-300">
              Engagement
            </p>
            <h1 className="mt-2 text-[28px] font-bold leading-tight md:text-[36px]">
              {engagement.hired_display_name}
            </h1>
            <p className="mt-1 text-[13px] capitalize text-[#1B1A17]/60">
              {engagement.hired_trade.replace(/-/g, " ")}
            </p>
          </div>
          {engagement.captured_via === "ai_vision" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-200">
              <ImageIcon className="h-3 w-3" aria-hidden />
              AI captured
            </span>
          ) : null}
        </div>

        {/* Service + money */}
        {engagement.service_description ? (
          <p className="mt-6 rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-4 text-[14px] leading-[1.55] text-[#1B1A17]/80">
            {engagement.service_description}
          </p>
        ) : null}

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          {showFinancials ? (
            <>
              <Stat
                label="Agreed total"
                value={
                  engagement.agreed_price_pence
                    ? `£${(engagement.agreed_price_pence / 100).toLocaleString("en-GB")}`
                    : "—"
                }
              />
              <Stat
                label="Deposit"
                value={
                  engagement.deposit_pence
                    ? `£${(engagement.deposit_pence / 100).toLocaleString("en-GB")}`
                    : "—"
                }
              />
              <Stat
                label="Currency"
                value={engagement.currency || "GBP"}
              />
            </>
          ) : (
            <>
              <Stat
                label="Start"
                value={
                  engagement.agreed_start_date
                    ? new Date(engagement.agreed_start_date).toLocaleDateString("en-GB")
                    : "—"
                }
              />
              <Stat
                label="End"
                value={
                  engagement.agreed_end_date
                    ? new Date(engagement.agreed_end_date).toLocaleDateString("en-GB")
                    : "—"
                }
              />
              <Stat
                label="Status"
                value={engagement.status.replace(/_/g, " ")}
              />
            </>
          )}
        </section>

        {/* Timeline */}
        {(engagement.agreed_start_date || engagement.agreed_end_date) ? (
          <section className="mt-6 rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#1B1A17]/55">
              Timeline
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px] text-[#1B1A17]/80">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-amber-300" aria-hidden />
                {engagement.agreed_start_date
                  ? new Date(engagement.agreed_start_date).toLocaleDateString(
                      "en-GB"
                    )
                  : "no start"}
              </span>
              <span className="text-[#1B1A17]/45">→</span>
              <span className="inline-flex items-center gap-1.5">
                <ClipboardCheck className="h-3.5 w-3.5 text-amber-300" aria-hidden />
                {engagement.agreed_end_date
                  ? new Date(engagement.agreed_end_date).toLocaleDateString(
                      "en-GB"
                    )
                  : "no end"}
              </span>
            </div>
          </section>
        ) : null}

        {/* Notes */}
        {engagement.notes ? (
          <section className="mt-6 rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#1B1A17]/55">
              Notes
            </p>
            <p className="mt-2 whitespace-pre-wrap text-[14px] leading-[1.55] text-[#1B1A17]/80">
              {engagement.notes}
            </p>
          </section>
        ) : null}

        {/* Source image */}
        {engagement.captured_source_url ? (
          <section className="mt-6">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#1B1A17]/55">
              Captured source
            </p>
            <div className="relative mt-3 aspect-video overflow-hidden rounded-2xl border border-[#1B1A17]/12 bg-[#FBF6EC]">
              <Image
                src={engagement.captured_source_url}
                alt="Original captured agreement"
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          </section>
        ) : null}

        {engagement.business_id ? (
          <section className="mt-8">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#1B1A17]/55">
              Direct message
            </p>
            <div className="mt-3">
              <Link
                href={`/home/sites/${siteId}/engagements/${engagementId}/chat`}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#1B1A17]/4 border border-[#1B1A17]/15 px-5 text-[13px] font-semibold text-[#1B1A17] hover:bg-[#1B1A17]/5"
              >
                <MessageSquareText className="h-4 w-4" aria-hidden />
                Open thread with {engagement.hired_display_name}
              </Link>
            </div>
          </section>
        ) : null}

        {/* Status controls */}
        <section className="mt-8">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#1B1A17]/55">
            Status
          </p>
          <div className="mt-3">
            <EngagementControls
              siteId={siteId}
              engagementId={engagementId}
              currentStatus={engagement.status}
              agreedPricePence={engagement.agreed_price_pence}
              priorPaidPence={priorPaidPence}
              canSignOff={canSignOff}
              canTransition={canTransition}
            />
          </div>
        </section>

        {/* Payments recorded against this engagement */}
        {showFinancials && (engagementPayments ?? []).length > 0 ? (
          <section className="mt-8">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#1B1A17]/55">
              Payments on this engagement
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
                    {p.status}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Trade link / invite */}
        <section className="mt-8">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#1B1A17]/55">
            Trade Notebook
          </p>

          {linkedListing ? (
            <div className="mt-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2
                  className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-[#1B1A17]">
                    Linked to {linkedListing.display_name}
                  </p>
                  <p className="mt-1 text-[12px] text-[#1B1A17]/60">
                    Their Notebook is on record — this engagement lives on
                    both sides.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={`/trade/${linkedListing.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-emerald-500/25 px-4 text-[13px] font-semibold text-emerald-100 hover:bg-emerald-500/35"
                    >
                      View public Notebook
                      <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                    {linkedListing.hammerex_id ? (
                      <Link
                        href={`/home/trades/${linkedListing.hammerex_id}`}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-[#1B1A17]/20 bg-[#1B1A17]/4 px-4 text-[13px] font-semibold text-[#1B1A17] hover:bg-[#1B1A17]/5"
                      >
                        Open trade file
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : pendingInvite ? (
            <div className="mt-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
              <div className="flex items-start gap-3">
                <UserPlus
                  className="mt-0.5 h-5 w-5 shrink-0 text-amber-300"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-[#1B1A17]">
                    Invitation pending
                  </p>
                  <p className="mt-1 text-[12px] text-[#1B1A17]/60">
                    Sent to <b>{pendingInvite.invited_email}</b>{" "}
                    {pendingInvite.sent_at
                      ? `on ${new Date(pendingInvite.sent_at).toLocaleDateString("en-GB")}`
                      : ""}
                    . When {engagement.hired_display_name} opens their
                    Notebook, this engagement will auto-link.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-4">
              <div className="flex items-start gap-3">
                <UserPlus
                  className="mt-0.5 h-5 w-5 shrink-0 text-amber-300"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-[#1B1A17]">
                    Invite {engagement.hired_display_name} to a free Notebook
                  </p>
                  <p className="mt-1 text-[13px] leading-[1.55] text-[#1B1A17]/60">
                    Send them a Notebook invitation. When they join, this
                    engagement will link to their new Notebook automatically —
                    no re-typing, no lookup.
                  </p>
                  <div className="mt-4">
                    <InviteTradeForm
                      siteId={siteId}
                      engagementId={engagementId}
                      hiredDisplayName={engagement.hired_display_name}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-4">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#1B1A17]/55">
        {label}
      </div>
      <div className="mt-2 text-[20px] font-black leading-none text-[#1B1A17]">
        {value}
      </div>
    </div>
  );
}

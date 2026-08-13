// /nex-app/refacing/companies/[slug] · Trade details page (2026-08-13).
//
// The "View Details" primary CTA on every trade card lands here per the
// standing NEX Trade Card Rule (memory: project_nex_trade_card_rule_2026_08_13.md).
//
// Renders the richer trade profile: business info · services · location ·
// description · NEX business information · plus a prominent "Contact Company"
// button that opens NEX Chat.
//
// Governance:
//   · Contact Company always opens NEX Chat (never tel:/mailto:) — Rule 2.
//   · Direct phone / email never surface on this page as call/mail actions.
//     Trade's telephone is only shown as text metadata (context, not action)
//     for paid Refacing Trade Members whose profile is under their control.
//   · The "Is this your business?" claim invitation lives INSIDE this page,
//     not on the public card — it addresses the trade owner, not homeowners.

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, ShieldCheck, MessageSquare, Hammer, Building2, Wrench } from "lucide-react";
import { supabaseNexAdmin } from "@/lib/supabaseNexAdmin";
import { isPaidMember } from "@/lib/nex/centre-publishing/paidMemberEntitlements";
import { REFACING_CAPABILITY_LABELS } from "@/lib/nex/centre-publishing/categories";

export const dynamic = "force-dynamic";

// Custom NEX website icon (replaces lucide Globe · matches the TradeProfileSheet
// slider so the deep-link details page and the slider look consistent).
const WEBSITE_ICON_SRC =
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2013,%202026,%2004_31_39%20PM.png";

type Params = Promise<{ slug: string }>;

async function loadListing(slug: string) {
  const res = await supabaseNexAdmin
    .from("directory_seeds")
    .select(
      "id, slug, business_name, category, primary_trade, town, county, postcode, telephone, email, website, description, services, capabilities, refacing_qualification, directory_state, verified, claimed, cover_image, tags",
    )
    .eq("slug", slug)
    .maybeSingle();
  return res.data ?? null;
}

const ORANGE = "#F97316";

export default async function TradeDetailsPage({ params }: { params: Params }) {
  const { slug } = await params;
  const listing = await loadListing(slug);
  if (!listing) notFound();

  const partner = isPaidMember(listing);
  const isUnclaimed = (listing.directory_state ?? "listed") === "listed";
  const contactHref = `/nex-app/refacing/companies/${encodeURIComponent(listing.slug)}/ask`;
  const claimHref = `/nex-app/claim?listing_id=${encodeURIComponent(listing.slug)}`;

  const location = [listing.town, listing.county, listing.postcode].filter(Boolean).join(", ");
  const capabilityKeys = Object.entries(listing.capabilities ?? {})
    .filter(([, v]) => v === "yes")
    .map(([k]) => k);
  const capabilityLabels = capabilityKeys
    .map((k) => REFACING_CAPABILITY_LABELS[k] ?? k)
    .slice(0, 24);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <Link href="/nex-app/refacing/companies" className="inline-flex items-center gap-1 text-sm text-black/60 hover:text-black">
          <ArrowLeft size={14} strokeWidth={2} /> Back to directory
        </Link>
        <Link href="/nex-app" aria-label="NEX home" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/nex-logo.png" alt="NEX" className="h-6 w-auto object-contain" />
        </Link>
      </div>

      {/* Hero + identity */}
      <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
        <div className="relative w-full bg-neutral-100">
          {listing.cover_image ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={listing.cover_image}
              alt={listing.business_name}
              className="block h-auto max-h-[420px] w-full object-cover"
            />
          ) : (
            <div className="grid aspect-[16/9] w-full place-items-center bg-gradient-to-br from-amber-100 to-orange-200 text-black/40">
              <Hammer size={40} strokeWidth={1.5} />
            </div>
          )}
          {partner && (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-sm">
              <ShieldCheck size={12} strokeWidth={2.5} />
              NEX Refacing Member
            </span>
          )}
          {isUnclaimed && (
            <span className="absolute right-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-black/70 shadow-sm">
              Unclaimed
            </span>
          )}
        </div>

        <div className="p-6">
          <div className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: ORANGE }}>
            NEX · Trade profile
          </div>
          <h1 className="mt-1 text-2xl font-black leading-tight">{listing.business_name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-black/70">
            {location && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} strokeWidth={2} className="text-black/50" />
                {location}
              </span>
            )}
            {listing.category && (
              <span className="inline-flex items-center rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black/60">
                {listing.category}
              </span>
            )}
          </div>

          {listing.description && (
            <p className="mt-4 text-[13px] leading-relaxed text-black/75">{listing.description}</p>
          )}

          {/* NEX TRADE CARD RULE · Contact Company button opens NEX Chat.
              Never a tel: link, never a mailto: link. NEX owns the enquiry journey. */}
          <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
            <Link
              href={contactHref}
              className="flex items-center justify-center gap-2 rounded-full py-3 text-sm font-black uppercase tracking-wider text-white transition-transform active:scale-95"
              style={{ background: ORANGE, boxShadow: "0 6px 18px rgba(249,115,22,0.35)" }}
            >
              <MessageSquare size={14} strokeWidth={2.5} />
              Contact Company
            </Link>
            {listing.website && (
              <a
                href={listing.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-black/10 bg-white px-4 py-3 text-[12px] font-semibold text-black/70 shadow-sm hover:bg-black/[0.03]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={WEBSITE_ICON_SRC}
                  alt=""
                  aria-hidden="true"
                  className="h-4 w-4 object-contain"
                />
                Visit website
              </a>
            )}
          </div>
          <p className="mt-2 text-center text-[11px] text-black/50">
            All enquiries flow through NEX Chat. NEX routes your enquiry to a suitable Refacing Trade Member.
          </p>
        </div>
      </section>

      {/* Services / capabilities */}
      {capabilityLabels.length > 0 && (
        <section className="mt-4 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-black/80">
            <Wrench size={14} strokeWidth={2.2} />
            Services this trade performs
          </h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {capabilityLabels.map((label) => (
              <span
                key={label}
                className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700 ring-1 ring-orange-200"
              >
                {label}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* NEX business information */}
      <section className="mt-4 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-black/80">
          <Building2 size={14} strokeWidth={2.2} />
          NEX business information
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-[13px] sm:grid-cols-2">
          <InfoRow label="Directory state" value={humaniseState(listing.directory_state ?? "listed")} />
          {listing.refacing_qualification && (
            <InfoRow label="NEX qualification" value={String(listing.refacing_qualification)} hint="Ranking signal, not access gate." />
          )}
          <InfoRow label="NEX member" value={partner ? "Refacing Trade Member" : "Not a paid member"} />
          {listing.verified && <InfoRow label="Verified" value="Yes" />}
        </dl>
        <p className="mt-3 text-[11px] leading-snug text-black/50">
          NEX qualification (A+/A/B/C) affects ranking and quality signals only · never a gate. Membership eligibility is the sole requirement for receiving routed enquiries.
        </p>
      </section>

      {/* Trade-owner claim invitation (lives INSIDE the details page, per Trade Card Rule) */}
      {isUnclaimed && (
        <section className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <Hammer size={22} strokeWidth={2.2} style={{ color: ORANGE }} className="mt-0.5 shrink-0" />
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: ORANGE }}>
                Trade owner
              </div>
              <div className="mt-1 text-[14px] font-black">Is this your business?</div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-black/70">
                Claim your NEX profile to take control · then activate your Refacing Trade Member subscription so NEX can route homeowner enquiries to your NEX Chat inbox.
              </p>
              <Link
                href={claimHref}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-orange-300 bg-white px-4 py-2 text-[12px] font-semibold text-orange-700 shadow-sm hover:bg-orange-100"
              >
                Claim this business →
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function InfoRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-black/[0.02] px-3 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-black/50">{label}</dt>
      <dd className="mt-0.5 font-semibold text-black/85">{value}</dd>
      {hint && <div className="text-[10.5px] text-black/50">{hint}</div>}
    </div>
  );
}

function humaniseState(s: string): string {
  switch (s) {
    case "paid_member": return "Refacing Trade Member (paid)";
    case "claimed":     return "Claimed by owner";
    case "verified":    return "NEX verified";
    case "listed":      return "Listed · unclaimed";
    default:            return s;
  }
}

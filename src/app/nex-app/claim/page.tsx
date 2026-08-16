// /nex-app/claim · Trade Journey page (2026-08-13 · v2 per Philip's spec).
//
// One page · one journey for every listing:
//
//   Directory card → Claim → Confirm → ✓ Claimed → Membership upsell →
//   Payment → Paid Member → Homeowner enquiries via NEX Chat
//
// State is derived server-side from the seed's directory_state +
// refacing_qualification. The CTA + progress table + upsell all change
// based on where the trade currently is in the journey. Never fakes state.
//
// Wording rules (docs/refacing/REFACING-MEMBER-ENTITLEMENT-SPEC.md § 6):
//   · USE: "Get homeowner enquiries directly through NEX Chat."
//          "Eligible to receive suitable enquiries via NEX Chat."
//   · DO NOT use: "Pay to get leads." · "Every paid member receives enquiries."
//   · Membership ACCESS + Trade Exchange ELIGIBILITY. Trade Exchange decides
//     suitability per enquiry — being a paid member is not a promise of volume.
//   · Qualification (A+/A/B/C) affects ranking and quality signals only · NEVER a gate.

import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Clock, Hammer, MapPin, Mail, Phone, Globe, ShieldCheck } from "lucide-react";
import { supabaseNexAdmin } from "@/lib/supabaseNexAdmin";
import { REFACING_TRADE_MEMBER } from "@/lib/nex/centre-publishing/refacingMembership";
import { ClaimForm } from "./ClaimForm";
import { formatProfileLocation } from "@/lib/nex/geography/formatAddress";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "NEX · Claim your business",
};

const ORANGE = "#F97316";

type SearchParams = Promise<{ listing_id?: string }>;

async function loadListing(listing_id: string) {
  const bySlug = await supabaseNexAdmin
    .from("directory_seeds")
    .select("id, slug, business_name, town, county, postcode, region, country, telephone, website, email, category, refacing_qualification, directory_state, lifecycle_status, verified, description, services")
    .eq("slug", listing_id)
    .maybeSingle();
  if (bySlug.data) return bySlug.data;
  const byId = await supabaseNexAdmin
    .from("directory_seeds")
    .select("id, slug, business_name, town, county, postcode, region, country, telephone, website, email, category, refacing_qualification, directory_state, lifecycle_status, verified, description, services")
    .eq("id", listing_id)
    .maybeSingle();
  return byId.data;
}

export default async function ClaimPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const listing_id = sp.listing_id ?? "";
  const listing = listing_id ? await loadListing(listing_id) : null;

  if (!listing_id) return <NoListingId />;
  if (!listing)    return <ListingNotFound listing_id={listing_id} />;

  const ds = (listing.directory_state ?? "listed") as "listed" | "verified" | "claimed" | "paid_member";
  const lc = (listing.lifecycle_status ?? "unclaimed");
  const q  = listing.refacing_qualification as "A+" | "A" | "B" | "C" | "excluded" | null;
  const isClaimRequested = lc === "claim_requested" || lc === "claim_pending";
  const isClaimed = ds === "claimed" || ds === "paid_member";
  const isMember  = ds === "paid_member";
  // Business rule (Philip 2026-08-13 update): paid_member alone = Trade Exchange eligible.
  // Qualification (A+/A/B/C) preserved for ranking/quality display only, not as a gate.
  const isExchangeEligible = isMember;

  const locationLine = formatProfileLocation({
    country: (listing.country as string | null) ?? null,
    city: (listing.town as string | null) ?? null,
    county: (listing.county as string | null) ?? null,
    region: (listing.region as string | null) ?? null,
    postcode: (listing.postcode as string | null) ?? null,
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header · Back link left · NEX brand top-right */}
      <div className="mb-6 flex items-center justify-between">
        <Link href="/nex-app/refacing/companies" className="inline-flex items-center gap-1 text-sm text-black/60 hover:text-black">
          <ArrowLeft size={14} strokeWidth={2} />
          Back to directory
        </Link>
        <Link href="/nex-app" aria-label="NEX home" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/nex-logo.png" alt="NEX" className="h-6 w-auto object-contain" />
        </Link>
      </div>

      {/* ── 1. Identity + primary CTA ────────────────────────── */}
      <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        <div className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: ORANGE }}>
          NEX · {isClaimed ? "Your business" : "Claim your business"}
        </div>
        <h1 className="mt-1 text-2xl font-black leading-tight">{listing.business_name}</h1>

        {/* Directory details */}
        <dl className="mt-3 space-y-1.5 text-sm text-black/75">
          {locationLine && (
            <div className="flex items-center gap-2"><MapPin size={13} strokeWidth={2} className="text-black/45" /><span>{locationLine}</span></div>
          )}
          {listing.telephone && (
            <div className="flex items-center gap-2"><Phone size={13} strokeWidth={2} className="text-black/45" /><span>{listing.telephone}</span></div>
          )}
          {listing.website && (
            <div className="flex items-center gap-2"><Globe size={13} strokeWidth={2} className="text-black/45" /><a href={listing.website} target="_blank" rel="noopener noreferrer" className="text-orange-600 underline">{listing.website}</a></div>
          )}
          {listing.email && (
            <div className="flex items-center gap-2"><Mail size={13} strokeWidth={2} className="text-black/45" /><span>{listing.email}</span></div>
          )}
          {listing.category && (
            <div className="mt-1"><span className="inline-flex items-center rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black/60">{listing.category}</span></div>
          )}
        </dl>

        {/* Provenance line */}
        {!isClaimed && (
          <p className="mt-4 text-[13px] leading-snug text-black/60">
            This profile was created from publicly available business information. Claim it to take control of your NEX business profile.
          </p>
        )}

        {/* State-driven CTA */}
        <div className="mt-5">
          {isClaimed ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 font-black uppercase tracking-wider text-emerald-800">
                <CheckCircle2 size={18} strokeWidth={2.5} />
                Business claimed
              </div>
              <p className="mt-1 text-[13px] text-emerald-900/80">
                Your NEX profile is now under your control.
              </p>
            </div>
          ) : isClaimRequested ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 font-black uppercase tracking-wider text-amber-800">
                <Clock size={18} strokeWidth={2.5} />
                Claim request received
              </div>
              <p className="mt-1 text-[13px] text-amber-900/80">
                NEX is verifying your ownership. We&apos;ll be in touch shortly at the email you supplied.
              </p>
            </div>
          ) : (
            <ClaimForm listing_id={listing.slug} business_name={listing.business_name} defaultEmail={listing.email ?? ""} />
          )}
        </div>
      </section>

      {/* ── 2. What claiming means (only when unclaimed) ───── */}
      {!isClaimed && !isClaimRequested && (
        <section className="mt-4 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-black uppercase tracking-wider text-black/80">When you claim your profile, you can:</h2>
          <ul className="mt-3 grid grid-cols-1 gap-1.5 text-[13px] text-black/75 sm:grid-cols-2">
            {[
              "Correct your company information",
              "Add your logo",
              "Add photos of your work",
              "Add your services",
              "Add your service areas",
              "Add your contact details",
              "Manage your NEX business profile",
              "See your NEX business status",
            ].map((b) => (
              <li key={b} className="flex items-center gap-2">
                <CheckCircle2 size={14} strokeWidth={2.2} className="shrink-0" style={{ color: ORANGE }} />
                {b}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── 3. Membership upsell (only when claimed but not yet a paid member) ──── */}
      {isClaimed && !isMember && (
        <section className="mt-4 rounded-2xl border-2 border-orange-300 bg-white p-6 shadow-md">
          <div className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: ORANGE }}>Next step</div>
          <h2 className="mt-1 text-xl font-black leading-tight">
            Get homeowner enquiries directly through NEX Chat.
          </h2>
          <div className="mt-2 text-sm font-bold" style={{ color: ORANGE }}>{REFACING_TRADE_MEMBER.displayName} · {REFACING_TRADE_MEMBER.tagline}</div>
          <p className="mt-2 text-[13px] leading-relaxed text-black/70">
            {REFACING_TRADE_MEMBER.intro}
          </p>

          <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-black">{REFACING_TRADE_MEMBER.monthlyPriceLabel}</span>
              <span className="text-[13px] text-black/60">/ month</span>
            </div>
            <ul className="mt-3 space-y-1 text-[12.5px] text-black/75">
              {REFACING_TRADE_MEMBER.valueProps.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <CheckCircle2 size={13} strokeWidth={2.2} className="mt-0.5 shrink-0" style={{ color: ORANGE }} />
                  {b}
                </li>
              ))}
            </ul>
          </div>

          <Link
            href={`/nex-app/membership?listing_id=${encodeURIComponent(listing.slug)}`}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-black uppercase tracking-wider text-white transition-transform active:scale-95"
            style={{ background: ORANGE, boxShadow: "0 6px 18px rgba(249,115,22,0.35)" }}
          >
            {REFACING_TRADE_MEMBER.primaryCtaLabel}
            <ArrowRight size={16} strokeWidth={2.5} />
          </Link>

          <p className="mt-3 text-[11px] leading-snug text-black/50">
            {REFACING_TRADE_MEMBER.qualificationFootnote}
          </p>
        </section>
      )}

      {/* ── 4. Progress table (Your NEX Status) ─────────────── */}
      <section className="mt-4 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-black uppercase tracking-wider text-black/80">Your NEX status</h2>
        <div className="mt-3 divide-y divide-black/5">
          <StatusRow label="Business listed"     state="done" />
          <StatusRow label="Business claimed"    state={isClaimed ? "done" : isClaimRequested ? "in-progress" : "pending"} />
          <StatusRow label="Business verified"   state={ds === "verified" || isClaimed ? "done" : "pending"} />
          <StatusRow label="Refacing Member"     state={isMember ? "done" : "pending"} />
          <StatusRow
            label="Trade Exchange"
            state={isExchangeEligible ? "done" : "pending"}
          />
        </div>

        {/* Qualification badge if genuinely assigned */}
        {q && (
          <div className="mt-4 flex items-center gap-2 text-[11px]">
            <span className="font-semibold uppercase tracking-wider text-black/50">NEX qualification:</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 font-black" style={{ color: ORANGE }}>
              <ShieldCheck size={11} strokeWidth={2.5} />
              {q}
            </span>
          </div>
        )}
      </section>
    </div>
  );
}

// ── State row for the progress table ─────────────────────────
function StatusRow({ label, state, hint }: { label: string; state: "done" | "in-progress" | "pending"; hint?: string }) {
  return (
    <div className="flex items-start justify-between py-2.5">
      <div>
        <div className="text-sm text-black/85">{label}</div>
        {hint && <div className="text-[11px] text-black/50">{hint}</div>}
      </div>
      <div className="ml-3 flex items-center gap-1 text-[11.5px] font-semibold uppercase tracking-wider">
        {state === "done" && (<><CheckCircle2 size={14} strokeWidth={2.5} className="text-emerald-600" /><span className="text-emerald-700">Complete</span></>)}
        {state === "in-progress" && (<><Clock size={14} strokeWidth={2.5} className="text-amber-600" /><span className="text-amber-700">In progress</span></>)}
        {state === "pending" && (<><Circle size={14} strokeWidth={2.2} className="text-black/30" /><span className="text-black/50">Not yet</span></>)}
      </div>
    </div>
  );
}

// ── Fallback states ─────────────────────────────────────────
function NoListingId() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/nex-app/refacing/companies" className="inline-flex items-center gap-1 text-sm text-black/60 hover:text-black">
          <ArrowLeft size={14} strokeWidth={2} /> Back to directory
        </Link>
        <Link href="/nex-app" aria-label="NEX home" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/nex-logo.png" alt="NEX" className="h-6 w-auto object-contain" />
        </Link>
      </div>
      <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Hammer size={22} strokeWidth={2.2} style={{ color: ORANGE }} />
          <h1 className="text-xl font-black">No listing id supplied</h1>
        </div>
        <p className="mt-2 text-sm text-black/60">
          Visit the <Link href="/nex-app/refacing/companies" className="font-semibold text-orange-600 underline">refacing directory</Link> and click <em>Claim this business</em> on your listing.
        </p>
      </div>
    </div>
  );
}

function ListingNotFound({ listing_id }: { listing_id: string }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/nex-app/refacing/companies" className="inline-flex items-center gap-1 text-sm text-black/60 hover:text-black">
          <ArrowLeft size={14} strokeWidth={2} /> Back to directory
        </Link>
        <Link href="/nex-app" aria-label="NEX home" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/nex-logo.png" alt="NEX" className="h-6 w-auto object-contain" />
        </Link>
      </div>
      <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-black">Listing not found</h1>
        <p className="mt-2 text-sm text-black/70">
          NEX couldn&apos;t find a listing with id <span className="rounded bg-black/[0.05] px-1 py-0.5 font-mono text-[11px]">{listing_id}</span>. It may have been removed. Please email <a href="mailto:asknexapp@gmail.com" className="font-semibold text-orange-600 underline">asknexapp@gmail.com</a> and quote this id.
        </p>
      </div>
    </div>
  );
}

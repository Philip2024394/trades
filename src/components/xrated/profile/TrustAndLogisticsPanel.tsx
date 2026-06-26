// Xrated Trades — "What to know before you message" panel.
//
// Renders the full insurance £ amount, qualifications, memberships,
// DBS / transport / tools / free-quote flags, years-in-trade, minimum
// job, and the tradesperson's current status note. Used on
// /trade/<slug>/contact above the contact form so customers see the
// detailed trust picture right before they message. The main profile
// page surfaces a condensed chip row under About Us instead.

import type { HammerexTradeOffListing } from "@/lib/supabase";

export function TrustAndLogisticsPanel({
  listing
}: {
  listing: HammerexTradeOffListing;
}) {
  const hasAnyTrust =
    listing.is_insured ||
    listing.has_own_transport ||
    listing.has_own_tools ||
    listing.dbs_checked ||
    listing.free_site_visits ||
    (listing.qualifications && listing.qualifications.length > 0) ||
    (listing.trade_memberships && listing.trade_memberships.length > 0) ||
    typeof listing.minimum_job_gbp === "number" ||
    typeof listing.years_in_trade === "number" ||
    (listing.current_status_note && listing.current_status_note.trim().length > 0) ||
    (listing.quote_availability && listing.quote_availability.trim().length > 0);

  if (!hasAnyTrust) return null;

  const insuredLabel =
    listing.is_insured && typeof listing.insurance_cover_gbp === "number"
      ? `£${
          Math.round(listing.insurance_cover_gbp / 1_000_000) >= 1 &&
          listing.insurance_cover_gbp % 1_000_000 === 0
            ? `${listing.insurance_cover_gbp / 1_000_000}M`
            : listing.insurance_cover_gbp.toLocaleString("en-GB")
        } cover`
      : listing.is_insured
        ? "Insured"
        : "Not confirmed";

  return (
    <section className="w-full px-4 pt-6 sm:pt-8">
      <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
        What to know before you message
      </h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <TrustCard
          label="Insured"
          status={listing.is_insured ? "yes" : "no"}
          detail={insuredLabel}
        />
        <TrustCard
          label="Own transport"
          status={listing.has_own_transport ? "yes" : "no"}
          detail={listing.has_own_transport ? "Has own van / vehicle" : "Not confirmed"}
        />
        <TrustCard
          label="Own tools"
          status={listing.has_own_tools ? "yes" : "no"}
          detail={listing.has_own_tools ? "Brings own kit" : "Not confirmed"}
        />
        <TrustCard
          label="DBS checked"
          status={listing.dbs_checked ? "yes" : "no"}
          detail={listing.dbs_checked ? "Background-checked" : "Not confirmed"}
        />
        <TrustCard
          label="Free site visits"
          status={listing.free_site_visits ? "yes" : "no"}
          detail={
            listing.quote_availability && listing.quote_availability.trim().length > 0
              ? listing.quote_availability
              : listing.free_site_visits
                ? "Free quote visit"
                : "Not confirmed"
          }
        />
      </div>

      {/* Qualifications + memberships + years-in-trade + minimum-job
          chips removed — the hero "Fully insured / Licensed / Registered"
          pills + stats-grid years column already cover the headline
          signal. Detail lives in the seven trust cards above. */}

      {listing.current_status_note &&
        listing.current_status_note.trim().length > 0 && (
          <p className="mt-3 text-[13px] italic text-neutral-500">
            {`💼 ${listing.current_status_note.trim()}`}
          </p>
        )}
    </section>
  );
}

function TrustCard({
  label,
  status,
  detail
}: {
  label: string;
  status: "yes" | "no" | "muted";
  detail: string;
}) {
  const tickColor = "#10B981";
  const crossColor = "#9CA3AF";
  const isYes = status === "yes";
  return (
    <div className="flex items-start gap-2 rounded-lg border border-neutral-200 bg-white p-3">
      <span
        className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
        style={{ background: isYes ? `${tickColor}1A` : `${crossColor}1A` }}
        aria-hidden="true"
      >
        {isYes ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={tickColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={crossColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )}
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-neutral-900">{label}</p>
        <p className="text-xs text-neutral-500">{detail}</p>
      </div>
    </div>
  );
}

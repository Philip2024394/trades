// Xrated Trades — shared premium hero block.
//
// Renders banner + left-overlay profile card + stats grid. Used on the
// public profile (`/trade/<slug>`), the contact subpage
// (`/trade/<slug>/contact`), and any future subpage that needs the
// "always show the hero" identity strip the user asked for.
//
// Pure server component — derives everything (rating, trust badges, hero
// image) from the listing record. No client state.

import type { HammerexTradeOffListing } from "@/lib/supabase";
import { tradeLabel } from "@/lib/tradeOff";
import { resolveAppHero } from "@/lib/tradeAppBanners";
import { getTrustLevel, TRUST_LEVEL_META } from "@/lib/xratedTrustLevel";
import { getTrustScore, getTrustScoreBand } from "@/lib/trustScore";
import { BusinessCardButton } from "./BusinessCardButton";

export function PremiumHero({
  listing,
  waUrl,
  currentPage = "profile",
  tier = "paid"
}: {
  listing: HammerexTradeOffListing;
  waUrl: string;
  /** When set to "contact", the yellow Message button morphs to a
   *  "Home page" link back to the public profile so the customer can
   *  always retreat to the landing page from any subpage. */
  currentPage?: "profile" | "contact";
  /** Free profiles strip the Contact us + Call Now CTAs from the hero
   *  — only WhatsApp remains, full-width across the row. */
  tier?: "free" | "paid";
}) {
  const isPaid = tier === "paid";
  const isContact = currentPage === "contact";
  const primaryCta = isContact
    ? {
        href: `/${listing.slug}`,
        label: "Home page",
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m3 12 9-9 9 9" />
            <path d="M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10" />
          </svg>
        )
      }
    : {
        href: `/trade/${listing.slug}/contact`,
        label: "Contact us",
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )
      };
  const primary = tradeLabel(listing.primary_trade);
  // Hero title = the trade label itself. The renamed labels already
  // embed the work type ("Kitchen Installation", "Stair Manufacture",
  // "Building Merchant", "Tool Hire") so tacking on " Service" reads
  // as redundant or wrong. For pure labour-only trades ("Plumber",
  // "Carpenter") the bare label is intentional — it matches how the
  // gallery cards on /trade-off/trades render and what shows up in
  // the BusinessCardButton share modal.
  const tradeServiceLabel = primary;
  const subtitle =
    (listing.services_offered ?? []).slice(0, 2).join(" & ") ||
    (listing.trading_name ?? "");
  const rating =
    typeof listing.rating_avg === "number" && listing.rating_avg > 0
      ? listing.rating_avg.toFixed(1)
      : null;
  const reviewCount = listing.rating_count ?? 0;
  // Phone CTA removed from the hero in favour of the Business Card
  // modal — buyers tap Card to see phone + email + WhatsApp + save
  // vCard. The trade's `phone_calls_enabled` flag inside the modal
  // controls whether the tap-to-call row is rendered.

  const trustBadges = [
    listing.is_insured ? { label: "Fully insured", icon: "shield" } : null,
    listing.qualifications && listing.qualifications.length > 0
      ? { label: "Licensed", icon: "license" }
      : null,
    listing.trade_memberships && listing.trade_memberships.length > 0
      ? { label: "Registered", icon: "check" }
      : null
  ].filter((b): b is { label: string; icon: string } => b !== null);

  const heroUrl = resolveAppHero({
    custom_app_hero_url: listing.custom_app_hero_url,
    primary_trade: listing.primary_trade,
    tier: listing.tier,
    last_payment_plan: listing.last_payment_plan
  });

  const trustLevel = getTrustLevel(listing);
  const trustLabel = TRUST_LEVEL_META[trustLevel].label;
  const trustScore = getTrustScore(listing);
  const trustBand = getTrustScoreBand(trustScore);
  // Circumference of r=46 on a 100-unit viewBox = 2π × 46 ≈ 289.
  // strokeDasharray paints the proportion of the circle equal to the
  // score's % of 100. -rotate-90 rotates the start point to 12 o'clock.
  const ringCircumference = 2 * Math.PI * 46;
  const ringDashOffset = ringCircumference * (1 - trustScore / 100);

  return (
    <>
      <section className="relative h-[260px] w-full overflow-hidden bg-neutral-900 sm:h-[380px]">
        {heroUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={heroUrl}
            alt={`${listing.display_name} — ${primary} hero`}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.6) 30%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0) 70%)"
          }}
        />

        <div className="absolute inset-y-0 left-0 z-10 flex w-full items-center px-3 sm:px-8">
          <div className="w-full max-w-md">
            <div className="flex items-start gap-4 sm:gap-5">
              <div className="relative shrink-0">
                {/* Avatar wrapper — circular Trust Score progress ring
                    surrounds the photo. Yellow arc = points earned out
                    of 100. The avatar itself sits inset inside the ring
                    so the photo isn't obscured. */}
                <div className="relative h-24 w-24 sm:h-28 sm:w-28">
                  {/* Background ring (full circle, faded) + earned arc */}
                  <svg
                    className="absolute inset-0 h-full w-full -rotate-90"
                    viewBox="0 0 100 100"
                    aria-hidden="true"
                  >
                    <circle
                      cx="50"
                      cy="50"
                      r="46"
                      fill="none"
                      stroke="rgba(255,255,255,0.18)"
                      strokeWidth="5"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="46"
                      fill="none"
                      stroke="#FFB300"
                      strokeWidth="5"
                      strokeDasharray={ringCircumference.toFixed(2)}
                      strokeDashoffset={ringDashOffset.toFixed(2)}
                      strokeLinecap="round"
                    />
                  </svg>
                  {/* Avatar inset inside the ring */}
                  <div
                    className="absolute inset-[7px] overflow-hidden rounded-full sm:inset-[8px]"
                    style={{ boxShadow: "0 6px 16px rgba(0,0,0,0.45)" }}
                  >
                    {listing.avatar_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={listing.avatar_url}
                        alt={listing.display_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center bg-black"
                        aria-label={`X-Rated Level ${trustLevel} — ${trustLabel}`}
                        title={`X-Rated Level ${trustLevel} — ${trustLabel}`}
                      >
                        <span
                          className="text-2xl font-extrabold leading-none sm:text-3xl"
                          style={{ color: "var(--trade-accent, #FFB300)", letterSpacing: "0.05em" }}
                        >
                          X{trustLevel}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                {/* Trust Score badge — replaces the X{level} badge.
                    Shows the live 0-100 number. Click-through to the
                    marketing page so customers can read what the number
                    means. */}
                <a
                  href="/trade-off/trust"
                  className="absolute -bottom-1.5 -right-1.5 inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-full px-2 text-sm font-extrabold ring-2 ring-black transition hover:scale-105 sm:h-11 sm:min-w-[2.75rem] sm:text-base"
                  style={{ background: "var(--trade-accent, #FFB300)", color: "#0A0A0A" }}
                  aria-label={`Trust Score ${trustScore}/100 — ${trustBand.label}`}
                  title={`Trust Score ${trustScore}/100 — ${trustBand.label}. Tap to learn how the score works.`}
                >
                  {trustScore}
                </a>
                {/* Verified-check tick — smaller circle at top-right.
                    Separate signal from the Trust Score number: the
                    score is the gauge, the tick is the verification
                    flag. Only renders when the Hammerex Standard flag
                    is true. */}
                {listing.hammerex_standard_verified && (
                  <span
                    className="absolute -right-1 -top-1 inline-flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-black sm:h-7 sm:w-7"
                    style={{ background: "var(--trade-accent, #FFB300)" }}
                    aria-label="Verified by Xrated"
                    title="Verified by Xrated"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                {listing.accepting_jobs && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-white"
                    style={{ background: "#0F7A3F" }}
                  >
                    Available now
                  </span>
                )}

                <h1
                  className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-lg font-extrabold leading-tight text-white sm:text-2xl"
                  style={{ textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}
                >
                  {/* No truncate — long labels like "Building Merchant"
                      or "Conservatory Manufacturer" must wrap to 2
                      lines, never get clipped to "…". */}
                  <span>{tradeServiceLabel}</span>
                  {/* Verified badge — only renders when the listing is
                      actually on the Verified tier (£19.99/mo). Free /
                      Trial / Paid all hide this check, otherwise the
                      badge would be meaningless social proof. The
                      Hammerex Standard tick at line ~206 is a separate
                      signal driven by `hammerex_standard_verified`. */}
                  {listing.tier === "app_verified" && (
                    <span
                      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full sm:h-5 sm:w-5"
                      style={{ background: "var(--trade-accent, #FFB300)" }}
                      aria-label="Verified"
                      title="Verified — company registration + ID checked by Xrated"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                  )}
                </h1>
                {subtitle && (
                  <p
                    className="mt-0.5 text-xs leading-snug text-neutral-200 sm:text-sm"
                    style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}
                  >
                    {subtitle}
                  </p>
                )}

                <div
                  className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white"
                  style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}
                >
                  <span className="inline-flex items-center gap-1">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFB300" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span className="font-semibold">{listing.city}</span>
                  </span>
                  {rating && (
                    <span className="inline-flex items-center gap-1">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="#FFB300" aria-hidden="true">
                        <path d="m12 2 3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
                      </svg>
                      <span className="font-semibold">{rating}</span>
                      <span className="text-neutral-300">({reviewCount} reviews)</span>
                    </span>
                  )}
                </div>

                {trustBadges.length > 0 && (
                  <div
                    className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white"
                    style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}
                  >
                    {trustBadges.map((b) => (
                      <span key={b.label} className="inline-flex items-center gap-1">
                        <span
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full"
                          style={{ background: "rgba(255,179,0,0.22)" }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFB300" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        </span>
                        <span className="font-semibold">{b.label}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Hero CTAs — paid profiles get the full 3-up row
                (Contact us / Call Now / WhatsApp). Free profiles only
                expose WhatsApp; Contact us + Call Now are paid-only
                because they route through the contact form / phone
                deep-link surfaces that don't exist on free. */}
            {isPaid ? (
              <div className="mt-4 grid grid-cols-3 gap-2">
                <a
                  href={primaryCta.href}
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl text-xs font-bold text-neutral-900 shadow-lg transition active:scale-[0.97] sm:text-sm"
                  style={{ background: "var(--trade-accent, #FFB300)" }}
                >
                  {primaryCta.icon}
                  {primaryCta.label}
                </a>
                {/* Business Card button — visible on every demo template
                    (visitors browsing the gallery always see the feature)
                    AND on every REAL listing where the tradesperson has
                    added a phone number in their dashboard. Listings with
                    no phone set hide the button entirely — matches the
                    user rule "no phone → no card". */}
                {(listing.slug?.startsWith("demo-") || !!listing.phone) && (
                  <BusinessCardButton
                    displayName={listing.display_name}
                    tradeLabel={tradeServiceLabel}
                    phone={listing.phone}
                    email={listing.email}
                    whatsapp={listing.whatsapp}
                    phoneCallsEnabled={listing.phone_calls_enabled}
                    bannerUrl={heroUrl}
                  />
                )}
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl text-xs font-extrabold text-white shadow-lg transition active:scale-[0.97] sm:text-sm"
                  style={{ background: "#0F7A3F", boxShadow: "0 8px 22px rgba(15,122,63,0.45)" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M19.05 4.91A10 10 0 0 0 12 2a10 10 0 0 0-8.94 14.5L2 22l5.62-1.47A10 10 0 1 0 19.05 4.91Zm-7.05 15.4a8.36 8.36 0 0 1-4.27-1.17l-.3-.18-3.34.87.89-3.26-.2-.33A8.32 8.32 0 1 1 12 20.31Z" />
                  </svg>
                  WhatsApp
                </a>
              </div>
            ) : (
              <div className="mt-4">
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-xs font-extrabold text-white shadow-lg transition active:scale-[0.97] sm:text-sm"
                  style={{ background: "#0F7A3F", boxShadow: "0 8px 22px rgba(15,122,63,0.45)" }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M19.05 4.91A10 10 0 0 0 12 2a10 10 0 0 0-8.94 14.5L2 22l5.62-1.47A10 10 0 1 0 19.05 4.91Zm-7.05 15.4a8.36 8.36 0 0 1-4.27-1.17l-.3-.18-3.34.87.89-3.26-.2-.33A8.32 8.32 0 1 1 12 20.31Z" />
                  </svg>
                  Message on WhatsApp
                </a>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="relative z-10 -mt-10 px-4 pb-4 sm:-mt-14 sm:px-6">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-1 overflow-hidden rounded-2xl bg-neutral-900 shadow-2xl sm:grid-cols-5">
          <StatTile
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#FFB300" aria-hidden="true">
                <path d="m12 2 3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
              </svg>
            }
            value={rating ?? "—"}
            label="Rating"
          />
          <StatTile
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFB300" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            }
            value={String(listing.hammerex_standard_products?.length ?? 0)}
            label="Products"
          />
          <StatTile
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFB300" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
            value="97%"
            label="Dispatch"
          />
          <StatTile
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFB300" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            }
            value={
              listing.years_in_trade && listing.years_in_trade > 0
                ? `${listing.years_in_trade}+`
                : "—"
            }
            label="Years"
          />
          <StatTile
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFB300" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="1" y="3" width="15" height="13" />
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
            }
            value="Available"
            label="Delivery"
          />
        </div>
      </section>
    </>
  );
}

function StatTile({
  icon,
  value,
  label
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 bg-neutral-900 px-2 py-3 text-center sm:py-4">
      {icon}
      <span className="text-base font-extrabold text-white sm:text-lg">{value}</span>
      <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
        {label}
      </span>
    </div>
  );
}

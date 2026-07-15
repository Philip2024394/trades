"use client";

// Main-column profile focus view — opens when the buyer taps "View
// full profile" on CanteenAdminCard. Replaces the earlier flip-in-
// place pattern which crammed everything into a 320px scrolling card.
//
// Consistent slot pattern: this component renders in the same main-
// column position as CanteenProductFocus and CanteenCounterExplainer.
// Only one focus mode is active at a time.
//
// Structure:
//   1. Sticky back-to-canteen-chat pill
//   2. Dark hero header (banner + avatar + primary CTAs)
//   3. Two-column info grid (Location, Verified, Office hours,
//      Availability, Showroom, Contact, Socials)
//   4. Reviews carousel (continuous horizontal scroll)
//   5. Portfolio grid (3×2 photo tiles)
//   6. Also-hosts canteen chip row

import Link from "next/link";
import { useState } from "react";
import { VerifiedContactModal } from "@/components/xrated/VerifiedContactModal";
import {
  ArrowLeft,
  MessageCircle,
  Navigation,
  MapPin,
  Clock,
  Store as StoreIcon,
  ShieldCheck,
  Phone,
  Mail,
  Globe,
  Star,
  Camera,
  Users,
  Zap,
  Plus,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import type { CanteenMember } from "@/lib/canteens";
import { MOCK_CANTEENS } from "@/lib/canteens";
import { MOCK_REVIEWS as MOCK_TRADE_REVIEWS } from "@/lib/reviews";
import { TradeReviewCard } from "@/components/xrated/reviews/TradeReviewCard";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK } from "@/lib/brand/tokens";

// Country-specific location illustration. Rendered lower-right of the
// Location InfoCard with a soft gradient mask so the text stays
// readable. Keys match CanteenMember.country ISO codes. Defaults to
// UK when the field is unset — matches the mock population.
const COUNTRY_LOCATION_BG: Record<NonNullable<CanteenMember["country"]>, string> = {
  UK: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2010,%202026,%2006_56_45%20PM.png?updatedAt=1783684626545",
  IE: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2010,%202026,%2006_28_39%20PM.png?updatedAt=1783682939028",
  AU: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2010,%202026,%2006_24_54%20PM.png?updatedAt=1783682711301",
  US: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2010,%202026,%2006_19_11%20PM.png?updatedAt=1783682373718",
  DE: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2010,%202026,%2007_54_09%20PM.png?updatedAt=1783688073891"
};

// Brand icons — same inline SVGs used in CanteenAdminCard (Lucide
// dropped Facebook/Instagram/YouTube in 2025).
type GlyphProps = { size?: number; color?: string; strokeWidth?: number | string };
const Instagram = ({ size = 12, color = "currentColor", strokeWidth = 2 }: GlyphProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
  </svg>
);
const Facebook = ({ size = 12, color = "currentColor", strokeWidth = 2 }: GlyphProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
  </svg>
);
const Youtube = ({ size = 12, color = "currentColor", strokeWidth = 2 }: GlyphProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/>
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/>
  </svg>
);
type IconLike = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number | string }>;

// Reviews carousel — continuous horizontal scroll, pause on hover.
// Same pattern as CanteenProductPanel's product carousel so muscle
// memory transfers between surfaces.
const REVIEWS_CSS = `
@keyframes canteen-reviews-scroll-left {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.canteen-reviews-track {
  animation: canteen-reviews-scroll-left 90s linear infinite;
  will-change: transform;
}
.canteen-reviews-shell:hover .canteen-reviews-track { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) {
  .canteen-reviews-track { animation: none; }
}
`;

export function CanteenProfileFocus({
  admin,
  bannerUrl,
  onBack
}: {
  admin: CanteenMember;
  /** The merchant's uploaded banner image — same asset used by the
   *  canteen header. Rendered as the hero background with a dark
   *  gradient overlay for text contrast. Falls back to a solid dark
   *  gradient when null. */
  bannerUrl?: string | null;
  onBack: () => void;
}) {
  // Reviews section defaults to the compact auto-scrolling carousel;
  // tapping "Show all N reviews" expands the full TradeReviewCard
  // list in-page (no navigation away — buyer stays in profile focus).
  const [reviewsExpanded, setReviewsExpanded] = useState(false);
  // Verified contact modal state — every WhatsApp CTA on this profile
  // routes through the same modal so the merchant only burns a washer
  // on a genuine send.
  const [contactOpen, setContactOpen] = useState(false);
  const firstName = admin.displayName.split(/\s+/)[0] ?? admin.displayName;
  const hasShowroom = !!admin.showroom;
  const showroomAddress = admin.showroom
    ? `${admin.showroom.addressLine}, ${admin.showroom.postcode}`
    : null;
  const homeAddress = admin.postcodeArea ? `${admin.postcodeArea}, ${admin.city}` : null;
  const primaryDirectionsUrl = showroomAddress
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(showroomAddress)}`
    : homeAddress
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(homeAddress)}`
      : null;

  const otherCanteens = MOCK_CANTEENS.filter(
    (c) => admin.memberOfCanteenSlugs.includes(c.slug)
  );

  const hasSocials =
    !!admin.socials &&
    !!(admin.socials.instagram || admin.socials.facebook || admin.socials.tiktok || admin.socials.youtube || admin.socials.website);

  return (
    <div className="mb-3">
      {/* Sticky back pill — larger + brand-yellow filled so buyers
          can't miss it. Scrolls to the top of the viewport on click
          so closing the profile focus visually resets — otherwise the
          scroll position stayed deep in the reviews/portfolio area and
          the collapse read as "nothing happened". */}
      <div className="mb-3 sticky top-[64px] z-20">
        <button
          onClick={() => {
            onBack();
            // Reset scroll so the canteen main view lands at its top
            // instead of at the same offset the profile focus was left
            // scrolled to. requestAnimationFrame lets React commit the
            // state change first so the scroll target actually exists.
            requestAnimationFrame(() => {
              window.scrollTo({ top: 0, behavior: "smooth" });
            });
          }}
          className="inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[12px] font-black uppercase tracking-wider text-neutral-900 shadow-lg transition active:scale-[0.97]"
          style={{ backgroundColor: BRAND_YELLOW }}
        >
          <ArrowLeft size={14} strokeWidth={2.5}/>
          Back to canteen
        </button>
      </div>

      {/* Hero — dark banner (option A: matches CanteenHeader family) */}
      <section
        className="relative overflow-hidden rounded-xl border shadow-md"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <div
          className="relative flex flex-col gap-4 p-5 md:flex-row md:items-end md:gap-5 md:p-7"
          style={{
            background: bannerUrl
              ? `linear-gradient(160deg, rgba(10,10,10,0.72) 0%, rgba(42,26,10,0.78) 55%, rgba(10,10,10,0.88) 100%), url('${bannerUrl}')`
              : `linear-gradient(160deg, ${BRAND_BLACK} 0%, #2a1a0a 55%, #0A0A0A 100%)`,
            backgroundSize: "cover",
            backgroundPosition: "center"
          }}
        >
          {/* Trade eyebrow chip — top-left */}
          <div className="absolute left-5 top-5 md:left-7 md:top-7">
            <span
              className="inline-block rounded-sm px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.24em]"
              style={{ backgroundColor: `${BRAND_YELLOW}22`, color: BRAND_YELLOW }}
            >
              Merchant profile
            </span>
          </div>

          {/* Left cluster — avatar + identity */}
          <div className="flex items-end gap-4 pt-8 md:pt-6">
            <div
              className="h-24 w-24 flex-shrink-0 rounded-full border-4 shadow-lg"
              style={{
                borderColor: BRAND_YELLOW,
                backgroundImage: admin.avatarUrl ? `url('${admin.avatarUrl}')` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundColor: !admin.avatarUrl ? BRAND_YELLOW : undefined
              }}
            >
              {!admin.avatarUrl && (
                <div className="flex h-full w-full items-center justify-center text-[32px] font-black" style={{ color: BRAND_BLACK }}>
                  {admin.displayName.charAt(0)}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex items-center gap-1.5">
                <h1 className="truncate text-[22px] font-black leading-none text-white md:text-[26px]">
                  {admin.displayName}
                </h1>
                {admin.verified?.companiesHouse && (
                  <ShieldCheck size={16} color={BRAND_YELLOW} strokeWidth={2.5}/>
                )}
              </div>
              <div className="mt-1 text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>
                {admin.tradeLabel}
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-[12px] font-bold text-neutral-300">
                <MapPin size={11} className="text-neutral-400"/>
                {admin.city}{admin.postcodeArea ? ` · ${admin.postcodeArea}` : ""}
              </div>

              {/* Star row on the dark hero — 5 stars filled to the
                  aggregate rating, plus tabular score and review
                  count. Renders inline as identity metadata, not as a
                  yellow badge. Click scrolls to the reviews section. */}
              {admin.reviews && (
                <a
                  href="#profile-reviews"
                  className="mt-1.5 inline-flex items-center gap-1.5"
                  aria-label={`${admin.reviews.avg} out of 5 · ${admin.reviews.count} reviews`}
                >
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        size={14}
                        fill={n <= Math.round(admin.reviews!.avg) ? BRAND_YELLOW : "none"}
                        color={BRAND_YELLOW}
                        strokeWidth={n <= Math.round(admin.reviews!.avg) ? 0 : 1.5}
                      />
                    ))}
                  </div>
                  <span className="text-[14px] font-black leading-none tabular-nums text-white">
                    {admin.reviews.avg}
                  </span>
                  <span className="text-[11px] font-black uppercase tracking-wider text-neutral-400">
                    · {admin.reviews.count} reviews
                  </span>
                </a>
              )}
            </div>
          </div>

          {/* Right cluster — CTA stack */}
          <div className="flex flex-col gap-2 md:ml-auto md:min-w-[220px]">
            {admin.whatsapp && (
              <button
                type="button"
                onClick={() => setContactOpen(true)}
                className="flex h-11 items-center justify-center gap-1.5 rounded-full text-[13px] font-black uppercase tracking-wider text-white shadow-md transition active:scale-[0.97]"
                style={{ backgroundColor: BRAND_GREEN_DARK }}
              >
                <MessageCircle size={13} strokeWidth={2.5}/>
                Message on WhatsApp
              </button>
            )}
            {primaryDirectionsUrl && (
              <a
                href={primaryDirectionsUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="flex h-10 items-center justify-center gap-1.5 rounded-full border text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-md"
                style={{ backgroundColor: BRAND_YELLOW, borderColor: BRAND_YELLOW }}
              >
                <Navigation size={12} strokeWidth={2.5}/>
                Get directions
              </a>
            )}
          </div>
        </div>

        {/* About Us — headline label, bio (max 8 lines) + services
            chips. Renders whenever we have a bio OR services to show,
            so a merchant with just the chip list still gets a real
            section rather than an empty rule. */}
        {(admin.bioShort || (admin.servicesOffered && admin.servicesOffered.length > 0)) && (
          <div className="border-t bg-white px-5 py-4 md:px-7" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
            <div className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
              About Us
            </div>
            {admin.bioShort && (
              <p className="line-clamp-8 text-[13px] leading-relaxed text-neutral-700">
                {admin.bioShort}
              </p>
            )}
            {admin.servicesOffered && admin.servicesOffered.length > 0 && (
              <div className="mt-3">
                <div className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
                  What we do best..
                </div>
                {/* Mobile: 2-col grid so items pair up neatly.
                    Desktop (md+): flex-wrap row so the whole list reads
                    as one horizontal line. Yellow-dot marker on each. */}
                <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 md:flex md:flex-wrap md:items-center md:gap-x-5 md:gap-y-1.5">
                  {admin.servicesOffered.map((service) => (
                    <li
                      key={service}
                      className="flex items-center gap-2 text-[12.5px] font-bold text-neutral-800"
                    >
                      <span
                        aria-hidden
                        className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: BRAND_YELLOW }}
                      />
                      {service}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Two-column info grid. Empty rows self-hide so the layout
          reflows to whatever the trade filled in. */}
      <section className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        {homeAddress && (
          <InfoCard icon={MapPin} title="Location">
            {/* Country illustration — anchored right side of the
                card, nudged UP so the bottom edge sits flush inside
                the card rather than clipping. Softer mask + higher
                opacity so the map reads clearly instead of ghosted. */}
            <div
              aria-hidden
              className="pointer-events-none absolute bottom-2 right-1 h-[128px] w-[150px]"
              style={{
                backgroundImage: `url('${COUNTRY_LOCATION_BG[admin.country ?? "UK"]}')`,
                backgroundSize: "contain",
                backgroundPosition: "bottom right",
                backgroundRepeat: "no-repeat",
                maskImage: "linear-gradient(to left, black 40%, transparent 100%), linear-gradient(to top, black 60%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(to left, black 40%, transparent 100%), linear-gradient(to top, black 60%, transparent 100%)",
                maskComposite: "intersect",
                WebkitMaskComposite: "source-in",
                opacity: 0.95
              }}
            />
            <div className="relative text-[13px] font-black text-neutral-900">
              {admin.city}
              {admin.postcodeArea && (
                <span className="ml-1 text-neutral-500">· {admin.postcodeArea}</span>
              )}
            </div>
            <p className="relative mt-1 text-[11px] text-neutral-500">
              Postcode area only — exact address stays private until you connect.
            </p>
            {primaryDirectionsUrl && (
              <a
                href={primaryDirectionsUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="relative mt-2 inline-flex h-8 items-center gap-1 rounded-full px-3 text-[10px] font-black uppercase tracking-wider text-neutral-900 shadow-sm"
                style={{ backgroundColor: BRAND_YELLOW }}
              >
                <Navigation size={10} strokeWidth={2.5}/>
                Directions
              </a>
            )}
          </InfoCard>
        )}

        {admin.verified && (
          <InfoCard icon={ShieldCheck} title="Verified">
            <ul className="flex flex-col gap-1">
              {admin.verified.companiesHouse && (
                <VerifiedRow label="Companies House registered"/>
              )}
              {admin.verified.insuranceGbp && (
                <VerifiedRow label={`£${(admin.verified.insuranceGbp / 1_000_000).toFixed(0)}m Public Liability`}/>
              )}
              {typeof admin.verified.trustScore === "number" && (
                <li className="flex items-center gap-2 text-[12px] text-neutral-700">
                  <div className="h-1.5 flex-1 rounded-full bg-neutral-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        backgroundColor: BRAND_GREEN_DARK,
                        width: `${admin.verified.trustScore}%`
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-black tabular-nums">
                    {admin.verified.trustScore}<span className="text-neutral-400">/100</span>
                  </span>
                </li>
              )}
            </ul>
          </InfoCard>
        )}

        {admin.officeHours && (
          <InfoCard icon={Clock} title="Office hours">
            <pre className="whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed text-neutral-700">
              {admin.officeHours}
            </pre>
          </InfoCard>
        )}

        {(admin.availability || admin.responseTime) && (
          <InfoCard icon={Zap} title="Availability">
            {admin.availability && (
              <div className="text-[13px] font-black text-neutral-900">{admin.availability}</div>
            )}
            {admin.responseTime && (
              <div className="mt-0.5 text-[11px] text-neutral-500">{admin.responseTime}</div>
            )}
          </InfoCard>
        )}

        {hasShowroom && admin.showroom && (
          <InfoCard icon={StoreIcon} title="Showroom">
            <div className="text-[13px] font-black text-neutral-900">
              {admin.showroom.addressLine}
            </div>
            <div className="mt-0.5 text-[12px] text-neutral-500">
              {admin.showroom.postcode}
            </div>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(showroomAddress ?? "")}`}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-2 inline-flex h-8 items-center gap-1 rounded-full px-3 text-[10px] font-black uppercase tracking-wider text-neutral-900 shadow-sm"
              style={{ backgroundColor: BRAND_YELLOW }}
            >
              <Navigation size={10} strokeWidth={2.5}/>
              Directions to showroom
            </a>
          </InfoCard>
        )}

        {(admin.phone || admin.email || admin.whatsapp) && (
          <InfoCard icon={Phone} title="Contact">
            <div className="flex flex-wrap gap-1.5">
              {admin.whatsapp && (
                <button
                  type="button"
                  onClick={() => setContactOpen(true)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-black uppercase tracking-wider shadow-sm transition hover:-translate-y-0.5"
                  style={{
                    backgroundColor: BRAND_GREEN_DARK,
                    color: "#FFFFFF",
                    borderColor: BRAND_GREEN_DARK
                  }}
                >
                  <MessageCircle size={11} color="#FFFFFF" strokeWidth={2.5}/>
                  WhatsApp
                </button>
              )}
              {admin.phone && (
                <ContactPill
                  href={`tel:${admin.phone}`}
                  icon={Phone}
                  label="Call"
                />
              )}
              {admin.email && (
                <ContactPill
                  href={`mailto:${admin.email}`}
                  icon={Mail}
                  label="Email"
                />
              )}
            </div>
          </InfoCard>
        )}

        {hasSocials && admin.socials && (
          <InfoCard icon={Globe} title="Also on" wide>
            {/* Full-image social cards — each card is a tap-through
                to the platform. Uploaded PNG fills the whole card
                edge-to-edge; no icon+label split. 2-col mobile,
                4-col desktop so every logo stays scannable. */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {admin.socials.instagram && (
                <SocialImageCard
                  href={`https://instagram.com/${admin.socials.instagram}`}
                  imageUrl={SOCIAL_IMAGES.instagram}
                  alt={`${admin.displayName} on Instagram`}
                />
              )}
              {admin.socials.facebook && (
                <SocialImageCard
                  href={`https://facebook.com/${admin.socials.facebook}`}
                  imageUrl={SOCIAL_IMAGES.facebook}
                  alt={`${admin.displayName} on Facebook`}
                />
              )}
              {admin.socials.tiktok && (
                <SocialImageCard
                  href={`https://tiktok.com/@${admin.socials.tiktok.replace(/^@/, "")}`}
                  imageUrl={SOCIAL_IMAGES.tiktok}
                  alt={`${admin.displayName} on TikTok`}
                />
              )}
              {admin.socials.youtube && (
                <SocialImageCard
                  href={`https://youtube.com/${admin.socials.youtube}`}
                  imageUrl={SOCIAL_IMAGES.youtube}
                  alt={`${admin.displayName} on YouTube`}
                />
              )}
              {admin.socials.x && (
                <SocialImageCard
                  href={`https://x.com/${admin.socials.x.replace(/^@/, "")}`}
                  imageUrl={SOCIAL_IMAGES.x}
                  alt={`${admin.displayName} on X`}
                />
              )}
              {admin.socials.snapchat && (
                <SocialImageCard
                  href={`https://snapchat.com/add/${admin.socials.snapchat.replace(/^@/, "")}`}
                  imageUrl={SOCIAL_IMAGES.snapchat}
                  alt={`${admin.displayName} on Snapchat`}
                />
              )}
              {admin.socials.website && (
                <SocialImageCard
                  href={`https://${admin.socials.website}`}
                  imageUrl={SOCIAL_IMAGES.website}
                  alt={`${admin.displayName} website`}
                />
              )}
            </div>
          </InfoCard>
        )}
      </section>

      {/* Reviews — full-width strip. Compact auto-scroll carousel by
          default; taps the header to expand into the full review card
          list in-page. No navigation away — buyer stays in profile
          focus so the trust context (verified badges, hero score,
          portfolio) stays visible. */}
      {admin.reviews && admin.reviews.count > 0 && (
        <section
          id="profile-reviews"
          className="canteen-reviews-shell mt-3 overflow-hidden rounded-xl border bg-white shadow-sm scroll-mt-24"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <style>{REVIEWS_CSS}</style>
          <div
            className="border-b px-4 pt-3 pb-1"
            style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: `${BRAND_YELLOW}0F` }}
          >
            <div className="text-[12px] font-black text-neutral-900 md:text-[13px]">
              Our Customers Say It Best...
            </div>
          </div>
          <div
            className="flex items-center justify-between gap-2 border-b px-4 py-3"
            style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: `${BRAND_YELLOW}0F` }}
          >
            <button
              type="button"
              onClick={() => setReviewsExpanded((v) => !v)}
              className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
              aria-expanded={reviewsExpanded}
            >
              <Star size={14} fill={BRAND_YELLOW} color={BRAND_YELLOW} strokeWidth={0}/>
              <span className="text-[14px] font-black text-neutral-900">
                {admin.reviews.avg}
              </span>
              <span className="text-[12px] font-bold text-neutral-500">
                · {admin.reviews.count} reviews
              </span>
              <span
                className="ml-1 inline-flex items-center gap-0.5 text-[10px] font-black uppercase tracking-wider hover:text-neutral-900"
                style={{ color: BRAND_GREEN_DARK }}
              >
                {reviewsExpanded ? (
                  <>
                    Show less
                    <ChevronUp size={11} strokeWidth={2.5}/>
                  </>
                ) : (
                  <>
                    Show all
                    <ChevronDown size={11} strokeWidth={2.5}/>
                  </>
                )}
              </span>
            </button>
            {/* Add-a-review CTA — the only remaining outbound link.
                Routes to the leave-review form gated to Network
                members with a documented job. */}
            <Link
              href={`/trade/${admin.slug}/reviews/new`}
              className="inline-flex h-7 flex-shrink-0 items-center gap-1 rounded-md px-2 text-[10px] font-black uppercase tracking-wider text-neutral-900 shadow-sm transition active:scale-[0.97]"
              style={{ backgroundColor: BRAND_YELLOW }}
            >
              <Plus size={10} strokeWidth={2.5}/>
              Leave review
            </Link>
          </div>

          {reviewsExpanded ? (
            /* Expanded — full TradeReviewCard list in-page. Uses the
               same card component as /trade/{slug}/reviews so the
               visual language stays consistent across surfaces. */
            <div className="flex flex-col gap-3 p-4">
              {MOCK_TRADE_REVIEWS.map((r) => (
                <TradeReviewCard key={r.id} review={r}/>
              ))}
              <button
                type="button"
                onClick={() => setReviewsExpanded(false)}
                className="mt-1 inline-flex h-9 items-center justify-center gap-1 rounded-full border text-[11px] font-black uppercase tracking-wider text-neutral-700 transition hover:bg-neutral-50"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              >
                <ChevronUp size={11} strokeWidth={2.5}/>
                Collapse reviews
              </button>
            </div>
          ) : (
            /* Collapsed — continuous horizontal carousel. Duplicate
               the review list so translateX(-50%) loops seamlessly. */
            <div
              className="relative overflow-hidden p-4"
              style={{
                maskImage: "linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)",
                WebkitMaskImage: "linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)"
              }}
            >
              <div className="canteen-reviews-track flex w-max gap-3">
                {[...MOCK_REVIEWS, ...MOCK_REVIEWS].map((r, i) => (
                  <ReviewCard key={`${r.who}-${i}`} review={r} />
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Portfolio — 3×2 tile grid preview. */}
      {admin.portfolioCount && admin.portfolioCount > 0 && (
        <section
          className="mt-3 overflow-hidden rounded-xl border bg-white shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <div
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: `${BRAND_YELLOW}0F` }}
          >
            <div className="flex items-center gap-1.5">
              <Camera size={12} className="text-neutral-700"/>
              <span className="text-[13px] font-black text-neutral-900">
                Portfolio <span className="text-neutral-500">· {admin.portfolioCount} jobs</span>
              </span>
            </div>
            <Link
              href={`/trade/${admin.slug}/portfolio`}
              className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-neutral-700 hover:text-neutral-900"
            >
              See all {admin.portfolioCount}
              <ArrowLeft size={10} strokeWidth={2.5} className="rotate-180"/>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-1 p-1 md:grid-cols-3">
            {MOCK_PORTFOLIO.map((tile) => (
              <div
                key={tile.imageUrl}
                className="group relative aspect-square overflow-hidden rounded-md"
                style={{
                  backgroundImage: `url('${tile.imageUrl}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundColor: "#F3F4F6"
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition group-hover:opacity-100"/>
                <div className="absolute bottom-1.5 left-1.5 right-1.5 opacity-0 transition group-hover:opacity-100">
                  <div className="text-[10px] font-black text-white">{tile.label}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Also-hosts — thin chip strip at the bottom, only when the
          admin runs more than one canteen. */}
      {otherCanteens.length > 0 && (
        <section
          className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border bg-white px-3 py-3 shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
            <Users size={11}/>
            {admin.displayName} also hosts
          </div>
          {otherCanteens.map((c) => (
            <Link
              key={c.slug}
              href={`/trade-off/yard/canteens/${c.slug}`}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-black uppercase tracking-wider text-neutral-800 transition hover:-translate-y-0.5"
              style={{ borderColor: `${BRAND_YELLOW}88`, backgroundColor: `${BRAND_YELLOW}18` }}
            >
              {c.name}
              <span className="text-[9px] font-black text-neutral-500">
                {c.memberCount}
              </span>
            </Link>
          ))}
        </section>
      )}

      {/* Verified contact modal — mounts at the profile-focus root so
          the hero WA button and the Contact card WhatsApp pill both
          trigger the same flow. Deducts 1 washer on Send. */}
      {admin.whatsapp && (
        <VerifiedContactModal
          open={contactOpen}
          onClose={() => setContactOpen(false)}
          merchantSlug={admin.slug}
          merchantDisplayName={admin.displayName}
          merchantFirstName={firstName}
          merchantWhatsapp={admin.whatsapp}
          tradeLabel={admin.tradeLabel}
          city={admin.city}
          source="canteen-hero"
          sourceLabel={`${firstName}'s profile on Thenetworkers.app`}
          canteenSlug={admin.slug}
        />
      )}
    </div>
  );
}

// ─── Primitives ─────────────────────────────────────

function InfoCard({
  icon: Icon,
  title,
  children,
  wide
}: {
  icon: IconLike;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-xl border bg-white p-3.5 shadow-sm ${wide ? "md:col-span-2" : ""}`}
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <div className="relative mb-2 flex items-center gap-1.5">
        <div
          className="flex h-6 w-6 items-center justify-center rounded-full"
          style={{ backgroundColor: `${BRAND_YELLOW}22` }}
        >
          <Icon size={12} color={BRAND_GREEN_DARK} strokeWidth={2.5}/>
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
          {title}
        </span>
      </div>
      {children}
    </section>
  );
}

function VerifiedRow({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-1.5 text-[12px] text-neutral-700">
      <ShieldCheck size={11} color={BRAND_GREEN_DARK} strokeWidth={2.5}/>
      {label}
    </li>
  );
}

function ContactPill({
  href,
  icon: Icon,
  label,
  bg = "#FFFFFF",
  fg = "#0F1419"
}: {
  href: string;
  icon: IconLike;
  label: string;
  bg?: string;
  fg?: string;
}) {
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer noopener" : undefined}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-black uppercase tracking-wider shadow-sm transition hover:-translate-y-0.5"
      style={{ backgroundColor: bg, color: fg, borderColor: bg === "#FFFFFF" ? "rgba(139,69,19,0.15)" : bg }}
    >
      <Icon size={11} color={fg} strokeWidth={2.5}/>
      {label}
    </a>
  );
}

function ReviewCard({ review }: { review: (typeof MOCK_REVIEWS)[number] }) {
  return (
    <article
      className="flex w-[280px] flex-shrink-0 flex-col rounded-lg border bg-white p-3 shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <div className="mb-1.5 flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            size={11}
            fill={i < review.rating ? BRAND_YELLOW : "none"}
            color={BRAND_YELLOW}
            strokeWidth={i < review.rating ? 0 : 1.5}
          />
        ))}
      </div>
      <p className="line-clamp-3 text-[12px] leading-snug text-neutral-800">
        "{review.body}"
      </p>
      <div className="mt-2 flex items-center gap-1.5 border-t pt-2" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
        <div
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-black"
          style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
        >
          {review.who.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-black text-neutral-900">{review.who}</div>
          <div className="truncate text-[9px] font-black uppercase tracking-wider text-neutral-500">
            {review.role} · {review.ago}
          </div>
        </div>
      </div>
    </article>
  );
}

// ─── Full-image social cards ──────────────────────────
// Each card is a tap-through to the platform. The uploaded PNG fills
// the whole card edge-to-edge (object-cover) so branding + copy live
// in the image itself. Replaces the earlier icon-plus-text grid.
// Aspect ratio locked so a 2-col mobile / 4-col desktop grid stays
// tidy.

const SOCIAL_IMAGES = {
  instagram: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2010,%202026,%2008_21_26%20PM.png",
  facebook:  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2010,%202026,%2008_37_40%20PM.png",
  tiktok:    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2010,%202026,%2008_41_31%20PM.png",
  snapchat:  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2010,%202026,%2008_48_02%20PM.png",
  x:         "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2010,%202026,%2008_53_18%20PM.png",
  youtube:   "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2010,%202026,%2008_57_43%20PM.png",
  website:   "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2010,%202026,%2009_07_24%20PM.png"
} as const;

function SocialImageCard({
  href,
  imageUrl,
  alt
}: {
  href: string;
  imageUrl: string;
  alt: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={alt}
      className="group block aspect-square overflow-hidden rounded-xl border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={alt}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    </a>
  );
}

// ─── Mock data (design-preview only) ───────────────────

const MOCK_REVIEWS = [
  { who: "Rachel Simms", role: "Kitchen Fitter", ago: "3d", rating: 5, body: "Turned up on time, worktops arrived perfect, invoice matched the quote. That's the whole game." },
  { who: "Tom Fisher", role: "Joiner", ago: "1w", rating: 5, body: "Mike sorted a bulk-buy on shaker doors for 4 flats. Saved £600 across the run, quality was spot on." },
  { who: "Craig McDermott", role: "Electrician", ago: "2w", rating: 5, body: "Recommended by two other sparks in the canteen. Delivery quick, product held up to a rough fit." },
  { who: "Sarah Whitmore", role: "Kitchen Fitter", ago: "3w", rating: 4, body: "One panel arrived scuffed, replaced next-day no argument. Communication was the difference." },
  { who: "Jamie Blake", role: "Property Developer", ago: "1mo", rating: 5, body: "12 unit refurb, everything shipped in staged deliveries so we weren't drowning in flat-packs. Would use again." },
  { who: "Dean Whitaker", role: "Bathroom Fitter", ago: "1mo", rating: 5, body: "Only place I've found that stocks the 720mm units without a 3-week wait. Life-saver on tight timelines." },
  { who: "Priya Menon", role: "Site Manager", ago: "2mo", rating: 5, body: "Sent a joiner over to help re-plan a run when the room dimensions changed on-site. That's real service." },
  { who: "Alex Hughes", role: "Kitchen Fitter", ago: "2mo", rating: 4, body: "Prices bang on trade rate. Only ding is the showroom is Manchester-only — would love a Leeds pickup." }
] as const;

const MOCK_PORTFOLIO = [
  { imageUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop", label: "Shaker kitchen · Chorlton" },
  { imageUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=400&fit=crop", label: "Modern handleless · Didsbury" },
  { imageUrl: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=400&h=400&fit=crop", label: "Utility fit · Altrincham" },
  { imageUrl: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400&h=400&fit=crop", label: "Bespoke island · Withington" },
  { imageUrl: "https://images.unsplash.com/photo-1556912167-f556f1f39fdf?w=400&h=400&fit=crop", label: "Butlers pantry · Sale" },
  { imageUrl: "https://images.unsplash.com/photo-1600566753151-384129cf4e3e?w=400&h=400&fit=crop", label: "Compact flat kitchen · Salford" }
] as const;

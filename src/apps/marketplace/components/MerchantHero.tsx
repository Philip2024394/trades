// Merchant Hero — full-width, full-height banner behind all content.
//
// Layout:
//   The merchant-supplied `storeHeroImageUrl` fills the ENTIRE hero
//   card as a background image (object-cover, absolute inset-0).
//
// Text overlay behaviour is driven by `merchant.heroTextStyle`:
//   - "auto-light" (default): dark gradient + WHITE text — safest, works
//     on almost any image
//   - "auto-dark":  light gradient + BLACK text — for merchants whose
//     banner has bright imagery and they want dark text
//   - "hidden":     no overlay text — banner runs clean and the identity
//     block renders in a normal card BELOW the banner
//
// Recommended source spec: 1920 × 720 WebP, under 400KB. Subject in the
// centre-right of the frame — the left third gets darkened by the
// overlay in either auto mode and is safe for text.

import {
  CheckCircle2,
  MapPin,
  Calendar,
  Star,
  Package,
  Truck,
  Heart,
  MessageCircle
} from "lucide-react";
import type { MarketplaceMerchant } from "../data/merchants";
import { MessageSellerCTA } from "@/apps/messages/components/MessageSellerCTA";

type Props = {
  merchant: MarketplaceMerchant;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric"
  });
}

type TextTheme = {
  gradient: string;
  primaryText: string;
  mutedText: string;
  followBg: string;
  followFg: string;
  messageBorder: string;
  messageBg: string;
  messageFg: string;
  statsChipBg: string;
  statsMuted: string;
};

const LIGHT_TEXT_THEME: TextTheme = {
  gradient:
    "linear-gradient(135deg, rgba(10,10,10,0.85) 0%, rgba(10,10,10,0.65) 45%, rgba(10,10,10,0.35) 100%)",
  primaryText: "#FFFFFF",
  mutedText: "rgba(255,255,255,0.85)",
  followBg: "#FFB300",
  followFg: "#0A0A0A",
  messageBorder: "rgba(255,255,255,0.35)",
  messageBg: "rgba(255,255,255,0.10)",
  messageFg: "#FFFFFF",
  statsChipBg: "rgba(10,10,10,0.55)",
  statsMuted: "rgba(255,255,255,0.75)"
};

const DARK_TEXT_THEME: TextTheme = {
  gradient:
    "linear-gradient(135deg, rgba(255,253,248,0.92) 0%, rgba(255,253,248,0.72) 45%, rgba(255,253,248,0.35) 100%)",
  primaryText: "#0A0A0A",
  mutedText: "rgba(10,10,10,0.75)",
  followBg: "#0A0A0A",
  followFg: "#FFB300",
  messageBorder: "rgba(10,10,10,0.30)",
  messageBg: "rgba(255,255,255,0.75)",
  messageFg: "#0A0A0A",
  statsChipBg: "rgba(255,255,255,0.80)",
  statsMuted: "rgba(10,10,10,0.65)"
};

export function MerchantHero({ merchant }: Props) {
  const style = merchant.heroTextStyle ?? "auto-light";
  const positiveFeedbackPct = Math.round((merchant.avgStarRating / 5) * 100);
  const memberSince = merchant.memberSinceIso
    ? formatDate(merchant.memberSinceIso)
    : `${merchant.yearsTrading}y trading`;

  const theme: TextTheme = style === "auto-dark" ? DARK_TEXT_THEME : LIGHT_TEXT_THEME;

  // ─── "hidden" mode ─────────────────────────────────────────────────
  // Banner runs clean with no overlay text. Identity + stats render in
  // a normal card below the banner.
  if (style === "hidden") {
    return (
      <section className="flex flex-col gap-4">
        <div
          className="relative overflow-hidden rounded-xl border shadow-sm"
          style={{
            borderColor: "rgba(139,69,19,0.15)",
            aspectRatio: "8 / 3",
            minHeight: "220px"
          }}
        >
          {merchant.storeHeroImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={merchant.storeHeroImageUrl}
              alt={`${merchant.displayName} banner`}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, #0A0A0A 0%, #14211A 55%, #0A0A0A 100%)"
              }}
              aria-hidden
            />
          )}
        </div>
        <IdentityCard
          merchant={merchant}
          positiveFeedbackPct={positiveFeedbackPct}
          memberSince={memberSince}
        />
      </section>
    );
  }

  // ─── "auto-light" / "auto-dark" mode ───────────────────────────────
  // Banner is the full-bleed background. Content overlays via z-10.
  return (
    <section
      className="relative overflow-hidden rounded-xl border shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)", minHeight: "320px" }}
    >
      {/* Full-bleed banner */}
      <div className="absolute inset-0" aria-hidden>
        {merchant.storeHeroImageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={merchant.storeHeroImageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0" style={{ background: theme.gradient }}/>
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, #0A0A0A 0%, #14211A 55%, #0A0A0A 100%)"
            }}
          />
        )}
      </div>

      {/* Content layer */}
      <div className="relative z-10 flex flex-col gap-5 p-5 md:p-7">
        {/* Top row: logo + identity + desktop CTAs */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-5">
          <div className="flex flex-shrink-0">
            <Logo merchant={merchant}/>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                className="text-[24px] font-black leading-tight drop-shadow md:text-[28px]"
                style={{ color: theme.primaryText }}
              >
                {merchant.displayName}
              </h1>
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
                style={{ backgroundColor: "#166534", color: "#FFFFFF" }}
              >
                <CheckCircle2 size={10} strokeWidth={3}/>
                Verified Seller
              </span>
            </div>
            {merchant.shortTagline && (
              <p className="mt-1 text-[13px] leading-snug" style={{ color: theme.mutedText }}>
                {merchant.shortTagline}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px]" style={{ color: theme.mutedText }}>
              <span className="inline-flex items-center gap-1">
                <MapPin size={11}/>
                {merchant.homeCity}, UK
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar size={11}/>
                Member since {memberSince}
              </span>
            </div>
          </div>

          <div className="hidden flex-shrink-0 flex-col gap-2 md:flex md:items-end">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11.5px] font-black uppercase tracking-wider shadow-md"
              style={{ backgroundColor: theme.followBg, color: theme.followFg }}
            >
              <Heart size={13} strokeWidth={2.5}/>
              Follow Seller
            </button>
            <MessageSellerCTA
              merchant={merchant}
              variant={style === "auto-dark" ? "hero-dark" : "hero-light"}
            />
          </div>
        </div>

        {/* Stats row */}
        <div
          className="mt-auto grid grid-cols-2 gap-3 rounded-lg p-3 md:grid-cols-4 md:gap-4 md:p-4"
          style={{ backgroundColor: theme.statsChipBg, backdropFilter: "blur(4px)" }}
        >
          <Stat
            icon={<Star size={12} className="text-amber-400" fill="currentColor"/>}
            headline={merchant.avgStarRating.toFixed(1)}
            subline={`(${merchant.reviewCount.toLocaleString()})`}
            caption={`${positiveFeedbackPct}% Positive Feedback`}
            primaryText={theme.primaryText}
            mutedText={theme.statsMuted}
          />
          <Stat
            headline={merchant.ordersCompleted?.toLocaleString() ?? "—"}
            caption="Orders Completed"
            primaryText={theme.primaryText}
            mutedText={theme.statsMuted}
          />
          <Stat
            icon={<Package size={12} style={{ color: theme.statsMuted }}/>}
            headline={merchant.productsSold?.toLocaleString() ?? "—"}
            caption="Products Sold"
            primaryText={theme.primaryText}
            mutedText={theme.statsMuted}
          />
          <Stat
            icon={<Truck size={12} style={{ color: theme.statsMuted }}/>}
            headline="Fast Dispatch"
            caption={merchant.dispatchPromise ?? "Same day"}
            primaryText={theme.primaryText}
            mutedText={theme.statsMuted}
          />
        </div>

        {/* Mobile CTAs */}
        <div className="flex flex-col gap-2 md:hidden">
          <button
            type="button"
            className="flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[12px] font-black uppercase tracking-wider shadow-md"
            style={{ backgroundColor: theme.followBg, color: theme.followFg }}
          >
            <Heart size={13} strokeWidth={2.5}/>
            Follow Seller
          </button>
          <MessageSellerCTA
            merchant={merchant}
            variant={style === "auto-dark" ? "hero-dark" : "hero-light"}
          />
        </div>
      </div>
    </section>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────

function Logo({ merchant }: { merchant: MarketplaceMerchant }) {
  return (
    <div
      className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full shadow-lg ring-2 ring-white/40"
      style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
    >
      {merchant.logoImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={merchant.logoImageUrl}
          alt={`${merchant.displayName} logo`}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="text-center leading-tight">
          <div className="text-[9px] font-black uppercase tracking-[0.15em]">
            {merchant.displayName.split(" ")[0]}
          </div>
          <div className="text-[16px] font-black">
            {merchant.logoInitials}
          </div>
        </div>
      )}
      <span
        className="absolute -bottom-0.5 -right-0.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white"
        style={{ backgroundColor: "#166534", color: "#FFFFFF" }}
        aria-hidden
      >
        <CheckCircle2 size={12} strokeWidth={2.5}/>
      </span>
    </div>
  );
}

function IdentityCard({
  merchant,
  positiveFeedbackPct,
  memberSince
}: {
  merchant: MarketplaceMerchant;
  positiveFeedbackPct: number;
  memberSince: string;
}) {
  return (
    <div
      className="rounded-xl border bg-white p-5 shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-5">
        <Logo merchant={merchant}/>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[22px] font-black leading-tight text-neutral-900 md:text-[26px]">
              {merchant.displayName}
            </h1>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
              style={{ backgroundColor: "#166534", color: "#FFFFFF" }}
            >
              <CheckCircle2 size={10} strokeWidth={3}/>
              Verified Seller
            </span>
          </div>
          {merchant.shortTagline && (
            <p className="mt-1 text-[13px] leading-snug text-neutral-600">
              {merchant.shortTagline}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-neutral-500">
            <span className="inline-flex items-center gap-1">
              <MapPin size={11}/>
              {merchant.homeCity}, UK
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar size={11}/>
              Member since {memberSince}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat
              icon={<Star size={12} className="text-amber-500" fill="currentColor"/>}
              headline={merchant.avgStarRating.toFixed(1)}
              subline={`(${merchant.reviewCount.toLocaleString()})`}
              caption={`${positiveFeedbackPct}% Positive Feedback`}
              primaryText="#0A0A0A"
              mutedText="rgba(10,10,10,0.55)"
            />
            <Stat
              headline={merchant.ordersCompleted?.toLocaleString() ?? "—"}
              caption="Orders Completed"
              primaryText="#0A0A0A"
              mutedText="rgba(10,10,10,0.55)"
            />
            <Stat
              icon={<Package size={12} className="text-neutral-500"/>}
              headline={merchant.productsSold?.toLocaleString() ?? "—"}
              caption="Products Sold"
              primaryText="#0A0A0A"
              mutedText="rgba(10,10,10,0.55)"
            />
            <Stat
              icon={<Truck size={12} className="text-neutral-500"/>}
              headline="Fast Dispatch"
              caption={merchant.dispatchPromise ?? "Same day"}
              primaryText="#0A0A0A"
              mutedText="rgba(10,10,10,0.55)"
            />
          </div>
        </div>
        <div className="hidden flex-shrink-0 flex-col gap-2 md:flex md:items-end">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11.5px] font-black uppercase tracking-wider text-white shadow-sm"
            style={{ backgroundColor: "#166534" }}
          >
            <Heart size={13} strokeWidth={2.5}/>
            Follow Seller
          </button>
          <MessageSellerCTA merchant={merchant} variant="pdp"/>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  headline,
  subline,
  caption,
  primaryText,
  mutedText
}: {
  icon?: React.ReactNode;
  headline: string;
  subline?: string;
  caption: string;
  primaryText: string;
  mutedText: string;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-1">
        {icon}
        <span className="text-[16px] font-black drop-shadow" style={{ color: primaryText }}>
          {headline}
        </span>
        {subline && (
          <span className="text-[10.5px]" style={{ color: mutedText }}>
            {subline}
          </span>
        )}
      </div>
      <div className="mt-0.5 text-[10.5px] font-bold uppercase tracking-wider" style={{ color: mutedText }}>
        {caption}
      </div>
    </div>
  );
}

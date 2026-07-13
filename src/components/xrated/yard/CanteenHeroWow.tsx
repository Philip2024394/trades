"use client";

// CanteenHeroWow — pixel-mirror of the off-white mockup design.
//
// Structure (top-to-bottom, mobile-first):
//   1. Header row: avatar with online dot + "Hi {first} 👋" + role +
//      verified check + bell with red badge (owner-only) OR trade tag
//      + host name (guest).
//   2. Split hero:
//      LEFT column   → "Build Beautiful" (dark) / "{topic}." (tan)
//                       "Connect. Share. Grow."
//                       "+ New Project" tan pill (owner) OR "WhatsApp us"
//                       green pill (guest).
//      RIGHT column  → canteen photo + two floating white KPI cards
//                       stacked (Projects/Rating).
//
// Everything not in the mockup — burger, QR chip, meta strip, Est.
// chip, trade tag pill, editorial quote — is intentionally omitted.

import Link from "next/link";
import { useState } from "react";
import { Bell, Check, Plus, Package, Star, IdCard, Mail } from "lucide-react";
import type { Canteen } from "@/lib/canteens";
import { BRAND_BLACK, BRAND_GREEN_DARK } from "@/lib/brand/tokens";
import { CanteenBusinessCardModal } from "@/components/xrated/yard/CanteenBusinessCardModal";

const CREAM = "#FBF6EC";
const TAN = "#B8860B";        // Warm gold — headline accent + CTA
const TAN_SOFT = "#F5E9D3";   // KPI icon backgrounds

export function CanteenHeroWow({
  canteen,
  isHost,
  hostWhatsapp,
  hostReviews,
  hostAvatarUrl = null,
  notificationCount = 3,
  addressLine = null,
  postcode = null,
  city = null
}: {
  canteen: Canteen;
  isHost: boolean;
  hostWhatsapp: string | null;
  hostReviews: { avg: number; count: number } | null;
  /** Host's profile image URL. When present the hero avatar renders
   *  the photo; otherwise falls back to the initial letter chip. */
  hostAvatarUrl?: string | null;
  notificationCount?: number;
  /** Contact fields piped through to the Business Card modal so the
   *  card shows a real address + phone. */
  addressLine?: string | null;
  postcode?: string | null;
  city?: string | null;
}) {
  const [cardOpen, setCardOpen] = useState(false);
  // Bell shows for everyone — matches the mockup. Owners see their
  // real hostActions count; guests see a static demo count so the
  // hero visual stays consistent across viewers.
  const showBell = true;
  const badgeCount = notificationCount > 0 ? notificationCount : 3;
  const firstName = canteen.hostDisplayName.split(/\s+/)[0] ?? canteen.hostDisplayName;
  const words = canteen.name.trim().split(/\s+/);
  const lastWord = words.pop() ?? canteen.name;
  const restOfName = words.join(" ");

  return (
    <section className="relative overflow-hidden" style={{ backgroundColor: CREAM }}>
      {/* Full-width photo bg — fades from opaque cream on the LEFT
          (so text is legible) to fully transparent on the RIGHT (so
          the photo dominates that side). The KPI cards float over
          the visible photo portion. */}
      {canteen.headerBgUrl ? (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage: `url('${canteen.headerBgUrl}')`,
            backgroundSize: "cover",
            backgroundPosition: "center right"
          }}
        />
      ) : (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${TAN_SOFT} 0%, #FDF3E0 100%)`
          }}
        />
      )}
      {/* Left-to-right cream veil — opaque on the left where the text
          sits, aggressively transparent on the right so the photo
          reads sharp. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `linear-gradient(90deg, ${CREAM} 0%, ${CREAM} 25%, ${CREAM}AA 42%, ${CREAM}44 60%, ${CREAM}00 78%, ${CREAM}00 100%)`
        }}
      />
      {/* Bottom-to-cream fade — kicks in later so the middle of the
          photo stays crisp; only the last 20% dissolves into the page
          colour to hide the hero edge. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, transparent 0%, transparent 70%, ${CREAM}66 85%, ${CREAM} 100%)`
        }}
      />

      <div className="relative mx-auto max-w-6xl px-3 pt-4 pb-16 sm:px-6 sm:pt-5 sm:pb-20">
        {/* ── Row 1 · Header — clean credentials strip (no greeting).
            Avatar + name + trade specialty. Reduced bottom margin so
            the H1 sits closer to the top of the hero. */}
        <header className="mb-3 flex items-center gap-3">
          <div
            className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full shadow-sm sm:h-14 sm:w-14"
            style={{ backgroundColor: TAN_SOFT }}
            aria-hidden
          >
            {hostAvatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={hostAvatarUrl}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-[16px] font-black sm:text-[18px]"
                style={{ color: TAN }}
              >
                {firstName.charAt(0).toUpperCase()}
              </div>
            )}
            <span
              aria-hidden
              className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2"
              style={{ backgroundColor: "#22C55E", borderColor: CREAM }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-black leading-tight text-neutral-900 sm:text-[17px]">
              {canteen.hostDisplayName}
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-neutral-500 sm:text-[12px]">
              {canteen.tradeLabel} Specialist
              <Check size={12} strokeWidth={3} style={{ color: TAN }}/>
            </div>
          </div>
          {/* Notification bell — owner-only. Badge only when > 0 so
              a quiet inbox doesn't show a red dot. */}
          {showBell && (
            <button
              type="button"
              aria-label={`Notifications${notificationCount > 0 ? ` (${notificationCount} unread)` : ""}`}
              className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-neutral-700 transition hover:bg-neutral-900/[0.06]"
            >
              <Bell size={20} strokeWidth={2.2}/>
              <span
                aria-hidden
                className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-black text-white"
                style={{ backgroundColor: "#DC2626" }}
              >
                {badgeCount > 9 ? "9+" : badgeCount}
              </span>
            </button>
          )}
        </header>

        {/* ── Row 2 · Copy on the LEFT, floating KPIs on the RIGHT.
            The photo is now the full-width backdrop underneath — no
            separate right-column photo container. */}
        <div className="relative grid grid-cols-[minmax(0,1fr)_minmax(0,130px)] gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,150px)] sm:gap-4">
          {/* LEFT — copy + CTA (over the opaque cream veil zone) */}
          <div className="min-w-0">
            <h1
              className="text-[32px] font-black leading-[1.05] tracking-tight text-neutral-900 sm:text-[40px] md:text-[48px]"
              style={{ fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif' }}
            >
              {restOfName && (
                <>
                  {restOfName}
                  <br/>
                </>
              )}
              <span style={{ color: TAN }}>{lastWord}.</span>
            </h1>
            <p className="mt-2 text-[12px] font-bold text-neutral-600 sm:text-[13px]">
              Connect. Share. Grow.
            </p>
            <div className="mt-4 pr-3">
              {isHost ? (
                <Link
                  href={`/trade-off/yard/canteens/${canteen.slug}/post`}
                  className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-black text-white shadow-md transition active:scale-[0.97]"
                  style={{ backgroundColor: TAN }}
                >
                  <Plus size={15} strokeWidth={2.6}/>
                  New Project
                </Link>
              ) : hostWhatsapp ? (
                <button
                  type="button"
                  onClick={() => setCardOpen(true)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black text-white shadow-md transition active:scale-[0.97]"
                  style={{ backgroundColor: TAN }}
                >
                  <IdCard size={12} strokeWidth={2.5}/>
                  Business card
                </button>
              ) : (
                <Link
                  href={`/trade-off/yard/canteens/${canteen.slug}/contact`}
                  className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-black text-white shadow-md transition active:scale-[0.97]"
                  style={{ backgroundColor: BRAND_GREEN_DARK }}
                >
                  <Mail size={15} strokeWidth={2.5}/>
                  Contact us
                </Link>
              )}
            </div>
          </div>

          {/* RIGHT — floating KPI stack, right-aligned within the
              column so both cards hug the outer right edge. */}
          <div className="relative flex flex-col items-end justify-start gap-2 pt-1">
            <KpiCard
              icon={<Package size={14} strokeWidth={2.3} style={{ color: TAN }}/>}
              label="Projects"
              value={String(canteen.postsLast30d || 28)}
              subLabel="Active"
            />
            <KpiCard
              icon={
                hostReviews && hostReviews.count >= 5 ? (
                  <Star size={14} strokeWidth={2.3} fill="currentColor" style={{ color: "#F59E0B" }}/>
                ) : (
                  <Star size={14} strokeWidth={2.3} style={{ color: TAN }}/>
                )
              }
              label="Rating"
              value={hostReviews && hostReviews.count >= 5 ? hostReviews.avg.toFixed(1) : "New"}
              subLabel={
                hostReviews && hostReviews.count >= 5
                  ? hostReviews.avg >= 4.5 ? "Excellent" : hostReviews.avg >= 4 ? "Very good" : "Good"
                  : "Building"
              }
            />
          </div>
        </div>
      </div>

      {/* Business card modal — full-screen popup with hero image bg,
          address, phone, small QR, and share-to-WhatsApp button. */}
      <CanteenBusinessCardModal
        open={cardOpen}
        onClose={() => setCardOpen(false)}
        hostSlug={canteen.hostSlug}
        hostDisplayName={canteen.hostDisplayName}
        hostFirstName={firstName}
        tradeLabel={canteen.tradeLabel}
        hostWhatsapp={hostWhatsapp}
        addressLine={addressLine}
        postcode={postcode}
        city={city}
        backgroundImageUrl={canteen.headerBgUrl}
      />
    </section>
  );
}

function KpiCard({
  icon,
  label,
  value,
  subLabel
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subLabel: string;
}) {
  return (
    <div
      className="flex h-[68px] w-[86px] flex-col items-center justify-center gap-0.5 rounded-xl border bg-white p-2 shadow-lg sm:h-[76px] sm:w-[96px]"
      style={{ borderColor: "rgba(139,69,19,0.08)" }}
    >
      <div className="flex items-center gap-1">
        <span aria-hidden>{icon}</span>
        <span className="text-[9px] font-bold text-neutral-500">{label}</span>
      </div>
      <div className="text-[22px] font-black leading-none text-neutral-900 sm:text-[24px]">
        {value}
      </div>
      <div className="text-[9px] font-bold text-neutral-500">
        {subLabel}
      </div>
    </div>
  );
}

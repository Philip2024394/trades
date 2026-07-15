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
import { Check, Package, Star, IdCard, Mail, User } from "lucide-react";
import type { Canteen } from "@/lib/canteens";
import { BRAND_BLACK, BRAND_GREEN_DARK } from "@/lib/brand/tokens";
import { CanteenBusinessCardModal } from "@/components/xrated/yard/CanteenBusinessCardModal";
import { DEFAULT_PALETTE, type PaletteTokens } from "@/lib/paletteTokens";

const TAN_SOFT = "#F5E9D3";   // KPI icon backgrounds (Chalk-fixed —
                              // palettes don't override the KPI tint yet)

export function CanteenHeroWow({
  canteen,
  hostWhatsapp,
  hostReviews,
  hostAvatarUrl = null,
  addressLine = null,
  postcode = null,
  city = null,
  palette = DEFAULT_PALETTE,
  veilOpacity = 1
}: {
  canteen: Canteen;
  hostWhatsapp: string | null;
  hostReviews: { avg: number; count: number } | null;
  /** Host's profile image URL. When present the hero avatar renders
   *  the photo; otherwise falls back to the initial letter chip. */
  hostAvatarUrl?: string | null;
  /** Contact fields piped through to the Business Card modal so the
   *  card shows a real address + phone. */
  addressLine?: string | null;
  postcode?: string | null;
  city?: string | null;
  /** Merchant's palette — drives hero bg, primary text colour, hero
   *  last-word accent, and the two secondary CTAs (Profile / Card). */
  palette?: PaletteTokens;
  /** [DEV BUTTON] Opacity multiplier for the two cream-veil overlays
   *  on top of the hero photo. 1 = full veil (default), 0 = veils
   *  invisible so the hero photo shows 100% clear. Driven by the
   *  templates picker's dev SHADE slider via `?hero_shade=` query. */
  veilOpacity?: number;
}) {
  const [cardOpen, setCardOpen] = useState(false);
  const firstName = canteen.hostDisplayName.split(/\s+/)[0] ?? canteen.hostDisplayName;
  const words = canteen.name.trim().split(/\s+/);
  const lastWord = words.pop() ?? canteen.name;
  const restOfName = words.join(" ");
  const CREAM = palette.bg;
  const TAN = palette.accent;
  const HEADLINE_INK = palette.text;
  const MUTED_INK = palette.mutedText;
  const HERO_LAST_WORD = palette.heroLastWord;

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
          reads sharp. [DEV BUTTON] Multiplied by `veilOpacity` so the
          templates-picker SHADE slider can fade the veil out — 0
          reveals the hero photo 100% clear, 1 = default veil. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `linear-gradient(90deg, ${CREAM} 0%, ${CREAM} 25%, ${CREAM}AA 42%, ${CREAM}44 60%, ${CREAM}00 78%, ${CREAM}00 100%)`,
          opacity: veilOpacity
        }}
      />
      {/* Bottom-to-cream fade — kicks in later so the middle of the
          photo stays crisp; only the last 20% dissolves into the page
          colour to hide the hero edge. Same veilOpacity multiplier. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, transparent 0%, transparent 70%, ${CREAM}66 85%, ${CREAM} 100%)`,
          opacity: veilOpacity
        }}
      />

      <div className="relative mx-auto max-w-6xl px-3 pt-[26px] pb-16 sm:px-6 sm:pt-[30px] sm:pb-20">
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
            <div
              className="truncate text-[15px] font-black leading-tight sm:text-[17px]"
              style={{ color: HEADLINE_INK }}
            >
              {canteen.hostDisplayName}
            </div>
            <div
              className="flex min-w-0 items-center gap-1 text-[13px] font-bold sm:text-[13.5px]"
              style={{ color: MUTED_INK }}
            >
              <span className="truncate">{canteen.tradeLabel} Specialist</span>
              <Check size={12} strokeWidth={3} className="flex-shrink-0" style={{ color: TAN }}/>
            </div>
          </div>
        </header>

        {/* ── Row 2 · Copy on the LEFT, floating KPIs on the RIGHT.
            The photo is now the full-width backdrop underneath — no
            separate right-column photo container. */}
        <div className="relative grid grid-cols-[minmax(0,1fr)_minmax(0,130px)] gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,150px)] sm:gap-4">
          {/* LEFT — copy + CTA (over the opaque cream veil zone) */}
          <div className="min-w-0">
            <h1
              className="text-[28px] font-black leading-tight sm:text-[34px] md:text-[40px]"
              style={{
                fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif',
                color: HEADLINE_INK,
                // Palette-driven text-shadow so the H1 stays punchy over
                // busy hero images regardless of what colours the photo
                // has behind the text position.
                //  · Dark palettes (Iron): dark shadow for depth against
                //    light image content.
                //  · Light palettes (Chalk, Slate, Oak, etc): white
                //    outline effect via 4-direction 1px shadows so the
                //    dark text pops against ANY image patch — dark or
                //    light. Plus a soft dark drop shadow for depth.
                textShadow: palette.dark
                  ? "0 2px 8px rgba(0,0,0,0.65), 0 0 2px rgba(0,0,0,0.4)"
                  : "1px 1px 0 rgba(255,255,255,0.85), -1px -1px 0 rgba(255,255,255,0.85), 1px -1px 0 rgba(255,255,255,0.85), -1px 1px 0 rgba(255,255,255,0.85), 0 2px 6px rgba(0,0,0,0.20)"
              }}
            >
              {restOfName && (
                <>
                  {restOfName}
                  <br/>
                </>
              )}
              <span style={{ color: HERO_LAST_WORD }}>{lastWord}.</span>
            </h1>
            <p
              className="mt-2 text-[13px] font-bold sm:text-[14px]"
              style={{ color: MUTED_INK }}
            >
              Connect. Share. Grow.
            </p>
            <div className="mt-4 flex items-center gap-2 pr-3">
              {/* Profile — swaps the Live Feed panel into About Us via
                  the same canteen:set-tab bus that Quick Actions use. */}
              <button
                type="button"
                onClick={() => {
                  if (typeof window === "undefined") return;
                  // Match the Quick Actions pattern exactly: update the
                  // URL hash first, then dispatch the tab-switch event,
                  // then scroll the tabbed section into view. Belt-and-
                  // braces so either the hashchange handler OR the
                  // custom event handler in CanteenTabbedSection will
                  // flip activeTab to "about".
                  window.history.replaceState(null, "", "#tab-about");
                  window.dispatchEvent(
                    new CustomEvent("canteen:set-tab", { detail: { tab: "about" } })
                  );
                  document.getElementById("canteen-tabbed")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                  });
                }}
                className="inline-flex h-11 items-center gap-1.5 rounded-md px-4 text-[12px] font-black text-white shadow-md transition active:scale-[0.97]"
                style={{ backgroundColor: TAN }}
              >
                <User size={14} strokeWidth={2.5}/>
                Profile
              </button>
              {/* Card — opens the Business Card popup. Mobile is
                  preview-only, so host + visitor both see this. */}
              {hostWhatsapp ? (
                <button
                  type="button"
                  onClick={() => setCardOpen(true)}
                  className="inline-flex h-11 items-center gap-1.5 rounded-md px-4 text-[12px] font-black text-white shadow-md transition active:scale-[0.97]"
                  style={{ backgroundColor: TAN }}
                >
                  <IdCard size={14} strokeWidth={2.5}/>
                  Card
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
              dark={palette.dark}
              accent={TAN}
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
              dark={palette.dark}
              accent={TAN}
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
  subLabel,
  dark = false,
  accent
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subLabel: string;
  /** Dark-palette flag — retained for prop compatibility. Card bg is
   *  now UNCONDITIONALLY black across every palette (Philip 2026-07-15:
   *  "the 2 container on the right side on the hero should be black
   *  color - projects - rating"). Value + label + sublabel colours
   *  fixed to a black-native scheme regardless of palette theme. */
  dark?:   boolean;
  /** Palette accent — currently unused inside the card but forwarded
   *  so future accent-highlighted variants can pick it up. */
  accent?: string;
}) {
  return (
    <div
      className="flex h-[68px] w-[86px] flex-col items-center justify-center gap-0.5 rounded-xl border p-2 shadow-lg sm:h-[76px] sm:w-[96px]"
      style={{
        backgroundColor: "#0A0A0A",
        borderColor:     "rgba(255,255,255,0.10)"
      }}
    >
      <div className="flex items-center gap-1">
        <span aria-hidden>{icon}</span>
        <span
          className="text-[11px] font-bold"
          style={{ color: "#A3A3A3" }}
        >
          {label}
        </span>
      </div>
      <div
        className="text-[22px] font-black leading-none sm:text-[24px]"
        style={{ color: "#FFFFFF" }}
      >
        {value}
      </div>
      <div
        className="text-[11px] font-bold"
        style={{ color: "#A3A3A3" }}
      >
        {subLabel}
      </div>
      {/* Suppress unused-var warning while accent prop is reserved for
          future use — remove `void accent` when a variant consumes it. */}
      {accent ? null : null}
    </div>
  );
}

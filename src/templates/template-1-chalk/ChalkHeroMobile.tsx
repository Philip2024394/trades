"use client";

// ChalkHeroMobile — Template 1's mobile hero.
//
// Owned entirely by src/templates/template-1-chalk/. Edits here only
// affect Template 1 canteens. Template 2 (Iron) has its own
// IronHero.tsx and is untouched by any change to this file.
//
// Structure (top-to-bottom, mobile-first):
//   • Split hero: brand name + tagline + Profile/Card CTAs on the
//     LEFT (over an opaque cream veil), floating KPI cards on the
//     RIGHT (over the hero photo).
//   • Standard sans-serif throughout; palette drives colours.
//   • No credentials-strip header (Philip 2026-07-16 — mobile app
//     view is hero-only).

import Link from "next/link";
import { useState } from "react";
import { Check, Package, Star, IdCard, Mail, User } from "lucide-react";
import type { Canteen } from "@/lib/canteens";
import { BRAND_BLACK, BRAND_GREEN_DARK } from "@/lib/brand/tokens";
import { CanteenBusinessCardModal } from "@/components/xrated/yard/CanteenBusinessCardModal";
import { DEFAULT_PALETTE, type PaletteTokens } from "@/lib/paletteTokens";

const TAN_SOFT = "#F5E9D3";   // KPI icon backgrounds (Chalk-fixed —
                              // palettes don't override the KPI tint yet)

export function ChalkHeroMobile({
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
          // Natural fade + wider clear zone (Philip 2026-07-16 — more
          // image showing through on the right). Solid cream over the
          // text zone (0–25%), smooth fall-off 25–60%, then the right
          // 40% fully transparent so the hero photo reads crisp and
          // unobstructed. No hard line — 6 opacity stops make the
          // transition read as one continuous wash.
          background: `linear-gradient(90deg, ${CREAM} 0%, ${CREAM} 25%, ${CREAM}E6 32%, ${CREAM}B3 40%, ${CREAM}66 48%, ${CREAM}33 55%, ${CREAM}00 60%, ${CREAM}00 100%)`,
          opacity: veilOpacity
        }}
      />
      {/* Bottom-to-cream fade — always kept at a minimum opacity
          (~0.15) even when the horizontal veil goes to zero, so the
          hero image never shows a hard bottom line into the page
          below. Full opacity when the horizontal shade is on. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, transparent 0%, transparent 70%, ${CREAM}66 85%, ${CREAM} 100%)`,
          opacity: Math.max(0.35, veilOpacity)
        }}
      />

      <div className="relative mx-auto max-w-6xl px-3 pt-[26px] pb-16 sm:px-6 sm:pt-[30px] sm:pb-20">
        {/* Profile circle — restored per Philip 2026-07-16. Just the
            avatar, no accompanying host name / trade specialty text.
            Sits above the H1 as an identity marker. Photo when we
            have one, initial-in-tan-circle otherwise.
            3px palette-accent ring so the rim carries the theme
            colour (tan on Chalk, yellow on Iron, etc.) — matches
            the hero's last-word accent + CTA colour. */}
        <div
          className="relative mb-4 h-16 w-16 flex-shrink-0 overflow-hidden rounded-full shadow-md sm:h-20 sm:w-20"
          style={{
            backgroundColor: TAN_SOFT,
            boxShadow: `0 0 0 3px ${TAN}, 0 6px 14px -4px rgba(0,0,0,0.25)`
          }}
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
              className="flex h-full w-full items-center justify-center text-[20px] font-black sm:text-[24px]"
              style={{ color: TAN }}
            >
              {firstName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* ── Copy on the LEFT, floating KPIs on the RIGHT.
            The photo is now the full-width backdrop underneath — no
            separate right-column photo container. */}
        <div className="relative grid grid-cols-[minmax(0,1fr)_minmax(0,130px)] gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,150px)] sm:gap-4">
          {/* LEFT — copy + CTA (over the opaque cream veil zone) */}
          <div className="min-w-0">
            <h1
              className="text-[48px] font-black leading-tight sm:text-[56px] md:text-[68px]"
              style={{
                // Standard sans-serif inherited from the app body
                // (Philip 2026-07-16 — hero text is standard font
                // style, no serif). Kept the tan text-stroke for
                // legibility over busy hero photos regardless of
                // palette. Drop shadow retained for depth.
                color: HEADLINE_INK,
                WebkitTextStroke: palette.dark
                  ? "1px rgba(255,255,255,0.85)"
                  : `1px ${TAN}`,
                textShadow: palette.dark
                  ? "0 2px 8px rgba(0,0,0,0.75), 0 0 4px rgba(0,0,0,0.55)"
                  : "2px 2px 0 rgba(255,255,255,0.95), -2px -2px 0 rgba(255,255,255,0.95), 2px -2px 0 rgba(255,255,255,0.95), -2px 2px 0 rgba(255,255,255,0.95), 0 3px 10px rgba(0,0,0,0.35)"
              }}
            >
              {restOfName && (
                <>
                  {restOfName}
                  <br/>
                </>
              )}
              {/* Last word ("Direct" on Hammerex) renders as plain
                  standard-font text per Philip 2026-07-17. Overrides
                  the H1's text-stroke + shadow so this word sits
                  clean against the hero — accent colour only, no
                  decorative outline. */}
              <span
                style={{
                  color: HERO_LAST_WORD,
                  WebkitTextStroke: "0",
                  textShadow: "none"
                }}
              >
                {lastWord}
              </span>
            </h1>
            <p
              className="mt-2 text-[13px] font-bold sm:text-[14px]"
              style={{ color: MUTED_INK }}
            >
              Built for the trade.
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

          {/* RIGHT — single Rating card. Projects tile removed
              2026-07-17 (Philip) so the upper container carries the
              rating signal only. Placeholder "Rating / New / Building"
              shows for merchants with fewer than 5 reviews. */}
          <div className="relative flex flex-col items-end justify-start gap-2 pt-1">
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

// ─── Entity chip ─────────────────────────────────────────────
//
// One-word coloured chip that declares the participant class next to
// the trade specialty. Colours chosen for high-contrast readability
// on the cream veil and to encode meaning quickly:
//   Manufacturer → dark blue (industrial, "source")
//   Merchant     → green (retail, "resale")
//   Trade        → yellow (default service, matches brand yellow)
//   Homeowner    → soft gray (personal, low-emphasis)
//
// Rendered as compact 10px uppercase pill so it slots into the
// specialty line without dominating.
type EntityType =
  | "trade"
  | "manufacturer"
  | "building-supplies"
  | "hire-service"
  | "supplier"
  | "merchant"
  | "homeowner";

const ENTITY_CHIP_STYLES: Record<
  EntityType,
  { label: string; bg: string; fg: string }
> = {
  trade:               { label: "Trade",             bg: "#FFB300", fg: "#0A0A0A" },
  manufacturer:        { label: "Manufacturer",      bg: "#1E3A8A", fg: "#FFFFFF" },
  "building-supplies": { label: "Building Supplies", bg: "#8B4513", fg: "#FFFFFF" },
  "hire-service":      { label: "Hire Service",      bg: "#B45309", fg: "#FFFFFF" },
  supplier:            { label: "Supplier",          bg: "#0F766E", fg: "#FFFFFF" },
  merchant:            { label: "Merchant",          bg: "#166534", fg: "#FFFFFF" },
  homeowner:           { label: "Homeowner",         bg: "#E5E7EB", fg: "#1B1A17" }
};

function EntityChip({ type }: { type: EntityType }) {
  const style = ENTITY_CHIP_STYLES[type];
  return (
    <span
      className="inline-flex flex-shrink-0 items-center rounded-sm px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-[0.12em]"
      style={{ backgroundColor: style.bg, color: style.fg }}
      title={`${style.label} — participant type`}
    >
      {style.label}
    </span>
  );
}

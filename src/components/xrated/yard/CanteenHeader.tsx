"use client";

// Constrained canteen header — platform-owned layout, merchant controls
// only name + trade tag + bg image. Every uploaded bg gets a dark
// gradient applied so it can never clash with the yellow-dot Network
// logo. Mobile-first.

import Link from "next/link";
import { Users, Send, Info, Check, LogOut, Menu, X, Home, ShoppingBag, Store, Settings, MessageCircle, Mail, Star, Bell, Package, Plus, BookOpen, IdCard } from "lucide-react";
import { useEffect, useState } from "react";
import type { Canteen } from "@/lib/canteens";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK } from "@/lib/brand/tokens";
import { VerifiedContactButton } from "@/components/xrated/VerifiedContactButton";
import { CanteenBusinessCardModal } from "@/components/xrated/yard/CanteenBusinessCardModal";
import { CanteenJoinRequestButton } from "@/components/xrated/yard/CanteenJoinRequestButton";

const CREAM = "#FBF6EC";

export function CanteenHeader({
  canteen,
  onInvite,
  onPost,
  isMember = false,
  isHost = false,
  onJoin,
  onLeave,
  hostHasProducts = false,
  hostWhatsapp = null,
  hostReviews = null,
  hostAvatarUrl = null,
  editMode = false,
  onToggleEditMode,
  paletteDark = false
}: {
  canteen: Canteen;
  onInvite: () => void;
  onPost: () => void;
  isMember?: boolean;
  isHost?: boolean;
  onJoin?: () => Promise<void> | void;
  onLeave?: () => Promise<void> | void;
  hostHasProducts?: boolean;
  /** Host's WhatsApp number in wa.me digits format.
   *   Present  → primary CTA becomes "WhatsApp us" (direct deep-link)
   *   Missing  → primary CTA becomes "Contact us", routes to the
   *              /contact page (email form + map with address). */
  hostWhatsapp?: string | null;
  /** Host review aggregate — powers the floating "Rating" KPI card.
   *   Only rendered when count>=5 to preserve the honest-signal rule. */
  hostReviews?: { avg: number; count: number } | null;
  /** Host's profile image. When present, the owner-greeting avatar
   *  renders the photo instead of the initial-letter fallback. Same
   *  source as CanteenHeroWow's hostAvatarUrl so the two hero surfaces
   *  stay in sync. */
  hostAvatarUrl?: string | null;
  /** Host-only Edit mode. When true, the canteen page shows editable
   *  affordances (yellow ring, "you're editing" strip, in-place editor
   *  panels). Ignored when isHost is false. */
  editMode?: boolean;
  onToggleEditMode?: () => void;
  /** Dark palette flag — flips the floating KPI stack cards to
   *  near-black so they read correctly on Iron / other dark palettes.
   *  Boolean rather than the full palette object because CanteenHeader
   *  only needs the dark/light distinction for KPI card styling. */
  paletteDark?: boolean;
}) {
  const [joining, setJoining] = useState(false);
  const [leaveMenuOpen, setLeaveMenuOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Business card modal — matches CanteenHeroWow's mobile pattern so
  // every canteen hero (mobile + desktop, every trade) exposes the
  // same Card affordance. See feedback_canteen_business_card_button.md
  // for the platform-standard rule.
  const [cardOpen, setCardOpen] = useState(false);

  // Lock body scroll while the drawer is open so the underlying page
  // doesn't scroll behind the overlay. Cleaned up on close.
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [drawerOpen]);

  async function handleJoin() {
    if (joining || !onJoin) return;
    setJoining(true);
    try { await onJoin(); } finally { setJoining(false); }
  }

  async function handleLeave() {
    if (leaving || !onLeave) return;
    setLeaving(true);
    setLeaveMenuOpen(false);
    try { await onLeave(); } finally { setLeaving(false); }
  }

  return (
    <section
      className="relative min-h-[420px] overflow-hidden lg:min-h-[560px]"
      style={{ backgroundColor: CREAM }}
    >
      {/* Background — full-width, full-height, edge-to-edge photo at
          native clarity. No cream veil across the whole hero — just a
          bottom fade so overlaid text stays legible. */}
      {canteen.headerBgUrl ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url('${canteen.headerBgUrl}')`,
            backgroundSize: "cover",
            backgroundPosition: "center"
          }}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${BRAND_YELLOW}22 0%, #FDF3E0 100%)`
          }}
        />
      )}
      {/* Bottom-only gradient for text legibility — image stays crisp
          across the top 60%, softens into the cream page at the bottom
          so there's no visible hero edge. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(180deg, transparent 0%, transparent 45%, ${CREAM}55 70%, ${CREAM}CC 88%, ${CREAM} 100%)`
        }}
      />

      {/* In-hero burger + owner greeting strip removed (Philip
          2026-07-16). GlobalHeader at the top of every page already
          carries the burger + avatar drawer + notification bell.
          Duplicating them inside the hero was pushing the H1 down
          and reading as a second, competing header. Trade-label pill
          stays because it's hero context, not chrome. */}
      <div className="relative mx-auto max-w-[1400px] px-4 pb-6 pt-6 sm:px-6 sm:pb-8 sm:pt-8">
        {/* Round WhatsApp button relocated to the left side of the
            CanteenHeroStats container (Philip 2026-07-17) so it sits
            with the stats bar rather than floating on the banner
            image. See CanteenHeroStats in CanteenPageShell.tsx. */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span
            className="rounded-sm px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.18em]"
            style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
          >
            {canteen.tradeLabel}
          </span>
        </div>

        {/* Asymmetric two-column: H1 + tagline on the LEFT, floating
            KPI cards on the RIGHT. Same pattern as the mockup — copy
            leans left, credentials pin right. Stacks on mobile. */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:gap-8">
          <div className="min-w-0">
            {/* Canteen name — POSTER-SCALE with a YELLOW ACCENT WORD.
                Splits at the last word so "UK Kitchen Fitters" reads
                as "UK Kitchen" (dark) + "Fitters." (yellow). This is
                the "Build Beautiful KITCHENS." pattern from the
                mockup. */}
            <h1
              className="text-[60px] font-black leading-[0.95] text-neutral-900 sm:text-[80px] md:text-[100px] lg:text-[120px]"
            >
              {(() => {
                const parts = canteen.name.trim().split(/\s+/);
                const last = parts.pop() ?? canteen.name;
                const rest = parts.join(" ");
                return (
                  <>
                    {rest && <>{rest}<br/></>}
                    <span style={{ color: "#B8860B" }}>{last}</span>
                  </>
                );
              })()}
            </h1>
            <p className="mt-3 max-w-md text-[13px] font-bold leading-snug text-neutral-700 sm:text-[14px] md:mt-4">
              Built for the trade.
            </p>
          </div>

          {/* Right column — asymmetric floating KPI stack. Two white
              cards stacked; the mockup pattern. */}
          <FloatingKpiStack
            projectsActive={canteen.postsLast30d}
            rating={hostReviews && hostReviews.count >= 5 ? hostReviews : null}
            dark={paletteDark}
          />
        </div>

        {/* Primary CTA row — guests get WhatsApp / Contact routed to
            the host. Hosts in Edit mode get "Button Features" — the
            reference manual for every action tile in the Edit-mode
            stats carousel below. Left-aligned per Philip 2026-07-14.
            QR chip still pins right on mobile at the same vertical
            level. */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex-1">
            {isHost && editMode ? (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("canteen:edit-action", { detail: { kind: "button-features" } }))}
                className="inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[12px] font-black uppercase tracking-wider text-neutral-900 shadow-md backdrop-blur transition hover:-translate-y-0.5 active:scale-[0.97]"
                style={{
                  backgroundColor: BRAND_YELLOW,
                  borderColor: "#166534"
                }}
              >
                <BookOpen size={14} strokeWidth={2.6}/>
                Button Features
              </button>
            ) : isHost ? (
              hostWhatsapp ? (
                <button
                  type="button"
                  onClick={() => setCardOpen(true)}
                  aria-label={`Open ${canteen.hostDisplayName}'s business card`}
                  className="inline-flex h-10 items-center gap-1.5 rounded-md px-4 text-[12px] font-black uppercase tracking-wider text-white shadow-md transition active:scale-[0.97]"
                  style={{ backgroundColor: "#B8860B" }}
                >
                  <IdCard size={13} strokeWidth={2.6}/>
                  Business Card
                </button>
              ) : null
            ) : !isMember ? (
              <div className="flex flex-wrap items-center gap-2">
                {hostWhatsapp ? (
                  /* WhatsApp CTA moved to the round button at top-left
                     of the hero (Philip 2026-07-17). Business Card
                     stays here as the primary text-CTA. */
                  <button
                    type="button"
                    onClick={() => setCardOpen(true)}
                    aria-label={`Open ${canteen.hostDisplayName}'s business card`}
                    className="inline-flex h-10 items-center gap-1.5 rounded-md px-4 text-[12px] font-black uppercase tracking-wider text-white shadow-md transition active:scale-[0.97]"
                    style={{ backgroundColor: "#B8860B" }}
                  >
                    <IdCard size={13} strokeWidth={2.6}/>
                    Business Card
                  </button>
                ) : (
                  <Link
                    href={`/trade-off/yard/canteens/${canteen.slug}/contact`}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[12px] font-black uppercase tracking-wider text-white shadow-md transition active:scale-[0.97]"
                    style={{ backgroundColor: BRAND_GREEN_DARK }}
                  >
                    <Mail size={13} strokeWidth={2.6}/>
                    Contact us
                  </Link>
                )}
                {/* Request-to-Join — visible for signed-in trades who
                    aren't already members. Self-hides for the host, for
                    guests (no auth), and once a request is pending. */}
                <CanteenJoinRequestButton
                  canteenSlug={canteen.slug}
                  canteenName={canteen.name}
                  visible={true}
                />
              </div>
            ) : null}
          </div>
          {/* QR chip — mobile only, inline with the WhatsApp/Contact
              button. Reduced to 56×56 (was 72×72 when absolute) so
              it reads as a peer of the button, not a poster. */}
          <div className="md:hidden">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-lg bg-white p-1 shadow-lg"
              title="Scan to share this canteen"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=1&data=${encodeURIComponent(`https://thenetworkers.app/trade-off/yard/canteens/${canteen.slug}`)}`}
                alt="Scan to open this canteen"
                className="block h-full w-full"
                loading="lazy"
              />
            </div>
          </div>
        </div>

        {/* Meta strip removed 2026-07-12 — host / members / posts /
            streak are now surfaced on the floating hero stats card
            (Members · Rating · Products). Host attribution lives on
            the /about page. Keeps the hero clean and reserves the
            authority signal for the stats bar. */}

        {/* Secondary action row — member/host affordances that sit
            below the primary CTA (which is now the "New Project" pill
            or "WhatsApp us" pill). Uses cream-friendly styling: dark
            text on transparent light backgrounds. */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {isMember && !isHost && (
            <div className="relative">
              <button
                onClick={() => setLeaveMenuOpen((v) => !v)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[11px] font-black uppercase tracking-wider text-white shadow-sm transition"
                style={{ backgroundColor: BRAND_GREEN_DARK }}
              >
                <Check size={12} strokeWidth={2.5}/>
                Joined
              </button>
              {leaveMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setLeaveMenuOpen(false)}/>
                  <div
                    className="absolute left-0 top-full z-20 mt-1 min-w-[180px] overflow-hidden rounded-lg border bg-white shadow-lg"
                    style={{ borderColor: "rgba(139,69,19,0.15)" }}
                  >
                    <button
                      type="button"
                      onClick={handleLeave}
                      disabled={leaving}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-60"
                    >
                      <LogOut size={13}/>
                      {leaving ? "Leaving…" : "Leave canteen"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          {(isMember || isHost) && !isHost && (
            /* Non-host members: quick "New post" button. Hosts already
               have "+ New Project" in the primary row above. */
            <button
              onClick={onPost}
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-sm transition active:scale-[0.97]"
              style={{ backgroundColor: BRAND_YELLOW }}
            >
              <Send size={12} strokeWidth={2.5}/>
              New post
            </button>
          )}
          {/* Invite trades, Manage, and Edit-mode toggle removed
              2026-07-14 per Philip. Edit mode toggle lives in the
              AppShell (top-right chip). Invite + Manage will surface
              inside the Edit-mode stats carousel via the Button
              Features documentation panel. */}
        </div>
      </div>

      {/* Cream hairline — reads clean against the cream page below */}
      <div className="h-1" style={{ backgroundColor: CREAM }}/>

      {/* ── Mobile right-drawer ──────────────────────────────
          Opens from the burger button top-right of the hero.
          Slides in from the right at 70% viewport width, full
          height. Circular close button juts out on the LEFT edge
          so users can tap it without reaching across the drawer.
          Mobile-only — hidden at md:+. */}
      {drawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-[80] md:hidden"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(10,10,10,0.60)" }}
          />
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 flex h-full w-[60vw] max-w-[280px] flex-col overflow-hidden bg-white shadow-2xl"
            style={{ animation: "canteen-drawer-slide-in 240ms ease-out" }}
          >
            {/* Edge-mounted close pill on the LEFT side of the
                drawer — juts out from the drawer edge so it's the
                first tap target as the drawer opens. */}
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
              className="absolute -left-5 top-6 z-10 flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg transition active:scale-[0.95]"
              style={{ backgroundColor: BRAND_BLACK }}
            >
              <X size={16} strokeWidth={3}/>
            </button>

            {/* Header */}
            <div
              className="border-b px-5 pb-4 pt-5"
              style={{ borderColor: "rgba(27,26,23,0.08)", backgroundColor: CREAM }}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
                {canteen.tradeLabel}
              </div>
              <div className="mt-1 text-[16px] font-black leading-tight text-neutral-900">
                {canteen.name}
              </div>
              <div className="mt-1 text-[11px] font-bold text-neutral-500">
                Hosted by {canteen.hostDisplayName}
              </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto">
              <div className="px-5 py-3 text-[10px] font-black uppercase tracking-[0.22em] text-neutral-400">
                This canteen
              </div>
              <ul className="flex flex-col">
                <DrawerLink
                  href={`/trade-off/yard/canteens/${canteen.slug}`}
                  icon={<Home size={16}/>}
                  label="Home"
                  onNavigate={() => setDrawerOpen(false)}
                />
                {hostHasProducts && (
                  <DrawerLink
                    href={`/trade-off/yard/canteens/${canteen.slug}/products`}
                    icon={<ShoppingBag size={16}/>}
                    label="View products"
                    onNavigate={() => setDrawerOpen(false)}
                  />
                )}
                <DrawerLink
                  href={`/trade-off/yard/canteens/${canteen.slug}/about`}
                  icon={<Info size={16}/>}
                  label="About us"
                  onNavigate={() => setDrawerOpen(false)}
                />
                {isHost && (
                  <DrawerLink
                    href={`/trade-off/yard/canteens/${canteen.slug}/manage`}
                    icon={<Settings size={16}/>}
                    label="Manage"
                    onNavigate={() => setDrawerOpen(false)}
                  />
                )}
              </ul>

              <div className="mt-3 border-t px-5 py-3 text-[10px] font-black uppercase tracking-[0.22em] text-neutral-400"
                style={{ borderColor: "rgba(27,26,23,0.08)" }}
              >
                Thenetworkers
              </div>
              <ul className="flex flex-col">
                <DrawerLink
                  href="/trade-off/yard"
                  icon={<Home size={16}/>}
                  label="Yard feed"
                  onNavigate={() => setDrawerOpen(false)}
                />
                <DrawerLink
                  href="/trade-off/yard/canteens"
                  icon={<Users size={16}/>}
                  label="All canteens"
                  onNavigate={() => setDrawerOpen(false)}
                />
                <DrawerLink
                  href="/tc/trade-center"
                  icon={<Store size={16}/>}
                  label="Trade Center"
                  onNavigate={() => setDrawerOpen(false)}
                />
              </ul>
            </nav>
          </div>
          <style>{`
            @keyframes canteen-drawer-slide-in {
              from { transform: translateX(100%); }
              to   { transform: translateX(0); }
            }
          `}</style>
        </div>
      )}

      {/* Business Card modal — mirrors CanteenHeroWow.tsx on mobile so
          every canteen hero (both surfaces, every trade) shares one
          Card + WhatsApp-share affordance. Only mounted when a
          whatsapp number is present since the modal's Send action
          needs it. */}
      {hostWhatsapp && (
        <CanteenBusinessCardModal
          open={cardOpen}
          onClose={() => setCardOpen(false)}
          hostSlug={canteen.hostSlug}
          hostDisplayName={canteen.hostDisplayName}
          hostFirstName={canteen.hostDisplayName.split(/\s+/)[0] ?? canteen.hostDisplayName}
          tradeLabel={canteen.tradeLabel}
          hostWhatsapp={hostWhatsapp}
          backgroundImageUrl={canteen.headerBgUrl}
        />
      )}
    </section>
  );
}

function DrawerLink({
  href,
  icon,
  label,
  onNavigate
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  onNavigate: () => void;
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        className="flex items-center gap-3 px-5 py-3 text-[13px] font-black text-neutral-800 transition active:bg-neutral-100"
      >
        <span
          aria-hidden
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
        >
          {icon}
        </span>
        {label}
      </Link>
    </li>
  );
}

// ─── Asymmetric floating KPI stack ─────────────────────────
//
// Two stacked white cards to the right of the hero H1. Matches the
// mockup pattern: "Projects · 28 · Active" (yellow-icon card) + "Rating
// · 4.9 · Excellent" (white card with star). Rating card auto-hides
// when count < 5 to preserve honest-signal rule.

function FloatingKpiStack({
  projectsActive,
  rating,
  dark = false
}: {
  /** Kept in the signature for prop compatibility; no longer rendered
   *  (Projects tile removed 2026-07-17 per Philip). */
  projectsActive: number;
  rating: { avg: number; count: number } | null;
  /** Dark palette flag — flips cards to near-black bg + white text. */
  dark?: boolean;
}) {
  void projectsActive;
  return (
    <div className="flex flex-row gap-2 md:min-w-[240px] md:flex-col md:gap-3">
      {rating ? (
        <KpiCard
          icon={<Star size={14} strokeWidth={2.3} fill="currentColor"/>}
          label="Rating"
          value={rating.avg.toFixed(1)}
          subLabel={rating.avg >= 4.5 ? "Excellent" : rating.avg >= 4 ? "Very good" : rating.avg >= 3.5 ? "Good" : "Fair"}
          iconGold
          dark={dark}
        />
      ) : (
        <KpiCard
          icon={<Star size={14} strokeWidth={2.3}/>}
          label="Rating"
          value="New"
          subLabel="Building"
          muted
          dark={dark}
        />
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  subLabel,
  accent,
  iconGold,
  muted,
  dark = false
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subLabel: string;
  accent?: boolean;
  iconGold?: boolean;
  muted?: boolean;
  /** Dark palette flag — kept in the signature for API stability. Card
   *  is now UNCONDITIONALLY black across every palette per Philip
   *  2026-07-15: "all these containers on hero image cateen and mobile
   *  should be black color". Value / label / sublabel + icon backing
   *  fixed to a black-native scheme regardless of theme. */
  dark?: boolean;
}) {
  // Silence unused-var TS while we keep `dark` in the API surface.
  void dark;
  // Icon colour: brand yellow across every card so the KPI stack
  // reads as a single yellow-highlight system (Projects + Rating both
  // pop the same). Muted "New" placeholder stays grey.
  const iconTextClass = muted ? "text-neutral-500" : "text-[#FFB300]";
  return (
    <div
      className="flex flex-1 items-center gap-2 rounded-xl border px-3 py-2 shadow-lg md:flex-none md:flex-col md:items-start md:px-4 md:py-3"
      style={{
        backgroundColor: "#0A0A0A",
        borderColor:     "rgba(255,255,255,0.10)"
      }}
    >
      <div
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg md:h-9 md:w-9 ${iconTextClass}`}
        style={{
          backgroundColor: muted
            ? "rgba(255,255,255,0.06)"
            : "rgba(255,179,0,0.18)"
        }}
        aria-hidden
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1 md:flex-none">
        <div
          className="text-[9px] font-black uppercase tracking-[0.16em] md:text-[10px]"
          style={{ color: "#A3A3A3" }}
        >
          {label}
        </div>
        <div
          className="text-[16px] font-black leading-none md:text-[22px]"
          style={{ color: muted ? "#A3A3A3" : "#FFFFFF" }}
        >
          {value}
        </div>
        <div
          className="text-[9px] font-black md:text-[10px]"
          style={{ color: "#A3A3A3" }}
        >
          {subLabel}
        </div>
      </div>
    </div>
  );
}

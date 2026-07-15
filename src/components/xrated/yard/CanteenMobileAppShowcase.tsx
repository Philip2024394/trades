"use client";

// CanteenMobileAppShowcase — compact widget in the desktop right
// column. Renders in one of two modes depending on `tier`:
//
//   ── tier="paid" (canteen pages today) ──
//   A slim card carrying only the trade-family background art + a QR
//   chip in the corner ("Open on mobile"). No live phone iframe, no
//   header, no big CTA — the paid merchant's canteen IS the demo, so
//   the widget stops competing with itself and just offers the "open
//   on phone" utility.
//
//   ── tier="free" (future free profile page, task #5) ──
//   The full widget: header ("On the go" / "How your app looks" /
//   "Tradesite Apps") + shorter iPhone with a live iframe of a demo
//   canteen + yellow CTA button (View live app / Upgrade £7.99 / App
//   Store). This is the real sales-push surface — free-tier trade
//   sees what they're missing on their own page, peer visitor sees
//   what a paid canteen looks like.
//
// Same component so task #5 just mounts it with tier="free" + the
// relevant isOwner flag.

import { useEffect, useRef, useState } from "react";
import { BRAND_YELLOW } from "@/lib/brand/tokens";
import { ExternalLink, Maximize2, X } from "lucide-react";

/** Global window-event name the edit routes dispatch when the merchant
 *  saves a change (product, post, service, etc.). The live phone iframe
 *  listens for this and reloads so the owner sees their change land in
 *  real time. Keep this string stable — call sites are `dispatchEvent
 *  (new CustomEvent(CANTEEN_CONTENT_SAVED_EVENT))`. */
export const CANTEEN_CONTENT_SAVED_EVENT = "merchant:content-saved";

// Trade-family background art anchored to the showcase container's
// footer. Mirrors CANTEEN_FOOTER_ART_BY_TRADE in CanteenPageShell.tsx
// so the same art appears both on the merchant's mobile app view AND
// in this showcase card. Add new entries in lockstep across both maps.
const CONTAINER_BG_BY_TRADE: Record<string, string> = {
  landscaper:               "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2007_16_10%20PM.png",
  "garden-designer":        "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2007_16_10%20PM.png",
  "luxury-garden-designer": "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2007_16_10%20PM.png",
  electrician:              "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2007_41_25%20PM.png",
  plasterer:                "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2007_52_37%20PM.png",
  bricklayer:               "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2007_56_50%20PM.png",
  "pool-builder":           "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2016,%202026,%2005_05_20%20AM.png",
  "wood-carver":            "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2016,%202026,%2005_08_02%20AM.png",
  "loft-ladder-specialist": "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2016,%202026,%2005_11_55%20AM.png"
};

export function CanteenMobileAppShowcase({
  hostSlug,
  tradeLabel = "your trade",
  tradeSlug = null,
  heroImageUrl,
  canteenSlug,
  tier = "paid",
  isOwner = false,
  editMode = false
}: {
  hostSlug: string;
  /** Legacy — accepted for compatibility. */
  hostFirstName?: string;
  /** Plural trade name shown in the header ("Landscapers", "Kitchen
   *  Fitters"). Comes from Canteen.tradeLabel. Defaults to a soft
   *  fallback so a missing prop never crashes copy. */
  tradeLabel?: string;
  /** Trade slug — drives the container background art (landscape
   *  family gets a wheelbarrow scene, etc.). Absent slug = no art. */
  tradeSlug?: string | null;
  /** Merchant canteen hero image — iPhone-frame fallback when no
   *  canteen slug is available. */
  heroImageUrl: string | null;
  /** Legacy — kept in the API for call sites. */
  heroTitle?: string;
  /** Canonical canteen slug. When set the iPhone frame renders a live
   *  scaled iframe of `/trade-off/yard/canteens/{slug}?embed=1`.
   *  `embed=1` suppresses this same showcase inside the iframe to
   *  prevent infinite recursion. */
  canteenSlug?: string | null;
  /** Tier gates copy + button target. Canteen pages always run at
   *  "paid" (canteens require the £7.99 tier per ADR-0006); "free"
   *  fires on the free trade profile page (task #5). */
  tier?: "paid" | "free";
  /** Only meaningful when tier="free". True when the logged-in trade
   *  is viewing their own profile — swaps the visitor pitch for a
   *  personal upgrade nudge. Detection happens at the call site. */
  isOwner?: boolean;
  /** Edit-mode flag. When true (owner editing on /trade-off/edit/*):
   *   - Rim glow on the phone (pulsing yellow box-shadow)
   *   - Header swaps to "Live edit mode / Updates land here in real time"
   *   - Iframe auto-reloads when `CANTEEN_CONTENT_SAVED_EVENT` fires
   *     on window, so saves visibly land in the phone. */
  editMode?: boolean;
}) {
  const containerBgUrl = tradeSlug ? CONTAINER_BG_BY_TRADE[tradeSlug] ?? null : null;

  // Enlarge modal state — click the phone to open a full-size iframe
  // preview. ESC or backdrop click closes.
  const [enlarged, setEnlarged] = useState(false);
  useEffect(() => {
    if (!enlarged) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setEnlarged(false); };
    window.addEventListener("keydown", onKey);
    // Lock body scroll while the modal is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [enlarged]);

  // Edit-mode iframe auto-refresh — cache-buster in the query string
  // that ticks up whenever CANTEEN_CONTENT_SAVED_EVENT fires. Iframe
  // src reads `iframeSrc` (below in IphoneFrame) which includes this
  // token, so React re-renders the iframe with a new src and it reloads.
  const [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => {
    if (!editMode) return;
    const bump = () => setRefreshTick(t => t + 1);
    window.addEventListener(CANTEEN_CONTENT_SAVED_EVENT, bump);
    return () => window.removeEventListener(CANTEEN_CONTENT_SAVED_EVENT, bump);
  }, [editMode]);

  // Copy + destination for each of the three variants. `eyebrow` is
  // the small uppercase kicker line above the main headline; `heading`
  // is the plain-caps sentence directly below it. When editMode is on,
  // paid + free-owner variants show the "Live edit mode" header so the
  // merchant knows the phone is bound to their edits.
  const variant: {
    eyebrow:    string;
    heading:    string;
    buttonLabel: string;
    buttonHref:  string;
    openTarget:  "_blank" | undefined;
  } = editMode && (tier === "paid" || isOwner)
    ? {
        eyebrow:     "Live edit mode",
        heading:     "Updates land here in real time",
        buttonLabel: tier === "paid" ? "View app" : "Upgrade — only £7.99/mo",
        buttonHref:  tier === "paid"
          ? `https://thenetworkers.app/${hostSlug}`
          : "/trade-off/packages",
        openTarget:  tier === "paid" ? "_blank" : undefined
      }
    : tier === "paid"
      ? {
          eyebrow:     "On the go",
          heading:     `Keep updated with ${tradeLabel}`,
          buttonLabel: "View app",
          buttonHref:  `https://thenetworkers.app/${hostSlug}`,
          openTarget:  "_blank"
        }
      : isOwner
        ? {
            eyebrow:     tradeLabel,
            heading:     "How your app looks",
            buttonLabel: "Upgrade — only £7.99/mo",
            buttonHref:  "/trade-off/packages",
            openTarget:  undefined
          }
        : {
            eyebrow:     "Tradesite Apps",
            heading:     "Now available",
            buttonLabel: "App Store",
            buttonHref:  "/trade-off/trades",
            openTarget:  undefined
          };

  // QR destination mirrors the button so a scan and a tap land on the
  // same place.
  const qrTarget = variant.buttonHref.startsWith("http")
    ? variant.buttonHref
    : `https://thenetworkers.app${variant.buttonHref}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=${encodeURIComponent(qrTarget)}`;

  // ── Full widget (paid + free) ────────────────────────────────
  // Same visual shape across tiers. Copy strings differ (see the
  // `variant` object above); only the QR is tier-sensitive in visual
  // treatment (hidden on mobile paid, shown desktop paid) since a
  // mobile viewer can't scan their own screen.
  return (
    <div
      className="relative overflow-hidden rounded-2xl border bg-white p-3 shadow-md md:p-4"
      style={{
        borderColor: "rgba(139,69,19,0.15)",
        // Trade-family background art anchored to the container's
        // footer — fills the width, hugs the bottom, doesn't repeat.
        // Absent for trades without a mapped image (base white shows).
        ...(containerBgUrl
          ? {
              backgroundImage:    `url("${containerBgUrl}")`,
              backgroundPosition: "bottom center",
              backgroundRepeat:   "no-repeat",
              backgroundSize:     "100% auto"
            }
          : {})
      }}
    >
      {/* Header — sits above the phone. Bold headline on top, softer
          descriptor underneath. Extra bottom margin so the descriptor
          line breathes before the phone starts. */}
      <div className="mb-5 text-center">
        <h3 className="text-[15px] font-black leading-tight text-neutral-900 md:text-[17px]">
          {variant.eyebrow}
        </h3>
        <div className="mt-0.5 text-[11px] font-semibold leading-snug text-neutral-600 md:text-[12px]">
          {variant.heading}
        </div>
      </div>

      {/* QR — top-right corner, desktop-only. A mobile viewer can't
          scan their own screen, and the CTA button below already opens
          the URL for both surfaces, so the QR is pure desktop→phone
          handoff. `hidden md:block` collapses it on mobile. */}
      <a
        href={qrTarget}
        target={variant.openTarget}
        rel={variant.openTarget ? "noreferrer noopener" : undefined}
        aria-label={`Open ${variant.buttonLabel} on your phone`}
        className="absolute right-2.5 top-2.5 z-40 hidden transition hover:scale-105 md:block"
      >
        <img
          src={qrUrl}
          alt=""
          aria-hidden
          width={36}
          height={36}
          className="block rounded-sm"
          style={{ mixBlendMode: "multiply" }}
        />
      </a>

      {/* Phone frame — capped max-width so it reads as a preview.
          Tap opens the enlarge modal. Rim glow when editMode is on
          so the merchant knows the phone is bound to their edits. */}
      <button
        type="button"
        onClick={() => setEnlarged(true)}
        aria-label="Enlarge phone preview"
        className="group relative mx-auto block cursor-zoom-in transition active:scale-[0.98]"
        style={{
          maxWidth: "160px",
          width:    "100%",
          ...(editMode
            ? {
                filter:  "drop-shadow(0 0 8px rgba(255,179,0,0.55)) drop-shadow(0 0 16px rgba(255,179,0,0.25))",
                animation: "canteen-phone-rim 2s ease-in-out infinite"
              }
            : {})
        }}
      >
        <IphoneFrame
          heroImageUrl={heroImageUrl}
          canteenSlug={canteenSlug ?? null}
          refreshTick={refreshTick}
        />
        {/* Hover hint — enlarge icon top-right of the phone. */}
        <span
          aria-hidden
          className="pointer-events-none absolute right-1.5 top-1.5 z-30 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white opacity-0 shadow-md transition group-hover:opacity-100"
        >
          <Maximize2 size={11} strokeWidth={2.5}/>
        </span>
      </button>

      {/* CTA button — under the phone. Yellow for paid + free-owner
          upsell, warm tan for free-visitor App Store link so it reads
          as a discovery cue not a hard sell. */}
      <a
        href={variant.buttonHref}
        target={variant.openTarget}
        rel={variant.openTarget ? "noreferrer noopener" : undefined}
        className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-md transition active:scale-[0.98]"
        style={{ backgroundColor: BRAND_YELLOW }}
      >
        <ExternalLink size={12} strokeWidth={2.5}/>
        {variant.buttonLabel}
      </a>

      {/* Powered-by footer — free-visitor variant only, so a visiting
          trade knows what the platform is called. Paid + free-owner
          variants keep the card clean; those audiences already know. */}
      {tier === "free" && !isOwner && (
        <div
          className="mt-2 border-t pt-2 text-center"
          style={{ borderColor: "rgba(139,69,19,0.10)" }}
        >
          <span className="text-[8.5px] font-black uppercase tracking-[0.22em] text-neutral-500">
            Powered by{" "}
            <span style={{ color: "#B8860B" }}>Thenetworkers.app</span>
          </span>
        </div>
      )}

      {/* Rim-glow keyframes — declared inline so the animation ships
          with the component. Yellow pulse mirrors the "Live listings"
          pulsing dot so readers learn yellow = live-updating. */}
      <style jsx>{`
        @keyframes canteen-phone-rim {
          0%, 100% { filter: drop-shadow(0 0 6px rgba(255,179,0,0.45)) drop-shadow(0 0 12px rgba(255,179,0,0.20)); }
          50%      { filter: drop-shadow(0 0 12px rgba(255,179,0,0.80)) drop-shadow(0 0 24px rgba(255,179,0,0.35)); }
        }
      `}</style>

      {/* ── Enlarge modal ──────────────────────────────────────
          Centered phone at real mobile scale (390px wide), backdrop
          click + ESC close (ESC handled in the useEffect above). */}
      {enlarged && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged phone preview"
          onClick={() => setEnlarged(false)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setEnlarged(false); }}
            aria-label="Close phone preview"
            className="absolute right-4 top-4 z-[110] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white shadow-md transition hover:bg-white/20"
          >
            <X size={20} strokeWidth={2.5}/>
          </button>
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative aspect-[9/19] w-full max-w-[320px] overflow-hidden rounded-[36px] border-[6px] border-neutral-900 bg-neutral-950 shadow-2xl"
          >
            <div aria-hidden className="absolute left-1/2 top-3 z-30 h-3.5 w-24 -translate-x-1/2 rounded-full bg-black"/>
            <div className="absolute inset-0 overflow-hidden bg-white" style={{ borderRadius: "30px" }}>
              {canteenSlug && (
                <iframe
                  key={`enlarged-${refreshTick}`}
                  src={`/trade-off/yard/canteens/${canteenSlug}?embed=1`}
                  title="Enlarged canteen preview"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  onLoad={(e) => {
                    try { e.currentTarget.contentWindow?.scrollTo(0, 0); } catch { /* no-op */ }
                  }}
                  className="block h-full w-full border-0"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IphoneFrame({
  heroImageUrl,
  canteenSlug,
  refreshTick = 0
}: {
  heroImageUrl: string | null;
  canteenSlug: string | null;
  /** Increments on `merchant:content-saved` window event when the parent
   *  is in edit mode. React sees the key change and remounts the iframe
   *  so the merchant's saved edit visibly lands in the phone. */
  refreshTick?: number;
}) {
  // Live iframe URL — appends ?embed=1 so the canteen page suppresses
  // its own CanteenMobileAppShowcase inside the iframe (prevents
  // infinite recursion). When no canteenSlug is passed, falls back to
  // the merchant's static hero image.
  const liveUrl = canteenSlug
    ? `/trade-off/yard/canteens/${canteenSlug}?embed=1`
    : null;

  return (
    <div
      className="relative mx-auto aspect-[9/16] w-full overflow-hidden rounded-[20px] border-[3px] border-neutral-900 bg-neutral-950 shadow-2xl"
      style={{
        boxShadow: "0 16px 32px -10px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06) inset"
      }}
    >
      {/* Dynamic-island / notch approximation */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1.5 z-30 h-2.5 w-10 -translate-x-1/2 rounded-full bg-black"
      />

      {/* Phone screen — live iframe when we have a canteen slug, else
          static hero image. Inner border-radius matches the chassis so
          content clips cleanly at the rounded corners. */}
      <div
        className="absolute inset-0 overflow-hidden bg-white"
        style={{ borderRadius: "18px", isolation: "isolate" }}
      >
        {liveUrl ? (
          // iframe viewport is 390px (real iPhone width) so the canteen
          // page's mobile CSS breakpoints fire correctly. The wrapper is
          // sized at 100/scale% (253%) so that iframe:width=100% of the
          // wrapper resolves to exactly 390px in unscaled space; scale
          // 0.395 then shrinks it back down to fit the ~154px screen
          // inside the 160px chassis. Same pattern as the templates
          // picker's phone preview — proportional, not clipped.
          <div
            style={{
              transform: "scale(0.395)",
              transformOrigin: "top left",
              width:  "253.16%",   // 100 / 0.395
              height: "253.16%",
              overflow: "hidden",
              willChange: "transform"
            }}
          >
            <iframe
              key={refreshTick}
              src={liveUrl}
              title="Live canteen preview"
              sandbox="allow-scripts allow-same-origin"
              loading="lazy"
              onLoad={(e) => {
                // Force scrollTop=0 on load so the preview always
                // starts at the hero. Chromium's session-scroll
                // restore was showing half-scrolled canteens on
                // re-renders. Try/catch guards against cross-origin
                // iframes even though this one is same-origin.
                try {
                  e.currentTarget.contentWindow?.scrollTo(0, 0);
                } catch { /* no-op */ }
              }}
              className="block border-0"
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        ) : heroImageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={heroImageUrl}
            alt=""
            aria-hidden
            loading="lazy"
            className="block h-full w-full object-cover"
          />
        ) : null}
      </div>
    </div>
  );
}

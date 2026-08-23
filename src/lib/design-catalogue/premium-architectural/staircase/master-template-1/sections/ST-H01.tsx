// NEX Design Catalogue · ST-H01 · Premium Architectural Hero (Philip 2026-08-14 · v4).
//
// v4 changes (Philip 2026-08-14):
//   - Mobile copy sits OVER the hero image on the LEFT side (revert of
//     v3 stacked-below variant). Overlay composition at every viewport.
//   - Gallery secondary CTA removed. Single Chat Now primary.
//
// Composition rule (unchanged from v3):
//   The hero is ONE integrated architectural composition — the photo
//   is the full visual field, copy overlays the quiet left area, the
//   staircase remains dominant on the right. Never "picture next to
//   text column".
//
// Responsive strategy:
//   - Photo focal point stays on the staircase (objectPosition right)
//   - Scrim strength scales with viewport width so mobile copy is
//     legible on top of a small photograph without whiting it out
//   - Type + spacing use clamp so mobile stays readable + generous
//   - Photo aspect narrows on mobile (portrait-friendly) so the copy
//     column has vertical breathing room
//
// Photo focal point on mobile: objectPosition "72% center" keeps the
// staircase treads visible in the right half while the copy overlay
// enjoys the airy quiet zone in the left half of the original image.

"use client";

import { useCallback, useEffect, useState } from "react";
import { MT1_TOKENS as T } from "../tokens";
import { StaircaseDesignProvider } from "../StaircaseDesign";
import { STW01 } from "./ST-W01";

// Served directly from ImageKit (approved NEX-owned storage per the
// NEX Storage Boundary Rule 2026-08-14). Local /public copy is a
// build-time fallback that Next.js has been serving as 0-byte in dev.
const HERO_IMG = "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2014,%202026,%2008_16_57%20PM.png";

type TrustSignal = { label: string };

type Config = {
  eyebrow?: string;
  headlineTop?: string;
  headlineBottom?: string;
  supportingCopy?: string;
  primaryCtaLabel?: string;
  primaryCtaHref?: string;
  /** Small trust chips under the CTA · qualitative signals only, no
   *  fabricated numbers unless the owner supplies verified data. */
  trustSignals?: TrustSignal[];
  /** Whether to render the subtle "scroll to explore" hint at the
   *  bottom of the hero. Defaults to true so the customer knows there
   *  is a full experience below the fold. */
  showScrollHint?: boolean;
};

const DEFAULTS: Required<Config> = {
  eyebrow:            "CRAFTED TO INSPIRE",
  headlineTop:        "Your Home Deserves",
  headlineBottom:     "The Best",
  supportingCopy:     "Browse our design portfolio for inspiration, then get in touch for a staircase crafted around your home.",
  primaryCtaLabel:    "Get A Quote",
  primaryCtaHref:     "#chat",
  trustSignals: [
    { label: "Bespoke design" },
    { label: "UK-wide installation" },
    { label: "Free consultation" }
  ],
  showScrollHint: true
};

export function STH01(props: Config = {}) {
  const c = { ...DEFAULTS, ...props };
  const [chatOpen, setChatOpen]     = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  const openChat = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setChatOpen(true);
  }, []);
  const closeChat = useCallback(() => setChatOpen(false), []);

  // Guided design overlay · Philip 2026-08-18. The "Get Your Staircase
  // Quote" text button opens the 14-node wizard directly (ST-W01),
  // NOT the chat. The chat is a separate entry surfaced by the image
  // CTA below · the wizard is the structured quote-brief entry point.
  const openWizard = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setWizardOpen(true);
  }, []);
  const closeWizard = useCallback(() => setWizardOpen(false), []);

  useEffect(() => {
    if (!chatOpen && !wizardOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (wizardOpen) closeWizard();
        else if (chatOpen) closeChat();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [chatOpen, wizardOpen, closeChat, closeWizard]);

  return (
    <section
      data-section-id="ST-H01"
      data-master-template="1"
      data-vertical="staircase"
      data-family="premium-architectural"
      style={{
        background: T.color.surface,
        color: T.color.ink,
        fontFamily: T.font.sans,
        padding: 0,
        position: "relative"
      }}
    >
      <div className="mt1-hero-canvas">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_IMG}
          alt="Bespoke floating oak staircase with glass balustrade in a light-filled contemporary interior"
          className="mt1-hero-img"
        />
        <div aria-hidden className="mt1-hero-scrim" />

        {/* Bottom-to-white fade so the hero image blends into the page
            (Philip 2026-08-14) — pulls the trust-bar container onto the
            image without a hard seam. */}
        <div aria-hidden className="mt1-hero-bottom-fade" />

        {/* NEX verified badge removed per Philip 2026-08-14. */}

        <div className="mt1-hero-copy-wrap">
          <div className="mt1-hero-copy">
            <div className="mt1-hero-eyebrow">{c.eyebrow}</div>

            <h1 className="mt1-hero-headline">
              <span>{c.headlineTop}</span>
              <span className="mt1-hero-headline-italic">{c.headlineBottom}</span>
            </h1>

            <div aria-hidden className="mt1-hero-rule" />

            <p className="mt1-hero-copy-body">{c.supportingCopy}</p>

            <div className="mt1-hero-cta-row">
              {/* Get Your Staircase Quote · Philip 2026-08-18 · this is
                  the STAIRCASE QUOTE BUTTON. It opens the 14-node
                  Guided Design wizard (ST-W01) directly — NOT the chat.
                  The wizard is the structured route the customer takes
                  when they're ready to commit to a quote brief; the
                  chat entry (image CTA below) is the softer route for
                  general questions. */}
              <a
                href="#guided-design"
                onClick={openWizard}
                className="mt1-hero-cta"
                aria-haspopup="dialog"
                aria-expanded={wizardOpen}
                data-testid="mt1-hero-quote-cta"
              >
                <span>Get Your Staircase Quote</span>
                <span aria-hidden style={{ display: "inline-flex" }}>
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" /><path d="m13 5 7 7-7 7" />
                  </svg>
                </span>
              </a>

              <a
                href={c.primaryCtaHref}
                onClick={openChat}
                className="mt1-hero-cta-image"
                aria-label={c.primaryCtaLabel}
                aria-haspopup="dialog"
                aria-expanded={chatOpen}
              >
                <img
                  src="https://ik.imagekit.io/5vv5pw26q/Untitledsdasddsdssdsdssadasdsdfasdasdasdsdsdsdfsdfdfsdfsdfsdfsdfdf-removebg-preview.png"
                  alt=""
                  aria-hidden
                />
              </a>
            </div>

            {c.trustSignals.length > 0 && (
              <ul className="mt1-hero-trust">
                {c.trustSignals.map((t, i) => (
                  <li key={t.label} className="mt1-hero-trust-item">
                    {i > 0 && (
                      <span aria-hidden className="mt1-hero-trust-sep">·</span>
                    )}
                    <span>{t.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {c.showScrollHint && (
          <a
            href="#materials"
            className="mt1-hero-scroll-hint"
            aria-label="Scroll to explore staircase materials and designs"
          >
            <span className="mt1-hero-scroll-label">Explore</span>
            <span aria-hidden className="mt1-hero-scroll-chev">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </a>
        )}
      </div>

      {/* ─── Guided Design wizard · full-screen overlay ─────────
          Philip 2026-08-18 · triggered by the "Get Your Staircase
          Quote" text button above. ST-W01 is mounted directly (not
          the chat) with its own StaircaseDesignProvider because the
          hero doesn't share the scroll's provider tree. autoStart
          skips the wizard's IdleCard — clicking the quote button IS
          the opt-in. Escape closes. */}
      {wizardOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Guided staircase design"
          data-testid="mt1-hero-wizard-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: T.color.surface,
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
            overflow: "auto"
          }}
        >
          <button
            type="button"
            onClick={closeWizard}
            aria-label="Close guided design"
            title="Close"
            style={{
              position: "fixed",
              top: "clamp(12px, 2vw, 20px)",
              right: "clamp(12px, 2vw, 20px)",
              zIndex: 110,
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "rgba(253, 249, 240, 0.85)",
              backdropFilter: "blur(28px) saturate(200%)",
              WebkitBackdropFilter: "blur(28px) saturate(200%)",
              border: "1px solid rgba(58, 52, 40, 0.08)",
              color: T.color.ink,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 22px -10px rgba(58, 52, 40, 0.22)"
            }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>

          <StaircaseDesignProvider>
            {/* Two-tile IdleCard renders first (autoStart dropped
                2026-08-20 · Philip). Customer sees the choice between
                "I already know what I want" (fast path → close wizard +
                open Summit chat) and "Help me design my staircase"
                (starts the guided wizard). */}
            <STW01
              onExit={closeWizard}
              onSkipToChat={() => {
                closeWizard();
                setChatOpen(true);
              }}
            />
          </StaircaseDesignProvider>
        </div>
      )}

      {/* ─── Chat with Summit · full-screen overlay ─────────────
          Chat Now (decorative image CTA) opens the BRANDED chat page
          (ST-CH01) in an iframe at full viewport. Kept as the softer
          general-questions route · the Guided Design wizard above is
          the structured quote-brief route · Philip 2026-08-18. The
          chat page carries its OWN floating brown-glass header so the
          overlay wrapper has no header of its own. Escape dismisses. */}
      {chatOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Chat with Summit"
          style={{
            position: "fixed",
            inset: 0,
            background: T.color.surface,
            zIndex: 100,
            display: "flex",
            flexDirection: "column"
          }}
        >
          {/* Outer X removed per Philip 2026-08-15 · the chat's own
              floating header has a home button that returns to the
              landing page. */}
          <iframe
            src="/nex-app/design-catalogue/staircase/master-template-1/chat"
            title="Chat with Summit"
            style={{ flex: 1, width: "100%", border: 0, background: T.color.surface }}
          />
        </div>
      )}

      <style>{`
        /* ─── MOBILE default · portrait hero · overlay on the LEFT ──
           Height = width×5/4 − 70px (Philip 2026-08-14 · shorten hero
           by 70px on phone). Tablet + desktop switch back to aspect
           ratios below. */
        .mt1-hero-canvas {
          position: relative;
          width: 100%;
          height: calc(100vw * 5 / 4 - 70px);
          min-height: 380px;
          overflow: hidden;
        }
        .mt1-hero-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: 72% center;
        }
        .mt1-hero-scrim {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg,
              rgba(255,255,255,0.96) 0%,
              rgba(255,255,255,0.9)  30%,
              rgba(255,255,255,0.55) 55%,
              rgba(255,255,255,0.1)  75%,
              rgba(255,255,255,0)    92%);
        }
        .mt1-hero-bottom-fade {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 18%;
          background: linear-gradient(to top, ${T.color.surface} 0%, rgba(255,255,255,0) 100%);
          pointer-events: none;
        }
        .mt1-hero-badge {
          position: absolute;
          right: clamp(16px, 3vw, 40px);
          bottom: clamp(28px, 4vw, 56px);
          width: clamp(80px, 10vw, 140px);
          height: auto;
          object-fit: contain;
          filter: drop-shadow(0 6px 16px rgba(58, 52, 40, 0.28));
          pointer-events: none;
          z-index: 2;
        }
        .mt1-hero-copy-wrap {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          padding: clamp(20px, 6vw, 32px);
        }
        .mt1-hero-copy {
          max-width: min(88%, 480px);
          display: flex;
          flex-direction: column;
        }
        .mt1-hero-eyebrow {
          font-size: 11px;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: ${T.color.accent};
          font-weight: 600;
        }
        .mt1-hero-headline {
          margin: 14px 0 0;
          font-family: ${T.font.serif};
          font-weight: 400;
          color: ${T.color.ink};
          font-size: clamp(36px, 10vw, 56px);
          line-height: 0.98;
          letter-spacing: -0.01em;
        }
        .mt1-hero-headline > span { display: block; }
        .mt1-hero-headline-italic { font-style: italic; color: ${T.color.accent}; margin-top: 4px; }
        .mt1-hero-rule {
          width: 64px;
          height: 1.5px;
          background: ${T.color.accent};
          margin-top: 18px;
          opacity: 0.9;
        }
        .mt1-hero-copy-body {
          margin: 16px 0 0;
          max-width: 34ch;
          font-size: 14px;
          line-height: 1.55;
          color: ${T.color.inkMuted};
        }
        .mt1-hero-cta-row {
          display: flex;
          gap: 12px;
          margin-top: 20px;
          flex-wrap: wrap;
        }
        /* Trust chips · sit under the CTA · qualitative signals that
           reassure without fabricated numbers. Owner overrides the
           labels via the trustSignals prop. */
        .mt1-hero-trust {
          list-style: none;
          margin: 18px 0 0;
          padding: 0;
          display: flex;
          flex-wrap: wrap;
          gap: 6px 10px;
          font-size: 11.5px;
          letter-spacing: 0.02em;
          color: ${T.color.inkMuted};
        }
        .mt1-hero-trust-item {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .mt1-hero-trust-sep {
          color: ${T.color.accent};
          opacity: 0.6;
        }
        /* Subtle scroll indicator · bottom-centre of the hero canvas ·
           gentle down-bounce · reduced-motion safe · degrades to a
           static chevron. */
        .mt1-hero-scroll-hint {
          position: absolute;
          left: 50%;
          bottom: clamp(18px, 3vw, 32px);
          transform: translateX(-50%);
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          color: ${T.color.inkMuted};
          text-decoration: none;
          font-size: 10.5px;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          font-weight: 600;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.55);
          backdrop-filter: blur(4px);
          transition: color 160ms, background 160ms, transform 160ms;
          z-index: 3;
        }
        .mt1-hero-scroll-hint:hover,
        .mt1-hero-scroll-hint:focus-visible {
          color: ${T.color.accent};
          background: rgba(255, 255, 255, 0.85);
          outline: none;
        }
        .mt1-hero-scroll-chev {
          display: inline-flex;
          animation: mt1-hero-scroll-bounce 2.4s ease-in-out infinite;
        }
        @keyframes mt1-hero-scroll-bounce {
          0%, 100% { transform: translateY(0); opacity: 0.7; }
          50%      { transform: translateY(3px); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .mt1-hero-scroll-chev { animation: none !important; }
        }
        @media (max-width: 720px) {
          .mt1-hero-scroll-hint {
            font-size: 10px;
            padding: 6px 10px;
          }
          .mt1-hero-scroll-label {
            display: none;
          }
        }
        /* Philip 2026-08-17 · hero CTA rendered as an image button.
           The image itself IS the visual — no accent background, no
           padding, no shadow · just a subtle scale + drop-shadow on
           hover so it feels tactile. Fixed max width keeps it inside
           the hero copy column on every breakpoint. */
        .mt1-hero-cta-image {
          display: inline-block;
          padding: 0;
          background: transparent;
          border: 0;
          text-decoration: none;
          transition: transform 180ms ease, filter 180ms ease;
          filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.18));
        }
        .mt1-hero-cta-image:hover,
        .mt1-hero-cta-image:focus-visible {
          transform: translateY(-1px) scale(1.02);
          filter: drop-shadow(0 14px 22px rgba(0, 0, 0, 0.22));
        }
        /* Height-first sizing (Philip 2026-08-17 · bigger + longer).
           The button image is naturally wide; capping height lets width
           follow the intrinsic aspect ratio. max-width still caps the
           image on wide screens where the height cap would otherwise
           over-expand it. */
        .mt1-hero-cta-image img {
          display: block;
          width: auto;
          max-width: 300px;
          height: auto;
          max-height: 60px;
          user-select: none;
          -webkit-user-drag: none;
        }
        @media (max-width: 640px) {
          .mt1-hero-cta-image img {
            max-width: 240px;
            max-height: 52px;
          }
        }
        .mt1-hero-cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 14px 24px;
          min-height: 48px;
          background: ${T.color.accent};
          color: #FFFFFF;
          border-radius: ${T.radius.button};
          text-decoration: none;
          font-weight: 600;
          font-size: 14px;
          letter-spacing: 0.02em;
          box-shadow: 0 12px 28px -14px rgba(181, 143, 94, 0.65);
          position: relative;
          overflow: hidden;
          isolation: isolate;
        }
        /* Philip 2026-08-14 · shine sweep · a soft light streak runs
           across the CTA every ~3.6s to draw the eye without shouting. */
        .mt1-hero-cta::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(
            110deg,
            rgba(255,255,255,0) 0%,
            rgba(255,255,255,0) 35%,
            rgba(255,255,255,0.55) 50%,
            rgba(255,255,255,0) 65%,
            rgba(255,255,255,0) 100%
          );
          transform: translateX(-100%);
          animation: mt1-hero-cta-shine 3.6s ease-in-out infinite;
          pointer-events: none;
          z-index: 0;
        }
        .mt1-hero-cta > * { position: relative; z-index: 1; }
        @keyframes mt1-hero-cta-shine {
          0%   { transform: translateX(-100%); }
          55%  { transform: translateX(100%); }
          100% { transform: translateX(100%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .mt1-hero-cta::before { animation: none !important; opacity: 0; }
        }

        /* ─── TABLET (>= 720px) ────────────────────────────────── */
        @media (min-width: 720px) {
          .mt1-hero-canvas { height: auto; min-height: 0; aspect-ratio: 3 / 2; }
          .mt1-hero-img { object-position: 62% center; }
          .mt1-hero-scrim {
            background:
              linear-gradient(90deg,
                rgba(255,255,255,0.94) 0%,
                rgba(255,255,255,0.9)  22%,
                rgba(255,255,255,0.6)  42%,
                rgba(255,255,255,0.15) 60%,
                rgba(255,255,255,0)    80%);
          }
          .mt1-hero-copy-wrap { padding: clamp(32px, 5vw, 64px); }
          .mt1-hero-copy { max-width: min(520px, 55%); }
          .mt1-hero-eyebrow { font-size: 12px; }
          .mt1-hero-headline { font-size: clamp(44px, 5.6vw, 72px); }
          .mt1-hero-copy-body { font-size: clamp(14px, 1vw, 16px); margin-top: 22px; max-width: 420px; }
          .mt1-hero-cta-row { margin-top: 28px; }
          .mt1-hero-rule { width: 80px; margin-top: 22px; }
        }

        /* ─── DESKTOP (>= 1080px) ──────────────────────────────── */
        @media (min-width: 1080px) {
          .mt1-hero-canvas { aspect-ratio: 21 / 10; }
          .mt1-hero-scrim {
            background:
              linear-gradient(90deg,
                rgba(255,255,255,0.94) 0%,
                rgba(255,255,255,0.9)  20%,
                rgba(255,255,255,0.55) 42%,
                rgba(255,255,255,0.12) 60%,
                rgba(255,255,255,0)    75%);
          }
          .mt1-hero-copy-wrap { padding: clamp(48px, 5vw, 80px); }
          .mt1-hero-copy { max-width: min(560px, 48%); }
          .mt1-hero-headline { font-size: clamp(52px, 5.4vw, 88px); }
        }
      `}</style>
    </section>
  );
}

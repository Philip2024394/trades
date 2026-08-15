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

// Served directly from ImageKit (approved NEX-owned storage per the
// NEX Storage Boundary Rule 2026-08-14). Local /public copy is a
// build-time fallback that Next.js has been serving as 0-byte in dev.
const HERO_IMG = "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2014,%202026,%2008_16_57%20PM.png";

type Config = {
  eyebrow?: string;
  headlineTop?: string;
  headlineBottom?: string;
  supportingCopy?: string;
  primaryCtaLabel?: string;
  primaryCtaHref?: string;
};

const DEFAULTS: Required<Config> = {
  eyebrow:            "CRAFTED TO INSPIRE",
  headlineTop:        "Your Home Deserves",
  headlineBottom:     "The Best",
  supportingCopy:     "Browse our design portfolio for inspiration, then get in touch for a staircase crafted around your home.",
  primaryCtaLabel:    "Get A Quote",
  primaryCtaHref:     "#chat"
};

export function STH01(props: Config = {}) {
  const c = { ...DEFAULTS, ...props };
  const [chatOpen, setChatOpen] = useState(false);

  const openChat = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setChatOpen(true);
  }, []);
  const closeChat = useCallback(() => setChatOpen(false), []);

  useEffect(() => {
    if (!chatOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeChat(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [chatOpen, closeChat]);

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
              <a
                href={c.primaryCtaHref}
                onClick={openChat}
                className="mt1-hero-cta"
                aria-haspopup="dialog"
                aria-expanded={chatOpen}
              >
                {c.primaryCtaLabel}
                <ChevronRight />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Chat with Summit · full-screen overlay ─────────────
          Chat Now / Get A Quote opens the BRANDED chat page (ST-CH01)
          in an iframe at full viewport. The chat page carries its OWN
          floating brown-glass header so the overlay wrapper has no
          header of its own · Philip 2026-08-15. Escape dismisses. */}
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

function ChevronRight() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

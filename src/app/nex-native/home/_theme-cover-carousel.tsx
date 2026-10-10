"use client";

// src/app/nex-native/home/_theme-cover-carousel.tsx
//
// Signed-in /home · world-class mobile-first swipe carousel of theme ×
// cover-layout designs rendered inside realistic phone-frame silhouettes.
// -------------------------------------------------------------------------
// Each slide is a scaled replica of the sealed Bridge 98 `PhoneFrame`
// (390×844 iPhone-15 proportions) with a stylized mini-cover inside —
// theme accent, identity ring, product grid, composer footer — so the
// signed-in visitor sees the NEX product visually at app-size on their
// home surface before deciding which theme × layout to open.
//
// Native CSS scroll-snap carries the swipe gesture (no gesture library).
// IntersectionObserver tracks the active slide for the dot pager so
// taps on the pager scroll back to the matching slide.
//
// Taps on a slide deep-link to /nex-native/cover/preview/{layoutId}
// ?theme={themeId} — the real Bridge 98 preview — so the home surface
// is a doorway into the live gallery, never a reimplementation of it.

import * as React from "react";
import Link from "next/link";

export interface ThemeCoverSlide {
  themeId: string;
  themeName: string;
  /** Theme accent · signature color (e.g. Joker acid green `#8FFF6E`). */
  themeAccent: string;
  /** Message-bubble rim hex (muted hairline, may differ from accent). */
  themeBubbleRim: string;
  /** Composer-input rim hex (muted hairline, may differ from accent). */
  themeComposerRim: string;
  /** Real wallpaper URL from `nex_chat_theme.hero_image_url` · when
   *  present it paints the slide's phone-screen background live. */
  themeWallpaperUrl: string | null;
  layoutId: string;
  layoutLabel: string;
  layoutBlurb: string;
  href: string;
  /** Shown to tag the slide the viewer is currently using. All slides
   *  on the signed-in /home carousel are the viewer's theme — tag
   *  once (first slide) to say "this is you across your layouts". */
  isCurrent?: boolean;
}

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7200",
};

export function ThemeCoverCarousel({ slides }: { slides: ThemeCoverSlide[] }) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const slideEls = Array.from(
      scroller.querySelectorAll<HTMLElement>("[data-nex-slide-index]"),
    );
    if (slideEls.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        let best: { idx: number; ratio: number } | null = null;
        for (const e of entries) {
          const idx = Number((e.target as HTMLElement).dataset.nexSlideIndex);
          if (!best || e.intersectionRatio > best.ratio) {
            best = { idx, ratio: e.intersectionRatio };
          }
        }
        if (best && best.ratio > 0.5) setActiveIndex(best.idx);
      },
      { root: scroller, threshold: [0.5, 0.75, 1] },
    );
    slideEls.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [slides.length]);

  function scrollToSlide(i: number) {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const el = scroller.querySelector<HTMLElement>(`[data-nex-slide-index="${i}"]`);
    if (el) scroller.scrollTo({ left: el.offsetLeft, behavior: "smooth" });
  }

  return (
    <div style={{ position: "relative" }}>
      <style>{`
        [data-nex-theme-scroller] {
          scrollbar-width: none;
          -ms-overflow-style: none;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-x: contain;
        }
        [data-nex-theme-scroller]::-webkit-scrollbar { display: none; height: 0; width: 0; }
        [data-nex-slide-card] { transition: transform 240ms ease, opacity 240ms ease; }
        [data-nex-slide-card][data-active="false"] { transform: scale(0.94); opacity: 0.72; }
        [data-nex-slide-card]:focus-visible { outline: 2px solid ${NEX.cyan}; outline-offset: 6px; border-radius: 32px; }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-slide-card] { transition: none; }
          [data-nex-theme-scroller] { scroll-behavior: auto; }
        }
        @keyframes nex-slide-skeleton {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.55; }
        }
      `}</style>

      <div
        ref={scrollerRef}
        data-nex-theme-scroller
        style={{
          display: "flex",
          gap: 0,
          overflowX: "auto",
          overflowY: "hidden",
          padding: "8px 0 24px",
          // Full-bleed to the viewport regardless of the parent's
          // max-width · the calc() centers the scroller on the
          // viewport so each slide can span exactly 100vw with no
          // peek. Mobile-first: one phone frame per view, swipe
          // snaps cleanly to the next whole frame.
          marginLeft: "calc(50% - 50vw)",
          marginRight: "calc(50% - 50vw)",
          scrollBehavior: "smooth",
        }}
      >
        {slides.map((s, i) => (
          <article
            key={`${s.themeId}:${s.layoutId}`}
            data-nex-slide-index={i}
            style={{
              scrollSnapAlign: "center",
              flex: "0 0 auto",
              width: "100vw",
              padding: "0 20px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <Link
              href={s.href}
              data-nex-slide-card
              data-active={i === activeIndex ? "true" : "false"}
              aria-label={`Open ${s.themeName} × ${s.layoutLabel} design`}
              style={{
                display: "block",
                textDecoration: "none",
                color: "inherit",
                borderRadius: 32,
              }}
            >
              <LiveMiniPhoneFrame
                slide={s}
                // Only load the live iframe for the active slide + its
                // immediate neighbours. Keeps dev-worker memory bounded
                // (3 iframes max alive at any time) on the 8GB Victus
                // instead of trying to compile all 5 at once.
                isHot={Math.abs(i - activeIndex) <= 1}
              />
            </Link>
            <SlideCaption slide={s} />
          </article>
        ))}
      </div>

      {/* Dot pager · taps scroll back to the slide */}
      <div
        role="tablist"
        aria-label="Theme design slides"
        style={{
          marginTop: 4,
          display: "flex",
          gap: 8,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {slides.map((s, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === activeIndex}
            aria-label={`Slide ${i + 1}: ${s.themeName}`}
            onClick={() => scrollToSlide(i)}
            style={{
              width: i === activeIndex ? 28 : 8,
              height: 8,
              borderRadius: 999,
              border: "none",
              background:
                i === activeIndex ? NEX.cyan : "rgba(0, 175, 255, 0.28)",
              cursor: "pointer",
              padding: 0,
              transition: "width 220ms ease, background 220ms ease",
            }}
          />
        ))}
      </div>

      {/* First-mount swipe hint · fades after 2.4s via CSS animation */}
      <SwipeHint />
    </div>
  );
}

// ─── Scaled replica of /cover/preview/_phone-frame ──────────────────────
// Preserves the ~2.17 aspect of 390×844. 220×476 (≈ 0.56×) fits two slides
// shoulder-to-shoulder on narrow phones once the gap + snap-center math
// is applied, while still reading as a realistic device silhouette.

/** Live phone-frame slide · when `isHot`, embeds the real
 *  /cover/preview/{layoutId}?theme=…&embed=1 route inside a scaled
 *  iframe. When cold, falls back to the stylized MiniPhoneFrame so
 *  the slide still reads under the theme without burning a compile.
 *  Hot/cold is driven by activeIndex proximity in the parent. */
function LiveMiniPhoneFrame({ slide, isHot }: { slide: ThemeCoverSlide; isHot: boolean }) {
  // Track iframe load so we never reveal a half-painted theme. Skeleton
  // overlay stays at opacity 1 until the embedded page fires `load`,
  // then fades to 0 over 180ms · atomic theme reveal per One NEX
  // Identity doctrine.
  const [loaded, setLoaded] = React.useState(false);
  // Border-box 7px border on each side · the iframe must fit the
  // INNER area (W - 14), not the outer W, or the composer footer
  // at the bottom and the right-edge content get clipped. H is
  // tuned so inner aspect matches the iPhone-15 390:844 ratio exactly.
  const BORDER = 7;
  const W = 220;
  const INNER_W = W - BORDER * 2;              // 206
  const NATIVE_W = 390;
  const NATIVE_H = 844;
  const scale = INNER_W / NATIVE_W;            // ≈ 0.5282
  const INNER_H = Math.round(NATIVE_H * scale); // 446
  const H = INNER_H + BORDER * 2;              // 460

  if (!isHot) return <MiniPhoneFrame slide={slide} />;

  const src = `${slide.href}${slide.href.includes("?") ? "&" : "?"}embed=1`;
  return (
    <div
      style={{
        position: "relative",
        width: W,
        height: H,
        margin: "0 auto",
        borderRadius: 32,
        border: "7px solid #000000",
        background: "#000",
        boxShadow:
          "0 24px 48px rgba(0,0,0,0.55), 0 2px 0 rgba(255,255,255,0.04) inset",
        overflow: "hidden",
      }}
    >
      {/* notch */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 5,
          left: "50%",
          transform: "translateX(-50%)",
          width: 72,
          height: 20,
          borderRadius: 16,
          background: "#000",
          zIndex: 3,
          boxShadow: "0 2px 4px rgba(0,0,0,0.4) inset",
        }}
      />
      {/* The real cover · the iframe renders at 390×844 (mobile native)
          and we scale down to fit the silhouette. Inside the iframe,
          viewport < 768px so the sealed PhoneFrame collapses to full
          viewport, giving a clean edge-to-edge cover render. Pointer
          events are off so the whole phone silhouette acts as one tap
          target (the Link wrapping it handles navigation). */}
      <iframe
        src={src}
        title={`${slide.themeName} · ${slide.layoutLabel}`}
        loading="eager"
        tabIndex={-1}
        aria-hidden
        onLoad={() => setLoaded(true)}
        style={{
          position: "absolute",
          inset: 0,
          width: NATIVE_W,
          height: NATIVE_H,
          border: 0,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          pointerEvents: "none",
          background: "#050810",
          opacity: loaded ? 1 : 0,
          transition: "opacity 180ms ease-out",
        }}
      />
      {/* Theme-aware skeleton overlay · visible until iframe fires load.
          Prevents the visitor from ever seeing a half-painted theme.
          Uses the theme's own hero wallpaper (blurred) as the backdrop
          so even the loading state is a legitimate preview of the real
          cover · no generic grey placeholder, ever. */}
      {!loaded && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
          }}
        >
          {slide.themeWallpaperUrl && (
            <div
              style={{
                position: "absolute",
                inset: -20,
                background: `url(${slide.themeWallpaperUrl}) center/cover no-repeat`,
                filter: "blur(18px) saturate(1.1)",
                opacity: 0.9,
              }}
            />
          )}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(170deg, ${slide.themeAccent}44, ${slide.themeAccent}22 50%, #050810 100%)`,
              display: "grid",
              placeItems: "center",
              animation: "nex-slide-skeleton 1.6s ease-in-out infinite",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: `${slide.themeAccent}55`,
                boxShadow: `0 0 32px ${slide.themeAccent}88`,
              }}
            />
          </div>
        </div>
      )}
      {/* Home indicator over the iframe content */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          bottom: 5,
          left: "50%",
          transform: "translateX(-50%)",
          width: 76,
          height: 3,
          borderRadius: 999,
          background: "rgba(255,255,255,0.55)",
          zIndex: 3,
        }}
      />
    </div>
  );
}

function MiniPhoneFrame({ slide }: { slide: ThemeCoverSlide }) {
  // Dimensions match LiveMiniPhoneFrame so hot/cold slides are
  // visually interchangeable as the active-slide window moves.
  const W = 220;
  const H = 460;
  const accent = slide.themeAccent;
  const composerRim = slide.themeComposerRim;
  const hasRealWallpaper = Boolean(slide.themeWallpaperUrl);

  return (
    <div
      style={{
        position: "relative",
        width: W,
        height: H,
        margin: "0 auto",
        borderRadius: 32,
        border: "7px solid #000000",
        background: "#000",
        boxShadow:
          "0 24px 48px rgba(0,0,0,0.55), 0 2px 0 rgba(255,255,255,0.04) inset",
        overflow: "hidden",
      }}
    >
      {/* notch */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 5,
          left: "50%",
          transform: "translateX(-50%)",
          width: 72,
          height: 20,
          borderRadius: 16,
          background: "#000",
          zIndex: 3,
          boxShadow: "0 2px 4px rgba(0,0,0,0.4) inset",
        }}
      />

      {/* Themed screen · uses the REAL theme hero wallpaper from
          nex_chat_theme.hero_image_url when present (e.g. Joker alley,
          Pink Dream sunset bedroom, Night Sky Milky Way). Falls back to
          an accent-tinted gradient when the theme row has no wallpaper
          so slides still read as themed. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: hasRealWallpaper
            ? `url(${slide.themeWallpaperUrl}) center/cover no-repeat, #050810`
            : `
                radial-gradient(140% 60% at 20% -10%, ${accent}55, transparent 60%),
                radial-gradient(140% 60% at 100% 110%, ${accent}33, transparent 60%),
                linear-gradient(180deg, #0A0E1A 0%, #050810 100%)
              `,
        }}
      >
        {/* Dim scrim so chrome text stays legible over bright
            wallpapers (particularly needed for Pink Dream's sunset
            bedroom which hits very bright peach at the top). */}
        {hasRealWallpaper && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.55) 100%)",
            }}
          />
        )}
        {/* Subtle grain overlay (SVG noise) for photographic depth */}
        <svg
          aria-hidden
          width="100%"
          height="100%"
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.14,
            mixBlendMode: "overlay",
            pointerEvents: "none",
          }}
        >
          <filter id={`noise-${slide.themeId}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter={`url(#noise-${slide.themeId})`} />
        </svg>

        {/* Mock cover UI */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: "26px 14px 18px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* theme chip top-left · echoes the chat-theme ownership doctrine */}
          <div
            style={{
              alignSelf: "flex-start",
              padding: "3px 9px",
              borderRadius: 999,
              background: "rgba(0,0,0,0.55)",
              fontSize: 8,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: accent,
              border: `1px solid ${accent}66`,
            }}
          >
            NEX · {slide.themeName}
          </div>

          {/* Identity row */}
          <div
            style={{
              marginTop: 18,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: "50%",
                background: `conic-gradient(from 180deg, ${accent}, rgba(255,255,255,0.25), ${accent})`,
                padding: 2,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${accent}aa, #0A0E1A)`,
                }}
              />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#fff",
                  letterSpacing: "0.01em",
                  textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                }}
              >
                Your NEX
              </div>
              <div
                style={{
                  fontSize: 8.5,
                  color: "rgba(255,255,255,0.75)",
                  marginTop: 1,
                  letterSpacing: "0.02em",
                }}
              >
                @yourname
              </div>
            </div>
          </div>

          {/* Product grid mock · 2×2 */}
          <div
            style={{
              marginTop: 14,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 7,
              flex: 1,
              alignContent: "start",
            }}
          >
            {[0, 1, 2, 3].map((n) => (
              <div
                key={n}
                style={{
                  aspectRatio: "1",
                  borderRadius: 9,
                  background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${accent}33`,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: `linear-gradient(135deg, ${accent}22 0%, transparent 60%)`,
                  }}
                />
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: 5,
                    bottom: 5,
                    right: 5,
                    height: 3,
                    borderRadius: 2,
                    background: "rgba(255,255,255,0.3)",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Composer footer · echoes "chat IS the shop" doctrine ·
              uses the theme's REAL composer_rim_hex (muted dark-forest
              for Joker, matching the message surface). The signature
              accent lives on the send-cursor glyph on the right. */}
          <div
            style={{
              marginTop: 10,
              padding: "7px 11px",
              borderRadius: 22,
              background: "rgba(0,0,0,0.6)",
              border: `1px solid ${composerRim}`,
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 8.5,
              color: "rgba(255,255,255,0.78)",
              letterSpacing: "0.01em",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: `${accent}44`,
                border: `1px solid ${accent}`,
              }}
            />
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Message {slide.themeName}…
            </span>
            <span
              aria-hidden
              style={{
                color: NEX.orange,
                fontWeight: 700,
                fontSize: 10,
              }}
            >
              →
            </span>
          </div>
        </div>
      </div>

      {/* Home indicator */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          bottom: 5,
          left: "50%",
          transform: "translateX(-50%)",
          width: 76,
          height: 3,
          borderRadius: 999,
          background: "rgba(255,255,255,0.55)",
          zIndex: 3,
        }}
      />
    </div>
  );
}

function SlideCaption({ slide }: { slide: ThemeCoverSlide }) {
  return (
    <div style={{ marginTop: 14, textAlign: "center", maxWidth: 240 }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "3px 10px",
          borderRadius: 999,
          border: `1px solid ${slide.themeAccent}66`,
          background: `${slide.themeAccent}14`,
          fontSize: 9,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontWeight: 700,
          color: slide.themeAccent,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: slide.themeAccent,
            boxShadow: `0 0 8px ${slide.themeAccent}`,
          }}
        />
        {slide.themeName}
        {slide.isCurrent && (
          <span
            style={{
              marginLeft: 2,
              fontSize: 8,
              fontWeight: 800,
              color: NEX.textPrimary,
              letterSpacing: "0.1em",
            }}
          >
            · YOURS
          </span>
        )}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 15,
          fontWeight: 600,
          color: NEX.textPrimary,
          letterSpacing: "0.005em",
          lineHeight: 1.25,
        }}
      >
        {slide.layoutLabel}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 12,
          color: NEX.textSecondary,
          lineHeight: 1.5,
          padding: "0 6px",
        }}
      >
        {slide.layoutBlurb}
      </div>
      <div
        style={{
          marginTop: 12,
          display: "inline-flex",
          padding: "6px 14px",
          background: NEX.orange,
          borderRadius: 999,
          color: "#0B0F1A",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        Open design →
      </div>
    </div>
  );
}

function SwipeHint() {
  return (
    <>
      <style>{`
        @keyframes nex-swipe-nudge {
          0%, 100% { opacity: 0; transform: translateY(-50%) translateX(0); }
          15%      { opacity: 0.85; }
          40%      { opacity: 0.85; transform: translateY(-50%) translateX(-14px); }
          65%      { opacity: 0.85; transform: translateY(-50%) translateX(0); }
          100%     { opacity: 0; }
        }
        [data-nex-swipe-hint] {
          animation: nex-swipe-nudge 2800ms ease-out 500ms 1 forwards;
          pointer-events: none;
        }
      `}</style>
      <div
        data-nex-swipe-hint
        aria-hidden
        style={{
          position: "absolute",
          right: 14,
          top: "32%",
          opacity: 0,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          borderRadius: 999,
          background: "rgba(2, 9, 20, 0.78)",
          border: `1px solid ${NEX.cyanSoft}`,
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          fontWeight: 700,
          color: NEX.cyan,
          backdropFilter: "blur(6px)",
          zIndex: 10,
        }}
      >
        Swipe
        <span style={{ color: NEX.orange }}>→</span>
      </div>
    </>
  );
}

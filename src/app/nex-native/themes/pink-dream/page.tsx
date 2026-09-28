// src/app/nex-native/themes/pink-dream/page.tsx
//
// Bridge 24 · Pink Dream chat theme · admin preview.
// ---------------------------------------------------
// Static, isolated preview of the "Pink Dream" theme built strictly
// to the Founder-supplied master prompt (2026-09-28). Nothing on this
// page is wired to a live conversation · it exists so the Founder can
// share a URL, judge the design, and approve. Once approved the
// palette is already registered in nex_chat_theme (migration 081)
// and available in /nex-native/settings/theme.
//
// Reference image: /nex-themes/pink-dream-reference.png
// Wallpaper       : /nex-themes/pink-dream.png
//
// Design authority: the reference image is the pixel-level visual
// source of truth. Do not reinterpret into a generic pink chat.

import type * as React from "react";
import Link from "next/link";
import { PinkDreamHud } from "./_hud";
import { PinkDreamComposer } from "./_composer";

export const dynamic = "force-static";
export const runtime = "nodejs";
export const metadata = { title: "NEX · Pink Dream theme preview" };

// -- Palette -----------------------------------------------------
const P = {
  primaryDark: "#17121F",
  secondaryDark: "#24162D",
  deepPurple: "#321B3D",
  primaryPink: "#FF4FA3",
  hotPink: "#FF3F9F",
  lightPink: "#FF8BC5",
  softBabyPink: "#FFC1DF",
  neonPinkGlow: "rgba(255, 79, 163, 0.45)",
  white: "#FFFFFF",
  softWhite: "#FFF5FA",
  mutedText: "#D8C6D3",
  onlineGreen: "#7BE495",
};

const SANS =
  "'Manrope', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

interface Msg {
  side: "in" | "out";
  body: string;
  time: string;
  read?: boolean;
}
const CONVO: Msg[] = [
  { side: "in", body: "Hey! 💕\nHow are you today?", time: "10:24" },
  {
    side: "out",
    body: "I'm good! 😊\nJust relaxing at home.\nHow about you?",
    time: "10:25",
    read: true,
  },
  {
    side: "in",
    body: "Aww that sounds perfect! 💖\nWish I was there with you.",
    time: "10:26",
  },
  {
    side: "out",
    body: "Hehe... maybe soon 😉\nWhat are you up to now?",
    time: "10:27",
    read: true,
  },
  {
    side: "in",
    body: "Just watching the sunset\nand thinking about you... 💕",
    time: "10:28",
  },
  {
    side: "out",
    body: "Aww that's so sweet 🥰\nYou're the best!",
    time: "10:29",
    read: true,
  },
  { side: "in", body: "Always for you 💕\nTalk later, okay?", time: "10:30" },
];

export default function PinkDreamPreviewPage() {
  return (
    <div
      data-nex-pink-dream-preview
      style={{
        // Bridge 24c · pin to the viewport as a flex column so no
        // ancestor layout padding can squeeze the wallpaper or the
        // composer. Header + main + footer are direct flex children:
        // header top, main flexes and scrolls internally, footer
        // stays glued to the bottom edge · every element uses 100%
        // of the phone's width.
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        color: P.white,
        fontFamily: SANS,
        overflow: "hidden",
        // Bridge 24k · wallpaper moved onto a dedicated animated
        // layer below (data-nex-pd-wallpaper) so we can Ken-Burns
        // the image without also transforming the chat surface.
        backgroundColor: "#2b1638",
      }}
    >
      {/* Bridge 24k-2 · static wallpaper · Ken Burns dropped in
         favour of local sky effects (sun glow + city twinkles)
         layered on top of a still image. */}
      <div
        aria-hidden
        data-nex-pd-wallpaper
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          backgroundImage: "url(/nex-themes/pink-dream.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      {/* Bridge 24u · city twinkles retired to reduce ambient
         motion · portrait ping + dancing dots + sun glow already
         cover the "alive" quota. Sun glow stays. */}
      <div aria-hidden data-nex-pd-sun />
      {/* Fonts + speech-tail shapes · scoped inline so this page is
         fully self-contained and doesn't leak into other themes. */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700;800&family=Caveat:wght@400;500;600;700&display=swap');
        /* Bridge 24q · neon flicker keyframe · used by both incoming
           and outgoing rows in Neon Signs mode. Steady 96% of the
           time with a tiny 4% dip so the glow feels alive without
           strobing. */
        @keyframes nex-pd-neon {
          0%, 96%, 100% { opacity: 1; }
          97%, 99%      { opacity: 0.55; }
        }
        [data-nex-pink-dream-preview] * { box-sizing: border-box; }
        /* Bridge 24b · html/body might carry padding from a parent
           layout wrapper (nex-native-root) · this preview is
           deliberately full-bleed, so we scope a reset. */
        html:has([data-nex-pink-dream-preview]),
        body:has([data-nex-pink-dream-preview]) {
          margin: 0; padding: 0; background: #17121F;
        }
        /* Bridge 24h · presence ping · the header portrait rim
           breathes with a pink halo when the peer is online. Two
           expanding rings staggered 900ms apart keep the pulse alive
           without feeling frantic. */
        @keyframes nex-pink-ping {
          0%   { transform: scale(1);   opacity: 0.55; }
          80%  { transform: scale(1.55); opacity: 0; }
          100% { transform: scale(1.55); opacity: 0; }
        }
        [data-nex-pink-dream-preview] [data-portrait-ping] {
          position: absolute;
          inset: -3px;
          border-radius: 50%;
          border: 2px solid rgba(255, 79, 163, 0.75);
          animation: nex-pink-ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
          pointer-events: none;
        }
        [data-nex-pink-dream-preview] [data-portrait-ping-2] {
          animation-delay: 0.9s;
        }
        /* Bridge 24k-2 · Ken Burns dropped per Founder direction
           2026-09-28 · replaced with LOCAL sky effects only:
           a soft sunset glow that breathes over the window area,
           and 5 tiny city lights that twinkle along the skyline.
           The bedroom foreground (bear, pillows) stays perfectly
           still · only the "sky outside the window" feels alive. */

        /* Sun glow · a radial pink/orange bloom positioned where
           the setting sun sits in the wallpaper. Opacity breathes
           between 0.35 and 0.75 over 7s so it feels like the sun
           is pulsing warm light through the window. */
        @keyframes nex-pd-sun {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50%      { opacity: 0.75; transform: scale(1.10); }
        }
        [data-nex-pink-dream-preview] [data-nex-pd-sun] {
          position: absolute;
          left: 42%;
          top: 22%;
          width: 44%;
          height: 22%;
          z-index: 1;
          pointer-events: none;
          background: radial-gradient(
            ellipse at center,
            rgba(255, 195, 130, 0.85) 0%,
            rgba(255, 138, 90, 0.45) 30%,
            rgba(255, 79, 163, 0.20) 60%,
            transparent 80%
          );
          filter: blur(20px);
          mix-blend-mode: screen;
          animation: nex-pd-sun 7s ease-in-out infinite;
          transform-origin: center;
        }

        @media (prefers-reduced-motion: reduce) {
          [data-nex-pink-dream-preview] [data-nex-pd-sun] {
            animation: none;
            opacity: 0.5;
          }
          [data-nex-pink-dream-preview] [data-portrait-ping] {
            animation: none;
            opacity: 0.35;
          }
        }
        /* Bridge 24i · top-fade mask on the message scroll · bubbles
           dissolve into the header instead of cutting hard against
           it. First ~72px of the scroll region fades to transparent
           so nothing pops behind the portrait + name row. */
        [data-nex-pink-dream-preview] [data-nex-pd-scroll] {
          scrollbar-width: none;
          mask-image: linear-gradient(
            180deg,
            transparent 0px,
            rgba(0,0,0,0.20) 12px,
            rgba(0,0,0,0.65) 28px,
            #000 40px,
            #000 100%
          );
          -webkit-mask-image: linear-gradient(
            180deg,
            transparent 0px,
            rgba(0,0,0,0.20) 12px,
            rgba(0,0,0,0.65) 28px,
            #000 40px,
            #000 100%
          );
        }
        [data-nex-pink-dream-preview] [data-nex-pd-scroll]::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
        /* Small soft speech corner rendered with a rotated square +
           overflow-hidden trick would need extra markup. Simpler:
           use CSS masks on a small trailing wedge coloured to match
           the bubble. See .tail-in / .tail-out below. */
        .tail-in {
          position: absolute;
          left: -6px;
          bottom: 10px;
          width: 14px;
          height: 14px;
          background: linear-gradient(135deg, #2A1833, #17121F);
          border-left: 1px solid rgba(255,139,197,0.55);
          border-bottom: 1px solid rgba(255,139,197,0.55);
          transform: rotate(45deg);
          border-bottom-left-radius: 4px;
        }
        .tail-out {
          position: absolute;
          right: -6px;
          bottom: 10px;
          width: 14px;
          height: 14px;
          background: linear-gradient(135deg, #FF77BC, #FF3F9F);
          border-right: 1px solid rgba(255,205,230,0.65);
          border-top: 1px solid rgba(255,205,230,0.65);
          transform: rotate(45deg);
          border-top-right-radius: 4px;
        }
      `}</style>

      {/* Very light overlay for readability · keeps the sunset visible */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          background:
            "linear-gradient(180deg, rgba(12,7,18,0.08) 0%, rgba(12,7,18,0.16) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ---------------- Header ----------------
         Bridge 24b · shade + blur + border-bottom removed per
         Founder direction 2026-09-28. Header now floats directly
         over the wallpaper · icons + name are white for legibility
         against the sunset. */}
      <header
        style={{
          position: "relative",
          zIndex: 5,
          padding:
            "calc(env(safe-area-inset-top, 0) + 6px) 14px 6px",
          background: "transparent",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        {/* Bridge 24h · portrait wrapped in relative box so the
           two ping rings pulse from the same origin as the rim.
           Presence is signalled by the pink halo · no more "online"
           text row per Founder direction 2026-09-28. */}
        <div
          style={{
            position: "relative",
            width: 52,
            height: 52,
            flexShrink: 0,
          }}
        >
          <span aria-hidden data-portrait-ping />
          <span aria-hidden data-portrait-ping data-portrait-ping-2 />
          <div
            aria-hidden
            style={{
              position: "relative",
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "url(/nex-themes/pink-dream.png) center/cover",
              border: "2px solid rgba(255,255,255,0.85)",
              boxShadow: "0 0 12px rgba(255,79,163,0.65)",
            }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "-0.005em",
              color: P.softWhite,
            }}
          >
            Bunny <span aria-hidden>♡</span>
          </div>
        </div>
        {/* Bridge 24m · standard header icons on every theme ·
           settings · cart (with pink badge count) · shop (only
           when the owner has a shop, mocked here as true). */}
        <HeaderIconLink href="/nex-native/settings" ariaLabel="Settings">
          <SettingsIcon />
        </HeaderIconLink>
        <HeaderIconLink href="/nex-native/cart" ariaLabel="Cart" badge={3}>
          <CartIcon />
        </HeaderIconLink>
        <HeaderIconLink href="/nex-native/manage/shop" ariaLabel="My shop">
          <ShopIcon />
        </HeaderIconLink>
      </header>

      {/* ---------------- Conversation ----------------
         Bridge 24g · right padding reserved for the floating rail
         (Home + Contacts sit at right:6 · 34px wide + a little air).
         Bubbles now wrap cleanly instead of tucking under the
         rail. */}
      <main
        data-nex-pd-scroll
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          minHeight: 0,
          width: "100%",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          padding: "4px 52px 14px 34px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {/* Bridge 24v · timeline spine retired per Founder direction
           2026-09-28 · ticks alone read as speaker markers without
           the connecting line. Cleaner, more editorial. */}
        {CONVO.map((m, i) => {
          const prev = CONVO[i - 1];
          const speakerChanged = !prev || prev.side !== m.side;
          const gapTop = speakerChanged ? 6 : 0;
          if (m.side === "in") {
            return (
              <IncomingRow
                key={i}
                body={m.body}
                time={m.time}
                extraTop={gapTop}
                isFirstOfCluster={speakerChanged}
              />
            );
          }
          return (
            <OutgoingRow
              key={i}
              body={m.body}
              time={m.time}
              read={!!m.read}
              extraTop={gapTop}
            />
          );
        })}
      </main>

      {/* Bridge 24n · client composer · left "+" opens Shop &
         Marketing panel · centre smile opens Emoji + Mascot picker
         · input naked with pink underline · send button shrunk
         per Founder direction 2026-09-28. */}
      <PinkDreamComposer />

      {/* Bridge 24f · floating rail + 3-dot action sheet */}
      <PinkDreamHud />

    </div>
  );
}

// -- Rows · Timeline Ribbon treatment · Bridge 24q -------------
// Vertical pink→peach spine down the left of the message column ·
// each message has a coloured tick + eyebrow (speaker + time) + raw
// text. No bubble containers. Peer chat reads like a shared journal
// timeline.

// Spine sits at main-left:20, main-padding-left is 34, so a row
// starting at main's content edge (34) needs its tick at -14 to
// centre on the spine · tick width 10 → left: -19 puts the centre
// of the tick on the spine line.
const TICK_LEFT = -19;

function IncomingRow({
  body,
  time,
  extraTop,
  isFirstOfCluster,
}: {
  body: string;
  time: string;
  extraTop: number;
  isFirstOfCluster: boolean;
}) {
  const color = "#FF4FA3"; // Bunny · hot pink · theme owner
  const glow = "rgba(255, 79, 163, 0.55)";
  return (
    <TimelineRow
      color={color}
      glow={glow}
      speaker="Bunny ♡"
      body={body}
      time={time}
      extraTop={extraTop}
      isFirstOfCluster={isFirstOfCluster}
      panelFill="rgba(180, 32, 96, 0.82)"
      panelBorder="rgba(255, 139, 197, 0.70)"
    />
  );
}

function TimelineRow({
  color,
  glow,
  speaker,
  body,
  time,
  extraTop,
  isFirstOfCluster,
  panelFill,
  panelBorder,
  textColor = "#FFF5FA",
  eyebrowColor,
}: {
  color: string;
  glow: string;
  speaker: string;
  body: string;
  time: string;
  extraTop: number;
  isFirstOfCluster: boolean;
  panelFill: string;
  panelBorder: string;
  textColor?: string;
  eyebrowColor?: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        paddingLeft: 26,
        marginTop: extraTop + (isFirstOfCluster ? 6 : 0),
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: TICK_LEFT,
          top: 4,
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 10px ${glow}, inset -1px -1px 2px rgba(0,0,0,0.35)`,
          border: "1.5px solid rgba(255,255,255,0.85)",
        }}
      />
      {/* Bridge 24s · speaker + time now lives INSIDE the frosted
         panel at the top per Founder direction 2026-09-28. Panel
         hue changes per speaker · pink-frosted for the theme owner
         (Bunny), white-frosted for the messaging sender (You). */}
      <div
        style={{
          display: "inline-block",
          maxWidth: "100%",
          padding: "8px 12px",
          borderRadius: 12,
          background: panelFill,
          border: `1px solid ${panelBorder}`,
          backdropFilter: "blur(12px) saturate(140%)",
          WebkitBackdropFilter: "blur(12px) saturate(140%)",
          boxShadow:
            "0 4px 14px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.10)",
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.22em",
            color: eyebrowColor ?? color,
            fontWeight: 700,
            textTransform: "uppercase",
            marginBottom: 4,
            textShadow: eyebrowColor ? "none" : `0 0 8px ${glow}`,
          }}
        >
          {speaker} · {time}
        </div>
        <div
          style={{
            fontSize: 15,
            lineHeight: 1.5,
            color: textColor,
            whiteSpace: "pre-wrap",
            letterSpacing: "-0.003em",
          }}
        >
          {body}
        </div>
      </div>
    </div>
  );
}

function OutgoingRow({
  body,
  time,
  read,
  extraTop,
}: {
  body: string;
  time: string;
  read: boolean;
  extraTop: number;
}) {
  return (
    <TimelineRow
      color="#FFC97C"
      glow="rgba(255, 201, 124, 0.55)"
      speaker={`You${read ? " · ✓✓" : ""}`}
      body={body}
      time={time}
      extraTop={extraTop}
      isFirstOfCluster={true}
      panelFill="rgba(255, 255, 255, 0.72)"
      panelBorder="rgba(255, 201, 124, 0.75)"
      textColor="#1A0F22"
      eyebrowColor="#8B5A00"
    />
  );
}

// -- Header icon (Link + optional pink badge) -------------------
function HeaderIconLink({
  href,
  ariaLabel,
  badge,
  children,
}: {
  href: string;
  ariaLabel: string;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={badge ? `${ariaLabel} · ${badge} unread` : ariaLabel}
      title={ariaLabel}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 38,
        height: 38,
        borderRadius: "50%",
        background: "transparent",
        color: "#FFD4E8",
        textDecoration: "none",
        flexShrink: 0,
      }}
    >
      {children}
      {typeof badge === "number" && badge > 0 && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: -2,
            right: -2,
            minWidth: 16,
            height: 16,
            padding: "0 4px",
            borderRadius: 999,
            background: "linear-gradient(180deg, #FF77BC, #FF3F9F)",
            color: "#0B0F1A",
            fontSize: 9,
            fontWeight: 800,
            lineHeight: 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 3px 8px rgba(255,63,159,0.55)",
            border: "1.5px solid rgba(23,18,31,0.85)",
            fontFamily: SANS,
          }}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

// -- Icons · thin rounded strokes -------------------------------
function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06A2 2 0 017.04 4.4l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function CartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="21" r="1.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="18" cy="21" r="1.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M3 3h2l2.7 12.3a2 2 0 0 0 2 1.7h7.6a2 2 0 0 0 2-1.6L21 8H6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function ShopIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 8l1.5-4h15L21 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 8h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9 8V5m6 3V5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}


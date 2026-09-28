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
import { PinkDreamHud } from "./_hud";

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
      {/* Bridge 24k · animated wallpaper · slow Ken Burns pan+zoom
         over 40s, seamless loop. Sits below every other layer via
         zIndex 0. Uses transform on a full-bleed div so we don't
         touch the composer / header positioning. */}
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
          willChange: "transform",
        }}
      />
      {/* Fonts + speech-tail shapes · scoped inline so this page is
         fully self-contained and doesn't leak into other themes. */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700;800&display=swap');
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
        /* Bridge 24k · Ken Burns wallpaper · slow pan + zoom that
           loops on 80s (goes 0→100 then symmetrically 100→0 via
           alternate) so the return trip mirrors the outbound and
           the frame never "snaps". Total drift ≈ 3% both axes,
           scale peaks at 1.08 · below the perceptual jitter
           threshold on a phone but adds real life to the sunset. */
        @keyframes nex-pd-kenburns {
          0%   { transform: scale(1.00) translate(0%, 0%); }
          50%  { transform: scale(1.08) translate(-1.5%, 1.5%); }
          100% { transform: scale(1.00) translate(0%, 0%); }
        }
        [data-nex-pink-dream-preview] [data-nex-pd-wallpaper] {
          animation: nex-pd-kenburns 80s ease-in-out infinite;
          transform-origin: 55% 45%; /* pull toward the sun on the horizon */
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-pink-dream-preview] [data-nex-pd-wallpaper] {
            animation: none;
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
        {/* Bridge 24h · phone + video icons removed · Call / Video
           / Mic / Camera / Themes all live in the 3-dot action
           sheet at the lower right. */}
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
          padding: "4px 52px 14px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
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

      {/* ---------------- Composer + Send ----------------
         Bridge 24c · normal flow inside the flex column so the
         composer always fills the phone width minus the 12px inset
         and never suffers from position:fixed containing-block
         quirks. */}
      {/* ---------------- Composer + Send ----------------
         Bridge 24f · pill container removed per Founder direction
         2026-09-28 · the input sits naked on the wallpaper with a
         single subtle underline; attach + camera moved to the
         lower-right 3-dot menu (Camera / Video / Mic / Themes).
         Send stays as a separate circular pink button.  */}
      <footer
        style={{
          position: "relative",
          padding: "12px 14px calc(env(safe-area-inset-bottom, 0) + 12px)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          boxSizing: "border-box",
          zIndex: 6,
        }}
      >
        <div
          style={{
            flex: "1 1 0%",
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: 6,
            paddingRight: 8,
          }}
        >
          <SmileIcon />
          <input
            type="text"
            placeholder="Message…"
            aria-label="Message"
            style={{
              flex: "1 1 0%",
              minWidth: 0,
              width: "100%",
              padding: "10px 6px",
              background: "transparent",
              border: "none",
              borderBottom: "1px solid rgba(255,139,197,0.35)",
              color: P.softWhite,
              fontSize: 16,
              fontFamily: SANS,
              outline: "none",
            }}
          />
        </div>
        <button
          type="button"
          aria-label="Send"
          style={{
            flex: "0 0 auto",
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #FF8AC5, #FF3F9F)",
            border: "1px solid rgba(255,205,230,0.75)",
            boxShadow: "0 0 20px rgba(255,79,163,0.45)",
            color: P.softWhite,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <SendIcon />
        </button>
      </footer>

      {/* Bridge 24f · floating rail + 3-dot action sheet */}
      <PinkDreamHud />

      {/* Admin footer chip · out of view on mobile keyboard but useful
         when the Founder is checking the preview on desktop. */}
      <div
        style={{
          position: "fixed",
          top: "calc(env(safe-area-inset-top, 0) + 10px)",
          right: 14,
          zIndex: 10,
          padding: "4px 10px",
          borderRadius: 999,
          background: "rgba(0,0,0,0.55)",
          border: "1px solid rgba(255,139,197,0.35)",
          color: P.softWhite,
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontWeight: 700,
          pointerEvents: "none",
        }}
      >
        Preview
      </div>
    </div>
  );
}

// -- Rows --------------------------------------------------------
function IncomingRow({
  body,
  time,
  extraTop,
}: {
  body: string;
  time: string;
  extraTop: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 7,
        marginTop: extraTop,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "url(/nex-themes/pink-dream.png) center/cover",
          border: "1.5px solid rgba(255,255,255,0.75)",
          boxShadow: "0 0 6px rgba(255,79,163,0.45)",
          flexShrink: 0,
        }}
        aria-hidden
      />
      <div
        style={{
          position: "relative",
          maxWidth: "72%",
          padding: "8px 12px 6px",
          borderRadius: 18,
          background: "linear-gradient(135deg, #2A1833, #17121F)",
          border: "1px solid rgba(255,139,197,0.55)",
          boxShadow: "0 3px 12px rgba(0,0,0,0.24)",
          color: P.softWhite,
          fontSize: 14,
          fontWeight: 400,
          lineHeight: 1.32,
          whiteSpace: "pre-wrap",
          letterSpacing: "-0.005em",
        }}
      >
        {body}
        <div
          style={{
            marginTop: 2,
            fontSize: 9,
            opacity: 0.68,
            textAlign: "right",
            color: P.mutedText,
            letterSpacing: "0.02em",
          }}
        >
          {time}
        </div>
        <span aria-hidden className="tail-in" />
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
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        marginTop: extraTop,
      }}
    >
      <div
        style={{
          position: "relative",
          maxWidth: "72%",
          padding: "8px 12px 6px",
          borderRadius: 18,
          background: "linear-gradient(135deg, #FF77BC, #FF3F9F)",
          border: "1px solid rgba(255,205,230,0.65)",
          boxShadow: "0 4px 16px rgba(255,63,159,0.24)",
          color: P.white,
          fontSize: 14,
          fontWeight: 400,
          lineHeight: 1.32,
          whiteSpace: "pre-wrap",
          letterSpacing: "-0.005em",
        }}
      >
        {body}
        <div
          style={{
            marginTop: 2,
            fontSize: 9,
            opacity: 0.85,
            textAlign: "right",
            color: P.softWhite,
            display: "inline-flex",
            gap: 3,
            alignItems: "center",
            justifyContent: "flex-end",
            width: "100%",
            letterSpacing: "0.02em",
          }}
        >
          <span>{time}</span>
          {read && (
            <span aria-label="Read" style={{ color: P.softWhite }}>
              ✓✓
            </span>
          )}
        </div>
        <span aria-hidden className="tail-out" />
      </div>
    </div>
  );
}

// -- Icons · thin rounded strokes -------------------------------
function SmileIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8.5 14c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="9" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12l16-8-6 16-2.5-6.5L4 12z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

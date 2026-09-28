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
import { PinkDreamComposer } from "./_composer";
import { PinkDreamPeerHeader } from "./_peer-menu";

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
            <PinkHeart size={22} />
            <span style={{ marginLeft: 8 }}>Bunny</span>
          </div>
        </div>
        {/* Bridge 24ab · header is now peer-scoped ONLY per messenger
           convention · Call · Video · ⋮ (mute/wallpaper/info/block/
           report). App-level surfaces (settings · cart · shop) moved
           to the bottom tab bar. */}
        <PinkDreamPeerHeader />
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
          // Bridge 24ad · zero left/right padding so slates can
          // fuse to both window edges (you-right · them-left).
          padding: "4px 0 14px 0",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {/* Bridge 24w · timeline ticks retired · panels themselves
           attach to the left window edge and read as message
           slates running up the side of the phone. */}
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

    </div>
  );
}

// -- Rows · Timeline Ribbon treatment · Bridge 24q -------------
// Vertical pink→peach spine down the left of the message column ·
// each message has a coloured tick + eyebrow (speaker + time) + raw
// text. No bubble containers. Peer chat reads like a shared journal
// timeline.

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
  // Bridge 24z · quiet-luxury variant · same white-frosted glass
  // for both speakers · identity carried only by the 3px left rail
  // and the eyebrow tint. Feels more Vision Pro / Airbnb than the
  // colour-coded version.
  return (
    <TimelineRow
      color="#FF4FA3" // hot pink rail = Bunny (theme owner)
      glow="rgba(255, 79, 163, 0.55)"
      speaker={
        <>
          <PinkHeart size={13} />
          <span style={{ marginLeft: 5 }}>Bunny</span>
        </>
      }
      body={body}
      time={time}
      extraTop={extraTop}
      isFirstOfCluster={isFirstOfCluster}
      panelFill="rgba(255, 255, 255, 0.72)"
      panelBorder="rgba(255, 79, 163, 0.55)"
      textColor="#1A0F22"
      eyebrowColor="#8B2560"
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
  side = "left",
}: {
  color: string;
  glow: string;
  speaker: React.ReactNode;
  body: string;
  time: string;
  extraTop: number;
  isFirstOfCluster: boolean;
  panelFill: string;
  panelBorder: string;
  textColor?: string;
  eyebrowColor?: string;
  side?: "left" | "right";
}) {
  const isRight = side === "right";
  return (
    <div
      style={{
        marginTop: extraTop + (isFirstOfCluster ? 6 : 0),
        maxWidth: "calc(78% + 30px)",
        // Bridge 24ad · outgoing rows push to the right edge so the
        // slate attaches to the RIGHT window frame · convention:
        // your messages right, theirs left.
        marginLeft: isRight ? "auto" : undefined,
        display: isRight ? "flex" : undefined,
        justifyContent: isRight ? "flex-end" : undefined,
      }}
    >
      <div
        style={{
          display: "inline-block",
          maxWidth: "100%",
          padding: "8px 14px 8px 14px",
          // Left-attached · right-corners rounded, left rail hue.
          // Right-attached · left-corners rounded, right rail hue.
          borderRadius: isRight ? "18px 0 0 18px" : "0 18px 18px 0",
          background: panelFill,
          borderTop: `1px solid ${panelBorder}`,
          borderBottom: `1px solid ${panelBorder}`,
          borderLeft: isRight
            ? `1px solid ${panelBorder}`
            : `3px solid ${color}`,
          borderRight: isRight
            ? `3px solid ${color}`
            : `1px solid ${panelBorder}`,
          backdropFilter: "blur(12px) saturate(140%)",
          WebkitBackdropFilter: "blur(12px) saturate(140%)",
          // Shadow casts inward toward the middle of the screen for
          // both sides so slates always feel raised off the wall.
          boxShadow: isRight
            ? "-6px 4px 14px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.10)"
            : "6px 4px 14px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.10)",
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
            textAlign: isRight ? "right" : "left",
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
            textAlign: isRight ? "right" : "left",
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
      side="right"
    />
  );
}

/* Bridge 24ae · custom pink heart · SVG with hot-pink → light-pink
   gradient fill + white shine highlight + soft neon glow. Sits
   inline with a name (baseline-adjusted via vertical-align). */
function PinkHeart({ size = 16 }: { size?: number }) {
  const gid = `pink-heart-${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      style={{
        display: "inline-block",
        verticalAlign: "-0.18em",
        filter: "drop-shadow(0 0 4px rgba(255,79,163,0.75))",
        flexShrink: 0,
      }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFB6DA" />
          <stop offset="55%" stopColor="#FF4FA3" />
          <stop offset="100%" stopColor="#C61E70" />
        </linearGradient>
      </defs>
      <path
        d="M12 20.5S3.5 14.8 3.5 9.2C3.5 6.3 5.8 4 8.6 4c1.9 0 3.1 1.1 3.4 2 .3-.9 1.5-2 3.4-2 2.8 0 5.1 2.3 5.1 5.2 0 5.6-8.5 11.3-8.5 11.3z"
        fill={`url(#${gid})`}
        stroke="rgba(255,180,210,0.7)"
        strokeWidth="0.6"
      />
      {/* shine highlight */}
      <path
        d="M7.6 7.4c.9-1.2 2.4-1.3 3.1-.4"
        stroke="rgba(255,255,255,0.85)"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="9.6" cy="9.4" r="0.9" fill="rgba(255,255,255,0.55)" />
    </svg>
  );
}


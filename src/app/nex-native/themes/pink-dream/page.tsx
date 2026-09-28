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
        // Warm sunset bedroom wallpaper covers the entire viewport ·
        // every chat surface floats over it per the master prompt.
        backgroundImage: "url(/nex-themes/pink-dream.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: "#2b1638",
      }}
    >
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
          position: "sticky",
          top: 0,
          zIndex: 5,
          padding:
            "calc(env(safe-area-inset-top, 0) + 12px) 16px 12px",
          background: "transparent",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        {/* Bridge 24e · back arrow removed · profile portrait now
           anchors the leftmost slot of the header per Founder
           direction 2026-09-28. */}
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "url(/nex-themes/pink-dream.png) center/cover",
            border: "2px solid rgba(255,255,255,0.85)",
            boxShadow: "0 0 12px rgba(255,79,163,0.65)",
            flexShrink: 0,
          }}
          aria-hidden
        />
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: P.softBabyPink,
              opacity: 0.92,
              marginTop: 1,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: P.onlineGreen,
                boxShadow: "0 0 6px rgba(123,228,149,0.7)",
              }}
            />
            online
          </div>
        </div>
        <HeaderIcon aria-label="Call">
          <PhoneIcon />
        </HeaderIcon>
        <HeaderIcon aria-label="Video">
          <VideoIcon />
        </HeaderIcon>
        <HeaderIcon aria-label="More">
          <DotsIcon />
        </HeaderIcon>
      </header>

      {/* ---------------- Conversation ---------------- */}
      <main
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          minHeight: 0,
          width: "100%",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          padding: "12px 14px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {CONVO.map((m, i) => {
          const prev = CONVO[i - 1];
          const speakerChanged = !prev || prev.side !== m.side;
          const gapTop = speakerChanged ? 8 : 0;
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
      <footer
        style={{
          position: "relative",
          padding: "10px 10px calc(env(safe-area-inset-bottom, 0) + 10px)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          zIndex: 6,
          overflow: "hidden",
        }}
      >
        {/* Long pill-shaped composer */}
        <div
          style={{
            flex: "1 1 0%",
            minWidth: 0, // let the pill shrink smaller than intrinsic
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "0 8px 0 10px",
            height: 54,
            borderRadius: 32,
            background: "rgba(24,15,30,0.88)",
            border: "1px solid rgba(255,139,197,0.75)",
            boxShadow: "0 0 18px rgba(255,79,163,0.18)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            overflow: "hidden",
          }}
        >
          <ComposerIcon aria-label="Emoji">
            <SmileIcon />
          </ComposerIcon>
          <input
            type="text"
            placeholder="Type a message…"
            aria-label="Message"
            style={{
              flex: "1 1 0%",
              minWidth: 0,
              width: "100%",
              padding: "0 4px",
              background: "transparent",
              border: "none",
              color: P.softWhite,
              fontSize: 15,
              fontFamily: SANS,
              outline: "none",
            }}
          />
          <ComposerIcon aria-label="Attach">
            <PaperclipIcon />
          </ComposerIcon>
          <ComposerIcon aria-label="Camera">
            <CameraIcon />
          </ComposerIcon>
        </div>
        {/* Separate circular send button */}
        <button
          type="button"
          aria-label="Send"
          style={{
            flex: "0 0 auto",
            width: 54,
            height: 54,
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
        gap: 8,
        marginTop: extraTop,
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: "url(/nex-themes/pink-dream.png) center/cover",
          border: "1.5px solid rgba(255,255,255,0.75)",
          boxShadow: "0 0 8px rgba(255,79,163,0.55)",
          flexShrink: 0,
        }}
        aria-hidden
      />
      <div
        style={{
          position: "relative",
          maxWidth: "78%",
          padding: "13px 18px 12px",
          borderRadius: 22,
          background: "linear-gradient(135deg, #2A1833, #17121F)",
          border: "1px solid rgba(255,139,197,0.55)",
          boxShadow: "0 5px 18px rgba(0,0,0,0.28)",
          color: P.softWhite,
          fontSize: 16,
          fontWeight: 400,
          lineHeight: 1.4,
          whiteSpace: "pre-wrap",
        }}
      >
        {body}
        <div
          style={{
            marginTop: 4,
            fontSize: 11,
            opacity: 0.72,
            textAlign: "right",
            color: P.mutedText,
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
          maxWidth: "78%",
          padding: "13px 18px 12px",
          borderRadius: 22,
          background: "linear-gradient(135deg, #FF77BC, #FF3F9F)",
          border: "1px solid rgba(255,205,230,0.65)",
          boxShadow: "0 6px 22px rgba(255,63,159,0.30)",
          color: P.white,
          fontSize: 16,
          fontWeight: 400,
          lineHeight: 1.4,
          whiteSpace: "pre-wrap",
        }}
      >
        {body}
        <div
          style={{
            marginTop: 4,
            fontSize: 11,
            opacity: 0.82,
            textAlign: "right",
            color: P.softWhite,
            display: "inline-flex",
            gap: 4,
            alignItems: "center",
            justifyContent: "flex-end",
            width: "100%",
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

// -- Small components -------------------------------------------
function HeaderIcon({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      style={{
        width: 44,
        height: 44,
        borderRadius: 999,
        background: "transparent",
        border: "none",
        color: "#FFD4E8",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </button>
  );
}

function ComposerIcon({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      style={{
        flex: "0 0 auto",
        width: 36,
        height: 36,
        padding: 0,
        borderRadius: 999,
        background: "transparent",
        border: "none",
        color: "#FFD4E8",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </button>
  );
}

// -- Icons · thin rounded strokes -------------------------------
function PhoneIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 4h3l2 5-2.5 1.5a12 12 0 006 6L15 14l5 2v3a2 2 0 01-2 2A15 15 0 013 6a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function VideoIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="6"
        width="13"
        height="12"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M16 10l5-3v10l-5-3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function DotsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="6" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="18" r="1.6" fill="currentColor" />
    </svg>
  );
}
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
function PaperclipIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 12l-8.5 8.5a5 5 0 01-7-7L14 5a3.5 3.5 0 015 5L9.5 19.5a2 2 0 01-3-3L15 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function CameraIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8h3l1.5-2h7L17 8h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="13"
        r="3.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
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

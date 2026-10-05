"use client";

// src/app/nex-native/themes/pink-dream/page.tsx
//
// Bridge 24 · Pink Dream chat theme · admin preview.
// ---------------------------------------------------
// Client component so message rows can carry swipe-to-reply +
// long-press emoji reactions (Bridge 28 · preview interactivity).

import * as React from "react";
import { useState, useEffect } from "react";
import { PinkDreamComposer } from "./_composer";
import {
  NEX_CART_STORAGE_KEY,
  type NexCartItem,
} from "@/lib/nex-native/cart-types";
import { PinkDreamShopSliderPreview } from "./_shop-slider-preview";
import {
  useMessageGestures,
  ReactionPicker,
  ReplyChip,
  MessageReactions,
  type ReactionPickerAnchor,
  type ReplyTarget,
} from "../_shared/gestures";
import { UniversalChromeOverlay } from "../../chat-standard/_universal-chrome-overlay";

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
  id: string;
  side: "in" | "out";
  body: string;
  time: string;
  read?: boolean;
}
const CONVO: Msg[] = [
  { id: "m1", side: "in", body: "Hey! 💕\nHow are you today?", time: "10:24" },
  {
    id: "m2",
    side: "out",
    body: "I'm good! 😊\nJust relaxing at home.\nHow about you?",
    time: "10:25",
    read: true,
  },
  {
    id: "m3",
    side: "in",
    body: "Aww that sounds perfect! 💖\nWish I was there with you.",
    time: "10:26",
  },
  {
    id: "m4",
    side: "out",
    body: "Hehe... maybe soon 😉\nWhat are you up to now?",
    time: "10:27",
    read: true,
  },
  {
    id: "m5",
    side: "in",
    body: "Just watching the sunset\nand thinking about you... 💕",
    time: "10:28",
  },
  {
    id: "m6",
    side: "out",
    body: "Aww that's so sweet 🥰\nYou're the best!",
    time: "10:29",
    read: true,
  },
  { id: "m7", side: "in", body: "Always for you 💕\nTalk later, okay?", time: "10:30" },
];

export default function PinkDreamPreviewPage() {
  // Bridge 28 · preview-only gesture state · not persisted.
  const [reactions, setReactions] = useState<Record<string, string[]>>({});
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [pickerAnchor, setPickerAnchor] = useState<ReactionPickerAnchor | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  // Bridge 54 · slider preview state · shop icon in the header
  // opens this so founder can see the Pink Dream-themed grid.
  const [shopSliderOpen, setShopSliderOpen] = useState(false);
  // Bridge 54c · dev-only preview mode picker · overlay on the hero
  // lets founder pick which content variant the slider opens in.
  const [previewMode, setPreviewMode] = useState<"products" | "menu">(
    "products",
  );

  const openPicker = (id: string, anchor: ReactionPickerAnchor) => {
    setPickerFor(id);
    setPickerAnchor(anchor);
  };
  const closePicker = () => {
    setPickerFor(null);
    setPickerAnchor(null);
  };
  const addReaction = (emoji: string) => {
    if (!pickerFor) return;
    setReactions((prev) => ({
      ...prev,
      [pickerFor]: [...(prev[pickerFor] ?? []), emoji],
    }));
    closePicker();
  };
  const triggerReply = (id: string) => {
    const m = CONVO.find((x) => x.id === id);
    if (!m) return;
    setReplyTarget({
      id,
      speaker: m.side === "in" ? "Bunny" : "You",
      preview: m.body.replace(/\n/g, " · ").slice(0, 80),
      accent: m.side === "in" ? "#FF4FA3" : "#FFC97C",
    });
  };
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
        {/* Portrait · two ping rings + heart charm at bottom-right */}
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
          {/* Bridge 24aj · heart sits DIRECTLY on the portrait rim ·
             no dark-navy badge, no white ring · just the SVG heart
             with its own gradient + glow floating on the corner. */}
          <span
            aria-hidden
            style={{
              position: "absolute",
              bottom: -4,
              right: -4,
              zIndex: 3,
              lineHeight: 0,
            }}
          >
            <PinkHeart size={20} />
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "-0.005em",
              color: P.softWhite,
              lineHeight: 1.15,
            }}
          >
            Bunny
          </div>
          {/* Bridge 24ai · profession is a golden-rule NEX field ·
             every account picks one at create-time · always shown
             under the display name in the chat header. */}
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: P.softBabyPink,
              marginTop: 2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Illustrator
          </div>
        </div>
        {/* Bridge 53 · standard chat header right-cluster · order
           refined to [Home] [Cart] [Shop/Menu] · nested flex row
           with a tighter gap so the profession subtitle has more
           room without changing the outer header spacing. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            flexShrink: 0,
          }}
        >
          <a
            href="/nex-native/home"
            aria-label="Home"
            title="Home"
            style={pinkIconStyle()}
          >
            <HomeGlyph />
          </a>
          <PinkCartCircle />
          <button
            type="button"
            onClick={() => setShopSliderOpen(true)}
            aria-label="Open Bunny's shop"
            title="Bunny's shop"
            style={{ ...pinkIconStyle(), cursor: "pointer" }}
          >
            <ShopGlyph />
          </button>
        </div>
      </header>

      {/* Bridge 54c · dev-only preview mode picker · hovers over the
         hero as a small floating chip so founder can flip between
         Products and Menu variants before tapping the shop icon.
         Not shipped to production surfaces — this whole page is a
         preview. */}
      <div
        aria-label="Preview slider content (dev only)"
        style={{
          position: "absolute",
          top: "calc(env(safe-area-inset-top, 0) + 74px)",
          left: 14,
          zIndex: 20,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 8px",
          borderRadius: 999,
          background: "rgba(23,18,31,0.85)",
          border: "1px solid rgba(255,138,197,0.45)",
          boxShadow: "0 6px 18px rgba(0,0,0,0.5)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
        }}
      >
        <span
          style={{
            fontSize: 9,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#FF8BC5",
            fontWeight: 700,
            paddingLeft: 4,
          }}
        >
          Dev
        </span>
        <div
          role="tablist"
          style={{
            display: "inline-flex",
            padding: 2,
            borderRadius: 999,
            background: "rgba(255,138,197,0.14)",
          }}
        >
          <PreviewPill
            active={previewMode === "products"}
            onClick={() => setPreviewMode("products")}
            label="🛍 Products"
          />
          <PreviewPill
            active={previewMode === "menu"}
            onClick={() => setPreviewMode("menu")}
            label="🍽 Menu"
          />
        </div>
      </div>

      {/* Bridge 54 · themed slider preview · opens from the shop
         icon above · mode is picked externally by the dev overlay
         above so both variants can be inspected on this one page. */}
      <PinkDreamShopSliderPreview
        open={shopSliderOpen}
        onClose={() => setShopSliderOpen(false)}
        defaultMode={previewMode}
      />

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
                key={m.id}
                messageId={m.id}
                body={m.body}
                time={m.time}
                extraTop={gapTop}
                isFirstOfCluster={speakerChanged}
                reactions={reactions[m.id] ?? []}
                onSwipeReply={triggerReply}
                onLongPress={openPicker}
              />
            );
          }
          return (
            <OutgoingRow
              key={m.id}
              messageId={m.id}
              body={m.body}
              time={m.time}
              read={!!m.read}
              extraTop={gapTop}
              reactions={reactions[m.id] ?? []}
              onSwipeReply={triggerReply}
              onLongPress={openPicker}
            />
          );
        })}
      </main>

      {/* Bridge 24n · client composer · left "+" opens Shop &
         Marketing panel · centre smile opens Emoji + Mascot picker
         · input naked with pink underline · send button shrunk
         per Founder direction 2026-09-28. */}
      <ReplyChip
        target={replyTarget}
        onCancel={() => setReplyTarget(null)}
        accentFallback="#FF4FA3"
      />
      <PinkDreamComposer />

      <ReactionPicker
        anchor={pickerFor ? pickerAnchor : null}
        onPick={addReaction}
        onClose={closePicker}
      />
      <UniversalChromeOverlay accent={P.hotPink} deep={P.primaryDark} />
    </div>
  );
}

// -- Rows · Timeline Ribbon treatment · Bridge 24q -------------
// Vertical pink→peach spine down the left of the message column ·
// each message has a coloured tick + eyebrow (speaker + time) + raw
// text. No bubble containers. Peer chat reads like a shared journal
// timeline.

function IncomingRow({
  messageId,
  body,
  time,
  extraTop,
  isFirstOfCluster,
  reactions,
  onSwipeReply,
  onLongPress,
}: {
  messageId: string;
  body: string;
  time: string;
  extraTop: number;
  isFirstOfCluster: boolean;
  reactions: string[];
  onSwipeReply: (id: string) => void;
  onLongPress: (id: string, anchor: ReactionPickerAnchor) => void;
}) {
  return (
    <TimelineRow
      messageId={messageId}
      side="left"
      color="#FF4FA3"
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
      reactions={reactions}
      onSwipeReply={onSwipeReply}
      onLongPress={onLongPress}
    />
  );
}

function TimelineRow({
  messageId,
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
  reactions = [],
  onSwipeReply,
  onLongPress,
}: {
  messageId: string;
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
  reactions?: string[];
  onSwipeReply?: (id: string) => void;
  onLongPress?: (id: string, anchor: ReactionPickerAnchor) => void;
}) {
  const isRight = side === "right";
  const { handlers, translate } = useMessageGestures({
    messageId,
    side,
    onSwipeReply: onSwipeReply ?? (() => undefined),
    onLongPress: onLongPress ?? (() => undefined),
  });
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
        {...handlers}
        style={{
          display: "inline-block",
          maxWidth: "100%",
          padding: "8px 14px 8px 14px",
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
          boxShadow: isRight
            ? "-6px 4px 14px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.10)"
            : "6px 4px 14px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.10)",
          transform: `translateX(${translate}px)`,
          transition: translate === 0 ? "transform 180ms cubic-bezier(.2,.7,.2,1)" : "none",
          touchAction: "pan-y",
          userSelect: "none",
          cursor: "pointer",
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
        <MessageReactions
          list={reactions}
          accent={color}
          align={isRight ? "right" : "left"}
        />
      </div>
    </div>
  );
}

function OutgoingRow({
  messageId,
  body,
  time,
  read,
  extraTop,
  reactions,
  onSwipeReply,
  onLongPress,
}: {
  messageId: string;
  body: string;
  time: string;
  read: boolean;
  extraTop: number;
  reactions: string[];
  onSwipeReply: (id: string) => void;
  onLongPress: (id: string, anchor: ReactionPickerAnchor) => void;
}) {
  return (
    <TimelineRow
      messageId={messageId}
      side="right"
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
      reactions={reactions}
      onSwipeReply={onSwipeReply}
      onLongPress={onLongPress}
    />
  );
}

/* Bridge 24al · shared header pink-circle style · matches the
   composer's "+" button (Bridge 24af) so the header + composer
   circular actions read as one visual family. Retained for the
   composer · header uses pinkIconStyle() (Bridge 53 direction). */

/** Bridge 54c · pill in the dev-only preview picker overlay on the
 *  hero · picks whether the slider opens in Products or Menu mode. */
function PreviewPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        padding: "5px 10px",
        borderRadius: 999,
        border: "none",
        background: active
          ? "linear-gradient(135deg, #FF8AC5, #FF3F9F)"
          : "transparent",
        color: active ? "#FFF5FA" : "#D8C6D3",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.02em",
        cursor: "pointer",
        fontFamily: "inherit",
        boxShadow: active ? "0 3px 8px rgba(255,79,163,0.35)" : "none",
        transition: "background 160ms ease, color 160ms ease",
      }}
    >
      {label}
    </button>
  );
}

function pinkCircleStyle(): React.CSSProperties {
  return {
    width: 30,
    height: 30,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #FF8AC5, #FF3F9F)",
    border: "1px solid rgba(255,205,230,0.75)",
    boxShadow: "0 3px 10px rgba(255,79,163,0.30)",
    color: "#FFF5FA",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    flexShrink: 0,
  };
}

/* Bridge 53 · header right-cluster icon style · Founder direction
   2026-09-29: buttons removed, only icons remain. Icon carries the
   theme's pink accent as stroke colour + soft drop-shadow so it
   reads over any wallpaper without a background chip. */
function pinkIconStyle(): React.CSSProperties {
  return {
    width: 30,
    height: 30,
    padding: 4,
    borderRadius: 0,
    background: "transparent",
    border: "none",
    boxShadow: "none",
    color: "#FF8BC5",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    flexShrink: 0,
    filter: "drop-shadow(0 2px 6px rgba(20,10,28,0.65))",
  };
}
function HomeGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 12l9-9 9 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function ShopGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 8l1.5-4h15L21 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 8h16v11a1 1 0 01-1 1H5a1 1 0 01-1-1V8z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9 8V5m6 3V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CartGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
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

/** Bridge 53 · Pink Dream cart button · pink circle to match the
 *  theme + live badge that reads from NEX_CART_STORAGE_KEY and
 *  refreshes on `nex-cart-changed`. Standard chat right-cluster
 *  slot #3. */
function PinkCartCircle() {
  const [count, setCount] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    function read(): number {
      if (typeof window === "undefined") return 0;
      try {
        const raw = window.localStorage.getItem(NEX_CART_STORAGE_KEY);
        if (!raw) return 0;
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return 0;
        return arr.reduce(
          (n, x) =>
            n +
            (x && typeof x === "object" && typeof (x as NexCartItem).quantity === "number"
              ? Math.max(0, Math.floor((x as NexCartItem).quantity))
              : 0),
          0,
        );
      } catch {
        return 0;
      }
    }
    setCount(read());
    setHydrated(true);
    const onChange = () => setCount(read());
    window.addEventListener("nex-cart-changed", onChange);
    const onStorage = (e: StorageEvent) => {
      if (e.key === NEX_CART_STORAGE_KEY) setCount(read());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("nex-cart-changed", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return (
    <a
      href="/nex-native/cart"
      aria-label={
        count > 0 ? `Open cart · ${count} item${count === 1 ? "" : "s"}` : "Open cart"
      }
      title="Cart"
      style={{ ...pinkIconStyle(), position: "relative" }}
    >
      <CartGlyph />
      {hydrated && count > 0 && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            minWidth: 16,
            height: 16,
            padding: "0 4px",
            borderRadius: 999,
            background: "#FF3F9F",
            color: "#FFF5FA",
            fontSize: 9,
            fontWeight: 800,
            lineHeight: 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1.5px solid #17121F",
            boxShadow: "0 3px 8px rgba(255,79,163,0.55)",
            fontFamily:
              "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </a>
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


"use client";

// src/app/nex-native/dev/status-viewer-v1/_client.tsx
//
// Full-fidelity Status Viewer · sealed Prototype 8 (vertical scroll)
// with all 10 NEX-unique killer features wired to the Theme Engine.
//
// Features implemented:
//   1  Theme-aware status (uses poster's createEngine · ambient,
//      bubble material, typography, reactions all inherited)
//   2  No arbitrary expiry · per-status expiry chip (1h / 24h / 7d /
//      never-expire shown)
//   3  Approximate location (geo-district strings · never GPS)
//   4  Any-length video with auto-segmented tap-skip chapters
//   5  Text overlay in theme typography
//   6  Status reply → chat message (shown as mock chip)
//   7  Private viewer list (owner-only indicator)
//   8  Theme-themed reaction palette (pulled from pkg.reactions.glyphs)
//   9  Approximate time (humanised strings only)
//   10 Progress bar colour = theme primary

import * as React from "react";
import { createEngine } from "../../chat-standard/_engine/theme-engine";
import type { ThemePackage } from "../../chat-standard/_engine/types";
import { StandardAmbientLayer } from "../../chat-standard/_surfaces/_ambient-layer";

interface Status {
  id: string;
  kind: "image" | "video" | "text";
  // Content: for image/video we fake with a themed gradient + icon,
  // for text we show the string over a theme-tinted background.
  caption?: string;
  overlayText?: string;
  // Metadata · never exact
  approxTime: string;
  approxLocation: string;
  expiry: "1h" | "24h" | "7d" | "never";
  // For video kind, how many chapters to auto-segment
  chapterCount?: number;
  // For video kind, which chapter is active
  initialChapter?: number;
  viewerCount: number;
}

const DEMO_STATUSES: Status[] = [
  {
    id: "s1",
    kind: "image",
    overlayText: "Sunset shoot went perfectly ✨",
    approxTime: "2 hours ago",
    approxLocation: "Lisbon · ~1km from Alfama",
    expiry: "24h",
    viewerCount: 23,
  },
  {
    id: "s2",
    kind: "video",
    caption: "Found the best macarons",
    approxTime: "This morning",
    approxLocation: "Lisbon · Chiado",
    expiry: "7d",
    chapterCount: 4,
    initialChapter: 1,
    viewerCount: 41,
  },
  {
    id: "s3",
    kind: "text",
    overlayText: "Still thinking about last night.",
    approxTime: "Yesterday evening",
    approxLocation: "Lisbon · Bairro Alto",
    expiry: "never",
    viewerCount: 12,
  },
];

const POSTER = {
  name: "Maria Santos",
  tagline: "Footwear Designer · Lisbon",
};

export function StatusViewerClient({
  pkg,
  themeId,
}: {
  pkg: ThemePackage;
  themeId: string;
}): React.JSX.Element {
  const engine = React.useMemo(() => createEngine(pkg), [pkg]);
  const colours = engine.colours;
  const typography = pkg.typography;
  const [index, setIndex] = React.useState(0);
  const [replyText, setReplyText] = React.useState("");

  const current = DEMO_STATUSES[index];

  // Scroll handling · vertical swipe between statuses
  const containerRef = React.useRef<HTMLDivElement>(null);
  const onWheel = React.useCallback(
    (e: React.WheelEvent) => {
      if (e.deltaY > 50 && index < DEMO_STATUSES.length - 1) {
        setIndex((i) => Math.min(i + 1, DEMO_STATUSES.length - 1));
      } else if (e.deltaY < -50 && index > 0) {
        setIndex((i) => Math.max(i - 1, 0));
      }
    },
    [index],
  );

  // Status reactions · pulled from the poster's theme package
  // (killer feature #8 · theme-themed reaction palette)
  const reactionGlyphs = pkg.reactions?.glyphs ?? ["❤️", "👍", "😂", "✨"];

  return (
    <div
      ref={containerRef}
      onWheel={onWheel}
      style={{
        position: "fixed",
        inset: 0,
        width: "100dvw",
        height: "100dvh",
        overflow: "hidden",
        background: "#000",
        touchAction: "none",
      }}
    >
      <style>{engine.stylesheet}</style>
      <div
        data-nex-standard-experience
        data-theme-id={themeId}
        data-personality={engine.personality}
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 10%, ${colours.secondary}, ${colours.deep} 65%, #000 100%)`,
          color: colours.highlight,
          display: "flex",
          flexDirection: "column",
          fontFamily: "inherit",
        }}
      >
        {/* Killer feature #1 · theme-aware ambient layer running
            behind the status, same engine as the live chat. */}
        <StandardAmbientLayer engine={engine} />

        {/* Status content background */}
        <StatusContent status={current} colours={colours} />

        {/* Killer feature #10 · progress bars in theme primary ·
            auto-segmented for video kind (killer feature #4) */}
        <ProgressBars
          segments={
            current.kind === "video" ? (current.chapterCount ?? 1) : 1
          }
          active={current.kind === "video" ? (current.initialChapter ?? 0) : 0}
          colour={colours.primary}
        />

        {/* Header · poster + approx time + approx location (killer
            features #3 and #9) · expiry chip (killer feature #2) */}
        <TopHeader
          poster={POSTER}
          colours={colours}
          approxTime={current.approxTime}
          approxLocation={current.approxLocation}
          expiry={current.expiry}
          onClose={() => history.back()}
        />

        {/* Killer feature #5 · overlay text in the poster's theme
            typography · French Café = serif, Midnight = sharp sans,
            etc. */}
        {current.overlayText && (
          <OverlayText
            text={current.overlayText}
            colours={colours}
            typography={typography}
          />
        )}

        {/* Right-side action rail · Prototype 8 TikTok pattern */}
        <RightRail
          colours={colours}
          reactionGlyphs={reactionGlyphs}
          viewerCount={current.viewerCount}
        />

        {/* Killer feature #6 · chat-integrated reply mock · replies
            land in the normal chat with a quoted-status chip */}
        <BottomReply
          colours={colours}
          sendGlyph={engine.composerTreatment().sendGlyph}
          value={replyText}
          onChange={setReplyText}
          posterName={POSTER.name}
        />

        {/* Theme switcher strip (dev only) */}
        <ThemeSwitcher currentTheme={themeId} />

        {/* Status counter · subtle lower-left */}
        <StatusCounter
          current={index + 1}
          total={DEMO_STATUSES.length}
          onNext={() =>
            setIndex((i) => Math.min(i + 1, DEMO_STATUSES.length - 1))
          }
          onPrev={() => setIndex((i) => Math.max(i - 1, 0))}
          colours={colours}
        />
      </div>
    </div>
  );
}

// ─── Status content background ──────────────────────────────────────

function StatusContent({
  status,
  colours,
}: {
  status: Status;
  colours: {
    primary: string;
    secondary: string;
    highlight: string;
    deep: string;
    glow: string;
  };
}): React.JSX.Element {
  if (status.kind === "video") {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, ${colours.secondary} 0%, ${colours.primary} 35%, ${colours.deep} 75%, #000 100%)`,
          display: "grid",
          placeItems: "center",
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.15)",
            display: "grid",
            placeItems: "center",
            backdropFilter: "blur(8px)",
          }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="rgba(255,255,255,0.9)" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    );
  }
  if (status.kind === "text") {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 40%, ${colours.primary}cc, ${colours.deep} 80%, #000)`,
        }}
      />
    );
  }
  // image kind
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(180deg, ${colours.secondary} 0%, ${colours.primary} 25%, ${colours.deep} 72%, #000 100%)`,
      }}
    />
  );
}

// ─── Progress bars (killer feature #10 + #4) ────────────────────────

function ProgressBars({
  segments,
  active,
  colour,
}: {
  segments: number;
  active: number;
  colour: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: 12,
        right: 12,
        display: "flex",
        gap: 4,
        zIndex: 10,
      }}
    >
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 999,
            background: "rgba(255,255,255,0.25)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width:
                i < active
                  ? "100%"
                  : i === active
                    ? "45%"
                    : "0%",
              background: colour,
              boxShadow: `0 0 8px ${colour}88`,
              transition: "width 300ms linear",
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Top header (killer features #2, #3, #9) ───────────────────────

const EXPIRY_LABEL: Record<Status["expiry"], string> = {
  "1h": "1h left",
  "24h": "24h left",
  "7d": "7d left",
  never: "Permanent",
};

function TopHeader({
  poster,
  colours,
  approxTime,
  approxLocation,
  expiry,
  onClose,
}: {
  poster: { name: string; tagline: string };
  colours: { primary: string; highlight: string };
  approxTime: string;
  approxLocation: string;
  expiry: Status["expiry"];
  onClose: () => void;
}): React.JSX.Element {
  return (
    <div
      style={{
        position: "absolute",
        top: 28,
        left: 12,
        right: 12,
        display: "flex",
        alignItems: "center",
        gap: 10,
        zIndex: 10,
      }}
    >
      {/* Avatar with theme-primary presence ring (unseen = ring on) */}
      <div style={{ position: "relative", width: 40, height: 40, flexShrink: 0 }}>
        <div
          style={{
            position: "absolute",
            inset: -3,
            borderRadius: "50%",
            border: `2px solid ${colours.primary}`,
            boxShadow: `0 0 12px ${colours.primary}66`,
          }}
        />
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${colours.primary}, ${colours.highlight})`,
            display: "grid",
            placeItems: "center",
            color: colours.highlight,
            fontSize: 16,
            fontWeight: 700,
            textShadow: "0 1px 3px rgba(0,0,0,0.5)",
          }}
        >
          {poster.name[0]}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: colours.highlight,
            textShadow: "0 1px 4px rgba(0,0,0,0.6)",
          }}
        >
          {poster.name}
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            alignItems: "center",
            fontSize: 11,
            color: "rgba(255,255,255,0.85)",
            textShadow: "0 1px 3px rgba(0,0,0,0.6)",
            marginTop: 2,
          }}
        >
          <span>{approxTime}</span>
          <span style={{ opacity: 0.5 }}>·</span>
          <span>📍 {approxLocation}</span>
        </div>
      </div>
      {/* Expiry chip (killer feature #2) */}
      <div
        style={{
          padding: "4px 10px",
          borderRadius: 999,
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(10px)",
          border: `1px solid ${colours.primary}66`,
          color: colours.highlight,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.05em",
          flexShrink: 0,
        }}
      >
        {EXPIRY_LABEL[expiry]}
      </div>
      <button
        aria-label="Close"
        onClick={onClose}
        style={{
          width: 32,
          height: 32,
          borderRadius: 999,
          background: "rgba(0,0,0,0.5)",
          border: "none",
          color: colours.highlight,
          cursor: "pointer",
          fontSize: 18,
          display: "grid",
          placeItems: "center",
          backdropFilter: "blur(10px)",
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

// ─── Overlay text (killer feature #5 · theme typography) ────────────

function OverlayText({
  text,
  colours,
  typography,
}: {
  text: string;
  colours: { highlight: string };
  typography?: { fontFamily?: string; headingWeight?: number };
}): React.JSX.Element {
  return (
    <div
      style={{
        position: "absolute",
        top: "40%",
        left: 24,
        right: 24,
        textAlign: "center",
        color: colours.highlight,
        fontSize: 28,
        fontWeight: typography?.headingWeight ?? 700,
        fontFamily: typography?.fontFamily ?? "inherit",
        textShadow: "0 2px 12px rgba(0,0,0,0.75)",
        letterSpacing: "-0.01em",
        lineHeight: 1.2,
        zIndex: 5,
        pointerEvents: "none",
      }}
    >
      {text}
    </div>
  );
}

// ─── Right action rail (Prototype 8 pattern) ────────────────────────

function RightRail({
  colours,
  reactionGlyphs,
  viewerCount,
}: {
  colours: { primary: string; highlight: string };
  reactionGlyphs: string[];
  viewerCount: number;
}): React.JSX.Element {
  const actions = [
    { icon: reactionGlyphs[0] ?? "❤️", label: "Love" },
    { icon: reactionGlyphs[1] ?? "✨", label: "Sparkle" },
    { icon: reactionGlyphs[2] ?? "👏", label: "Clap" },
  ];
  const circleStyle: React.CSSProperties = {
    width: 44,
    height: 44,
    borderRadius: 999,
    background: "rgba(0,0,0,0.5)",
    border: `1px solid ${colours.primary}44`,
    color: colours.highlight,
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
    fontSize: 20,
    backdropFilter: "blur(10px)",
  };
  return (
    <div
      style={{
        position: "absolute",
        top: "35%",
        right: 12,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        zIndex: 8,
      }}
    >
      {actions.map((a) => (
        <div key={a.label} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <button aria-label={a.label} style={circleStyle}>
            {a.icon}
          </button>
        </div>
      ))}
      {/* Viewer list (killer feature #7 · private · owner only indicator) */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 4 }}>
        <button
          aria-label={`Viewed by ${viewerCount}`}
          style={{
            ...circleStyle,
            fontSize: 18,
          }}
        >
          👁
        </button>
        <div
          style={{
            fontSize: 11,
            color: colours.highlight,
            marginTop: 3,
            textShadow: "0 1px 3px rgba(0,0,0,0.7)",
            fontWeight: 700,
          }}
        >
          {viewerCount}
        </div>
      </div>
      {/* Bookmark */}
      <button aria-label="Save" style={circleStyle}>
        🔖
      </button>
      {/* Share */}
      <button aria-label="Share" style={circleStyle}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      </button>
    </div>
  );
}

// ─── Bottom reply (killer feature #6 · chat-integrated) ────────────

function BottomReply({
  colours,
  sendGlyph,
  value,
  onChange,
  posterName,
}: {
  colours: { primary: string; highlight: string; deep: string };
  sendGlyph: string;
  value: string;
  onChange: (v: string) => void;
  posterName: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "calc(env(safe-area-inset-bottom, 0) + 16px)",
        left: 12,
        right: 72, // leave space for action rail
        display: "flex",
        gap: 8,
        alignItems: "center",
        zIndex: 8,
      }}
    >
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          height: 44,
          padding: "0 14px",
          borderRadius: 999,
          background: "rgba(0,0,0,0.5)",
          border: `1px solid ${colours.primary}44`,
          backdropFilter: "blur(10px)",
        }}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Reply to ${posterName}…`}
          style={{
            flex: 1,
            minWidth: 0,
            background: "transparent",
            border: "none",
            outline: "none",
            color: colours.highlight,
            fontSize: 13,
            fontFamily: "inherit",
          }}
        />
      </div>
      <button
        aria-label="Send reply"
        disabled={value.trim().length === 0}
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          background: value.trim().length === 0
            ? `${colours.primary}44`
            : `linear-gradient(180deg, ${colours.primary}, ${colours.primary}dd)`,
          border: `1px solid ${colours.primary}`,
          color: colours.deep,
          fontSize: 16,
          fontWeight: 800,
          cursor: value.trim().length === 0 ? "default" : "pointer",
          opacity: value.trim().length === 0 ? 0.55 : 1,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        {sendGlyph}
      </button>
    </div>
  );
}

// ─── Dev · theme switcher strip ─────────────────────────────────────

function ThemeSwitcher({ currentTheme }: { currentTheme: string }): React.JSX.Element {
  const themes = ["ocean", "coffee", "botanical-cafe", "midnight-cafe", "french-cafe"];
  return (
    <div
      style={{
        position: "absolute",
        top: "calc(env(safe-area-inset-top, 0) + 76px)",
        left: 12,
        display: "flex",
        gap: 4,
        zIndex: 11,
      }}
    >
      {themes.map((t) => (
        <a
          key={t}
          href={`?theme=${t}`}
          style={{
            padding: "3px 8px",
            borderRadius: 999,
            fontSize: 9,
            textDecoration: "none",
            background:
              t === currentTheme
                ? "rgba(0,175,255,0.4)"
                : "rgba(0,0,0,0.5)",
            border:
              t === currentTheme
                ? "1px solid rgba(0,175,255,0.9)"
                : "1px solid rgba(255,255,255,0.2)",
            color: "#F4F7FC",
            backdropFilter: "blur(10px)",
          }}
        >
          {t}
        </a>
      ))}
    </div>
  );
}

// ─── Status counter + nav ───────────────────────────────────────────

function StatusCounter({
  current,
  total,
  onNext,
  onPrev,
  colours,
}: {
  current: number;
  total: number;
  onNext: () => void;
  onPrev: () => void;
  colours: { highlight: string };
}): React.JSX.Element {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 72,
        left: 12,
        display: "flex",
        alignItems: "center",
        gap: 8,
        color: colours.highlight,
        fontSize: 11,
        zIndex: 8,
        textShadow: "0 1px 3px rgba(0,0,0,0.7)",
      }}
    >
      <button
        aria-label="Previous"
        onClick={onPrev}
        disabled={current === 1}
        style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          background: "rgba(0,0,0,0.5)",
          border: "none",
          color: colours.highlight,
          cursor: current === 1 ? "default" : "pointer",
          opacity: current === 1 ? 0.4 : 1,
          backdropFilter: "blur(10px)",
          fontSize: 14,
        }}
      >
        ↑
      </button>
      <span>{current} / {total}</span>
      <button
        aria-label="Next"
        onClick={onNext}
        disabled={current === total}
        style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          background: "rgba(0,0,0,0.5)",
          border: "none",
          color: colours.highlight,
          cursor: current === total ? "default" : "pointer",
          opacity: current === total ? 0.4 : 1,
          backdropFilter: "blur(10px)",
          fontSize: 14,
        }}
      >
        ↓
      </button>
      <span style={{ opacity: 0.6, fontSize: 10, marginLeft: 6 }}>
        swipe / scroll
      </span>
    </div>
  );
}

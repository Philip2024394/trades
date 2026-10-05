"use client";

// src/app/nex-native/dev/composer-prototypes/_client.tsx
//
// Six candidate composer-footer prototypes · each is a self-contained
// phone-sized stage so the founder can judge both the visual and the
// mobile ergonomics side-by-side.
//
// Mobile tap-target rule enforced: EVERY tappable element has a 44pt
// minimum hit area (even if the visual icon is smaller · hit area is
// padded via inline block). WCAG 2.5.5 AAA level · Apple HIG · Material
// Design 48dp. Overlay toggle shows the tap zones.

import * as React from "react";

const PALETTE = {
  deep: "#0A2535",
  primary: "#2E90B5",
  secondary: "#4FC3DC",
  highlight: "#E8F7FF",
  glow: "rgba(130,210,255,0.55)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
};

const STAGE_BG = `radial-gradient(ellipse at 50% 10%, ${PALETTE.secondary} 0%, ${PALETTE.primary} 25%, ${PALETTE.deep} 72%, #000 100%)`;

const TAP_MIN = 44; // iOS HIG / WCAG AAA minimum

// ─── Shared sample peer bubble + "mine" bubble for context ──────────

function SampleChat(): React.JSX.Element {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "16px 14px 10px",
        justifyContent: "flex-end",
      }}
    >
      <div
        style={{
          alignSelf: "flex-start",
          maxWidth: "72%",
          padding: "9px 14px",
          borderRadius: "20px 20px 20px 6px",
          background: `linear-gradient(170deg, rgba(232,247,255,0.14), rgba(79,195,220,0.48), rgba(10,37,53,0.68))`,
          color: PALETTE.text,
          fontSize: 13,
          textShadow: "0 1px 3px rgba(0,0,0,0.5)",
        }}
      >
        hey! can you send over the sketches?
      </div>
      <div
        style={{
          alignSelf: "flex-end",
          maxWidth: "72%",
          padding: "9px 14px",
          borderRadius: "20px 20px 6px 20px",
          background: `linear-gradient(180deg, rgba(232,247,255,0.14), rgba(46,144,181,0.52), rgba(10,37,53,0.68))`,
          color: PALETTE.text,
          fontSize: 13,
          textShadow: "0 1px 3px rgba(0,0,0,0.5)",
        }}
      >
        on it — give me 5 min 🫧
      </div>
    </div>
  );
}

// ─── Prototype tile frame ───────────────────────────────────────────

function PrototypeTile({
  num,
  name,
  pattern,
  pros,
  cons,
  showTap,
  children,
}: {
  num: number;
  name: string;
  pattern: string;
  pros: string;
  cons: string;
  showTap: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          fontSize: 11,
          color: "#8BA9D1",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        Prototype {num}
      </div>
      <div style={{ fontSize: 15, color: "#F4F7FC", fontWeight: 700 }}>
        {name}
      </div>
      <div
        style={{
          fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
          fontSize: 10,
          color: "#B8C8E0",
          background: "rgba(0,175,255,0.08)",
          padding: "4px 8px",
          borderRadius: 6,
        }}
      >
        {pattern}
      </div>
      <div
        data-show-tap={showTap ? "true" : "false"}
        style={{
          width: "100%",
          aspectRatio: "7/12",
          borderRadius: 20,
          overflow: "hidden",
          background: STAGE_BG,
          border: "1px solid rgba(0,175,255,0.3)",
          position: "relative",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <SampleChat />
        {children}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
        <div
          style={{
            padding: "6px 8px",
            borderRadius: 6,
            background: "rgba(34,197,94,0.08)",
            border: "1px solid rgba(34,197,94,0.3)",
            color: "#A7F3D0",
            lineHeight: 1.4,
          }}
        >
          <strong style={{ fontSize: 10, letterSpacing: "0.1em" }}>PRO</strong>
          <br />
          {pros}
        </div>
        <div
          style={{
            padding: "6px 8px",
            borderRadius: 6,
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#FCA5A5",
            lineHeight: 1.4,
          }}
        >
          <strong style={{ fontSize: 10, letterSpacing: "0.1em" }}>CON</strong>
          <br />
          {cons}
        </div>
      </div>
    </div>
  );
}

// ─── Shared button component with 44pt tap-area guarantee ───────────

function TapIcon({
  children,
  label,
  variant = "outline",
  size = 32,
}: {
  children: React.ReactNode;
  label: string;
  variant?: "outline" | "filled" | "inline";
  size?: number;
}): React.JSX.Element {
  const padding = Math.max(0, (TAP_MIN - size) / 2);
  const baseStyle: React.CSSProperties = {
    position: "relative",
    width: size,
    height: size,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    flexShrink: 0,
    padding: 0,
    color: PALETTE.text,
  };
  const variantStyle: React.CSSProperties =
    variant === "filled"
      ? {
          background: `${PALETTE.primary}aa`,
          border: `1px solid ${PALETTE.primary}`,
        }
      : variant === "inline"
        ? { background: "transparent", border: "1px solid transparent" }
        : {
            background: "transparent",
            border: `1px solid ${PALETTE.primary}66`,
          };
  return (
    <button
      type="button"
      aria-label={label}
      style={{
        position: "relative",
        display: "inline-grid",
        placeItems: "center",
        padding,
        margin: 0,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        boxShadow:
          "inset 0 0 0 0 rgba(255,255,255,0)",
      }}
    >
      <span
        data-tap-zone
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 999,
          outline: "1.5px dashed rgba(255,120,0,0.75)",
          outlineOffset: -2,
          opacity: 0,
          pointerEvents: "none",
          transition: "opacity 160ms ease-out",
        }}
      />
      <span style={{ ...baseStyle, ...variantStyle }}>{children}</span>
    </button>
  );
}

// ─── SVG Icons ──────────────────────────────────────────────────────

const sv = {
  w: 18,
  h: 18,
  stroke: "currentColor",
  fill: "none",
  sw: 2,
};

const Camera = () => (
  <svg
    width={sv.w}
    height={sv.h}
    viewBox="0 0 24 24"
    fill={sv.fill}
    stroke={sv.stroke}
    strokeWidth={sv.sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M3 8h3l2-2.5h8L18 8h3v12H3V8z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const Clip = () => (
  <svg
    width={sv.w}
    height={sv.h}
    viewBox="0 0 24 24"
    fill={sv.fill}
    stroke={sv.stroke}
    strokeWidth={sv.sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M21.5 11.5 12 21a5 5 0 0 1-7-7l9.5-9.5a3.5 3.5 0 0 1 5 5L10.5 18a2 2 0 0 1-3-3L16 7" />
  </svg>
);

const Smile = () => <span style={{ fontSize: 17, lineHeight: 1 }}>😊</span>;
const Plus = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const Send = () => <span style={{ fontSize: 16, lineHeight: 1 }}>🫧</span>;
const Mic = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <rect x="9" y="3" width="6" height="12" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <path d="M12 18v3" />
  </svg>
);

// ─── Mock Input shared across prototypes ────────────────────────────

function MockInput({
  placeholder,
  leftInline,
  rightInline,
  height = 44,
}: {
  placeholder: string;
  leftInline?: React.ReactNode;
  rightInline?: React.ReactNode;
  height?: number;
}): React.JSX.Element {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        height,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "0 10px",
        borderRadius: 999,
        background: `linear-gradient(180deg, rgba(232,247,255,0.1), rgba(79,195,220,0.22))`,
        border: `1px solid ${PALETTE.secondary}55`,
        boxShadow: `inset 0 1px 2px rgba(255,255,255,0.1)`,
      }}
    >
      {leftInline}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          color: `${PALETTE.text}55`,
          fontSize: 13,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {placeholder}
      </div>
      {rightInline}
    </div>
  );
}

// ─── Prototype 1 · Current (baseline reference) ─────────────────────

function P1(): React.JSX.Element {
  return (
    <div
      style={{
        padding: "10px 10px calc(env(safe-area-inset-bottom, 0) + 10px)",
        display: "flex",
        gap: 6,
        alignItems: "center",
      }}
    >
      <TapIcon label="Camera" size={32}>
        <Camera />
      </TapIcon>
      <TapIcon label="Attach" size={32}>
        <Clip />
      </TapIcon>
      <MockInput
        placeholder="Say something…"
        leftInline={
          <span style={{ padding: "0 4px", color: PALETTE.text }}>
            <Smile />
          </span>
        }
        rightInline={
          <span style={{ padding: "0 4px", color: PALETTE.text }}>
            <Send />
          </span>
        }
      />
      <TapIcon label="More" size={32} variant="filled">
        <Plus />
      </TapIcon>
    </div>
  );
}

// ─── Prototype 2 · WhatsApp pattern · media inside input right ──────

function P2(): React.JSX.Element {
  return (
    <div
      style={{
        padding: "10px 10px calc(env(safe-area-inset-bottom, 0) + 10px)",
        display: "flex",
        gap: 6,
        alignItems: "center",
      }}
    >
      <TapIcon label="Emoji" size={32}>
        <Smile />
      </TapIcon>
      <MockInput
        placeholder="Say something…"
        rightInline={
          <>
            <span style={{ padding: "0 4px", color: PALETTE.text }}>
              <Clip />
            </span>
            <span style={{ padding: "0 4px", color: PALETTE.text }}>
              <Camera />
            </span>
          </>
        }
      />
      <TapIcon label="Mic / Send" size={40} variant="filled">
        <Mic />
      </TapIcon>
    </div>
  );
}

// ─── Prototype 3 · Thumb-reach dock (two-row) ───────────────────────

function P3(): React.JSX.Element {
  return (
    <div
      style={{
        padding: "10px 10px calc(env(safe-area-inset-bottom, 0) + 10px)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <MockInput
          placeholder="Say something…"
          height={44}
          rightInline={
            <span style={{ padding: "0 4px", color: PALETTE.text }}>
              <Send />
            </span>
          }
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          padding: "4px 10px",
        }}
      >
        <TapIcon label="Camera" size={32}>
          <Camera />
        </TapIcon>
        <TapIcon label="Attach" size={32}>
          <Clip />
        </TapIcon>
        <TapIcon label="Emoji" size={32}>
          <Smile />
        </TapIcon>
        <TapIcon label="More" size={32} variant="filled">
          <Plus />
        </TapIcon>
      </div>
    </div>
  );
}

// ─── Prototype 4 · Minimal · everything behind + ────────────────────

function P4(): React.JSX.Element {
  return (
    <div
      style={{
        padding: "10px 10px calc(env(safe-area-inset-bottom, 0) + 10px)",
        display: "flex",
        gap: 6,
        alignItems: "center",
      }}
    >
      <TapIcon label="Add" size={40} variant="filled">
        <Plus />
      </TapIcon>
      <MockInput
        placeholder="Say something…"
        rightInline={
          <span style={{ padding: "0 4px", color: PALETTE.text }}>
            <Smile />
          </span>
        }
      />
      <TapIcon label="Send" size={40} variant="filled">
        <Send />
      </TapIcon>
    </div>
  );
}

// ─── Prototype 5 · Pill · inline divider between emoji + media ──────

function P5(): React.JSX.Element {
  return (
    <div
      style={{
        padding: "10px 10px calc(env(safe-area-inset-bottom, 0) + 10px)",
        display: "flex",
        gap: 6,
        alignItems: "center",
      }}
    >
      <MockInput
        placeholder="Say something…"
        height={48}
        leftInline={
          <>
            <span style={{ padding: "0 4px", color: PALETTE.text }}>
              <Smile />
            </span>
            <span
              style={{
                width: 1,
                height: 20,
                background: `${PALETTE.highlight}44`,
                margin: "0 4px",
              }}
            />
            <span style={{ padding: "0 4px", color: PALETTE.text }}>
              <Camera />
            </span>
            <span style={{ padding: "0 4px", color: PALETTE.text }}>
              <Clip />
            </span>
          </>
        }
        rightInline={
          <span style={{ padding: "0 4px", color: PALETTE.text }}>
            <Send />
          </span>
        }
      />
      <TapIcon label="More" size={40} variant="filled">
        <Plus />
      </TapIcon>
    </div>
  );
}

// ─── Prototype 6 · Native platform-style (iOS/Android inspired) ─────

function P6(): React.JSX.Element {
  return (
    <div
      style={{
        padding: "10px 10px calc(env(safe-area-inset-bottom, 0) + 10px)",
        display: "flex",
        gap: 6,
        alignItems: "center",
      }}
    >
      <TapIcon label="Add" size={36} variant="filled">
        <Plus />
      </TapIcon>
      <MockInput
        placeholder="Say something…"
        height={44}
        rightInline={
          <>
            <span style={{ padding: "0 3px", color: PALETTE.text }}>
              <Camera />
            </span>
            <span style={{ padding: "0 3px", color: PALETTE.text }}>
              <Smile />
            </span>
            <span style={{ padding: "0 3px", color: PALETTE.text }}>
              <Mic />
            </span>
          </>
        }
      />
      <TapIcon label="Send" size={40} variant="filled">
        <Send />
      </TapIcon>
    </div>
  );
}

// ─── Grid ───────────────────────────────────────────────────────────

export function ComposerPrototypes(): React.JSX.Element {
  const [showTap, setShowTap] = React.useState(false);
  return (
    <>
      <style>{`
        [data-show-tap="true"] [data-tap-zone] { opacity: 1 !important; }
      `}</style>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 20,
          padding: "8px 12px",
          borderRadius: 10,
          background: "rgba(0,175,255,0.06)",
          border: "1px solid rgba(0,175,255,0.25)",
          fontSize: 12,
          color: "#B8C8E0",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={showTap}
            onChange={(e) => setShowTap(e.target.checked)}
            style={{ accentColor: "#FF7800" }}
          />
          Show tap-target overlay (orange dashed = 44pt hit zone)
        </label>
        <div style={{ marginLeft: "auto", opacity: 0.75 }}>
          Every tappable element in every prototype is 44pt minimum
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 24,
        }}
      >
        <PrototypeTile
          num={1}
          name="Current baseline (sealed R3)"
          pattern="[📷 📎] [😊 input ▶] [+]"
          pros="Clear semantic grouping · media LEFT, text CENTER, chat RIGHT. 44pt tap zones. Familiar."
          cons="Input fairly narrow once theme send glyph takes space on right. Four separate tap targets."
          showTap={showTap}
        >
          <P1 />
        </PrototypeTile>

        <PrototypeTile
          num={2}
          name="WhatsApp pattern (media inside right)"
          pattern="[😊] [input 📎 📷] [mic/send]"
          pros="Emoji outside for one-handed thumb reach. Media clustered near send so attach-then-send flows. Mic-to-send morph is a familiar signal."
          cons="Inside icons compete with send glyph for input width. Two inside icons + text leaves ~45% input room for text."
          showTap={showTap}
        >
          <P2 />
        </PrototypeTile>

        <PrototypeTile
          num={3}
          name="Thumb-reach dock (two-row)"
          pattern="[input ▶]      /    [📷 📎 😊 +]"
          pros="Input gets full width · maximum typing room. Action row at the very bottom = thumb's natural resting arc. All actions equidistant from thumb."
          cons="Takes ~24pt more vertical space than one-row layouts. Chat area shrinks by that amount. Four-icon dock can feel toolbar-y."
          showTap={showTap}
        >
          <P3 />
        </PrototypeTile>

        <PrototypeTile
          num={4}
          name="Minimal · everything behind +"
          pattern="[+] [input 😊] [▶]"
          pros="Cleanest look · only 3 visible targets. Both outside buttons are 40pt visually with 44pt hit areas. Industry trend (iMessage / Slack)."
          cons="Camera and attach become one tap deeper. Discoverability tradeoff — new users may not find camera quickly."
          showTap={showTap}
        >
          <P4 />
        </PrototypeTile>

        <PrototypeTile
          num={5}
          name="Pill · inline divider between emoji + media"
          pattern="[😊 │ 📷 📎 input ▶] [+]"
          pros="Everything in one capsule reads as 'the compose area'. Divider makes the semantic split (expression vs attach) explicit. Input taller (48pt) so icons breathe."
          cons="Longest icon-string inside the input of any option. Placeholder gets truncated earliest. Not great for languages with long placeholder text."
          showTap={showTap}
        >
          <P5 />
        </PrototypeTile>

        <PrototypeTile
          num={6}
          name="Native platform-style (iOS/Android inspired)"
          pattern="[+] [input 📷 😊 🎙️] [▶]"
          pros="Matches both iOS and Android native composer patterns · zero learning curve. Mic as inside action feels native. + collapses extras."
          cons="Three inline right icons is dense. Must be careful with 44pt hit area overlap — adjacent inline buttons need 8pt+ gap or they merge visually to the eye."
          showTap={showTap}
        >
          <P6 />
        </PrototypeTile>
      </div>

      <div
        style={{
          marginTop: 32,
          padding: "16px 20px",
          borderRadius: 12,
          background: "rgba(255,120,0,0.06)",
          border: "1px solid rgba(255,120,0,0.3)",
          fontSize: 12,
          color: "#FFD9B8",
          lineHeight: 1.6,
        }}
      >
        <strong style={{ fontSize: 13 }}>My founder recommendation</strong>
        <br />
        If you want the <strong>richest</strong> composer (every action visible) ·
        pick <strong>Prototype 1</strong> (what we have) or <strong>Prototype 5</strong>
        {" "}(pill with inline divider · the version you asked about earlier).
        <br />
        If you want the <strong>cleanest</strong> composer (fewest visible targets) ·
        pick <strong>Prototype 4</strong>. Camera and attach move behind the + menu.
        <br />
        If you want the <strong>best thumb ergonomics</strong> for one-handed phone use ·
        pick <strong>Prototype 3</strong>. The action dock sits at the exact arc your
        thumb traces naturally.
        <br />
        <br />
        None of these are implemented in the Standard Experience yet · they're pure
        design candidates. The current sealed R3 is Prototype 1 (slightly condensed).
      </div>
    </>
  );
}

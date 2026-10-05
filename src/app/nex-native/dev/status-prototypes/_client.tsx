"use client";

// src/app/nex-native/dev/status-prototypes/_client.tsx
//
// Ten status-page prototypes + written research brief.
//
// Design intent: each prototype is distinct in layout, mood, or
// feature set. Mobile-first (390 × 844 phone frame). Status content
// is mocked via gradients + text so the designs are self-contained.

import * as React from "react";

const C = {
  deep: "#020914",
  primary: "#00AFFF",
  secondary: "#4FC3DC",
  highlight: "#F4F7FC",
  dim: "#8BA9D1",
  warm: "#FFB357",
  pink: "#FF4FA3",
  green: "#22C55E",
  red: "#FF4757",
};

// ─── Research Brief Section ────────────────────────────────────────

function ResearchBrief(): React.JSX.Element {
  return (
    <section style={{ marginBottom: 40, maxWidth: 920 }}>
      <h1 style={{ fontSize: 24, margin: "0 0 6px" }}>
        NEX Status · research + ten prototypes
      </h1>
      <p style={{ fontSize: 13, color: C.dim, lineHeight: 1.55, margin: "0 0 24px" }}>
        Status is a universal product affordance across every NEX theme.
        Below is a research brief on what makes status pages world-class,
        followed by ten distinct prototype designs. Pick the ones worth
        implementing · they will be absorbed into the Standard Experience
        as a new universal chrome rule (R12).
      </p>

      <div style={cardStyle}>
        <h2 style={h2Style}>1 · Reference analysis — what the leaders do</h2>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>App</th>
              <th style={thStyle}>Pattern</th>
              <th style={thStyle}>Strength</th>
              <th style={thStyle}>Weakness</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>Instagram</td>
              <td style={tdStyle}>Full-screen · 24h · segmented progress bars · ring on avatar</td>
              <td style={tdStyle}>Universal UX literacy</td>
              <td style={tdStyle}>Overcommercialised · ad-dense</td>
            </tr>
            <tr>
              <td style={tdStyle}>WhatsApp</td>
              <td style={tdStyle}>Simple · 24h · DM reply directly</td>
              <td style={tdStyle}>Private · low-stakes</td>
              <td style={tdStyle}>Dated UI · no discovery</td>
            </tr>
            <tr>
              <td style={tdStyle}>Snapchat</td>
              <td style={tdStyle}>Map · groups · bitmoji presence</td>
              <td style={tdStyle}>Live spatial awareness</td>
              <td style={tdStyle}>Privacy anxiety · exact location</td>
            </tr>
            <tr>
              <td style={tdStyle}>Telegram</td>
              <td style={tdStyle}>Rings · reactions · forward · duration slider</td>
              <td style={tdStyle}>Flexible duration · clean</td>
              <td style={tdStyle}>Discovery is weak</td>
            </tr>
            <tr>
              <td style={tdStyle}>TikTok</td>
              <td style={tdStyle}>Vertical reel · no 24h limit · algorithmic</td>
              <td style={tdStyle}>Content lives forever</td>
              <td style={tdStyle}>Pressure to perform · not personal</td>
            </tr>
            <tr>
              <td style={tdStyle}>BeReal</td>
              <td style={tdStyle}>Synchronised prompt · dual camera · 2min window</td>
              <td style={tdStyle}>Honest · low effort</td>
              <td style={tdStyle}>Novelty cooled</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={cardStyle}>
        <h2 style={h2Style}>2 · NEX-unique killer features (recommended for v1)</h2>
        <ol style={listStyle}>
          <li>
            <strong>Theme-aware status.</strong> The viewer's status screen
            inherits the <em>poster's</em> theme (not the viewer's). Ocean
            posts a status · you see it with Ocean ambient, water bubbles
            trailing the progress bar, Ocean's send-glyph on the reply
            composer. First-ever status surface that <em>is part of the
            visual world</em>, not a chrome overlay sitting on top.
          </li>
          <li>
            <strong>No arbitrary 24-hour cap.</strong> Owner picks expiry
            per status · <em>1 hour · 24 hours · 7 days · never-expire</em>.
            Addresses the biggest WhatsApp/Instagram criticism: forced
            ephemerality.
          </li>
          <li>
            <strong>Approximate location, never exact.</strong> Shows
            geofenced city district · "SW London · ~2km from Battersea" ·
            never GPS coords. One-tap toggle · owner can hide location
            per-status. Privacy-forward.
          </li>
          <li>
            <strong>Any length video.</strong> No 15-second ceiling. The
            theme-aware progress bar auto-segments long videos into
            tap-skip chapters so viewers aren't trapped.
          </li>
          <li>
            <strong>Text overlay with theme typography.</strong> Owner's
            theme font applies to text overlays. French Café status =
            serif overlay. Midnight = sharp neon type. Cross-promotes the
            theme as part of the owner's personal brand.
          </li>
          <li>
            <strong>Status reply → chat message.</strong> Replies posted
            from status land as a quoted-status bubble in the normal chat
            thread. One continuous conversation, status is a message type.
          </li>
          <li>
            <strong>Viewer list is private by default.</strong> Owner sees
            who viewed · viewers DON'T see each other. Opposite of
            Instagram (where every viewer sees every other viewer).
            Addresses "stalker anxiety."
          </li>
          <li>
            <strong>Reaction palette is theme-themed.</strong> Ocean
            status · reactions are 💙 🫧 🐚 🐟 ✨ 🐙. French Café · 🥐 🍷
            🥮 ✨ 🕯️ 🗼. Same vocabulary already used in bubble reactions
            per theme.
          </li>
          <li>
            <strong>Approximate time, not exact.</strong> "2 hours ago" ·
            "This morning" · "Yesterday evening" rather than "14:32:08."
            Softer, more human.
          </li>
          <li>
            <strong>Progress bar colour = theme primary.</strong> Each
            segmented tap-chapter uses the poster's `colours.primary`.
            Status feels like it belongs to the poster's identity before
            you've read a single word.
          </li>
        </ol>
      </div>

      <div style={cardStyle}>
        <h2 style={h2Style}>3 · Features to deliberately NOT ship (yet)</h2>
        <ul style={listStyle}>
          <li>
            <strong>Public map of all posters</strong> (Snap Maps) · too much
            privacy risk for v1 · would need a separate doctrine amendment
            on precision + opt-in flow.
          </li>
          <li>
            <strong>Algorithmic feed</strong> · TikTok-style ranking creates
            performance anxiety. Status in NEX is for conversations between
            people who already know each other.
          </li>
          <li>
            <strong>Status monetisation / sponsored insertions</strong> ·
            incompatible with the "status is part of your theme / your
            identity" positioning.
          </li>
          <li>
            <strong>AI auto-caption / auto-translate</strong> · possible
            later but adds surface area to v1.
          </li>
          <li>
            <strong>Multi-user "collab status"</strong> · later; needs its
            own ownership + permissions model.
          </li>
        </ul>
      </div>

      <div style={cardStyle}>
        <h2 style={h2Style}>4 · Entry points sealed 2026-10-05</h2>
        <ul style={listStyle}>
          <li>
            <strong>Posting:</strong> new "Status" icon added to the floating
            lower-right 3-dots stack (R7 extended to 4 actions:
            Call · Video · Mic · Status).
          </li>
          <li>
            <strong>Viewing:</strong> tap the peer avatar in the header to
            open their active statuses full-screen. Avatar gets the theme's
            primary ring if they have unseen statuses (like Instagram, but
            theme-tinted instead of pink gradient).
          </li>
          <li>
            <strong>Discovery:</strong> no inbox tab or feed in v1. Status
            lives inside existing chats. If you're in a conversation with
            someone, you see their status via their avatar.
          </li>
        </ul>
      </div>

      <h2 style={{ ...h2Style, marginTop: 32, marginBottom: 12 }}>
        5 · Ten prototype designs
      </h2>
      <p style={{ fontSize: 13, color: C.dim, lineHeight: 1.55, margin: "0 0 20px" }}>
        Each phone-frame below is a different design candidate. Pros/cons under
        every one. Pick the ones worth absorbing into Standard Experience.
      </p>
    </section>
  );
}

// ─── Shared tile frame ──────────────────────────────────────────────

const h2Style: React.CSSProperties = {
  fontSize: 15,
  margin: "0 0 10px",
  letterSpacing: "0.02em",
};

const cardStyle: React.CSSProperties = {
  padding: "16px 20px",
  borderRadius: 12,
  background: "rgba(0,175,255,0.06)",
  border: "1px solid rgba(0,175,255,0.25)",
  marginBottom: 18,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12,
  marginTop: 8,
};
const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 8px",
  borderBottom: "1px solid rgba(0,175,255,0.3)",
  color: C.highlight,
  fontWeight: 700,
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};
const tdStyle: React.CSSProperties = {
  padding: "8px 8px",
  borderBottom: "1px solid rgba(0,175,255,0.1)",
  color: C.dim,
  lineHeight: 1.4,
};
const listStyle: React.CSSProperties = {
  margin: "6px 0 0",
  paddingLeft: 20,
  fontSize: 12.5,
  color: C.dim,
  lineHeight: 1.55,
};

// ─── Shared mock components ─────────────────────────────────────────

function PhoneFrame({
  children,
  bg = "#000",
}: {
  children: React.ReactNode;
  bg?: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        width: "100%",
        aspectRatio: "9/19.5",
        borderRadius: 24,
        overflow: "hidden",
        background: bg,
        border: "2px solid rgba(0,175,255,0.3)",
        position: "relative",
        boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
      }}
    >
      {children}
    </div>
  );
}

function MockPoster({
  name,
  theme,
  size = 32,
  showRing = true,
}: {
  name: string;
  theme: string;
  size?: number;
  showRing?: boolean;
}): React.JSX.Element {
  const colours: Record<string, [string, string]> = {
    ocean: ["#2E90B5", "#4FC3DC"],
    coffee: ["#6B3F22", "#C8976B"],
    botanical: ["#3F7A4A", "#86B46A"],
    midnight: ["#FF3EA5", "#38C6FF"],
    french: ["#A6734A", "#F2E4CF"],
  };
  const [a, b] = colours[theme] ?? [C.primary, C.secondary];
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      {showRing && (
        <div
          style={{
            position: "absolute",
            inset: -3,
            borderRadius: "50%",
            border: `2px solid ${a}`,
            boxShadow: `0 0 10px ${a}66`,
          }}
        />
      )}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${a}, ${b})`,
          display: "grid",
          placeItems: "center",
          fontSize: size * 0.4,
          fontWeight: 700,
          color: C.highlight,
        }}
      >
        {name[0]}
      </div>
    </div>
  );
}

function StatusContent({
  type = "image",
  theme = "ocean",
  caption,
}: {
  type?: "image" | "video" | "text";
  theme?: string;
  caption?: string;
}): React.JSX.Element {
  const bgs: Record<string, string> = {
    ocean:
      "linear-gradient(180deg, #4FC3DC 0%, #2E90B5 35%, #0A2535 75%, #000 100%), radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.3), transparent 60%)",
    coffee:
      "linear-gradient(180deg, #C8976B 0%, #6B3F22 50%, #2A160A 100%)",
    botanical:
      "linear-gradient(180deg, #86B46A 0%, #3F7A4A 50%, #17281A 100%)",
    midnight:
      "linear-gradient(180deg, #FF3EA5 0%, #38C6FF 50%, #0B0A1E 100%)",
    french:
      "linear-gradient(180deg, #F8ECD5 0%, #A6734A 60%, #2A1810 100%)",
    sunset:
      "linear-gradient(180deg, #FFB357 0%, #FF4FA3 50%, #4A1A5C 100%)",
  };
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: bgs[theme] ?? bgs.ocean,
        display: "grid",
        placeItems: "center",
      }}
    >
      {type === "video" && (
        <svg width="54" height="54" viewBox="0 0 24 24" fill="rgba(255,255,255,0.4)" aria-hidden>
          <path d="M8 5v14l11-7z" />
        </svg>
      )}
      {type === "text" && caption && (
        <div
          style={{
            fontSize: 24,
            fontWeight: 800,
            textAlign: "center",
            color: C.highlight,
            padding: 40,
            lineHeight: 1.3,
            textShadow: "0 2px 10px rgba(0,0,0,0.6)",
          }}
        >
          {caption}
        </div>
      )}
    </div>
  );
}

function ProgressBars({
  segments,
  active,
  color = C.highlight,
}: {
  segments: number;
  active: number;
  color?: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        position: "absolute",
        top: 10,
        left: 12,
        right: 12,
        display: "flex",
        gap: 4,
        zIndex: 2,
      }}
    >
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 2.5,
            borderRadius: 999,
            background: "rgba(255,255,255,0.3)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: i < active ? "100%" : i === active ? "40%" : "0%",
              background: color,
              transition: "width 300ms linear",
            }}
          />
        </div>
      ))}
    </div>
  );
}

function TopHeader({
  name,
  theme,
  timeAgo,
  location,
  zIndex = 2,
}: {
  name: string;
  theme: string;
  timeAgo: string;
  location: string;
  zIndex?: number;
}): React.JSX.Element {
  return (
    <div
      style={{
        position: "absolute",
        top: 22,
        left: 12,
        right: 12,
        display: "flex",
        alignItems: "center",
        gap: 8,
        zIndex,
      }}
    >
      <MockPoster name={name} theme={theme} size={34} showRing={false} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: C.highlight,
            textShadow: "0 1px 4px rgba(0,0,0,0.6)",
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.8)",
            textShadow: "0 1px 3px rgba(0,0,0,0.6)",
            display: "flex",
            gap: 6,
            alignItems: "center",
          }}
        >
          <span>{timeAgo}</span>
          <span style={{ opacity: 0.5 }}>•</span>
          <span>📍 {location}</span>
        </div>
      </div>
      <button
        aria-label="Close"
        style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          background: "rgba(0,0,0,0.4)",
          border: "none",
          color: C.highlight,
          cursor: "pointer",
          fontSize: 16,
          display: "grid",
          placeItems: "center",
        }}
      >
        ×
      </button>
    </div>
  );
}

function BottomReply({
  theme = "ocean",
  text = "Reply to Maria…",
}: {
  theme?: string;
  text?: string;
}): React.JSX.Element {
  const colours: Record<string, string> = {
    ocean: "#4FC3DC",
    coffee: "#C8976B",
    botanical: "#86B46A",
    midnight: "#FF3EA5",
    french: "#A6734A",
  };
  const accent = colours[theme] ?? C.primary;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 20,
        left: 12,
        right: 12,
        display: "flex",
        gap: 8,
        alignItems: "center",
        zIndex: 2,
      }}
    >
      <div
        style={{
          flex: 1,
          height: 40,
          borderRadius: 999,
          background: "rgba(0,0,0,0.5)",
          border: `1px solid ${accent}66`,
          backdropFilter: "blur(10px)",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          color: "rgba(255,255,255,0.6)",
          fontSize: 13,
        }}
      >
        {text}
      </div>
      {["💙", "🫧", "🐚"].map((e, i) => (
        <button
          key={i}
          aria-label={`React ${e}`}
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            background: "rgba(0,0,0,0.5)",
            border: "none",
            cursor: "pointer",
            fontSize: 16,
            display: "grid",
            placeItems: "center",
          }}
        >
          {e}
        </button>
      ))}
    </div>
  );
}

// ─── Prototype 1 · Classic (Instagram-style) ────────────────────────

function P1(): React.JSX.Element {
  return (
    <PhoneFrame>
      <StatusContent type="image" theme="ocean" />
      <ProgressBars segments={4} active={1} color={C.secondary} />
      <TopHeader name="Maria" theme="ocean" timeAgo="2h ago" location="Lisbon · ~1km from Alfama" />
      <div
        style={{
          position: "absolute",
          top: "40%",
          left: 20,
          right: 20,
          color: C.highlight,
          fontSize: 20,
          fontWeight: 700,
          textAlign: "center",
          textShadow: "0 2px 8px rgba(0,0,0,0.7)",
          zIndex: 2,
        }}
      >
        Sunset shoot went perfectly ✨
      </div>
      <BottomReply theme="ocean" />
    </PhoneFrame>
  );
}

// ─── Prototype 2 · Theme-Immersive Capsule ──────────────────────────

function P2(): React.JSX.Element {
  return (
    <PhoneFrame bg="radial-gradient(ellipse at 50% 10%, #4FC3DC 0%, #0A2535 60%, #000 100%)">
      <ProgressBars segments={3} active={0} color={C.secondary} />
      <TopHeader name="Maria" theme="ocean" timeAgo="This morning" location="Lisbon · Alfama area" />
      {/* Floating bubbles - theme ambient */}
      {[20, 45, 70, 85].map((x, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${x}%`,
            bottom: 100 + i * 60,
            width: 6 + (i % 2) * 4,
            height: 6 + (i % 2) * 4,
            borderRadius: "50%",
            background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9), ${C.secondary})`,
            boxShadow: `0 0 10px ${C.secondary}`,
            opacity: 0.6,
          }}
        />
      ))}
      {/* Capsule content */}
      <div
        style={{
          position: "absolute",
          top: "22%",
          left: "7%",
          right: "7%",
          bottom: "22%",
          borderRadius: 24,
          background: "linear-gradient(180deg, #4FC3DC, #2E90B5 50%, #0A2535)",
          border: "1px solid rgba(255,255,255,0.3)",
          boxShadow: "0 20px 60px rgba(79,195,220,0.4)",
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
        }}
      >
        <div style={{ fontSize: 46, textShadow: "0 2px 10px rgba(0,0,0,0.7)" }}>🌊</div>
      </div>
      <BottomReply theme="ocean" />
    </PhoneFrame>
  );
}

// ─── Prototype 3 · Cinematic Letterbox ──────────────────────────────

function P3(): React.JSX.Element {
  return (
    <PhoneFrame>
      <div
        style={{
          position: "absolute",
          top: "25%",
          left: 0,
          right: 0,
          height: "50%",
          background:
            "linear-gradient(180deg, #FFB357 0%, #FF4FA3 50%, #4A1A5C 100%)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <div style={{ fontSize: 54, textShadow: "0 2px 10px rgba(0,0,0,0.7)" }}>🎬</div>
      </div>
      <ProgressBars segments={2} active={0} color="#FFB357" />
      <TopHeader name="Maria" theme="ocean" timeAgo="Just now" location="Lisbon · Príncipe Real" />
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 20,
          right: 20,
          textAlign: "center",
          color: C.highlight,
          zIndex: 2,
        }}
      >
        <div style={{ fontSize: 10, letterSpacing: "0.3em", opacity: 0.7, marginBottom: 4 }}>
          CINEMATIC · 2.35:1
        </div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Golden hour, perfect.</div>
      </div>
      <BottomReply theme="ocean" />
    </PhoneFrame>
  );
}

// ─── Prototype 4 · Reader Mode (image + caption) ────────────────────

function P4(): React.JSX.Element {
  return (
    <PhoneFrame bg="#1A1A1A">
      <ProgressBars segments={1} active={0} color={C.primary} />
      <TopHeader name="Maria" theme="botanical" timeAgo="3h ago" location="Lisbon · Botanic Garden" />
      <div
        style={{
          position: "absolute",
          top: "15%",
          left: 0,
          right: 0,
          height: "50%",
          background: "linear-gradient(180deg, #86B46A 0%, #3F7A4A 70%, #17281A 100%)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <div style={{ fontSize: 54 }}>🌿</div>
      </div>
      <div
        style={{
          position: "absolute",
          top: "65%",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "20px 20px 70px",
          background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.9) 20%, #000 100%)",
          color: C.highlight,
          zIndex: 1,
        }}
      >
        <div style={{ fontSize: 11, letterSpacing: "0.2em", color: C.dim, marginBottom: 6 }}>
          READER MODE
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
          Found this fern in the greenhouse
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.4 }}>
          Haven't seen one this size before. The light coming through was unreal.
          Thinking about doing a whole series.
        </div>
      </div>
      <BottomReply theme="botanical" />
    </PhoneFrame>
  );
}

// ─── Prototype 5 · Minimal Dark ─────────────────────────────────────

function P5(): React.JSX.Element {
  return (
    <PhoneFrame bg="#000">
      <ProgressBars segments={5} active={2} color="#FFFFFF" />
      <TopHeader name="Maria" theme="midnight" timeAgo="Yesterday" location="Lisbon · Bairro Alto" />
      <div
        style={{
          position: "absolute",
          inset: "40% 40px 40% 40px",
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          color: C.highlight,
          zIndex: 1,
        }}
      >
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.3em", opacity: 0.5, marginBottom: 20 }}>
            MINIMAL
          </div>
          <div style={{ fontSize: 32, fontWeight: 300, lineHeight: 1.2, letterSpacing: "-0.01em" }}>
            Still thinking about last night.
          </div>
        </div>
      </div>
      <BottomReply theme="midnight" />
    </PhoneFrame>
  );
}

// ─── Prototype 6 · Live Map Context ─────────────────────────────────

function P6(): React.JSX.Element {
  return (
    <PhoneFrame>
      <StatusContent type="image" theme="french" />
      <ProgressBars segments={2} active={1} color="#F2E4CF" />
      <TopHeader name="Maria" theme="french" timeAgo="This afternoon" location="Lisbon · Chiado" />
      {/* Floating map pill */}
      <div
        style={{
          position: "absolute",
          top: 85,
          right: 12,
          width: 130,
          height: 90,
          borderRadius: 14,
          background: "linear-gradient(135deg, #2a2a3a 0%, #1a1a24 100%)",
          border: "1px solid rgba(255,255,255,0.2)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
          overflow: "hidden",
          zIndex: 2,
        }}
      >
        {/* Mock map grid */}
        <svg width="100%" height="100%" viewBox="0 0 130 90" aria-hidden>
          <defs>
            <pattern id="grid" width="12" height="12" patternUnits="userSpaceOnUse">
              <path d="M 12 0 L 0 0 0 12" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          <circle cx="65" cy="45" r="4" fill="#FF4757" />
          <circle cx="65" cy="45" r="12" fill="none" stroke="#FF4757" strokeWidth="1" opacity="0.5" />
          <circle cx="65" cy="45" r="20" fill="none" stroke="#FF4757" strokeWidth="1" opacity="0.3" />
        </svg>
        <div
          style={{
            position: "absolute",
            bottom: 4,
            left: 6,
            fontSize: 9,
            color: C.highlight,
          }}
        >
          ~2km radius
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 85,
          left: 20,
          right: 20,
          color: C.highlight,
          textAlign: "center",
          fontSize: 18,
          fontWeight: 700,
          textShadow: "0 2px 8px rgba(0,0,0,0.7)",
          zIndex: 2,
        }}
      >
        Found the best macarons 🥮
      </div>
      <BottomReply theme="french" />
    </PhoneFrame>
  );
}

// ─── Prototype 7 · Story Grid ───────────────────────────────────────

function P7(): React.JSX.Element {
  const items = [
    { c: "ocean", icon: "🌊", time: "2h" },
    { c: "sunset", icon: "🌅", time: "4h" },
    { c: "botanical", icon: "🌿", time: "6h" },
    { c: "french", icon: "🥮", time: "8h" },
    { c: "coffee", icon: "☕", time: "10h" },
    { c: "midnight", icon: "🌙", time: "12h" },
  ];
  return (
    <PhoneFrame bg="#0A0A14">
      <div style={{ padding: "22px 16px 0", display: "flex", alignItems: "center", gap: 10 }}>
        <MockPoster name="Maria" theme="ocean" size={38} showRing={false} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.highlight }}>Maria Santos</div>
          <div style={{ fontSize: 11, color: C.dim }}>6 statuses · newest first</div>
        </div>
        <button
          aria-label="Close"
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            background: "rgba(255,255,255,0.1)",
            border: "none",
            color: C.highlight,
            fontSize: 16,
            cursor: "pointer",
          }}
        >
          ×
        </button>
      </div>
      <div
        style={{
          padding: "14px 16px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        {items.map((it, i) => (
          <div
            key={i}
            style={{
              aspectRatio: "9/16",
              borderRadius: 12,
              background: {
                ocean: "linear-gradient(180deg, #4FC3DC, #0A2535)",
                sunset: "linear-gradient(180deg, #FFB357, #FF4FA3, #4A1A5C)",
                botanical: "linear-gradient(180deg, #86B46A, #17281A)",
                french: "linear-gradient(180deg, #F8ECD5, #A6734A, #2A1810)",
                coffee: "linear-gradient(180deg, #C8976B, #2A160A)",
                midnight: "linear-gradient(180deg, #FF3EA5, #38C6FF, #0B0A1E)",
              }[it.c],
              position: "relative",
              display: "grid",
              placeItems: "center",
              border: i === 0 ? `2px solid ${C.primary}` : "1px solid rgba(255,255,255,0.1)",
              overflow: "hidden",
            }}
          >
            <div style={{ fontSize: 32 }}>{it.icon}</div>
            <div
              style={{
                position: "absolute",
                top: 6,
                right: 8,
                fontSize: 10,
                color: C.highlight,
                background: "rgba(0,0,0,0.5)",
                padding: "2px 6px",
                borderRadius: 10,
              }}
            >
              {it.time}
            </div>
            {i === 0 && (
              <div
                style={{
                  position: "absolute",
                  bottom: 6,
                  left: 8,
                  fontSize: 9,
                  color: C.highlight,
                  background: C.primary,
                  padding: "2px 6px",
                  borderRadius: 10,
                  letterSpacing: "0.1em",
                }}
              >
                NEW
              </div>
            )}
          </div>
        ))}
      </div>
    </PhoneFrame>
  );
}

// ─── Prototype 8 · Vertical Scroll (TikTok-ish, personal) ───────────

function P8(): React.JSX.Element {
  return (
    <PhoneFrame>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, #86B46A 0%, #3F7A4A 60%, #17281A 100%)",
        }}
      />
      <ProgressBars segments={1} active={0} color={C.secondary} />
      <TopHeader name="Maria" theme="botanical" timeAgo="This morning" location="Lisbon · Bairro Alto" />
      <div style={{ position: "absolute", top: "30%", right: 12, display: "flex", flexDirection: "column", gap: 14, zIndex: 2 }}>
        {[
          { icon: "💚", label: "27" },
          { icon: "💬", label: "4" },
          { icon: "🌿", label: "" },
          { icon: "🔖", label: "" },
          { icon: "📤", label: "" },
        ].map((a, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <button
              aria-label={a.icon}
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                background: "rgba(0,0,0,0.4)",
                border: "none",
                cursor: "pointer",
                fontSize: 20,
                display: "grid",
                placeItems: "center",
                color: C.highlight,
                backdropFilter: "blur(10px)",
              }}
            >
              {a.icon}
            </button>
            {a.label && (
              <div style={{ fontSize: 11, color: C.highlight, marginTop: 2, textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>
                {a.label}
              </div>
            )}
          </div>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 20,
          right: 80,
          color: C.highlight,
          zIndex: 2,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}>
          Maria Santos
        </div>
        <div style={{ fontSize: 13, marginTop: 4, textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>
          Spring is early this year 🌿
        </div>
        <div style={{ fontSize: 10, opacity: 0.7, marginTop: 6 }}>
          ↑ swipe for next status
        </div>
      </div>
      <BottomReply theme="botanical" />
    </PhoneFrame>
  );
}

// ─── Prototype 9 · AR Floating Elements ─────────────────────────────

function P9(): React.JSX.Element {
  return (
    <PhoneFrame>
      <StatusContent type="image" theme="coffee" />
      <ProgressBars segments={1} active={0} color={C.warm} />
      <TopHeader name="Maria" theme="coffee" timeAgo="Just now" location="Lisbon · Príncipe Real" />
      {/* Floating sticker */}
      <div
        style={{
          position: "absolute",
          top: "35%",
          left: "20%",
          padding: "6px 14px",
          borderRadius: 999,
          background: "#FFF",
          color: "#000",
          fontSize: 14,
          fontWeight: 800,
          transform: "rotate(-6deg)",
          boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
          zIndex: 2,
        }}
      >
        best latte ☕
      </div>
      {/* Floating emoji */}
      <div
        style={{
          position: "absolute",
          top: "28%",
          right: "15%",
          fontSize: 32,
          transform: "rotate(10deg)",
          filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.5))",
          zIndex: 2,
        }}
      >
        ✨
      </div>
      {/* 3D location pin */}
      <div
        style={{
          position: "absolute",
          top: "60%",
          left: "40%",
          width: 60,
          height: 60,
          display: "grid",
          placeItems: "center",
          zIndex: 2,
          filter: "drop-shadow(0 8px 20px rgba(0,0,0,0.6))",
        }}
      >
        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 2 C 7 2 3 6 3 11 C 3 17 12 22 12 22 C 12 22 21 17 21 11 C 21 6 17 2 12 2 Z" fill="#FF4757" />
          <circle cx="12" cy="11" r="4" fill="#FFF" />
        </svg>
        <div
          style={{
            position: "absolute",
            top: 68,
            background: "rgba(0,0,0,0.6)",
            padding: "2px 8px",
            borderRadius: 10,
            fontSize: 10,
            color: C.highlight,
            whiteSpace: "nowrap",
          }}
        >
          here
        </div>
      </div>
      <BottomReply theme="coffee" />
    </PhoneFrame>
  );
}

// ─── Prototype 10 · Chat-Integrated Reply ───────────────────────────

function P10(): React.JSX.Element {
  return (
    <PhoneFrame>
      <StatusContent type="image" theme="midnight" />
      <ProgressBars segments={3} active={1} color={C.pink} />
      <TopHeader name="Maria" theme="midnight" timeAgo="2h ago" location="Lisbon · Bairro Alto" />
      {/* Previous replies floating up from bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 85,
          left: 12,
          right: 12,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          zIndex: 2,
        }}
      >
        <div
          style={{
            alignSelf: "flex-start",
            maxWidth: "75%",
            padding: "8px 12px",
            borderRadius: "14px 14px 14px 4px",
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(10px)",
            border: `1px solid ${C.pink}55`,
            color: C.highlight,
            fontSize: 12,
          }}
        >
          <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 2 }}>Jamie</div>
          absolutely stunning 😍
        </div>
        <div
          style={{
            alignSelf: "flex-start",
            maxWidth: "75%",
            padding: "8px 12px",
            borderRadius: "14px 14px 14px 4px",
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(10px)",
            border: `1px solid ${C.pink}55`,
            color: C.highlight,
            fontSize: 12,
          }}
        >
          <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 2 }}>Alex</div>
          what camera is this
        </div>
      </div>
      <BottomReply theme="midnight" text="Reply · lands in your chat with Maria" />
    </PhoneFrame>
  );
}

// ─── Grid ───────────────────────────────────────────────────────────

export function StatusPrototypes(): React.JSX.Element {
  const prototypes = [
    {
      num: 1,
      name: "Classic (Instagram-pattern)",
      el: <P1 />,
      pros: "Universal UX literacy. Segmented progress + reply at bottom. Low learning curve.",
      cons: "Doesn't differentiate NEX from existing apps. Theme-tinted progress bars help a little.",
    },
    {
      num: 2,
      name: "Theme-Immersive Capsule",
      el: <P2 />,
      pros: "Content lives inside the theme's visual world. Status feels like 'part of your NEX', not an overlay. First-of-its-kind.",
      cons: "Capsule framing means less screen real estate for content. Harder to crop user images into.",
    },
    {
      num: 3,
      name: "Cinematic Letterbox",
      el: <P3 />,
      pros: "Movie-like, premium feel. Letterbox bars make even casual phone shots look intentional. Caption area built in.",
      cons: "Vertical video doesn't fit. Horizontal-only is a strong constraint.",
    },
    {
      num: 4,
      name: "Reader Mode (image + caption)",
      el: <P4 />,
      pros: "Best for text-heavy statuses. Image is context, caption is the content. More readable than overlay text.",
      cons: "Less visual impact than full-screen image. Not great for photo-forward moments.",
    },
    {
      num: 5,
      name: "Minimal Dark (text-only)",
      el: <P5 />,
      pros: "Massive differentiator. 'Status' doesn't have to be a photo. Beautiful for mood posts, quotes, thoughts.",
      cons: "Only works when the user is writing deliberately. Not an everyday pattern.",
    },
    {
      num: 6,
      name: "Live Map Context",
      el: <P6 />,
      pros: "Approx-location pin as a floating map pill is a NEX signature. Privacy-forward: ~2km radius, not GPS. Builds spatial awareness without the Snapchat creepiness.",
      cons: "Adds visual complexity. Needs careful testing with real locations to not feel toy-like.",
    },
    {
      num: 7,
      name: "Story Grid (all at once)",
      el: <P7 />,
      pros: "Shows all of a user's statuses at a glance. Great for catching up after being away. 'Newest first' is clear.",
      cons: "Breaks the full-screen immersion. More of a navigation screen than a status view.",
    },
    {
      num: 8,
      name: "Vertical Scroll (TikTok-pattern)",
      el: <P8 />,
      pros: "Modern. Right-side action rail is pattern-matched for every mobile user. Great for binge-watching one user's statuses.",
      cons: "Feels social-media-y. Risks turning statuses into performance. The right-rail actions feel like 'engagement bait.'",
    },
    {
      num: 9,
      name: "AR Floating Elements",
      el: <P9 />,
      pros: "Playful, personal, high-engagement. Stickers + 3D location pin feel craft-handmade. Owner can decorate their status.",
      cons: "Harder to build. Owner-editor needs its own UX. Risk of feeling toy-like if not restrained.",
    },
    {
      num: 10,
      name: "Chat-Integrated Reply (NEX signature)",
      el: <P10 />,
      pros: "The killer v1 feature IMO. Replies posted from status appear floating up on the status itself AND land in the chat. Status becomes a message type, not a separate surface. Deeply NEX-native.",
      cons: "Needs careful UX for who sees whose reply. Private-by-default is important. Builds on existing chat so lower engineering cost.",
    },
  ];

  return (
    <>
      <ResearchBrief />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 24,
        }}
      >
        {prototypes.map((p) => (
          <div key={p.num} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                fontSize: 11,
                color: C.dim,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              Prototype {p.num}
            </div>
            <div style={{ fontSize: 15, color: C.highlight, fontWeight: 700 }}>{p.name}</div>
            {p.el}
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
                {p.pros}
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
                {p.cons}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 40,
          padding: "20px 24px",
          borderRadius: 12,
          background: "rgba(255,120,0,0.06)",
          border: "1px solid rgba(255,120,0,0.3)",
          fontSize: 13,
          color: "#FFD9B8",
          lineHeight: 1.6,
        }}
      >
        <strong style={{ fontSize: 15 }}>My founder recommendation</strong>
        <br /><br />
        <strong>Ship Prototype 2 (Theme-Immersive) as the default viewer.</strong>{" "}
        Status should feel like the poster's world · not a generic overlay sitting on top of their photo.
        Theme-tinted progress, bubbles, typography · all inherited from the poster's package via the
        existing Theme Engine. This is a unique position no competitor can copy without the same
        theme architecture.
        <br /><br />
        <strong>Combine with Prototype 6 (Live Map Context) for metadata.</strong>{" "}
        The floating map pill is where the "approximate location" lives. Theme-tinted ring,
        ~2km radius, never GPS. Addresses the Snapchat trauma without losing spatial awareness.
        <br /><br />
        <strong>Add Prototype 10 (Chat-Integrated Reply) as the engagement model.</strong>{" "}
        Replies from status land as chat messages with a quoted-status chip. One continuous
        conversation. Keeps NEX chat-first.
        <br /><br />
        <strong>Status entry UI: Prototype 7 (Story Grid)</strong> as the "all my statuses"
        management view when the owner taps their own avatar.
        <br /><br />
        <strong>Hold on these:</strong> AR stickers (P9) is a cool feature but needs its own
        designer time. TikTok vertical scroll (P8) risks social-media performance anxiety —
        avoid for v1. Letterbox (P3) is a nice option but not a default.
      </div>
      <div
        style={{
          marginTop: 20,
          padding: "16px 20px",
          borderRadius: 10,
          background: "rgba(0,175,255,0.05)",
          border: "1px solid rgba(0,175,255,0.25)",
          fontSize: 12,
          color: "#B8C8E0",
          lineHeight: 1.6,
        }}
      >
        <strong>Current implementation status:</strong> design prototypes only. Nothing is wired
        into the live chat. The two sealed entry points (Status in the 3-dots stack ·
        tap-avatar-to-view) and the viewer itself are the next build phase, pending founder
        pick of which prototypes to merge into R12.
      </div>
    </>
  );
}

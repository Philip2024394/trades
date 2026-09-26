// src/app/nex-native/chat/prototypes/footers/page.tsx
//
// NEX chat footer prototypes · 10 directions for the composer bar.
// ---------------------------------------------------------------
// Each renders inside a phone frame with the Portrait Bloom header
// + 2 sample messages above, so the footer can be judged in the
// actual visual context. Design-only · not wired to the backend.

import * as React from "react";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-static";

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  glass: "rgba(5,20,36,0.72)",
  fieldBg: "rgba(4,20,36,0.90)",
  fieldSubtle: "rgba(120,140,180,0.10)",
  cyan: "#009FEF",
  cyanElectric: "#168BFF",
  cyanDeep: "#063B67",
  cyanSoft: "rgba(0,159,239,0.65)",
  cyanFaint: "rgba(0,159,239,0.16)",
  orange: "#FF7800",
  orangeSoft: "rgba(255,120,0,0.35)",
  purple: "#6945F5",
  green: "#16D66B",
  white: "#F7FAFF",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
};

const SAMPLE_FRIEND = {
  name: "Maria Santos",
  profession: "Footwear designer",
  avatarUrl:
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop",
};

const SAMPLE_MESSAGES: { mine: boolean; body: string; time: string }[] = [
  { mine: false, body: "Love the new collection! When can I see it in person?", time: "09:44" },
  { mine: true, body: "Anytime this week — drop by the studio 👋", time: "09:45" },
  { mine: false, body: "Perfect. Tuesday afternoon?", time: "09:46" },
];

// -----------------------------------------------------------------------------
// Gallery shell
// -----------------------------------------------------------------------------

interface FooterProto {
  id: string;
  name: string;
  tagline: string;
  render: () => React.ReactNode;
}

const FOOTER_PROTOS: FooterProto[] = [
  { id: "neon-rim", name: "Neon Rim", tagline: "Refined cyan-rim pill · three circular action buttons docked around the input.", render: NeonRimFooter },
  { id: "floating-orbs", name: "Floating Orbs", tagline: "All controls read as independent objects hovering over the chat glass.", render: FloatingOrbsFooter },
  { id: "segmented-bar", name: "Segmented Bar", tagline: "One long bar · sectioned into attach · camera · input · send with hairline dividers.", render: SegmentedBarFooter },
  { id: "voice-first", name: "Voice First", tagline: "Big microphone dominates · text field is secondary · optimised for talk-first chat.", render: VoiceFirstFooter },
  { id: "circle-nest", name: "Circle Nest", tagline: "Send is the star · attach + camera nested left · input floats between.", render: CircleNestFooter },
  { id: "split-deck", name: "Split Deck", tagline: "Two-row · quick-action strip above · full-width input below.", render: SplitDeckFooter },
  { id: "adaptive-morph", name: "Adaptive Morph", tagline: "Buttons take equal space when empty · shrink and let input expand when typing.", render: AdaptiveMorphFooter },
  { id: "aurora-rail", name: "Aurora Rail", tagline: "Input pill with a slow aurora border · icons hover above as ghost buttons.", render: AuroraRailFooter },
  { id: "compact-dock", name: "Compact Dock", tagline: "Everything in one 44px row · minimum footprint · maximum message space above.", render: CompactDockFooter },
  { id: "command-palette", name: "Command Palette", tagline: "Slash-prefix input · action chips labeled inline like a terminal.", render: CommandPaletteFooter },
];

export default function FooterGalleryPage() {
  return (
    <>
      <style>{`
        html, body { background: ${NEX.bg} !important; }
        @keyframes nex-aurora-border {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
      <main
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.text,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "24px 16px 40px",
        }}
      >
        <header style={{ maxWidth: 900, margin: "0 auto 28px" }}>
          <div style={{ marginBottom: 12 }}>
            <Link
              href="/nex-native/chat/prototypes"
              style={{
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: NEX.cyan,
                textDecoration: "none",
              }}
            >
              ← Prototype hub
            </Link>
          </div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            NEX Chat · footer prototypes
          </h1>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 14,
              color: NEX.textDim,
              maxWidth: 620,
              lineHeight: 1.55,
            }}
          >
            Ten composer footers in the sealed Portrait Bloom context.
            Each includes an attachment button, camera button, input
            field, and send. Design-only · not wired to the backend.
          </p>
        </header>

        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            display: "grid",
            gap: 32,
          }}
        >
          {FOOTER_PROTOS.map((p, i) => (
            <FooterSection key={p.id} index={i + 1} meta={p} />
          ))}
        </div>
      </main>
    </>
  );
}

function FooterSection({ index, meta }: { index: number; meta: FooterProto }) {
  return (
    <section
      id={meta.id}
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        gap: 14,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: NEX.orange,
            fontWeight: 600,
          }}
        >
          Footer {String(index).padStart(2, "0")}
        </div>
        <h2
          style={{
            margin: "4px 0 6px",
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "-0.005em",
          }}
        >
          {meta.name}
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: NEX.textDim, lineHeight: 1.55 }}>
          {meta.tagline}
        </p>
      </div>

      <PhoneFrame>
        <ChatContext />
        {meta.render()}
      </PhoneFrame>
    </section>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 390,
        margin: "0 auto",
        height: 620,
        borderRadius: 32,
        overflow: "hidden",
        background: NEX.bg,
        border: "1px solid rgba(0,159,239,0.18)",
        boxShadow: "0 24px 60px rgba(0,0,0,0.55), 0 0 0 6px rgba(0,0,0,0.6)",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </div>
  );
}

/** Small Portrait Bloom-flavoured chat context so each footer can be
 *  judged where it actually lives. */
function ChatContext() {
  return (
    <>
      {/* Portrait behind */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "42%",
          backgroundImage: `url(${SAMPLE_FRIEND.avatarUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center 22%",
          maskImage:
            "linear-gradient(180deg, #000 0%, #000 55%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(180deg, #000 0%, #000 55%, transparent 100%)",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, transparent 30%, rgba(2,9,20,0.6) 55%, #020914 82%)",
        }}
      />
      {/* Header */}
      <div
        style={{
          position: "relative",
          zIndex: 3,
          padding: "18px 20px 0",
          textShadow: "0 2px 20px rgba(0,0,0,0.75)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: NEX.green,
              boxShadow: `0 0 8px ${NEX.green}`,
            }}
          />
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.005em" }}>
            {SAMPLE_FRIEND.name}
          </div>
        </div>
        <div style={{ fontSize: 12, color: NEX.textDim, marginTop: 2 }}>
          {SAMPLE_FRIEND.profession.split(" ")[0]}
        </div>
      </div>

      {/* Messages · squished into the middle */}
      <div
        style={{
          position: "relative",
          zIndex: 3,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "70px 16px 12px",
          justifyContent: "flex-end",
        }}
      >
        {SAMPLE_MESSAGES.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.mine ? "flex-end" : "flex-start",
              maxWidth: "78%",
              padding: "9px 12px 7px",
              borderRadius: m.mine ? "16px 16px 0 16px" : "16px 16px 16px 0",
              background: m.mine
                ? "rgba(120,140,180,0.14)"
                : "rgba(255,255,255,0.06)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: m.mine
                ? "1px solid rgba(0,159,239,0.85)"
                : "1px solid rgba(255,255,255,0.08)",
              fontSize: 13,
              lineHeight: 1.42,
              boxShadow: m.mine
                ? "0 0 12px rgba(0,159,239,0.22)"
                : "0 4px 14px rgba(0,0,0,0.35)",
            }}
          >
            {m.body}
            <div
              style={{
                marginTop: 3,
                fontSize: 9,
                opacity: 0.6,
                textAlign: "right",
              }}
            >
              {m.time}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// -----------------------------------------------------------------------------
// Shared icon primitives
// -----------------------------------------------------------------------------

const iconProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function AttachIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...iconProps} aria-hidden>
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function CameraIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...iconProps} aria-hidden>
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function MicIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...iconProps} aria-hidden>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M19 10v2a7 7 0 01-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function SendIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...iconProps} aria-hidden>
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22 11 13 2 9 22 2z" />
    </svg>
  );
}

function PlusIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...iconProps} aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function SlashIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...iconProps} aria-hidden>
      <line x1="19" y1="5" x2="5" y2="19" />
    </svg>
  );
}

// -----------------------------------------------------------------------------
// Reusable glass footer wrapper
// -----------------------------------------------------------------------------

function FooterFrame({
  children,
  bordered = true,
  padding = "12px 14px 18px",
}: {
  children: React.ReactNode;
  bordered?: boolean;
  padding?: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        zIndex: 4,
        padding,
        background:
          "linear-gradient(180deg, rgba(2,9,20,0.65) 0%, rgba(2,9,20,0.92) 40%, rgba(2,9,20,0.98) 100%)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: bordered ? "1px solid rgba(0,159,239,0.18)" : "none",
      }}
    >
      {children}
    </div>
  );
}

// -----------------------------------------------------------------------------
// 01 · Neon Rim
// -----------------------------------------------------------------------------

function NeonRimFooter() {
  return (
    <FooterFrame>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <RoundGlassBtn><PlusIcon size={20} /></RoundGlassBtn>
        <RoundGlassBtn><CameraIcon size={18} /></RoundGlassBtn>
        <div
          style={{
            flex: 1,
            minHeight: 44,
            padding: "0 14px",
            borderRadius: 22,
            background: NEX.fieldBg,
            border: `1px solid ${NEX.cyanSoft}`,
            display: "flex",
            alignItems: "center",
            color: NEX.textDim,
            fontSize: 14,
          }}
        >
          Write a message…
        </div>
        <CircleSend />
      </div>
    </FooterFrame>
  );
}

// -----------------------------------------------------------------------------
// 02 · Floating Orbs
// -----------------------------------------------------------------------------

function FloatingOrbsFooter() {
  return (
    <FooterFrame bordered={false} padding="0 12px 20px">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 4px",
        }}
      >
        <FloatOrb><PlusIcon size={20} /></FloatOrb>
        <FloatOrb><CameraIcon size={18} /></FloatOrb>
        <div
          style={{
            flex: 1,
            minHeight: 46,
            padding: "0 16px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.14)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            display: "flex",
            alignItems: "center",
            color: NEX.textDim,
            fontSize: 14,
            boxShadow: "0 12px 28px rgba(0,0,0,0.4)",
          }}
        >
          Say something…
        </div>
        <FloatOrb accent="orange"><SendIcon size={18} /></FloatOrb>
      </div>
    </FooterFrame>
  );
}

function FloatOrb({
  children,
  accent = "cyan",
}: {
  children: React.ReactNode;
  accent?: "cyan" | "orange";
}) {
  const c = accent === "orange" ? NEX.orange : NEX.cyan;
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: "rgba(4,20,36,0.7)",
        border: `1px solid ${accent === "orange" ? NEX.orangeSoft : NEX.cyanSoft}`,
        color: c,
        display: "grid",
        placeItems: "center",
        boxShadow: `0 8px 20px rgba(0,0,0,0.5), 0 0 12px ${c}22`,
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

// -----------------------------------------------------------------------------
// 03 · Segmented Bar
// -----------------------------------------------------------------------------

function SegmentedBarFooter() {
  return (
    <FooterFrame padding="10px 12px 18px">
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          height: 48,
          background: NEX.fieldBg,
          border: `1px solid ${NEX.cyanSoft}`,
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <SegBtn><PlusIcon size={18} /></SegBtn>
        <SegBtn><CameraIcon size={18} /></SegBtn>
        <div
          style={{
            flex: 1,
            padding: "0 14px",
            display: "flex",
            alignItems: "center",
            color: NEX.textDim,
            fontSize: 14,
            borderLeft: `1px solid ${NEX.cyanFaint}`,
            borderRight: `1px solid ${NEX.cyanFaint}`,
          }}
        >
          Write a message…
        </div>
        <button
          type="button"
          style={{
            width: 62,
            background: "linear-gradient(135deg,#008CFF,#4657FF,#FF7A00)",
            color: NEX.text,
            border: "none",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
          }}
        >
          <SendIcon size={20} />
        </button>
      </div>
    </FooterFrame>
  );
}

function SegBtn({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      style={{
        width: 48,
        background: "transparent",
        color: NEX.textDim,
        border: "none",
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

// -----------------------------------------------------------------------------
// 04 · Voice First
// -----------------------------------------------------------------------------

function VoiceFirstFooter() {
  return (
    <FooterFrame padding="12px 14px 22px">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <RoundGlassBtn><PlusIcon size={20} /></RoundGlassBtn>
        <div
          style={{
            flex: 1,
            minHeight: 44,
            padding: "0 14px",
            borderRadius: 22,
            background: "rgba(120,140,180,0.08)",
            border: "1px solid rgba(120,140,180,0.24)",
            display: "flex",
            alignItems: "center",
            color: NEX.textMute,
            fontSize: 13,
            fontStyle: "italic",
          }}
        >
          or type…
        </div>
        <button
          type="button"
          style={{
            width: 62,
            height: 62,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 40% 30%, rgba(255,255,255,0.9), rgba(0,159,239,0.85) 45%, rgba(105,69,245,0.75) 100%)",
            color: "#fff",
            border: "none",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            boxShadow:
              "0 0 30px rgba(0,159,239,0.45), 0 12px 30px rgba(0,0,0,0.5)",
          }}
        >
          <MicIcon size={26} />
        </button>
        <RoundGlassBtn><CameraIcon size={18} /></RoundGlassBtn>
      </div>
    </FooterFrame>
  );
}

// -----------------------------------------------------------------------------
// 05 · Circle Nest
// -----------------------------------------------------------------------------

function CircleNestFooter() {
  return (
    <FooterFrame padding="10px 14px 18px">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            display: "flex",
            gap: 4,
            padding: 4,
            borderRadius: 999,
            background: NEX.fieldBg,
            border: `1px solid ${NEX.cyanSoft}`,
          }}
        >
          <NestBtn><PlusIcon size={18} /></NestBtn>
          <NestBtn><CameraIcon size={16} /></NestBtn>
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 44,
            padding: "0 14px",
            borderRadius: 22,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            color: NEX.textDim,
            fontSize: 14,
          }}
        >
          Message…
        </div>
        <button
          type="button"
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "linear-gradient(135deg,#008CFF,#4657FF,#FF7A00)",
            color: NEX.text,
            border: "none",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            boxShadow: "0 10px 28px rgba(0,120,255,0.35)",
          }}
        >
          <SendIcon size={22} />
        </button>
      </div>
    </FooterFrame>
  );
}

function NestBtn({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: "transparent",
        color: NEX.textDim,
        border: "none",
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

// -----------------------------------------------------------------------------
// 06 · Split Deck
// -----------------------------------------------------------------------------

function SplitDeckFooter() {
  return (
    <FooterFrame padding="8px 14px 18px">
      {/* Quick action strip */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 8,
          paddingBottom: 8,
        }}
      >
        <DeckChip icon={<CameraIcon size={16} />} label="Photo" />
        <DeckChip icon={<AttachIcon size={16} />} label="File" />
        <DeckChip icon={<MicIcon size={16} />} label="Voice" />
        <DeckChip icon={<PlusIcon size={16} />} label="More" />
      </div>
      {/* Full-width input row */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div
          style={{
            flex: 1,
            minHeight: 44,
            padding: "0 16px",
            borderRadius: 22,
            background: NEX.fieldBg,
            border: `1px solid ${NEX.cyanSoft}`,
            display: "flex",
            alignItems: "center",
            color: NEX.textDim,
            fontSize: 14,
          }}
        >
          Write a message…
        </div>
        <CircleSend />
      </div>
    </FooterFrame>
  );
}

function DeckChip({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "5px 10px",
        borderRadius: 999,
        background: "rgba(0,159,239,0.10)",
        border: "1px solid rgba(0,159,239,0.28)",
        color: NEX.cyan,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.04em",
      }}
    >
      {icon}
      {label}
    </div>
  );
}

// -----------------------------------------------------------------------------
// 07 · Adaptive Morph (empty state · shown here)
// -----------------------------------------------------------------------------

function AdaptiveMorphFooter() {
  return (
    <FooterFrame padding="12px 14px 18px">
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <MorphBtn label="Photo"><CameraIcon size={18} /></MorphBtn>
        <MorphBtn label="File"><AttachIcon size={18} /></MorphBtn>
        <MorphBtn label="Voice"><MicIcon size={18} /></MorphBtn>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: NEX.fieldBg,
            border: `1px solid ${NEX.cyanSoft}`,
            display: "grid",
            placeItems: "center",
            color: NEX.textDim,
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          Aa
        </div>
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 10,
          textAlign: "center",
          color: NEX.textMute,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        Tap Aa to type · press-hold mic to talk
      </div>
    </FooterFrame>
  );
}

function MorphBtn({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      style={{
        flex: 1,
        height: 44,
        borderRadius: 12,
        background: "rgba(0,159,239,0.08)",
        border: "1px solid rgba(0,159,239,0.28)",
        color: NEX.text,
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

// -----------------------------------------------------------------------------
// 08 · Aurora Rail
// -----------------------------------------------------------------------------

function AuroraRailFooter() {
  return (
    <FooterFrame bordered={false} padding="10px 14px 18px">
      <div style={{ display: "flex", justifyContent: "center", gap: 22, marginBottom: 6 }}>
        <GhostIcon><PlusIcon size={18} /></GhostIcon>
        <GhostIcon><CameraIcon size={18} /></GhostIcon>
        <GhostIcon><MicIcon size={18} /></GhostIcon>
      </div>
      <div
        style={{
          position: "relative",
          padding: 2,
          borderRadius: 24,
          background:
            "linear-gradient(90deg, #00ffb4, #009fef, #6945f5, #ff7a00, #00ffb4)",
          backgroundSize: "300% 100%",
          animation: "nex-aurora-border 12s ease-in-out infinite",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            minHeight: 44,
            padding: "0 16px",
            borderRadius: 22,
            background: NEX.bg,
            color: NEX.textDim,
            fontSize: 14,
          }}
        >
          <span style={{ flex: 1 }}>Write a message…</span>
          <SendIcon size={18} />
        </div>
      </div>
    </FooterFrame>
  );
}

function GhostIcon({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: "transparent",
        color: NEX.textDim,
        border: "none",
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        opacity: 0.85,
      }}
    >
      {children}
    </button>
  );
}

// -----------------------------------------------------------------------------
// 09 · Compact Dock
// -----------------------------------------------------------------------------

function CompactDockFooter() {
  return (
    <FooterFrame padding="8px 12px 14px">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          height: 44,
          padding: "0 6px 0 4px",
          borderRadius: 22,
          background: NEX.fieldBg,
          border: `1px solid ${NEX.cyanSoft}`,
        }}
      >
        <MiniBtn><PlusIcon size={16} /></MiniBtn>
        <MiniBtn><CameraIcon size={16} /></MiniBtn>
        <div
          style={{
            flex: 1,
            fontSize: 13,
            color: NEX.textDim,
            padding: "0 6px",
          }}
        >
          Message…
        </div>
        <button
          type="button"
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "linear-gradient(135deg,#008CFF,#4657FF,#FF7A00)",
            color: "#fff",
            border: "none",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
          }}
        >
          <SendIcon size={14} />
        </button>
      </div>
    </FooterFrame>
  );
}

function MiniBtn({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: "transparent",
        color: NEX.textDim,
        border: "none",
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

// -----------------------------------------------------------------------------
// 10 · Command Palette
// -----------------------------------------------------------------------------

function CommandPaletteFooter() {
  return (
    <FooterFrame padding="10px 12px 18px">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: 48,
          padding: "0 8px",
          borderRadius: 12,
          background: NEX.fieldBg,
          border: `1px solid ${NEX.cyanSoft}`,
          gap: 8,
          fontFamily:
            "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
        }}
      >
        <span style={{ color: NEX.cyan, opacity: 0.85 }}>
          <SlashIcon size={16} />
        </span>
        <div
          style={{
            flex: 1,
            color: NEX.textDim,
            fontSize: 13,
            letterSpacing: "0.01em",
          }}
        >
          Type · or run a command
        </div>
        <PaletteChip icon={<AttachIcon size={13} />} label="file" />
        <PaletteChip icon={<CameraIcon size={13} />} label="photo" />
        <PaletteChip icon={<SendIcon size={13} />} label="send" primary />
      </div>
    </FooterFrame>
  );
}

function PaletteChip({
  icon,
  label,
  primary = false,
}: {
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: "4px 8px",
        borderRadius: 6,
        background: primary
          ? "rgba(255,120,0,0.18)"
          : "rgba(0,159,239,0.10)",
        border: primary
          ? "1px solid rgba(255,120,0,0.5)"
          : "1px solid rgba(0,159,239,0.28)",
        color: primary ? NEX.orange : NEX.cyan,
        fontFamily:
          "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
        fontSize: 10,
        cursor: "pointer",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

// -----------------------------------------------------------------------------
// Shared primitives
// -----------------------------------------------------------------------------

function RoundGlassBtn({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: "rgba(4,20,36,0.7)",
        border: `1px solid ${NEX.cyanSoft}`,
        color: NEX.text,
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function CircleSend() {
  return (
    <button
      type="button"
      style={{
        width: 48,
        height: 48,
        borderRadius: "50%",
        background: "linear-gradient(135deg,#008CFF,#4657FF,#FF7A00)",
        color: NEX.text,
        border: "none",
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        flexShrink: 0,
        boxShadow: "0 8px 22px rgba(0,120,255,0.35)",
      }}
    >
      <SendIcon size={20} />
    </button>
  );
}

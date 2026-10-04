// src/app/nex-native/prototypes/call-center/page.tsx
//
// Prototype page · six glass-style directions for the NEX Call
// Center. Every direction is a glass variation · the shape of the
// frosted panels, the rim treatment, and the depth cues vary, but
// all six use ONLY the NEX brand palette:
//
//   · navy       #020914  (page canvas, same as Create Account)
//   · orange     #FF7200  (NEX accent · deep)
//   · cyan       #00AFFF  (NEX accent · electric)
//   · text       #F2F5F8
//   · textDim    #7D9BC0  (NEX cool blue-grey)
//   · darkRed    #991B1B  (destructive only)
//
// No invented tints, no pastel people-avatar colours, no stray
// mustards or purples. Icons stay emoji in the prototype so the
// focus is on the container language.

import type * as React from "react";

export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  text: "#F2F5F8",
  textDim: "#7D9BC0",
  textMuted: "#4B6683",
  orange: "#FF7200",
  orangeSoft: "rgba(255,114,0,0.14)",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.14)",
  cyanFaint: "rgba(0,175,255,0.06)",
  darkRed: "#991B1B",
};

const PEOPLE = [
  { name: "Maria",   job: "Baker"    },
  { name: "Diego",   job: "Welder"   },
  { name: "Lia",     job: "Barista"  },
  { name: "Omar",    job: "Mechanic" },
  { name: "Ana",     job: "Designer" },
  { name: "Kenji",   job: "Chef"     },
];

const RECENTS = [
  { who: "Maria Santos", when: "2m ago", kind: "Voice", outcome: "incoming"  },
  { who: "Diego Flores", when: "today",  kind: "Video", outcome: "outgoing"  },
  { who: "Lia Nguyen",   when: "today",  kind: "Voice", outcome: "missed"    },
  { who: "Ana Vargas",   when: "yday",   kind: "Video", outcome: "completed" },
];

export default function CallCenterPrototypes(): React.JSX.Element {
  return (
    <>
      <style>{`
        html, body { background: ${NEX.bg} !important; }
      `}</style>
      <main
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.text,
          padding: "calc(env(safe-area-inset-top, 0) + 20px) 20px 48px",
          position: "relative",
          overflow: "hidden",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute", inset: 0,
            background:
              "radial-gradient(60% 40% at 50% 0%, rgba(0,175,255,0.09), transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 460, margin: "0 auto" }}>
          <TopBar />
          <PrototypeSection index={1} name="Glass · Rim Gradient"
            tagline="Frosted panels · 2px orange→cyan rim · the chosen button style scaled up"
            render={<GlassRimGradient />} />
          <PrototypeSection index={2} name="Glass · Hairline"
            tagline="Minimal glass · single 1px cyan hairline · orange only on primary action"
            render={<GlassHairline />} />
          <PrototypeSection index={3} name="Glass · Layered"
            tagline="Glass inside glass · nested panels at two depths · orange hero"
            render={<GlassLayered />} />
          <PrototypeSection index={4} name="Glass · Floating"
            tagline="Heavy glow glass · twin orange+cyan drop shadows · lifted off canvas"
            render={<GlassFloating />} />
          <PrototypeSection index={5} name="Glass · Pane"
            tagline="One big glass pane · internal dividers only · section headers in orange"
            render={<GlassPane />} />
          <PrototypeSection index={6} name="Glass · Edge Light"
            tagline="Dark glass · top edge lit cyan, bottom lit orange · subtle horizon feel"
            render={<GlassEdgeLight />} />
        </div>
      </main>
    </>
  );
}

function TopBar(): React.JSX.Element {
  return (
    <header style={{ textAlign: "center", marginBottom: 32 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.3em", color: NEX.textDim, fontWeight: 600 }}>
        NEX · CALL CENTER PROTOTYPES
      </div>
      <h1 style={{ margin: "8px 0 4px", fontSize: 22, fontWeight: 700 }}>Six glass directions</h1>
      <p style={{ margin: 0, fontSize: 13, color: NEX.textDim, lineHeight: 1.5 }}>
        All glass · all NEX brand palette. Pick the rim and depth language.
      </p>
    </header>
  );
}

function PrototypeSection({
  index, name, tagline, render,
}: { index: number; name: string; tagline: string; render: React.ReactNode }): React.JSX.Element {
  return (
    <section style={{ marginBottom: 36 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: NEX.orange, letterSpacing: "0.12em" }}>0{index}</span>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{name}</h2>
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 12, color: NEX.textDim, lineHeight: 1.4 }}>{tagline}</p>
      <div style={{ padding: 14, borderRadius: 20, background: "rgba(0,175,255,0.015)", border: `1px solid ${NEX.cyanFaint}` }}>
        {render}
      </div>
    </section>
  );
}

/* ═════════════════════════════════════════════════════════════════ *
 * Shared helpers · the ONE place avatar + icon chrome lives so the   *
 * six variants only differ in container treatment, not content.      *
 * ═════════════════════════════════════════════════════════════════ */

function Initial({ name, size = 44 }: { name: string; size?: number }): React.JSX.Element {
  // Brand-palette only · no pastel avatars. Alternates orange/cyan
  // fills so the people row still reads at a glance without inventing
  // random colours per person.
  const idx = name.charCodeAt(0) % 2;
  const color = idx === 0 ? NEX.orange : NEX.cyan;
  return (
    <div
      aria-hidden
      style={{
        width: size, height: size, borderRadius: "50%",
        background: `${color}22`,
        border: `1px solid ${color}66`,
        color: color,
        display: "grid", placeItems: "center",
        fontSize: Math.round(size * 0.36), fontWeight: 700,
      }}
    >
      {name[0]}
    </div>
  );
}

function OutcomeColor(outcome: string): string {
  if (outcome === "missed") return NEX.darkRed;
  if (outcome === "incoming") return NEX.cyan;
  if (outcome === "outgoing") return NEX.orange;
  return NEX.textDim;
}

/* ═════════════════════════════════════════════════════════════════ *
 * 01 · GLASS · RIM GRADIENT                                          *
 * ═════════════════════════════════════════════════════════════════ */

function GlassRimGradient(): React.JSX.Element {
  const rim = `linear-gradient(135deg, ${NEX.orange} 0%, ${NEX.cyan} 100%)`;
  const glass = "rgba(255,255,255,0.06)";
  const tile = (): React.CSSProperties => ({
    border: "2px solid transparent",
    background: `${glass} padding-box, ${rim} border-box`,
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    borderRadius: 18,
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.14), 0 10px 24px rgba(0,0,0,0.4), 0 0 20px rgba(255,114,0,0.1), 0 0 24px rgba(0,175,255,0.1)",
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ ...tile(), padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: "0.18em", color: NEX.textDim }}>NEX · CALL CENTER</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>Hello Philip</div>
        </div>
        <span style={{ fontSize: 11, color: NEX.cyan, fontWeight: 600 }}>● Online</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[{ k: "Voice call", s: "Talk" }, { k: "Video call", s: "Face to face" }].map((c) => (
          <div key={c.k} style={{ ...tile(), padding: "16px 14px" }}>
            <div style={{ fontSize: 11, color: NEX.textDim, letterSpacing: "0.12em" }}>{c.k.toUpperCase()}</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 8 }}>Start →</div>
            <div style={{ fontSize: 11, color: NEX.textDim, marginTop: 4 }}>{c.s}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {["Group", "Link", "Invite"].map((q) => (
          <div key={q} style={{ ...tile(), padding: "10px 8px", textAlign: "center", fontSize: 12 }}>{q}</div>
        ))}
      </div>
      <PeopleRow tileStyle={tile()} />
      <RecentsBlock tileStyle={tile()} />
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════ *
 * 02 · GLASS · HAIRLINE                                              *
 * ═════════════════════════════════════════════════════════════════ */

function GlassHairline(): React.JSX.Element {
  const tile = (): React.CSSProperties => ({
    background: "rgba(255,255,255,0.03)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    border: `1px solid ${NEX.cyan}2A`,
    borderRadius: 14,
    boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset",
  });
  const primary = (): React.CSSProperties => ({
    ...tile(),
    border: `1px solid ${NEX.orange}66`,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 0 24px ${NEX.orangeSoft}`,
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ ...tile(), padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Call Center</div>
        <span style={{ fontSize: 11, color: NEX.textDim }}>7 contacts</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ ...primary(), padding: "16px 14px" }}>
          <div style={{ fontSize: 10, color: NEX.orange, letterSpacing: "0.14em", fontWeight: 700 }}>VOICE</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 8 }}>Start a call</div>
        </div>
        <div style={{ ...tile(), padding: "16px 14px" }}>
          <div style={{ fontSize: 10, color: NEX.cyan, letterSpacing: "0.14em", fontWeight: 700 }}>VIDEO</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 8 }}>Face to face</div>
        </div>
      </div>
      <div style={{ ...tile(), padding: "10px 14px", display: "flex", justifyContent: "space-around" }}>
        {["Group", "Link", "Invite"].map((q) => (
          <span key={q} style={{ fontSize: 12, color: NEX.text }}>{q}</span>
        ))}
      </div>
      <PeopleRow tileStyle={tile()} />
      <RecentsBlock tileStyle={tile()} />
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════ *
 * 03 · GLASS · LAYERED (glass inside glass)                          *
 * ═════════════════════════════════════════════════════════════════ */

function GlassLayered(): React.JSX.Element {
  const outer: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: `1px solid ${NEX.cyan}33`,
    borderRadius: 22,
    padding: 10,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 24px rgba(0,0,0,0.35)",
  };
  const inner: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    border: `1px solid ${NEX.cyan}22`,
    borderRadius: 14,
    padding: "12px 12px",
  };
  const hero: React.CSSProperties = {
    background: `linear-gradient(135deg, ${NEX.orange}22, ${NEX.cyan}22)`,
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: `1px solid ${NEX.orange}44`,
    borderRadius: 18,
    padding: "18px 16px",
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.1), 0 0 30px ${NEX.orangeSoft}`,
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={hero}>
        <div style={{ fontSize: 10, letterSpacing: "0.2em", color: NEX.orange, fontWeight: 700 }}>CALL CENTER</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>Who are you calling?</div>
        <div style={{ fontSize: 12, color: NEX.textDim, marginTop: 2 }}>Pick someone or start a group</div>
      </div>
      <div style={outer}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={inner}>
            <div style={{ fontSize: 11, color: NEX.textDim }}>Voice</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>Call</div>
          </div>
          <div style={inner}>
            <div style={{ fontSize: 11, color: NEX.textDim }}>Video</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>Call</div>
          </div>
        </div>
      </div>
      <div style={outer}>
        <div style={{ display: "flex", justifyContent: "space-around" }}>
          {["Group", "Link", "Invite"].map((q) => (
            <span key={q} style={{ fontSize: 12, padding: "6px 10px" }}>{q}</span>
          ))}
        </div>
      </div>
      <PeopleRow tileStyle={outer} innerStyle={inner} />
      <RecentsBlock tileStyle={outer} innerStyle={inner} />
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════ *
 * 04 · GLASS · FLOATING (twin orange+cyan glow)                      *
 * ═════════════════════════════════════════════════════════════════ */

function GlassFloating(): React.JSX.Element {
  const tile = (hero?: boolean): React.CSSProperties => ({
    background: "rgba(255,255,255,0.05)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: `1px solid rgba(255,255,255,0.08)`,
    borderRadius: 20,
    boxShadow: hero
      ? `0 20px 50px rgba(0,0,0,0.5), 0 0 36px ${NEX.orangeSoft}, 0 0 60px ${NEX.cyanSoft}, inset 0 1px 0 rgba(255,255,255,0.14)`
      : `0 10px 24px rgba(0,0,0,0.4), 0 0 22px ${NEX.cyanSoft}, inset 0 1px 0 rgba(255,255,255,0.1)`,
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ ...tile(true), padding: "16px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.2em", color: NEX.textDim }}>LIVE</div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Call Center</div>
        </div>
        <div style={{ fontSize: 11, color: NEX.cyan, fontWeight: 600 }}>● 7 online</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[
          { k: "VOICE", s: "Audio only", tint: NEX.orange },
          { k: "VIDEO", s: "See them",   tint: NEX.cyan },
        ].map((c) => (
          <div key={c.k} style={{ ...tile(true), padding: "18px 14px" }}>
            <div style={{ fontSize: 10, color: c.tint, letterSpacing: "0.16em", fontWeight: 700 }}>{c.k}</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 10 }}>Start</div>
            <div style={{ fontSize: 11, color: NEX.textDim, marginTop: 2 }}>{c.s}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {["Group", "Link", "Invite"].map((q) => (
          <div key={q} style={{ ...tile(), padding: "12px 8px", textAlign: "center", fontSize: 12 }}>{q}</div>
        ))}
      </div>
      <PeopleRow tileStyle={tile()} />
      <RecentsBlock tileStyle={tile()} />
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════ *
 * 05 · GLASS · PANE (one big container, internal dividers)           *
 * ═════════════════════════════════════════════════════════════════ */

function GlassPane(): React.JSX.Element {
  const pane: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    border: `1px solid ${NEX.cyan}2A`,
    borderRadius: 22,
    overflow: "hidden",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 14px 30px rgba(0,0,0,0.45)",
  };
  const divider: React.CSSProperties = { height: 1, background: `linear-gradient(90deg, transparent, ${NEX.cyan}22, transparent)` };
  const sectionHeader = (label: string): React.ReactNode => (
    <div style={{ padding: "10px 16px 2px", fontSize: 10, letterSpacing: "0.2em", color: NEX.orange, fontWeight: 700 }}>
      {label}
    </div>
  );
  return (
    <div style={pane}>
      <div style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Call Center</div>
        <span style={{ fontSize: 11, color: NEX.cyan }}>Online</span>
      </div>
      <div style={divider} />
      {sectionHeader("START A CALL")}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "8px 16px 14px" }}>
        <div style={{ padding: "12px", borderRadius: 12, border: `1px solid ${NEX.orange}44`, background: NEX.orangeSoft }}>
          <div style={{ fontSize: 11, color: NEX.orange, letterSpacing: "0.14em", fontWeight: 700 }}>VOICE</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>Call now</div>
        </div>
        <div style={{ padding: "12px", borderRadius: 12, border: `1px solid ${NEX.cyan}44`, background: NEX.cyanSoft }}>
          <div style={{ fontSize: 11, color: NEX.cyan, letterSpacing: "0.14em", fontWeight: 700 }}>VIDEO</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>Call now</div>
        </div>
      </div>
      <div style={divider} />
      <div style={{ display: "flex", justifyContent: "space-around", padding: "10px 16px" }}>
        {["Group", "Link", "Invite"].map((q) => (
          <span key={q} style={{ fontSize: 12 }}>{q}</span>
        ))}
      </div>
      <div style={divider} />
      {sectionHeader("PEOPLE")}
      <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "6px 16px 14px" }}>
        {PEOPLE.map((p) => (
          <div key={p.name} style={{ flex: "none", textAlign: "center" }}>
            <Initial name={p.name} />
            <div style={{ fontSize: 10, color: NEX.textDim, marginTop: 4 }}>{p.name}</div>
          </div>
        ))}
      </div>
      <div style={divider} />
      {sectionHeader("RECENT")}
      <div style={{ padding: "6px 16px 14px" }}>
        {RECENTS.map((r) => (
          <div key={r.who} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 12 }}>
            <span>{r.who}</span>
            <span style={{ fontSize: 11, color: OutcomeColor(r.outcome) }}>{r.outcome} · {r.when}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════ *
 * 06 · GLASS · EDGE LIGHT (top cyan, bottom orange horizon)          *
 * ═════════════════════════════════════════════════════════════════ */

function GlassEdgeLight(): React.JSX.Element {
  const tile = (): React.CSSProperties => ({
    position: "relative",
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 18,
    overflow: "hidden",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 24px rgba(0,0,0,0.4)",
  });
  const edgeDecor = (): React.ReactNode => (
    <>
      <span aria-hidden style={{ position: "absolute", top: 0, left: "10%", right: "10%", height: 1, background: `linear-gradient(90deg, transparent, ${NEX.cyan}, transparent)`, boxShadow: `0 0 10px ${NEX.cyan}` }} />
      <span aria-hidden style={{ position: "absolute", bottom: 0, left: "10%", right: "10%", height: 1, background: `linear-gradient(90deg, transparent, ${NEX.orange}, transparent)`, boxShadow: `0 0 10px ${NEX.orange}` }} />
    </>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ ...tile(), padding: "14px 16px" }}>
        {edgeDecor()}
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.22em", color: NEX.textDim }}>CALL CENTER</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginTop: 4 }}>Hello Philip</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[{ k: "VOICE", s: "Call now" }, { k: "VIDEO", s: "Face to face" }].map((c) => (
          <div key={c.k} style={{ ...tile(), padding: "16px 14px" }}>
            {edgeDecor()}
            <div style={{ position: "relative" }}>
              <div style={{ fontSize: 10, color: NEX.orange, letterSpacing: "0.14em", fontWeight: 700 }}>{c.k}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 8 }}>{c.s}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {["Group", "Link", "Invite"].map((q) => (
          <div key={q} style={{ ...tile(), padding: "10px 8px", textAlign: "center", fontSize: 12 }}>
            {edgeDecor()}
            <span style={{ position: "relative" }}>{q}</span>
          </div>
        ))}
      </div>
      <div style={{ ...tile(), padding: "12px 14px" }}>
        {edgeDecor()}
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.2em", color: NEX.textDim, marginBottom: 8 }}>PEOPLE</div>
          <div style={{ display: "flex", gap: 10, overflowX: "auto" }}>
            {PEOPLE.map((p) => (
              <div key={p.name} style={{ flex: "none", textAlign: "center" }}>
                <Initial name={p.name} />
                <div style={{ fontSize: 10, color: NEX.textDim, marginTop: 4 }}>{p.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ ...tile(), padding: "12px 14px" }}>
        {edgeDecor()}
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.2em", color: NEX.textDim, marginBottom: 8 }}>RECENT</div>
          {RECENTS.map((r) => (
            <div key={r.who} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12 }}>
              <span>{r.who}</span>
              <span style={{ fontSize: 11, color: OutcomeColor(r.outcome) }}>{r.outcome} · {r.when}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════ *
 * Shared · People row + Recents block                                *
 * ═════════════════════════════════════════════════════════════════ */

function PeopleRow({
  tileStyle,
  innerStyle,
}: {
  tileStyle: React.CSSProperties;
  innerStyle?: React.CSSProperties;
}): React.JSX.Element {
  return (
    <div style={{ ...tileStyle, padding: "12px 14px" }}>
      <div style={{ fontSize: 10, letterSpacing: "0.2em", color: NEX.textDim, marginBottom: 8 }}>PEOPLE</div>
      <div style={{ ...(innerStyle ?? {}), display: "flex", gap: 10, overflowX: "auto", padding: innerStyle ? 10 : 0 }}>
        {PEOPLE.map((p) => (
          <div key={p.name} style={{ flex: "none", textAlign: "center" }}>
            <Initial name={p.name} />
            <div style={{ fontSize: 10, color: NEX.textDim, marginTop: 4 }}>{p.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentsBlock({
  tileStyle,
  innerStyle,
}: {
  tileStyle: React.CSSProperties;
  innerStyle?: React.CSSProperties;
}): React.JSX.Element {
  return (
    <div style={{ ...tileStyle, padding: "12px 14px" }}>
      <div style={{ fontSize: 10, letterSpacing: "0.2em", color: NEX.textDim, marginBottom: 8 }}>RECENT</div>
      <div style={innerStyle ?? {}}>
        {RECENTS.map((r) => (
          <div key={r.who} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 12, borderBottom: `1px solid ${NEX.cyanFaint}` }}>
            <span>{r.who}</span>
            <span style={{ fontSize: 11, color: OutcomeColor(r.outcome) }}>{r.outcome} · {r.when}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

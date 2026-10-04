// src/app/nex-native/prototypes/call-center/page.tsx
//
// Prototype page · six distinct full-page directions for the NEX
// Call Center. Each section renders the same content (header,
// voice/video, quick actions, people, recents) in a different
// visual language so the founder can pick a direction.
//
// Read-only · no behaviour, no data fetching.

import type * as React from "react";

export const dynamic = "force-dynamic";

const PAL = {
  bg: "#020914",
  glow: "rgba(0,175,255,0.09)",
  text: "#F2F5FA",
  textDim: "#A6ADC2",
  textMuted: "#6B7490",
  orange: "#FF9933",
  orangeDeep: "#FF7200",
  cyan: "#4C8DF2",
  cyanBright: "#00AFFF",
  darkRed: "#991B1B",
  green: "#22C55E",
};

const PEOPLE = [
  { name: "Maria",   job: "Baker",      color: "#FFB07A" },
  { name: "Diego",   job: "Welder",     color: "#9CC3FF" },
  { name: "Lia",     job: "Barista",    color: "#C7E89B" },
  { name: "Omar",    job: "Mechanic",   color: "#FFD591" },
  { name: "Ana",     job: "Designer",   color: "#E8B4FF" },
  { name: "Kenji",   job: "Chef",       color: "#FF9DAD" },
];

const RECENTS = [
  { who: "Maria Santos", when: "2m ago", kind: "voice", outcome: "incoming" },
  { who: "Diego Flores", when: "today",  kind: "video", outcome: "outgoing" },
  { who: "Lia Nguyen",   when: "today",  kind: "voice", outcome: "missed" },
  { who: "Ana Vargas",   when: "yday",   kind: "video", outcome: "completed" },
];

export default function CallCenterPrototypes(): React.JSX.Element {
  return (
    <>
      <style>{`
        html, body { background: ${PAL.bg} !important; }
      `}</style>
      <main
        style={{
          minHeight: "100dvh",
          background: PAL.bg,
          color: PAL.text,
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
          <PrototypeSection index={1} name="Glass Deck"      tagline="Frosted panels · orange→cyan rims · Vision Pro feel"       render={<GlassDeck />} />
          <PrototypeSection index={2} name="Neo-Brutalist"   tagline="Hard edges · bold borders · zero shadow · offset accents" render={<NeoBrutalist />} />
          <PrototypeSection index={3} name="Terminal Mono"   tagline="Mono type · data-dense · cyan status dots · dev-tool"      render={<TerminalMono />} />
          <PrototypeSection index={4} name="Bento"           tagline="Asymmetric grid · mixed-size tiles · playful proportions"  render={<Bento />} />
          <PrototypeSection index={5} name="Orbit"           tagline="NEX wordmark hero · actions orbit · people as rings"       render={<Orbit />} />
          <PrototypeSection index={6} name="Timeline"        tagline="Chronological thread · sticky actions · minimal chrome"    render={<Timeline />} />
        </div>
      </main>
    </>
  );
}

function TopBar(): React.JSX.Element {
  return (
    <header style={{ textAlign: "center", marginBottom: 32 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.3em", color: PAL.textDim, fontWeight: 600 }}>
        NEX · CALL CENTER PROTOTYPES
      </div>
      <h1 style={{ margin: "8px 0 4px", fontSize: 22, fontWeight: 700 }}>Six directions</h1>
      <p style={{ margin: 0, fontSize: 13, color: PAL.textDim, lineHeight: 1.5 }}>
        Same content, six visual languages. Pick the direction and I'll wire it.
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
        <span style={{ fontSize: 11, fontWeight: 700, color: PAL.orange, letterSpacing: "0.12em" }}>0{index}</span>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{name}</h2>
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 12, color: PAL.textDim, lineHeight: 1.4 }}>{tagline}</p>
      <div style={{ padding: 14, borderRadius: 18, background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)" }}>
        {render}
      </div>
    </section>
  );
}

/* ═════════════════════════════════════════════════════════════════ *
 * 01 · GLASS DECK — frosted panels, orange→cyan rims                 *
 * ═════════════════════════════════════════════════════════════════ */

function GlassDeck(): React.JSX.Element {
  const rim = `linear-gradient(135deg, ${PAL.orange} 0%, ${PAL.cyanBright} 100%)`;
  const glass = "rgba(255,255,255,0.06)";
  const glassTile = (): React.CSSProperties => ({
    border: "2px solid transparent",
    background: `${glass} padding-box, ${rim} border-box`,
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    borderRadius: 18,
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.14), 0 10px 24px rgba(0,0,0,0.4), 0 0 20px rgba(255,153,51,0.12), 0 0 24px rgba(0,175,255,0.12)",
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ ...glassTile(), padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: "0.18em", color: PAL.textDim }}>NEX · CALL CENTER</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>Hello Philip</div>
        </div>
        <div style={{ ...glassTile(), padding: "6px 10px", fontSize: 11, fontWeight: 600, color: PAL.cyanBright }}>● Online</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          { kind: "Voice call", sub: "Talk with someone", icon: "📞", tint: PAL.green },
          { kind: "Video call", sub: "Face to face",      icon: "🎥", tint: PAL.cyanBright },
        ].map((c) => (
          <div key={c.kind} style={{ ...glassTile(), padding: "16px 14px" }}>
            <div style={{ fontSize: 24 }}>{c.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 10 }}>{c.kind}</div>
            <div style={{ fontSize: 11, color: PAL.textDim }}>{c.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {["Group", "Link", "Invite"].map((q) => (
          <div key={q} style={{ ...glassTile(), padding: "10px 8px", textAlign: "center", fontSize: 12, color: PAL.text }}>
            {q}
          </div>
        ))}
      </div>
      <div style={{ ...glassTile(), padding: "12px 14px" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.14em", color: PAL.textDim, marginBottom: 8 }}>PEOPLE</div>
        <div style={{ display: "flex", gap: 10, overflowX: "auto" }}>
          {PEOPLE.map((p) => (
            <div key={p.name} style={{ textAlign: "center", flex: "none" }}>
              <div style={{ width: 44, height: 44, borderRadius: 999, background: p.color, border: `2px solid ${PAL.orange}44` }} />
              <div style={{ fontSize: 10, color: PAL.textDim, marginTop: 4 }}>{p.name}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ ...glassTile(), padding: "12px 14px" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.14em", color: PAL.textDim, marginBottom: 8 }}>RECENT</div>
        {RECENTS.map((r) => (
          <div key={r.who} style={{ display: "flex", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 12 }}>
            <span style={{ flex: 1 }}>{r.who}</span>
            <span style={{ color: r.outcome === "missed" ? PAL.darkRed : PAL.textDim, fontSize: 11 }}>{r.outcome} · {r.when}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════ *
 * 02 · NEO-BRUTALIST — flat dark, chunky borders, hard edges         *
 * ═════════════════════════════════════════════════════════════════ */

function NeoBrutalist(): React.JSX.Element {
  const brutalTile: React.CSSProperties = {
    background: "#0A1230",
    border: `3px solid ${PAL.orange}`,
    boxShadow: `6px 6px 0 0 ${PAL.cyanBright}`,
    padding: "16px 14px",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ ...brutalTile, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: "0.04em" }}>CALL CENTER</div>
        <div style={{ fontSize: 11, fontWeight: 800, color: PAL.cyanBright, letterSpacing: "0.1em" }}>LIVE</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ ...brutalTile, background: PAL.orange, color: "#000", borderColor: "#000", boxShadow: `6px 6px 0 0 #000` }}>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.14em" }}>VOICE</div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>CALL</div>
        </div>
        <div style={{ ...brutalTile, background: PAL.cyanBright, color: "#000", borderColor: "#000", boxShadow: `6px 6px 0 0 #000` }}>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.14em" }}>VIDEO</div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>CALL</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {["GROUP", "LINK", "INVITE"].map((q, i) => (
          <div key={q} style={{ ...brutalTile, textAlign: "center", padding: "12px 6px", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em",
            background: i === 1 ? PAL.cyanBright : "transparent", color: i === 1 ? "#000" : PAL.text }}>
            {q}
          </div>
        ))}
      </div>
      <div style={{ ...brutalTile }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.18em", color: PAL.orange, marginBottom: 10 }}>→ PEOPLE</div>
        <div style={{ display: "flex", gap: 10, overflowX: "auto" }}>
          {PEOPLE.map((p) => (
            <div key={p.name} style={{ flex: "none", textAlign: "center" }}>
              <div style={{ width: 48, height: 48, background: p.color, border: "3px solid #000" }} />
              <div style={{ fontSize: 10, fontWeight: 800, marginTop: 4, letterSpacing: "0.06em" }}>{p.name.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ ...brutalTile }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.18em", color: PAL.orange, marginBottom: 10 }}>→ RECENT</div>
        {RECENTS.map((r) => (
          <div key={r.who} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `2px solid ${PAL.text}11`, fontSize: 12 }}>
            <span style={{ fontWeight: 700 }}>{r.who.toUpperCase()}</span>
            <span style={{ color: r.outcome === "missed" ? PAL.darkRed : PAL.cyanBright, fontWeight: 700, letterSpacing: "0.1em", fontSize: 10 }}>
              {r.outcome.toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════ *
 * 03 · TERMINAL MONO — dev-tool, data-dense, mono                    *
 * ═════════════════════════════════════════════════════════════════ */

function TerminalMono(): React.JSX.Element {
  const mono: React.CSSProperties = {
    fontFamily: "ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace",
  };
  return (
    <div style={{ ...mono, display: "flex", flexDirection: "column", gap: 10, fontSize: 12, color: PAL.text }}>
      <div style={{ padding: "10px 12px", border: `1px solid ${PAL.cyanBright}44`, background: "rgba(0,175,255,0.04)" }}>
        <span style={{ color: PAL.green }}>●</span> <span style={{ color: PAL.textDim }}>nex@call-center</span>
        <span style={{ color: PAL.textMuted }}> ~ </span>
        <span style={{ color: PAL.cyanBright }}>$</span> status
        <div style={{ marginTop: 6, color: PAL.textDim, fontSize: 11 }}>
          <div>• ONLINE  7 friends  2 in-call</div>
          <div>• 12:47  Philip Farrell</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[
          { cmd: "call --voice", desc: "start voice" },
          { cmd: "call --video", desc: "start video" },
        ].map((c) => (
          <div key={c.cmd} style={{ padding: "12px 10px", border: `1px solid ${PAL.orange}66`, background: "rgba(255,153,51,0.04)" }}>
            <div style={{ color: PAL.orange, fontWeight: 700 }}>{c.cmd}</div>
            <div style={{ color: PAL.textDim, fontSize: 10, marginTop: 4 }}>{c.desc}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: "10px 12px", border: `1px solid ${PAL.text}22` }}>
        <div style={{ color: PAL.textDim, fontSize: 11 }}>
          <span style={{ color: PAL.cyanBright }}>&gt;</span> group --max=4
          {"  "}
          <span style={{ color: PAL.cyanBright }}>&gt;</span> link --ttl=24h
          {"  "}
          <span style={{ color: PAL.cyanBright }}>&gt;</span> invite
        </div>
      </div>
      <div style={{ padding: "10px 12px", border: `1px solid ${PAL.text}22` }}>
        <div style={{ color: PAL.textMuted, fontSize: 10, marginBottom: 6 }}>PEOPLE (7)</div>
        {PEOPLE.map((p) => (
          <div key={p.name} style={{ display: "flex", justifyContent: "space-between", color: PAL.textDim, fontSize: 11, padding: "2px 0" }}>
            <span><span style={{ color: PAL.green }}>●</span> {p.name.padEnd(10)} {p.job}</span>
            <span style={{ color: PAL.textMuted }}>idle</span>
          </div>
        ))}
      </div>
      <div style={{ padding: "10px 12px", border: `1px solid ${PAL.text}22` }}>
        <div style={{ color: PAL.textMuted, fontSize: 10, marginBottom: 6 }}>LOG · tail -n 4</div>
        {RECENTS.map((r, i) => (
          <div key={r.who} style={{ color: PAL.textDim, fontSize: 11, padding: "2px 0" }}>
            <span style={{ color: PAL.textMuted }}>{String(i).padStart(2, "0")}:</span>{" "}
            <span style={{ color: r.outcome === "missed" ? PAL.darkRed : PAL.cyanBright }}>{r.outcome.padEnd(9)}</span>{" "}
            <span>{r.who}</span>{" "}
            <span style={{ color: PAL.textMuted }}>({r.when})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════ *
 * 04 · BENTO — asymmetric grid, mixed-size tiles                     *
 * ═════════════════════════════════════════════════════════════════ */

function Bento(): React.JSX.Element {
  const tile: React.CSSProperties = {
    background: "#0A1230",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 18,
    padding: 14,
    boxShadow: "0 10px 24px rgba(0,0,0,0.3)",
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gridAutoRows: "min-content", gap: 10 }}>
      {/* Big voice tile · spans the first row left */}
      <div style={{ ...tile, background: `linear-gradient(135deg, ${PAL.orange}, ${PAL.orangeDeep})`, color: "#1a0d00", gridRow: "span 2" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em" }}>VOICE</div>
        <div style={{ fontSize: 32, fontWeight: 900, marginTop: 20 }}>Call now</div>
        <div style={{ fontSize: 13, marginTop: 6, opacity: 0.75 }}>Pick anyone from your 7 friends</div>
        <div style={{ marginTop: 42, fontSize: 24 }}>📞 →</div>
      </div>
      {/* Video tile */}
      <div style={{ ...tile, background: `linear-gradient(135deg, ${PAL.cyan}, ${PAL.cyanBright})`, color: "#001828" }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em" }}>VIDEO</div>
        <div style={{ fontSize: 18, fontWeight: 900, marginTop: 8 }}>Face to face</div>
        <div style={{ fontSize: 20, marginTop: 10 }}>🎥</div>
      </div>
      {/* Group */}
      <div style={{ ...tile, textAlign: "center" }}>
        <div style={{ fontSize: 22 }}>👥</div>
        <div style={{ fontSize: 11, color: PAL.textDim, marginTop: 6 }}>Group</div>
      </div>
      {/* People strip (full width) */}
      <div style={{ ...tile, gridColumn: "span 2" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.14em", color: PAL.textDim, marginBottom: 8 }}>PEOPLE</div>
        <div style={{ display: "flex", gap: 10, overflowX: "auto" }}>
          {PEOPLE.map((p) => (
            <div key={p.name} style={{ textAlign: "center", flex: "none" }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: p.color }} />
              <div style={{ fontSize: 10, color: PAL.textDim, marginTop: 4 }}>{p.name}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Link + Invite side by side */}
      <div style={{ ...tile, textAlign: "center" }}>
        <div style={{ fontSize: 22 }}>🔗</div>
        <div style={{ fontSize: 11, color: PAL.textDim, marginTop: 6 }}>Link</div>
      </div>
      <div style={{ ...tile, textAlign: "center" }}>
        <div style={{ fontSize: 22 }}>➕</div>
        <div style={{ fontSize: 11, color: PAL.textDim, marginTop: 6 }}>Invite</div>
      </div>
      {/* Recents · full width */}
      <div style={{ ...tile, gridColumn: "span 2" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.14em", color: PAL.textDim, marginBottom: 8 }}>RECENT</div>
        {RECENTS.map((r) => (
          <div key={r.who} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12 }}>
            <span>{r.who}</span>
            <span style={{ color: r.outcome === "missed" ? PAL.darkRed : PAL.textDim, fontSize: 11 }}>
              {r.outcome} · {r.when}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════ *
 * 05 · ORBIT — NEX wordmark hero, actions orbit, people as rings     *
 * ═════════════════════════════════════════════════════════════════ */

function Orbit(): React.JSX.Element {
  return (
    <div>
      <div style={{ position: "relative", height: 320, display: "grid", placeItems: "center" }}>
        {/* Rings */}
        {[220, 160, 100].map((d, i) => (
          <div key={d} aria-hidden style={{
            position: "absolute", width: d, height: d, borderRadius: "50%",
            border: `1px solid rgba(0,175,255,${0.1 + i * 0.05})`,
          }} />
        ))}
        {/* Core: NEX wordmark */}
        <div style={{ zIndex: 2, textAlign: "center" }}>
          <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: "0.14em" }}>
            <span style={{ color: PAL.text }}>NE</span>
            <span style={{ color: PAL.orange }}>X</span>
          </div>
          <div style={{ fontSize: 9, letterSpacing: "0.3em", color: PAL.textDim, marginTop: 4 }}>CALL CENTER</div>
        </div>
        {/* Orbit nodes · 4 action buttons positioned on the middle ring */}
        {[
          { pos: { top: "28%", left: "50%" }, icon: "📞", label: "Voice" },
          { pos: { top: "50%", right: "20%" }, icon: "🎥", label: "Video" },
          { pos: { bottom: "28%", left: "50%" }, icon: "👥", label: "Group" },
          { pos: { top: "50%", left: "20%" }, icon: "🔗", label: "Link" },
        ].map((n) => (
          <div key={n.label} style={{
            position: "absolute", ...n.pos, transform: "translate(-50%, -50%)", textAlign: "center",
          }}>
            <div style={{
              width: 54, height: 54, borderRadius: "50%",
              background: "rgba(255,255,255,0.06)",
              border: `2px solid ${PAL.orange}`,
              boxShadow: `0 0 18px rgba(255,153,51,0.3)`,
              display: "grid", placeItems: "center", fontSize: 20,
              backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
            }}>
              {n.icon}
            </div>
            <div style={{ fontSize: 10, color: PAL.textDim, marginTop: 4 }}>{n.label}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 12, justifyContent: "center" }}>
        {PEOPLE.slice(0, 5).map((p) => (
          <div key={p.name} style={{ textAlign: "center" }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%", background: p.color,
              boxShadow: `0 0 0 2px ${PAL.bg}, 0 0 0 3px ${PAL.cyanBright}66`,
            }} />
            <div style={{ fontSize: 9, color: PAL.textDim, marginTop: 3 }}>{p.name}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
        {RECENTS.map((r) => (
          <div key={r.who} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12 }}>
            <span>{r.who}</span>
            <span style={{ color: r.outcome === "missed" ? PAL.darkRed : PAL.textDim, fontSize: 11 }}>
              {r.outcome} · {r.when}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════ *
 * 06 · TIMELINE — chronological thread, sticky actions, minimal      *
 * ═════════════════════════════════════════════════════════════════ */

function Timeline(): React.JSX.Element {
  const events = [
    ...RECENTS.map((r) => ({ ...r, type: "call" as const })),
    { who: "Group · 3 people", when: "2d ago", kind: "video" as const, outcome: "completed" as const, type: "group" as const },
  ];
  return (
    <div>
      {/* Sticky action strip */}
      <div style={{
        display: "flex", gap: 8, padding: "10px 0 14px",
        borderBottom: `1px solid ${PAL.text}11`, marginBottom: 14,
      }}>
        {[
          { icon: "📞", label: "Voice",  tint: PAL.orange },
          { icon: "🎥", label: "Video",  tint: PAL.cyanBright },
          { icon: "👥", label: "Group",  tint: PAL.text },
          { icon: "🔗", label: "Link",   tint: PAL.text },
        ].map((a) => (
          <button key={a.label} type="button" style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            padding: "10px 4px", borderRadius: 12,
            background: "transparent", border: `1px solid ${a.tint}33`,
            color: a.tint, fontSize: 10, fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
          }}>
            <span style={{ fontSize: 18 }}>{a.icon}</span>
            <span>{a.label}</span>
          </button>
        ))}
      </div>
      {/* Thread */}
      <div style={{ position: "relative", paddingLeft: 22 }}>
        <div aria-hidden style={{
          position: "absolute", left: 7, top: 0, bottom: 0, width: 1,
          background: `linear-gradient(180deg, ${PAL.orange}, ${PAL.cyanBright}, transparent)`,
        }} />
        {events.map((e, i) => {
          const tint = e.outcome === "missed" ? PAL.darkRed
            : e.outcome === "incoming" ? PAL.green
            : e.outcome === "outgoing" ? PAL.orange
            : PAL.cyanBright;
          return (
            <div key={i} style={{ position: "relative", marginBottom: 14 }}>
              <div aria-hidden style={{
                position: "absolute", left: -22, top: 4, width: 16, height: 16, borderRadius: "50%",
                background: PAL.bg, border: `2px solid ${tint}`,
                boxShadow: `0 0 10px ${tint}66`,
              }} />
              <div style={{ fontSize: 10, color: PAL.textMuted, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {e.when} · {e.kind}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{e.who}</div>
              <div style={{ fontSize: 11, color: tint, marginTop: 2, fontWeight: 500 }}>{e.outcome}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

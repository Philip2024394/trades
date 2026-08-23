// NEX Lab · Connection-Line prototype
//
// Isolated visual for tuning the connection-line + running-light physics
// per Philip 2026-08-21: "Prototype this as an isolated visual component
// first and tune the timing/physics before integrating it into the NEX
// chat." Not linked from anywhere in the main app — dev-only surface.
//
// Renders the real NexConnectionLine component in a container that
// mimics the /nexapp conversation frame, plus buttons to trigger each
// activity state so the physics can be judged without dragging the
// whole chat context along.
//
// URL: /nex-lab/connection-line

"use client";

import { useState, type CSSProperties } from "react";
import { NEX } from "@/lib/nexapp/tokens";
import {
  NexConnectionLine,
  type NexConnectionActivity,
} from "@/components/nexapp/NexConnectionLine";

type LogEntry = { ts: string; from: NexConnectionActivity; to: NexConnectionActivity };

export default function ConnectionLineLabPage() {
  const [activity, setActivity] = useState<NexConnectionActivity>("idle");
  const [log, setLog] = useState<LogEntry[]>([]);

  function setAndLog(next: NexConnectionActivity) {
    if (next === activity) return;
    const ts = new Date().toLocaleTimeString(undefined, { hour12: false });
    setLog((prev) => [{ ts, from: activity, to: next }, ...prev].slice(0, 12));
    setActivity(next);
  }

  return (
    <div style={rootStyle}>
      <div style={headerStyle}>
        <div style={kickerStyle}>NEX LAB</div>
        <div style={titleStyle}>Connection Line · running-light prototype</div>
        <div style={subtitleStyle}>
          Test the physics in isolation. Trigger each state, watch the border of the frame below.
          Component behaviour: 4-second decay tail after activity stops · organic accel/decel ·
          bidirectional · reduced-motion respected.
        </div>
      </div>

      {/* Mock conversation frame — same border + margin proportions as the
          real chat frame so the line/ember alignment matches production. */}
      <div style={frameStyle}>
        {/* NEX identity corner marker (top-left · dark with wordmark) */}
        <div style={{ ...cornerStyle, top: -14, left: -12, background: NEX.bgSurface }}>
          <div style={nexWordmarkStyle}><span>NE</span><span style={{ color: NEX.orange, marginLeft: 1 }}>X</span></div>
        </div>
        {/* PERSON identity corner marker (top-right · person initial in orange circle) */}
        <div style={{ ...cornerStyle, top: -14, right: -12 }}>
          <div style={personInitialStyle}>P</div>
        </div>

        <NexConnectionLine activity={activity} />

        <div style={frameContentStyle}>
          <div style={frameLabelStyle}>Current state: <span style={{ color: NEX.orange, fontWeight: 700 }}>{activity}</span></div>
          {activity === "idle" && (
            <div style={frameHintStyle}>
              Line is quiet · no running light. When activity begins the running light
              will start with organic acceleration.
            </div>
          )}
          {activity === "person-composing" && (
            <div style={frameHintStyle}>
              Person is composing · running light drifts from PERSON (right) toward NEX (left).
              Ember has a leading white edge with a hot orange trail behind it.
              A subtle background light sweep travels along the line at a different rate.
            </div>
          )}
          {activity === "nex-generating" && (
            <div style={frameHintStyle}>
              NEX is thinking / speaking · running light drifts from NEX (left) toward PERSON (right).
              Same energy language, opposite direction.
            </div>
          )}
        </div>
      </div>

      {/* Trigger controls */}
      <div style={controlsStyle}>
        <button type="button" onClick={() => setAndLog("idle")}            style={btn(activity === "idle")}            >Idle</button>
        <button type="button" onClick={() => setAndLog("person-composing")} style={btn(activity === "person-composing")}>Person composing →→→ NEX</button>
        <button type="button" onClick={() => setAndLog("nex-generating")}   style={btn(activity === "nex-generating")}  >NEX generating →→→ Person</button>
      </div>

      <div style={notesStyle}>
        <div style={notesTitleStyle}>Tuning constants (edit in NexConnectionLine.tsx to test)</div>
        <ul style={notesListStyle}>
          <li><code style={codeStyle}>DECAY_TAIL_MS</code> — currently 4000. Time running-light continues after activity stops.</li>
          <li><code style={codeStyle}>DECAY_FADE_MS</code> — currently 900. Length of the final fade at the tail end.</li>
          <li><code style={codeStyle}>EMBER_EASING</code> — currently <code style={codeStyle}>cubic-bezier(0.42, 0.05, 0.55, 0.98)</code>. Motion feel.</li>
          <li><code style={codeStyle}>duration / pause / trailOffset / linePulsePeriod</code> — per-mount jitter ranges in <code style={codeStyle}>jitterRef</code>.</li>
        </ul>
      </div>

      {/* Recent state-transition log */}
      {log.length > 0 && (
        <div style={logSectionStyle}>
          <div style={notesTitleStyle}>Transitions ({log.length})</div>
          <ol style={logListStyle}>
            {log.map((e, i) => (
              <li key={i} style={logItemStyle}>
                <span style={{ color: "rgba(255,255,255,0.4)" }}>{e.ts}</span> ·
                <span style={{ color: "rgba(255,255,255,0.6)" }}> {e.from}</span> →
                <span style={{ color: NEX.orange, fontWeight: 600 }}> {e.to}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#050505",
  color: NEX.text,
  padding: "32px 24px 48px",
  fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  display: "flex",
  flexDirection: "column",
  gap: 24,
  maxWidth: 720,
  margin: "0 auto",
};

const headerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};
const kickerStyle: CSSProperties = {
  color: NEX.orange,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 2.5,
};
const titleStyle: CSSProperties = {
  color: NEX.text,
  fontSize: 22,
  fontWeight: 600,
  letterSpacing: -0.3,
};
const subtitleStyle: CSSProperties = {
  color: "rgba(255,255,255,0.55)",
  fontSize: 13,
  lineHeight: 1.55,
  maxWidth: 620,
};

const frameStyle: CSSProperties = {
  position: "relative",
  marginTop: 12,
  padding: "36px 20px 24px",
  minHeight: 220,
  borderRadius: 24,
  border: `1px solid ${NEX.border}`,
  background: "linear-gradient(180deg, #0a0a0a 0%, #060606 100%)",
};
const cornerStyle: CSSProperties = {
  position: "absolute",
  width: 46,
  height: 46,
  borderRadius: "50%",
  background: "rgba(13, 13, 13, 0.9)",
  border: `1.5px solid ${NEX.borderMuted}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 3,
};
const nexWordmarkStyle: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: NEX.text, lineHeight: 1,
};
const personInitialStyle: CSSProperties = {
  width: 22, height: 22, borderRadius: "50%",
  background: `linear-gradient(180deg, ${NEX.orange} 0%, rgba(249,115,22,0.7) 100%)`,
  color: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 11, fontWeight: 700,
};
const frameContentStyle: CSSProperties = {
  paddingTop: 12,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};
const frameLabelStyle: CSSProperties = {
  color: "rgba(255,255,255,0.65)",
  fontSize: 12,
  letterSpacing: 0.4,
};
const frameHintStyle: CSSProperties = {
  color: "rgba(255,255,255,0.45)",
  fontSize: 11.5,
  lineHeight: 1.55,
};

const controlsStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};
function btn(active: boolean): CSSProperties {
  return {
    background: active ? NEX.orange : "rgba(255,255,255,0.04)",
    color: active ? "#0a0a0a" : NEX.text,
    border: active ? "none" : `1px solid rgba(255,255,255,0.12)`,
    borderRadius: 999,
    padding: "10px 16px",
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: -0.1,
    cursor: "pointer",
    transition: "background 160ms ease, color 160ms ease",
  };
}

const notesStyle: CSSProperties = {
  padding: 14,
  borderRadius: 12,
  border: `1px solid rgba(255,255,255,0.08)`,
  background: "rgba(255,255,255,0.02)",
};
const notesTitleStyle: CSSProperties = {
  color: NEX.orange,
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: 1.8,
  marginBottom: 8,
};
const notesListStyle: CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  color: "rgba(255,255,255,0.65)",
  fontSize: 12,
  lineHeight: 1.7,
};
const codeStyle: CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  padding: "1px 5px",
  borderRadius: 4,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 11,
};

const logSectionStyle: CSSProperties = {
  padding: 14,
  borderRadius: 12,
  border: `1px solid rgba(255,255,255,0.08)`,
  background: "rgba(255,255,255,0.02)",
};
const logListStyle: CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  color: "rgba(255,255,255,0.6)",
  fontSize: 12,
  lineHeight: 1.7,
};
const logItemStyle: CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 11.5,
};

"use client";

import React from "react";
import { NexVoiceOrb } from "@/components/nexapp/NexVoiceOrb";
import type { NexVoiceState } from "@/lib/nex-voice";

const STATES: Array<{ state: NexVoiceState; title: string; caption: string; palette: string }> = [
  { state: "idle",      title: "IDLE",      caption: "NEX is here · aurora plasma · slow breath",       palette: "orange" },
  { state: "listening", title: "LISTENING", caption: "NEX is receiving · orange · fast waveform pulse", palette: "orange" },
  { state: "thinking",  title: "THINKING",  caption: "processing · violet · circuits active",           palette: "violet" },
  { state: "speaking",  title: "SPEAKING",  caption: "NEX speaks · cyan · dramatic core pulse",          palette: "cyan" },
  { state: "error",     title: "ERROR",     caption: "retry · rose red · quiet slow decay",              palette: "red" },
];

export function VoiceSamplesClient() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "auto",
        background:
          "radial-gradient(ellipse at center, rgba(30,15,5,1) 0%, rgba(6,4,3,1) 60%, rgba(0,0,0,1) 100%)",
        color: "rgba(245,245,245,0.95)",
        fontFamily: `-apple-system, "SF Pro Text", "Segoe UI", system-ui, sans-serif`,
        padding: "24px 16px 40px",
      }}
    >
      <header style={{ maxWidth: 720, margin: "0 auto 32px", textAlign: "center" }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: "rgba(245,245,245,0.5)",
            marginBottom: 6,
          }}
        >
          NEX · Intelligence Core · Samples
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>
          Five voice states · one animation per state
        </h1>
        <p style={{ fontSize: 13, color: "rgba(245,245,245,0.6)", marginTop: 8, lineHeight: 1.5 }}>
          Each orb below is frozen on one voice state. Tap and hold to observe the
          motion. Different colour · different tempo · different personality.
        </p>
      </header>

      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 20,
        }}
      >
        {STATES.map((entry) => (
          <div
            key={entry.state}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
              padding: "24px 12px 20px",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.35) 100%)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
            }}
          >
            <div style={{ position: "relative", width: 180, height: 180 }}>
              <NexVoiceOrb nexState={entry.state} />
            </div>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: 2.2,
                  textTransform: "uppercase",
                  fontWeight: 700,
                  color:
                    entry.palette === "orange" ? "#fdba74" :
                    entry.palette === "violet" ? "#c084fc" :
                    entry.palette === "cyan"   ? "#67e8f9" :
                    entry.palette === "red"    ? "#fda4af" : "#f5f5f5",
                }}
              >
                {entry.title}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(245,245,245,0.65)",
                  marginTop: 6,
                  lineHeight: 1.4,
                }}
              >
                {entry.caption}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          maxWidth: 720,
          margin: "32px auto 0",
          padding: "16px 18px",
          border: "1px dashed rgba(255,255,255,0.14)",
          borderRadius: 12,
          fontSize: 12,
          color: "rgba(245,245,245,0.6)",
          lineHeight: 1.55,
        }}
      >
        Currently each state uses <strong>the same animation composition</strong> with
        different colour + tempo. If you want each state to use a truly different
        animation TYPE (e.g. speaking = vocal ribbons · listening = sonar sweep ·
        thinking = neural firing · idle = aurora), tell me which type per state
        and I&apos;ll rebuild each personality distinctly.
      </div>
    </div>
  );
}

"use client";

// src/app/nexapp/nex-agent/ErrorBoundary.tsx
//
// Compact client-side error boundary for the NEX1 Programming Workstation.
// Never blows up to full screen — always constrained to a bounded panel.
// Auto-queues a fix task for NEX1 once per session (localStorage guard prevents loop).

import { Component, type ReactNode } from "react";

interface Props { readonly children: ReactNode; }
interface State {
  readonly hasError: boolean;
  readonly message: string;
  readonly stack: string;
  readonly autoQueueDone: boolean;
}

const LOOP_GUARD_KEY = "nex1-workstation-auto-queue-fix-fired";

export class WorkstationErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "", stack: "", autoQueueDone: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      message: error?.message ?? "Unknown client error",
      stack: (error?.stack ?? "").slice(0, 1500),
    };
  }

  componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error("[WorkstationErrorBoundary]", error, info);
    // Auto-queue a fix task for NEX1 · guarded so it fires at most once per browser session
    try {
      if (typeof window !== "undefined") {
        const already = sessionStorage.getItem(LOOP_GUARD_KEY);
        if (!already) {
          sessionStorage.setItem(LOOP_GUARD_KEY, "1");
          const errText = `NEX1 workstation client-side crash · fix required.\n\nError: ${error.message}\n\nStack (top):\n${(error.stack ?? "").split("\n").slice(0, 6).join("\n")}\n\nRoute: /nexapp/nex-agent\nComponent: NexAgentWorkstation`;
          void fetch("/api/nex/agent/submit", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ prompt: errText, submitted_by: "auto-error-boundary" }),
          }).then(async (r) => {
            const j = await r.json().catch(() => ({}));
            this.setState({ autoQueueDone: !!j.ok });
          }).catch(() => { /* silent */ });
        } else {
          this.setState({ autoQueueDone: true });
        }
      }
    } catch { /* never let the boundary itself throw */ }
  }

  reset = () => {
    this.setState({ hasError: false, message: "", stack: "", autoQueueDone: false });
    // Force a hard reload to pick up the latest bundle
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{
        position: "fixed", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(180deg, #0B1220 0%, #0E1B33 40%, #0B1220 100%)",
        padding: 24, zIndex: 9999,
      }}>
        <div style={{
          maxWidth: 560, width: "100%",
          background: "rgba(14, 27, 51, 0.9)",
          border: "1px solid rgba(239, 68, 68, 0.5)",
          borderRadius: 12,
          padding: 20,
          color: "#F9FAFB",
          fontFamily: "Inter, system-ui, sans-serif",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          maxHeight: "80vh",
          overflow: "auto",
        }}>
          <div style={{
            fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em",
            color: "#EF4444", fontWeight: 700, marginBottom: 8,
          }}>◧ Workstation crash · contained</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
            The programming workstation hit a client-side error.
          </div>
          <div style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.5, marginBottom: 12 }}>
            The rest of the app is unaffected · the preview and other HQ pages continue to work.
            {this.state.autoQueueDone
              ? " NEX1 has been auto-queued to fix this crash."
              : " Auto-queueing fix task for NEX1…"}
          </div>
          <pre style={{
            background: "rgba(0,0,0,0.35)",
            border: "1px solid rgba(148, 163, 184, 0.18)",
            borderRadius: 6,
            padding: 10,
            fontSize: 10,
            color: "#F87171",
            fontFamily: "'JetBrains Mono', Menlo, Consolas, monospace",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: 220,
            overflow: "auto",
            margin: "0 0 12px",
          }}>{this.state.message}
{this.state.stack ? `\n\n${this.state.stack}` : ""}</pre>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={this.reset}
              style={{
                background: "linear-gradient(180deg, #F97316 0%, #EA580C 100%)",
                color: "white", border: "none", borderRadius: 8,
                padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                textTransform: "uppercase", letterSpacing: "0.04em",
              }}
            >Reload workstation</button>
            <a
              href="/nex-head-quarters/workstation"
              style={{
                background: "rgba(255,255,255,0.04)", color: "#F9FAFB",
                border: "1px solid rgba(148,163,184,0.24)", borderRadius: 8,
                padding: "8px 14px", fontSize: 12, fontWeight: 600, textDecoration: "none",
              }}
            >← HQ Workstation</a>
          </div>
        </div>
      </div>
    );
  }
}

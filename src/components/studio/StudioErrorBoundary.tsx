"use client";

// StudioErrorBoundary — the platform-wide safety net.
//
// Wrap ANY child tree that could throw during render (section
// renderers, modals, dashboard panels, template previews). When a
// child throws, we render a friendly fallback so the whole page
// never whites out.
//
// Also posts to /api/studio/telemetry/error (fire-and-forget) so we
// find bugs before merchants email us.
//
// Standard React class-based error boundary — Next.js App Router still
// requires the class API for componentDidCatch. Function components
// can only catch child errors via `error.tsx` route boundaries; those
// don't cover in-page component crashes.

import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Custom fallback renderer. Defaults to a compact red-card UI with
   *  a "Try again" button. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Callback for external logging / telemetry beyond our default
   *  console.warn + /api/studio/telemetry/error post. */
  onError?: (error: Error, info: { componentStack: string }) => void;
  /** Context label surfaced in the fallback + telemetry payload. Use
   *  something like "Hero preview: hero.animation_hero_1" or "App
   *  Store modal". Makes triage faster. */
  label?: string;
  /** When set, the fallback renders inline (small card) rather than
   *  filling the parent. Use for card-grid contexts where a big red
   *  block would break layout. */
  compact?: boolean;
};

type State = { error: Error | null };

export class StudioErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    const label = this.props.label ?? "unknown";
    console.warn(`[StudioErrorBoundary · ${label}]`, error, info);
    this.props.onError?.(error, info);
    // Fire-and-forget telemetry. Never let logging failures crash the
    // fallback path.
    void fetch("/api/studio/telemetry/error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label,
        message: error.message,
        stack: error.stack?.slice(0, 4000) ?? null,
        componentStack: info.componentStack?.slice(0, 4000) ?? null,
        href: typeof window !== "undefined" ? window.location.href : null,
        at: new Date().toISOString()
      })
    }).catch(() => {
      /* silent — telemetry is best-effort */
    });
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <DefaultFallback
          error={this.state.error}
          onReset={this.reset}
          label={this.props.label}
          compact={this.props.compact}
        />
      );
    }
    return this.props.children;
  }
}

// ─── Default fallback UI ─────────────────────────────────────────

function DefaultFallback({
  error,
  onReset,
  label,
  compact
}: {
  error: Error;
  onReset: () => void;
  label?: string;
  compact?: boolean;
}) {
  const padding = compact ? "12px" : "20px";
  return (
    <div
      role="alert"
      style={{
        padding,
        borderRadius: 16,
        border: "1px dashed #FCA5A5",
        background: "#FEF2F2",
        color: "#7F1D1D",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        display: "flex",
        flexDirection: "column",
        gap: 6
      }}
    >
      <p
        style={{
          fontSize: 10,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          margin: 0
        }}
      >
        {label ?? "Something went wrong"}
      </p>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
        This section couldn&rsquo;t render.
      </p>
      {!compact && (
        <p style={{ margin: 0, fontSize: 12, opacity: 0.85 }}>
          {error.message || "Unknown error"}
        </p>
      )}
      <button
        type="button"
        onClick={onReset}
        style={{
          alignSelf: "flex-start",
          marginTop: 4,
          padding: "6px 12px",
          borderRadius: 8,
          background: "#DC2626",
          color: "white",
          fontWeight: 800,
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          border: 0,
          cursor: "pointer"
        }}
      >
        Try again
      </button>
    </div>
  );
}

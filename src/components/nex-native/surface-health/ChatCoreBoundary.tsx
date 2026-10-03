"use client";

// src/components/nex-native/surface-health/ChatCoreBoundary.tsx
//
// Tier 1 · Chat Core Boundary per doctrine §5.
//
// The strongest protection. Wraps the essential conversation experience:
// composer, message list, delivery/receipt, participant state. When a
// crash reaches Tier 1, the user sees a minimal shell · never raw error
// text, stack traces, React error details, filenames or correlation IDs.
//
// Tier 1 is the final client-side safety net. If an essential function
// itself has failed, that function may be temporarily unavailable, but
// the failure must not propagate into unrelated conversation state or
// optional visual systems.

import { Component, type ReactNode } from "react";
import { emitSurfaceHealthEvent } from "./telemetry-client";
import {
  classifyBoundaryError,
  readNormalizedClientEnvironment,
  type BoundaryEmission,
} from "./boundary-shared";

interface Props {
  children: ReactNode;
  /** Which chat surface this boundary is pinned to. Required for
   *  diagnostic classification. Values like 'peer-chat', 'depth-cards'. */
  surface: string;
  /** The currently-active visual theme id. Required even for Tier 1
   *  so HQ can tell whether a core failure correlates with a specific
   *  theme. Use 'none' when Tier 1 runs outside any theme context. */
  visual_theme: string;
  /** Optional override for the minimal shell. Defaults to a plain
   *  "Chat temporarily reduced" message. Never surface technical info. */
  minimalShell?: ReactNode;
  app_version?: string;
}

interface State {
  errored: boolean;
}

export class ChatCoreBoundary extends Component<Props, State> {
  state: State = { errored: false };

  static getDerivedStateFromError(_error: Error): State {
    return { errored: true };
  }

  componentDidCatch(_error: Error, _info: { componentStack: string }): void {
    // Doctrine §7.4 · content safety · boundary MUST NOT forward
    // error.message, error.stack, componentStack or any caller-supplied
    // free text that could carry conversation content. The classification
    // is derived from the TIER alone when we reach Tier 1 (nothing more
    // specific is known at this layer).
    const payload: BoundaryEmission = {
      tier: "chat-core",
      surface: this.props.surface,
      visual_theme: this.props.visual_theme,
      component_module: "surface-root",
      error_classification: classifyBoundaryError("chat-core", "surface-root"),
      recovery_action: "degrade",
      app_version: this.props.app_version ?? null,
      theme_version: null,
      client_environment: readNormalizedClientEnvironment(),
    };
    emitSurfaceHealthEvent(payload);
  }

  render(): ReactNode {
    if (this.state.errored) {
      return this.props.minimalShell ?? <DefaultMinimalShell />;
    }
    return this.props.children;
  }
}

function DefaultMinimalShell(): JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        boxSizing: "border-box",
        width: "100%",
        minHeight: "100%",
        padding: 24,
        display: "grid",
        placeItems: "center",
        backgroundColor: "#0b1420",
        color: "#f4f7fc",
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 320 }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#8ba9d1",
            marginBottom: 10,
          }}
        >
          Chat temporarily reduced
        </div>
        <div style={{ fontSize: 15, lineHeight: 1.4 }}>
          Your conversation is safe. Please come back in a moment.
        </div>
      </div>
    </div>
  );
}

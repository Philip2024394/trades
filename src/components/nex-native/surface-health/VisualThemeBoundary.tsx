"use client";

// src/components/nex-native/surface-health/VisualThemeBoundary.tsx
//
// Tier 2 · Visual Theme Boundary per doctrine §5.
//
// Wraps the ACTIVE theme skin as one unit. On render/runtime failure
// inside the theme, this boundary:
//   · catches the error (React class-component contract)
//   · records a surface-health event via the Item 1 service bridge
//   · activates the Safe Fallback Renderer
//   · preserves the conversation (messages passed through as props)
//   · does not reload or interrupt
//   · does not expose technical detail to the user
//
// The fallback is deliberately independent of the theme bundle —
// see SafeFallbackRenderer.tsx + its independence test.

import { Component, type ReactNode } from "react";
import { emitSurfaceHealthEvent } from "./telemetry-client";
import {
  classifyBoundaryError,
  readNormalizedClientEnvironment,
  type BoundaryEmission,
} from "./boundary-shared";
import {
  SafeFallbackRenderer,
  type SafeFallbackMessage,
} from "./SafeFallbackRenderer";

interface Props {
  children: ReactNode;
  /** Chat surface id · forwarded to diagnostics. */
  surface: string;
  /** Currently-active theme id · forwarded to diagnostics. */
  visual_theme: string;
  theme_version?: string;
  app_version?: string;
  /** Messages the Safe Fallback Renderer should display when activated.
   *  Required so the conversation survives even if the theme bundle
   *  disintegrates. */
  fallbackMessages: SafeFallbackMessage[];
  viewerAccountId: string;
}

interface State {
  errored: boolean;
}

export class VisualThemeBoundary extends Component<Props, State> {
  state: State = { errored: false };

  static getDerivedStateFromError(_error: Error): State {
    return { errored: true };
  }

  componentDidCatch(_error: Error, _info: { componentStack: string }): void {
    const payload: BoundaryEmission = {
      tier: "visual-theme",
      surface: this.props.surface,
      visual_theme: this.props.visual_theme,
      component_module: "theme-root",
      error_classification: classifyBoundaryError("visual-theme", "theme-root"),
      recovery_action: "fallback",
      app_version: this.props.app_version ?? null,
      theme_version: this.props.theme_version ?? null,
      client_environment: readNormalizedClientEnvironment(),
    };
    emitSurfaceHealthEvent(payload);
  }

  render(): ReactNode {
    if (this.state.errored) {
      return (
        <SafeFallbackRenderer
          messages={this.props.fallbackMessages}
          viewerAccountId={this.props.viewerAccountId}
        />
      );
    }
    return this.props.children;
  }
}

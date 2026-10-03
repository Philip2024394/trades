"use client";

// src/components/nex-native/surface-health/OptionalVisualModuleBoundary.tsx
//
// Tier 3 · Optional Visual Module Boundary per doctrine §5.
//
// Fine-grained boundary for a single optional visual module (bubble
// renderer, animation/overlay, sticker/emoji picker, etc.). A Tier 3
// failure:
//   · is contained to this module;
//   · records a surface-health event;
//   · falls back to a theme-neutral default for the slot (or nothing);
//   · leaves Tier 1 and Tier 2 fully functional;
//   · allows unrelated Tier 3 modules to continue.
//
// Do NOT wrap every React component in this boundary. Use it only
// where fault isolation is genuinely required (optional visual chrome
// that can be absent without harming essential chat).

import { Component, type ReactNode } from "react";
import { emitSurfaceHealthEvent } from "./telemetry-client";
import {
  classifyBoundaryError,
  readNormalizedClientEnvironment,
  type BoundaryEmission,
} from "./boundary-shared";

interface Props {
  children: ReactNode;
  surface: string;
  visual_theme: string;
  /** The optional-module identifier (e.g. 'haunted-smoke',
   *  'bubble-renderer', 'sticker-picker'). Drives classification. */
  component_module: string;
  theme_version?: string;
  app_version?: string;
  /** Optional slot fallback. When omitted the module is simply hidden
   *  (null) · appropriate for purely decorative overlays. */
  slotFallback?: ReactNode;
}

interface State {
  errored: boolean;
}

export class OptionalVisualModuleBoundary extends Component<Props, State> {
  state: State = { errored: false };

  static getDerivedStateFromError(_error: Error): State {
    return { errored: true };
  }

  componentDidCatch(_error: Error, _info: { componentStack: string }): void {
    const payload: BoundaryEmission = {
      tier: "optional-visual-module",
      surface: this.props.surface,
      visual_theme: this.props.visual_theme,
      component_module: this.props.component_module,
      error_classification: classifyBoundaryError(
        "optional-visual-module",
        this.props.component_module,
      ),
      recovery_action: "degrade",
      app_version: this.props.app_version ?? null,
      theme_version: this.props.theme_version ?? null,
      client_environment: readNormalizedClientEnvironment(),
    };
    emitSurfaceHealthEvent(payload);
  }

  render(): ReactNode {
    if (this.state.errored) {
      return this.props.slotFallback ?? null;
    }
    return this.props.children;
  }
}

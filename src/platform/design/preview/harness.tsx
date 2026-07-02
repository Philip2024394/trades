"use client";

// Xrated Design System — preview harness.
//
// Every picker UI, App Store card, and AI recommendation surface
// renders components through this harness so previews inherit the
// merchant's active theme. Never renders static screenshots.
//
// Two entry points:
//   • <DesignPreview registration={reg} /> — full-fidelity preview
//     using the component's default props + content
//   • <DesignPreviewCustom registration={reg} props={...} content={...} />
//     — preview a specific instance shape (e.g. showing the merchant
//     what THEIR card looks like)

import { DesignThemeProvider } from "../theme/context";
import type { DesignTheme } from "../theme/types";
import { DEFAULT_DESIGN_THEME } from "../theme/types";
import type {
  FrozenDesignComponent,
  DesignComponentInstance
} from "../types";

export function DesignPreview({
  registration,
  theme
}: {
  registration: FrozenDesignComponent;
  /** Optional theme override. Omit to inherit from the surrounding
   *  DesignThemeProvider. */
  theme?: DesignTheme;
}) {
  return (
    <DesignPreviewCustom
      registration={registration}
      theme={theme}
      props={registration.defaultProps()}
      content={registration.defaultContent()}
    />
  );
}

export function DesignPreviewCustom({
  registration,
  props,
  content,
  theme
}: {
  registration: FrozenDesignComponent;
  props: Record<string, unknown>;
  content: Record<string, unknown>;
  theme?: DesignTheme;
}) {
  const Renderer = registration.renderer;
  const activeTheme = theme ?? DEFAULT_DESIGN_THEME;
  return (
    <DesignThemeProvider theme={activeTheme}>
      <Renderer props={props} content={content} />
    </DesignThemeProvider>
  );
}

/** Render an existing layout instance (from a saved layout row) with
 *  the current theme. Used by the storefront render path once
 *  Design System components ship as first-class layout entries. */
export function DesignInstancePreview({
  registration,
  instance,
  theme
}: {
  registration: FrozenDesignComponent;
  instance: DesignComponentInstance;
  theme?: DesignTheme;
}) {
  return (
    <DesignPreviewCustom
      registration={registration}
      props={instance.props}
      content={instance.content}
      theme={theme}
    />
  );
}

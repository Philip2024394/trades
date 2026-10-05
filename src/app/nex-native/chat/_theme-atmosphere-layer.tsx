// src/app/nex-native/chat/_theme-atmosphere-layer.tsx
//
// Thin declarative wrapper that resolves a theme's atmosphere from the
// code-side registry and mounts it. One JSX tag per callsite replaces
// what used to be two theme-id if-branches in the peer-chat server
// component.
//
// Server component · safe to render inside server pages. The atmosphere
// components themselves may be either server or client components; the
// registry handles both uniformly.
//
// Usage:
//
//   // Peer chat
//   <ThemeAtmosphereLayer themeId={peerThemeRow?.id ?? null} subjectId={peer.id} />
//
//   // Business chat
//   <ThemeAtmosphereLayer themeId={businessThemeId} subjectId={business.id} />
//
// There is no theme-specific prop on this component. Any future
// atmosphere that needs richer context extends `ThemeAtmosphereProps`
// in the registry file; this wrapper does not branch on theme id.

import * as React from "react";
import { getAtmosphereForTheme } from "@/lib/nex-native/chat-render/atmosphere-registry";

export interface ThemeAtmosphereLayerProps {
  readonly themeId: string | null | undefined;
  readonly subjectId: string | null;
}

export function ThemeAtmosphereLayer({
  themeId,
  subjectId,
}: ThemeAtmosphereLayerProps): React.ReactElement | null {
  const Atmosphere = getAtmosphereForTheme(themeId);
  if (!Atmosphere) return null;
  return <Atmosphere subjectId={subjectId} />;
}

"use client";
// NEX Capability Surface renderer · Philip 2026-08-30 · Slice 1
//
// Resolves the active capability + current URL-derived frame to a view
// component. Renders inside NexHudFrame's children slot (same slot chat
// and existing artifacts use). Never routes · never navigates away · the
// shell always stays mounted.

import React from "react";
import { capabilityRegistry, type CapabilityFrame, type CapabilityId } from "@/lib/nexapp-shell/capabilities";

export interface CapabilitySurfaceProps {
  activeCapability: CapabilityId;
  frame: CapabilityFrame;
  navigate: (view: string, params?: Record<string, string>) => void;
  exit: () => void;
}

export function CapabilitySurface({
  activeCapability,
  frame,
  navigate,
  exit,
}: CapabilitySurfaceProps) {
  const def = capabilityRegistry.get(activeCapability);
  if (!def) {
    return (
      <div style={{ padding: 24, color: "rgba(245,245,245,0.7)", fontSize: 13 }}>
        Capability not registered: {activeCapability}
      </div>
    );
  }
  const ViewComponent = def.views[frame.view] ?? def.views[def.entryView];
  if (!ViewComponent) {
    return (
      <div style={{ padding: 24, color: "rgba(245,245,245,0.7)", fontSize: 13 }}>
        View not found: {frame.view}
      </div>
    );
  }
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <ViewComponent frame={frame} navigate={navigate} exit={exit} />
    </div>
  );
}

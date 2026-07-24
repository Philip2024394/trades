"use client";

// AppShell — top-level composition of the NEX Trade App per Design
// Language v1.1 + Master Trade Template v1.1. Contains:
//   - Canvas surface (nav + hero + Ask NEX + quick actions + featured content)
//   - Chat surface (slides up over canvas on engagement)
//   - Bottom nav (permanent OS destinations)
//
// This is the frame every trade inherits. Content/config differ per
// trade; layout does not.

import type { ReactNode } from "react";
import { StatusBar } from "./StatusBar";
import { Hero } from "./Hero";
import { QuickActionsGrid } from "./QuickActionsGrid";
import { PopularStylesRow } from "./PopularStylesRow";
import { ToolsCalculatorsRow } from "./ToolsCalculatorsRow";
import { ProjectGalleryRow } from "./ProjectGalleryRow";
import { BottomNav } from "./BottomNav";
import { ChatSurface } from "./ChatSurface";

export function AppShell({ children }: { children?: ReactNode }) {
  return (
    <div className="relative mx-auto flex min-h-screen max-w-md flex-col"
         style={{ background: "var(--nex-cream)" }}>
      {/* Canvas surface — visible by default */}
      <StatusBar />
      <main className="flex-1 pb-6">
        <Hero />
        {/* Grid overlaps up onto the hero by ~5% of hero height
            (320px × 0.05 ≈ 16px negative margin). Sits under the
            faded bottom of the hero image. */}
        <div className="relative z-10 -mt-4">
          <QuickActionsGrid />
        </div>
        <PopularStylesRow />
        <ToolsCalculatorsRow />
        <ProjectGalleryRow />
        {children}
      </main>
      <BottomNav />

      {/* Chat surface — slides up on engagement, persistent-in-capability */}
      <ChatSurface />
    </div>
  );
}

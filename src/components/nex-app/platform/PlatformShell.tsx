"use client";

// PlatformShell — landing surface for the NEX Platform.
// Ordering:
//   Status bar
//   Hero (character + "One App. Endless possibilities.")
//   Free Chat card
//   Ask NEX bar (routes via Intent Router)
//   Main Grid (19 NEX modules · Construction / Home / Growth / Design
//     now live inside the grid, so the standalone Explore Categories
//     row was removed to avoid duplication.)
//   Live Platform card (avatars + counter)
//   Recent Projects row
//   Platform Bottom Nav

import { StatusBar } from "../shell/StatusBar";
import { PlatformHero } from "./PlatformHero";
import { MainGrid } from "./MainGrid";
import { LivePlatformCard } from "./LivePlatformCard";
import { RecentProjectsRow } from "./RecentProjectsRow";
import { PlatformBottomNav } from "./PlatformBottomNav";

export function PlatformShell() {
  return (
    <div
      className="relative mx-auto flex min-h-screen max-w-md flex-col"
      style={{ background: "var(--nex-cream)" }}
    >
      <StatusBar />
      <main className="flex-1 pb-10">
        <PlatformHero />
        {/* Grid container — same 8px gap below hero as Free Chat has
            below the search bar inside the hero (matching padding). */}
        <div className="relative z-10 mt-2">
          <MainGrid />
        </div>
        <LivePlatformCard />
        <RecentProjectsRow />
      </main>
      <PlatformBottomNav />
    </div>
  );
}

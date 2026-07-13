// Platform Workspace Shell — top-level layout wrapper.
//
// ─── 3-question rule ────────────────────────────────────────────────
//
// 1. Why platform?  The workspace shell is the layout every workspace
//    route renders inside. Composed from UI Kit + platform primitives.
//    If any App owned this, changing the workspace shell would require
//    App changes.
//
// 2. Which future Apps benefit?  Every App rendered inside the
//    workspace. The shell provides primary rail, palette, top bar; the
//    App provides its main pane content only.
//
// 3. Which doc authorises?  TRADE_CENTER_PLATFORM_DELTA §4.3 row
//    "Shell primitives" + TRADE_CENTER_PLATFORM_ARCHITECTURE.md §2.1
//    "What the shell owns".
//
// ─── Design ─────────────────────────────────────────────────────────
//
// Composes UI primitives from `@/platform/ui/*` — no new primitives
// introduced here (Amendment 9). Server-safe wrapper; client behaviour
// (palette listener, brand pack apply) lives in child components.

"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { PrimaryRail } from "./PrimaryRail";
import { CommandPalette } from "./CommandPalette";
import { Copilot } from "./Copilot";

export type WorkspaceShellProps = {
  children: ReactNode;
  /** Route prefix the shell mounts under. */
  basePath?: string;
};

/** Custom-event name any component can fire to seed the copilot.
 *  Exported so App components can import a constant instead of
 *  hard-coding the string. */
export const AI_SEED_EVENT = "tradecenter:ai-seed";

export function WorkspaceShell({
  children,
  basePath = "/tc"
}: WorkspaceShellProps) {
  // Palette dispatches "Ask AI" queries into this state; Copilot
  // consumes the seed prompt and auto-opens. Also listens for the
  // global AI_SEED_EVENT so inline chips (e.g. Product Card's "Find
  // alternatives") can seed without prop drilling.
  const [aiSeed, setAiSeed] = useState<string | undefined>(undefined);

  useEffect(() => {
    function onSeed(e: Event) {
      const custom = e as CustomEvent<{ prompt?: string }>;
      const prompt = custom.detail?.prompt;
      if (prompt) setAiSeed(prompt);
    }
    window.addEventListener(AI_SEED_EVENT, onSeed as EventListener);
    return () =>
      window.removeEventListener(AI_SEED_EVENT, onSeed as EventListener);
  }, []);

  return (
    <div className="flex h-screen w-full" style={{ backgroundColor: "#FBF6EC" }}>
      <PrimaryRail basePath={basePath}/>
      <main className="min-w-0 flex-1 overflow-y-auto">
        {children}
      </main>
      <CommandPalette
        onAskAI={(query) => setAiSeed(query)}
      />
      <Copilot
        seedPrompt={aiSeed}
        onClose={() => setAiSeed(undefined)}
      />
    </div>
  );
}

/** Fire from any client component to open the copilot with a seed
 *  prompt. Safe no-op when the shell is not mounted. */
export function askAI(prompt: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(AI_SEED_EVENT, { detail: { prompt } })
  );
}

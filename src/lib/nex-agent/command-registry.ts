// src/lib/nex-agent/command-registry.ts
//
// Command palette (⌘K) command registry. Each command has an id · label ·
// description · keywords for fuzzy match · optional keyboard shortcut · run
// handler that receives the workstation context and performs the action.
//
// New commands register here · they appear automatically in the palette.

export interface CommandContext {
  readonly viewport: string;
  readonly tab: string;
  readonly zoom: number;
  readonly activeTaskId: string | null;
  readonly setTab: (tab: "history" | "code") => void;
  readonly setViewport: (v: "mobile" | "tablet" | "desktop" | "fluid") => void;
  readonly setZoom: (z: number) => void;
  readonly setShowBezel: (b: boolean) => void;
  readonly setShowCutoutOutline: (b: boolean) => void;
  readonly setReloadNonce: (fn: (n: number) => number) => void;
  readonly setPreviewUrl: (url: string) => void;
  readonly setPhoneModelId: (id: string) => void;
  readonly focusPrompt: () => void;
  readonly submitPrompt: () => void;
  readonly stopTask: () => void;
  readonly openTaskById: (taskId: string) => void;
  readonly toggleAmbientSound: () => void;
  readonly toggleZenMode: () => void;
  readonly toggleFullscreenPreview: () => void;
}

export interface Command {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly keywords: readonly string[];
  readonly section: "actions" | "navigation" | "preview" | "phone" | "founder" | "system";
  readonly shortcut?: string;
  readonly run: (ctx: CommandContext) => void;
}

export const BASE_COMMANDS: readonly Command[] = [
  // ─── Actions ─────────────────────────────────────────────
  {
    id: "focus-prompt",
    label: "Focus prompt",
    description: "Move keyboard focus to the prompt textarea",
    keywords: ["focus", "prompt", "type", "write"],
    section: "actions",
    shortcut: "⌘ /",
    run: (ctx) => ctx.focusPrompt(),
  },
  {
    id: "submit-prompt",
    label: "Send prompt to NEX1",
    description: "Submit the current prompt · queue if a task is active",
    keywords: ["send", "submit", "go", "run"],
    section: "actions",
    shortcut: "⌘ Enter",
    run: (ctx) => ctx.submitPrompt(),
  },
  {
    id: "stop-task",
    label: "Stop active task",
    description: "Ask NEX1 to halt at the next safe checkpoint",
    keywords: ["stop", "halt", "pause", "cancel"],
    section: "actions",
    shortcut: "⌘ .",
    run: (ctx) => ctx.stopTask(),
  },
  {
    id: "reload-preview",
    label: "Reload LEFT preview",
    description: "Refresh the isolated preview iframe",
    keywords: ["reload", "refresh", "preview", "iframe"],
    section: "preview",
    shortcut: "⌘ R",
    run: (ctx) => ctx.setReloadNonce((n) => n + 1),
  },
  // ─── Navigation ──────────────────────────────────────────
  {
    id: "tab-history",
    label: "Show History tab",
    keywords: ["history", "cards", "tasks", "past"],
    section: "navigation",
    shortcut: "⌘ 1",
    run: (ctx) => ctx.setTab("history"),
  },
  {
    id: "tab-code",
    label: "Show Code tab",
    keywords: ["code", "live", "feed", "stream"],
    section: "navigation",
    shortcut: "⌘ 2",
    run: (ctx) => ctx.setTab("code"),
  },
  // ─── Preview · viewport ──────────────────────────────────
  {
    id: "viewport-mobile",
    label: "Preview · Mobile",
    keywords: ["viewport", "mobile", "phone"],
    section: "preview",
    run: (ctx) => ctx.setViewport("mobile"),
  },
  {
    id: "viewport-tablet",
    label: "Preview · Tablet",
    keywords: ["viewport", "tablet", "ipad"],
    section: "preview",
    run: (ctx) => ctx.setViewport("tablet"),
  },
  {
    id: "viewport-desktop",
    label: "Preview · Desktop",
    keywords: ["viewport", "desktop", "large"],
    section: "preview",
    run: (ctx) => ctx.setViewport("desktop"),
  },
  {
    id: "viewport-fluid",
    label: "Preview · Fluid (fill panel)",
    keywords: ["viewport", "fluid", "responsive"],
    section: "preview",
    run: (ctx) => ctx.setViewport("fluid"),
  },
  // ─── Zoom ────────────────────────────────────────────────
  {
    id: "zoom-in",
    label: "Zoom in preview",
    keywords: ["zoom", "in", "bigger"],
    section: "preview",
    shortcut: "⌘ +",
    run: (ctx) => ctx.setZoom(Math.min(3, ctx.zoom + 0.1)),
  },
  {
    id: "zoom-out",
    label: "Zoom out preview",
    keywords: ["zoom", "out", "smaller"],
    section: "preview",
    shortcut: "⌘ -",
    run: (ctx) => ctx.setZoom(Math.max(0.25, ctx.zoom - 0.1)),
  },
  {
    id: "zoom-reset",
    label: "Reset zoom · 100%",
    keywords: ["zoom", "reset", "100"],
    section: "preview",
    shortcut: "⌘ 0",
    run: (ctx) => ctx.setZoom(1),
  },
  // ─── Phone ───────────────────────────────────────────────
  {
    id: "bezel-toggle",
    label: "Toggle phone bezel frame",
    keywords: ["bezel", "frame", "phone", "border"],
    section: "phone",
    run: (ctx) => ctx.setShowBezel(true), // client toggles inside
  },
  {
    id: "cutout-toggle",
    label: "Toggle red camera cutout outline",
    keywords: ["cutout", "notch", "camera", "outline"],
    section: "phone",
    run: (ctx) => ctx.setShowCutoutOutline(true),
  },
  // ─── Founder · workstation ───────────────────────────────
  {
    id: "zen-mode",
    label: "Zen mode · hide chrome",
    description: "Focus mode · hides everything except LEFT preview + prompt",
    keywords: ["zen", "focus", "minimal", "clean", "distraction"],
    section: "founder",
    run: (ctx) => ctx.toggleZenMode(),
  },
  {
    id: "fullscreen-preview",
    label: "Fullscreen LEFT preview",
    keywords: ["fullscreen", "expand", "preview"],
    section: "founder",
    run: (ctx) => ctx.toggleFullscreenPreview(),
  },
  {
    id: "ambient-sound-toggle",
    label: "Toggle ambient sound design",
    keywords: ["sound", "audio", "ambient", "silence"],
    section: "founder",
    run: (ctx) => ctx.toggleAmbientSound(),
  },
];

/**
 * Fuzzy match · scored by:
 *   - direct label prefix (score 100)
 *   - label word start (80)
 *   - label substring (50)
 *   - keyword match (40)
 *   - description substring (25)
 *   - subsequence match on label (10)
 * Returns sorted list · empty query returns all.
 */
export function searchCommands(query: string, commands: readonly Command[]): readonly Command[] {
  const q = query.trim().toLowerCase();
  if (!q) return commands;
  const scored: Array<{ cmd: Command; score: number }> = [];
  for (const cmd of commands) {
    const label = cmd.label.toLowerCase();
    const desc = (cmd.description ?? "").toLowerCase();
    let score = 0;
    if (label.startsWith(q)) score = Math.max(score, 100);
    if (label.split(/\s+/).some((w) => w.startsWith(q))) score = Math.max(score, 80);
    if (label.includes(q)) score = Math.max(score, 50);
    for (const kw of cmd.keywords) if (kw.toLowerCase().includes(q)) score = Math.max(score, 40);
    if (desc.includes(q)) score = Math.max(score, 25);
    if (isSubsequence(q, label)) score = Math.max(score, 10);
    if (score > 0) scored.push({ cmd, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.cmd);
}

function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (const ch of haystack) {
    if (needle[i] === ch) i++;
    if (i === needle.length) return true;
  }
  return i === needle.length;
}

// src/lib/nex/split-workspace/layout.ts
//
// Stage 9 · layout algebra. Ensures panel widths sum to 1.0 and exactly one
// panel is focused. Pure functions · no DOM.

import type { PanelKind, PanelState, WorkspaceLayout, WorkspaceValidation } from "./types";

const EPSILON = 0.001;

/**
 * Default 2-panel layout · preview LEFT (60%) · code RIGHT (40%).
 */
export function defaultLayout(): WorkspaceLayout {
  return {
    orientation: "horizontal",
    panels: [
      { kind: "preview", widthFraction: 0.6, visible: true, focused: false },
      { kind: "code",    widthFraction: 0.4, visible: true, focused: true },
    ],
  };
}

/**
 * Validate that width fractions sum to 1.0 (within epsilon) considering only
 * visible panels, and exactly one visible panel has focus.
 */
export function validateLayout(layout: WorkspaceLayout): WorkspaceValidation {
  const visible = layout.panels.filter((p) => p.visible);
  if (visible.length === 0) {
    return { ok: false, code: "sec.workspace_no_visible_panel", reason: "At least one panel must be visible" };
  }
  const sum = visible.reduce((s, p) => s + p.widthFraction, 0);
  if (Math.abs(sum - 1.0) > EPSILON) {
    return { ok: false, code: "sec.workspace_width_not_1", reason: `Visible widths sum to ${sum.toFixed(4)} · must be 1.0` };
  }
  const focused = visible.filter((p) => p.focused);
  if (focused.length !== 1) {
    return {
      ok: false,
      code: "sec.workspace_focus_invariant",
      reason: `Exactly one visible panel must be focused · got ${focused.length}`,
    };
  }
  // Duplicate-kind check (a workspace with two preview panels is malformed)
  const kinds = new Set<PanelKind>();
  for (const p of layout.panels) {
    if (kinds.has(p.kind)) {
      return { ok: false, code: "sec.workspace_duplicate_panel", reason: `Duplicate panel kind: ${p.kind}` };
    }
    kinds.add(p.kind);
  }
  return { ok: true };
}

/**
 * Set focus to the panel of given kind · returns new layout.
 * If kind is not visible · returns the layout unchanged.
 */
export function focusPanel(layout: WorkspaceLayout, kind: PanelKind): WorkspaceLayout {
  const target = layout.panels.find((p) => p.kind === kind && p.visible);
  if (!target) return layout;
  return {
    ...layout,
    panels: layout.panels.map((p) => ({
      ...p,
      focused: p.kind === kind && p.visible,
    })),
  };
}

/**
 * Toggle a panel's visibility. When hiding · redistribute its width to the
 * remaining visible panels proportionally. When showing · pull evenly from
 * others. Preserves focus (moves it to first-visible if focused was hidden).
 */
export function togglePanel(layout: WorkspaceLayout, kind: PanelKind): WorkspaceLayout {
  const target = layout.panels.find((p) => p.kind === kind);
  if (!target) return layout;

  if (target.visible) {
    // Hide: distribute target.widthFraction across remaining visible panels
    const remaining = layout.panels.filter((p) => p.kind !== kind && p.visible);
    if (remaining.length === 0) return layout; // must keep at least one visible
    const share = target.widthFraction / remaining.length;
    const nextPanels = layout.panels.map<PanelState>((p) => {
      if (p.kind === kind) return { ...p, visible: false, focused: false, widthFraction: 0 };
      if (p.visible) return { ...p, widthFraction: p.widthFraction + share };
      return p;
    });
    const needsFocus = !nextPanels.some((p) => p.visible && p.focused);
    if (needsFocus) {
      const firstVisible = nextPanels.find((p) => p.visible);
      if (firstVisible) {
        return {
          ...layout,
          panels: nextPanels.map((p) => (p.kind === firstVisible.kind ? { ...p, focused: true } : p)),
        };
      }
    }
    return { ...layout, panels: nextPanels };
  }

  // Show: reserve 1/(N+1) for the new panel · shrink others proportionally
  const currentlyVisible = layout.panels.filter((p) => p.visible).length;
  const newShare = 1 / (currentlyVisible + 1);
  const scale = 1 - newShare;
  const nextPanels = layout.panels.map<PanelState>((p) => {
    if (p.kind === kind) return { ...p, visible: true, widthFraction: newShare };
    if (p.visible) return { ...p, widthFraction: p.widthFraction * scale };
    return p;
  });
  return { ...layout, panels: nextPanels };
}

/**
 * Keyboard shortcut resolver.
 *   Ctrl/Cmd+1 → preview
 *   Ctrl/Cmd+2 → code
 *   Ctrl/Cmd+3 → changes
 *   Ctrl/Cmd+4 → diff
 *   Ctrl/Cmd+` → console
 */
export function keyToPanel(input: {
  key: string;
  ctrlOrCmd: boolean;
}): PanelKind | null {
  if (!input.ctrlOrCmd) return null;
  switch (input.key) {
    case "1": return "preview";
    case "2": return "code";
    case "3": return "changes";
    case "4": return "diff";
    case "`": return "console";
    default:  return null;
  }
}

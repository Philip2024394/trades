// Platform SDK — Workspace State.
//
// ─── 3-question rule ────────────────────────────────────────────────
//
// 1. Why platform?  Workspace state (pinned Apps, recent items, active
//    App, right-panel slot, mode, theme, density) spans every App a
//    user visits. If it lived per App, the user would lose their pins
//    switching Apps. Platform-owned by definition.
//
// 2. Which future Apps benefit?  Every App. Marketplace pins a
//    merchant; Orders pins a delivery; Projects pins a job. The pin
//    persists across App boundaries and across sessions.
//
// 3. Which doc authorises?  ADR-043 + TRADE_CENTER_PLATFORM_DELTA
//    §4.2 row "Workspace state schema" + TRADE_CENTER_PLATFORM_
//    ARCHITECTURE.md §17 "Workspace State — What Shell Owns".
//
// ─── Design ─────────────────────────────────────────────────────────
//
// Deliberately separate from AppContext (which is App-scoped, not
// workspace-scoped). Workspace state is a user-scoped concern.
//
// Storage strategy:
//   • Server: reads from tc_shell_workspace_state (lands Wave 2).
//   • Client: localStorage in dev + browsers with no session.
//   • Both paths return the same `WorkspaceState` shape via
//     `readWorkspaceState()`.
//
// Every mutation emits an event (Amendment 5 — "everything emits")
// so downstream analytics + cache invalidation + telemetry work
// automatically.

import { emitBaseline } from "@/platform/telemetry/baseline";

// ─── Types ─────────────────────────────────────────────────────

export type PinnedItem =
  | { kind: "app"; slug: string; pinnedAt: number }
  | { kind: "merchant"; slug: string; pinnedAt: number }
  | { kind: "product"; id: string; pinnedAt: number }
  | { kind: "list"; id: string; pinnedAt: number };

export type RecentItem = {
  kind: "app" | "merchant" | "product" | "list" | "search";
  target: string;                 // app slug / product id / list id / raw query
  seenAt: number;
};

export type RightPanelSlot =
  | { kind: "closed" }
  | { kind: "ai" }
  | { kind: "compare"; productIds: readonly string[] }
  | { kind: "cart" }
  | { kind: "job-list"; listId: string };

export type WorkspaceMode = "simple" | "workspace";

export type WorkspaceState = {
  /** Slug of the App the user is currently in (null on Home). */
  currentAppSlug: string | null;
  /** Right panel — one slot at a time. */
  rightPanel: RightPanelSlot;
  /** Sidebar collapsed state (persisted per-device). */
  sidebarCollapsed: boolean;
  /** Pinned items — max PIN_LIMIT enforced by pinItem(). */
  pinned: readonly PinnedItem[];
  /** Recent items — most recent first, capped at RECENT_LIMIT. */
  recent: readonly RecentItem[];
  /** Simple vs Workspace mode (spec §21). */
  mode: WorkspaceMode;
  /** Theme name (matches designTokenRegistry set id). */
  theme: string;
  /** Density mode (comfortable / compact). */
  density: "comfortable" | "compact";
};

export const PIN_LIMIT = 20;
export const RECENT_LIMIT = 25;

/** Default state for a first-visit user. Simple Mode until any
 *  workspace action promotes to Workspace Mode (spec §21). */
const DEFAULT_STATE: WorkspaceState = {
  currentAppSlug: null,
  rightPanel: { kind: "closed" },
  sidebarCollapsed: false,
  pinned: [],
  recent: [],
  mode: "simple",
  theme: "trade-center",
  density: "comfortable"
};

// ─── Storage (client) ──────────────────────────────────────────
// Server-side hooks land as a follow-up ADR-043b when tc_shell_
// workspace_state ships. For Week 2 the demo uses in-memory + local
// storage on the client.

const STORAGE_KEY = "tc.workspace.state.v1";
let inMemoryState: WorkspaceState = DEFAULT_STATE;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readFromStorage(): WorkspaceState | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkspaceState;
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return null;
  }
}

function writeToStorage(state: WorkspaceState): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota / private mode — degrade gracefully
  }
}

// ─── Public read/write API ────────────────────────────────────

export function readWorkspaceState(): WorkspaceState {
  const stored = readFromStorage();
  if (stored) {
    inMemoryState = stored;
    return stored;
  }
  return inMemoryState;
}

/** Apply a patch, emit an event, persist. Every mutation goes
 *  through here — direct writes to inMemoryState are FORBIDDEN. */
function commit(
  next: WorkspaceState,
  eventKind: string,
  payload: Record<string, unknown>
): void {
  inMemoryState = next;
  writeToStorage(next);
  // Baseline telemetry — every mutation is observable.
  emitBaseline("plugin.event.emitted", 1, { app: "shell", kind: eventKind });
  // Late-import event bus so this module stays independent of runtime
  // boot order.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bus = require("@/platform/runtime/eventBus");
    if (typeof bus.emit === "function") {
      bus.emit({
        kind: eventKind,
        payload,
        occurredAt: new Date().toISOString()
      });
    }
  } catch {
    // Runtime not yet wired — swallow. State + telemetry still land.
  }
}

// ─── Pin operations ───────────────────────────────────────────

export function pinItem(item: PinnedItem): void {
  const state = readWorkspaceState();
  // Reject duplicates
  const key = itemKey(item);
  if (state.pinned.some((p) => itemKey(p) === key)) return;
  const trimmed =
    state.pinned.length >= PIN_LIMIT
      ? state.pinned.slice(1)
      : state.pinned;
  const next = { ...state, pinned: [...trimmed, item] };
  commit(next, "shell.item_pinned", { kind: item.kind, target: itemTarget(item) });
}

export function unpinItem(item: Pick<PinnedItem, "kind"> & { slug?: string; id?: string }): void {
  const state = readWorkspaceState();
  const key = itemKey(item as PinnedItem);
  const pinned = state.pinned.filter((p) => itemKey(p) !== key);
  if (pinned.length === state.pinned.length) return;
  commit({ ...state, pinned }, "shell.item_unpinned", { kind: item.kind });
}

function itemKey(item: PinnedItem): string {
  const target = itemTarget(item);
  return `${item.kind}:${target}`;
}

function itemTarget(item: PinnedItem): string {
  if (item.kind === "app" || item.kind === "merchant") return item.slug;
  return item.id;
}

// ─── Recent visits ────────────────────────────────────────────

export function recordVisit(kind: RecentItem["kind"], target: string): void {
  const state = readWorkspaceState();
  const seenAt = Date.now();
  // Deduplicate — bump existing entry to most recent
  const filtered = state.recent.filter(
    (r) => !(r.kind === kind && r.target === target)
  );
  const next = {
    ...state,
    recent: [{ kind, target, seenAt }, ...filtered].slice(0, RECENT_LIMIT)
  };
  commit(next, "shell.visit_recorded", { kind, target });
}

// ─── Current App + right panel ────────────────────────────────

export function setCurrentApp(slug: string | null): void {
  const state = readWorkspaceState();
  if (state.currentAppSlug === slug) return;
  commit({ ...state, currentAppSlug: slug }, "shell.current_app_changed", { slug });
  if (slug) recordVisit("app", slug);
}

export function setRightPanel(slot: RightPanelSlot): void {
  const state = readWorkspaceState();
  commit({ ...state, rightPanel: slot }, "shell.right_panel_changed", { kind: slot.kind });
}

export function toggleSidebar(): void {
  const state = readWorkspaceState();
  commit(
    { ...state, sidebarCollapsed: !state.sidebarCollapsed },
    "shell.sidebar_toggled",
    { collapsed: !state.sidebarCollapsed }
  );
}

// ─── Mode + theme + density (preferences) ─────────────────────

/** Set the workspace mode. Called by the mode selector when activity
 *  signals meet the rules in spec §21. */
export function setMode(mode: WorkspaceMode): void {
  const state = readWorkspaceState();
  if (state.mode === mode) return;
  commit({ ...state, mode }, "preferences.mode_changed", { mode });
}

export function setTheme(theme: string): void {
  const state = readWorkspaceState();
  if (state.theme === theme) return;
  commit({ ...state, theme }, "preferences.theme_changed", { theme });
}

export function setDensity(density: "comfortable" | "compact"): void {
  const state = readWorkspaceState();
  if (state.density === density) return;
  commit({ ...state, density }, "preferences.density_changed", { density });
}

// ─── Reset (used by the verification harness) ─────────────────

export function resetWorkspaceStateForTests(): void {
  inMemoryState = DEFAULT_STATE;
  if (isBrowser()) localStorage.removeItem(STORAGE_KEY);
}

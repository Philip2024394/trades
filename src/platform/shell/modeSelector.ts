// Platform — Simple ↔ Workspace mode selector.
//
// ─── 3-question rule ────────────────────────────────────────────────
//
// 1. Why platform?  Mode is a shell-wide concern. Every App sees the
//    same current mode. Selector logic MUST live once, not per App.
//
// 2. Which future Apps benefit?  Every App. Marketplace shows lite
//    chrome in Simple, full workspace controls in Workspace. Zero
//    per-App conditional logic — Apps read `readWorkspaceState().mode`.
//
// 3. Which doc authorises?  ADR-050 + TRADE_CENTER_2_SPEC.md §21
//    "Simple Mode ↔ Workspace Mode (shell selector)".
//
// ─── Design ─────────────────────────────────────────────────────────
//
// Rules per spec §21.1:
//   • Anonymous OR zero workspace actions in 30 days → Simple.
//   • Any workspace action → Workspace (locked for 24h to prevent
//     flicker).
//   • Silent 30-day downgrade.
//
// Selector is a PURE function of the trailing 30-day activity window.
// Workspace actions are events fired by Apps when a user creates a
// Saved List, sends a Quote, files an Estimate, places an Order, or
// posts to a Canteen. This module lists them so downstream event
// listeners can react uniformly.
//
// Activity events fanned from event bus in wave 2. Week 2 exposes
// the pure logic + the setMode() effect; wave 2 wires the event
// listeners.

import { readWorkspaceState, setMode } from "@/platform/sdk/workspaceState";
import type { WorkspaceMode } from "@/platform/sdk/workspaceState";

/** Event kinds that promote the user to Workspace Mode. Adding a
 *  new event here MUST also update the promotion pipeline downstream
 *  so existing users are re-promoted uniformly. */
export const PROMOTION_EVENT_KINDS = [
  "saved.list_created",
  "quote.drafted",
  "quote.sent",
  "estimator.project_created",
  "orders.placed",
  "community.post_created"
] as const;

export type PromotionEventKind = (typeof PROMOTION_EVENT_KINDS)[number];

/** Anonymous — no session, no history — always Simple. */
export function classifyAnonymous(): WorkspaceMode {
  return "simple";
}

/** Signed-in classification from an activity signal. */
export function classify(input: {
  lastWorkspaceActionMs: number | null;
  now?: number;
}): WorkspaceMode {
  const now = input.now ?? Date.now();
  if (input.lastWorkspaceActionMs == null) return "simple";
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const since = now - input.lastWorkspaceActionMs;
  return since <= thirtyDaysMs ? "workspace" : "simple";
}

/** Promotion — called by the event bus when a PROMOTION_EVENT_KINDS
 *  event fires. Idempotent; already-Workspace users no-op. */
export function promoteToWorkspaceMode(): void {
  const state = readWorkspaceState();
  if (state.mode === "workspace") return;
  setMode("workspace");
}

/** Silent downgrade — called by a daily job when the user's last
 *  workspace action is older than 30 days. */
export function downgradeIfInactive(input: {
  lastWorkspaceActionMs: number | null;
  now?: number;
}): boolean {
  const state = readWorkspaceState();
  if (state.mode !== "workspace") return false;
  const classified = classify(input);
  if (classified === "simple") {
    setMode("simple");
    return true;
  }
  return false;
}

// src/lib/nex-native/chat-render/registry.ts
//
// The single boundary between CORE and CHROME.
// ------------------------------------------------------------------
// The peer-chat page NEVER imports a chrome directly. It calls
// `resolveChromeSet(layoutStyle)` and renders whatever ChromeSet
// comes back. This is what makes 100+ themes safe:
//
//   · Adding a new chrome cannot break existing chromes (just adds
//     one entry to REGISTRY below)
//   · Removing a chrome (e.g. deprecating timeline_ribbon) is one
//     line here plus a migration
//   · An unknown layout_style falls back to `bubbles` so a
//     misconfigured theme row can never crash the peer chat surface
//
// See ./README.md for the full doctrine.

import type { ChromeSet, LayoutStyle } from "./contract";
import { bubblesChrome } from "./chrome/bubbles";
import { skyCardsChrome } from "./chrome/sky-cards";
import { timelineRibbonChrome } from "./chrome/timeline-ribbon";
import { terminalChrome } from "./chrome/terminal";

/** Registry · one entry per layout_style value. Every entry MUST
 *  implement the `ChromeSet` contract in ./contract.ts. */
const REGISTRY: Record<LayoutStyle, ChromeSet> = {
  bubbles: bubblesChrome,
  sky_cards: skyCardsChrome,
  timeline_ribbon: timelineRibbonChrome,
  terminal: terminalChrome,
};

/** Resolver · the ONLY function the peer-chat page calls. Unknown
 *  or missing layout_style falls back to `bubbles` so no
 *  misconfigured theme row can crash the surface. Logs the fallback
 *  once per unknown value (dev-only) so operators can spot data
 *  drift.
 *
 *  This function is pure · safe on both server and client.
 */
export function resolveChromeSet(
  layoutStyle: string | null | undefined,
): ChromeSet {
  if (!layoutStyle) return REGISTRY.bubbles;
  const hit = (REGISTRY as Record<string, ChromeSet | undefined>)[layoutStyle];
  if (!hit) {
    // Dev-only warn · never noisy in prod. A missing chrome is a
    // deploy-checklist failure (migration added the layout value
    // but no chrome folder). Fall back to bubbles to keep the user
    // out of a broken surface.
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(
        `[chat-render/registry] unknown layout_style="${layoutStyle}" · ` +
          `falling back to bubbles. Add a chrome folder + registry entry.`,
      );
    }
    return REGISTRY.bubbles;
  }
  return hit;
}

/** Exposed for admin / debug surfaces (e.g. a Chrome inspector
 *  page) so an operator can list every registered chrome without
 *  reaching into the private REGISTRY object. */
export function listRegisteredChromes(): ChromeSet[] {
  return Object.values(REGISTRY);
}

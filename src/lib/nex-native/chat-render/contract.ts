// src/lib/nex-native/chat-render/contract.ts
//
// The chat-render CONTRACT.
// ------------------------------------------------------------------
// Every chrome (bubbles · sky_cards · timeline_ribbon · terminal ·
// future chromes) MUST implement this contract. TypeScript enforces
// it — a chrome that doesn't export a valid `PeerChatShell` fails
// typecheck rather than blowing up in production.
//
// See ./README.md for the doctrine ("CORE + CHROME registry").
//
// This file has ZERO runtime code. Types only. Both server and
// client code can import from it freely.

import type { ComponentType } from "react";
import type { PortraitBloomShellProps } from "@/app/nex-native/chat/_portrait-bloom-shell";

/**
 * The props every ChromeSet.PeerChatShell must accept.
 *
 * We anchor to `PortraitBloomShellProps` (today's shell) rather than
 * defining a parallel interface, because:
 *   · every callsite already builds these props
 *   · they encode the SEALED shape (E2E ciphertext + presence + reply
 *     state + attachment state + shop feed) that CORE hands to CHROME
 *   · a chrome that needs a NEW prop is a doctrine change (add it
 *     here first, then in every chrome), not a per-chrome extension
 *
 * Rule: CHROME reads these props to RENDER. CHROME must not fork
 * their meaning. If a chrome needs to bypass a prop (e.g. ignore
 * encryption), that's a doctrine violation — reject the change.
 */
export type PeerChatShellProps = PortraitBloomShellProps;

/**
 * The complete set of components a chrome exports. For Phase 1 the
 * only required entry is `PeerChatShell`. Later phases add:
 *
 *   Phase 2 · shopSlider / productPage (per-chrome overrides)
 *   Phase 3 · header + composer + feed as separately-swappable slots
 *             so a chrome can inherit bubbles.Composer while owning
 *             its own MessageRow
 *   Phase 4 · featureFlagOverrides · declares which optional
 *             features (reactions · voice notes · mascots) this
 *             chrome supports
 *
 * The contract is deliberately narrow at Phase 1 so we don't design
 * for imagined future needs. Widen as real chromes ask.
 */
export interface ChromeSet {
  /** Machine id · matches nex_chat_theme.layout_style. Used only in
   *  audit + logging so an operator can see which chrome rendered. */
  id: string;
  /** Short human label · used in admin surfaces. */
  label: string;
  /** The peer-chat page renders exactly this component with the
   *  props CORE assembled. Same signature for every chrome. */
  PeerChatShell: ComponentType<PeerChatShellProps>;
}

/** Every possible layout_style value · SHOULD stay in lockstep with
 *  the nex_chat_theme.layout_style CHECK constraint. Adding a value
 *  here without adding it to the migration + registry is a bug. */
export type LayoutStyle =
  | "bubbles"
  | "sky_cards"
  | "timeline_ribbon"
  | "terminal";

export const LAYOUT_STYLES: readonly LayoutStyle[] = [
  "bubbles",
  "sky_cards",
  "timeline_ribbon",
  "terminal",
];

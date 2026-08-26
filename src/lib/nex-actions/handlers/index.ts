// NEX Actions · handler registry · F3 (2026-08-25).
//
// Maps handlerKey strings from the declarative registry to real handler
// implementations. The runtime looks up handlers via this map so the
// declarative registry.ts never imports handler code.

import type { NexActionHandler } from "../types";
import { grenadeHandler } from "./grenade";
import { toggleReactionHandler } from "./toggle-reaction";

const HANDLERS: Record<string, NexActionHandler> = {
  [grenadeHandler.key]:         grenadeHandler,
  [toggleReactionHandler.key]:  toggleReactionHandler,
  // Additional handlers land here as tiers 2 + 3 arrive:
  //   weather-post · birthday-post · reminder-schedule · currency-post
  //   find-venue (shared by all Tier-3 mascots)
};

export function resolveHandler(handlerKey: string): NexActionHandler | undefined {
  return HANDLERS[handlerKey];
}

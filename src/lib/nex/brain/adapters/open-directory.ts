// src/lib/nex/brain/adapters/open-directory.ts
//
// Stage 3.36 · Adapter: open_directory (Philip 2026-08-31).
//
// Simplest safe adapter · generates a directory URL and returns a
// "delivered" outcome carrying the URL as evidence. The executor's
// link_round_trip check then verifies the URL encodes the target
// refId or name. This is the only v1 path that produces a real
// VERIFIED terminal state.

import type { ActionAdapter, AdapterOutcome, ActionChainTarget } from "../action-audit";

function directoryUrl(target: ActionChainTarget): string {
  if (target.refId) return `/nex-app/centre?ref=${encodeURIComponent(target.refId)}`;
  return `/nex-app/centre?q=${encodeURIComponent(target.canonical)}`;
}

export const openDirectoryAdapter: ActionAdapter = {
  kind: "open_directory",
  async execute({ target }): Promise<AdapterOutcome> {
    if (!target.canonical && !target.refId) {
      return {
        kind: "rejected",
        reason: "target has neither canonical name nor refId · nothing to link to",
      };
    }
    const url = directoryUrl(target);
    return {
      kind: "delivered",
      proof: {
        kind: "link_round_trip",
        at: new Date().toISOString(),
        detail: url,   // executor's link_round_trip check inspects this
      },
    };
  },
};

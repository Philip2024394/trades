// NEX Actions · toggle-reaction handler · F3 (2026-08-25).
//
// Tier-1 reactions are client-fast and free · this handler is a NO-OP on
// the server. It exists so the runtime has a resolvable handlerKey. The
// actual reaction aggregation still runs client-side in NexAppHome (per
// the current architecture). Server-side reaction persistence is F4+.

import type { NexActionHandler, NexActionResult } from "../types";

export const toggleReactionHandler: NexActionHandler = {
  key: "toggle-reaction",
  async execute(): Promise<NexActionResult> {
    return { ok: true, kind: "noop" };
  },
};

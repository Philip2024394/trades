// NEX Actions · rate limit · F3 (2026-08-25).
//
// MVP: in-memory sliding-window per (userId, actionId). Enough for a single
// dev instance. F4 will move this to a shared store (Redis or a DB table)
// so multiple app instances see the same counters.
//
// The map self-prunes on every check · never grows unbounded.

import type { NexAction, NexActionContext } from "../types";

type WindowEntry = { at: number };
const WINDOWS = new Map<string, WindowEntry[]>();

const SCOPE_MS: Record<"second" | "minute" | "hour" | "day", number> = {
  second: 1_000,
  minute: 60_000,
  hour:   3_600_000,
  day:    86_400_000,
};

export const rateLimitDeps = {
  async require(action: NexAction, ctx: NexActionContext): Promise<void> {
    const rl = action.rateLimit;
    if (!rl) return;
    const key = `${ctx.user.id}:${action.id}`;
    const scope = SCOPE_MS[rl.per];
    const now = ctx.invokedAt;
    const cutoff = now - scope;
    const arr = (WINDOWS.get(key) ?? []).filter((e) => e.at > cutoff);
    if (arr.length >= rl.max) {
      const oldest = arr[0]?.at ?? now;
      const retryAfterSec = Math.max(1, Math.ceil((oldest + scope - now) / 1000));
      throw { code: "rate-limited" as const, retryAfterSec };
    }
    arr.push({ at: now });
    WINDOWS.set(key, arr);
  },
};

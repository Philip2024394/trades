// NEX Actions · permissions · F3 (2026-08-25).
//
// Turns declarative `capabilities` on a NexAction into permission checks.
// MVP: check the user has the shape of a valid session; consumables that
// declare delete-own-message just need a user id (ownership itself is
// enforced INSIDE the grenade SQL function). Location tools require the
// user to have opted in (checked when F4 lands). This module never touches
// the database in F3 · it's a lightweight guard layer.

import type { NexAction, NexActionContext } from "../types";

export const permissionsDeps = {
  async require(action: NexAction, ctx: NexActionContext): Promise<void> {
    if (!ctx.user?.id) {
      throw { code: "unauthorised" as const };
    }
    const caps = action.capabilities ?? [];
    if (caps.includes("delete-any-message")) {
      // Reserved for moderation · not exposed to any Tier-1..3 mascot yet.
      throw { code: "forbidden" as const, reason: "moderation-only-capability" };
    }
    // "delete-own-message" · ownership enforced by chat_message_grenade_delete
    // (SQL) · nothing to do here at the runtime layer.
  },
};

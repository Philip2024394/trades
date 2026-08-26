// NEX Actions · audit deps · F3 (2026-08-25).
//
// The runtime writes an audit entry AFTER every action attempt (success or
// failure). For grenade success the SQL function nex.chat_message_grenade_delete
// already writes the primary safety_audit_event row · this module writes
// FAILURE audits (auth denied, rate-limited, insufficient sparks, handler
// crashed) so we have a full picture of all action attempts.
//
// Success audits for non-grenade actions land here too until each Tier-2/3
// action gets its own audit path.

import { Pool } from "pg";
import { getReservation } from "./reservation-store";
import type { NexAction, NexActionContext, NexActionResult } from "../types";

let _pool: Pool | null = null;
function pool(): Pool {
  if (_pool) return _pool;
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) throw new Error("NEX_POSTGRES_URL not set");
  _pool = new Pool({ connectionString: url, max: 5 });
  return _pool;
}

// Map an action.audit level + tier to a safety_audit_event.event_type. Only
// high-audit consumables land in safety_audit_event; low-audit reactions and
// intelligence actions log at application level (F4 will formalise that).
function eventTypeFor(action: NexAction): string | null {
  if (action.audit !== "high") return null;
  if (action.tier !== "consumable") return null;
  // For MVP only grenade exists · future consumables map here.
  if (action.id === "grenade") return "grenade";
  return null;
}

export const auditDeps = {
  async write(action: NexAction, ctx: NexActionContext, result: NexActionResult): Promise<void> {
    const eventType = eventTypeFor(action);
    if (!eventType) return;
    // Success · already written by the SQL function inside chat_message_grenade_delete.
    if (result.ok) return;
    // Failure · record so we can detect abuse patterns.
    const reservation = getReservation(ctx);
    const targetId = ctx.target?.kind === "message" ? ctx.target.messageId : "";
    const conversationId = ctx.target?.kind === "message" ? ctx.target.conversationId : null;
    const idempotencyKey = `${eventType}:fail:${ctx.user.id}:${targetId}:${ctx.invokedAt}`;
    const reason = "error" in result && result.error
      ? JSON.stringify(result.error)
      : "unknown";
    try {
      await pool().query(
        `SELECT nex.safety_audit_record_failure($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          eventType, action.id, ctx.user.id, ctx.user.displayName,
          "message", targetId, conversationId,
          reservation?.reservationId ?? null, reason.slice(0, 500), idempotencyKey,
        ],
      );
    } catch (e) {
      // Never let audit failure bubble up · action succeeded/failed on its own merits.
      console.error("[nex-actions audit] failure log write failed:", (e as Error).message);
    }
  },
};

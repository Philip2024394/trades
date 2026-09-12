// NEX Workforce v2 · Slice 1c · Heartbeat Manager
// ─────────────────────────────────────────────────────────────────────────────
// Runs INDEPENDENTLY of step execution (per Philip's correction 2026-09-04):
// a long-running step must NOT block the heartbeat timer. Uses setInterval
// so the timer fires on wall-clock cadence regardless of step activity.
//
// Contract:
//   const hb = new Heartbeat({ pool, agentId, workItemId, generation, intervalMs, onLoss });
//   hb.start()  → begins ticking; each tick calls nex_workforce.heartbeat(...)
//                 If it returns false → invokes onLoss() once
//                 If it throws transient → logs, continues (missed one)
//                 If it throws 3 in a row → invokes onLoss() (treated as catastrophic)
//   hb.stop()   → clears the timer, no more ticks
//   hb.isLost() → true if lease was lost
//
// The Agent's work loop must check hb.isLost() before each significant action
// (before persistence, before checkpoint, before starting a new step) AND must
// respond to the onLoss callback by aborting cleanly.

import pg from "pg";
import { withWorkforceRole } from "./with_workforce_role.mjs";

export class Heartbeat {
  constructor({ pool, agentId, workItemId, generation, intervalMs, onLoss, logger }) {
    if (!pool) throw new Error("Heartbeat: pool required");
    if (!agentId) throw new Error("Heartbeat: agentId required");
    if (!workItemId) throw new Error("Heartbeat: workItemId required");
    if (!Number.isInteger(generation)) throw new Error("Heartbeat: generation required (integer)");
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) throw new Error("Heartbeat: intervalMs must be positive");
    this.pool         = pool;
    this.agentId      = agentId;
    this.workItemId   = workItemId;
    this.generation   = generation;
    this.intervalMs   = intervalMs;
    this.onLoss       = onLoss ?? (() => {});
    this.logger       = logger ?? (() => {});
    this.timer        = null;
    this.lost         = false;
    this.consecutiveErrors = 0;
    this.tickCount    = 0;
    this.lastTickAt   = null;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => { this._tick().catch((e) => this._onTickError(e)); }, this.intervalMs);
    // Prevent the timer from keeping the event loop alive on graceful shutdown
    if (typeof this.timer.unref === "function") this.timer.unref();
    this.logger({ msg: "heartbeat.start", intervalMs: this.intervalMs, workItemId: this.workItemId });
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger({ msg: "heartbeat.stop", ticks: this.tickCount, lost: this.lost });
    }
  }

  isLost() { return this.lost; }

  async _tick() {
    if (this.lost) return; // don't tick after loss
    this.tickCount++;
    this.lastTickAt = Date.now();
    const r = await withWorkforceRole(this.pool, (c) =>
      c.query(
        "SELECT nex_workforce.heartbeat($1, $2, $3) AS ok",
        [this.agentId, this.workItemId, this.generation]
      ));
    if (r.rows[0].ok === true) {
      this.consecutiveErrors = 0;
      return;
    }
    // heartbeat function returned false → lease lost
    this._declareLost("heartbeat function returned false (lease lost)");
  }

  _onTickError(err) {
    this.consecutiveErrors++;
    this.logger({ msg: "heartbeat.error", err: err.message, consecutive: this.consecutiveErrors });
    if (this.consecutiveErrors >= 3) {
      this._declareLost(`3 consecutive heartbeat errors · last: ${err.message}`);
    }
  }

  _declareLost(reason) {
    if (this.lost) return;
    this.lost = true;
    this.stop();
    this.logger({ msg: "heartbeat.LOST", reason });
    try { this.onLoss(reason); } catch (e) { this.logger({ msg: "heartbeat.onLoss threw", err: e.message }); }
  }
}

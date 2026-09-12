// src/lib/nex/production-hygiene/delegation-reaper.ts
//
// WAVE-P-4 · GAP-10 · Delegation timeout reaper
// Founder BEGIN WAVE-P-4 · 2026-09-08
//
// Pure decision function · consumer (Master AI worker cron) applies
// the decisions to the real delegation ledger. This module NEVER
// writes to the ledger itself · that's out of WAVE-P-4 scope until
// separate wiring BEGIN.

import type { DelegationLike, ReaperConfig, ReaperDecision } from "./types";
import { DEFAULT_REAPER_CONFIG } from "./types";

/** Pure function · given a batch of delegations + config + now,
 *  return per-delegation decisions. */
export function reapDelegations(input: {
  delegations: readonly DelegationLike[];
  config?: ReaperConfig;
  now_ms?: number;
}): readonly ReaperDecision[] {
  const config = input.config ?? DEFAULT_REAPER_CONFIG;
  const now = input.now_ms ?? Date.now();
  const out: ReaperDecision[] = [];

  for (const d of input.delegations) {
    const created_ms = Date.parse(d.created_at_iso);
    if (!Number.isFinite(created_ms)) {
      out.push({ delegation_id: d.delegation_id, action: "keep" });
      continue;
    }

    // Explicit deadline honored first
    if (d.deadline_iso) {
      const dl = Date.parse(d.deadline_iso);
      if (Number.isFinite(dl) && now >= dl && !isTerminalStatus(d.status)) {
        out.push({
          delegation_id: d.delegation_id,
          action: "timeout",
          reason: `explicit deadline elapsed at ${d.deadline_iso}`,
          age_ms: now - created_ms,
        });
        continue;
      }
    }

    if (d.status === "PENDING") {
      const age = now - created_ms;
      if (age >= config.pending_max_age_ms) {
        out.push({
          delegation_id: d.delegation_id,
          action: "timeout",
          reason: `PENDING age ${Math.floor(age / 1000)}s exceeds cap ${Math.floor(config.pending_max_age_ms / 1000)}s`,
          age_ms: age,
        });
        continue;
      }
    }

    if (d.status === "IN_PROGRESS") {
      // Prefer accepted_at_iso as reference · else created_at_iso
      const ref_ms = d.accepted_at_iso ? Date.parse(d.accepted_at_iso) : created_ms;
      if (Number.isFinite(ref_ms)) {
        const age = now - ref_ms;
        if (age >= config.in_progress_max_age_ms) {
          out.push({
            delegation_id: d.delegation_id,
            action: "timeout",
            reason: `IN_PROGRESS age ${Math.floor(age / 1000)}s exceeds cap ${Math.floor(config.in_progress_max_age_ms / 1000)}s`,
            age_ms: age,
          });
          continue;
        }
      }
    }

    out.push({ delegation_id: d.delegation_id, action: "keep" });
  }

  return out;
}

function isTerminalStatus(s: DelegationLike["status"]): boolean {
  return s === "COMPLETED" || s === "FAILED" || s === "REJECTED" || s === "TIMED_OUT";
}

// src/lib/nex/marketing/deliverability/next-permitted-send.ts
//
// NEX Deliverability · Next-permitted-send calculator
// Founder-authorised programme · Session-5 · Part 12 · 2026-09-21.
//
// Combines Stage 2 sender capacity (bounded per-provider) with Session-5
// reputation state to answer "can this sender send N units right now?".
//
// **Doctrine preserved**:
//   * Provider limits read from marketing_sender_identity.capacity_source
//   * NEVER hard-coded provider limits (Clause 8)
//   * NEVER rotate senders to bypass a single sender's cap (Clause 8 preserved)
//   * Frozen or limited reputation → refuse regardless of capacity

import type { PoolClient } from "pg";
import { loadSenderById } from "../sender-pool/repository";
import { loadCapacity, SENDABLE_HEALTH_STATES } from "../sender-pool";
import { loadSenderReputation } from "./reputation";
import { loadDomainAuth } from "./domain-auth";
import type { NextPermittedSendInput, NextPermittedSendOutcome, ReputationState } from "./types";

/** Reputation states that block sending entirely. */
const HARD_BLOCK_STATES = new Set<ReputationState>(["frozen", "limited"]);

/** Reputation states that allow sending but with reduced ceiling. */
const WARN_STATES = new Set<ReputationState>(["warning", "watch"]);

export async function nextPermittedSend(
  client: PoolClient,
  input: NextPermittedSendInput,
): Promise<NextPermittedSendOutcome> {
  const requested = Math.max(1, Math.floor(input.requested_units));

  // 1 · Sender exists + healthy
  const sender = await loadSenderById(client, input.sender_id);
  if (!sender) return { kind: "sender_not_found", sender_id: input.sender_id };
  if (sender.authentication_state !== "verified") {
    return { kind: "sender_unhealthy", health_state: `authentication_state=${sender.authentication_state}` };
  }
  if (!SENDABLE_HEALTH_STATES.has(sender.health_state)) {
    return { kind: "sender_unhealthy", health_state: sender.health_state };
  }

  // 2 · Reputation floor
  const rep = await loadSenderReputation(client, input.sender_id);
  if (rep && HARD_BLOCK_STATES.has(rep.reputation_state)) {
    return {
      kind: "reputation_hold",
      reputation_state: rep.reputation_state,
      reason: rep.reputation_reason ?? "reputation floor breached",
    };
  }

  // 3 · Domain auth · advisory only in this session · never blocks silently.
  // A future wave can promote domain auth misalignment to a hard block.
  const auth = sender.sending_domain ? await loadDomainAuth(client, sender.sending_domain) : null;
  if (auth && !auth.aligned && auth.dmarc_status === "reject_policy") {
    return {
      kind: "domain_auth_blocked",
      reason: `sending_domain ${sender.sending_domain} · DMARC reject policy without alignment · SPF=${auth.spf_status} DKIM=${auth.dkim_status}`,
    };
  }

  // 4 · Capacity (Stage 2)
  const cap = await loadCapacity(client, sender, (input.now ?? (() => new Date()))());
  const effective = cap.effective_remaining;
  if (effective !== null && effective <= 0) {
    return {
      kind: "capacity_exhausted",
      remaining_hourly: cap.hourly_remaining ?? 0,
      remaining_daily: cap.daily_remaining ?? 0,
    };
  }

  // 5 · Compute permitted units respecting BOTH capacity + reputation ceiling
  const capacity_ceiling = effective ?? requested;
  const reputation_ceiling = rep && WARN_STATES.has(rep.reputation_state)
    ? Math.floor(capacity_ceiling * (rep.reputation_state === "watch" ? 0.75 : 0.5))
    : capacity_ceiling;
  const permitted = Math.max(0, Math.min(requested, capacity_ceiling, reputation_ceiling));

  if (permitted === 0) {
    // Reputation reduced allowance to zero
    return {
      kind: "reputation_hold",
      reputation_state: rep?.reputation_state ?? "unknown",
      reason: rep?.reputation_reason ?? "reputation ceiling reduced permitted units to 0",
    };
  }

  const reason_parts = [
    `capacity ${effective ?? "unbounded"}`,
    rep ? `reputation ${rep.reputation_state}` : "reputation unknown",
    auth ? `domain ${auth.aligned ? "aligned" : "not-aligned"} (SPF=${auth.spf_status} DKIM=${auth.dkim_status} DMARC=${auth.dmarc_status})` : "domain auth not-checked",
  ];
  return {
    kind: "permitted",
    permitted_units: permitted,
    reason: reason_parts.join(" · "),
  };
}

// src/lib/nex/marketing/sender-pool/selection.ts
//
// NEX Managed Email Marketing · Stage 2 · Sender selection engine
// Founder-authorised programme (Clauses 4/8/9/10).
//
// Deterministic · lane-aware · member-isolated · authentication-required ·
// capacity-respecting sender selection.
//
// **Founder-locked selection order**:
//   1. Lane match (auto/member/founder)
//   2. Member scope enforced when lane='member'
//   3. authentication_state = 'verified'
//   4. health_state ∈ SENDABLE_HEALTH_STATES
//   5. Sufficient capacity for the request (effective_remaining >= need)
//   6. Deterministic tie-break (lowest hourly_used · then lowest daily_used · then sender_id lex order)
//
// If NO candidate satisfies all constraints · selection returns
// no_eligible_sender with a specific SelectionRefusalReason · caller must
// WAIT / QUEUE. Never fabricate a candidate. Never bypass a rule to fill
// the request.

import type { PoolClient } from "pg";
import type { SelectionInput, SelectionOutcome, SelectionRefusalReason, SenderIdentity, SenderCapacity } from "./types";
import { SENDABLE_HEALTH_STATES } from "./types";
import { loadCapacity } from "./capacity";
import { loadCandidatesForLane } from "./repository";

// ─── Public API ─────────────────────────────────────────────────────
export async function selectSender(
  client: PoolClient,
  input: SelectionInput,
): Promise<SelectionOutcome> {
  const now = (input.now ?? (() => new Date()))();
  const need = input.need ?? 1;

  // ─── Validate input ────────────────────────────────────────────
  if (input.lane === "member" && !input.member_id) {
    return { kind: "no_eligible_sender", reason: "invalid_input", candidates_considered: 0 };
  }

  // ─── Load lane-scoped candidates ──────────────────────────────
  const candidates = await loadCandidatesForLane(client, input.lane, input.member_id ?? null);

  if (candidates.length === 0) {
    return {
      kind: "no_eligible_sender",
      reason: input.lane === "member" ? "member_scope_mismatch" : "no_authorised_sender",
      candidates_considered: 0,
    };
  }

  // ─── Filter · deterministic reason accumulation ────────────────
  const filtered: Array<{ sender: SenderIdentity; capacity: SenderCapacity }> = [];
  const refusal_signals: Record<SelectionRefusalReason, number> = {
    lane_mismatch: 0,
    member_scope_mismatch: 0,
    authentication_required: 0,
    health_blocked: 0,
    capacity_exhausted: 0,
    no_authorised_sender: 0,
    invalid_input: 0,
  };

  for (const sender of candidates) {
    // Auth check (Clause 9)
    if (sender.authentication_state !== "verified") {
      refusal_signals.authentication_required += 1;
      continue;
    }
    // Health check
    if (!SENDABLE_HEALTH_STATES.has(sender.health_state)) {
      refusal_signals.health_blocked += 1;
      continue;
    }
    // Capacity check (Clause 8/10)
    const capacity = await loadCapacity(client, sender, now);
    const remaining = capacity.effective_remaining;
    if (remaining !== null && remaining < need) {
      refusal_signals.capacity_exhausted += 1;
      continue;
    }
    filtered.push({ sender, capacity });
  }

  if (filtered.length === 0) {
    // Report the DOMINANT refusal reason · deterministic
    const reason = pickDominantReason(refusal_signals);
    return { kind: "no_eligible_sender", reason, candidates_considered: candidates.length };
  }

  // ─── Rank · deterministic tie-break ───────────────────────────
  filtered.sort((a, b) => rankSender(a, b, input.prefer_provider));

  const chosen = filtered[0];
  return { kind: "selected", sender: chosen.sender, capacity: chosen.capacity };
}

// ─── Ranking (pure · deterministic · exposed for tests) ────────────
export function rankSender(
  a: { sender: SenderIdentity; capacity: SenderCapacity },
  b: { sender: SenderIdentity; capacity: SenderCapacity },
  prefer_provider: SelectionInput["prefer_provider"],
): number {
  // Weak provider preference (not enforced when unavailable · so we prefer but don't block)
  if (prefer_provider) {
    const a_pref = a.sender.provider === prefer_provider ? 0 : 1;
    const b_pref = b.sender.provider === prefer_provider ? 0 : 1;
    if (a_pref !== b_pref) return a_pref - b_pref;
  }

  // Lower hourly_used first · load distribution WITHIN each sender's own capacity
  // (NOT rotation to bypass limits · each sender still bounded by its own cap)
  const a_hu = a.capacity.hourly_used;
  const b_hu = b.capacity.hourly_used;
  if (a_hu !== b_hu) return a_hu - b_hu;

  // Then lower daily_used
  const a_du = a.capacity.daily_used;
  const b_du = b.capacity.daily_used;
  if (a_du !== b_du) return a_du - b_du;

  // Deterministic final tie-break · lex order of sender_id
  return a.sender.sender_id.localeCompare(b.sender.sender_id);
}

function pickDominantReason(signals: Record<SelectionRefusalReason, number>): SelectionRefusalReason {
  // Priority order · matches typical operator triage sequence
  if (signals.capacity_exhausted > 0) return "capacity_exhausted";
  if (signals.health_blocked > 0) return "health_blocked";
  if (signals.authentication_required > 0) return "authentication_required";
  if (signals.member_scope_mismatch > 0) return "member_scope_mismatch";
  if (signals.no_authorised_sender > 0) return "no_authorised_sender";
  return "lane_mismatch";
}

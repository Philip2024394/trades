// src/lib/nex/marketing/auto/operating-budget.ts
//
// NEX Managed Email Marketing · Stage 5 · Operating budget accounting
// Founder-authorised programme.
//
// **AUTO lane ONLY.** Member packages remain untouched (Stage 3 hard-lock).
// This module NEVER reads/writes nex.marketing_package or its ledger.
//
// Reservation-based semantics identical to Stage 3:
//   reserve() → consume() (terminal · unit spent)
//                OR release() (unit refunded)
//
// Idempotent (Wave 2 D2 key on attribution). Concurrency-safe (conditional
// UPDATE with capacity guard). Clause 8 (no evasion) not applicable at this
// layer — the sender pool enforces provider limits. Operating budget
// enforces NEX's own commercial ceiling.

import type { PoolClient } from "pg";
import { deriveIdempotencyKey } from "../../durability/idempotency-key";

// ─── Types ──────────────────────────────────────────────────────────
export type BudgetStatus = "active" | "paused" | "exhausted" | "archived";
export type BudgetAttributionState = "reserved" | "consumed" | "released";

export interface OperatingBudget {
  readonly budget_id: string;
  readonly name: string;
  readonly display_name: string | null;
  readonly purpose: string | null;
  readonly hourly_capacity: number | null;
  readonly daily_capacity: number | null;
  readonly monthly_capacity: number | null;
  readonly purchased_capacity: number;
  readonly reserved_capacity: number;
  readonly consumed_capacity: number;
  readonly status: BudgetStatus;
  readonly paused_reason: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface BudgetAttribution {
  readonly attribution_id: string;
  readonly idempotency_key: string;
  readonly budget_id: string;
  readonly campaign_id: string;
  readonly contact_id: string;
  readonly queue_id: string | null;
  readonly state: BudgetAttributionState;
  readonly units: number;
  readonly reserved_at: string;
  readonly consumed_at: string | null;
  readonly released_at: string | null;
  readonly release_reason: string | null;
}

export interface ReserveBudgetInput {
  readonly budget_id: string;
  readonly campaign_id: string;
  readonly contact_id: string;
  readonly queue_id?: string;
  readonly attempt_id?: string | number;
  readonly units?: number;
  readonly actor?: string;
}

export type ReserveBudgetOutcome =
  | { kind: "reserved"; attribution: BudgetAttribution }
  | { kind: "already_attributed"; attribution: BudgetAttribution }
  | { kind: "capacity_exhausted"; budget_id: string; remaining: number }
  | { kind: "budget_not_active"; budget_id: string; status: BudgetStatus }
  | { kind: "budget_not_found"; budget_id: string };

// ─── Public API ─────────────────────────────────────────────────────
export async function createBudget(client: PoolClient, input: {
  name: string;
  display_name?: string;
  purpose?: string;
  purchased_capacity: number;
  hourly_capacity?: number;
  daily_capacity?: number;
  monthly_capacity?: number;
  actor: string;
}): Promise<OperatingBudget> {
  const res = await client.query(
    `INSERT INTO nex.marketing_operating_budget
       (name, display_name, purpose, purchased_capacity,
        hourly_capacity, daily_capacity, monthly_capacity, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
     RETURNING *`,
    [
      input.name,
      input.display_name ?? null,
      input.purpose ?? null,
      input.purchased_capacity,
      input.hourly_capacity ?? null,
      input.daily_capacity ?? null,
      input.monthly_capacity ?? null,
    ],
  );
  const row = rowToBudget(res.rows[0]);
  await appendAudit(client, row.budget_id, "created", null, { name: row.name, purchased: row.purchased_capacity }, input.actor);
  return row;
}

export async function loadBudgetById(client: PoolClient, budget_id: string): Promise<OperatingBudget | null> {
  const res = await client.query(
    `SELECT * FROM nex.marketing_operating_budget WHERE budget_id=$1`,
    [budget_id],
  );
  return res.rows.length === 0 ? null : rowToBudget(res.rows[0]);
}

export async function loadBudgetByName(client: PoolClient, name: string): Promise<OperatingBudget | null> {
  const res = await client.query(
    `SELECT * FROM nex.marketing_operating_budget WHERE name=$1`,
    [name],
  );
  return res.rows.length === 0 ? null : rowToBudget(res.rows[0]);
}

export function deriveBudgetAttributionKey(input: {
  budget_id: string;
  campaign_id: string;
  contact_id: string;
  queue_id?: string;
  attempt_id?: string | number;
}): string {
  return deriveIdempotencyKey({
    workflow_id: `ob:${input.budget_id}`,
    activity_name: "auto_send_attribution",
    attempt_id: `${input.campaign_id}:${input.contact_id}:${input.queue_id ?? "-"}:${input.attempt_id ?? "1"}`,
  });
}

export async function reserveBudget(client: PoolClient, input: ReserveBudgetInput): Promise<ReserveBudgetOutcome> {
  const units = input.units ?? 1;
  const actor = input.actor ?? "system:auto-executor";
  const idempotency_key = deriveBudgetAttributionKey(input);

  // Idempotent replay
  const existing = await client.query(
    `SELECT * FROM nex.marketing_operating_budget_attribution WHERE idempotency_key=$1`,
    [idempotency_key],
  );
  if (existing.rows.length > 0) {
    return { kind: "already_attributed", attribution: rowToAttribution(existing.rows[0]) };
  }

  // Load budget
  const budget = await loadBudgetById(client, input.budget_id);
  if (!budget) return { kind: "budget_not_found", budget_id: input.budget_id };
  if (budget.status !== "active") return { kind: "budget_not_active", budget_id: budget.budget_id, status: budget.status };

  // Conditional reserve (Stage 3 pattern)
  const capUpdate = await client.query(
    `UPDATE nex.marketing_operating_budget
        SET reserved_capacity = reserved_capacity + $1,
            updated_at = now()
      WHERE budget_id = $2
        AND status = 'active'
        AND reserved_capacity + consumed_capacity + $1 <= purchased_capacity
    RETURNING purchased_capacity, reserved_capacity, consumed_capacity`,
    [units, input.budget_id],
  );
  if (capUpdate.rowCount === 0) {
    const remaining = budget.purchased_capacity - budget.reserved_capacity - budget.consumed_capacity;
    return { kind: "capacity_exhausted", budget_id: input.budget_id, remaining: Math.max(0, remaining) };
  }

  // Insert attribution
  try {
    const attr = await client.query(
      `INSERT INTO nex.marketing_operating_budget_attribution
         (idempotency_key, budget_id, campaign_id, contact_id, queue_id, state, units)
       VALUES ($1, $2, $3, $4, $5, 'reserved', $6)
       RETURNING *`,
      [idempotency_key, input.budget_id, input.campaign_id, input.contact_id, input.queue_id ?? null, units],
    );
    await appendAudit(client, input.budget_id, "capacity_reserved", null, { campaign_id: input.campaign_id, contact_id: input.contact_id, units }, actor);
    return { kind: "reserved", attribution: rowToAttribution(attr.rows[0]) };
  } catch (e: any) {
    if (e && (e.code === "23505" || String(e).includes("unique"))) {
      // Race lost · roll back capacity increment
      await client.query(
        `UPDATE nex.marketing_operating_budget SET reserved_capacity = GREATEST(0, reserved_capacity - $1), updated_at = now() WHERE budget_id = $2`,
        [units, input.budget_id],
      );
      const winner = await client.query(
        `SELECT * FROM nex.marketing_operating_budget_attribution WHERE idempotency_key=$1`,
        [idempotency_key],
      );
      if (winner.rows.length > 0) return { kind: "already_attributed", attribution: rowToAttribution(winner.rows[0]) };
    }
    // Roll back on any other error
    await client.query(
      `UPDATE nex.marketing_operating_budget SET reserved_capacity = GREATEST(0, reserved_capacity - $1), updated_at = now() WHERE budget_id = $2`,
      [units, input.budget_id],
    );
    throw e;
  }
}

export async function consumeBudget(client: PoolClient, attribution_id: string, actor: string = "system:auto-executor"): Promise<{ ok: boolean; state?: BudgetAttributionState; reason?: string }> {
  const existing = await client.query(
    `SELECT * FROM nex.marketing_operating_budget_attribution WHERE attribution_id=$1`,
    [attribution_id],
  );
  if (existing.rows.length === 0) return { ok: false, reason: "attribution_not_found" };
  const attr = rowToAttribution(existing.rows[0]);
  if (attr.state === "consumed") return { ok: true, state: "consumed" }; // idempotent
  if (attr.state === "released") return { ok: false, state: "released", reason: "already_released" };

  const upd = await client.query(
    `UPDATE nex.marketing_operating_budget_attribution
        SET state = 'consumed', consumed_at = now()
      WHERE attribution_id = $1 AND state = 'reserved'
    RETURNING *`,
    [attribution_id],
  );
  if (upd.rowCount === 0) return { ok: false, reason: "race_lost" };

  await client.query(
    `UPDATE nex.marketing_operating_budget
        SET reserved_capacity = GREATEST(0, reserved_capacity - $1),
            consumed_capacity = consumed_capacity + $1,
            updated_at = now()
      WHERE budget_id = $2`,
    [attr.units, attr.budget_id],
  );
  await appendAudit(client, attr.budget_id, "capacity_consumed", null, { attribution_id, units: attr.units }, actor);
  return { ok: true, state: "consumed" };
}

export async function releaseBudget(client: PoolClient, attribution_id: string, reason: string, actor: string = "system:auto-executor"): Promise<{ ok: boolean; state?: BudgetAttributionState; err?: string }> {
  const existing = await client.query(
    `SELECT * FROM nex.marketing_operating_budget_attribution WHERE attribution_id=$1`,
    [attribution_id],
  );
  if (existing.rows.length === 0) return { ok: false, err: "attribution_not_found" };
  const attr = rowToAttribution(existing.rows[0]);
  if (attr.state === "released") return { ok: true, state: "released" };
  if (attr.state === "consumed") return { ok: false, err: "cannot_release_consumed" };

  const upd = await client.query(
    `UPDATE nex.marketing_operating_budget_attribution
        SET state = 'released', released_at = now(), release_reason = $1
      WHERE attribution_id = $2 AND state = 'reserved'
    RETURNING *`,
    [reason.slice(0, 500), attribution_id],
  );
  if (upd.rowCount === 0) return { ok: false, err: "race_lost" };

  await client.query(
    `UPDATE nex.marketing_operating_budget
        SET reserved_capacity = GREATEST(0, reserved_capacity - $1),
            updated_at = now()
      WHERE budget_id = $2`,
    [attr.units, attr.budget_id],
  );
  await appendAudit(client, attr.budget_id, "capacity_released", null, { attribution_id, units: attr.units, reason }, actor);
  return { ok: true, state: "released" };
}

// ─── Internals ──────────────────────────────────────────────────────
async function appendAudit(client: PoolClient, budget_id: string, event_type: string, from_state: Record<string, unknown> | null, to_state: Record<string, unknown> | null, actor: string): Promise<void> {
  await client.query(
    `INSERT INTO nex.marketing_operating_budget_audit (budget_id, event_type, from_state, to_state, actor, detail)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, '{}'::jsonb)`,
    [budget_id, event_type,
     from_state ? JSON.stringify(from_state) : null,
     to_state ? JSON.stringify(to_state) : null,
     actor],
  );
}

function rowToBudget(r: any): OperatingBudget {
  return {
    budget_id: r.budget_id, name: r.name, display_name: r.display_name, purpose: r.purpose,
    hourly_capacity: r.hourly_capacity, daily_capacity: r.daily_capacity, monthly_capacity: r.monthly_capacity,
    purchased_capacity: Number(r.purchased_capacity), reserved_capacity: Number(r.reserved_capacity), consumed_capacity: Number(r.consumed_capacity),
    status: r.status, paused_reason: r.paused_reason,
    created_at: r.created_at, updated_at: r.updated_at,
  };
}

function rowToAttribution(r: any): BudgetAttribution {
  return {
    attribution_id: r.attribution_id, idempotency_key: r.idempotency_key,
    budget_id: r.budget_id, campaign_id: r.campaign_id, contact_id: r.contact_id, queue_id: r.queue_id,
    state: r.state, units: Number(r.units),
    reserved_at: r.reserved_at, consumed_at: r.consumed_at, released_at: r.released_at, release_reason: r.release_reason,
  };
}

/** Compile-time boundary marker · verified by tests. */
export const _AUTO_BUDGET_IS_NOT_MEMBER_PACKAGE = "auto_lane_only_no_member_package_touch";

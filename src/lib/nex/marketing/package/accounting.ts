// src/lib/nex/marketing/package/accounting.ts
//
// NEX Managed Email Marketing · Stage 3 · Reservation-based accounting
// Founder-authorised programme.
//
// **The three critical operations**:
//   • reserve()  · attempt to hold N units for a queued send · concurrency-safe
//   • consume()  · confirm a reservation as delivered · terminal
//   • release()  · return a reservation to remaining · on failure/cancel
//
// **Idempotency** (Stage 3 hard-lock · retry-safe):
//   Every reserve() call is keyed by a Wave 2 D2 idempotency key derived from
//   (package_id, campaign_id, contact_id, queue_id, attempt_id). If a retry
//   hits the same key, the existing attribution is returned unchanged. No
//   double-consumption. No double-charge.
//
// **Concurrency** (verified in acceptance):
//   Two workers reserving simultaneously against limit=1 → exactly ONE
//   succeeds. Postgres conditional UPDATE (WHERE reserved+consumed+delta ≤
//   purchased) provides the atomic guarantee.
//
// **Lane isolation** (verified in acceptance):
//   AUTO and FOUNDER never call this module. Repository-level enforcement:
//   attribution.member_id must match input.member_id.

import type { PoolClient } from "pg";
import type {
  Package,
  PackageAttribution,
  ReserveInput,
  ReserveOutcome,
  ConsumeInput,
  ConsumeOutcome,
  ReleaseInput,
  ReleaseOutcome,
} from "./types";
import {
  CONSUMABLE_STATUSES,
  MemberIsolationViolationError,
} from "./types";
import { deriveIdempotencyKey } from "../../durability/idempotency-key";
import {
  loadPackageById,
  loadAttributionByKey,
  loadAttributionById,
  appendAudit,
  rowToAttribution,
  rowToPackage,
} from "./repository";

// ─── Idempotency-key derivation ────────────────────────────────────
/** Deterministic Wave 2 D2 key for package attribution. Same inputs always
 *  produce the same key · retry-safe. */
export function derivePackageAttributionKey(input: {
  package_id: string;
  campaign_id: string;
  contact_id: string;
  queue_id?: string;
  attempt_id?: string | number;
}): string {
  return deriveIdempotencyKey({
    workflow_id: `pkg:${input.package_id}`,
    activity_name: `attribute_send`,
    attempt_id: `${input.campaign_id}:${input.contact_id}:${input.queue_id ?? "-"}:${input.attempt_id ?? "1"}`,
  });
}

// ─── Reserve (concurrency-safe · idempotent) ───────────────────────
export async function reserve(client: PoolClient, input: ReserveInput): Promise<ReserveOutcome> {
  const units = input.units ?? 1;
  const actor = input.actor ?? "system:executor";
  const idempotency_key = derivePackageAttributionKey({
    package_id: input.package_id,
    campaign_id: input.campaign_id,
    contact_id: input.contact_id,
    queue_id: input.queue_id,
    attempt_id: input.attempt_id,
  });

  // ─── 1 · Idempotent replay check ───────────────────────────────
  const existing = await loadAttributionByKey(client, idempotency_key);
  if (existing) {
    // Isolation cross-check (defence in depth · caller may have wrong member_id)
    if (existing.member_id !== input.member_id) {
      await appendAudit(client, existing.package_id, "isolation_violation_attempt", null,
        { attempted_by_member: input.member_id, actual_member: existing.member_id },
        actor, { idempotency_key });
      return { kind: "member_isolation_violation", expected_member: existing.member_id, got_member: input.member_id };
    }
    return { kind: "already_attributed", attribution: existing };
  }

  // ─── 2 · Load package for validation ───────────────────────────
  const pkg = await loadPackageById(client, input.package_id);
  if (!pkg) {
    return { kind: "package_not_found", package_id: input.package_id };
  }

  // ─── 3 · Member isolation check (Clause 4) ─────────────────────
  if (pkg.member_id !== input.member_id) {
    await appendAudit(client, pkg.package_id, "isolation_violation_attempt", null,
      { attempted_by_member: input.member_id, actual_member: pkg.member_id },
      actor, { attempted_operation: "reserve" });
    return { kind: "member_isolation_violation", expected_member: pkg.member_id, got_member: input.member_id };
  }

  // ─── 4 · Status check ──────────────────────────────────────────
  if (!CONSUMABLE_STATUSES.has(pkg.status)) {
    return { kind: "package_not_consumable", package_id: pkg.package_id, status: pkg.status };
  }

  // ─── 5 · Atomic conditional reserve ────────────────────────────
  // Concurrency-safe: WHERE clause ensures reservation only succeeds if
  // reserved + consumed + units ≤ purchased. Postgres row-level lock
  // guarantees the last unit is claimed by exactly one worker.
  const capacityUpdate = await client.query(
    `UPDATE nex.marketing_package
        SET reserved_capacity = reserved_capacity + $1,
            updated_at = now()
      WHERE package_id = $2
        AND status = 'active'
        AND member_id = $3
        AND reserved_capacity + consumed_capacity + $1 <= purchased_capacity
    RETURNING purchased_capacity, reserved_capacity, consumed_capacity`,
    [units, input.package_id, input.member_id],
  );
  if (capacityUpdate.rowCount === 0) {
    // Determine why · load fresh state
    const fresh = await loadPackageById(client, input.package_id);
    const remaining = fresh ? Math.max(0, fresh.purchased_capacity - fresh.reserved_capacity - fresh.consumed_capacity) : 0;
    return { kind: "capacity_exhausted", package_id: input.package_id, remaining };
  }
  const cap_row = capacityUpdate.rows[0];

  // ─── 6 · Insert attribution ledger row (UNIQUE key protects vs race retry) ─
  let attribution_row: any;
  try {
    const attr = await client.query(
      `INSERT INTO nex.marketing_package_attribution
         (idempotency_key, package_id, member_id, campaign_id, contact_id, queue_id, state, units, detail)
       VALUES ($1, $2, $3, $4, $5, $6, 'reserved', $7, $8::jsonb)
       RETURNING *`,
      [
        idempotency_key,
        input.package_id,
        input.member_id,
        input.campaign_id,
        input.contact_id,
        input.queue_id ?? null,
        units,
        JSON.stringify({ attempt_id: input.attempt_id ?? null }),
      ],
    );
    attribution_row = attr.rows[0];
  } catch (e: any) {
    // Unique-violation on idempotency_key · a concurrent attempt won the race
    // · roll back our capacity increment and return the existing attribution
    if (e && (e.code === "23505" || String(e).includes("unique") || String(e).includes("duplicate"))) {
      await client.query(
        `UPDATE nex.marketing_package SET reserved_capacity = GREATEST(0, reserved_capacity - $1), updated_at = now()
          WHERE package_id = $2`,
        [units, input.package_id],
      );
      const existing_after_race = await loadAttributionByKey(client, idempotency_key);
      if (existing_after_race) {
        return { kind: "already_attributed", attribution: existing_after_race };
      }
      throw e;
    }
    // Any other error · roll back our capacity increment
    await client.query(
      `UPDATE nex.marketing_package SET reserved_capacity = GREATEST(0, reserved_capacity - $1), updated_at = now()
        WHERE package_id = $2`,
      [units, input.package_id],
    );
    throw e;
  }

  // ─── 7 · Audit ─────────────────────────────────────────────────
  await appendAudit(client, input.package_id, "capacity_reserved",
    { reserved_capacity: cap_row.reserved_capacity - units, consumed_capacity: cap_row.consumed_capacity },
    { reserved_capacity: cap_row.reserved_capacity, consumed_capacity: cap_row.consumed_capacity },
    actor, { campaign_id: input.campaign_id, contact_id: input.contact_id, units, idempotency_key });

  // ─── 8 · Auto-transition to 'exhausted' if this reservation filled the package ─
  if (cap_row.reserved_capacity + cap_row.consumed_capacity >= cap_row.purchased_capacity) {
    await client.query(
      `UPDATE nex.marketing_package SET status = 'exhausted', updated_at = now()
        WHERE package_id = $1 AND status = 'active'`,
      [input.package_id],
    );
    await appendAudit(client, input.package_id, "exhausted",
      { status: "active" }, { status: "exhausted" },
      "system:accounting", { reason: "capacity_fully_reserved_or_consumed" });
  }

  return { kind: "reserved", attribution: rowToAttribution(attribution_row) };
}

// ─── Consume · reserved → consumed (terminal) ──────────────────────
export async function consume(client: PoolClient, input: ConsumeInput): Promise<ConsumeOutcome> {
  const actor = input.actor ?? "system:executor";
  const existing = await loadAttributionById(client, input.attribution_id);
  if (!existing) return { kind: "attribution_not_found", attribution_id: input.attribution_id };

  if (existing.state === "consumed") {
    // Idempotent replay
    return { kind: "already_consumed", attribution: existing };
  }
  if (existing.state === "released") {
    return { kind: "invalid_state", current: "released" };
  }

  // Atomic transition · move units from reserved to consumed
  const attrUpdate = await client.query(
    `UPDATE nex.marketing_package_attribution
        SET state='consumed', consumed_at=now(), detail = detail || $1::jsonb
      WHERE attribution_id=$2 AND state='reserved'
    RETURNING *`,
    [JSON.stringify(input.detail ?? {}), input.attribution_id],
  );
  if (attrUpdate.rowCount === 0) {
    // Race lost · re-read
    const fresh = await loadAttributionById(client, input.attribution_id);
    if (fresh?.state === "consumed") return { kind: "already_consumed", attribution: fresh };
    return { kind: "invalid_state", current: fresh?.state ?? "released" };
  }

  const pkgUpdate = await client.query(
    `UPDATE nex.marketing_package
        SET reserved_capacity = GREATEST(0, reserved_capacity - $1),
            consumed_capacity = consumed_capacity + $1,
            updated_at = now()
      WHERE package_id = $2
    RETURNING reserved_capacity, consumed_capacity`,
    [existing.units, existing.package_id],
  );
  const p = pkgUpdate.rows[0];

  await appendAudit(client, existing.package_id, "capacity_consumed",
    { reserved_capacity: p.reserved_capacity + existing.units, consumed_capacity: p.consumed_capacity - existing.units },
    { reserved_capacity: p.reserved_capacity, consumed_capacity: p.consumed_capacity },
    actor, { attribution_id: input.attribution_id, units: existing.units });

  return { kind: "consumed", attribution: rowToAttribution(attrUpdate.rows[0]) };
}

// ─── Release · reserved → released (returns to remaining) ──────────
export async function release(client: PoolClient, input: ReleaseInput): Promise<ReleaseOutcome> {
  const actor = input.actor ?? "system:executor";
  const existing = await loadAttributionById(client, input.attribution_id);
  if (!existing) return { kind: "attribution_not_found", attribution_id: input.attribution_id };

  if (existing.state === "released") {
    return { kind: "already_released", attribution: existing };
  }
  if (existing.state === "consumed") {
    // Founder-locked: cannot un-consume a genuinely delivered send · refund policy is a separate concern
    return { kind: "cannot_release_consumed", attribution_id: input.attribution_id };
  }

  const attrUpdate = await client.query(
    `UPDATE nex.marketing_package_attribution
        SET state='released', released_at=now(), release_reason=$1
      WHERE attribution_id=$2 AND state='reserved'
    RETURNING *`,
    [input.reason.slice(0, 500), input.attribution_id],
  );
  if (attrUpdate.rowCount === 0) {
    const fresh = await loadAttributionById(client, input.attribution_id);
    if (fresh?.state === "released") return { kind: "already_released", attribution: fresh };
    if (fresh?.state === "consumed") return { kind: "cannot_release_consumed", attribution_id: input.attribution_id };
    return { kind: "attribution_not_found", attribution_id: input.attribution_id };
  }

  // Return capacity from reserved
  const pkgUpdate = await client.query(
    `UPDATE nex.marketing_package
        SET reserved_capacity = GREATEST(0, reserved_capacity - $1),
            updated_at = now()
      WHERE package_id = $2
    RETURNING reserved_capacity, consumed_capacity`,
    [existing.units, existing.package_id],
  );
  const p = pkgUpdate.rows[0];

  // If package was 'exhausted' due to reservations · this release may un-exhaust it back to 'active'
  const pkgRow = await loadPackageById(client, existing.package_id);
  if (pkgRow && pkgRow.status === "exhausted" && (pkgRow.purchased_capacity - pkgRow.reserved_capacity - pkgRow.consumed_capacity) > 0) {
    await client.query(
      `UPDATE nex.marketing_package SET status = 'active', updated_at = now()
        WHERE package_id = $1 AND status = 'exhausted'`,
      [existing.package_id],
    );
    await appendAudit(client, existing.package_id, "status_changed",
      { status: "exhausted" }, { status: "active" },
      "system:accounting", { reason: "capacity_released_from_exhausted" });
  }

  await appendAudit(client, existing.package_id, "capacity_released",
    { reserved_capacity: p.reserved_capacity + existing.units },
    { reserved_capacity: p.reserved_capacity },
    actor, { attribution_id: input.attribution_id, units: existing.units, reason: input.reason });

  return { kind: "released", attribution: rowToAttribution(attrUpdate.rows[0]) };
}

// ─── Enforce lane isolation at call boundary ───────────────────────
/** Called by any code path attempting to touch package accounting.
 *  Throws if lane is not 'member' · use this at the executor boundary. */
export function assertMemberLane(lane: string, caller: string): void {
  if (lane !== "member") {
    throw new (class extends Error {
      constructor() {
        super(`Package accounting is MEMBER-lane only · caller '${caller}' invoked with lane='${lane}' · three-lane operating doctrine violated.`);
        this.name = "LaneIsolationViolationError";
      }
    })();
  }
}

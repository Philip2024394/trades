// src/lib/nex/marketing/package/repository.ts
//
// NEX Managed Email Marketing · Stage 3 · Postgres persistence + state transitions
// Founder-authorised programme.

import type { PoolClient } from "pg";
import type {
  Package,
  PackageAttribution,
  PackageStatus,
  PackageTargeting,
  PackageAuditEventKind,
} from "./types";
import {
  VALID_PACKAGE_TRANSITIONS,
  InvalidPackageStatusTransitionError,
  assertPackageDenominationLanguage,
  PackageError,
} from "./types";

// ─── Row mappers ────────────────────────────────────────────────────
function rowToPackage(row: any): Package {
  return {
    package_id: row.package_id,
    member_id: row.member_id,
    package_type: row.package_type,
    display_name: row.display_name,
    purchased_capacity: Number(row.purchased_capacity),
    reserved_capacity: Number(row.reserved_capacity),
    consumed_capacity: Number(row.consumed_capacity),
    status: row.status,
    currency: row.currency,
    purchase_reference: row.purchase_reference,
    purchase_amount_minor: row.purchase_amount_minor == null ? null : Number(row.purchase_amount_minor),
    purchased_at: row.purchased_at,
    activated_at: row.activated_at,
    expires_at: row.expires_at,
    targeting: row.targeting ?? {},
    metadata: row.metadata ?? {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function rowToAttribution(row: any): PackageAttribution {
  return {
    attribution_id: row.attribution_id,
    idempotency_key: row.idempotency_key,
    package_id: row.package_id,
    member_id: row.member_id,
    campaign_id: row.campaign_id,
    contact_id: row.contact_id,
    queue_id: row.queue_id,
    state: row.state,
    units: Number(row.units),
    reserved_at: row.reserved_at,
    consumed_at: row.consumed_at,
    released_at: row.released_at,
    release_reason: row.release_reason,
    detail: row.detail ?? {},
  };
}

// ─── Create package ─────────────────────────────────────────────────
export interface CreatePackageInput {
  readonly member_id: string;
  readonly package_type: string;
  readonly display_name?: string;
  readonly purchased_capacity: number;
  readonly currency?: string;
  readonly purchase_reference?: string;
  readonly purchase_amount_minor?: number;
  readonly purchased_at?: Date;
  readonly expires_at?: Date;
  readonly targeting?: PackageTargeting;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly actor: string;
  /** Duplicate-purchase guard · idempotent purchase key. If a package with this key
   *  already exists for this member, return the existing package without creating a new one. */
  readonly purchase_idempotency_key?: string;
}

export async function createPackage(client: PoolClient, input: CreatePackageInput): Promise<Package> {
  // Founder-locked denomination guard (ADR-0003a Clause 3)
  assertPackageDenominationLanguage(input.package_type, input.display_name, "createPackage");

  if (input.purchased_capacity < 0) {
    throw new PackageError("invalid_capacity", `purchased_capacity must be >= 0 · got ${input.purchased_capacity}`);
  }

  // Idempotent purchase check · if reference matches existing package for this member, return it
  if (input.purchase_reference) {
    const existing = await client.query(
      `SELECT * FROM nex.marketing_package
        WHERE member_id = $1 AND purchase_reference = $2
        LIMIT 1`,
      [input.member_id, input.purchase_reference],
    );
    if (existing.rows.length > 0) {
      await appendAudit(client, existing.rows[0].package_id, "duplicate_purchase_attempt", null,
        { purchase_reference: input.purchase_reference },
        input.actor, { reason: "purchase_reference_already_used" });
      return rowToPackage(existing.rows[0]);
    }
  }

  const res = await client.query(
    `INSERT INTO nex.marketing_package
       (member_id, package_type, display_name, purchased_capacity, status,
        currency, purchase_reference, purchase_amount_minor, purchased_at, expires_at,
        targeting, metadata)
     VALUES ($1, $2, $3, $4, 'available',
             $5, $6, $7, $8, $9,
             $10::jsonb, $11::jsonb)
     RETURNING *`,
    [
      input.member_id,
      input.package_type,
      input.display_name ?? null,
      input.purchased_capacity,
      input.currency ?? null,
      input.purchase_reference ?? null,
      input.purchase_amount_minor ?? null,
      input.purchased_at?.toISOString() ?? null,
      input.expires_at?.toISOString() ?? null,
      JSON.stringify(input.targeting ?? {}),
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  const pkg = rowToPackage(res.rows[0]);
  await appendAudit(client, pkg.package_id, "created", null, {
    member_id: pkg.member_id,
    package_type: pkg.package_type,
    purchased_capacity: pkg.purchased_capacity,
  }, input.actor, { purchase_reference: input.purchase_reference ?? null });
  return pkg;
}

// ─── Load package (member-scoped where applicable) ─────────────────
export async function loadPackageById(client: PoolClient, package_id: string): Promise<Package | null> {
  const res = await client.query(`SELECT * FROM nex.marketing_package WHERE package_id=$1`, [package_id]);
  if (res.rows.length === 0) return null;
  return rowToPackage(res.rows[0]);
}

export async function listPackagesForMember(client: PoolClient, member_id: string): Promise<ReadonlyArray<Package>> {
  const res = await client.query(
    `SELECT * FROM nex.marketing_package WHERE member_id=$1 ORDER BY created_at DESC`,
    [member_id],
  );
  return res.rows.map(rowToPackage);
}

// ─── State transitions ─────────────────────────────────────────────
export async function transitionStatus(
  client: PoolClient,
  package_id: string,
  to_status: PackageStatus,
  actor: string,
  detail: Record<string, unknown> = {},
): Promise<Package> {
  const before = await loadPackageById(client, package_id);
  if (!before) throw new PackageError("package_not_found", `package ${package_id} not found`);

  const ok = VALID_PACKAGE_TRANSITIONS.some(t => t.from === before.status && t.to === to_status) || before.status === to_status;
  if (!ok) throw new InvalidPackageStatusTransitionError(before.status, to_status);

  // 'activated' sets activated_at if not already set
  const setActivated = to_status === "active" && !before.activated_at;
  const res = await client.query(
    `UPDATE nex.marketing_package
        SET status=$1,
            activated_at=CASE WHEN $2::boolean THEN now() ELSE activated_at END,
            updated_at=now()
      WHERE package_id=$3
      RETURNING *`,
    [to_status, setActivated, package_id],
  );
  const after = rowToPackage(res.rows[0]);
  const event_kind: PackageAuditEventKind =
    to_status === "active" && before.status === "paused" ? "resumed" :
    to_status === "active" && before.status === "available" ? "activated" :
    to_status === "paused" ? "paused" :
    to_status === "expired" ? "expired" :
    to_status === "cancelled" ? "cancelled" :
    to_status === "exhausted" ? "exhausted" :
    "status_changed";
  await appendAudit(client, package_id, event_kind,
    { status: before.status },
    { status: after.status },
    actor, detail);
  return after;
}

// ─── Audit append ──────────────────────────────────────────────────
export async function appendAudit(
  client: PoolClient,
  package_id: string,
  event_type: PackageAuditEventKind,
  from_state: Record<string, unknown> | null,
  to_state: Record<string, unknown> | null,
  actor: string,
  detail: Record<string, unknown>,
): Promise<void> {
  await client.query(
    `INSERT INTO nex.marketing_package_audit
       (package_id, event_type, from_state, to_state, actor, detail)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6::jsonb)`,
    [
      package_id,
      event_type,
      from_state ? JSON.stringify(from_state) : null,
      to_state ? JSON.stringify(to_state) : null,
      actor,
      JSON.stringify(detail),
    ],
  );
}

export async function loadAuditHistory(
  client: PoolClient,
  package_id: string,
  limit: number = 100,
): Promise<ReadonlyArray<{ audit_id: string; event_type: string; actor: string; at_iso: string; detail: unknown }>> {
  const res = await client.query(
    `SELECT audit_id, event_type, actor, at_iso, detail
       FROM nex.marketing_package_audit
      WHERE package_id=$1 ORDER BY at_iso DESC LIMIT $2`,
    [package_id, limit],
  );
  return res.rows;
}

// ─── Attribution lookups ───────────────────────────────────────────
export async function loadAttributionById(client: PoolClient, attribution_id: string): Promise<PackageAttribution | null> {
  const res = await client.query(
    `SELECT * FROM nex.marketing_package_attribution WHERE attribution_id=$1`,
    [attribution_id],
  );
  if (res.rows.length === 0) return null;
  return rowToAttribution(res.rows[0]);
}

export async function loadAttributionByKey(client: PoolClient, idempotency_key: string): Promise<PackageAttribution | null> {
  const res = await client.query(
    `SELECT * FROM nex.marketing_package_attribution WHERE idempotency_key=$1`,
    [idempotency_key],
  );
  if (res.rows.length === 0) return null;
  return rowToAttribution(res.rows[0]);
}

export async function listAttributionsForCampaign(client: PoolClient, campaign_id: string): Promise<ReadonlyArray<PackageAttribution>> {
  const res = await client.query(
    `SELECT * FROM nex.marketing_package_attribution WHERE campaign_id=$1 ORDER BY reserved_at DESC`,
    [campaign_id],
  );
  return res.rows.map(rowToAttribution);
}

export { rowToPackage, rowToAttribution };

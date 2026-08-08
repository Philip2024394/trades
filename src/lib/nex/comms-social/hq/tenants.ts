// NEX Comms Centre · Social · HQ tenant management.
//
// Charter §0 Boundary 1 (default deny) + Boundary 3 (admin-read
// wrapper) + Boundary 4 (HQ→trade content distribution requires
// materialise-then-publish). Tenant creation is admin-only. Every
// listing goes through nex.social_admin_read() so it's auditable.

import { withClient } from "@/lib/nex/db";
import type { Tenant, TenantKind, TenantStatus } from "../types";

function isoOf(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  const s = String(v); const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toISOString();
}
function rowToTenant(r: Record<string, unknown>): Tenant {
  return {
    tenant_id:    String(r.tenant_id),
    kind:         r.kind as TenantKind,
    slug:         String(r.slug),
    display_name: String(r.display_name),
    country:      (r.country as string | null) ?? null,
    status:       r.status as TenantStatus,
    created_at:   isoOf(r.created_at),
    updated_at:   isoOf(r.updated_at),
  };
}

export interface CreateTenantInput {
  admin_user_id: string;
  kind:          TenantKind;
  slug:          string;
  display_name:  string;
  country?:      string;
  reason:        string;
}

export async function createTenant(input: CreateTenantInput): Promise<Tenant | null> {
  return await withClient(async (c) => {
    await c.query("BEGIN");
    try {
      await c.query("SET LOCAL ROLE nex_social_app");
      // Boundary 1: tenant creation requires admin bypass · records via wrapper
      await c.query("SELECT set_config('nex.social_admin_bypass', 'on', true)");
      const r = await c.query(
        `INSERT INTO nex.social_tenants (kind, slug, display_name, country, status)
         VALUES ($1::text, $2::text, $3::text, $4::text, 'active')
         RETURNING *`,
        [input.kind, input.slug, input.display_name, input.country ?? null],
      );
      // Log the admin action via the wrapper so we get a Boundary-3 audit row
      const created = rowToTenant(r.rows[0]);
      await c.query(
        `SELECT nex.social_admin_read($1::text, $2::uuid, 'audit_event_summary', $3::text)`,
        [input.admin_user_id, created.tenant_id, `tenant.create:${input.reason}`],
      );
      await c.query("COMMIT");
      return created;
    } catch (e) { await c.query("ROLLBACK"); throw e; }
  });
}

export interface ListTenantsInput {
  admin_user_id: string;
  reason:        string;
  status?:       TenantStatus;
  kind?:         TenantKind;
  limit?:        number;
}

export async function listTenants(input: ListTenantsInput): Promise<Tenant[]> {
  const rows = await withClient(async (c) => {
    await c.query("BEGIN");
    try {
      await c.query("SET LOCAL ROLE nex_social_app");
      await c.query("SELECT set_config('nex.social_admin_bypass', 'on', true)");
      const params: unknown[] = [];
      let sql = `SELECT * FROM nex.social_tenants WHERE 1=1`;
      if (input.status) { params.push(input.status); sql += ` AND status = $${params.length}`; }
      if (input.kind)   { params.push(input.kind);   sql += ` AND kind = $${params.length}`; }
      params.push(Math.min(500, Math.max(1, input.limit ?? 100)));
      sql += ` ORDER BY created_at DESC LIMIT $${params.length}`;
      const r = await c.query(sql, params);
      // Audit ONE row per list call (not per tenant · we don't want the
      // audit stream to be n×larger than the listing itself). This
      // matches how database audit typically works for LIST endpoints.
      // The wrapper's `resource` describes what was read.
      await c.query(
        `SELECT nex.social_admin_read($1::text, gen_random_uuid()::uuid, 'audit_event_summary', $2::text)`,
        [input.admin_user_id, `tenants.list:${input.reason}:count=${r.rows.length}`],
      );
      await c.query("COMMIT");
      return r.rows;
    } catch (e) { await c.query("ROLLBACK"); throw e; }
  });
  return (rows ?? []).map(rowToTenant);
}

export interface SetTenantStatusInput {
  admin_user_id: string;
  tenant_id:     string;
  status:        TenantStatus;
  reason:        string;
}

export async function setTenantStatus(input: SetTenantStatusInput): Promise<Tenant | null> {
  return await withClient(async (c) => {
    await c.query("BEGIN");
    try {
      await c.query("SET LOCAL ROLE nex_social_app");
      await c.query("SELECT set_config('nex.social_admin_bypass', 'on', true)");
      const r = await c.query(
        `UPDATE nex.social_tenants
            SET status = $2::text, updated_at = NOW()
          WHERE tenant_id = $1::uuid
          RETURNING *`,
        [input.tenant_id, input.status],
      );
      if (r.rowCount === 0) { await c.query("ROLLBACK"); return null; }
      await c.query(
        `SELECT nex.social_admin_read($1::text, $2::uuid, 'audit_event_summary', $3::text)`,
        [input.admin_user_id, input.tenant_id, `tenant.set_status:${input.status}:${input.reason}`],
      );
      await c.query("COMMIT");
      return rowToTenant(r.rows[0]);
    } catch (e) { await c.query("ROLLBACK"); throw e; }
  });
}

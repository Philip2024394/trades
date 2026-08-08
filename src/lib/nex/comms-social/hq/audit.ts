// NEX Comms Centre · Social · HQ audit viewers.
//
// Two audit streams:
//   * nex.social_audit_events        · tenant-scoped actions (per-tenant)
//   * nex.social_admin_access_log    · every Boundary-3 cross-tenant read
//
// HQ admins can view both. Every access is itself audited via the
// admin_read wrapper (audit-the-audit-reads).

import { withClient } from "@/lib/nex/db";

export interface AuditRow {
  audit_id:    number | string;
  tenant_id:   string | null;
  event_type:  string;
  actor:       string;
  subject_kind: string | null;
  subject_id:   string | null;
  details:     Record<string, unknown>;
  created_at:  string;
}

export interface AdminAccessRow {
  access_id:        number | string;
  admin_user_id:    string;
  target_tenant_id: string;
  resource:         string;
  reason:           string;
  row_count:        number | null;
  accessed_at:      string;
}

function isoOf(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  const s = String(v); const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toISOString();
}

export async function listRecentAudit(input: {
  admin_user_id: string; reason: string; limit?: number;
}): Promise<AuditRow[]> {
  const rows = await withClient(async (c) => {
    await c.query("BEGIN");
    try {
      await c.query("SET LOCAL ROLE nex_social_app");
      await c.query("SELECT set_config('nex.social_admin_bypass', 'on', true)");
      const r = await c.query(
        `SELECT audit_id, tenant_id, event_type, actor, subject_kind, subject_id, details, created_at
           FROM nex.social_audit_events
          ORDER BY created_at DESC
          LIMIT $1`, [Math.min(500, Math.max(1, input.limit ?? 100))]);
      await c.query(
        `SELECT nex.social_admin_read($1::text, gen_random_uuid()::uuid, 'audit_event_summary', $2::text)`,
        [input.admin_user_id, `audit.list:${input.reason}:count=${r.rows.length}`]);
      await c.query("COMMIT");
      return r.rows;
    } catch (e) { await c.query("ROLLBACK"); throw e; }
  });
  return (rows ?? []).map((r: Record<string, unknown>) => ({
    audit_id:    r.audit_id as never,
    tenant_id:   (r.tenant_id as string | null) ?? null,
    event_type:  String(r.event_type),
    actor:       String(r.actor),
    subject_kind: (r.subject_kind as string | null) ?? null,
    subject_id:   (r.subject_id as string | null) ?? null,
    details:     (r.details as Record<string, unknown>) ?? {},
    created_at:  isoOf(r.created_at),
  }));
}

export async function listAdminAccessLog(input: {
  admin_user_id: string; reason: string; limit?: number;
}): Promise<AdminAccessRow[]> {
  const rows = await withClient(async (c) => {
    await c.query("BEGIN");
    try {
      await c.query("SET LOCAL ROLE nex_social_app");
      await c.query("SELECT set_config('nex.social_admin_bypass', 'on', true)");
      const r = await c.query(
        `SELECT access_id, admin_user_id, target_tenant_id, resource, reason, row_count, accessed_at
           FROM nex.social_admin_access_log
          ORDER BY accessed_at DESC
          LIMIT $1`, [Math.min(500, Math.max(1, input.limit ?? 100))]);
      await c.query(
        `SELECT nex.social_admin_read($1::text, gen_random_uuid()::uuid, 'audit_event_summary', $2::text)`,
        [input.admin_user_id, `admin_access.list:${input.reason}:count=${r.rows.length}`]);
      await c.query("COMMIT");
      return r.rows;
    } catch (e) { await c.query("ROLLBACK"); throw e; }
  });
  return (rows ?? []).map((r: Record<string, unknown>) => ({
    access_id:        r.access_id as never,
    admin_user_id:    String(r.admin_user_id),
    target_tenant_id: String(r.target_tenant_id),
    resource:         String(r.resource),
    reason:           String(r.reason),
    row_count:        (r.row_count as number | null) ?? null,
    accessed_at:      isoOf(r.accessed_at),
  }));
}

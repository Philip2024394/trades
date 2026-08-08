// NEX Comms Centre · Social · Phase 10 · tenant resolver for authenticated users.
//
// This module lets a signed-in Nex merchant discover their Social tenant
// WITHOUT the UI ever asking for a tenant_id UUID. The resolver reads
// nex.social_tenants filtered by owner_supabase_user_id (indexed) using
// the admin-bypass path — never crossing tenants because the filter is
// pinned to the caller's supabase_user_id, which the caller cannot spoof
// (it comes from getAuthenticatedUser).
//
// Composes with Charter §S-I: the resolver is a read-only lookup keyed
// by the calling user's identity. The returned tenant_id is then used
// by every subsequent request through withTenantClient() which enforces
// row-level isolation at the DB layer.

import { withClient } from "@/lib/nex/db";

export interface ResolvedTenant {
  tenant_id:    string;
  slug:         string;
  display_name: string;
  status:       "active" | "suspended" | "deleted";
  created_at:   string;
}

// Look up the Social tenant owned by this Supabase user, or null if the
// user has not yet provisioned one. Uses admin bypass because the caller
// (a signed-in user) cannot know their own tenant_id before the lookup,
// but the filter itself is scoped by their identity so no cross-tenant
// data can leak.
export async function resolveTenantForUser(
  supabase_user_id: string,
): Promise<ResolvedTenant | null> {
  if (!supabase_user_id || !supabase_user_id.trim()) return null;
  return await withClient(async (c) => {
    await c.query("BEGIN");
    try {
      await c.query("SET LOCAL ROLE nex_social_app");
      await c.query("SELECT set_config('nex.social_admin_bypass', 'on', true)");
      const r = await c.query(
        `SELECT tenant_id, slug, display_name, status, created_at
           FROM nex.social_tenants
          WHERE owner_supabase_user_id = $1::text
            AND status <> 'deleted'
          ORDER BY created_at ASC
          LIMIT 1`,
        [supabase_user_id],
      );
      await c.query("COMMIT");
      if (r.rowCount === 0) return null;
      const row = r.rows[0] as Record<string, unknown>;
      return {
        tenant_id:    String(row.tenant_id),
        slug:         String(row.slug),
        display_name: String(row.display_name),
        status:       row.status as ResolvedTenant["status"],
        created_at:   row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      };
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    }
  });
}

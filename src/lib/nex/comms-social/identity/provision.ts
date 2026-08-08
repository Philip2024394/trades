// NEX Comms Centre · Social · Phase 10 · self-serve tenant provisioning.
//
// Called only by the merchant-facing /api/nex/comms-social/provision
// endpoint after successful authentication. Creates:
//   1. A new social_tenants row (kind='trade') owned by the caller.
//   2. An owner role grant (nex.social_role_grants).
//   3. A starter content template (via ensureStarterTemplate).
//
// Every step is inside a single transaction that starts with SET LOCAL
// ROLE nex_social_app and the admin_bypass GUC — mirroring the pattern
// used by hq/tenants.ts::createTenant, but attributing the resulting
// tenant to the signed-in merchant.
//
// Idempotent by owner: if the caller already has a tenant, we return
// that tenant instead of creating a duplicate.

import { withClient } from "@/lib/nex/db";
import { resolveTenantForUser, type ResolvedTenant } from "./resolve";
import { ensureStarterTemplate } from "./starter-templates";

export interface ProvisionTenantInput {
  supabase_user_id: string;
  display_name:     string;
  country?:         string;
}

export interface ProvisionTenantResult {
  tenant:           ResolvedTenant;
  starter_template_id: string;
  created:          boolean;      // false if the caller already had a tenant
}

// Generate a URL-safe slug from a display name plus a short random
// suffix so two merchants with the same business name don't collide.
function slugify(displayName: string): string {
  const base = displayName.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "merchant";
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}

export async function provisionTenantForUser(
  input: ProvisionTenantInput,
): Promise<ProvisionTenantResult> {
  if (!input.supabase_user_id?.trim()) {
    throw new Error("provisionTenantForUser: supabase_user_id required");
  }
  if (!input.display_name?.trim()) {
    throw new Error("provisionTenantForUser: display_name required");
  }

  // Idempotence · if a tenant already exists for this user, return it.
  const existing = await resolveTenantForUser(input.supabase_user_id);
  if (existing) {
    const starter = await withClient(async (c) => {
      await c.query("BEGIN");
      try {
        await c.query("SET LOCAL ROLE nex_social_app");
        await c.query("SELECT set_config('nex.social_tenant_id', $1, true)", [existing.tenant_id]);
        const t = await ensureStarterTemplate(c, existing.tenant_id);
        await c.query("COMMIT");
        return t;
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      }
    });
    return {
      tenant: existing,
      starter_template_id: starter!.template_id,
      created: false,
    };
  }

  // New tenant · mirror createTenant() pattern with owner attribution.
  return await withClient(async (c) => {
    await c.query("BEGIN");
    try {
      await c.query("SET LOCAL ROLE nex_social_app");
      await c.query("SELECT set_config('nex.social_admin_bypass', 'on', true)");

      const slug = slugify(input.display_name);
      const tr = await c.query(
        `INSERT INTO nex.social_tenants
           (kind, slug, display_name, country, status, owner_supabase_user_id)
         VALUES ('trade', $1::text, $2::text, $3::text, 'active', $4::text)
         RETURNING tenant_id, slug, display_name, status, created_at`,
        [slug, input.display_name.trim(), input.country ?? null, input.supabase_user_id],
      );
      const row = tr.rows[0] as Record<string, unknown>;
      const tenant: ResolvedTenant = {
        tenant_id:    String(row.tenant_id),
        slug:         String(row.slug),
        display_name: String(row.display_name),
        status:       row.status as ResolvedTenant["status"],
        created_at:   row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      };

      // Owner role grant · perpetual (no expiry). ON CONFLICT DO NOTHING
      // in case the row already exists from a prior partial run.
      await c.query(
        `INSERT INTO nex.social_role_grants
           (tenant_id, user_id, role, granted_by, reason)
         VALUES ($1::uuid, $2::text, 'owner', $2::text, 'self-serve provisioning')
         ON CONFLICT (tenant_id, user_id, role) DO NOTHING`,
        [tenant.tenant_id, input.supabase_user_id],
      );

      // Boundary-3 audit for the tenant creation.
      await c.query(
        `SELECT nex.social_admin_read($1::text, $2::uuid, 'audit_event_summary', $3::text)`,
        [`nex-self-serve:${input.supabase_user_id}`, tenant.tenant_id, `tenant.create:self_serve_provision`],
      );

      // Now switch context to the new tenant so we can seed the starter
      // template with normal RLS enforcement. Clear bypass first.
      await c.query("SELECT set_config('nex.social_admin_bypass', '', true)");
      await c.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenant.tenant_id]);
      const starter = await ensureStarterTemplate(c, tenant.tenant_id);

      await c.query("COMMIT");
      return {
        tenant,
        starter_template_id: starter.template_id,
        created: true,
      };
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    }
  }) as ProvisionTenantResult;
}

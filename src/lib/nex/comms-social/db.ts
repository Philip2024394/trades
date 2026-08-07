// NEX Comms Centre · Social · tenant-scoped DB helper.
//
// Every SQL call must be tenant-scoped. `withTenantClient` sets the
// per-connection GUC `nex.social_tenant_id` so RLS policies enforce the
// tenant boundary at the DB layer. Missing tenant_id at the call site
// is a TypeScript error.
//
// Doctrine · S-I default-deny · every query traverses RLS.
//
// The admin-bypass path (`withAdminBypass`) is intentionally distinct.
// It is the ONLY function that turns on cross-tenant read access, and
// it does so only AFTER writing an audit row through
// nex.social_admin_read().

import { withClient, type PgClientLike } from "@/lib/nex/db";
import type { AdminReadableResourceKind, TenantId } from "./types";

/**
 * Run a query set scoped to a specific tenant. RLS enforces that any
 * SELECT/INSERT/UPDATE/DELETE against a `nex.social_*` table only
 * touches rows where `tenant_id = $tenant_id`. Cross-tenant reads
 * return zero rows; cross-tenant writes are rejected by RLS with a
 * check-constraint failure.
 */
export async function withTenantClient<T>(
  tenant_id: TenantId,
  fn: (c: PgClientLike) => Promise<T>,
): Promise<T | null> {
  if (!tenant_id) throw new Error("withTenantClient: tenant_id required");
  return withClient(async (c) => {
    // set_config with local=true scopes the GUC to the transaction. We
    // open a transaction explicitly so RLS-affecting state can't leak.
    await c.query("BEGIN");
    try {
      // SET LOCAL ROLE is mandatory · RLS only enforces against
      // non-superuser roles. See migration 030.
      await c.query("SET LOCAL ROLE nex_social_app");
      await c.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenant_id]);
      const result = await fn(c);
      await c.query("COMMIT");
      return result;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    }
  });
}

/**
 * Cross-tenant admin read (Boundary 3). The wrapper enforces that:
 *   1. The caller identifies themselves + a target tenant + resource + reason.
 *   2. An audit row is written to nex.social_admin_access_log BEFORE
 *      the bypass GUC is enabled.
 *   3. The bypass GUC is enabled only for the duration of the callback.
 *   4. The bypass is cleared before the transaction ends.
 *
 * Callers still target their reads at a specific tenant (RLS keys off
 * either tenant match OR bypass) — this ensures audit reasoning
 * remains attributable.
 *
 * NOTE: Admin bypass is READ-only. RLS policies on writes explicitly
 * exclude admin_bypass for INSERT/UPDATE/DELETE on tenant-owned tables.
 */
export async function withAdminBypass<T>(
  input: {
    admin_user_id:    string;
    target_tenant_id: TenantId;
    resource:         AdminReadableResourceKind;
    reason:           string;
  },
  fn: (c: PgClientLike) => Promise<T>,
): Promise<T | null> {
  if (!input.admin_user_id) throw new Error("withAdminBypass: admin_user_id required");
  if (!input.target_tenant_id) throw new Error("withAdminBypass: target_tenant_id required");
  if (!input.reason || !input.reason.trim()) {
    throw new Error("withAdminBypass: reason required · Boundary 3 policy");
  }
  return withClient(async (c) => {
    await c.query("BEGIN");
    try {
      // SET LOCAL ROLE first · see withTenantClient rationale.
      await c.query("SET LOCAL ROLE nex_social_app");
      // Audit row FIRST — before any bypass is enabled. Uses the wrapper
      // function which itself enforces reason presence.
      await c.query(
        "SELECT nex.social_admin_read($1::text, $2::uuid, $3::nex.social_admin_readable_resource, $4::text)",
        [input.admin_user_id, input.target_tenant_id, input.resource, input.reason],
      );
      // Also point the tenant GUC at the target so admin queries that
      // rely on the standard filter still work.
      await c.query("SELECT set_config('nex.social_tenant_id', $1, true)", [input.target_tenant_id]);
      // Bypass ON for the duration of the callback.
      await c.query("SELECT set_config('nex.social_admin_bypass', 'on', true)");
      const result = await fn(c);
      // Explicit reset before commit — belt and braces (SET LOCAL would
      // reset at commit anyway, but explicit is auditable).
      await c.query("SELECT set_config('nex.social_admin_bypass', '', true)");
      await c.query("COMMIT");
      return result;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    }
  });
}

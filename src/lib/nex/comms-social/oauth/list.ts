// NEX Comms Centre · Social · Phase 10 · merchant-facing accounts list.
//
// Returns the merchant's connected accounts WITHOUT ever surfacing
// encrypted tokens or DEK references. Every field returned is safe to
// display to the merchant. Called by the wizard and landing page.

import type { PgClientLike } from "@/lib/nex/db";
import type { TenantId, AccountStatus, SocialPlatform } from "../types";

export interface MerchantAccountView {
  account_id:            string;
  platform:              SocialPlatform;
  display_name:          string | null;
  platform_account_id:   string | null;
  status:                AccountStatus;
  connected_at:          string | null;
  last_success_at:       string | null;
  last_error:            string | null;
  token_expires_at:      string | null;
}

// Safe by construction · returns nothing sensitive.
// RLS enforces the tenant scope · caller is expected to invoke via
// withTenantClient() with the resolved tenant_id.
export async function listAccountsForTenant(
  client: PgClientLike,
  tenant_id: TenantId,
): Promise<MerchantAccountView[]> {
  const r = await client.query(
    `SELECT account_id, platform, display_name, platform_account_id,
            status, connected_at, last_success_at, last_error, token_expires_at
       FROM nex.social_accounts
      WHERE tenant_id = $1::uuid
      ORDER BY connected_at DESC NULLS LAST, updated_at DESC`,
    [tenant_id],
  );
  return (r.rows ?? []).map((row) => ({
    account_id:          String(row.account_id),
    platform:            row.platform as SocialPlatform,
    display_name:        (row.display_name as string | null) ?? null,
    platform_account_id: (row.platform_account_id as string | null) ?? null,
    status:              row.status as AccountStatus,
    connected_at:        toIso(row.connected_at),
    last_success_at:     toIso(row.last_success_at),
    last_error:          (row.last_error as string | null) ?? null,
    token_expires_at:    toIso(row.token_expires_at),
  }));
}

function toIso(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

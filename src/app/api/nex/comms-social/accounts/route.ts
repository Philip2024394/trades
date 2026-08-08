// GET /api/nex/comms-social/accounts
//
// Merchant-facing list of connected social accounts. Auth-gated ·
// resolves the caller's tenant automatically · never returns any
// token material.

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/nex/brains/_auth";
import { resolveTenantForUser } from "@/lib/nex/comms-social/identity/resolve";
import { listAccountsForTenant } from "@/lib/nex/comms-social/oauth/list";
import { withTenantClient } from "@/lib/nex/comms-social/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  const tenant = await resolveTenantForUser(auth.user.supabase_user_id);
  if (!tenant) {
    return NextResponse.json({ ok: true, accounts: [] });
  }
  const accounts = await withTenantClient(tenant.tenant_id, async (c) =>
    await listAccountsForTenant(c, tenant.tenant_id),
  );
  return NextResponse.json({ ok: true, accounts: accounts ?? [] });
}

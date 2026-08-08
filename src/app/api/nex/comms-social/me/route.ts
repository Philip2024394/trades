// GET /api/nex/comms-social/me
//
// The wizard's one-stop context resolver. Returns everything the
// merchant-facing UI needs to render the correct state WITHOUT ever
// exposing a UUID field for input.
//
// Auth: signed-in Nex user via getAuthenticatedUser().
//
// Response:
//   { ok: true,
//     user: { display_name, email },
//     tenant: null | { display_name, status, connected_accounts: [...],
//                      has_active_template },
//     tier_hint: "unknown" | "free" | "paid" }

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/nex/brains/_auth";
import { resolveTenantForUser } from "@/lib/nex/comms-social/identity/resolve";
import { listAccountsForTenant } from "@/lib/nex/comms-social/oauth/list";
import { withTenantClient } from "@/lib/nex/comms-social/db";
import { listTemplates } from "@/lib/nex/comms-social/content/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error, next_step: "sign_in" },
      { status: auth.status },
    );
  }

  const tenant = await resolveTenantForUser(auth.user.supabase_user_id);

  if (!tenant) {
    return NextResponse.json({
      ok: true,
      user: {
        display_name: auth.user.nex_user.display_name,
        email:        auth.user.email,
      },
      tenant: null,
      tier_hint: "unknown",
    });
  }

  // Load accounts + templates inside a single tenant-scoped transaction.
  const detail = await withTenantClient(tenant.tenant_id, async (c) => {
    const [accounts, templates] = await Promise.all([
      listAccountsForTenant(c, tenant.tenant_id),
      listTemplates(c, tenant.tenant_id),
    ]);
    return { accounts, templates };
  });

  const accounts = detail?.accounts ?? [];
  const templates = detail?.templates ?? [];

  return NextResponse.json({
    ok: true,
    user: {
      display_name: auth.user.nex_user.display_name,
      email:        auth.user.email,
    },
    tenant: {
      // tenant_id is returned only to the tenant's own owner (this is
      // the caller — resolveTenantForUser only matches the caller's
      // supabase_user_id). Advanced surfaces use it; the wizard doesn't.
      tenant_id:           tenant.tenant_id,
      display_name:        tenant.display_name,
      status:              tenant.status,
      connected_accounts:  accounts,
      has_active_template: templates.some((t) => t.status === "active"),
      created_at:          tenant.created_at,
    },
    tier_hint: "unknown",
  });
}

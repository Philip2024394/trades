// POST /api/nex/comms-social/publish-now
//
// One-shot merchant publish · session-resolved tenant · picks the
// first connected account for the requested platform · calls
// enqueuePublish with run_at=now. Every existing invariant enforced:
// tenant scope (RLS) · account_id validation · publish-intent two-phase
// · validator recheck at lease. This route just removes the UUID
// paperwork from the merchant.

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/nex/brains/_auth";
import { resolveTenantForUser } from "@/lib/nex/comms-social/identity/resolve";
import { withTenantClient } from "@/lib/nex/comms-social/db";
import { listAccountsForTenant } from "@/lib/nex/comms-social/oauth/list";
import { enqueuePublish } from "@/lib/nex/comms-social/scheduling/enqueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  const tenant = await resolveTenantForUser(auth.user.supabase_user_id);
  if (!tenant) {
    return NextResponse.json(
      { ok: false, error: "no_tenant" },
      { status: 409 },
    );
  }

  let body: { draft_id?: string; platform?: string };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  if (!body.draft_id || !body.platform) {
    return NextResponse.json(
      { ok: false, error: "draft_id + platform required" },
      { status: 400 },
    );
  }

  const draft_id = body.draft_id;
  const platform = body.platform;

  const result = await withTenantClient(tenant.tenant_id, async (c) => {
    const accounts = await listAccountsForTenant(c, tenant.tenant_id);
    const account = accounts.find((a) => a.platform === platform && a.status === "connected");
    if (!account) {
      return { ok: false as const, error: "no_connected_account_for_platform" };
    }
    const r = await enqueuePublish({
      client:      c,
      tenant_id:   tenant.tenant_id,
      draft_id,
      account_id:  account.account_id,
      platform,
      run_at:      new Date().toISOString(),
      enqueued_by: `user:${auth.user.supabase_user_id}`,
    });
    return { ok: true as const, enqueue: r };
  });

  if (!result || !result.ok) {
    return NextResponse.json(
      { ok: false, error: (result && "error" in result ? result.error : "enqueue_failed") },
      { status: 400 },
    );
  }
  if (!result.enqueue || result.enqueue.ok === false) {
    return NextResponse.json(
      { ok: false, error: result.enqueue?.error_class ?? "enqueue_failed", detail: result.enqueue?.detail },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    scheduled_id: result.enqueue.scheduled_id,
    status:       result.enqueue.status,
  });
}

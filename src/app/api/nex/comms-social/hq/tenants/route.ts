// GET  /api/nex/comms-social/hq/tenants?admin_user_id=&reason=&status=&kind=&limit=
// POST /api/nex/comms-social/hq/tenants   body: { admin_user_id, kind, slug, display_name, country?, reason }
// PATCH /api/nex/comms-social/hq/tenants   body: { admin_user_id, tenant_id, status, reason }
//
// HQ-only. Every call requires admin_user_id + reason; both land in
// nex.social_admin_access_log via the Boundary-3 wrapper.
import { NextResponse } from "next/server";
import { createTenant, listTenants, setTenantStatus } from "@/lib/nex/comms-social/hq/tenants";
import type { TenantKind, TenantStatus } from "@/lib/nex/comms-social/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function req400(err: string) { return NextResponse.json({ ok: false, error: err }, { status: 400 }); }

export async function GET(request: Request) {
  const url = new URL(request.url);
  const admin_user_id = url.searchParams.get("admin_user_id");
  const reason        = url.searchParams.get("reason");
  if (!admin_user_id || !reason) return req400("admin_user_id + reason required");
  const status = url.searchParams.get("status") as TenantStatus | null;
  const kind   = url.searchParams.get("kind")   as TenantKind   | null;
  const limit  = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;
  const rows = await listTenants({ admin_user_id, reason, status: status ?? undefined, kind: kind ?? undefined, limit });
  return NextResponse.json({ ok: true, tenants: rows });
}

export async function POST(request: Request) {
  let body: { admin_user_id?: string; kind?: TenantKind; slug?: string; display_name?: string; country?: string; reason?: string };
  try { body = await request.json() as typeof body; } catch { return req400("invalid_json"); }
  if (!body.admin_user_id || !body.kind || !body.slug || !body.display_name || !body.reason)
    return req400("admin_user_id + kind + slug + display_name + reason required");
  try {
    const t = await createTenant({ admin_user_id: body.admin_user_id, kind: body.kind, slug: body.slug, display_name: body.display_name, country: body.country, reason: body.reason });
    return NextResponse.json({ ok: true, tenant: t });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  let body: { admin_user_id?: string; tenant_id?: string; status?: TenantStatus; reason?: string };
  try { body = await request.json() as typeof body; } catch { return req400("invalid_json"); }
  if (!body.admin_user_id || !body.tenant_id || !body.status || !body.reason)
    return req400("admin_user_id + tenant_id + status + reason required");
  const t = await setTenantStatus({ admin_user_id: body.admin_user_id, tenant_id: body.tenant_id, status: body.status, reason: body.reason });
  if (!t) return NextResponse.json({ ok: false, error: "tenant_not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, tenant: t });
}

// POST /api/nex/comms-social/scheduling/categories · set mode
// Body: { tenant_id, category, mode, actor, actor_role }
//   actor_role is used to construct the RoleGrantSnapshot for permission
//   enforcement. Production wires this from an auth context; Phase 4
//   accepts it explicitly so tests can drive edge cases.
// GET  /api/nex/comms-social/scheduling/categories?tenant_id=
import { NextResponse } from "next/server";
import { withTenantClient } from "@/lib/nex/comms-social/db";
import { getCategoryMode, listCategoryModes, setCategoryMode, type AutomationMode, type CategoryName } from "@/lib/nex/comms-social/scheduling/categories";
import type { SocialRole } from "@/lib/nex/comms-social/types";
import type { RoleGrantSnapshot } from "@/lib/nex/comms-social/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { tenant_id?: string; category?: CategoryName; mode?: AutomationMode; actor?: string; actor_role?: SocialRole };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  if (!body.tenant_id || !body.category || !body.mode || !body.actor || !body.actor_role) {
    return NextResponse.json({ ok: false, error: "tenant_id + category + mode + actor + actor_role required" }, { status: 400 });
  }
  const grants: RoleGrantSnapshot[] = [{ role: body.actor_role, expires_at: null, revoked_at: null }];
  try {
    const row = await withTenantClient(body.tenant_id, async (c) =>
      await setCategoryMode({
        client: c, tenant_id: body.tenant_id!, category: body.category!, mode: body.mode!,
        actor: body.actor!, grants,
      }));
    return NextResponse.json({ ok: true, category: row });
  } catch (e) {
    const code = (e as Error & { code?: string }).code === "PERMISSION_DENIED" ? 403 : 500;
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: code });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenant_id = url.searchParams.get("tenant_id");
  if (!tenant_id) return NextResponse.json({ ok: false, error: "tenant_id required" }, { status: 400 });
  const category = url.searchParams.get("category") as CategoryName | null;
  const rows = await withTenantClient(tenant_id, async (c) =>
    category ? [await getCategoryMode(c, tenant_id, category)].filter(Boolean)
             : await listCategoryModes(c, tenant_id));
  return NextResponse.json({ ok: true, categories: rows ?? [] });
}

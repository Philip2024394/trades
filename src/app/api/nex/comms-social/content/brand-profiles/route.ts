// POST /api/nex/comms-social/content/brand-profiles · upsert
// GET  /api/nex/comms-social/content/brand-profiles?tenant_id=
import { NextResponse } from "next/server";
import { withTenantClient } from "@/lib/nex/comms-social/db";
import { getBrandProfile, upsertBrandProfile, type UpsertBrandProfileInput } from "@/lib/nex/comms-social/content/brand-profiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: Omit<UpsertBrandProfileInput, "client"> & { tenant_id?: string };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  if (!body.tenant_id) return NextResponse.json({ ok: false, error: "tenant_id required" }, { status: 400 });
  const p = await withTenantClient(body.tenant_id, async (c) =>
    await upsertBrandProfile({ client: c, ...body, tenant_id: body.tenant_id! }));
  return NextResponse.json({ ok: true, profile: p });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenant_id = url.searchParams.get("tenant_id");
  if (!tenant_id) return NextResponse.json({ ok: false, error: "tenant_id required" }, { status: 400 });
  const p = await withTenantClient(tenant_id, async (c) => await getBrandProfile(c, tenant_id));
  return NextResponse.json({ ok: true, profile: p ?? null });
}

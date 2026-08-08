// POST /api/nex/comms-social/provision
//
// Self-serve tenant provisioning for a signed-in Nex merchant.
// Idempotent · repeated calls return the caller's existing tenant.
// Creates: social_tenants row · owner role grant · starter template.
//
// Auth: signed-in Nex user via getAuthenticatedUser().
// Body: { display_name: string, country?: string }

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/nex/brains/_auth";
import { provisionTenantForUser } from "@/lib/nex/comms-social/identity/provision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  let body: { display_name?: string; country?: string };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const displayName = (body.display_name ?? auth.user.nex_user.display_name ?? auth.user.email ?? "").trim();
  if (displayName.length < 2) {
    return NextResponse.json(
      { ok: false, error: "display_name required (at least 2 characters)" },
      { status: 400 },
    );
  }

  try {
    const r = await provisionTenantForUser({
      supabase_user_id: auth.user.supabase_user_id,
      display_name:     displayName,
      country:          body.country,
    });
    return NextResponse.json({
      ok: true,
      created: r.created,
      tenant: {
        display_name: r.tenant.display_name,
        status:       r.tenant.status,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

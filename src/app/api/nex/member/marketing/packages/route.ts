// GET /api/nex/member/marketing/packages
//
// Returns the member's own marketing packages. Never exposes another
// member's data. Zero contact-address disclosure.

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { resolveMemberAuth, computeCapacity } from "@/lib/nex/marketing/member";
import { listPackagesForMember } from "@/lib/nex/marketing/package";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = resolveMemberAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });

  const client = await pool.connect();
  try {
    const packages = await listPackagesForMember(client, auth.member_id);
    return NextResponse.json({
      ok: true,
      member_id: auth.member_id,
      packages: packages.map(p => ({
        package_id: p.package_id,
        package_type: p.package_type,
        display_name: p.display_name,
        status: p.status,
        capacity: computeCapacity(p),
        expires_at: p.expires_at,
        activated_at: p.activated_at,
      })),
    });
  } finally {
    client.release();
  }
}

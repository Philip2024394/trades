// GET /api/nex/founder/marketing/inventory
//
// NEX Email Marketing HQ · Founder Control Centre · Email Storage inventory
// Founder-authorised programme (Email Storage UI wave · 2026-09-21).
//
// Returns aggregate counts + country/category/source distribution.
// **Never returns email addresses.** **Never returns contact IDs.**

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { resolveFounderAuth, loadEmailStorageInventory } from "@/lib/nex/marketing/founder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });

  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });

  const client = await pool.connect();
  try {
    const inventory = await loadEmailStorageInventory(client, auth);
    return NextResponse.json({ ok: true, inventory });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Graceful degradation for schema-not-applied case (matches other founder routes)
    if (/does not exist/i.test(msg)) {
      return NextResponse.json({
        ok: true,
        inventory: null,
        warning: "schema_not_applied",
        detail: msg,
      });
    }
    return NextResponse.json({ ok: false, error: "internal_error", detail: msg }, { status: 500 });
  } finally {
    client.release();
  }
}

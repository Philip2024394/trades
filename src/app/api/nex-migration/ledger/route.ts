// GET /api/nex-migration/ledger · returns the persistent schema ledger

import { NextResponse } from "next/server";
import { loadLedger } from "@/lib/nex-migration";

export const dynamic = "force-dynamic";

export async function GET() {
  const ledger = loadLedger();
  return NextResponse.json({
    ok: true,
    ledger,
    table_count: Object.keys(ledger.tables).length,
  });
}

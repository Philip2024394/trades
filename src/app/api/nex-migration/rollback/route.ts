// POST /api/nex-migration/rollback  · body: { table_name }
// Removes a table from the ledger. Never touches any physical database file.
// This is the safe replacement for the rejected destructive PowerShell rollback:
// only mutates a data-owned JSON file which is not under UNIVERSAL_DENY.

import { NextResponse } from "next/server";
import { forgetTableSchema, isSafeIdentifier } from "@/lib/nex-migration";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { table_name?: string };
  try {
    body = (await req.json()) as { table_name?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  const table_name = String(body.table_name ?? "").trim();
  if (!table_name || !isSafeIdentifier(table_name)) {
    return NextResponse.json({ ok: false, error: "unsafe or missing table_name" }, { status: 400 });
  }
  const r = forgetTableSchema(table_name);
  return NextResponse.json({
    ok: true,
    removed: r.removed,
    ledger_tables: Object.keys(r.ledger.tables),
    note: "Physical database files are untouched. Only the in-repo ledger has been updated.",
  });
}

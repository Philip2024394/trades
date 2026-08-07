// POST /api/nex/contacts/connectors/csv/upload — admin CSV upload
//
// Body: JSON { csv: string, dry_run?: boolean, source_label?: string, admin_actor?: string }
// Header row required; email column required. Unknown columns land in
// attributes. See src/lib/nex/contacts/connectors/csv.ts for parser + mapping.

import { NextResponse } from "next/server";
import { processCsv } from "@/lib/nex/contacts/connectors/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;              // large CSVs take time

export async function POST(request: Request) {
  let body: { csv?: string; dry_run?: boolean; source_label?: string; admin_actor?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  if (!body.csv || typeof body.csv !== "string") {
    return NextResponse.json({ ok: false, error: "csv_required", detail: "Body must include { csv: string }" }, { status: 400 });
  }

  const result = await processCsv({
    csv: body.csv,
    dry_run: !!body.dry_run,
    source_label: body.source_label ?? null,
    admin_actor: body.admin_actor,
  });

  return NextResponse.json({ ok: result.errors === 0 || result.errors < result.records_processed, result });
}

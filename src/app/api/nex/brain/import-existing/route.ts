// POST /api/nex/brain/import-existing — one-shot importer
//
// Walks data/knowledge/records/**/*.md and materialises every governed
// record into the brain tables. Idempotent — safe to re-run whenever
// new records land on disk.
//
// This is how the 22 records already authored in cycles 1-4 become
// brain-queryable data. Also useful for future disk-authored records
// (e.g. records edited manually or authored by Philip in an editor).

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { importExistingRecords } from "@/lib/nex/brain/importer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function POST(_req: NextRequest) {
  try {
    const report = await importExistingRecords();
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    console.error("[api.brain.import-existing] failed:", err);
    return NextResponse.json({ ok: false, error: "import_failed" }, { status: 500 });
  }
}

// GET /api/nex-security/drift · compares the current on-disk state of the
// tracked files to the most recent integrity baseline, reports drift.

import { NextResponse } from "next/server";
import { loadLatestBaseline, compareToBaseline } from "@/lib/nex-security/scanner";

export const dynamic = "force-dynamic";

export async function GET() {
  const baseline = loadLatestBaseline();
  if (!baseline) {
    return NextResponse.json(
      { ok: false, error: "no baseline recorded · POST /api/nex-security/scan to create one" },
      { status: 404 },
    );
  }
  const drifts = compareToBaseline(baseline);
  return NextResponse.json({
    ok: drifts.length === 0,
    baseline_created_at: baseline.created_at,
    files_tracked: baseline.files.length,
    drifts,
    compared_at: new Date().toISOString(),
  });
}

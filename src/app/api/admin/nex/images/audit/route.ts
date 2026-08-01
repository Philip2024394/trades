// POST /api/admin/nex/images/audit
// Run the Phase 1 Staircase Image Audit · returns classification report.

import { NextResponse } from "next/server";
import { runStaircaseImageAudit } from "@/lib/nex/images/staircase-image-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const report = runStaircaseImageAudit();
    return NextResponse.json({ ok: true, report });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "audit failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}

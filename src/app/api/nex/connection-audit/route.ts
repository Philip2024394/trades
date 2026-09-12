// src/app/api/nex/connection-audit/route.ts

import { NextResponse } from "next/server";
import { auditAllCaps, summarizeAudit } from "@/lib/nex/connection-audit/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const rows = auditAllCaps();
  const summary = summarizeAudit(rows);
  return NextResponse.json({ ok: true, summary, rows, generated_at: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}

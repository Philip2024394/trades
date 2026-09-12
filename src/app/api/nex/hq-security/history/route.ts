// src/app/api/nex/hq-security/history/route.ts

import { NextResponse } from "next/server";
import { securityHistoryStore } from "@/lib/nex/security-agent/security-history-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    recent: securityHistoryStore.recent(50),
    counts_by_verdict: securityHistoryStore.countByVerdict(),
    counts_by_code: securityHistoryStore.countByCode(),
    generated_at: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}

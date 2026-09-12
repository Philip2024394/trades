// src/app/api/nex/agent/learning/route.ts
//
// Founder-facing learning digest · reads the ledger + computes weekly summary.
// Never mutates on GET · only reads.

import { NextResponse } from "next/server";
import { loadLedger, computeWeeklyDigest } from "@/lib/nex-agent/learning-ledger";
import { WORKSTATION_SEC_HEADERS } from "@/lib/nex-agent/anti-bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ledger = loadLedger();
  const digest = computeWeeklyDigest(ledger);
  // Return top 10 skills · newest 10 patterns · newest 10 anti-patterns
  const topSkills = Object.values(ledger.skills)
    .sort((a, b) => b.successes - a.successes)
    .slice(0, 10);
  const recentPatterns = [...ledger.patterns]
    .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1))
    .slice(0, 10);
  const recentAnti = [...ledger.antiPatterns]
    .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1))
    .slice(0, 10);
  return NextResponse.json({
    ok: true,
    digest,
    skills: topSkills,
    patterns: recentPatterns,
    antiPatterns: recentAnti,
    lastUpdated: ledger.lastUpdated,
    counts: {
      skills: Object.keys(ledger.skills).length,
      patterns: ledger.patterns.length,
      antiPatterns: ledger.antiPatterns.length,
    },
  }, { headers: { ...WORKSTATION_SEC_HEADERS, "Cache-Control": "no-store" } });
}

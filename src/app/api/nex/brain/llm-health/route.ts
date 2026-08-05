// GET /api/nex/brain/llm-health
//
// Returns per-provider health snapshot for the AI Connection Manager.
// Feeds the dashboard's "AI Connection" strip so the health of the
// underlying LLM providers is visible at a glance:
//
//   Groq (primary) → Gemini (fallback) → Anthropic (fallback) → Mock (last resort)
//   ✓ healthy       · idle              · idle                 · idle
//
// State: circuit breakers, consecutive failures, 24h success rate,
// average latency, and the reason the last failure happened.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { providerReports } from "@/lib/nex/brain/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const report = providerReports();
    return NextResponse.json({ ok: true, ...report });
  } catch (err) {
    console.error("[api.brain.llm-health] failed:", err);
    return NextResponse.json({ ok: false, error: "llm_health_failed" }, { status: 500 });
  }
}

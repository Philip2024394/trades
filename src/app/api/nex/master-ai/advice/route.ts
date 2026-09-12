// src/app/api/nex/master-ai/advice/route.ts
//
// Founder Doctrine 2026-09-10:
// "Master AI Engineer advises Claude on how to advance code for higher
//  world-class results, including UI."
//
// GET  /api/nex/master-ai/advice
// POST /api/nex/master-ai/advice/observe        (trigger observation now)
//
// Claude reads GET at session start to receive:
//   · seed wisdom (rules Master AI has locked in)
//   · recent observations (patterns spotted in the last 10 cycles)
//   · UI heuristics (from the front-end scan pass)
//   · file-level scores summary
//
// This is READ-ONLY for Claude · Master AI writes; Claude consumes.

import { NextResponse } from "next/server";
import { readAdvice, runObserverCycle } from "@/lib/nex/master-ai/claude-session-observer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UI_HEURISTICS = Object.freeze([
  "Every NEX reply must render truth-score chip · signal, never block",
  "Card renderer must handle empty hits[] gracefully · no null explosions",
  "Suggestions row goes AFTER hits card · UX flow: read result → onward journey",
  "Warm greeting time-of-day aware · morning/afternoon/evening/night variants",
  "Tone dial via NEXT_PUBLIC_NEX_TONE_PROFILE · warm_friend | balanced | formal_pro",
  "Trust badges color-coded · verified green · high blue · moderate amber · low red · unknown grey",
  "Loading state must say what's happening (\"reconstructing from pixels\") not just spinners",
  "SSE streaming with Stop button · never leave user stuck watching a stream",
  "Errors render as warm hiccup message · never raw 500 · never blank",
  "Mobile viewport tested at 320px minimum · media queries required · 13px WCAG floor",
]);

const PROTECTION_HEURISTICS = Object.freeze([
  "Every file upload path must call scanOrThrow() before writing bytes · ADR-0303",
  "Chat resilience wrapper strips credentials BEFORE slicing exception messages",
  "Bilingual jailbreak patterns required · English-only misses ID/JP attacks",
  "Postgres pool max should be 20+ not 3 · pool exhaustion cascades to 502s",
  "Analytics/export requires auth · x-analytics-token or admin cookie",
  "Windows scheduled tasks use RepetitionInterval NOT AtLogOn (needs elevation)",
  "Event log + command audit rotate at 5MB with gzip archive + 7-day prune",
  "Registry file should be HMAC-signed (pending) · currently filesystem-ACL only",
  "Founder is NEVER exempt from safety scans · override with audit trail only",
]);

const CODEBASE_HEURISTICS = Object.freeze([
  "3000-line files are code smell · consider splitting BUT preserve behaviour",
  "Every new adapter follows accommodation-adapter pattern · canHandle + compose + hot-tier",
  "Doctrine gates block silently · they NEVER echo doctrine text to reply",
  "Deterministic path preferred over LLM · promotion gate at contract.ts:271",
  "Local Postgres (:5433) is 5.4x faster than Supabase pooler · always cutover",
  "OSM harvester uses public_listing_ref = #AC-YYYY-CROCKFORD5(dedupe_hash)",
  "Test file must be sibling *.test.ts · not tests/ subfolder",
  "MEMORY doctrine #4 · memory NEVER becomes evidence · gate rejects memory: refs",
  "Truth score aggregates existing signals · never invents new fabrication risk",
]);

export async function GET() {
  const advice = readAdvice();
  return NextResponse.json({
    doctrine: "Master AI Engineer is constantly learning code from Claude · advises Claude on world-class improvements",
    generated_at_iso: new Date().toISOString(),
    seed_wisdom:            advice.seed,
    recent_cycles_observed: advice.recent_cycles,
    recent_observations:    advice.observations,
    ui_heuristics:          UI_HEURISTICS,
    protection_heuristics:  PROTECTION_HEURISTICS,
    codebase_heuristics:    CODEBASE_HEURISTICS,
    total_advice_items:
      advice.seed.length + advice.observations.length +
      UI_HEURISTICS.length + PROTECTION_HEURISTICS.length + CODEBASE_HEURISTICS.length,
    how_to_use:
      "Claude reads this at session start · use recent_observations to avoid repeating recent mistakes · use ui/protection/codebase heuristics as code-review rubric · use seed_wisdom as locked-in doctrine",
  });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const isObserve = url.pathname.endsWith("/observe") || url.searchParams.get("action") === "observe";
  if (!isObserve) {
    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  }
  try {
    const cycle = runObserverCycle({ root: process.cwd(), window_hours: 24, max_files: 50 });
    return NextResponse.json({ ok: true, cycle });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message.slice(0, 200) : "unknown",
    }, { status: 500 });
  }
}

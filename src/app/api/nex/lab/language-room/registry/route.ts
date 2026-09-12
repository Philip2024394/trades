// src/app/api/nex/lab/language-room/registry/route.ts
//
// GET /api/nex/lab/language-room/registry
// Returns the raw Language Registry (32 languages) + the progression-gate
// verdict for every scaffolded entry, computed against the CURRENT scorecard
// state. Deterministic · no LLM · read-only.

import { NextResponse } from "next/server";
import { loadLanguageRegistry, checkProgressionGate, scorecardIdToRegistryId } from "@/lib/nex-language-brain/language-registry";
import type { Nex1LevelBand, Nex1BenchmarkMaturity } from "@/lib/nex-language-brain/language-scorecard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LangSectionState {
  language: string;
  level: Nex1LevelBand;
  benchmark_complete: boolean;
  benchmark_maturity: Nex1BenchmarkMaturity;
}

async function loadCurrentScorecardStates(baseUrl: string): Promise<Record<string, LangSectionState>> {
  try {
    const r = await fetch(`${baseUrl}/api/nex/lab/language-room/status`, { cache: "no-store" });
    if (!r.ok) return {};
    const j = await r.json();
    const out: Record<string, LangSectionState> = {};
    for (const s of j.sections ?? []) {
      out[s.language] = {
        language: s.language,
        level: s.level,
        benchmark_complete: s.benchmark_complete,
        benchmark_maturity: s.benchmark_maturity,
      };
    }
    return out;
  } catch { return {}; }
}

export async function GET(req: Request): Promise<NextResponse> {
  const registry = loadLanguageRegistry();

  // Same-origin fetch so we can compute gate verdicts against the live scorecard.
  const url = new URL(req.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const states = await loadCurrentScorecardStates(baseUrl);
  const englishState = states["english"];
  const idState = states["bahasa_indonesia"];

  const languages = registry.languages.map((entry) => {
    const gateVerdict = checkProgressionGate(
      {
        language_id: entry.id,
        english_state: englishState,
        bahasa_indonesia_state: idState,
      },
      registry,
    );
    const scorecard_id = registry.languages
      .filter((l) => l.status === "active")
      .some((l) => l.id === entry.id) ? scorecardIdToRegistryId(entry.id as any) : null;
    return { ...entry, gate: gateVerdict, has_scorecard: scorecard_id !== null };
  });

  return NextResponse.json({
    version: registry.version,
    progression_gate: registry.progression_gate,
    languages,
    foundation_state: {
      english: englishState ?? null,
      bahasa_indonesia: idState ?? null,
      foundation_ready: !!(
        englishState && idState &&
        englishState.level === "fluent" && englishState.benchmark_complete && englishState.benchmark_maturity === "proven" &&
        idState.level === "fluent" && idState.benchmark_complete && idState.benchmark_maturity === "proven"
      ),
    },
    taught_by: "master_ai_engineer",
  }, { headers: { "Cache-Control": "no-store" } });
}

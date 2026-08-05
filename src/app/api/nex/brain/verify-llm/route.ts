// GET /api/nex/brain/verify-llm — which LLM provider is active + smoke test
//
// Returns the active provider (groq / gemini / anthropic / mock) plus
// a tiny live call so Philip can confirm his API key actually works.
// Used by the dashboard chip so the LLM connection status is visible
// at a glance.
//
// The smoke test uses only ~30 tokens per call — costs nothing on the
// free tiers.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { activeProvider, complete } from "@/lib/nex/brain/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const provider = activeProvider();
  try {
    const result = await complete(
      [
        { role: "system", content: "You reply with a single word." },
        { role: "user", content: "Say the word 'ready'." },
      ],
      { temperature: 0, max_tokens: 8 }
    );
    return NextResponse.json({
      ok: true,
      provider: result.provider,
      requested_provider: provider,
      model: result.model,
      response_text: result.text.trim(),
      tokens_in: result.tokens_in,
      tokens_out: result.tokens_out,
      ms: result.ms,
      is_real: result.provider !== "mock",
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      provider,
      is_real: false,
      error: (err as Error).message,
    }, { status: 500 });
  }
}

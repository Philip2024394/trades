// POST /api/admin/vision/preview
//
// Phase 5 · Option 4 · prove-on-one-image before batch.
// Takes ONE image URL, calls Claude Sonnet vision with the NEX
// extraction system prompt, returns the parsed JSON. Cost per call
// ~$0.04. Lets Philip verify the extraction schema is correct BEFORE
// spending $36-40 on the full 981-image batch.
//
// Requires ANTHROPIC_API_KEY in env. Returns 501 with a clear message
// if missing (honest — never fabricates an extraction).

import { NextResponse } from "next/server";
import { VISION_SYSTEM_PROMPT, type VisionExtraction } from "@/lib/nex/vision/visionExtractor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CLAUDE_VISION_MODEL = "claude-sonnet-4-6-20260101"; // adjust to whatever Sonnet model id you have access to

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "anthropic_api_key_missing",
        reason:
          "ANTHROPIC_API_KEY not set in environment. Add it to .env.local (or your Vercel/hosting env) to enable vision extraction. Never fabricated — vision requires a real API call per ADR-0022 no-third-party-fabrication rule.",
        setup_instructions:
          "1. Get key from https://console.anthropic.com/settings/keys · 2. Add ANTHROPIC_API_KEY=... to .env.local · 3. Restart dev server · 4. Retry this endpoint",
      },
      { status: 501 }
    );
  }

  let payload: { image_url?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const image_url = payload.image_url;
  if (!image_url || !image_url.startsWith("http")) {
    return NextResponse.json(
      { ok: false, error: "image_url_required" },
      { status: 400 }
    );
  }

  // Call Claude vision API
  const started = Date.now();
  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_VISION_MODEL,
      max_tokens: 4096,
      system: VISION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "url", url: image_url },
            },
            {
              type: "text",
              text: "Extract the NEX vision knowledge from this image. Return ONLY the JSON object described in the system prompt — no prose wrapper, no code fence.",
            },
          ],
        },
      ],
    }),
  });

  const duration_ms = Date.now() - started;

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text();
    return NextResponse.json(
      {
        ok: false,
        error: "anthropic_api_error",
        status: anthropicRes.status,
        detail: errText.slice(0, 500),
      },
      { status: 502 }
    );
  }

  const data = (await anthropicRes.json()) as {
    content?: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  const rawText =
    data.content?.find((c) => c.type === "text")?.text ?? "";
  let extraction: VisionExtraction | null = null;
  let parse_error: string | null = null;
  try {
    // Strip potential markdown code fences the model sometimes returns despite instructions
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned);
    extraction = {
      vision_model: CLAUDE_VISION_MODEL,
      vision_confidence: Number(parsed.vision_confidence ?? 0),
      extracted_at: new Date().toISOString(),
      // Construction Intelligence (ADR-0037) + Philip's hardening (2026-07-27)
      object: parsed.object ?? "",
      classification: parsed.classification ?? { primary_type: "", construction_style: "", confidence: 0 },
      visual_identification: parsed.visual_identification ?? { view: "", recognition_features: [] },
      construction_intelligence: parsed.construction_intelligence ?? {
        subtype: "", variant: "", function_reasoning: [], structural_reasoning: [],
      },
      joinery_details: parsed.joinery_details ?? { present: [], not_present: [], reason: "" },
      design_character: parsed.design_character ?? { style: [], materials: [] },
      search_terms: parsed.search_terms ?? [],
      comparison_exclusions: parsed.comparison_exclusions ?? [],
      staircase_checklist: parsed.staircase_checklist,
      vision_quality_score: parsed.vision_quality_score ?? {
        construction: 0, material: 0, style: 0, components: 0, manufacturing_clues: 0, overall: 0,
      },
      // Legacy fields
      materials: parsed.materials ?? [],
      components: parsed.components ?? [],
      construction: parsed.construction ?? [],
      styles: parsed.styles ?? [],
      interior_context: parsed.interior_context ?? [],
      manufacturing_clues: parsed.manufacturing_clues ?? [],
      installation_clues: parsed.installation_clues ?? [],
      room_type: parsed.room_type ?? [],
      lighting: parsed.lighting ?? [],
      finishes: parsed.finishes ?? [],
      colours: parsed.colours ?? [],
      textures: parsed.textures ?? [],
      search_intent_predictions: parsed.search_intent_predictions ?? [],
      ai_generation_hints: parsed.ai_generation_hints ?? {
        composition: "",
        reproducible_traits: [],
        palette: [],
      },
      raw_vision_response: rawText,
    };
  } catch (err) {
    parse_error = err instanceof Error ? err.message : String(err);
  }

  // Estimate cost
  const inputTokens = data.usage?.input_tokens ?? 0;
  const outputTokens = data.usage?.output_tokens ?? 0;
  const cost_usd_estimate =
    (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15;

  return NextResponse.json({
    ok: parse_error === null,
    parse_error,
    duration_ms,
    tokens: { input: inputTokens, output: outputTokens },
    cost_usd_estimate: Number(cost_usd_estimate.toFixed(4)),
    extraction,
    raw_response: extraction === null ? rawText : undefined,
  });
}

// src/app/api/nex/image-gen/generate/route.ts
//
// Founder Phase 8 · P8-5 · Image generation endpoint.
// POST body: { prompt, negative_prompt?, width?, height?, cfg_scale?,
//              steps?, seed?, n?, conversation_id? }
//
// Doctrine anchors:
//   #5 · Prompt runs through Doctrine #5 sanitiser before generation.
//   image-doctrine · Output labelled image_kind:"generated" · never treated as evidence.

import { NextResponse } from "next/server";
import { makeDefaultImageGenProvider, persistGeneratedImages } from "@/lib/nex/live-chat-completion/image-gen";
import { ImageGenRequestSchema } from "@/lib/nex/live-chat-completion/image-gen/contract";
import { sanitiseUntrustedContent } from "@/lib/nex/live-chat-completion/safety/untrusted-content-sanitiser";

const _provider = makeDefaultImageGenProvider();

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!_provider) {
    return NextResponse.json({ error: "image_gen_disabled" }, { status: 503 });
  }
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty body */ }

  // Doctrine #5 sanitiser on the prompt.
  const rawPrompt = typeof body.prompt === "string" ? body.prompt : "";
  const sanit = sanitiseUntrustedContent({ text: rawPrompt, source_kind: "tool" });
  if (!sanit.safe_to_cite) {
    return NextResponse.json({
      error: "prompt_rejected_by_doctrine_5",
      detections: sanit.detections,
    }, { status: 400 });
  }

  const parsed = ImageGenRequestSchema.safeParse({ ...body, prompt: sanit.clean_text });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", detail: parsed.error.flatten() }, { status: 400 });
  }

  const conversation_id = typeof body.conversation_id === "string" ? body.conversation_id : null;

  try {
    const result = await _provider.generate(parsed.data);
    persistGeneratedImages(result, conversation_id);
    return NextResponse.json({
      ok: result.completed,
      provider: result.provider,
      model_id: result.model_id,
      safety_verdict: result.safety_verdict,
      images: result.images.map((img) => ({
        ref_id: img.ref_id,
        image_kind: "generated",                       // doctrine label
        mime_type: img.mime_type,
        width: img.width,
        height: img.height,
        seed: img.seed,
        content_hash: img.content_hash,
        data_url: `data:${img.mime_type};base64,${img.content_base64}`,
      })),
      request_ms: result.request_ms,
      error: result.error,
      doctrine_note: "IMAGE GENERATION EXTRACTS INTENT · IMAGE OUTPUT NEVER ESTABLISHES TRUTH",
      sanitiser_neutralised: sanit.neutralised_count,
    });
  } catch (e) {
    return NextResponse.json({
      error: "image_gen_error",
      detail: e instanceof Error ? e.message.slice(0, 200) : "unknown",
    }, { status: 500 });
  }
}

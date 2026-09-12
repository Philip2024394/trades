// src/lib/nex/live-chat-completion/image-gen/mock-provider.ts
//
// Founder Phase 8 · P8-2 · deterministic mock image provider.
//
// Returns a 1×1 PNG (black pixel) base64-encoded so the whole
// generation → provenance → chat delegation pipeline can be exercised
// in regression without SD/ComfyUI running.
//
// Hash-stable: same prompt+seed+model → same ref_id.

import type { ImageGenProvider, ImageGenRequest, ImageGenResult, ImageGenResultImage } from "./contract";
import { classifyPromptSafety, hashImageContent, makeImageRefId } from "./contract";

// 1×1 black PNG · smallest valid PNG · fixed bytes so tests are deterministic.
const _TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export function makeMockImageGenProvider(): ImageGenProvider {
  return {
    name: "mock-imggen",
    async generate(input: ImageGenRequest): Promise<ImageGenResult> {
      const t0 = performance.now();
      const safety = classifyPromptSafety(input.prompt);
      if (safety === "flagged") {
        return {
          images: [],
          provider: "mock-imggen",
          model_id: "mock-stub",
          prompt: input.prompt,
          negative_prompt: input.negative_prompt ?? null,
          request_ms: Math.round(performance.now() - t0),
          completed: false,
          error: "prompt_safety_flagged",
          safety_verdict: "flagged",
        };
      }

      const modelId = input.model_id ?? "mock-stub";
      const seed = input.seed === -1 ? 42 : input.seed;
      const images: ImageGenResultImage[] = [];
      for (let i = 0; i < input.n; i++) {
        images.push({
          ref_id: makeImageRefId(input.prompt, modelId, seed, i),
          content_base64: _TINY_PNG_B64,
          mime_type: "image/png",
          width: input.width,
          height: input.height,
          seed,
          content_hash: hashImageContent(_TINY_PNG_B64),
        });
      }
      return {
        images,
        provider: "mock-imggen",
        model_id: modelId,
        prompt: input.prompt,
        negative_prompt: input.negative_prompt ?? null,
        request_ms: Math.round(performance.now() - t0),
        completed: true,
        safety_verdict: "clean",
      };
    },
  };
}

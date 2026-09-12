// src/lib/nex/live-chat-completion/image-gen/sd-provider.ts
//
// Founder Phase 8 · P8-3 · Stable Diffusion API provider.
//
// Compatible with Automatic1111 (stable-diffusion-webui) HTTP API at
//   NEX_SD_URL (default http://127.0.0.1:7860)
// POST /sdapi/v1/txt2img — the de-facto standard for local SD serving.
// Also compatible with ComfyUI when a webui-compat plugin is enabled.
//
// Bounded timeout. Non-fatal on connection error. Returns honest empty
// with safety_verdict="unknown" when SD unreachable.

import type { ImageGenProvider, ImageGenRequest, ImageGenResult, ImageGenResultImage } from "./contract";
import { classifyPromptSafety, hashImageContent, makeImageRefId } from "./contract";

const SD_URL = process.env.NEX_SD_URL ?? "http://127.0.0.1:7860";
const SD_DEFAULT_MODEL = process.env.NEX_SD_MODEL ?? "sdxl-turbo";

export function makeSdImageGenProvider(): ImageGenProvider {
  return {
    name: "sd-webui",
    async generate(input: ImageGenRequest): Promise<ImageGenResult> {
      const t0 = performance.now();
      const safety = classifyPromptSafety(input.prompt);
      if (safety === "flagged") {
        return {
          images: [],
          provider: "sd-webui",
          model_id: input.model_id ?? SD_DEFAULT_MODEL,
          prompt: input.prompt,
          negative_prompt: input.negative_prompt ?? null,
          request_ms: Math.round(performance.now() - t0),
          completed: false,
          error: "prompt_safety_flagged",
          safety_verdict: "flagged",
        };
      }

      const modelId = input.model_id ?? SD_DEFAULT_MODEL;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(new DOMException("sd_timeout", "AbortError")), input.budget_ms);
      try {
        const res = await fetch(`${SD_URL}/sdapi/v1/txt2img`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: input.prompt,
            negative_prompt: input.negative_prompt ?? "",
            width: input.width,
            height: input.height,
            cfg_scale: input.cfg_scale ?? 7,
            steps: input.steps ?? 20,
            seed: input.seed,
            batch_size: input.n,
            n_iter: 1,
            sampler_name: "DPM++ 2M Karras",
            override_settings: { sd_model_checkpoint: modelId },
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          return honestEmpty(t0, modelId, input, `sd_http_${res.status}`, "unknown");
        }
        const body = await res.json().catch(() => ({}));
        const imgs = Array.isArray(body?.images) ? body.images as string[] : [];
        if (imgs.length === 0) {
          return honestEmpty(t0, modelId, input, "sd_returned_no_images", "unknown");
        }
        // Info may contain the resolved seed. Best-effort parse.
        let resolvedSeed = input.seed;
        try {
          const info = typeof body?.info === "string" ? JSON.parse(body.info) : body?.info;
          if (info && typeof info.seed === "number") resolvedSeed = info.seed;
        } catch { /* ignore */ }

        const images: ImageGenResultImage[] = imgs.slice(0, input.n).map((b64, i) => {
          const clean = String(b64).replace(/^data:image\/[a-z]+;base64,/i, "");
          return {
            ref_id: makeImageRefId(input.prompt, modelId, resolvedSeed, i),
            content_base64: clean,
            mime_type: "image/png",
            width: input.width,
            height: input.height,
            seed: resolvedSeed,
            content_hash: hashImageContent(clean),
          };
        });

        return {
          images,
          provider: "sd-webui",
          model_id: modelId,
          prompt: input.prompt,
          negative_prompt: input.negative_prompt ?? null,
          request_ms: Math.round(performance.now() - t0),
          completed: true,
          safety_verdict: "clean",
        };
      } catch (e) {
        const reason = (e as { name?: string })?.name === "AbortError" ? "sd_timeout"
          : (e instanceof Error ? e.message.slice(0, 100) : "sd_error");
        return honestEmpty(t0, modelId, input, reason, "unknown");
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

function honestEmpty(
  t0: number, modelId: string, input: ImageGenRequest, error: string,
  safety: "clean" | "flagged" | "unknown",
): ImageGenResult {
  return {
    images: [],
    provider: "sd-webui",
    model_id: modelId,
    prompt: input.prompt,
    negative_prompt: input.negative_prompt ?? null,
    request_ms: Math.round(performance.now() - t0),
    completed: false,
    error,
    safety_verdict: safety,
  };
}

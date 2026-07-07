// Flux 1.1 Pro provider via Replicate. Uses the image-to-image
// pipeline for controlled renovation renders. Classification is
// delegated to a lightweight OpenAI-style hosted CLIP if present,
// otherwise fails-closed and the caller falls back to the stub.
import "server-only";
import type {
  AiVisualiserProvider,
  ProviderClassifyInput,
  ProviderClassifyResult,
  ProviderGenerateInput,
  ProviderGenerateResult
} from "./types";

const RENDER_COST_PENCE = 5; // ~£0.04-0.05 at current Replicate pricing

const FLUX_MODEL_VERSION =
  process.env.REPLICATE_FLUX_MODEL_VERSION ||
  "black-forest-labs/flux-1.1-pro";

export function makeFluxProvider(opts: { apiKey: string }): AiVisualiserProvider {
  const { apiKey } = opts;
  return {
    id: "flux-1.1-pro",
    displayName: "Flux 1.1 Pro (Replicate)",

    async classify(_input: ProviderClassifyInput): Promise<ProviderClassifyResult> {
      // Replicate doesn't have a CLIP JSON endpoint we can rely on
      // universally. For the wedge we bounce classification back to
      // the caller — the render route will treat missing classification
      // as "trust the leaf the merchant page pointed the user to."
      return {
        bestLeafSlug: null,
        bestPrompt: null,
        confidence: 0,
        scores: []
      };
    },

    async generate(input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
      const body = {
        version: FLUX_MODEL_VERSION,
        input: {
          prompt: input.prompt,
          image: input.sourceImageUrl,
          image_prompt_strength: input.strength ?? 0.55,
          aspect_ratio: input.aspectRatio ?? "1:1",
          output_format: "png",
          safety_tolerance: 2
        }
      };

      const start = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Token ${apiKey}`
        },
        body: JSON.stringify(body)
      });
      if (!start.ok) {
        const text = await start.text();
        throw new Error(`Replicate start failed: ${start.status} ${text}`);
      }
      const startJson = (await start.json()) as {
        id: string;
        urls: { get: string };
      };

      const started = Date.now();
      const deadline = started + 120_000;
      let output: string | string[] | null = null;
      let providerRequestId = startJson.id;

      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 1500));
        const poll = await fetch(startJson.urls.get, {
          headers: { authorization: `Token ${apiKey}` }
        });
        if (!poll.ok) continue;
        const pollJson = (await poll.json()) as {
          id: string;
          status: string;
          output: string | string[] | null;
          error?: string;
        };
        if (pollJson.status === "succeeded") {
          output = pollJson.output;
          providerRequestId = pollJson.id;
          break;
        }
        if (
          pollJson.status === "failed" ||
          pollJson.status === "canceled"
        ) {
          throw new Error(`Replicate render failed: ${pollJson.error || pollJson.status}`);
        }
      }

      const imageUrl = Array.isArray(output) ? output[0] : output;
      if (!imageUrl) throw new Error("Replicate render timed out or returned nothing");
      return {
        imageUrl,
        providerRequestId,
        costPence: RENDER_COST_PENCE
      };
    },

    async test() {
      try {
        const res = await fetch("https://api.replicate.com/v1/account", {
          headers: { authorization: `Token ${apiKey}` }
        });
        if (!res.ok) return { ok: false, error: `HTTP ${res.status}` } as const;
        return { ok: true } as const;
      } catch (err) {
        return { ok: false, error: String(err) } as const;
      }
    }
  };
}

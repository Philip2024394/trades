// OpenAI provider. Uses:
//   • Vision (chat.completions with an image_url) to classify the
//     uploaded photo against the merchant's candidate prompts. The
//     model returns the best leaf slug + confidence 0..1.
//   • gpt-image-1 for renders (image-to-image via input_image).
//
// Requires a valid OPENAI api key in the provider credentials row.
import "server-only";
import type {
  AiVisualiserProvider,
  ProviderClassifyInput,
  ProviderClassifyResult,
  ProviderGenerateInput,
  ProviderGenerateResult
} from "./types";

const DEFAULT_VISION_MODEL = "gpt-4o-mini";
const DEFAULT_IMAGE_MODEL = "gpt-image-1";

// A single OpenAI image call is priced at time of writing at
// ~$0.019/image at 1024x1024 medium quality (roughly 1.5p). We
// budget 8p to be safe including vision classification.
const RENDER_COST_PENCE = 8;

export function makeOpenAiProvider(opts: {
  apiKey: string;
  visionModel?: string;
  imageModel?: string;
}): AiVisualiserProvider {
  const { apiKey } = opts;
  const visionModel = opts.visionModel || DEFAULT_VISION_MODEL;
  const imageModel = opts.imageModel || DEFAULT_IMAGE_MODEL;

  return {
    id: "openai-images",
    displayName: "OpenAI (gpt-image-1)",

    async classify(input: ProviderClassifyInput): Promise<ProviderClassifyResult> {
      if (input.candidatePrompts.length === 0) {
        return { bestLeafSlug: null, bestPrompt: null, confidence: 0, scores: [] };
      }
      const systemPrompt =
        "You classify home-improvement photos. Given a photo and a list " +
        "of candidate categories (each described by a phrase), you pick " +
        "the single best matching category. Respond with strict JSON: " +
        '{"leafSlug":"...","confidence":0..1}. If the photo does not ' +
        'match ANY candidate, return {"leafSlug":null,"confidence":0}.';

      const userText =
        "Candidates:\n" +
        input.candidatePrompts
          .map((c, i) => `${i + 1}. leafSlug="${c.leafSlug}" — ${c.prompt}`)
          .join("\n") +
        "\n\nWhich candidate does the attached photo best match?";

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: visionModel,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: userText },
                { type: "image_url", image_url: { url: input.imageUrl } }
              ]
            }
          ]
        })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`OpenAI vision failed: ${res.status} ${text}`);
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const raw = json.choices?.[0]?.message?.content ?? "{}";
      let parsed: { leafSlug?: string | null; confidence?: number } = {};
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = {};
      }
      const bestLeafSlug =
        typeof parsed.leafSlug === "string" && parsed.leafSlug.length > 0
          ? parsed.leafSlug
          : null;
      const confidence =
        typeof parsed.confidence === "number"
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0;
      const bestPrompt =
        input.candidatePrompts.find((c) => c.leafSlug === bestLeafSlug)?.prompt ??
        null;

      return {
        bestLeafSlug,
        bestPrompt,
        confidence,
        scores: input.candidatePrompts.map((c) => ({
          leafSlug: c.leafSlug,
          score: c.leafSlug === bestLeafSlug ? confidence : 0
        }))
      };
    },

    async generate(input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
      // gpt-image-1 image-edit endpoint takes a source image + prompt.
      const size =
        input.aspectRatio === "16:9"
          ? "1536x1024"
          : input.aspectRatio === "3:2"
            ? "1536x1024"
            : "1024x1024";

      const sourceRes = await fetch(input.sourceImageUrl);
      if (!sourceRes.ok) {
        throw new Error(
          `Failed to fetch source image: ${sourceRes.status}`
        );
      }
      const sourceBlob = await sourceRes.blob();

      const form = new FormData();
      form.append("model", imageModel);
      form.append("prompt", input.prompt);
      form.append("size", size);
      form.append("n", "1");
      form.append("image", sourceBlob, "source.png");

      const res = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`
        },
        body: form
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`OpenAI image edit failed: ${res.status} ${text}`);
      }

      const json = (await res.json()) as {
        data?: Array<{ url?: string; b64_json?: string }>;
        created?: number;
      };
      const first = json.data?.[0];
      const imageUrl =
        first?.url ||
        (first?.b64_json
          ? `data:image/png;base64,${first.b64_json}`
          : "");
      if (!imageUrl) {
        throw new Error("OpenAI returned no image URL");
      }
      return {
        imageUrl,
        providerRequestId: json.created ? String(json.created) : undefined,
        costPence: RENDER_COST_PENCE
      };
    },

    async test() {
      try {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { authorization: `Bearer ${apiKey}` }
        });
        if (!res.ok) return { ok: false, error: `HTTP ${res.status}` } as const;
        return { ok: true } as const;
      } catch (err) {
        return { ok: false, error: String(err) } as const;
      }
    }
  };
}

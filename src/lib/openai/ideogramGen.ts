// Ideogram v3 wrapper.
//
// Ideogram is the router's default for logo + business-card + wordmark
// surfaces because its typography rendering is currently best-in-class.
// Same shape as generateImage() so backends are swappable.
//
// Returns null when IDEOGRAM_API_KEY is missing so the caller can fall
// through the same way it does for GPT Image 1.
//
// API reference (public): https://developer.ideogram.ai/api-reference

const IDEOGRAM_URL = "https://api.ideogram.ai/generate";

export type IdeogramQuality = "standard" | "premium";

export type IdeogramInput = {
  prompt:        string;
  quality?:      IdeogramQuality;
  aspect_ratio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
  n?:            number;
  style?:        "GENERAL" | "REALISTIC" | "DESIGN" | "TYPOGRAPHY";
};

export type IdeogramResult = {
  images:              Array<{ url: string }>;
  usage_usd_estimate:  number;
};

const COST_PER_IMAGE_USD: Record<IdeogramQuality, number> = {
  standard: 0.02,
  premium:  0.05
};

export async function generateIdeogram(input: IdeogramInput): Promise<IdeogramResult | null> {
  const key = process.env.IDEOGRAM_API_KEY;
  if (!key) return null;

  const quality = input.quality ?? "standard";
  const aspect  = input.aspect_ratio ?? "1:1";
  const n       = input.n ?? 1;

  try {
    const res = await fetch(IDEOGRAM_URL, {
      method: "POST",
      headers: {
        "Api-Key":      key,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        image_request: {
          prompt:        input.prompt,
          aspect_ratio:  aspect,
          model:         quality === "premium" ? "V_2_TURBO" : "V_2",
          style_type:    input.style ?? "DESIGN",
          magic_prompt_option: "OFF"     // compiler already writes the prompt
        }
      })
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error("[ideogram] api error", res.status, await res.text());
      return null;
    }
    const json = await res.json() as { data?: Array<{ url: string }> };
    const images = (json.data ?? []).map((d) => ({ url: d.url }));
    return {
      images,
      usage_usd_estimate: COST_PER_IMAGE_USD[quality] * n
    };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[ideogram] transport error", e);
    return null;
  }
}

export function estimateIdeogramPence(quality: IdeogramQuality, n: number): number {
  return Math.ceil(COST_PER_IMAGE_USD[quality] * n * 0.79 * 100);
}

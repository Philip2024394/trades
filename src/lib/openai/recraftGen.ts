// Recraft v3 wrapper.
//
// Recraft is the router's default for print + flyer + poster + signage
// surfaces because it produces vector-friendly output natively (SVG
// export available). Same shape as generateImage() so backends are
// swappable.
//
// Returns null when RECRAFT_API_KEY is missing so the caller can fall
// through the same way it does for GPT Image 1.
//
// API reference: https://www.recraft.ai/docs

const RECRAFT_URL = "https://external.api.recraft.ai/v1/images/generations";

export type RecraftQuality = "standard" | "premium";
export type RecraftStyle   = "any" | "realistic_image" | "digital_illustration" | "vector_illustration" | "icon";

export type RecraftInput = {
  prompt:    string;
  quality?:  RecraftQuality;
  size?:     "1024x1024" | "1365x1024" | "1024x1365" | "1707x1024" | "1024x1707";
  n?:        number;
  style?:    RecraftStyle;
  model?:    "recraftv3" | "recraftv2";
};

export type RecraftResult = {
  images:              Array<{ url: string }>;
  usage_usd_estimate:  number;
};

const COST_PER_IMAGE_USD: Record<RecraftQuality, number> = {
  standard: 0.04,
  premium:  0.08
};

export async function generateRecraft(input: RecraftInput): Promise<RecraftResult | null> {
  const key = process.env.RECRAFT_API_KEY;
  if (!key) return null;

  const quality = input.quality ?? "standard";
  const size    = input.size ?? "1024x1024";
  const n       = input.n ?? 1;

  try {
    const res = await fetch(RECRAFT_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type":  "application/json"
      },
      body: JSON.stringify({
        prompt: input.prompt,
        model:  input.model ?? "recraftv3",
        style:  input.style ?? "vector_illustration",
        size,
        n
      })
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error("[recraft] api error", res.status, await res.text());
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
    console.error("[recraft] transport error", e);
    return null;
  }
}

export function estimateRecraftPence(quality: RecraftQuality, n: number): number {
  return Math.ceil(COST_PER_IMAGE_USD[quality] * n * 0.79 * 100);
}

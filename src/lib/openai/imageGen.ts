// OpenAI GPT Image 1 wrapper.
//
// Two entry points:
//   generateImage(...)   → base endpoint, initial generation
//   editImage(...)       → edit endpoint, iterative refinement.
//                          Passes the previous image as anchor per
//                          ChatGPT's "always edit, never regenerate"
//                          pattern (batch 1, answer 5).
//
// Returns null when OPENAI_API_KEY is missing so callers can fall
// through to a placeholder / deterministic mock.
//
// Output: PNG b64 string (caller can persist to Supabase Storage
// or serve directly).

const IMAGE_URL      = "https://api.openai.com/v1/images/generations";
const IMAGE_EDIT_URL = "https://api.openai.com/v1/images/edits";
const DEFAULT_MODEL  = "gpt-image-1";

export type ImageQuality = "low" | "medium" | "high" | "hd";

export type GenerateImageInput = {
  prompt:      string;
  quality?:    ImageQuality;
  size?:       "1024x1024" | "1536x1024" | "1024x1536";
  model?:      string;
  n?:          number;
};

export type ImageResult = {
  images: Array<{ b64: string }>;
  usage_usd_estimate: number;
};

const COST_PER_IMAGE_USD: Record<ImageQuality, number> = {
  low:    0.011,
  medium: 0.042,
  high:   0.167,
  hd:     0.190
};

/** Initial generation. Returns null on missing key or transport error. */
export async function generateImage(input: GenerateImageInput): Promise<ImageResult | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const quality = input.quality ?? "medium";
  const size    = input.size ?? "1536x1024";  // landscape default for van views
  const n       = input.n ?? 1;

  try {
    const res = await fetch(IMAGE_URL, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${key}`
      },
      body: JSON.stringify({
        model:   input.model ?? DEFAULT_MODEL,
        prompt:  input.prompt,
        n,
        size,
        quality,
        response_format: "b64_json"
      })
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      data?: Array<{ b64_json?: string }>;
    };
    const rows = data.data ?? [];
    const images = rows
      .filter((r) => typeof r.b64_json === "string")
      .map((r) => ({ b64: r.b64_json as string }));
    if (images.length === 0) return null;
    return {
      images,
      usage_usd_estimate: n * (COST_PER_IMAGE_USD[quality] ?? COST_PER_IMAGE_USD.medium)
    };
  } catch {
    return null;
  }
}

export type EditImageInput = {
  prompt:      string;
  /** Base64 PNG of the previous image (no data: prefix). */
  imageB64:    string;
  /** Optional mask PNG b64 (transparent = area to edit). */
  maskB64?:    string;
  quality?:    ImageQuality;
  size?:       "1024x1024" | "1536x1024" | "1024x1536";
  model?:      string;
  n?:          number;
};

/** Iterative refinement. Anchor the model to the previous image so
 *  the style DNA doesn't drift between turns. */
export async function editImage(input: EditImageInput): Promise<ImageResult | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const quality = input.quality ?? "medium";
  const size    = input.size    ?? "1536x1024";
  const n       = input.n       ?? 1;

  try {
    // Edit endpoint uses multipart/form-data.
    const form = new FormData();
    form.append("model",   input.model ?? DEFAULT_MODEL);
    form.append("prompt",  input.prompt);
    form.append("n",       String(n));
    form.append("size",    size);
    form.append("quality", quality);
    form.append("response_format", "b64_json");
    form.append("image", b64ToBlob(input.imageB64, "image/png"), "current.png");
    if (input.maskB64) {
      form.append("mask", b64ToBlob(input.maskB64, "image/png"), "mask.png");
    }

    const res = await fetch(IMAGE_EDIT_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}` },
      body:    form
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      data?: Array<{ b64_json?: string }>;
    };
    const rows = data.data ?? [];
    const images = rows
      .filter((r) => typeof r.b64_json === "string")
      .map((r) => ({ b64: r.b64_json as string }));
    if (images.length === 0) return null;
    return {
      images,
      usage_usd_estimate: n * (COST_PER_IMAGE_USD[quality] ?? COST_PER_IMAGE_USD.medium)
    };
  } catch {
    return null;
  }
}

// ─── Utils ─────────────────────────────────────────────────────

function b64ToBlob(b64: string, mimeType: string): Blob {
  const clean = b64.replace(/^data:[^;]+;base64,/, "");
  const binary = Buffer.from(clean, "base64");
  return new Blob([new Uint8Array(binary)], { type: mimeType });
}

/** Estimate cost in pence (GBP) for a given tier + count. */
export function estimateGenerationPence(quality: ImageQuality, count: number): number {
  const usd = (COST_PER_IMAGE_USD[quality] ?? COST_PER_IMAGE_USD.medium) * count;
  return Math.ceil(usd * 0.79 * 100);
}

// OpenAI Vision wrapper — used by the Design Critic to score actual
// pixels rather than metadata. Accepts a base64 PNG or a URL and a
// system+user prompt, returns structured JSON.
//
// Uses gpt-4o for vision reasoning. Falls back to null on missing key.

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_VISION_MODEL = "gpt-4o";

export type VisionInput = {
  system:   string;
  prompt:   string;
  image:    { b64?: string; url?: string };
  model?:   string;
  jsonMode?: boolean;
};

export type VisionResult<T = unknown> = {
  parsed: T | null;
  raw:    string;
};

export async function reviewImage<T = unknown>(input: VisionInput): Promise<VisionResult<T> | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  if (!input.image.b64 && !input.image.url) return null;

  const imagePart = input.image.b64
    ? { type: "image_url", image_url: { url: `data:image/png;base64,${input.image.b64}` } }
    : { type: "image_url", image_url: { url: input.image.url } };

  const body = {
    model: input.model ?? DEFAULT_VISION_MODEL,
    max_tokens: 1500,
    temperature: 0.2,
    response_format: input.jsonMode !== false ? { type: "json_object" } : undefined,
    messages: [
      { role: "system", content: input.system },
      {
        role: "user",
        content: [
          { type: "text", text: input.prompt },
          imagePart
        ]
      }
    ]
  };

  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw  = data.choices?.[0]?.message?.content ?? "";
    if (!raw) return null;
    try {
      const cleaned = raw.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      return { parsed: JSON.parse(cleaned) as T, raw };
    } catch {
      return { parsed: null, raw };
    }
  } catch {
    return null;
  }
}

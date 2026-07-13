// Anthropic vision helper — single point of contact for multimodal
// image → structured JSON calls. Direct fetch, no SDK dependency.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-opus-4-7";

export type VisionAskInput = {
  imageBase64: string;
  imageMimeType: string;
  system: string;
  userText: string;
  maxTokens?: number;
  model?: string;
};

/** Returns raw text response — caller parses JSON. Null on missing
 *  key / network error. */
export async function askVision(input: VisionAskInput): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: input.model ?? DEFAULT_MODEL,
        max_tokens: input.maxTokens ?? 800,
        system: input.system,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: input.imageMimeType,
                  data: input.imageBase64
                }
              },
              { type: "text", text: input.userText }
            ]
          }
        ]
      })
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = (data.content ?? [])
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text as string)
      .join("");
    return text || null;
  } catch {
    return null;
  }
}

/** JSON-mode wrapper. Strips code fences, returns null on parse fail. */
export async function askVisionJson<T = unknown>(
  input: VisionAskInput
): Promise<T | null> {
  const raw = await askVision(input);
  if (!raw) return null;
  try {
    const cleaned = raw
      .replace(/^\s*```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

// Thin Anthropic wrapper. Direct fetch — no SDK dependency.
//
// Returns null when ANTHROPIC_API_KEY is missing so composers can
// gracefully fall back to a deterministic template (the merchant
// still gets a post, just less voicey).

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-6";

export type AnthropicMessage = {
  role: "user" | "assistant";
  content: string;
};

export type CompleteInput = {
  system: string;
  messages: AnthropicMessage[];
  maxTokens?: number;
  temperature?: number;
  model?: string;
};

/** Returns the model's text response, or null on missing key /
 *  network error. Never throws — composers layer their own fallback. */
export async function complete(input: CompleteInput): Promise<string | null> {
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
        max_tokens: input.maxTokens ?? 512,
        temperature: input.temperature ?? 0.4,
        system: input.system,
        messages: input.messages
      })
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const parts = data.content ?? [];
    const text = parts
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text as string)
      .join("");
    return text || null;
  } catch {
    return null;
  }
}

/** JSON-mode helper — asks the model for a JSON object and parses.
 *  Returns null if the response can't be parsed or the key is missing. */
export async function completeJson<T = unknown>(
  input: CompleteInput
): Promise<T | null> {
  const raw = await complete(input);
  if (!raw) return null;
  try {
    // Trim common markdown fences the model sometimes wraps JSON in.
    const cleaned = raw
      .replace(/^\s*```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

// OpenAI reasoning wrapper — used by the design agents (Discovery,
// Strategy, Vehicle, Director, QA) to expand user input into a
// validated SDS. Returns null when OPENAI_API_KEY is missing so
// callers can fall through to deterministic defaults.
//
// Model default: gpt-5 (or whatever the current OpenAI reasoning
// tier is at deploy time). Structured output via JSON mode when
// the caller passes a JSON schema hint.

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-5";

export type OpenAiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ReasoningInput = {
  system:       string;
  messages:     OpenAiMessage[];
  model?:       string;
  maxTokens?:   number;
  temperature?: number;
  /** When set, forces JSON output. */
  jsonMode?:    boolean;
};

export type ReasoningResult = {
  text: string;
  usage: {
    inputTokens:  number;
    outputTokens: number;
  };
};

/** Text completion via OpenAI reasoning tier. Returns null on missing
 *  key or transport error. Never throws. */
export async function reason(input: ReasoningInput): Promise<ReasoningResult | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const body: Record<string, unknown> = {
    model:       input.model ?? DEFAULT_MODEL,
    max_tokens:  input.maxTokens ?? 1500,
    temperature: input.temperature ?? 0.3,
    messages: [
      { role: "system", content: input.system },
      ...input.messages
    ]
  };
  if (input.jsonMode) body.response_format = { type: "json_object" };

  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${key}`
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?:   { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = data.choices?.[0]?.message?.content ?? "";
    if (!text) return null;
    return {
      text,
      usage: {
        inputTokens:  data.usage?.prompt_tokens     ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0
      }
    };
  } catch {
    return null;
  }
}

/** JSON helper — asks the model for a JSON object, parses + returns.
 *  Returns null on any failure (missing key, network, invalid JSON). */
export async function reasonJson<T = unknown>(input: ReasoningInput): Promise<T | null> {
  const res = await reason({ ...input, jsonMode: true });
  if (!res) return null;
  try {
    const cleaned = res.text
      .replace(/^\s*```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

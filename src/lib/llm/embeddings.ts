// Text embedding — OpenAI text-embedding-3-small (1536 dim).
//
// Anthropic doesn't ship a first-party embedding API — their
// recommended partner is Voyage AI. We use OpenAI for portability and
// cost (text-embedding-3-small is ~$0.02 / 1M tokens, cheapest good
// embedding on the market as of Jan 2026).
//
// Returns null when OPENAI_API_KEY is missing so callers can degrade
// gracefully (search falls back to structured facet queries only).

const OPENAI_URL = "https://api.openai.com/v1/embeddings";
const MODEL = "text-embedding-3-small";
const DIMS = 1536;

export async function embedText(text: string): Promise<number[] | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || !text.trim()) return null;
  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        input: text.trim().slice(0, 8192),
        model: MODEL,
        dimensions: DIMS
      })
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };
    const vec = data.data?.[0]?.embedding;
    if (!Array.isArray(vec) || vec.length !== DIMS) return null;
    return vec;
  } catch {
    return null;
  }
}

export const EMBEDDING_DIMS = DIMS;

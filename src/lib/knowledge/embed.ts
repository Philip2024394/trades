// Trade Knowledge Engine — embedding infrastructure.
//
// Uses OpenAI text-embedding-3-small (1536-dim) to embed knowledge
// entries + user queries. Cheap: ~$0.02 per 1M tokens = fractions
// of a penny per entry or query.
//
// Graceful fallback: if OPENAI_API_KEY is missing, returns null.
// Callers should degrade to full-text search on hammerex_knowledge_
// entries.search_text (tsvector) — see src/lib/knowledge/search.ts.
//
// Trade-agnostic: this module has no knowledge of concrete or any
// specific trade. It embeds any string into a vector.

const OPENAI_EMBED_ENDPOINT = "https://api.openai.com/v1/embeddings";
const EMBEDDING_MODEL       = "text-embedding-3-small";
export const EMBEDDING_DIMS = 1536;

export async function embedText(text: string): Promise<number[] | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const input = text.trim();
  if (input.length === 0) return null;
  if (input.length > 32_000) {
    // Truncate to stay well under 8k token limit
    return embedText(input.slice(0, 32_000));
  }

  try {
    const res = await fetch(OPENAI_EMBED_ENDPOINT, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${key}`
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input,
        encoding_format: "float"
      })
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[knowledge.embed] openai non-OK:", res.status, body.slice(0, 200));
      return null;
    }
    const data = await res.json() as { data?: Array<{ embedding: number[] }> };
    return data.data?.[0]?.embedding ?? null;
  } catch (e) {
    console.error("[knowledge.embed] error:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

/** Batch-embed a list of strings. Returns array where each index
 *  matches input index. Null entries = failed / no key. */
export async function embedBatch(texts: string[]): Promise<Array<number[] | null>> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return texts.map(() => null);

  const inputs = texts.map((t) => t.trim().slice(0, 32_000));
  try {
    const res = await fetch(OPENAI_EMBED_ENDPOINT, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${key}`
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: inputs,
        encoding_format: "float"
      })
    });
    if (!res.ok) {
      console.error("[knowledge.embed] batch non-OK:", res.status);
      return texts.map(() => null);
    }
    const data = await res.json() as { data?: Array<{ index: number; embedding: number[] }> };
    const out: Array<number[] | null> = texts.map(() => null);
    for (const row of data.data ?? []) {
      out[row.index] = row.embedding;
    }
    return out;
  } catch (e) {
    console.error("[knowledge.embed] batch error:", e instanceof Error ? e.message : String(e));
    return texts.map(() => null);
  }
}

/** Format the embedding as the Postgres pgvector literal
 *  `[0.1,0.2,...]` for use in SQL. */
export function toVectorLiteral(embedding: number[]): string {
  return "[" + embedding.map((n) => n.toFixed(6)).join(",") + "]";
}

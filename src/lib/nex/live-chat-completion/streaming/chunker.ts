// src/lib/nex/live-chat-completion/streaming/chunker.ts
//
// Founder BEGIN Phase 3.3 · deterministic-reply chunker.
//
// The deterministic composer produces the full reply in one go. To feel
// like ChatGPT, we emit tokens progressively over the SSE stream.
//
// Chunking strategy: word-preserving. Never splits inside a word. Emits
// small groups so the UI feels responsive without being spammy.
//
// Zero LLM. Pure function.

export interface Chunk {
  text: string;
  index: number;
}

/**
 * Split reply text into progressive chunks. Preserves whitespace between
 * words. Each chunk contains 1-3 words plus its trailing space (or ends
 * the string on the last chunk).
 */
export function chunkReply(reply: string, opts?: { words_per_chunk?: number }): Chunk[] {
  const wordsPerChunk = Math.max(1, Math.min(10, opts?.words_per_chunk ?? 2));
  if (!reply) return [];
  const chunks: Chunk[] = [];
  // Split preserving whitespace: match either a non-space run OR a
  // whitespace run so we can reconstruct exactly. `re.exec` loop.
  const parts: string[] = [];
  const re = /\S+|\s+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(reply)) !== null) parts.push(m[0]);
  // Merge parts into chunks · each chunk holds wordsPerChunk word-tokens.
  let words = 0;
  let buf = "";
  let idx = 0;
  for (const p of parts) {
    buf += p;
    if (/\S/.test(p)) {
      words++;
      if (words >= wordsPerChunk) {
        chunks.push({ text: buf, index: idx++ });
        buf = "";
        words = 0;
      }
    }
  }
  if (buf.length > 0) chunks.push({ text: buf, index: idx++ });
  return chunks;
}

/**
 * Async generator that yields chunks with an optional delay between them.
 * Delay is capped so smoke tests don't time out.
 */
export async function* iterateChunks(reply: string, opts?: {
  words_per_chunk?: number;
  delay_ms_between?: number;
}): AsyncGenerator<Chunk, void, void> {
  const delay = Math.max(0, Math.min(200, opts?.delay_ms_between ?? 0));
  const chunks = chunkReply(reply, opts);
  for (const c of chunks) {
    yield c;
    if (delay > 0) await new Promise<void>((r) => setTimeout(r, delay));
  }
}

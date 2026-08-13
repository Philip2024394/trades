// KPE Stage 7 · Chunking Engine
//
// Splits normalised documents into logical chunks. NEVER random splits —
// always driven by structural boundaries (headings, blank lines, code fences).
// Each chunk carries a heading_path (breadcrumb of the H1/H2/H3 above it) so
// downstream stages have context without re-parsing.
//
// Also produces context_before / context_after (short excerpts from neighbouring
// chunks). This is the "chunk-with-context" pattern that produces better AI
// output than raw chunk-only slicing.

import { createHash, randomUUID } from "node:crypto";
import type { ChunkingInput, ChunkingOutput, ChunkRecord, PipelineStage } from "../types";

const MAX_CHUNK_CHARS = 4000;         // ~1000 tokens · fits any modern LLM
const MIN_CHUNK_CHARS = 40;           // don't emit trivial fragments
const CONTEXT_CHARS = 200;

function headingLevel(line: string): number | null {
  const m = line.match(/^(#{1,6})\s+/);
  return m ? m[1].length : null;
}

function estimateTokens(s: string): number {
  // Rough heuristic: 1 token ≈ 4 chars for English prose.
  return Math.ceil(s.length / 4);
}

export const ChunkingStage: PipelineStage<ChunkingInput, ChunkingOutput> = {
  name: "chunking",
  version: "1.0.0",
  async run(input: ChunkingInput): Promise<ChunkingOutput> {
    const lines = input.normalised_content.split("\n");
    const headingPath: string[] = [];       // stack of currently-open headings

    type Section = { headings: string[]; body: string[] };
    const sections: Section[] = [];
    let current: Section = { headings: [], body: [] };
    sections.push(current);

    for (const line of lines) {
      const level = headingLevel(line);
      if (level !== null) {
        // Truncate the path stack to this level - 1, then push the new heading.
        headingPath.length = Math.max(0, level - 1);
        headingPath.push(line.trim());
        // Start a new section on any heading.
        current = { headings: [...headingPath], body: [] };
        sections.push(current);
      } else {
        current.body.push(line);
      }
    }

    // Now split each section further if body exceeds MAX_CHUNK_CHARS.
    const chunkTexts: Array<{ headings: string[]; body: string }> = [];
    for (const s of sections) {
      const body = s.body.join("\n").trim();
      if (!body) continue;
      if (body.length <= MAX_CHUNK_CHARS) {
        chunkTexts.push({ headings: s.headings, body });
        continue;
      }
      // Blank-line splitting for oversized sections.
      const paragraphs = body.split(/\n{2,}/).filter(Boolean);
      let buf = "";
      for (const p of paragraphs) {
        if ((buf + "\n\n" + p).length > MAX_CHUNK_CHARS && buf) {
          chunkTexts.push({ headings: s.headings, body: buf });
          buf = p;
        } else {
          buf = buf ? `${buf}\n\n${p}` : p;
        }
      }
      if (buf) chunkTexts.push({ headings: s.headings, body: buf });
    }

    // Filter out too-tiny chunks
    const filtered = chunkTexts.filter((c) => c.body.length >= MIN_CHUNK_CHARS);

    // Assemble ChunkRecords with context windows
    const chunks: ChunkRecord[] = filtered.map((c, i) => {
      const prev = filtered[i - 1]?.body ?? null;
      const next = filtered[i + 1]?.body ?? null;
      return {
        chunk_id: randomUUID(),
        document_id: input.document.document_id,
        order_index: i,
        heading_path: c.headings,
        content: c.body,
        content_hash: createHash("sha256").update(c.body).digest("hex"),
        token_estimate: estimateTokens(c.body),
        context_before: prev ? prev.slice(-CONTEXT_CHARS) : null,
        context_after: next ? next.slice(0, CONTEXT_CHARS) : null,
      };
    });

    return { chunks };
  },
};

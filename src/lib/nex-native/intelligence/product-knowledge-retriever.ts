// src/lib/nex-native/intelligence/product-knowledge-retriever.ts
//
// Bridge 92 · Retrieval over the NEX Product Knowledge catalogue.
// -------------------------------------------------------------------
// Client-safe (no DB, no server-only imports) so the same retriever
// can back an admin/dev inspector page later without a duplicate impl.
//
// Scoring is lexical over title + content + keywords (same shape as
// the business-evidence-retriever · deliberate consistency so the
// gateway can merge results with predictable ranking).
//
// Emits EvidenceItem so it plugs into the existing evidence formatter
// without a new pipeline. Provenance is "product" · citation is the
// entry id (e.g. `feature.voice_call`).

import type { ProductKnowledgeEntry } from "./product-knowledge";
import { NEX_PRODUCT_KNOWLEDGE } from "./product-knowledge";
import type { EvidenceItem } from "./business-evidence-retriever";

export interface ProductRetrievalResult {
  items: EvidenceItem[];
  total_candidates: number;
}

export interface ProductRetrievalOptions {
  question: string;
  /** Cap on items · default 4. Product retrieval is intentionally
   *  smaller than business-evidence retrieval so the merged bundle
   *  doesn't blow the model context. */
  maxItems?: number;
  /** Restrict retrieval to one kind. Undefined = all three. */
  onlyKind?: ProductKnowledgeEntry["kind"];
}

export function retrieveProductKnowledge(
  opts: ProductRetrievalOptions,
): ProductRetrievalResult {
  const maxItems = opts.maxItems ?? 4;
  const questionTokens = tokenize(opts.question);
  if (questionTokens.size === 0) {
    return { items: [], total_candidates: 0 };
  }

  const pool = opts.onlyKind
    ? NEX_PRODUCT_KNOWLEDGE.filter((e) => e.kind === opts.onlyKind)
    : NEX_PRODUCT_KNOWLEDGE;

  const scored = pool.map((entry) => {
    const entryTokens = tokenize(
      `${entry.title} ${entry.content} ${entry.keywords.join(" ")}`,
    );
    let hits = 0;
    for (const t of questionTokens) if (entryTokens.has(t)) hits += 1;
    // Small keyword boost so exact keyword matches outrank incidental
    // content-token matches.
    let kwHits = 0;
    for (const t of questionTokens) if (entry.keywords.includes(t)) kwHits += 1;
    const score = Math.max(
      0,
      Math.min(1, hits / questionTokens.size + kwHits * 0.15),
    );
    return { entry, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const kept = scored.filter((s) => s.score > 0).slice(0, maxItems);

  const items: EvidenceItem[] = kept.map(({ entry, score }) => ({
    id: entry.id,
    provenance: "product" as const,
    // Use the entry id as the "source_id" · this catalogue is
    // versioned-in-code, not row-in-DB, so no UUID applies. The `id`
    // still serves as the authoritative citation the model uses.
    source_id: entry.id as unknown as string,
    updated_at: `${entry.sealed_at}T00:00:00.000Z`,
    title: entry.title,
    content: entry.content,
    score,
    figures: extractFigures(entry.content),
    urls: [],
  }));

  return { items, total_candidates: scored.length };
}

// ─── Text helpers (kept in-file to avoid a cross-module dependency) ──

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "of", "for", "in", "on", "to",
  "with", "at", "by", "is", "are", "was", "were", "be", "been", "being",
  "do", "does", "did", "have", "has", "had", "will", "would", "could",
  "should", "may", "might", "can", "must", "i", "you", "he", "she", "we",
  "they", "my", "your", "his", "her", "its", "our", "their", "this",
  "that", "these", "those", "if", "then", "so", "as", "than", "how",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t)),
  );
}

function extractFigures(text: string): string[] {
  const numeric = String.raw`\d[\d,]*(?:\.\d+)?`;
  const explicit = text.match(new RegExp(`[£$€¥]\\s?${numeric}`, "gi")) ?? [];
  const currencyPrefixed =
    text.match(new RegExp(`\\b(?:GBP|USD|EUR|JPY|IDR|Rp)\\s?${numeric}`, "gi")) ?? [];
  return [...explicit, ...currencyPrefixed].map((s) => s.trim());
}

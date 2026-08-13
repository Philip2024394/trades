// KPE Stage 5 · Metadata Extractor
//
// Pulls structured metadata from normalised content using regex + heuristics.
// No AI — every extraction is deterministic. If a future plugin wants to add
// LLM-powered entity extraction it can, but the default must always work.

import type { MetadataInput, MetadataOutput, PipelineStage } from "../types";

const URL_RE       = /https?:\/\/[^\s)]+/gi;
const EMAIL_RE     = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const ISO_DATE_RE  = /\b\d{4}-\d{2}-\d{2}\b/g;
const DMY_DATE_RE  = /\b\d{1,2}[\/\-](?:\d{1,2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[\/\-]\d{2,4}\b/gi;
const VERSION_RE   = /\bv?\d+\.\d+(?:\.\d+)?(?:-[a-z0-9]+)?\b/gi;
const AUTHOR_RE    = /(?:author|by|written by|from)\s*[:\-]?\s*([A-Z][a-zA-Z' ]{2,40}(?:\s[A-Z][a-zA-Z']{2,20})?)/g;
const DOC_REF_RE   = /\b(?:doc|record|adr|rfc|issue|ticket|pr|migration)[-_\s#]?(\d+|[a-f0-9-]{8,})\b/gi;

function extractLanguage(s: string): string {
  // Trivial detector: if content has ≥5 common English function words in the
  // first 500 chars, call it "en". Otherwise "unknown" — a proper langdetect
  // plugin can override.
  const sample = s.slice(0, 500).toLowerCase();
  const words = ["the", "and", "of", "to", "in", "a", "that", "is", "for"];
  const hits = words.filter((w) => sample.includes(` ${w} `)).length;
  return hits >= 3 ? "en" : "unknown";
}

function extractKeywords(s: string, limit = 12): string[] {
  const stopwords = new Set([
    "the","and","of","to","in","a","that","is","for","on","with","as","by","this",
    "at","from","or","an","be","it","are","was","were","not","have","has","had",
  ]);
  const tokens = (s.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? [])
    .filter((t) => !stopwords.has(t));
  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([t]) => t);
}

function extractEntities(s: string): string[] {
  // Simple capitalised-word-run detector · not a real NER but useful as a v1.
  const matches = s.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+){0,3})\b/g) ?? [];
  const counts = new Map<string, number>();
  for (const m of matches) {
    if (m.length < 4) continue;
    counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= 2)                // at least 2 mentions
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([e]) => e);
}

export const MetadataStage: PipelineStage<MetadataInput, MetadataOutput> = {
  name: "metadata",
  version: "1.0.0",
  async run(input: MetadataInput): Promise<MetadataOutput> {
    const s = input.normalised_content;

    const urls = [...new Set(s.match(URL_RE) ?? [])];
    const emails = [...new Set(s.match(EMAIL_RE) ?? [])];
    const isoDates = s.match(ISO_DATE_RE) ?? [];
    const dmyDates = s.match(DMY_DATE_RE) ?? [];
    const versions = [...new Set(s.match(VERSION_RE) ?? [])].slice(0, 10);
    const authorMatches: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = AUTHOR_RE.exec(s)) !== null) authorMatches.push(m[1].trim());
    const references = [...new Set(s.match(DOC_REF_RE) ?? [])];

    return {
      metadata: {
        authors: [...new Set(authorMatches)].slice(0, 10),
        dates: [...new Set([...isoDates, ...dmyDates])].slice(0, 20),
        versions,
        urls: urls.slice(0, 50),
        references: references.slice(0, 50),
        language: extractLanguage(s),
        keywords: extractKeywords(s),
        extracted_entities: [...extractEntities(s), ...emails],
      },
    };
  },
};

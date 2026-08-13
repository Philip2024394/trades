// Knowledge Layer retrieval — the single narrow interface every Brain uses.
//
// Extraction rule: Brains NEVER read data/nex-knowledge/* directly. They ALWAYS
// go through retrieve(). This is what makes the Knowledge Layer separable from
// the Brain layer.
//
// Fallback rule: if data/nex-knowledge/{domain}/ does NOT exist yet, retrieve()
// falls back to legacy shapes (knowledge/{domain}.json + nex-image-manifest.json)
// so downstream code doesn't break during migration.
//
// Doctrine: docs/brains/nex-knowledge-layer-extraction-philip-2026-08-03.md

import fs from "node:fs";
import path from "node:path";
import type {
  KnowledgeItem,
  RetrieveRequest,
  RetrieveResult,
  KnowledgeYamlDeclaration,
} from "./types";

const KNOWLEDGE_ROOT = path.join(process.cwd(), "data", "nex-knowledge");
const LEGACY_FAQ_ROOT = path.join(process.cwd(), "knowledge");
const IMAGE_MANIFEST = path.join(process.cwd(), "data", "nex-image-manifest.json");

const STOP = new Set([
  "a","an","the","my","our","i","we","to","for","of","in","on","at",
  "and","or","please","nex","me","is","are","do","does","how","what",
  "which","that","this","with","from","by","be","as","have","has",
]);

function tokenise(s: string): Set<string> {
  const toks = s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  return new Set(toks.filter((t) => !STOP.has(t)));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersect = 0;
  for (const t of a) if (b.has(t)) intersect++;
  const union = a.size + b.size - intersect;
  return union === 0 ? 0 : intersect / union;
}

function ensureArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

type FaqRow = {
  id: string;
  question: string;
  answer: string;
  category_tag?: string;
  audience_level?: 1 | 2 | 3;
  classification?: string;
  tags?: string[];
  authored_by?: string;
  a_plus?: boolean;
  draft_only?: boolean;
};

function loadFaqsForDomain(domain: string): { rows: FaqRow[]; source: string } {
  const modernPath = path.join(KNOWLEDGE_ROOT, domain, "faqs.jsonl");
  if (fs.existsSync(modernPath)) {
    const rows: FaqRow[] = [];
    const raw = fs.readFileSync(modernPath, "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      try { rows.push(JSON.parse(t) as FaqRow); } catch { /* skip malformed */ }
    }
    return { rows, source: `nex-knowledge/${domain}/faqs.jsonl` };
  }
  const legacyPath = path.join(LEGACY_FAQ_ROOT, `${domain}.json`);
  if (fs.existsSync(legacyPath)) {
    try {
      const arr = JSON.parse(fs.readFileSync(legacyPath, "utf8"));
      return { rows: ensureArray<FaqRow>(arr), source: `knowledge/${domain}.json` };
    } catch { return { rows: [], source: "" }; }
  }
  return { rows: [], source: "" };
}

type ImageRow = {
  url: string;
  description?: string;
  tags?: string[];
  a_plus?: boolean;
  subject_domain?: string;
  verified_by_human?: boolean;
  primary_brain?: string;
};

function loadImagesForDomain(domain: string): ImageRow[] {
  if (!fs.existsSync(IMAGE_MANIFEST)) return [];
  try {
    const raw = fs.readFileSync(IMAGE_MANIFEST, "utf8");
    const parsed = JSON.parse(raw) as { images?: Record<string, ImageRow> };
    const images = parsed.images ?? {};
    const out: ImageRow[] = [];
    for (const [url, meta] of Object.entries(images)) {
      if (meta.subject_domain === domain) {
        out.push({ ...meta, url });
      }
    }
    return out;
  } catch { return []; }
}

function loadDeclaration(domain: string): KnowledgeYamlDeclaration | null {
  const p = path.join(KNOWLEDGE_ROOT, domain, "knowledge.yaml");
  if (!fs.existsSync(p)) return null;
  // YAML parsing deferred until yaml package integration; declaration file
  // is optional — legacy mode works without it.
  return null;
}

export function retrieve(req: RetrieveRequest): RetrieveResult {
  const domain = req.domain;
  const query = req.query.trim();
  const limit = req.limit ?? 10;
  const minRelevance = req.min_relevance ?? 0.1;
  const minConfidence = req.min_confidence ?? 0.7;
  const filters = req.filters ?? {};

  if (!query) {
    return {
      items: [],
      overall_confidence: 0,
      sources: [],
      domain,
      needs_clarification: true,
      trace_reason: "empty query",
    };
  }

  const queryTokens = tokenise(query);
  const items: KnowledgeItem[] = [];
  const sources: string[] = [];
  loadDeclaration(domain); // reserved for future maturity gating

  // ── FAQs ──────────────────────────────────────────────────────
  if (!filters.item_types || filters.item_types.includes("faq")) {
    const { rows: faqs, source: faqSource } = loadFaqsForDomain(domain);
    if (faqSource) sources.push(faqSource);
    for (const faq of faqs) {
      if (filters.include_drafts !== true && faq.draft_only === true) continue;
      if (filters.a_plus_only === true && faq.a_plus !== true) continue;
      if (filters.audience_level && faq.audience_level && faq.audience_level > filters.audience_level) continue;
      if (filters.tags && filters.tags.length > 0) {
        const faqTags = new Set(faq.tags ?? []);
        if (!filters.tags.every((t) => faqTags.has(t))) continue;
      }
      // Weight question 3x more than answer — users typically match on question form.
      const questionScore = jaccard(queryTokens, tokenise(faq.question));
      const answerScore = jaccard(queryTokens, tokenise(faq.answer ?? ""));
      const relevance = questionScore * 0.75 + answerScore * 0.25;
      if (relevance < minRelevance) continue;
      items.push({
        type: "faq",
        id: faq.id,
        source: `${domain}/faqs`,
        relevance,
        summary: faq.question,
        content: faq as unknown as Record<string, unknown>,
        tags: faq.tags ?? [],
        authored_by: faq.authored_by,
        a_plus: faq.a_plus,
      });
    }
  }

  // ── Images ────────────────────────────────────────────────────
  if (!filters.item_types || filters.item_types.includes("image")) {
    const images = loadImagesForDomain(domain);
    if (images.length > 0) sources.push("nex-image-manifest.json");
    for (const img of images) {
      if (filters.a_plus_only === true && img.a_plus !== true) continue;
      if (filters.tags && filters.tags.length > 0) {
        const imgTags = new Set(img.tags ?? []);
        if (!filters.tags.every((t) => imgTags.has(t))) continue;
      }
      const desc = tokenise(img.description ?? "");
      const tagSet = tokenise((img.tags ?? []).join(" "));
      const combined = new Set<string>();
      desc.forEach((t) => combined.add(t));
      tagSet.forEach((t) => combined.add(t));
      const relevance = jaccard(queryTokens, combined);
      if (relevance < minRelevance) continue;
      items.push({
        type: "image",
        id: img.url,
        source: img.url,
        relevance,
        summary: (img.description ?? "").split("\n")[0].slice(0, 120),
        content: img as unknown as Record<string, unknown>,
        tags: img.tags ?? [],
        a_plus: img.a_plus,
      });
    }
  }

  // ── Sort by relevance descending ──────────────────────────────
  items.sort((a, b) => b.relevance - a.relevance);
  const topItems = items.slice(0, limit);

  // ── Overall confidence: mean of top-3 relevance ───────────────
  const top3 = topItems.slice(0, 3);
  const overall_confidence = top3.length === 0
    ? 0
    : top3.reduce((sum, i) => sum + i.relevance, 0) / top3.length;

  const needs_clarification = overall_confidence < minConfidence;

  return {
    items: topItems,
    overall_confidence,
    sources,
    domain,
    needs_clarification,
    trace_reason: needs_clarification
      ? `retrieval confidence ${overall_confidence.toFixed(2)} below threshold ${minConfidence} · ${items.length} candidates found · Brain 14 gate requires clarification`
      : `retrieved ${topItems.length}/${items.length} items · top relevance ${top3[0]?.relevance.toFixed(2)} · overall ${overall_confidence.toFixed(2)}`,
  };
}

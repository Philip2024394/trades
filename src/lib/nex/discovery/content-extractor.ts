// src/lib/nex/discovery/content-extractor.ts
//
// UWI · Wave 3.3 · M12 · Deterministic HTML → clean-text extraction
// Founder-authorised programme.
//
// Pipeline (all deterministic · no LLM · no external service):
//   1. Parse HTML with @mixmark-io/domino (approved Wave 3.2 · BSD-2)
//   2. Feed DOM to @mozilla/readability (approved · Apache-2.0)
//   3. Optionally convert cleaned HTML to Markdown via turndown (approved · MIT)
//   4. Compute language + extraction-quality signal
//   5. Return ExtractionOutcome with warnings for partial extractions

import type { ExtractionOutcome } from "./types";

// Note: dynamic imports so this module doesn't force jsdom / domino
// loading when only sitemap parsing is used.

export interface ExtractorConfig {
  produce_markdown: boolean;
  min_text_length_for_clean: number; // below → "partial" or "empty"
  max_html_bytes: number;
}

export const DEFAULT_EXTRACTOR: ExtractorConfig = {
  produce_markdown: true,
  min_text_length_for_clean: 200,
  max_html_bytes: 5 * 1024 * 1024, // 5 MB
};

export async function extractContent(
  html: string,
  source_url: string,
  config: ExtractorConfig = DEFAULT_EXTRACTOR,
): Promise<ExtractionOutcome> {
  const warnings: string[] = [];

  if (!html || html.length === 0) {
    return {
      ok: false,
      title: null, main_text: null, markdown: null,
      language: null, byline: null, excerpt: null,
      extraction_quality: "empty",
      warnings: ["empty html"],
    };
  }

  if (html.length > config.max_html_bytes) {
    warnings.push(`html truncated from ${html.length} to ${config.max_html_bytes} bytes`);
    html = html.slice(0, config.max_html_bytes);
  }

  // Best-effort dynamic imports · caller may have installed different DOM shim.
  let domino: any;
  let ReadabilityCtor: any;
  let TurndownServiceCtor: any;
  try {
    domino = (await import("@mixmark-io/domino")).default ?? await import("@mixmark-io/domino");
  } catch {
    warnings.push("dom shim @mixmark-io/domino unavailable");
    return {
      ok: false,
      title: null, main_text: null, markdown: null,
      language: null, byline: null, excerpt: null,
      extraction_quality: "empty",
      warnings,
    };
  }
  try {
    ReadabilityCtor = (await import("@mozilla/readability")).Readability;
  } catch {
    warnings.push("@mozilla/readability unavailable");
    return {
      ok: false,
      title: null, main_text: null, markdown: null,
      language: null, byline: null, excerpt: null,
      extraction_quality: "empty",
      warnings,
    };
  }
  if (config.produce_markdown) {
    try {
      TurndownServiceCtor = (await import("turndown")).default;
    } catch {
      warnings.push("turndown unavailable; markdown skipped");
      TurndownServiceCtor = null;
    }
  }

  let doc: any;
  try {
    doc = domino.createDocument(html, true);
  } catch (e: any) {
    warnings.push(`domino createDocument failed: ${e?.message ?? String(e)}`);
    return {
      ok: false,
      title: null, main_text: null, markdown: null,
      language: null, byline: null, excerpt: null,
      extraction_quality: "empty",
      warnings,
    };
  }

  // Readability
  let article: any = null;
  try {
    const reader = new ReadabilityCtor(doc, { debug: false });
    article = reader.parse();
  } catch (e: any) {
    warnings.push(`readability parse threw: ${e?.message ?? String(e)}`);
  }

  if (!article || !article.textContent) {
    return {
      ok: false,
      title: null, main_text: null, markdown: null,
      language: doc?.documentElement?.getAttribute("lang") ?? null,
      byline: null, excerpt: null,
      extraction_quality: "empty",
      warnings: [...warnings, "readability produced no article"],
    };
  }

  const main_text: string = String(article.textContent).trim();
  const title: string | null = article.title ?? null;
  const byline: string | null = article.byline ?? null;
  const excerpt: string | null = article.excerpt ?? null;
  const language: string | null = article.lang ?? doc?.documentElement?.getAttribute("lang") ?? null;

  let markdown: string | null = null;
  if (config.produce_markdown && TurndownServiceCtor && article.content) {
    try {
      const td = new TurndownServiceCtor({ headingStyle: "atx", codeBlockStyle: "fenced" });
      markdown = String(td.turndown(article.content)).trim();
    } catch (e: any) {
      warnings.push(`turndown failed: ${e?.message ?? String(e)}`);
    }
  }

  // Extraction-quality signal
  let extraction_quality: ExtractionOutcome["extraction_quality"];
  if (main_text.length < config.min_text_length_for_clean) {
    extraction_quality = "partial";
    warnings.push(`main_text length ${main_text.length} below clean threshold ${config.min_text_length_for_clean}`);
  } else {
    // Rough boilerplate signal: ratio of unique-word density
    const words = main_text.split(/\s+/).filter(Boolean);
    const unique_ratio = new Set(words.map(w => w.toLowerCase())).size / Math.max(1, words.length);
    extraction_quality = unique_ratio < 0.3 ? "boilerplate_heavy" : "clean";
  }

  return {
    ok: true,
    title,
    main_text,
    markdown,
    language,
    byline,
    excerpt,
    extraction_quality,
    warnings,
  };
}

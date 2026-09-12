// src/lib/nex/language/normaliser.ts
//
// Founder BEGIN 2026-09-10 · DOMAIN-AGNOSTIC normaliser for the NEX language
// engine. Lifted from the accommodation implementation · same algorithm ·
// generalised so any domain (code · business · brain) plugs in its own alias
// map or shares the UK English defaults.
//
// Deterministic. No LLM. No embeddings.

import type { NormaliserResult } from "./types";
import { STOPWORDS_EN_GB } from "./stopwords-en-gb";
import { UK_SLANG_ALIASES } from "./slang-en-gb";

function stripPunctuation(s: string): string {
  return s.replace(/[.,;!?"'`()\[\]{}—–]/g, " ");
}
function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export interface NormaliserOptions {
  extraAliases?: Readonly<Record<string, string>>;
  extraStopwords?: ReadonlySet<string>;
  disableSlang?: boolean;
}

/**
 * Normalise a raw user query into canonical tokens.
 * Deterministic · zero embeddings · zero LLM.
 *
 * Longest-match first for multi-word aliases. Single-token aliases + stopword
 * strip pass afterwards. Unrecognised tokens flow through as-is (may still
 * match downstream via regex or be a proper noun).
 */
export function normalise(raw: string, opts: NormaliserOptions = {}): NormaliserResult {
  const contained_question_mark = /\?/.test(raw);
  const lowered = String(raw ?? "").toLowerCase();
  const cleaned = collapseWhitespace(stripPunctuation(lowered));

  const aliases: Record<string, string> = {
    ...(opts.disableSlang ? {} : UK_SLANG_ALIASES),
    ...(opts.extraAliases ?? {}),
  };
  const aliasIndex = new Map<string, string>(Object.entries(aliases));

  const stopwords: ReadonlySet<string> = opts.extraStopwords
    ? new Set([...STOPWORDS_EN_GB, ...opts.extraStopwords])
    : STOPWORDS_EN_GB;

  const substitutions: { from: string; to: string }[] = [];
  let working = cleaned;
  const multiWord = [...aliasIndex.keys()]
    .filter(k => k.includes(" "))
    .sort((a, b) => b.length - a.length);
  for (const alias of multiWord) {
    const rx = new RegExp(`\\b${alias.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "g");
    if (rx.test(working)) {
      const canonical = aliasIndex.get(alias)!;
      working = working.replace(rx, canonical);
      substitutions.push({ from: alias, to: canonical });
    }
  }

  const tokens = working.split(/\s+/).filter(Boolean);
  const canonical_tokens: string[] = [];
  const unresolved: string[] = [];
  for (const t of tokens) {
    if (stopwords.has(t)) continue;
    const canon = aliasIndex.get(t);
    if (canon) {
      // Alias value may itself contain multiple tokens ("going to").
      for (const piece of canon.split(/\s+/).filter(Boolean)) {
        if (stopwords.has(piece)) continue;
        canonical_tokens.push(piece);
      }
      if (canon !== t) substitutions.push({ from: t, to: canon });
    } else {
      canonical_tokens.push(t);
      unresolved.push(t);
    }
  }

  return {
    raw,
    cleaned,
    tokens,
    canonical_tokens,
    substitutions,
    unresolved,
    contained_question_mark,
  };
}

export function stopwordCount(): number { return STOPWORDS_EN_GB.size; }
export function slangCount(): number { return Object.keys(UK_SLANG_ALIASES).length; }

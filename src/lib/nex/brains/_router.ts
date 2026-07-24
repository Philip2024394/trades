// Retrieval router — enforces ADR-0021 domain separation at the code
// boundary. Every Brain query must name its target Brain(s) explicitly.
// Wildcards ('*', empty arrays, ['*']) are refused. Unknown slugs are
// refused. Every call logs the context_domains it touched so the
// weekly audit can spot anomalies.
//
// This module is content-agnostic — it decides WHERE to look, not
// WHAT the answer is. Content lookup inside a Brain module is left to
// specialist helpers (loaded from the Brain modules themselves).

import { brainRegistry } from "./_loader";
import type { LoadedBrain } from "./_types";
import type { V1ModuleName } from "./_schema";

export type RetrievalStatus =
  | "ok"
  | "not_found"
  | "insufficient_confidence"
  | "no_brains_registered";

export type RetrievalHit = {
  brain_slug: string;
  module:     V1ModuleName;
  ref_id:     string;
  snippet:    string;
  evidence:   Array<{ source: string; url?: string }>;
};

export type RetrievalResult = {
  status: RetrievalStatus;
  data:   RetrievalHit[];
  provenance: {
    brain_versions:    Record<string, string>;
    modules_consulted: string[];
    author_attribution: string[];
    context_domains:   string[];    // for ADR-0021 audit log
  };
};

export type RetrievalOptions = {
  /** Explicit list of Brain slugs. Required by ADR-0021 §retrieval API
   *  contracts. No wildcards, no ['*'], no empty arrays. */
  brain_slugs: string[];
  query:       string;
  modules?:    V1ModuleName[];
  region?:     string;
  limit?:      number;
};

export class DomainSeparationError extends Error {
  constructor(msg: string) { super(msg); this.name = "DomainSeparationError"; }
}

const DEFAULT_LIMIT = 5;
const MAX_LIMIT     = 25;

/** Retrieve knowledge from one or more Brains. Enforces ADR-0021. */
export function retrieveFromBrains(opts: RetrievalOptions): RetrievalResult {
  const slugs = enforceBrainSlugs(opts.brain_slugs);
  const brains: LoadedBrain[] = [];

  for (const slug of slugs) {
    const brain = brainRegistry.get(slug);
    if (!brain) {
      throw new DomainSeparationError(
        `Brain '${slug}' is not registered. Retrieval refuses fallback to other domains.`
      );
    }
    if (brain.manifest.status !== "published") {
      throw new DomainSeparationError(
        `Brain '${slug}' is not published (status=${brain.manifest.status}). Cannot retrieve.`
      );
    }
    brains.push(brain);
  }

  if (brains.length === 0) {
    return emptyResult("no_brains_registered", slugs);
  }

  const modules = opts.modules ?? [
    "craft", "regulations", "materials", "workflow", "defects", "pricing_model"
  ];
  const limit = clampLimit(opts.limit);

  const hits: RetrievalHit[] = [];
  for (const brain of brains) {
    for (const module of modules) {
      hits.push(...searchModule(brain, module, opts.query, opts.region));
      if (hits.length >= limit) break;
    }
    if (hits.length >= limit) break;
  }

  const provenance = {
    brain_versions:     Object.fromEntries(brains.map((b) => [b.manifest.slug, b.manifest.version])),
    modules_consulted:  modules,
    author_attribution: brains
      .map((b) => b.manifest.primary_author_name)
      .filter((n): n is string => n != null),
    context_domains:    brains.map((b) => `brain:${b.manifest.slug}`)
  };

  return {
    status: hits.length === 0 ? "not_found" : "ok",
    data:   hits.slice(0, limit),
    provenance
  };
}

/** Convenience wrapper for the single-Brain case — still enforces the
 *  explicit-domain rule. */
export function retrieveFromBrain(opts: Omit<RetrievalOptions, "brain_slugs"> & { brain_slug: string }): RetrievalResult {
  return retrieveFromBrains({
    brain_slugs: [opts.brain_slug],
    query:       opts.query,
    modules:     opts.modules,
    region:      opts.region,
    limit:       opts.limit
  });
}

// ─── Enforcement ────────────────────────────────────────────────

function enforceBrainSlugs(input: unknown): string[] {
  if (!Array.isArray(input)) {
    throw new DomainSeparationError("brain_slugs must be a string array");
  }
  if (input.length === 0) {
    throw new DomainSeparationError(
      "brain_slugs is empty. ADR-0021 forbids wildcard 'search everything' calls."
    );
  }
  const clean: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") {
      throw new DomainSeparationError("brain_slugs entries must be strings");
    }
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed === "*") {
      throw new DomainSeparationError(
        `Wildcard slug '${raw}' rejected. ADR-0021 default-deny cross-domain retrieval.`
      );
    }
    if (!/^[a-z][a-z0-9_-]{1,63}$/.test(trimmed)) {
      throw new DomainSeparationError(`Malformed brain slug: '${raw}'`);
    }
    clean.push(trimmed);
  }
  return Array.from(new Set(clean));
}

function clampLimit(n: number | undefined): number {
  if (n == null || !Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.floor(n));
}

// ─── Module search ──────────────────────────────────────────────
//
// V0 search is deterministic keyword-match over Author-authored fields.
// No embeddings, no ranking magic — a Brain is small enough that a
// linear scan is cheaper than the retrieval it replaces. Embeddings
// land later (Phase 26 pgvector integration) but are strictly domain-
// scoped per ADR-0021 pgvector scoping.

function searchModule(brain: LoadedBrain, module: V1ModuleName, query: string, region?: string): RetrievalHit[] {
  const q = query.toLowerCase().trim();
  if (q === "") return [];
  const hits: RetrievalHit[] = [];

  switch (module) {
    case "craft": {
      for (const fact of brain.craft.facts) {
        if (matches(q, fact.statement)) {
          hits.push(makeHit(brain, "craft", fact.id, fact.statement, fact.evidence));
        }
      }
      for (const term of brain.craft.glossary) {
        if (matches(q, term.term) || matches(q, term.definition)) {
          hits.push(makeHit(brain, "craft", `glossary:${term.term}`, `${term.term} — ${term.definition}`, term.evidence));
        }
      }
      break;
    }
    case "regulations": {
      for (const reg of brain.regulations.regulations) {
        if (matches(q, reg.title) || matches(q, reg.requirement)) {
          hits.push(makeHit(brain, "regulations", reg.id, reg.requirement, reg.evidence));
        }
      }
      break;
    }
    case "materials": {
      for (const mat of brain.materials.materials) {
        if (matches(q, mat.name) || matches(q, mat.family)) {
          hits.push(makeHit(brain, "materials", mat.id, `${mat.name} (${mat.family})`, mat.evidence));
        }
      }
      break;
    }
    case "workflow": {
      for (const pb of brain.workflow.playbooks) {
        if (matches(q, pb.title)) {
          hits.push(makeHit(brain, "workflow", pb.id, pb.title, pb.evidence));
        }
      }
      break;
    }
    case "defects": {
      for (const d of brain.defects.defects) {
        if (matches(q, d.name) || d.symptoms.some((s) => matches(q, s))) {
          hits.push(makeHit(brain, "defects", d.id, d.name, d.evidence));
        }
      }
      break;
    }
    case "pricing_model": {
      for (const rule of brain.pricing_model.rules) {
        if (matches(q, rule.rule_key)) {
          const hit = makeHit(brain, "pricing_model", rule.id, rule.rule_key, rule.evidence);
          if (region && rule.regional_multipliers[region] != null) {
            hit.snippet = `${rule.rule_key} (region multiplier=${rule.regional_multipliers[region]})`;
          }
          hits.push(hit);
        }
      }
      break;
    }
  }

  return hits;
}

function matches(q: string, text: string | undefined): boolean {
  if (!text) return false;
  return text.toLowerCase().includes(q);
}

// ─── Smart tokenised search ─────────────────────────────────────
//
// The V0 exact-substring router misses "cut string" when facts write
// "cut-string" or split the words across a sentence. This tokenised
// wrapper splits the query into words, scores each fact by how many
// query words it contains, and returns the top N hits.

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "should",
  "could", "may", "might", "must", "of", "in", "on", "at", "to", "for",
  "with", "and", "or", "but", "if", "as", "by", "from", "up", "down",
  "what", "which", "how", "why", "when", "where", "who", "whom", "this",
  "that", "these", "those", "i", "you", "he", "she", "it", "we", "they",
  "my", "your", "his", "her", "its", "our", "their", "me", "him", "us",
  "them", "am", "can", "into", "than", "then", "there", "here", "some",
  "any", "no", "not", "yes", "so", "just", "also", "very", "much", "many",
  "about", "over", "under", "between", "through", "during", "before",
  "after", "above", "below", "off", "again", "further", "once"
]);

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/[\s-]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/** Count how many distinct query words appear in text. Returns 0 if
 *  no words match, higher for better matches. */
function scoreMatch(queryWords: string[], text: string | undefined): number {
  if (!text || queryWords.length === 0) return 0;
  const textLower = text.toLowerCase();
  let hits = 0;
  for (const w of queryWords) {
    if (textLower.includes(w)) hits++;
  }
  return hits;
}

type ScoredHit = RetrievalHit & { _score: number };

/** Smart tokenised retrieval — returns top-scored hits across all
 *  requested Brains and modules. Sorts by number of query words
 *  matched (highest first). Requires at least one word match. */
export function retrieveFromBrainsSmart(opts: RetrievalOptions): RetrievalResult {
  const slugs = enforceBrainSlugs(opts.brain_slugs);
  const brains: LoadedBrain[] = [];

  for (const slug of slugs) {
    const brain = brainRegistry.get(slug);
    if (!brain) {
      throw new DomainSeparationError(
        `Brain '${slug}' is not registered. Retrieval refuses fallback to other domains.`
      );
    }
    if (brain.manifest.status !== "published") {
      throw new DomainSeparationError(
        `Brain '${slug}' is not published (status=${brain.manifest.status}). Cannot retrieve.`
      );
    }
    brains.push(brain);
  }

  if (brains.length === 0) {
    return emptyResult("no_brains_registered", slugs);
  }

  const queryWords = tokenise(opts.query);
  if (queryWords.length === 0) {
    return { status: "not_found", data: [], provenance: {
      brain_versions:     Object.fromEntries(brains.map((b) => [b.manifest.slug, b.manifest.version])),
      modules_consulted:  opts.modules ?? ["craft", "regulations", "materials", "workflow", "defects", "pricing_model"],
      author_attribution: brains.map((b) => b.manifest.primary_author_name).filter((n): n is string => n != null),
      context_domains:    brains.map((b) => `brain:${b.manifest.slug}`)
    }};
  }

  const modules = opts.modules ?? [
    "craft", "regulations", "materials", "workflow", "defects", "pricing_model"
  ];
  const limit = clampLimit(opts.limit);

  const scored: ScoredHit[] = [];
  for (const brain of brains) {
    for (const module of modules) {
      scored.push(...smartSearchModule(brain, module, queryWords));
    }
  }

  scored.sort((a, b) => b._score - a._score);
  const hits: RetrievalHit[] = scored.slice(0, limit).map(({ _score, ...h }) => h);

  const provenance = {
    brain_versions:     Object.fromEntries(brains.map((b) => [b.manifest.slug, b.manifest.version])),
    modules_consulted:  modules,
    author_attribution: brains
      .map((b) => b.manifest.primary_author_name)
      .filter((n): n is string => n != null),
    context_domains:    brains.map((b) => `brain:${b.manifest.slug}`)
  };

  return {
    status: hits.length === 0 ? "not_found" : "ok",
    data:   hits,
    provenance
  };
}

function smartSearchModule(brain: LoadedBrain, module: V1ModuleName, queryWords: string[]): ScoredHit[] {
  const hits: ScoredHit[] = [];

  switch (module) {
    case "craft": {
      for (const fact of brain.craft.facts) {
        const score = scoreMatch(queryWords, fact.statement);
        if (score > 0) hits.push({ ...makeHit(brain, "craft", fact.id, fact.statement, fact.evidence), _score: score });
      }
      for (const term of brain.craft.glossary) {
        const score = Math.max(scoreMatch(queryWords, term.term), scoreMatch(queryWords, term.definition));
        if (score > 0) hits.push({ ...makeHit(brain, "craft", `glossary:${term.term}`, `${term.term} — ${term.definition}`, term.evidence), _score: score });
      }
      break;
    }
    case "regulations": {
      for (const reg of brain.regulations.regulations) {
        const score = Math.max(scoreMatch(queryWords, reg.title), scoreMatch(queryWords, reg.requirement));
        if (score > 0) hits.push({ ...makeHit(brain, "regulations", reg.id, reg.requirement, reg.evidence), _score: score });
      }
      break;
    }
    case "materials": {
      for (const mat of brain.materials.materials) {
        const evNote = mat.evidence?.[0]?.note ?? "";
        const score = Math.max(
          scoreMatch(queryWords, mat.name),
          scoreMatch(queryWords, mat.family),
          scoreMatch(queryWords, evNote)
        );
        if (score > 0) hits.push({ ...makeHit(brain, "materials", mat.id, `${mat.name} — ${evNote}`.slice(0, 800), mat.evidence), _score: score });
      }
      break;
    }
    case "workflow": {
      for (const pb of brain.workflow.playbooks) {
        const score = scoreMatch(queryWords, pb.title);
        if (score > 0) hits.push({ ...makeHit(brain, "workflow", pb.id, pb.title, pb.evidence), _score: score });
      }
      break;
    }
    case "defects": {
      for (const d of brain.defects.defects) {
        const symptomText = d.symptoms.join(" ");
        const score = Math.max(scoreMatch(queryWords, d.name), scoreMatch(queryWords, symptomText));
        if (score > 0) hits.push({ ...makeHit(brain, "defects", d.id, d.name, d.evidence), _score: score });
      }
      break;
    }
    case "pricing_model": {
      for (const rule of brain.pricing_model.rules) {
        const score = scoreMatch(queryWords, rule.rule_key);
        if (score > 0) hits.push({ ...makeHit(brain, "pricing_model", rule.id, rule.rule_key, rule.evidence), _score: score });
      }
      break;
    }
  }

  return hits;
}

function makeHit(
  brain: LoadedBrain,
  module: V1ModuleName,
  ref_id: string,
  snippet: string,
  evidence: Array<{ source: string; url?: string }>
): RetrievalHit {
  return {
    brain_slug: brain.manifest.slug,
    module,
    ref_id,
    snippet,
    evidence: evidence.map((e) => ({ source: e.source, url: e.url }))
  };
}

function emptyResult(status: RetrievalStatus, slugs: string[]): RetrievalResult {
  return {
    status,
    data: [],
    provenance: {
      brain_versions:     {},
      modules_consulted:  [],
      author_attribution: [],
      context_domains:    slugs.map((s) => `brain:${s}`)
    }
  };
}

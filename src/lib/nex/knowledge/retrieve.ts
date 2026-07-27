// Simple keyword-based retrieval over knowledge_master.json.
// V1: word-overlap scoring — no embeddings, no LLM, no cost.
// V2 will layer semantic retrieval on top once volume justifies it.
//
// The master file is loaded once per Node process and cached, so
// hot queries pay ~50ms once then near-zero.

import fs from "node:fs";
import path from "node:path";

export type DiagramLabel = {
  n:           number;
  name:        string;
  description: string;
};

export type Diagram = {
  url:       string;
  alt?:      string;
  title?:    string;
  caption?:  string;
  labels?:   DiagramLabel[];
  footnote?: string;
};

export type BrainEntry = {
  id:                 string;
  kind:               string;
  question:           string;
  answer:             string;
  category_tag:       string;
  audience_level:     number | null;
  classification:     string;
  safety_note:        string | null;
  source_verified_at: string | null;
  fact_check_flag:    string | null;
  diagram?:           Diagram;
};

type MasterFile = {
  entries?: BrainEntry[];
};

let cachedMaster: MasterFile | null = null;

function loadMaster(): MasterFile {
  if (cachedMaster) return cachedMaster;
  const p = path.resolve(process.cwd(), "knowledge_master.json");
  if (!fs.existsSync(p)) return { entries: [] };
  try {
    cachedMaster = JSON.parse(fs.readFileSync(p, "utf8")) as MasterFile;
  } catch {
    cachedMaster = { entries: [] };
  }
  return cachedMaster;
}

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "should", "could",
  "of", "for", "to", "in", "on", "at", "by", "with", "from", "as", "and", "or", "but",
  "i", "you", "he", "she", "it", "we", "they", "my", "your", "his", "her", "our", "their",
  "this", "that", "these", "those", "some", "any", "all", "no", "not", "so", "if", "then",
  "what", "which", "who", "whom", "whose", "where", "when", "why", "how"
]);

// Basic English stemming — collapses squeak/squeaks/squeaking to
// one root, stair/stairs to one root. Keeps trade terminology
// matching more forgiving without pulling in a full NLP library.
function stem(w: string): string {
  if (w.length <= 3) return w;
  if (w.endsWith("ing") && w.length > 5) return w.slice(0, -3);
  if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y";
  if (w.endsWith("es")  && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("s")   && w.length > 4) return w.slice(0, -1);
  return w;
}

// Small manual synonym map for words that don't share a stem but
// mean the same thing in trade context. Add sparingly.
const SYNONYMS: Record<string, string[]> = {
  stair:     ["staircase"],
  staircase: ["stair"],
  fix:       ["repair", "mend"],
  repair:    ["fix", "mend"]
};

function tokenize(s: string): string[] {
  const bare = String(s)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .map(stem);
  const expanded: string[] = [];
  for (const w of bare) {
    expanded.push(w);
    if (SYNONYMS[w]) expanded.push(...SYNONYMS[w].map(stem));
  }
  return expanded;
}

/** Retrieve up to `limit` brain entries most relevant to `query`.
 *  Returns them sorted by score descending. Empty array if no match
 *  scores above the minimum threshold. */
export function retrieveBrainMatches(query: string, limit = 3): BrainEntry[] {
  const master = loadMaster();
  const entries = Array.isArray(master.entries) ? master.entries : [];
  if (entries.length === 0) return [];

  const qWords = tokenize(query);
  if (qWords.length === 0) return [];

  const scored = entries.map((e) => {
    const hay = tokenize(`${e.question} ${e.answer} ${e.category_tag}`);
    const haySet = new Set(hay);
    let score = 0;
    for (const w of qWords) {
      if (haySet.has(w)) score += 1;
      // Category tag matches carry extra weight
      if (e.category_tag && e.category_tag.toLowerCase() === w) score += 2;
    }
    // Question words scoring higher than answer body — questions are usually
    // the anchor phrase
    const qTokens = tokenize(e.question);
    for (const w of qWords) if (qTokens.includes(w)) score += 1;
    return { entry: e, score };
  });

  return scored
    .filter((s) => s.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.entry);
}

/** True if at least one match includes an educational diagram. */
export function hasDiagramMatch(matches: BrainEntry[]): boolean {
  return matches.some((m) => m.diagram && m.diagram.url);
}

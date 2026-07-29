// Golden Reply retriever — given the classified intent + stage + the
// user turn, return the top-N most semantically relevant human-
// approved examples for the composer to few-shot from.
//
// Design notes:
//
// - Embeddings are precomputed offline by scripts/embed-golden-replies.mjs
//   and read once at module init from data/nex/golden-replies.embeddings.json.
//   This keeps request-time cost to a single OpenAI embedding call for
//   the user's turn (~2ms + ~1500 tokens ≈ $0.00003).
//
// - Ranking is hybrid: cosine similarity (semantic match) as the main
//   signal, plus small additive bonuses for matching intent_family
//   and stage. Cosine dominates so classifier misclassification can
//   still surface a semantically correct example — the classifier's
//   regex signal only sharpens ties.
//
// - Recency exclusion: `recentIds` are filtered before scoring so the
//   model doesn't see the same example twice across a multi-turn
//   discussion. Recent set is client-supplied (server-tracked in a
//   later patch).
//
// - Graceful degradation: if OPENAI_API_KEY is missing OR the
//   embeddings file doesn't exist yet, retrieval returns []. The
//   composer runs with no few-shots — behaviour identical to before
//   Patch A. This is deliberate — the pipeline never blocks a reply.

import { embedText } from "@/lib/llm/embeddings";
import type { GoldenReply, IntentFamily, Stage, ScoredGoldenReply } from "./types";

// Weights for the hybrid scoring. Cosine similarity ranges [-1, 1]
// (in practice roughly [0.2, 0.9] for real user turns), so a 0.15
// intent bonus and 0.05 stage bonus act as tie-breakers rather than
// overrides. Adjust after Patch B eval data lands.
const INTENT_BONUS = 0.15;
const STAGE_BONUS  = 0.05;

// Minimum RAW cosine similarity (before intent/stage bonuses) that
// the best candidate must clear before we inject ANY examples. Poor
// examples poison the LLM's imitation — better to fall back to base
// voice than to few-shot from irrelevant matches. Applied to raw
// cosine so the classifier bonuses can't push a semantically weak
// match past the gate.
//
// 0.40 chosen as a moderate default:
//   > 0.60  = clearly on-topic
//   0.40-0.60 = same domain, imperfect match (inject with bonuses)
//   < 0.40  = clearly off-topic (gate: no injection)
//
// Tuning: Patch B eval harness produces per-turn top_cosine values.
// If the p95 of "should have injected but didn't" cases sits below
// 0.40, lower it. If false-positive injections are the problem
// (gate too loose), raise it. Never guess — measure.
const MIN_COSINE_THRESHOLD = 0.40;

let LIBRARY: GoldenReply[] | null = null;
let LOAD_ATTEMPTED = false;

// Loader is fully lazy: node built-ins (fs, path) are required
// dynamically inside the function so Turbopack's module analyser
// never has to reason about them at compile time. The file may not
// exist yet (embeddings script hasn't run) — that's fine, we return
// [] and let the composer degrade to its base voice.
function loadLibrary(): GoldenReply[] {
  if (LIBRARY) return LIBRARY;
  if (LOAD_ATTEMPTED) return [];
  LOAD_ATTEMPTED = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs") as typeof import("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("path") as typeof import("path");
    const embeddingsPath = path.join(
      process.cwd(),
      "data",
      "nex",
      "golden-replies.embeddings.json"
    );
    const raw = fs.readFileSync(embeddingsPath, "utf-8");
    const parsed = JSON.parse(raw) as GoldenReply[];
    if (!Array.isArray(parsed)) return [];
    LIBRARY = parsed.filter((e) =>
      e &&
      typeof e.id === "string" &&
      Array.isArray(e.embedding) &&
      e.embedding.length > 0
    );
    return LIBRARY;
  } catch {
    return [];
  }
}

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]; const bi = b[i];
    dot += ai * bi;
    na  += ai * ai;
    nb  += bi * bi;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export type RetrieveInput = {
  intent_family: IntentFamily;
  stage:         Stage;
  userMessage:   string;
  recentIds?:    string[];
  limit?:        number;
};

export type RetrieveResult = {
  replies:    GoldenReply[];
  top_cosine: number;   // raw cosine of the best candidate (before bonuses); 0 if none scored
  gated:      boolean;  // true when threshold caused replies=[] (best_cosine < MIN_COSINE_THRESHOLD)
};

const EMPTY: RetrieveResult = { replies: [], top_cosine: 0, gated: false };

/** Retrieve top-N golden replies for the user's turn. Never throws;
 *  returns EMPTY on any failure so the composer degrades cleanly.
 *
 *  Threshold gate: even after finding candidates, if the best raw
 *  cosine similarity (before intent/stage bonuses) is below
 *  MIN_COSINE_THRESHOLD, returns replies=[] with gated=true. Poor
 *  examples are worse than no examples — the composer's base voice
 *  is better than mimicking an irrelevant Golden Reply. */
export async function retrieveGoldenReplies(input: RetrieveInput): Promise<RetrieveResult> {
  const library = loadLibrary();
  if (library.length === 0) return EMPTY;

  const userVec = await embedText(input.userMessage);
  if (!userVec) return EMPTY;

  const recent = new Set(input.recentIds ?? []);
  const candidates = library.filter((g) => !recent.has(g.id));
  if (candidates.length === 0) return EMPTY;

  const scored: Array<ScoredGoldenReply & { raw_cosine: number }> = candidates.map((entry) => {
    const rawCos = cosine(userVec, entry.embedding);
    let score = rawCos;
    if (entry.intent_family === input.intent_family) score += INTENT_BONUS;
    if (entry.stage === input.stage)                 score += STAGE_BONUS;
    return { entry, score, raw_cosine: rawCos };
  });

  scored.sort((a, b) => b.score - a.score);

  // Find the raw cosine of the top-scoring entry. Threshold applies
  // to raw cosine so intent/stage bonuses can't push a semantically
  // weak match past the gate.
  const topRawCosine = scored[0]?.raw_cosine ?? 0;
  if (topRawCosine < MIN_COSINE_THRESHOLD) {
    return { replies: [], top_cosine: topRawCosine, gated: true };
  }

  const replies = scored.slice(0, input.limit ?? 3).map((s) => s.entry);
  return { replies, top_cosine: topRawCosine, gated: false };
}

/** Serialise retrieved examples for injection into the system prompt.
 *  Returns "" when no examples were retrieved — the composer will
 *  simply not include the section. */
export function serialiseGoldenExamples(entries: GoldenReply[]): string {
  if (entries.length === 0) return "";
  const blocks = entries.map((e, i) => (
    `### Example ${i + 1}\n\n` +
    `User:\n${e.input}\n\n` +
    `Nex:\n${e.reply}`
  ));
  return (
    "## Relevant Golden Replies\n\n" +
    "The examples below are human-approved gold-standard NEX replies for turns similar to the current one. Match their tone, sentence rhythm, and character shape — do not copy them verbatim. If the current turn is meaningfully different, prefer answering the actual question over mimicking the examples.\n\n" +
    blocks.join("\n\n---\n\n")
  );
}

/** Map the client-side ChatIntent (from classifyIntent.ts) to the
 *  coarser retrieval family. Social intents short-circuit before the
 *  API is called, so we never see them here in practice — the map
 *  covers them defensively. */
export function intentToFamily(intent: string): IntentFamily {
  switch (intent) {
    case "materials":          return "materials";
    case "regulation":         return "materials";   // regulation questions live in the materials/procedural family
    case "design":             return "design";
    case "terminology":        return "design";      // terminology is design-adjacent
    case "procedural":         return "diy";
    case "greeting":
    case "goodbye":
    case "thanks":
    case "availability_check":
    case "identity":
    case "frustration":        return "social";
    default:                   return "orientation";
  }
}

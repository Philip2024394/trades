// Shared types for the Golden Reply retrieval pipeline.
// See docs/nex/golden-replies.md for the source library.

export type Stage =
  | "opening"
  | "discovery"
  | "recommendation"
  | "objection"
  | "decision"
  | "closing";

// Retrieval-family taxonomy — coarser than the intent classifier.
// Maps to section letters (A-L) in golden-replies.md. See
// SECTION_INTENT in scripts/embed-golden-replies.mjs for the mapping
// used at embed time. Client-side ChatIntent maps to this via
// intentToFamily() in retrieve.ts.
export type IntentFamily =
  | "social"
  | "orientation"
  | "design"
  | "materials"
  | "price"
  | "refurbishment"
  | "photo"
  | "troubleshooting"
  | "confidence"
  | "diy"
  | "closing";

export type GoldenReply = {
  id:             string;         // e.g. "F-03"
  intent_family:  IntentFamily;
  stage:          Stage;
  input:          string;
  reply:          string;
  length:         "short" | "medium" | "long";
  keywords:       string[];       // top-frequency non-stopwords; debug + telemetry only
  embedding:      number[];       // 1536-dim vector from text-embedding-3-small
};

export type ScoredGoldenReply = {
  entry: GoldenReply;
  score: number;
};

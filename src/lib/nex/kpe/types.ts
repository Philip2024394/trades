// NEX Knowledge Processing Engine · shared types + interfaces
//
// Every type in this file is a contract. Changes to any exported interface
// require a plugin-registry major version bump because external plugins
// depend on these shapes.

// ── Core primitives ──────────────────────────────────────────────

export type StageName =
  | "intake"
  | "cleaning"
  | "normalisation"
  | "classifier"
  | "metadata"
  | "duplicate"
  | "chunking"
  | "relationships"
  | "validation"
  | "decision"
  | "ai_gateway"
  | "brain_writer";

export const ALL_STAGES: StageName[] = [
  "intake", "cleaning", "normalisation", "classifier", "metadata",
  "duplicate", "chunking", "relationships", "validation", "decision",
  "ai_gateway", "brain_writer",
];

// ── AI capabilities (Gateway routes by these, not by provider) ───

export type AICapability =
  | "extract"       // structured extraction from text
  | "classify"      // label from a fixed taxonomy
  | "summarise"
  | "rerank"
  | "embed"
  | "vision_analyse"
  | "converse";

// ── Documents + chunks ───────────────────────────────────────────

export type DocumentRecord = {
  document_id: string;
  source: string;                    // "quick-dump" · "upload" · "webhook" · ...
  title: string | null;
  content_hash: string;              // sha256 of raw content
  byte_length: number;
  ingested_at: string;
  classifier_label: string | null;
  classifier_confidence: number | null;
  target_brains: string[];           // routed to these brains by end of pipeline
};

export type ChunkRecord = {
  chunk_id: string;
  document_id: string;
  order_index: number;
  heading_path: string[];            // ["H1: Introduction", "H2: Background"]
  content: string;
  content_hash: string;
  token_estimate: number;
  context_before: string | null;
  context_after: string | null;
};

export type MetadataRecord = {
  chunk_id: string;
  authors: string[];
  dates: string[];
  versions: string[];
  urls: string[];
  references: string[];              // doc IDs cited from within the chunk
  language: string | null;
  keywords: string[];
  extracted_entities: string[];      // simple named-entity list
};

// ── Decision routing ─────────────────────────────────────────────

export type DecisionRoute =
  | { tier: "no_ai";        reason: string; store_directly: true }
  | { tier: "rule_engine";  reason: string; ruleset: string; matched_rules: string[] }
  | { tier: "local_llm";    reason: string; capability: AICapability; prompt_slice: string }
  | { tier: "frontier_llm"; reason: string; capability: AICapability; prompt_slice: string }
  | { tier: "human_review"; reason: string; escalation_priority: "P1" | "P2" | "P3" }
  | { tier: "skip";         reason: string };

export type TierEligibility = {
  tier: DecisionRoute["tier"];
  eligible: boolean;
  note: string;                        // WHY eligible or not · human-readable
};

export type DecisionRecord = {
  chunk_id: string;
  route: DecisionRoute;
  decided_at: string;
  provider_used: string | null;      // filled by AI Gateway if invoked
  latency_ms: number | null;
  cost_estimate_gbp: number | null;
  alternatives_considered: TierEligibility[];   // every tier's verdict at decision time
};

// ── Duplicate detection ──────────────────────────────────────────

export type DuplicateRecord = {
  chunk_id: string;
  matched_chunk_id: string;
  similarity: number;                // 0-1
  match_type: "exact" | "near";
  detected_at: string;
};

// ── Relationships (KG edges) ─────────────────────────────────────

export type EdgeType =
  | "references" | "supersedes" | "derived_from" | "contradicts"
  | "part_of" | "authored_by" | "about";

export type EdgeRecord = {
  edge_id: string;
  from_id: string;                   // chunk_id or document_id
  to_id: string;                     // chunk_id, document_id, url, or entity
  type: EdgeType;
  confidence: number;
  created_at: string;
};

// ── Processing run (one document = one run) ──────────────────────

export type ProcessingRun = {
  run_id: string;
  document_id: string;
  source: string;
  started_at: string;
  finished_at: string | null;
  stages_completed: StageName[];
  errors: Array<{ stage: StageName; error: string }>;
  final_outcome: "success" | "partial" | "failed";
  chunks_created: number;
  decisions_made: number;
  brain_writes: number;
};

// ── Plugin interface ─────────────────────────────────────────────

export type StageContext = {
  run_id: string;
  document_id: string;
  now: () => Date;
  logger: {
    info: (message: string, meta?: Record<string, unknown>) => void;
    warn: (message: string, meta?: Record<string, unknown>) => void;
    error: (message: string, meta?: Record<string, unknown>) => void;
  };
};

export interface PipelineStage<Input, Output> {
  name: StageName;
  version: string;
  run(input: Input, ctx: StageContext): Promise<Output>;
}

// ── Stage-specific I/O types ─────────────────────────────────────

export type IntakeInput = {
  source: string;
  title?: string | null;
  content: string;
  metadata?: Record<string, unknown>;
};
export type IntakeOutput = { document: DocumentRecord; raw_content: string };

export type CleaningInput  = { raw_content: string };
export type CleaningOutput = { cleaned_content: string; removed_bytes: number };

export type NormalisationInput  = { cleaned_content: string };
export type NormalisationOutput = { normalised_content: string };

export type ClassifierInput  = { normalised_content: string; title: string | null };
export type ClassifierOutput = { label: string; confidence: number; alternatives: Array<{ label: string; score: number }> };

export type MetadataInput  = { normalised_content: string; document: DocumentRecord };
export type MetadataOutput = { metadata: Omit<MetadataRecord, "chunk_id"> };

export type DuplicateInput  = { document: DocumentRecord; normalised_content: string };
export type DuplicateOutput = {
  document_level: DuplicateRecord | null;   // whole-doc duplicate?
  is_duplicate: boolean;
};

export type ChunkingInput  = { document: DocumentRecord; normalised_content: string };
export type ChunkingOutput = { chunks: ChunkRecord[] };

export type RelationshipsInput  = { document: DocumentRecord; chunks: ChunkRecord[]; metadata: Omit<MetadataRecord, "chunk_id"> };
export type RelationshipsOutput = { edges: EdgeRecord[] };

export type ValidationInput  = { document: DocumentRecord; chunks: ChunkRecord[]; metadata: Omit<MetadataRecord, "chunk_id"> };
export type ValidationOutput = {
  valid: boolean;
  errors: Array<{ chunk_id: string | null; message: string }>;
  chunk_confidence: Record<string, number>;
};

export type DecisionInput  = {
  document: DocumentRecord;
  chunks: ChunkRecord[];
  chunk_confidence: Record<string, number>;
  classifier: ClassifierOutput;
};
export type DecisionOutput = { decisions: DecisionRecord[] };

export type AIGatewayInput  = {
  capability: AICapability;
  prompt_slice: string;
  preferred_tier: "local_llm" | "frontier_llm";
};
export type AIGatewayOutput = {
  ok: boolean;
  provider: string;
  output: string;
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
  cost_gbp: number;
  error?: string;
};

export type BrainWriterInput = {
  document: DocumentRecord;
  chunks: ChunkRecord[];
  decisions: DecisionRecord[];
};
export type BrainWriterOutput = {
  brains_written: string[];
  memories_created: number;
};

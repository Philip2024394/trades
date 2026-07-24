// Trade Intelligence — canonical types. Every write goes through the
// helpers in ./versions, ./review, ./graph, ./teaching. Nothing
// writes to the entries table directly except those helpers.

import { z } from "zod";

// ─── Knowledge entry ─────────────────────────────────────────────

export const DifficultySchema = z.enum(["basic", "intermediate", "advanced", "expert"]);
export type Difficulty = z.infer<typeof DifficultySchema>;

/** Source tier — trust ordering. Never mix tiers in a single fact. */
export const SourceTierSchema = z.enum(["official", "industry", "educational", "community", "unverified"]);
export type SourceTier = z.infer<typeof SourceTierSchema>;

/** Kind maps to tier automatically. Callers can override. */
export const KIND_TO_TIER: Record<string, SourceTier> = {
  regulation:    "official",
  "trade-body":  "industry",
  manufacturer:  "industry",
  textbook:      "educational",
  video:         "community",
  photo:         "community",
  "expert-quote": "community",
  other:         "unverified"
};

export const SourceSchema = z.object({
  url:               z.string().url().optional(),
  title:             z.string().min(1),
  kind:              z.enum(["regulation", "manufacturer", "textbook", "video", "photo", "trade-body", "expert-quote", "other"]).default("other"),
  tier:              SourceTierSchema.optional(),                    // derived from kind if omitted
  country:           z.string().optional(),                          // "UK", "IE" etc
  date_published:    z.string().optional(),                          // "2024-04" or ISO
  last_verified:     z.string().optional(),                          // when staff last confirmed the source
  verification_note: z.string().optional()                           // "cited by name only, URL not verified"
});
export type Source = z.infer<typeof SourceSchema>;

/** Ensure every source has a tier — derive from kind when absent. */
export function withTier(source: Source): Source & { tier: SourceTier } {
  return { ...source, tier: source.tier ?? KIND_TO_TIER[source.kind] ?? "unverified" };
}

export const EvidenceSchema = z.object({
  type: z.enum(["citation", "case-study", "measurement", "photo", "diagram", "calculation"]),
  ref:  z.string().min(1)
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const KnowledgeEntryDraftSchema = z.object({
  trade:       z.string().min(1),
  topic:       z.string().min(1),
  title:       z.string().min(3).max(200),
  summary:     z.string().min(10).max(1000),
  body_md:     z.string().optional(),
  category:    z.string().optional(),
  subcategory: z.string().optional(),
  difficulty:  DifficultySchema.default("basic"),
  keywords:    z.array(z.string()).default([]),
  sources:     z.array(SourceSchema).min(1, "At least one source is required for every entry"),
  evidence:    z.array(EvidenceSchema).default([]),
  confidence:  z.number().int().min(0).max(100).default(90)
});
export type KnowledgeEntryDraft = z.infer<typeof KnowledgeEntryDraftSchema>;

export type KnowledgeEntry = KnowledgeEntryDraft & {
  id:           string;
  version:      number;
  status:       "draft" | "published" | "archived" | "superseded";
  superseded_by: string | null;
  created_at:   string;
  updated_at:   string;
};

// ─── Version row ─────────────────────────────────────────────────

export type ChangeKind = "initial" | "minor" | "major" | "correction" | "archive" | "restore";

export type KnowledgeVersion = KnowledgeEntryDraft & {
  id:               string;
  entry_id:         string;
  version:          number;
  change_kind:      ChangeKind;
  change_summary:   string | null;
  proposed_by:      string | null;
  proposed_by_kind: "staff" | "merchant" | "ai" | "seed" | "builder" | null;
  approved_by:      string;
  approved_at:      string;
  review_id:        string | null;
  created_at:       string;
};

// ─── Edge (graph) ────────────────────────────────────────────────

export const RelationshipSchema = z.enum([
  "requires", "references", "used_by", "creates", "needs",
  "similar_to", "contradicts", "refines", "supersedes", "part_of"
]);
export type Relationship = z.infer<typeof RelationshipSchema>;

export type KnowledgeEdge = {
  id:           string;
  from_entry:   string;
  to_entry:     string;
  relationship: Relationship;
  weight:       number;
  verified:     boolean;
  verified_by:  string | null;
  verified_at:  string | null;
  proposed_by:  string | null;
  created_at:   string;
};

// ─── Review queue ────────────────────────────────────────────────

export const ReviewKindSchema = z.enum(["create", "edit", "correction", "delete", "edge", "teach"]);
export type ReviewKind = z.infer<typeof ReviewKindSchema>;

export type ReviewSubmitterKind = "staff" | "merchant" | "ai" | "builder";
export type ReviewStatus        = "pending" | "approved" | "rejected" | "merged" | "archived";

export type ReviewItem = {
  id:               string;
  kind:             ReviewKind;
  target_entry_id:  string | null;
  proposed_json:    Record<string, unknown>;
  merchant_context: Record<string, unknown> | null;
  submitted_by:     string;
  submitted_by_kind: ReviewSubmitterKind;
  submitted_at:     string;
  status:           ReviewStatus;
  reviewer_id:      string | null;
  reviewed_at:      string | null;
  review_notes:     string | null;
  merged_into_id:   string | null;
  resulting_version_id: string | null;
  source_upload_id: string | null;
};

// ─── Teaching upload ─────────────────────────────────────────────

export type TeachingUpload = {
  id:                string;
  storage_bucket:    string;
  storage_path:      string;
  original_filename: string;
  mime_type:         string;
  size_bytes:        number | null;
  trade_hint:        string | null;
  topic_hint:        string | null;
  notes:             string | null;
  uploaded_by:       string;
  uploaded_by_kind:  "staff" | "merchant" | "builder";
  uploaded_at:       string;
  extraction_status: "queued" | "extracting" | "extracted" | "failed" | "skipped";
  extraction_error:  string | null;
  extracted_at:      string | null;
  extracted_entries_count: number;
};

// ─── Search hit ──────────────────────────────────────────────────

export type KnowledgeHit = {
  id:         string;
  trade:      string;
  title:      string;
  summary:    string;
  confidence: number;
  score:      number;               // combined text + vector + graph
  sources:    Source[];
  version:    number;
  reason:     "text" | "vector" | "graph";
};

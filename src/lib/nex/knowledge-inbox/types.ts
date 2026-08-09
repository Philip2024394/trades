// NEX Knowledge Inbox — shared types
//
// The inbox is the front door to the NEX Knowledge Factory. Every
// item passes through this shape from capture to processing to
// governed record.

export type InboxKind =
  | "text"       // paste / typed note
  | "file"       // any uploaded file
  | "url"        // pasted url
  | "voice"      // audio recording
  | "image";     // photo / diagram

export type InboxStatus =
  | "waiting"     // grey  — awaiting classification
  | "processing"  // blue  — in flight
  | "review"      // orange — flagged for human review
  | "processed";  // green  — merged into a record

export type KnowledgeSource =
  | "chatgpt-approved"    // trusted-curated, do NOT rewrite
  | "claude-generated"    // already golden-rule, just link
  | "raw-research"        // extract + build + FAQ + cross-ref
  | "internet-article"    // cautious, verify before promoting
  | "needs-verification"  // hold for human review
  | "gov-standards"       // high-authority reference; update affected
  | "customer-qa"         // FAQ generation + gap analysis
  | "personal-ideas";     // keep separate from industry knowledge

// Wave 11 · GROUP B remediation · runtime enum sets used by
// validateOrDrop at the pg-reads + JSON.parse boundaries. Keep these
// exhaustively synchronised with the union types above · adding a
// value to the union means adding it here too.
export const INBOX_KINDS = new Set<InboxKind>(["text", "file", "url", "voice", "image"]);
export const INBOX_STATUSES = new Set<InboxStatus>(["waiting", "processing", "review", "processed"]);
export const KNOWLEDGE_SOURCES = new Set<KnowledgeSource>([
  "chatgpt-approved", "claude-generated", "raw-research", "internet-article",
  "needs-verification", "gov-standards", "customer-qa", "personal-ideas",
]);

// The permanent record for one item in the inbox.
// This shape is what lives in data/knowledge-inbox/index.json and
// what the API returns to the client. React state on the client
// caches this — it is NOT the source of truth. Disk is.
export type InboxItem = {
  id: string;                 // NEX-generated short id, e.g. "nx_l9k2xa_a1b2"
  title: string;
  kind: InboxKind;
  status: InboxStatus;
  source: KnowledgeSource;
  createdAt: number;          // epoch ms — for chronological sort
  createdAtIso: string;       // ISO 8601 — for logs and human readability
  hash: string;               // sha256 hex; used for duplicate detection
  meta?: string;              // e.g. "PDF · 2.1 MB" · "gov.uk · fetched"
  previewText?: string;       // first ~220 chars for the queue preview
  // Storage back-refs (relative to data/knowledge-inbox/)
  contentPath?: string;       // path to full text body, e.g. "content/nx_….txt"
  filePath?: string;          // LEGACY · path to uploaded binary on local fs · retained for pre-Phase-3a items and dev backward compat
  // Phase 3a · location-transparent binary reference into NEX Object
  // Storage. Together, object_bucket + object_key are the authoritative
  // pointer any worker on any machine can use to fetch the bytes via
  // getObjectStorage().get(bucket, key). filePath remains populated
  // during the transition window for backward compat but object_*
  // is preferred wherever both are present.
  objectBucket?: string;      // e.g. "uploads"
  objectKey?: string;         // e.g. "nx_msks7ddw_90ae2b5a"
  originalFilename?: string;  // preserved for downloads
  byteSize?: number;
  mimeType?: string;
  url?: string;               // the source url, for kind === 'url'
  // Processing lineage — filled by the processing pipeline (v2)
  processedAt?: number;
  processedNotes?: string;
  // W-OBS-1 Path A Layer 1 · request-scoped correlation identifier
  // inherited from the HTTP handler's AsyncLocalStorage scope when the
  // item was captured. Downstream workers propagate this into the
  // KnowledgeJob and the resulting audit rows so the entire trace
  // (client HTTP → inbox → worker → audit) shares one ID.
  // Optional · legacy items and non-HTTP captures may lack it.
  correlation_id?: string;
};

// All-time processing totals — persist across sessions.
//
// Downstream counts (records, FAQs, edges, duplicates) are null-typed here
// because the Worker Manager is authoritative for those. See
// feedback_nex_never_pretends_work_done_2026_08_07.md.
export type InboxStats = {
  completedToday: number;
  completedTodayDate: string;               // YYYY-MM-DD — resets when day rolls over
  imagesAnalysed: number;
  voiceNotesTranscribed: number;
  lastProcessedAt?: number;

  // Downstream counts — null when we don't own the count. Rendered
  // as "Not yet available" or "See Worker Manager" in the UI.
  recordsCreated: number | null;
  recordsUpdated: number | null;
  faqsGenerated: number | null;
  edgesCreated: number | null;
  duplicatesMerged: number | null;
};

// Snapshot returned by POST /process — the same shape shown in the
// Processing Report overlay.
//
// HONESTY: Fields marked "null when unknown" used to be Math.random()
// heuristics before the pipeline was wired to real workers. Per the
// "NEX never pretends work has been done" doctrine
// (feedback_nex_never_pretends_work_done_2026_08_07.md), they are now
// set to null in the inbox layer — the authoritative numbers for records
// created, FAQs generated, edges created, and duplicates merged live
// downstream in Supabase (knowledge_records + graph_edges + worker_results).
// The Worker Manager is the source of truth for those counts.
export type ProcessingReport = {
  // Real counts from THIS process pass
  itemsProcessed: number;              // Total waiting items handled in this batch
  itemsEnqueuedForWorkers: number;     // How many worker_jobs were actually inserted into Supabase
  imagesAnalysed: number;              // Real count of image items (currently not enqueued — image_analyst disabled per doctrine)
  voiceNotesTranscribed: number;       // Real count of voice items (not enqueued yet)
  needsReview: number;                 // Real count of items flagged review

  // Downstream results — NULL because we don't produce them here.
  // The Worker Manager (/nex-app/nex-brain) is authoritative.
  recordsCreated: number | null;
  recordsUpdated: number | null;
  faqsGenerated: number | null;
  edgesCreated: number | null;
  duplicatesMerged: number | null;

  // Optional explanation shown in the Processing Overlay
  note?: string;

  // Wave 11 · F7 remediation · surface per-item enqueue failures so a
  // partial batch never looks like complete success. When present with
  // length > 0 the caller MUST treat the batch as partial · not success.
  enqueueFailed?: Array<{ id: string; reason: string }>;
};

export const EMPTY_STATS: InboxStats = {
  // Real counter — items whose status transitioned to "processed" today
  completedToday: 0,
  completedTodayDate: new Date().toISOString().slice(0, 10),

  // Same honesty rule — null when unknown. See ProcessingReport comment above.
  recordsCreated: null,
  recordsUpdated: null,
  faqsGenerated: null,
  edgesCreated: null,
  duplicatesMerged: null,
  imagesAnalysed: 0,
  voiceNotesTranscribed: 0,
};

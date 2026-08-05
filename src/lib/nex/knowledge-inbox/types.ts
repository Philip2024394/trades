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
  filePath?: string;          // path to uploaded binary, e.g. "files/nx_….pdf"
  originalFilename?: string;  // preserved for downloads
  byteSize?: number;
  mimeType?: string;
  url?: string;               // the source url, for kind === 'url'
  // Processing lineage — filled by the processing pipeline (v2)
  processedAt?: number;
  processedNotes?: string;
};

// All-time processing totals — persist across sessions.
export type InboxStats = {
  recordsCreated: number;
  recordsUpdated: number;
  faqsGenerated: number;
  edgesCreated: number;
  duplicatesMerged: number;
  imagesAnalysed: number;
  voiceNotesTranscribed: number;
  completedToday: number;
  completedTodayDate: string;  // YYYY-MM-DD — resets stat when the day rolls over
  lastProcessedAt?: number;
};

// Snapshot returned by POST /process — the same shape shown in the
// Processing Report overlay.
export type ProcessingReport = {
  itemsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  faqsGenerated: number;
  edgesCreated: number;
  duplicatesMerged: number;
  imagesAnalysed: number;
  voiceNotesTranscribed: number;
  needsReview: number;
};

export const EMPTY_STATS: InboxStats = {
  recordsCreated: 0,
  recordsUpdated: 0,
  faqsGenerated: 0,
  edgesCreated: 0,
  duplicatesMerged: 0,
  imagesAnalysed: 0,
  voiceNotesTranscribed: 0,
  completedToday: 0,
  completedTodayDate: new Date().toISOString().slice(0, 10),
};

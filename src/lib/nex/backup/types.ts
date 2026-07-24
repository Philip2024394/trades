// Nex Brain backup — canonical types.
//
// The backup format is versioned; NEX_BACKUP_FORMAT_VERSION bumps
// when the on-disk shape changes. Restore refuses to run on a format
// it can't read.

export const NEX_BACKUP_FORMAT_VERSION = "1.0.0";

export type BackupKind = "full" | "incremental" | "pre_restore_snapshot";

/** Per-table checkpoint. NEXT incremental exports rows with
 *  updated_at (or created_at where updated_at doesn't exist) > the
 *  value here. Null on first-ever backup. */
export type Checkpoint = {
  entries:  string | null;   // ISO timestamp
  versions: string | null;
  edges:    string | null;
  reviews:  string | null;
  uploads:  string | null;
  research: string | null;
};

/** What lives in metadata/backup_manifest.json inside every ZIP. */
export type BackupManifest = {
  format_version:  string;                                        // NEX_BACKUP_FORMAT_VERSION
  backup_id:       string;                                        // UUID
  kind:            BackupKind;
  base_backup_id:  string | null;                                 // set for incremental
  created_at:      string;
  created_by:      string;
  db_schema_version: string;                                      // migration filename we're on
  record_counts:   {
    entries:  number; versions: number; edges: number;
    reviews:  number; uploads:  number; research: number;
  };
  integrity: Record<string, {                                     // relative path in ZIP → checksum
    sha256:      string;
    size_bytes:  number;
  }>;
  checkpoint:      Checkpoint;
  notes?:          string;
};

export type BackupRun = {
  id:                string;
  kind:              BackupKind;
  base_backup_id:    string | null;
  status:            "running" | "complete" | "failed";
  entries_count:     number;
  versions_count:    number;
  edges_count:       number;
  reviews_count:     number;
  uploads_count:     number;
  research_count:    number;
  size_bytes:        number;
  storage_bucket:    string;
  storage_path:      string | null;
  manifest_json:     BackupManifest | null;
  checkpoint_json:   Checkpoint | null;
  error_message:     string | null;
  created_by:        string;
  created_at:        string;
  completed_at:      string | null;
};

export type RestoreAttempt = {
  id:                       string;
  source_backup_id:         string | null;
  source_manifest_json:     BackupManifest | null;
  status:                   "uploaded" | "validated" | "previewed" | "executing" | "restored" | "failed" | "rolled_back";
  validation_errors:        Array<{ file: string; error: string }> | null;
  preview_json:             RestorePreview | null;
  restored_counts_json:     RestoreCounts | null;
  pre_restore_snapshot_id:  string | null;
  error_message:            string | null;
  attempted_by:             string;
  attempted_at:             string;
  completed_at:             string | null;
};

export type RestorePreview = {
  format_version_ok: boolean;
  will_insert:       Record<string, number>;   // table → count
  will_update:       Record<string, number>;
  will_skip:         Record<string, number>;
  sample:            Record<string, unknown[]>;
};

export type RestoreCounts = Record<string, { inserted: number; updated: number; skipped: number; failed: number }>;

export const BACKUP_BUCKET = "nex-backups";

/** Ordered list of tables backed up. Order matters for restore: entries
 *  before versions/edges/reviews so FKs resolve. */
export const BACKUP_TABLES = [
  { key: "entries",  table: "hammerex_nex_knowledge_entries",  file: "knowledge_entries.json", tsCol: "updated_at" },
  { key: "versions", table: "hammerex_nex_knowledge_versions", file: "versions.json",          tsCol: "created_at" },
  { key: "edges",    table: "hammerex_nex_knowledge_edges",    file: "graph_edges.json",       tsCol: "created_at" },
  { key: "reviews",  table: "hammerex_nex_review_queue",       file: "reviews.json",           tsCol: "submitted_at" },
  { key: "uploads",  table: "hammerex_nex_teaching_uploads",   file: "teaching_uploads.json",  tsCol: "uploaded_at" },
  { key: "research", table: "hammerex_nex_research_reports",   file: "research_reports.json",  tsCol: "created_at" }
] as const;

export type BackupTableKey = typeof BACKUP_TABLES[number]["key"];

// Business Brain — shared types for crawler, extractors, sync engine,
// admin dashboard, and future phases.
//
// Every table has a matching type here so the whole system speaks one
// consistent shape from database → server code → API → UI.

export type BusinessBrainStatus = "provisioning" | "active" | "syncing" | "failed" | "paused";
export type SyncFrequency       = "manual" | "hourly" | "daily" | "weekly" | "monthly";
export type PageCategory        = "home" | "product" | "service" | "faq" | "about" | "contact" | "blog" | "policy" | "downloads" | "other";
export type VectorStatus        = "pending" | "indexed" | "failed" | "skipped";
export type DetectionMethod     = "heuristic_v1" | "llm_v1" | "manual";
export type SyncJobStatus       = "running" | "completed" | "partial" | "failed" | "cancelled";
export type SyncJobTrigger      = "manual" | "cron" | "install" | "webhook";
export type QuoteStatus         = "new" | "viewed" | "responded" | "won" | "lost" | "abandoned";
export type MediaType           = "image" | "video";
export type DocumentType        = "pdf" | "doc" | "brochure" | "price_list" | "warranty" | "certificate";

export type Business = {
  id:                 string;
  name:               string;
  primary_domain:     string;
  owner_user_id:      string | null;
  domain_verified_at: string | null;
  category_slug:      string | null;
  created_at:         string;
  updated_at:         string;
};

export type BusinessBrain = {
  id:               string;
  business_id:      string;
  status:           BusinessBrainStatus;
  sync_frequency:   SyncFrequency;
  crawl_root_url:   string | null;
  last_synced_at:   string | null;
  next_sync_due_at: string | null;
  pages_indexed:    number;
  config_json:      Record<string, unknown>;
  created_at:       string;
  updated_at:       string;
};

export type BrainPage = {
  id:              string;
  business_id:     string;
  brain_id:        string;
  url:             string;
  title:           string | null;
  description:     string | null;
  category:        PageCategory | null;
  content_hash:    string;
  raw_html:        string | null;
  clean_text:      string;
  word_count:      number;
  outlinks:        string[];
  media_count:     number;
  pdf_count:       number;
  vector_status:   VectorStatus;
  last_crawled_at: string;
  created_at:      string;
  updated_at:      string;
};

export type BrainProduct = {
  id:               string;
  business_id:      string;
  brain_id:         string;
  source_page_id:   string | null;
  slug:             string;
  name:             string;
  category:         string | null;
  materials:        string[];
  options:          string[];
  price_from_pence: number | null;
  price_display:    string | null;
  lead_time_text:   string | null;
  description:      string | null;
  detection_method: DetectionMethod;
  confidence_pct:   number;
  last_seen_at:     string;
  created_at:       string;
  updated_at:       string;
};

export type BrainService = {
  id:               string;
  business_id:      string;
  brain_id:         string;
  source_page_id:   string | null;
  slug:             string;
  name:             string;
  description:      string | null;
  detection_method: DetectionMethod;
  confidence_pct:   number;
  last_seen_at:     string;
  created_at:       string;
  updated_at:       string;
};

export type BrainFaq = {
  id:               string;
  business_id:      string;
  brain_id:         string;
  source_page_id:   string | null;
  question_hash:    string;
  question:         string;
  answer:           string;
  detection_method: DetectionMethod;
  confidence_pct:   number;
  last_seen_at:     string;
  created_at:       string;
  updated_at:       string;
};

export type BrainMedia = {
  id:             string;
  business_id:    string;
  brain_id:       string;
  source_page_id: string | null;
  media_type:     MediaType;
  url:            string;
  alt_text:       string | null;
  caption:        string | null;
  width_px:       number | null;
  height_px:      number | null;
  file_hash:      string | null;
  created_at:     string;
};

export type BrainDocument = {
  id:             string;
  business_id:    string;
  brain_id:       string;
  source_page_id: string | null;
  document_type:  DocumentType;
  url:            string;
  file_hash:      string;
  filename:       string | null;
  extracted_text: string | null;
  page_count:     number | null;
  indexed_at:     string | null;
  created_at:     string;
};

export type BrainSyncJob = {
  id:              string;
  business_id:     string;
  brain_id:        string;
  triggered_by:    SyncJobTrigger;
  status:          SyncJobStatus;
  started_at:      string;
  finished_at:     string | null;
  duration_ms:     number | null;
  pages_crawled:   number;
  pages_added:     number;
  pages_changed:   number;
  pages_unchanged: number;
  products_found:  number;
  services_found:  number;
  faqs_found:      number;
  errors:          Array<{ url: string; error: string }>;
};

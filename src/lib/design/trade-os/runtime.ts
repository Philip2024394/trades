// Trade OS Runtime — canonical TypeScript interfaces per V1 Part 1
// of the architecture spec (docs/TRADE_OS_SPEC/V1_PART_1_CORE_ARCHITECTURE.md).
//
// This file is the AUTHORITATIVE shape. Every service in the platform
// implements one of these interfaces or consumes them. Adding a new
// method or field requires a spec update, not an ad-hoc change.

import type { BrandRecord } from "@/lib/design/brand/schema";
import type { Sds } from "@/lib/design/sds/schema";

// ─── Core runtime ──────────────────────────────────────────────

export interface TradeOSRuntime {
  merchant:            MerchantService;
  brand:               BrandService;
  discovery:           DiscoveryService;
  memory:              MemoryService;
  promptCompiler:      PromptCompiler;
  orchestrator:        AIOrchestrator;
  eventBus:            EventBus;
  assetStore:          AssetStore;
  versionStore:        VersionStore;
  exportService:       ExportService;
  capabilityRegistry:  CapabilityRegistry;
}

// ─── Brand service (the source of truth) ───────────────────────

export type BrandVersion = {
  id:            string;
  brand_id:      string;
  version:       number;
  brand_json:    BrandRecord;
  fingerprint:   string;
  created_at:    string;
  published_at:  string | null;
};

export type BrandChange = {
  brand_id:  string;
  patch:     Partial<BrandRecord>;
  actor:     string;
  reason:    string;
};

export type ValidationResult = {
  ok:      boolean;
  errors:  Array<{ path: string; message: string }>;
};

export interface BrandService {
  getBrand(id: string):                         Promise<BrandRecord | null>;
  getVersion(id: string, version: number):      Promise<BrandVersion | null>;
  listVersions(id: string):                     Promise<BrandVersion[]>;
  updateBrand(change: BrandChange):             Promise<BrandVersion>;
  publish(brandId: string, version: number):    Promise<void>;
  rollback(brandId: string, toVersion: number): Promise<BrandVersion>;
  validate(brand: BrandRecord):                 ValidationResult;
}

// ─── Merchant service (business info, no branding) ─────────────

export type MerchantRow = {
  id:                string;
  kind:              "merchant" | "homeowner";
  display_name:      string;
  primary_trade?:    string;
  city?:             string;
  postcode?:         string;
  subscription_tier: string;
};

export interface MerchantService {
  get(id: string):                    Promise<MerchantRow | null>;
  update(id: string, patch: Partial<MerchantRow>): Promise<MerchantRow>;
}

// ─── Discovery service (Agent 1 output) ────────────────────────

export type DiscoveryOutput = {
  merchant_id:  string;
  answers:      Record<string, string>;    // 7-question outputs
  inferred:     Record<string, unknown>;   // from Companies House / GBP / website scrape
  fingerprint:  string;
};

export interface DiscoveryService {
  ask(merchantId: string):                       Promise<DiscoveryOutput>;
  inferFromCompaniesHouse(companyName: string):  Promise<Partial<DiscoveryOutput>>;
  scrapeWebsite(url: string):                    Promise<Partial<DiscoveryOutput>>;
}

// ─── Memory service (episodic + semantic + preference) ─────────

export type MemoryEntry = {
  id:           string;
  brand_id:     string;
  kind:         "episodic" | "semantic" | "preference" | "rejection";
  content:      Record<string, unknown>;
  confidence:   number;                     // 0-1
  created_at:   string;
};

export interface MemoryService {
  add(entry: Omit<MemoryEntry, "id" | "created_at">):  Promise<MemoryEntry>;
  retrieve(brandId: string, query: string, limit?: number): Promise<MemoryEntry[]>;
  learn(brandId: string, feedback: { concept: string; accepted: boolean; reason?: string }): Promise<void>;
}

// ─── Prompt compiler (deterministic, not AI) ───────────────────

export type CompilationInput = {
  sds:            Sds;
  brand:          BrandRecord;
  memory:         MemoryEntry[];
  targetModel:    "gpt-image-1" | "gpt-5" | "claude-opus-4-7";
};

export type CompiledPrompt = {
  prompt:        string;
  model:         string;
  intermediate:  Record<string, unknown>;   // IR for debugging
  version:       string;                    // compiler version
  cache_key:     string;
};

export interface PromptCompiler {
  compile(input: CompilationInput): CompiledPrompt;
  version(): string;
}

// ─── AI Orchestrator ───────────────────────────────────────────

export type GenerationRequest = {
  capability_slug: string;
  brand_id:        string;
  sds:             Sds;
  user_prompt?:    string;
  parent_asset_id?: string;     // for refinements
};

export type GenerationResult = {
  asset_id:         string;
  prompt_used:      CompiledPrompt;
  image_urls:       string[];
  quality_score?:   number;
  latency_ms:       number;
  cost_pence:       number;
};

export interface AIOrchestrator {
  generate(request: GenerationRequest):   Promise<GenerationResult>;
  regenerate(assetId: string):            Promise<GenerationResult>;
  critique(assetId: string):              Promise<{ score: number; feedback: string }>;
  approve(assetId: string):               Promise<void>;
}

// ─── Event bus (loose coupling) ────────────────────────────────

export type PlatformEvent =
  | { type: "BrandUpdated"; brand_id: string; version: number; changed_fields: string[] }
  | { type: "AssetGenerated"; asset_id: string; brand_id: string; capability_slug: string }
  | { type: "AssetApproved"; asset_id: string; approved_by: string }
  | { type: "AssetRejected"; asset_id: string; rejected_by: string; reason: string }
  | { type: "BrandPublished"; brand_id: string; version: number };

export type EventSubscriber<T extends PlatformEvent = PlatformEvent> = (event: T) => Promise<void>;

export interface EventBus {
  publish(event: PlatformEvent): Promise<void>;
  subscribe<T extends PlatformEvent["type"]>(type: T, handler: EventSubscriber<Extract<PlatformEvent, { type: T }>>): void;
  unsubscribe(type: PlatformEvent["type"], handler: EventSubscriber): void;
}

// ─── Asset store ───────────────────────────────────────────────

export type AssetRow = {
  id:               string;
  brand_id:         string;
  brand_version:    number;                 // version of Brand DNA in effect
  capability_slug:  string;
  kind:             "png" | "svg" | "pdf" | "psd" | "docx" | "zip";
  url:              string;                 // Supabase Storage URL
  created_at:       string;
  approved_at:      string | null;
};

export interface AssetStore {
  put(asset: Omit<AssetRow, "id" | "created_at">): Promise<AssetRow>;
  get(id: string):                                 Promise<AssetRow | null>;
  listByBrand(brandId: string):                    Promise<AssetRow[]>;
  delete(id: string):                              Promise<void>;
}

// ─── Version store (Git for branding) ──────────────────────────

export interface VersionStore {
  snapshot(brandId: string):                       Promise<{ version: number; snapshot_id: string }>;
  getSnapshot(snapshotId: string):                 Promise<BrandVersion | null>;
  activeVersion(brandId: string):                  Promise<number>;
  setActive(brandId: string, version: number):     Promise<void>;
}

// ─── Export service ────────────────────────────────────────────

export type ExportKind = "zip-all" | "printer-pack" | "designer-pack" | "share-link";
export type ExportRequest = {
  brand_id:  string;
  kind:      ExportKind;
  asset_ids?: string[];
};

export interface ExportService {
  create(req: ExportRequest): Promise<{ url: string; expires_at: string }>;
}

// ─── Capability registry (Studio Apps) ─────────────────────────

export type CapabilityManifest = {
  slug:                    string;                // e.g. "vehicle.van-wrap"
  name:                    string;
  version:                 string;
  category:                string;
  description:             string;
  dependencies:            string[];              // other capability slugs
  brand_fields_used:       string[];              // paths into BrandRecord
  outputs:                 string[];              // asset kinds this produces
  permissions:             string[];
  generator:               string;                // fn reference
  event_subscriptions:     PlatformEvent["type"][];
  storage_pattern:         string;
  exports:                 string[];
  pricing_washers:         number;
  ai_models:               string[];
  estimated_cost_gbp:      number;
  estimated_time_seconds:  number;
  qa_rules:                string[];
};

export interface CapabilityRegistry {
  install(manifest: CapabilityManifest):   Promise<void>;
  uninstall(slug: string):                 Promise<void>;
  get(slug: string):                       CapabilityManifest | null;
  list():                                  CapabilityManifest[];
  execute(request: GenerationRequest):     Promise<GenerationResult>;
}

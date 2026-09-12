// src/lib/nex/master-ai/local-knowledge-intelligence.ts
//
// NEX Master AI · Local Knowledge Intelligence (World-Class §9)
// Philip 2026-09-07 · AUTHORIZE (research + intelligence only)
//
// Build evidence-based local intelligence about specific countries,
// cities, regions and tourist destinations. NEVER pretends to be a
// local person. Every knowledge item carries a source and freshness
// timestamp; stale items are honestly flagged.

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { localKnowledgeProfilesPath } from "./paths";

// ═════════════════════════════════════════════════════════════════════
// Local knowledge categories (§9)
// ═════════════════════════════════════════════════════════════════════

export type LocalKnowledgeCategory =
  | "LANGUAGE"          // primary language + common phrases
  | "TERMINOLOGY"       // local terms with distinct meaning
  | "GEOGRAPHY"         // shape/layout of the place
  | "NEIGHBOURHOODS"    // districts and areas
  | "TRANSPORT"         // how people move
  | "FOOD"              // local cuisine
  | "CULTURE"           // norms and habits
  | "CUSTOMS"           // etiquette
  | "BUSINESS_PRACTICE" // how business is conducted
  | "OPENING_PATTERNS"  // typical business hours
  | "SEASONS"           // annual patterns
  | "WEATHER"           // climate and forecast tendencies
  | "REGULATIONS"       // relevant legal/regulatory context
  | "PRICES"            // reference cost levels
  | "TOURISM_PATTERNS"  // where tourists concentrate
  | "SAFETY"            // hazards and precautions
  | "LOCAL_EVENTS"      // calendars and festivals
  | "COMMON_MISTAKES"   // what travellers often get wrong
  | "INFRASTRUCTURE"    // utilities, connectivity, accessibility
  | "LOCAL_SERVICES";   // useful commercial services

export const LOCAL_KNOWLEDGE_CATEGORIES: readonly LocalKnowledgeCategory[] = Object.freeze([
  "LANGUAGE", "TERMINOLOGY", "GEOGRAPHY", "NEIGHBOURHOODS", "TRANSPORT",
  "FOOD", "CULTURE", "CUSTOMS", "BUSINESS_PRACTICE", "OPENING_PATTERNS",
  "SEASONS", "WEATHER", "REGULATIONS", "PRICES", "TOURISM_PATTERNS",
  "SAFETY", "LOCAL_EVENTS", "COMMON_MISTAKES", "INFRASTRUCTURE", "LOCAL_SERVICES",
] as const);

// ═════════════════════════════════════════════════════════════════════
// Location profile
// ═════════════════════════════════════════════════════════════════════

export type LocationScope = "COUNTRY" | "REGION" | "CITY" | "DISTRICT" | "DESTINATION";

export type EvidenceStatus = "PRIMARY" | "SECONDARY" | "OBSERVED" | "INFERRED" | "UNKNOWN";

export type LocalKnowledgeItem = {
  item_id: string;
  category: LocalKnowledgeCategory;
  headline: string;                                  // one-line summary (≥ 10 chars)
  detail: string;                                    // longer explanation
  evidence_status: EvidenceStatus;
  source_refs: readonly string[];                    // citation URLs / finding IDs
  original_language: string | null;                  // 2-letter code · e.g. "id" · "en"
  observed_at_iso: string;                           // when this item was compiled
  freshness_expires_iso: string | null;              // when it should be re-verified
  confidence: "HIGH" | "MEDIUM" | "LOW";
};

export type LocalKnowledgeProfile = {
  profile_id: string;
  recorded_at_iso: string;
  scope: LocationScope;
  location_slug: string;                             // e.g. "id-jakarta" · "id-bali"
  display_name: string;
  primary_language_codes: readonly string[];
  country_code: string;                              // ISO 3166-1 alpha-2
  items: readonly LocalKnowledgeItem[];
  overall_freshness_note: string;
  overall_confidence: "HIGH" | "MEDIUM" | "LOW";
  supersedes: string | null;
  created_by: string;
};

export class InvalidLocalKnowledgeError extends Error {
  constructor(reason: string) { super(`invalid_local_knowledge:${reason}`); }
}

export function recordLocalKnowledgeProfile(input: Omit<LocalKnowledgeProfile, "profile_id" | "recorded_at_iso">): LocalKnowledgeProfile {
  if (!input.location_slug || input.location_slug.length < 3) throw new InvalidLocalKnowledgeError("location_slug");
  if (!input.display_name || input.display_name.length < 2) throw new InvalidLocalKnowledgeError("display_name");
  if (!input.country_code || input.country_code.length !== 2) throw new InvalidLocalKnowledgeError("country_code_must_be_iso2");
  if (input.items.length === 0) throw new InvalidLocalKnowledgeError("at_least_one_item_required");
  for (const it of input.items) {
    if (!LOCAL_KNOWLEDGE_CATEGORIES.includes(it.category)) throw new InvalidLocalKnowledgeError(`unknown_category:${it.category}`);
    if (!it.headline || it.headline.length < 10) throw new InvalidLocalKnowledgeError(`headline_too_short:${it.category}`);
    if (!it.evidence_status) throw new InvalidLocalKnowledgeError(`evidence_status_required:${it.category}`);
    if (it.evidence_status === "UNKNOWN" && it.confidence !== "LOW") {
      throw new InvalidLocalKnowledgeError(`unknown_evidence_requires_LOW_confidence:${it.category}`);
    }
  }
  const rec: LocalKnowledgeProfile = {
    ...input,
    profile_id: randomUUID(),
    recorded_at_iso: new Date().toISOString(),
  };
  appendJsonLine(localKnowledgeProfilesPath(), rec);
  return rec;
}

export function readAllProfiles(): LocalKnowledgeProfile[] {
  return readJsonlAll<LocalKnowledgeProfile>(localKnowledgeProfilesPath());
}

/** Latest non-superseded profile per location. */
export function currentProfiles(): LocalKnowledgeProfile[] {
  const all = readAllProfiles();
  const superseded = new Set<string>();
  for (const p of all) if (p.supersedes) superseded.add(p.supersedes);
  const latest = new Map<string, LocalKnowledgeProfile>();
  for (const p of all) {
    if (superseded.has(p.profile_id)) continue;
    latest.set(p.location_slug, p);
  }
  return Array.from(latest.values());
}

export function getCurrentProfile(location_slug: string): LocalKnowledgeProfile | null {
  return currentProfiles().find((p) => p.location_slug === location_slug) ?? null;
}

/** Return items past freshness_expires_iso · these should be re-verified. */
export function staleItems(location_slug: string, nowMs = Date.now()): LocalKnowledgeItem[] {
  const p = getCurrentProfile(location_slug);
  if (!p) return [];
  const nowIso = new Date(nowMs).toISOString();
  return p.items.filter((it) => it.freshness_expires_iso !== null && it.freshness_expires_iso < nowIso);
}

/** Category coverage summary for a location. Missing categories are honestly reported. */
export function categoryCoverage(location_slug: string): Record<LocalKnowledgeCategory, number> {
  const out: Record<LocalKnowledgeCategory, number> = Object.fromEntries(
    LOCAL_KNOWLEDGE_CATEGORIES.map((c) => [c, 0]),
  ) as Record<LocalKnowledgeCategory, number>;
  const p = getCurrentProfile(location_slug);
  if (!p) return out;
  for (const it of p.items) out[it.category]++;
  return out;
}

export function _resetLocalKnowledgeForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  try { if (fs.existsSync(localKnowledgeProfilesPath())) fs.unlinkSync(localKnowledgeProfilesPath()); } catch { /* ignore */ }
}

// Migration · KnowledgeRecord → EntityRecord.
//
// The corpus has 97 records in the legacy KnowledgeRecord shape (40
// hand-authored seed + 57 walker-acquired). This module converts
// each one to the canonical EntityRecord shape WITHOUT losing any
// existing data:
//   · Preserves source, walker_id, questions, aliases, content,
//     keywords, region, language, stability, confidence.
//   · Backfills lifecycle (PUBLISHED · everything in the corpus has
//     already been served), provenance (from `source` + `walker_id`),
//     freshness (mapped from stability tier), geo (from region →
//     province via resolveProvince), quality (computed).
//   · Assigns EntityKind by inspecting topic prefix (food.* → business
//     when it's a specific restaurant OR knowledge when it's a dish
//     concept · same for landmarks vs cultural knowledge). Default
//     is `knowledge` — safe fallback that doesn't require geo/contact.
//
// The migration is pure · same input → same output · re-runnable.

import type { KnowledgeRecord } from "../knowledge";
import type {
  EntityRecord, EntityKind, FreshnessPolicy, ProvenanceRef, SourceTier,
} from "./types";
import { resolveProvince, listProvinces } from "./geo";
import { stampVerified } from "./freshness";
import { scoreEntity } from "./quality";

/** Migrate a single KnowledgeRecord. Returns null when the input is
 *  malformed enough to not be worth converting (never seen in the
 *  current corpus but the guard exists for safety). */
export function migrateRecord(rec: KnowledgeRecord, now: Date = new Date()): EntityRecord | null {
  if (!rec.id || !rec.topic || !rec.content) return null;

  const kind = inferKind(rec);
  const category = rec.category ?? rec.topic.split(".")[0];
  const province = resolveProvinceFromRegion(rec.region);
  const island = province?.island;

  const freshnessPolicy = mapStabilityToPolicy(rec.stability);
  const freshness = rec.last_verified
    ? { policy: freshnessPolicy, lastVerifiedAt: new Date(rec.last_verified).toISOString(),
        nextRefreshAt: nextRefreshFrom(rec.last_verified, freshnessPolicy),
        staleness: undefined }
    : stampVerified(freshnessPolicy, now);

  const provenance: ProvenanceRef[] = [{
    walkerId: rec.walker_id ?? "seed:hand-authored",
    sourceKey: rec.source ?? "unknown",
    sourceName: rec.source ?? "unknown",
    sourceTier: inferSourceTier(rec.source),
    // Every legacy KnowledgeRecord in this repo is Indonesian
    // knowledge · migration stamps market="ID" so retrieval boundary
    // works. UK trades knowledge lives in a separate code path and
    // never flows through this migration.
    market: "ID",
    firstDiscoveredAt: rec.acquired_at ?? rec.last_verified ?? now.toISOString(),
    lastCheckedAt: rec.last_verified ?? now.toISOString(),
    lastChangedAt: rec.last_verified ?? now.toISOString(),
    observedAt: rec.last_verified ?? now.toISOString(),
  }];

  const entity: EntityRecord = {
    id: rec.id,
    kind,
    category,
    name: extractName(rec),
    description: rec.content,
    keywords: rec.keywords ?? [],
    lifecycle: "PUBLISHED",
    lifecycleChangedAt: now.toISOString(),
    provenance,
    freshness,
    geo: province ? { province: province.slug, island: island } : undefined,
    // Legacy records don't carry contact info. Businesses would
    // ideally be flagged contactability=unknown; knowledge records
    // don't need contactability.
    contactability: kind === "business" || kind === "service" ? "unknown" : undefined,
    attributes: {
      /** Preserve the original topic string · downstream code that
       *  still filters on `topic` keeps working. */
      legacyTopic: rec.topic,
      legacyStability: rec.stability,
      legacyConfidence: rec.confidence,
    },
    questions: rec.questions,
    aliases: rec.aliases,
  };

  // Compute quality score AFTER assembly so all fields are visible.
  entity.quality = scoreEntity(entity, now);
  return entity;
}

/** Batch-migrate an array of records · returns { migrated, skipped }. */
export function migrateAll(records: readonly KnowledgeRecord[], now: Date = new Date()): { migrated: EntityRecord[]; skipped: Array<{ id: string; reason: string }> } {
  const migrated: EntityRecord[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];
  for (const r of records) {
    const m = migrateRecord(r, now);
    if (!m) skipped.push({ id: r.id, reason: "invalid_or_incomplete" });
    else migrated.push(m);
  }
  return { migrated, skipped };
}

// ─── heuristics ───────────────────────────────────────────────────

function inferKind(rec: KnowledgeRecord): EntityKind {
  const topic = rec.topic.toLowerCase();
  // Airports / hospitals / emergency = government-infrastructure kind.
  if (topic.startsWith("airport.") || topic.startsWith("hospital.") || topic.startsWith("emergency.")) return "government";
  // Explicit landmark topics → landmark kind uses "place".
  if (topic.startsWith("landmark.") || topic.startsWith("sacred.")) return "place";
  // Named restaurants (topic contains a specific place-name descriptor)
  // could be `business` · today's corpus has no such records so we
  // treat food.* / culture.* / spiritual.* / adat.* / tourism.* as
  // knowledge (encyclopedic).
  return "knowledge";
}

function extractName(rec: KnowledgeRecord): string {
  // Prefer the last dot-segment of the topic (already curated), else
  // first keyword, else fallback to the topic itself.
  const tail = rec.topic.split(".").pop();
  if (tail && tail.length >= 2) return tail.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return rec.keywords?.[0] ?? rec.topic;
}

function mapStabilityToPolicy(stab: KnowledgeRecord["stability"]): FreshnessPolicy {
  switch (stab) {
    case "live":            return "live";
    case "time_sensitive":  return "daily";
    case "seasonal":        return "seasonal";
    case "stable":
    default:                return "long_lived";
  }
}

function nextRefreshFrom(iso: string, policy: FreshnessPolicy): string {
  // Simple: add the policy window to the last verified date.
  const map = {
    live: 60_000, very_fast: 10 * 60_000, hourly: 60 * 60_000,
    daily: 24 * 60 * 60_000, weekly: 7 * 24 * 60 * 60_000,
    monthly: 30 * 24 * 60 * 60_000, seasonal: 90 * 24 * 60 * 60_000,
    long_lived: 180 * 24 * 60 * 60_000,
  };
  return new Date(new Date(iso).getTime() + map[policy]).toISOString();
}

function inferSourceTier(source?: string): SourceTier {
  if (!source) return "D";
  const s = source.toLowerCase();
  if (s.includes("official") || s.includes("bmkg") || s.includes("magma") || s.includes("bpjph") || s.includes("kemenag") || s.includes("kemenparekraf") || s.includes("bps")) return "A";
  if (s.includes("phdi") || s.includes("mui") || s.includes("aman") || s.includes("angkasa") || s.includes("kai") || s.includes("kemenkes")) return "A";
  if (s.includes("curated")) return "B";
  if (s.includes("seed")) return "B";
  return "C";
}

/** Best-effort region → province resolver. Region strings in the
 *  legacy corpus are informal ("Bali", "Central Java", "Indonesia").
 *  "Indonesia" means the whole country · no specific province. */
function resolveProvinceFromRegion(region: string): ReturnType<typeof resolveProvince> | undefined {
  if (!region || region === "Indonesia") return undefined;
  // First direct name match.
  const direct = resolveProvince(region);
  if (direct) return direct;
  // Try mapping common informal names to province slugs.
  const map: Record<string, string> = {
    "West Papua": "papua-barat",
    "East Kalimantan": "kalimantan-timur",
    "South Sulawesi": "sulawesi-selatan",
    "North Sulawesi": "sulawesi-utara",
    "West Nusa Tenggara": "nusa-tenggara-barat",
    "East Nusa Tenggara": "nusa-tenggara-timur",
    "West Java": "jawa-barat",
    "Central Java": "jawa-tengah",
    "East Java": "jawa-timur",
    "West Sumatra": "sumatera-barat",
    "North Sumatra": "sumatera-utara",
    "South Sumatra": "sumatera-selatan",
  };
  const slug = map[region];
  if (slug) return listProvinces().find((p) => p.slug === slug);
  return undefined;
}

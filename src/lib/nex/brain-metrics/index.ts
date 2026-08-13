// src/lib/nex/brain-metrics/index.ts
//
// NEX Brain Vitals · the four permanent metrics Philip locked 2026-08-14.
//
//   NEX BRAIN SIZE           · 0-100 · how much raw material has been collected
//   NEX BRAIN ENRICHMENT     · 0-100 · how much has been processed / enriched / routable
//   ACTIVE BRAINS            · N major / M future domains
//   TOTAL KNOWLEDGE ASSETS   · images + knowledge files + trade/company records
//
// Doctrine: project_nex_brain_vitals_2026_08_14.md
// Companion: project_nex_record_state_model_2026_08_14.md · project_nex_image_domain_rule_2026_08_14.md
//
// Formulas are transparent · defined here · computed from live observed data.
// Never fabricates. Missing counts return 0, never estimated.
//
// The GOAL is NOT "get to 100/100". The goal is:
//   Grow Size → Enrich → Validate → Activate new Brains.

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { supabaseNexAdmin } from "@/lib/supabaseNexAdmin";

// ─── Formulas (transparent · locked) ────────────────────────────────
//
// SIZE = min(100, base + diversity)
//   base            = (images + knowledge_files × 4 + trade_records × 3) / 43
//   diversity       = unique_populated_domains × 1.2
//
// ENRICHMENT = weighted average of three record-type enrichment ratios
//   image_enrichment_pct   = (enriched_images + routable_images) / total_images × 100
//   seed_enrichment_pct    = (enriched + verified + routable seeds) / total_seeds × 100
//   knowledge_enrichment_pct = 100   (existence of authored knowledge = processed)
//   ENRICHMENT = image_pct × 0.30 + seed_pct × 0.30 + knowledge_pct × 0.40
//
// ACTIVE BRAINS:
//   MAJOR   = brains with ≥ 100 classified images  (currently: staircase_brain)
//   FUTURE  = brains with 1-99 classified images   (currently: kitchen · garden · timber)
//   Cross-cutting brains (marketing_design_brain) are surfaced separately · not counted
//   in the knowledge-brain totals.

const SIZE_DIVISOR = 43;
const KNOWLEDGE_FILE_WEIGHT = 4;
const TRADE_RECORD_WEIGHT = 3;
const DOMAIN_DIVERSITY_MULTIPLIER = 1.2;
const MAJOR_BRAIN_THRESHOLD = 100;
const CROSS_CUTTING_BRAINS = new Set<string>(["marketing_design_brain"]);

/** NEX BASELINE · LOCKED 2026-08-14 (Philip confirmed).
 *  All future vitals values are shown alongside these numbers as deltas.
 *  Never rewrite this baseline. Add new baselines by amendment memory. */
export const NEX_BASELINE_2026_08_14 = {
  locked_at: "2026-08-14",
  size: 82,
  enrichment: 82,
  active_brains: { major: 1, future: 3, cross_cutting: 1 },
  total_knowledge_assets: { images: 1285, knowledge_files: 270, trade_records: 302, total: 1857 },
  first_mature_brain: "staircase_brain",
  foundation_brains_for_next_activation: ["kitchen_brain", "garden_staircase_brain", "timber_brain"],
  reference_memory: "project_nex_brain_vitals_2026_08_14.md",
} as const;

export type BrainVitals = {
  size: {
    score: number;                         // 0-100
    base: number;                          // raw asset weight before diversity bonus
    diversity_bonus: number;               // domain-diversity contribution
    unique_populated_domains: number;
    formula: string;
  };
  enrichment: {
    score: number;                         // 0-100
    image_pct: number;
    seed_pct: number;
    knowledge_pct: number;
    formula: string;
  };
  active_brains: {
    major: string[];                       // brains with ≥ MAJOR_BRAIN_THRESHOLD rows
    future: string[];                      // brains with 1..MAJOR_BRAIN_THRESHOLD-1 rows
    cross_cutting: string[];               // marketing_design_brain etc.
    by_brain_counts: Record<string, number>;
    summary: string;                       // e.g. "1 major / 3 future domains"
  };
  total_knowledge_assets: {
    images: number;
    knowledge_files: number;
    trade_records: number;
    total: number;
    label: string;                         // "1,285 images + 270 knowledge files + 302 trade/company records"
  };
  goal_ladder: string;                     // permanent reminder string
  observed_at: string;                     // ISO timestamp
};

// ─── individual measurements ────────────────────────────────────────

/** Manifest is a large JSON on disk. Read once · never mutated here. */
async function readManifest(): Promise<{ images: Record<string, Record<string, unknown>> }> {
  const p = path.join(process.cwd(), "data", "nex-image-manifest.json");
  const raw = await fs.readFile(p, "utf8");
  return JSON.parse(raw);
}

async function countKnowledgeFiles(): Promise<number> {
  // data/nex-reference-brains/**/*.md · walk once, count files
  const root = path.join(process.cwd(), "data", "nex-reference-brains");
  let n = 0;
  async function walk(dir: string) {
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.isFile() && p.endsWith(".md")) n += 1;
    }
  }
  await walk(root);
  return n;
}

function imageRecordState(m: Record<string, unknown>): "raw" | "processed" | "enriched" | "routable" {
  const hasBasic = !!(m.subject_domain || m.image_type || (m as { image_purpose?: unknown }).image_purpose);
  const hasBrain = !!m.primary_brain;
  const tags = m.tags;
  const hasTags = Array.isArray(tags) && tags.length > 0;
  const dna = m.image_dna as { score?: number } | undefined;
  const hasDna = (dna?.score ?? 0) > 0;
  if (!hasBasic) return "raw";
  if (!hasBrain) return "processed";
  if (!hasTags && !hasDna) return "enriched";
  return "routable";
}

function seedRecordState(s: {
  business_name?: string | null;
  category?: string | null;
  capabilities?: Record<string, unknown> | null;
  refacing_qualification?: string | null;
  verified?: boolean | null;
  directory_state?: string | null;
}): "raw" | "processed" | "enriched" | "verified" | "routable" {
  if (!s.business_name || !s.category) return "raw";
  const capsCount = s.capabilities && typeof s.capabilities === "object" ? Object.keys(s.capabilities).length : 0;
  if (s.directory_state === "paid_member") return "routable";
  if (s.verified) return "verified";
  if (capsCount > 0 || s.refacing_qualification) return "enriched";
  return "processed";
}

// ─── main compute ────────────────────────────────────────────────────

export async function computeBrainVitals(): Promise<BrainVitals> {
  const [manifest, knowledgeFiles, seedsRes] = await Promise.all([
    readManifest().catch(() => ({ images: {} })),
    countKnowledgeFiles().catch(() => 0),
    supabaseNexAdmin
      .from("directory_seeds")
      .select("id, business_name, category, capabilities, refacing_qualification, verified, directory_state"),
  ]);

  const seeds = (seedsRes.data ?? []) as Array<{
    id: string;
    business_name: string | null;
    category: string | null;
    capabilities: Record<string, unknown> | null;
    refacing_qualification: string | null;
    verified: boolean | null;
    directory_state: string | null;
  }>;

  const imageEntries = Object.entries(manifest.images ?? {});
  const totalImages = imageEntries.length;
  const totalSeeds = seeds.length;

  // ── image state counts + domain + brain counts ──
  const imageStates = { raw: 0, processed: 0, enriched: 0, routable: 0 };
  const brainCounts: Record<string, number> = {};
  const domainCounts: Record<string, number> = {};
  for (const [, m] of imageEntries) {
    imageStates[imageRecordState(m)] += 1;
    const b = (m.primary_brain as string | null | undefined) ?? "(null)";
    brainCounts[b] = (brainCounts[b] ?? 0) + 1;
    const d = (m.primary_domain as string | null | undefined) ?? "(null)";
    domainCounts[d] = (domainCounts[d] ?? 0) + 1;
  }

  // ── seed state counts ──
  const seedStates = { raw: 0, processed: 0, enriched: 0, verified: 0, routable: 0 };
  for (const s of seeds) seedStates[seedRecordState(s)] += 1;

  // ── SIZE ──
  const base = (totalImages + knowledgeFiles * KNOWLEDGE_FILE_WEIGHT + totalSeeds * TRADE_RECORD_WEIGHT) / SIZE_DIVISOR;
  const populatedDomains = Object.entries(domainCounts).filter(([k, n]) => k !== "(null)" && n > 0).length;
  const diversityBonus = populatedDomains * DOMAIN_DIVERSITY_MULTIPLIER;
  const sizeScore = Math.min(100, base + diversityBonus);

  // ── ENRICHMENT ──
  const imageEnrichedOrRoutable = imageStates.enriched + imageStates.routable;
  const seedEnrichedOrHigher = seedStates.enriched + seedStates.verified + seedStates.routable;
  const imagePct = totalImages > 0 ? (imageEnrichedOrRoutable / totalImages) * 100 : 0;
  const seedPct = totalSeeds > 0 ? (seedEnrichedOrHigher / totalSeeds) * 100 : 0;
  const knowledgePct = knowledgeFiles > 0 ? 100 : 0;
  const enrichmentScore = imagePct * 0.30 + seedPct * 0.30 + knowledgePct * 0.40;

  // ── ACTIVE BRAINS ──
  const knowledgeBrains = Object.entries(brainCounts).filter(([k, n]) => k !== "(null)" && !CROSS_CUTTING_BRAINS.has(k) && n > 0);
  const major = knowledgeBrains.filter(([, n]) => n >= MAJOR_BRAIN_THRESHOLD).map(([k]) => k);
  const future = knowledgeBrains.filter(([, n]) => n < MAJOR_BRAIN_THRESHOLD).map(([k]) => k);
  const crossCutting = Object.entries(brainCounts).filter(([k, n]) => CROSS_CUTTING_BRAINS.has(k) && n > 0).map(([k]) => k);

  const totalAssets = totalImages + knowledgeFiles + totalSeeds;
  const fmt = (n: number) => n.toLocaleString("en-GB");

  return {
    size: {
      score: Math.round(sizeScore),
      base: Number(base.toFixed(2)),
      diversity_bonus: Number(diversityBonus.toFixed(2)),
      unique_populated_domains: populatedDomains,
      formula: "min(100, (images + knowledge_files × 4 + trade_records × 3) / 43 + unique_populated_domains × 1.2)",
    },
    enrichment: {
      score: Math.round(enrichmentScore),
      image_pct: Number(imagePct.toFixed(1)),
      seed_pct: Number(seedPct.toFixed(1)),
      knowledge_pct: knowledgePct,
      formula: "image_pct × 0.30 + seed_pct × 0.30 + knowledge_pct × 0.40 · (ENRICHED / VERIFIED / ROUTABLE per Record State Model)",
    },
    active_brains: {
      major,
      future,
      cross_cutting: crossCutting,
      by_brain_counts: brainCounts,
      summary: `${major.length} major / ${future.length} future domain${future.length === 1 ? "" : "s"}${crossCutting.length ? ` + ${crossCutting.length} cross-cutting` : ""}`,
    },
    total_knowledge_assets: {
      images: totalImages,
      knowledge_files: knowledgeFiles,
      trade_records: totalSeeds,
      total: totalAssets,
      label: `${fmt(totalImages)} images + ${fmt(knowledgeFiles)} knowledge files + ${fmt(totalSeeds)} trade/company records`,
    },
    goal_ladder: "Grow Size → Enrich → Validate → Activate new Brains. Not 100/100.",
    observed_at: new Date().toISOString(),
  };
}

// Build a StudioLayoutJson from blueprint manifest section seeds.
//
// Used by:
//   • the install route (persists to studio_layouts)
//   • the preview slide-over (renders via StudioLiveShell without persisting)
//
// Output matches src/lib/studio/schema.ts StudioLayoutJson exactly, so
// StudioLiveShell can render it with zero adaptation.
//
// Config merge: each seed carries only the fields the manifest author
// cared to set. Section renderers expect their full Config shape. We
// merge section.defaultConfig() under the seed so missing fields fall
// back to safe defaults — otherwise renderers hit undefined properties
// (Math.min(1, undefined) → NaN, .map on undefined → crash, etc.).
//
// The side-effect import populates sectionRegistry on the server so
// this file works from API routes (client bundles get it via
// StudioLiveShell's own barrel import).

import "@/lib/studio/sections";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import type { StudioLayoutJson } from "@/lib/studio/schema";
import type { BlueprintSectionSeed } from "./types";
import {
  getRandomAsset,
  type AssetCriteria
} from "@/lib/studio/assetLibrary";

export type BuildLayoutOptions = {
  heroPool?: string[];
  heroOverride?: string;
  /** Asset auto-resolution context. When provided, sections with empty
   *  image slots (backgroundImageUrl / imageUrl) get auto-populated
   *  from the asset library filtered by industry + style. */
  assetContext?: {
    industry?: string;
    style?: string;
    /** Deterministic seed so preview renders are stable per merchant. */
    seed?: string;
  };
};

export async function buildLayoutFromSeeds(
  seeds: BlueprintSectionSeed[],
  options: BuildLayoutOptions = {}
): Promise<StudioLayoutJson> {
  // Hero rotation — pick one from the pool so two merchants installing
  // the same blueprint don't get identical-looking sites.
  const effectiveSeeds = applyHeroRotation(
    seeds,
    options.heroPool,
    options.heroOverride
  );

  // Build sections in parallel — asset resolution is I/O bound.
  const sections = await Promise.all(
    effectiveSeeds.map(async (s, idx) => {
      const reg = sectionRegistry.get(s.key);
      const defaults = reg?.defaultConfig?.() ?? {};
      const normalisedSeed = normaliseSeedKeys(s.config ?? {});
      let config: Record<string, unknown> = {
        ...defaults,
        ...normalisedSeed
      };

      // Auto-populate image slots from the asset library when unset.
      if (options.assetContext) {
        config = await autoResolveAssets(
          s.key,
          config,
          options.assetContext,
          idx
        );
      }

      return {
        instanceId: randomId(),
        key: s.key,
        config
      };
    })
  );

  const rows = sections.map((s) => ({
    id: randomId(),
    columns: [s.instanceId]
  }));
  return { sections, rows };
}

/** Fill in image slots on section configs from the asset library when
 *  they aren't already set. Rules per section type:
 *   • hero.* backgroundImageUrl / imageUrl → landscape hero photo
 *   • gallery.* photoNUrl fields → square gallery photos
 *   • banner.* backgroundImageUrl → landscape banner background */
async function autoResolveAssets(
  sectionKey: string,
  config: Record<string, unknown>,
  ctx: NonNullable<BuildLayoutOptions["assetContext"]>,
  positionIdx: number
): Promise<Record<string, unknown>> {
  const isHero = sectionKey.startsWith("hero.");
  const isGallery = sectionKey.startsWith("gallery.");
  const isBanner = sectionKey.startsWith("banner.");
  if (!isHero && !isGallery && !isBanner) return config;

  const next = { ...config };
  const seedBase = ctx.seed
    ? `${ctx.seed}#${sectionKey}#${positionIdx}`
    : undefined;

  // Hero + banner backgrounds — landscape
  if ((isHero || isBanner) && !hasStringValue(next.backgroundImageUrl)) {
    const criteria: AssetCriteria = {
      purpose: "hero",
      industry: ctx.industry,
      style: ctx.style,
      orientation: "landscape",
      seed: seedBase
    };
    const asset = await getRandomAsset(criteria);
    if (asset) {
      next.backgroundImageUrl = asset.url;
      if (!hasStringValue(next.backgroundImageAlt)) {
        next.backgroundImageAlt = asset.alt;
      }
    }
  }

  // Split-photo heroes (imageUrl not backgroundImageUrl)
  if (isHero && !hasStringValue(next.imageUrl)) {
    const criteria: AssetCriteria = {
      purpose: "hero",
      industry: ctx.industry,
      style: ctx.style,
      orientation: "landscape",
      seed: seedBase
    };
    const asset = await getRandomAsset(criteria);
    if (asset) {
      next.imageUrl = asset.url;
      if (!hasStringValue(next.imageAlt)) {
        next.imageAlt = asset.alt;
      }
    }
  }

  // Gallery photo slots
  if (isGallery) {
    for (let i = 1; i <= 8; i++) {
      const key = `photo${i}Url`;
      if (hasStringValue(next[key])) continue;
      const criteria: AssetCriteria = {
        purpose: "gallery",
        industry: ctx.industry,
        style: ctx.style,
        orientation: "square",
        seed: seedBase ? `${seedBase}#${i}` : undefined
      };
      const asset = await getRandomAsset(criteria);
      if (asset) {
        next[key] = asset.url;
        const altKey = `photo${i}Alt`;
        if (!hasStringValue(next[altKey])) {
          next[altKey] = asset.alt;
        }
      }
    }
  }

  return next;
}

function hasStringValue(v: unknown): boolean {
  return typeof v === "string" && v.length > 0;
}

/** Swap the first hero seed's key for a random pick from the pool.
 *  Config stays intact — only the visual component changes. Guarantees:
 *   • Only picks keys that are registered in sectionRegistry (falls
 *     back to the original seed key when a pool entry isn't registered).
 *   • Never picks the same key as the original seed unless it's the
 *     only registered option in the pool.
 *   • Deterministic when heroOverride is supplied. */
function applyHeroRotation(
  seeds: BlueprintSectionSeed[],
  heroPool: string[] | undefined,
  heroOverride: string | undefined
): BlueprintSectionSeed[] {
  const firstHeroIdx = seeds.findIndex((s) => s.key.startsWith("hero."));
  if (firstHeroIdx < 0) return seeds;
  if (heroOverride) {
    return replaceHeroKey(seeds, firstHeroIdx, heroOverride);
  }
  if (!heroPool || heroPool.length === 0) return seeds;

  const original = seeds[firstHeroIdx].key;
  const registered = heroPool.filter((key) => sectionRegistry.get(key));
  if (registered.length === 0) return seeds; // pool entries unknown — keep original
  const candidates =
    registered.length > 1
      ? registered.filter((k) => k !== original)
      : registered;
  const chosen =
    candidates[Math.floor(Math.random() * candidates.length)] ?? original;
  return replaceHeroKey(seeds, firstHeroIdx, chosen);
}

function replaceHeroKey(
  seeds: BlueprintSectionSeed[],
  index: number,
  key: string
): BlueprintSectionSeed[] {
  const next = seeds.slice();
  next[index] = { ...seeds[index], key };
  return next;
}

// Accept common author aliases used in blueprint manifests + rewrite
// them to the exact keys section Configs expect. Purely additive: the
// original key still lands in the final config too, so future sections
// that read the alias key keep working.
const ALIAS_MAP: Record<string, string[]> = {
  headline: ["heading"],
  subhead: ["subheading"],
  primaryCtaLabel: ["callCtaLabel"],
  secondaryCtaLabel: ["whatsappCtaLabel"],
  responsePromiseMinutes: ["responseTime"]
};

function normaliseSeedKeys(
  seed: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...seed };
  for (const [author, targets] of Object.entries(ALIAS_MAP)) {
    if (author in seed) {
      for (const target of targets) {
        if (!(target in out)) out[target] = seed[author];
      }
    }
  }
  return out;
}

function randomId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `inst_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

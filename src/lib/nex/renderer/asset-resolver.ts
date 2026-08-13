// Asset Resolver · sits between Banner Specification and Pixel Renderer.
// Selects the correct hero · logo · icon set · background from the manifest.
//
// Doctrine: docs/brains/nex-pixel-rendering-engine-phase-e0-philip-2026-08-04.md

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { BannerSpecification, ResolvedAssets } from "./types";

const IMAGE_MANIFEST = path.join(process.cwd(), "data", "nex-image-manifest.json");

type ManifestImage = {
  url: string;
  tags?: string[];
  subject_domain?: string;
  a_plus?: boolean;
  staircase_context?: string;
  hero_product_type?: string;
};

function loadManifestImages(): ManifestImage[] {
  if (!fs.existsSync(IMAGE_MANIFEST)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(IMAGE_MANIFEST, "utf8")) as { images?: Record<string, ManifestImage> };
    const out: ManifestImage[] = [];
    for (const [url, meta] of Object.entries(parsed.images ?? {})) {
      out.push({ ...meta, url });
    }
    return out;
  } catch {
    return [];
  }
}

function scoreImageForHero(image: ManifestImage, spec: BannerSpecification): number {
  const heroType = (spec.metadata.hero_product_type ?? "").toLowerCase();
  const timber = (spec.metadata.timber_profile ?? "").toLowerCase();
  const tags = (image.tags ?? []).map((t) => t.toLowerCase());
  let score = 0;
  // Prefer product-domain images · never marketing_banner images as hero
  if (image.subject_domain === "marketing_banner") return -1;
  if (heroType.includes("kitchen") && image.subject_domain !== "staircase") score += 0.2;
  if (heroType.includes("staircase") && image.subject_domain === "staircase") score += 0.4;
  if (image.a_plus) score += 0.3;
  for (const kw of [heroType, timber].filter(Boolean)) {
    if (tags.some((t) => t.includes(kw))) score += 0.2;
  }
  // Prefer coordinated flagship images when banner is coordinated
  if (image.staircase_context === "coordinated_with_kitchen" && heroType.includes("kitchen")) score += 0.3;
  return score;
}

/** Resolve all asset URLs for a banner spec. Returns cache_key + resolved URLs. */
export function resolveAssets(spec: BannerSpecification): ResolvedAssets {
  const images = loadManifestImages();

  // Hero: pick highest-scoring product image
  const scored = images
    .map((img) => ({ img, score: scoreImageForHero(img, spec) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  const hero_url = scored[0]?.img.url;

  // Logo: MVP · no dedicated logo library yet · leave undefined
  const logo_url = undefined;

  // Icon bundle: derived from theme pack icon style
  const icon_bundle_id = spec.theme_pack.icon.style === "line" ? "nex_line_icons_v1" : spec.theme_pack.icon.style === "filled" ? "nex_filled_icons_v1" : "nex_duotone_icons_v1";

  // Background texture: MVP · undefined · Phase E.1 will pick a subtle theme-appropriate texture
  const background_texture_url = undefined;

  const cache_key = crypto.createHash("sha256").update(JSON.stringify({
    hero: spec.metadata.hero_product_type,
    timber: spec.metadata.timber_profile,
    theme: spec.theme_pack.id,
    layout: spec.layout_family,
  })).digest("hex").slice(0, 16);

  return {
    hero_url,
    logo_url,
    icon_bundle_id,
    background_texture_url,
    resolved_at: new Date().toISOString(),
    cache_key,
  };
}

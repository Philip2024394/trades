#!/usr/bin/env node
// migrate-hero-orphans.mjs
//
// Scans the codebase for hero image URLs that are not yet registered
// in scripts/hero-library.json and appends stub entries so the AI's
// heroesForTrade() / pickHeroForTrade() can see them.
//
// Sources scanned:
//   1. src/lib/studio/sections/hero/*.tsx and *.meta.ts
//   2. src/lib/studio/assetLibrary.ts (CURATED_SEED_POOL, purpose === "hero")
//
// Each new entry gets the same field set as existing library entries
// (id, image_url, subject, keywords_strict, excluded_trades, vibe,
// text_zone, theme_palette, aspect_variants, hero_use_case,
// burned_in_text, worker_visible, recommended_use) plus a
// `$migration_status` marker so we know the metadata is heuristic
// (not human-curated) and should be reviewed for palette + keywords.
//
// Safe to re-run — dedups by image_url.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const LIBRARY_PATH = path.join(ROOT, "scripts", "hero-library.json");
const HERO_SECTIONS_DIR = path.join(ROOT, "src", "lib", "studio", "sections", "hero");
const ASSET_LIB_PATH = path.join(ROOT, "src", "lib", "studio", "assetLibrary.ts");

// ─── Load current library ──────────────────────────────────────
const library = JSON.parse(fs.readFileSync(LIBRARY_PATH, "utf8"));
const existingUrls = new Set(library.entries.map((e) => e.image_url));

// ─── URL extraction helper ─────────────────────────────────────
const URL_RE = /https:\/\/ik\.imagekit\.io\/9mrgsv2rp\/[^\s"'`\)\)]+/g;

function extractUrls(text) {
  const found = new Set();
  const matches = text.match(URL_RE) ?? [];
  for (const raw of matches) {
    // Strip trailing punctuation that isn't part of the URL
    const clean = raw.replace(/[.,)\];>]+$/, "");
    if (clean.endsWith(".png") || clean.endsWith(".jpg") || clean.endsWith(".jpeg") || clean.endsWith(".webp")) {
      found.add(clean);
    }
  }
  return found;
}

// ─── Section walker — for each hero-section file, pull its URLs + context ──
function walkHeroSections() {
  const orphans = [];
  const files = fs.readdirSync(HERO_SECTIONS_DIR).filter((f) => /\.(tsx|ts)$/.test(f));
  for (const file of files) {
    const full = path.join(HERO_SECTIONS_DIR, file);
    const raw = fs.readFileSync(full, "utf8");
    const urls = extractUrls(raw);
    if (urls.size === 0) continue;

    // Try to pull section context — slug + bestForVerticals + name
    const slugMatch = raw.match(/id:\s*['"]([^'"]+)['"]/);
    const nameMatch = raw.match(/name:\s*['"]([^'"]+)['"]/);
    const verticalsBlock = raw.match(/bestForVerticals\s*:\s*\[([^\]]*)\]/s);
    const verticals = verticalsBlock
      ? [...verticalsBlock[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1])
      : [];
    const descMatch = raw.match(/description:\s*['"]([^'"]+)['"]/);

    for (const url of urls) {
      if (existingUrls.has(url)) continue;
      orphans.push({
        url,
        source: `sections/hero/${file}`,
        sectionSlug: slugMatch?.[1] ?? file.replace(/\.(tsx|ts|meta\.ts)$/, ""),
        sectionName: nameMatch?.[1] ?? null,
        verticals,
        description: descMatch?.[1] ?? null
      });
      existingUrls.add(url);
    }
  }
  return orphans;
}

// ─── Asset-library walker — extract CURATED_SEED_POOL hero entries ─────
function walkAssetLibrary() {
  const raw = fs.readFileSync(ASSET_LIB_PATH, "utf8");
  const poolStart = raw.indexOf("CURATED_SEED_POOL");
  if (poolStart < 0) return [];
  const poolText = raw.slice(poolStart);

  // Naïve object splitter: split on `},` at top depth, then parse each.
  const entries = [];
  const entryRe = /\{\s*url:\s*["']([^"']+)["']([^{}]*?(?:\{[^{}]*\}[^{}]*?)*)\}/g;
  const matches = [...poolText.matchAll(entryRe)];
  for (const m of matches) {
    const url = m[1];
    const body = m[2];
    if (existingUrls.has(url)) continue;
    // Only migrate purpose === "hero"
    if (!/purpose:\s*["']hero["']/.test(body)) continue;

    const alt = (body.match(/alt:\s*["']([^"']+)["']/) ?? [])[1] ?? null;
    const mood = (body.match(/mood:\s*["']([^"']+)["']/) ?? [])[1] ?? null;
    const style = (body.match(/style:\s*["']([^"']+)["']/) ?? [])[1] ?? null;
    const industry = (body.match(/industry:\s*["']([^"']+)["']/) ?? [])[1] ?? null;
    const tagsBlock = body.match(/tags:\s*\[([^\]]*)\]/);
    const tags = tagsBlock
      ? [...tagsBlock[1].matchAll(/["']([^"']+)["']/g)].map((mm) => mm[1])
      : [];

    entries.push({
      url,
      source: "assetLibrary.ts (CURATED_SEED_POOL)",
      alt, mood, style, industry, tags
    });
    existingUrls.add(url);
  }
  return entries;
}

// ─── Stub-entry generator ──────────────────────────────────────
function slugFromUrl(url) {
  const basename = decodeURIComponent(url.split("/").pop() ?? "hero");
  return basename
    .toLowerCase()
    .replace(/\.(png|jpg|jpeg|webp)$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

// Sensible palette per mood — derived from the design tokens.
const PALETTE_BY_MOOD = {
  warm: {
    primary: "#c9a670", secondary: "#5c3d24", surface_warm: "#e8dcc2",
    surface_deep: "#2a1f14", accent: "#8ca5b8"
  },
  cool: {
    primary: "#5c7dbf", secondary: "#3a4a6b", surface_warm: "#e2e8f0",
    surface_deep: "#1f2937", accent: "#c9a670"
  },
  bright: {
    primary: "#FFB300", secondary: "#0A0A0A", surface_warm: "#FFFFFF",
    surface_deep: "#1a1a1a", accent: "#F59E0B"
  },
  dark: {
    primary: "#0A0A0A", secondary: "#1a1a1a", surface_warm: "#334155",
    surface_deep: "#020617", accent: "#FFB300"
  },
  neutral: {
    primary: "#64748B", secondary: "#334155", surface_warm: "#F1F5F9",
    surface_deep: "#0F172A", accent: "#FFB300"
  }
};

const VIBE_BY_MOOD = {
  warm: "warm / photographic / homely",
  cool: "cool / clean / professional",
  bright: "bright / open / retail",
  dark: "dark / cinematic / premium",
  neutral: "neutral / documentary"
};

function buildStub(orphan) {
  const isSection = "sectionSlug" in orphan;
  const id = slugFromUrl(orphan.url);
  const mood = orphan.mood ?? "neutral";

  // Keywords_strict — real trade slugs where possible.
  const keywords = new Set();
  if (isSection) {
    for (const v of orphan.verticals ?? []) keywords.add(v);
  } else {
    if (orphan.industry) keywords.add(orphan.industry);
    for (const t of orphan.tags ?? []) keywords.add(t);
  }
  if (keywords.size === 0) {
    keywords.add("trade");
    keywords.add("uk trades");
  }

  const subject = isSection
    ? orphan.description
      ?? `${orphan.sectionName ?? orphan.sectionSlug} hero photograph`
    : orphan.alt ?? "Hero photograph";

  return {
    id,
    image_url: orphan.url,
    subject,
    keywords_strict: [...keywords],
    excluded_trades: [],
    vibe: VIBE_BY_MOOD[mood] ?? VIBE_BY_MOOD.neutral,
    text_zone: {
      primary: "top-left",
      container_required: false,
      text_shadow_recommended: true
    },
    theme_palette: PALETTE_BY_MOOD[mood] ?? PALETTE_BY_MOOD.neutral,
    aspect_variants: {
      "16:9": "native",
      "1:1": "centre crop",
      "3:4": "left-anchor"
    },
    hero_use_case: isSection
      ? `Auto-migrated from ${orphan.source}. Landing hero for the ${orphan.sectionSlug} section — trades listed in keywords_strict.`
      : `Auto-migrated from ${orphan.source}. Suits ${orphan.style ?? "generic"} / ${mood} moods.`,
    burned_in_text: false,
    worker_visible: null,
    recommended_use: "hero",
    $migration_status: "auto-migrated-2026-07-09-needs-review",
    $migration_source: orphan.source
  };
}

// ─── Run ────────────────────────────────────────────────────────
const sectionOrphans = walkHeroSections();
const assetOrphans = walkAssetLibrary();
const allOrphans = [...sectionOrphans, ...assetOrphans];

const stubs = allOrphans.map(buildStub);
library.entries.push(...stubs);

fs.writeFileSync(LIBRARY_PATH, JSON.stringify(library, null, 2) + "\n", "utf8");

console.log(`═══ migration summary ═══`);
console.log(`existing entries: ${library.entries.length - stubs.length}`);
console.log(`section orphans:  ${sectionOrphans.length}`);
console.log(`asset orphans:    ${assetOrphans.length}`);
console.log(`added stubs:      ${stubs.length}`);
console.log(`new total:        ${library.entries.length}`);
console.log(`\nFirst 5 added:`);
for (const s of stubs.slice(0, 5)) {
  console.log(`  · ${s.id.slice(0, 40).padEnd(42)} — ${s.keywords_strict.slice(0, 3).join(", ")}`);
}
console.log(`\nAll stubs marked \`$migration_status: auto-migrated-…-needs-review\` so you can grep + tune later.`);

// /admin/image-tagger — retroactive backfill for pre-manifest images
// per ADR-0024.
//
// Loads the 82 pre-rule staircase image URLs from
// data/staircase-hero-candidates.json + any existing tags from
// data/nex-image-manifest.json, then renders the interactive tagger.
//
// After Philip finishes tagging + saves, the manifest becomes the
// source of truth for image-to-usecase matching across the app
// (directory cards, brain answers, banners, etc.).

import { promises as fs } from "node:fs";
import path from "node:path";
import ImageTaggerClient from "./ImageTaggerClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Candidate = {
  url: string;
  contexts: Array<{
    source?: string | null;
    category?: string | null;
    question?: string | null;
    caption?: string | null;
    material?: string | null;
    wood?: string | null;
    notes?: string | null;
    role?: string | null;
  }>;
};

type ManifestRow = {
  source?: string;
  original_prompt?: string | null;
  description?: string;
  tags?: string[];
  a_plus?: boolean;
  subject_domain?: string;
  created_at?: string;
  created_by?: string;
  notes?: string;
};

async function readJson<T>(rel: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), rel), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Inventory row shape from scripts/image-migration-inventory.json */
type InventoryRow = {
  canonical_url: string;
  origin: string;
  supabase_bucket: string | null;
  purpose: string;
  raw_variant_count: number;
  referring_file_count: number;
  referring_files: string[];
};

/** Best-effort timestamp extraction so we can sort newest-first.
 *  Tries in order:
 *    1. ?updatedAt=<epoch-ms> query param (ImageKit standard)
 *    2. Date encoded in ChatGPT filename ("ChatGPT Image Jul 25, 2026, 12_15_57 PM.png")
 *    3. Any 4-digit year + month + day found in the filename
 *    4. Fall back to 0 (very old — sorts last)
 */
const MONTHS_3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function getImageTimestamp(url: string): number {
  // 1. ?updatedAt=1784801131318
  const updated = url.match(/[?&]updatedAt=(\d{10,})/);
  if (updated) return Number.parseInt(updated[1], 10);

  const decoded = decodeURIComponent(url.split("?")[0]);
  const filename = decoded.split("/").pop() ?? "";

  // 2. "ChatGPT Image Jul 25, 2026, 12_15_57 PM.png"
  const chatgpt = filename.match(
    /(?:ChatGPT\s+Image\s+)?(\w{3,9})\s+(\d{1,2}),\s+(\d{4}),?\s+(\d{1,2})_(\d{2})_(\d{2})\s*(AM|PM)/i
  );
  if (chatgpt) {
    const [, monRaw, day, year, hourRaw, min, sec, ampm] = chatgpt;
    const monIdx = MONTHS_3.indexOf(monRaw.slice(0, 3));
    if (monIdx >= 0) {
      let hour = Number.parseInt(hourRaw, 10);
      if (ampm.toUpperCase() === "PM" && hour !== 12) hour += 12;
      if (ampm.toUpperCase() === "AM" && hour === 12) hour = 0;
      return Date.UTC(
        Number.parseInt(year, 10),
        monIdx,
        Number.parseInt(day, 10),
        hour,
        Number.parseInt(min, 10),
        Number.parseInt(sec, 10)
      );
    }
  }

  // 3. YYYY-MM-DD or YYYYMMDD anywhere in filename
  const ymd = filename.match(/(20\d{2})[-_]?(\d{2})[-_]?(\d{2})/);
  if (ymd) {
    return Date.UTC(
      Number.parseInt(ymd[1], 10),
      Number.parseInt(ymd[2], 10) - 1,
      Number.parseInt(ymd[3], 10)
    );
  }

  return 0;
}

export default async function ImageTaggerPage() {
  const [staircaseCandidates, inventoryFile, manifestFile] = await Promise.all([
    readJson<{ count: number; candidates: Candidate[] }>(
      "data/staircase-hero-candidates.json",
      { count: 0, candidates: [] }
    ),
    readJson<{ inventory: InventoryRow[] }>(
      "scripts/image-migration-inventory.json",
      { inventory: [] }
    ),
    readJson<{ images: Record<string, ManifestRow> }>(
      "data/nex-image-manifest.json",
      { images: {} }
    ),
  ]);

  // Merge sources:
  //   1. Staircase candidates (with rich context) — take verbatim
  //   2. Full inventory (all 981 URLs) — add any URL not already
  //      present, using a minimal context row derived from origin +
  //      purpose + referring files
  const byUrl = new Map<string, Candidate>();
  for (const c of staircaseCandidates.candidates) {
    byUrl.set(c.url, c);
  }
  for (const r of inventoryFile.inventory) {
    if (byUrl.has(r.canonical_url)) continue;
    byUrl.set(r.canonical_url, {
      url: r.canonical_url,
      contexts: [
        {
          source: `inventory:${r.origin}${r.supabase_bucket ? "/" + r.supabase_bucket : ""}`,
          role: r.purpose,
          notes: r.referring_files.slice(0, 2).join(" · "),
        },
      ],
    });
  }

  // Exclude URLs already fully tagged in the manifest (they have a
  // description) so the tagger shows only the outstanding work.
  // "excluded: true" rows are still shown so Philip can un-exclude.
  const untagged: Candidate[] = [];
  for (const c of byUrl.values()) {
    const row = manifestFile.images[c.url];
    if (row && row.description && row.description.trim().length > 0 && !(row as { excluded?: boolean }).excluded) {
      continue; // done — hidden from the tagger
    }
    untagged.push(c);
  }

  // Sort: staircase-domain FIRST (per Philip's directive — those are
  // the highest-priority images for the current directory push),
  // then newest-first within each domain group. Timestamp best-effort
  // per getImageTimestamp above.
  function isStaircase(c: Candidate): boolean {
    const blob = c.contexts
      .map((ctx) =>
        [ctx.source, ctx.role, ctx.category, ctx.caption, ctx.notes, ctx.material]
          .filter(Boolean)
          .join(" ")
      )
      .join(" ")
      .toLowerCase();
    return /staircase|stair|balustrade|newel|tread|riser|handrail|banister|joinery/.test(
      blob
    );
  }
  untagged.sort((a, b) => {
    const aStair = isStaircase(a) ? 0 : 1;
    const bStair = isStaircase(b) ? 0 : 1;
    if (aStair !== bStair) return aStair - bStair; // staircase group first
    return getImageTimestamp(b.url) - getImageTimestamp(a.url); // newest within group
  });

  // Count banners for the header. Banner = any candidate whose
  // context or origin classifies as hero/banner/cover.
  const bannerCount = untagged.filter((c) => {
    const blob = c.contexts
      .map((ctx) =>
        [ctx.source, ctx.role, ctx.notes, ctx.caption]
          .filter(Boolean)
          .join(" ")
      )
      .join(" ")
      .toLowerCase();
    return /hero|banner|cover/.test(blob);
  }).length;

  return (
    <ImageTaggerClient
      candidates={untagged}
      existingRows={manifestFile.images}
      totalInApp={byUrl.size}
      savedCount={byUrl.size - untagged.length}
      bannerCount={bannerCount}
    />
  );
}

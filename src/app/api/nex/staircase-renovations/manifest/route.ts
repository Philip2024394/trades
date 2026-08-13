// GET /api/nex/staircase-renovations/manifest
//
// Serves the customer-facing Staircase Renovations manifest verbatim
// from data/staircase-renovations/manifest.json. Read-only · no writes ·
// no database dependency. Philip edits the JSON file (add categories /
// add images) and the change appears on the next page load.
//
// This endpoint is completely separate from Headquarters, G1-G6, the
// burn-in, and all frozen worker/Truth-Contract surfaces.

import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ImageRow      = { src: string; alt?: string; sort?: number };
type CategoryRow   = { slug: string; label: string; description?: string; images?: ImageRow[] };
type Manifest      = { version?: number; updated_at?: string; categories?: CategoryRow[]; notes?: string[] };

const MANIFEST_PATH = join(process.cwd(), "data", "staircase-renovations", "manifest.json");

export async function GET() {
  try {
    const raw = await readFile(MANIFEST_PATH, "utf8");
    const parsed = JSON.parse(raw) as Manifest;
    // Light validation · sort images by sort field when present · never mutate the file.
    const categories = Array.isArray(parsed.categories)
      ? parsed.categories.map((c) => {
          const images = Array.isArray(c.images)
            ? [...c.images].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
            : [];
          return {
            slug:        String(c.slug),
            label:       String(c.label),
            description: c.description ?? null,
            images,
            image_count: images.length,
          };
        })
      : [];
    return NextResponse.json({
      ok:         true,
      version:    parsed.version ?? 1,
      updated_at: parsed.updated_at ?? null,
      categories,
      total_images: categories.reduce((s, c) => s + c.images.length, 0),
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      categories: [],
      total_images: 0,
    }, { status: 500 });
  }
}

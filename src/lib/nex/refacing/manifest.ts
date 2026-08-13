// manifest.ts — server-side loader for data/staircase-renovations/manifest.json.
//
// One reader used by retrieval, case-store, tests. Reads the file once per
// process and caches. Callers that need freshness can call invalidateManifestCache().
//
// Doctrinal note:
//   · Returns the `images_v3[]` block · this is the intelligence layer surface.
//   · Also exposes `categories[]` and `step_units[]` for legacy consumers (backward
//     compatibility per PR-12 spec §3).
//   · Never mutates the file · loader is read-only.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ImagesV3Entry } from "./image-schema";

export type RawManifest = {
  version?: number;
  updated_at?: string;
  notes?: string[];
  categories?: Array<{
    slug: string;
    label: string;
    description?: string | null;
    images?: Array<{
      src: string;
      alt?: string;
      sort?: number;
      materials?: string[];
    }>;
  }>;
  step_units?: Array<{
    family: string;
    label: string;
    description?: string;
    sub_material_default?: string | null;
    step_units?: Array<{
      src: string;
      alt?: string;
      sort?: number;
      variant?: string;
      riser_material?: string;
      sub_material?: string;
      pattern?: string;
      tread_species?: string;
      materials?: string[];
    }>;
  }>;
  images_v3?: ImagesV3Entry[];
};

const MANIFEST_PATH = join(
  process.cwd(),
  "data",
  "staircase-renovations",
  "manifest.json"
);

let cache: { manifest: RawManifest; loadedAt: number } | null = null;
const CACHE_TTL_MS = 5000; // Short cache · dev-friendly · production can lengthen

export async function loadManifest(): Promise<RawManifest> {
  const now = Date.now();
  if (cache && now - cache.loadedAt < CACHE_TTL_MS) return cache.manifest;

  try {
    const raw = await readFile(MANIFEST_PATH, "utf8");
    const manifest = JSON.parse(raw) as RawManifest;
    cache = { manifest, loadedAt: now };
    return manifest;
  } catch {
    // Return an empty manifest so callers render honest empty state
    return {};
  }
}

export function invalidateManifestCache(): void {
  cache = null;
}

/**
 * Load only the images_v3[] block. Empty array if not yet migrated.
 */
export async function loadImagesV3(): Promise<ImagesV3Entry[]> {
  const manifest = await loadManifest();
  return Array.isArray(manifest.images_v3) ? manifest.images_v3 : [];
}

/**
 * Load the set of known image_id values · used by PR-18 provenance validation.
 */
export async function loadKnownImageIds(): Promise<Set<string>> {
  const entries = await loadImagesV3();
  return new Set(entries.map((e) => e.image_id));
}

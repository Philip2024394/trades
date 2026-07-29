// Materials Library service · reads from git-versioned JSON files
//
// Library items live in `data/materials/**/*.json`. This service loads
// every JSON file once at first use, validates the shape, caches the
// result for the process lifetime, and exposes a small read API plus
// an import-to-Memory function.
//
// Corrected 2026-07-28 (Philip) · Library is knowledge, not a database
// table. Same architectural pattern as the Reference Brain: read-only
// knowledge = git-versioned files; transactional data = database.

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { audit } from "./_audit";
import { MaterialsError } from "../_schema/types";
import type {
  LibraryCategory,
  LibraryImportResult,
  LibraryItem,
  LibraryUnit,
} from "../_schema/library_types";

const LIBRARY_ROOT = path.join(process.cwd(), "data", "materials");

const VALID_CATEGORIES: readonly LibraryCategory[] = [
  "hardwood", "softwood", "stair_part", "sheet", "flooring",
  "moulding", "consumable", "hardware", "finish", "other",
];
const VALID_UNITS: readonly LibraryUnit[] = [
  "board", "sheet", "length", "unit", "pack", "linear_metre", "litre", "kg", "each",
];

// ── Cache ─────────────────────────────────────────────────────────

let cache: LibraryItem[] | null = null;
let cachePromise: Promise<LibraryItem[]> | null = null;

/** Force a cache reload · useful for tests. */
export function clearLibraryCache(): void {
  cache = null;
  cachePromise = null;
}

async function loadAll(): Promise<LibraryItem[]> {
  if (cache) return cache;
  if (cachePromise) return cachePromise;
  cachePromise = (async () => {
    const files = await walkJsonFiles(LIBRARY_ROOT);
    const items: LibraryItem[] = [];
    const seenSlugs = new Set<string>();

    for (const file of files) {
      const raw = await fs.readFile(file, "utf8");
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        throw new Error(`[materials.library] invalid JSON in ${file}: ${(e as Error).message}`);
      }
      if (!Array.isArray(parsed)) {
        throw new Error(`[materials.library] ${file} must contain a top-level array`);
      }
      for (const entry of parsed) {
        const item = coerceLibraryItem(entry, file);
        if (seenSlugs.has(item.slug)) {
          throw new Error(`[materials.library] duplicate slug '${item.slug}' in ${file}`);
        }
        seenSlugs.add(item.slug);
        items.push(item);
      }
    }

    items.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      const oa = a.sort_order ?? 0, ob = b.sort_order ?? 0;
      if (oa !== ob) return oa - ob;
      return a.name.localeCompare(b.name);
    });

    cache = items;
    return items;
  })();
  return cachePromise;
}

async function walkJsonFiles(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];   // directory not present yet · Library is empty
  }
  const out: string[] = [];
  for (const e of entries) {
    if (e.name.startsWith("_") || e.name.startsWith(".")) continue;   // skip _schema.md · README.md · dotfiles
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...await walkJsonFiles(full));
    } else if (e.isFile() && e.name.toLowerCase().endsWith(".json")) {
      out.push(full);
    }
  }
  return out;
}

function coerceLibraryItem(raw: unknown, sourceFile: string): LibraryItem {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`[materials.library] non-object entry in ${sourceFile}`);
  }
  const o = raw as Record<string, unknown>;
  const slug = asString(o.slug);
  const name = asString(o.name);
  const category = asString(o.category);
  const unit = asString(o.default_unit);

  if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    throw new Error(`[materials.library] invalid or missing slug in ${sourceFile}: ${JSON.stringify(o.slug)}`);
  }
  if (!name) throw new Error(`[materials.library] missing name for slug ${slug} in ${sourceFile}`);
  if (!VALID_CATEGORIES.includes(category as LibraryCategory)) {
    throw new Error(`[materials.library] invalid category '${category}' for slug ${slug} in ${sourceFile}`);
  }
  if (!VALID_UNITS.includes(unit as LibraryUnit)) {
    throw new Error(`[materials.library] invalid default_unit '${unit}' for slug ${slug} in ${sourceFile}`);
  }

  return {
    slug,
    name,
    category:              category as LibraryCategory,
    subcategory:           asString(o.subcategory) || null,
    species_id:            asString(o.species_id) || null,
    default_unit:          unit as LibraryUnit,
    finish:                asString(o.finish) || null,
    typical_grades:        asStringArr(o.typical_grades),
    typical_applications:  asStringArr(o.typical_applications),
    synonyms:              asStringArr(o.synonyms),
    common_dimensions:     (o.common_dimensions && typeof o.common_dimensions === "object"
      ? o.common_dimensions as LibraryItem["common_dimensions"]
      : {}),
    notes:                 asString(o.notes) || null,
    sort_order:            typeof o.sort_order === "number" ? o.sort_order : 0,
  };
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function asStringArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string").map(s => s.trim()).filter(Boolean);
}

// ── Read API ─────────────────────────────────────────────────────

export type LibraryListFilter = {
  category?: LibraryCategory;
  subcategory?: string;
  species_id?: string;
};

export async function listLibrary(filter: LibraryListFilter = {}): Promise<LibraryItem[]> {
  const all = await loadAll();
  return all.filter(i =>
    (!filter.category    || i.category    === filter.category) &&
    (!filter.subcategory || i.subcategory === filter.subcategory) &&
    (!filter.species_id  || i.species_id  === filter.species_id),
  );
}

export async function getLibraryItem(slug: string): Promise<LibraryItem> {
  const all = await loadAll();
  const item = all.find(i => i.slug === slug);
  if (!item) throw new MaterialsError("not_found", `Library item '${slug}' not found`, 404);
  return item;
}

export async function listCategoriesInUse(): Promise<{ category: LibraryCategory; count: number }[]> {
  const items = await loadAll();
  const counts = new Map<LibraryCategory, number>();
  for (const it of items) counts.set(it.category, (counts.get(it.category) ?? 0) + 1);
  return Array.from(counts.entries()).map(([category, count]) => ({ category, count }));
}

// ── Import to Memory ─────────────────────────────────────────────

/**
 * Copy selected Library items into this owner's Materials Memory.
 * Never overwrites existing Memory rows — duplicates (matched by
 * lower(name)) are silently skipped and reported. Records the source
 * slug as provenance on the created Memory row.
 */
export async function importLibraryToMemory(
  ownerId: string,
  actorEmail: string,
  slugs: string[],
): Promise<LibraryImportResult> {
  const result: LibraryImportResult = {
    imported_count: 0,
    skipped_count: 0,
    skipped_reasons: [],
    created_memory_ids: [],
  };
  if (slugs.length === 0) return result;

  const all = await loadAll();
  const bySlug = new Map(all.map(i => [i.slug, i] as const));

  const toInsert: LibraryItem[] = [];
  for (const s of slugs) {
    const item = bySlug.get(s);
    if (!item) {
      result.skipped_count += 1;
      result.skipped_reasons.push({ slug: s, reason: "not_found" });
    } else {
      toInsert.push(item);
    }
  }

  // Dedupe against existing Memory (case-insensitive name uniqueness).
  const existing = await supabaseAdmin
    .from("nex_materials_memory")
    .select("name")
    .eq("owner_id", ownerId)
    .is("deleted_at", null);
  if (existing.error) throw new MaterialsError("internal", existing.error.message, 500);
  const existingLower = new Set(
    ((existing.data ?? []) as { name: string }[]).map(r => r.name.toLowerCase()),
  );

  const rows: Record<string, unknown>[] = [];
  for (const lib of toInsert) {
    if (existingLower.has(lib.name.toLowerCase())) {
      result.skipped_count += 1;
      result.skipped_reasons.push({ slug: lib.slug, reason: "already_in_memory" });
      continue;
    }
    const dims = lib.common_dimensions ?? {};
    rows.push({
      owner_id:                 ownerId,
      name:                     lib.name,
      category:                 libraryCategoryToMemoryCategory(lib.category),
      species_id:               lib.species_id ?? null,
      default_length_mm:        firstNumber(dims.lengths_mm),
      default_width_mm:         firstNumber(dims.widths_mm),
      default_thickness_mm:     firstNumber(dims.thicknesses_mm),
      default_unit:             lib.default_unit,
      typical_grade:            (lib.typical_grades ?? [])[0] ?? null,
      preferred_supplier_id:    null,
      typical_price_per_unit:   null,
      price_currency:           "GBP",
      notes:                    lib.notes ?? null,
      synonyms:                 lib.synonyms ?? [],
      library_slug:             lib.slug,
      created_by:               actorEmail,
    });
  }

  if (rows.length === 0) return result;

  const insRes = await supabaseAdmin
    .from("nex_materials_memory")
    .insert(rows)
    .select("id");
  if (insRes.error) throw new MaterialsError("internal", insRes.error.message, 500);
  const inserted = (insRes.data ?? []) as { id: string }[];
  result.imported_count = inserted.length;
  result.created_memory_ids = inserted.map(r => r.id);

  await audit({
    entity_type: "supplier",
    entity_id:   ownerId as unknown as string,
    event_type:  "library_imported",
    actor_kind:  "user",
    actor_ref:   actorEmail,
    metadata: {
      imported_count: result.imported_count,
      skipped_count:  result.skipped_count,
      slugs,
    },
  });

  return result;
}

function libraryCategoryToMemoryCategory(c: LibraryCategory):
  "hardwood" | "softwood" | "sheet" | "stair_part" | "consumable" | "hardware" | "finish" | "other" {
  switch (c) {
    case "hardwood":     return "hardwood";
    case "softwood":     return "softwood";
    case "sheet":        return "sheet";
    case "stair_part":   return "stair_part";
    case "flooring":     return "sheet";   // no dedicated Memory category yet
    case "moulding":     return "other";
    case "consumable":   return "consumable";
    case "hardware":     return "hardware";
    case "finish":       return "finish";
    default:             return "other";
  }
}

function firstNumber(a?: number[]): number | null {
  if (!a || a.length === 0) return null;
  const n = a[0];
  return Number.isFinite(n) ? n : null;
}

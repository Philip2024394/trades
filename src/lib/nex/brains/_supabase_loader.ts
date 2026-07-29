// src/lib/nex/brains/_supabase_loader.ts
//
// Supabase-first brain loader. Reads the current-published version of
// a brain from Supabase, hydrates a BrainPack, hands it to the pure
// loadBrain() validator, returns a LoadedBrain.
//
// Falls back to the file-pack loader when Supabase is unreachable
// (local dev without service key, CI without secrets). ADR-0037
// designates Supabase as canonical; the filesystem remains a valid
// dev-time source of truth so contributors without DB access can
// still boot the runtime.
//
// The existing pure loadBrain(pack) function in _loader.ts is
// untouched — this file layers a data source on top.

import { loadBrain, brainRegistry } from "./_loader";
import {
  brainSupabaseAvailable,
  getBrainBySlug,
  getCurrentBrainVersion,
  listBrains,
} from "./_supabase";
import type { BrainPack, LoadedBrain } from "./_types";
import type { BrainRow, BrainVersionRow } from "./_living_types";

// ---------- Types ----------

export type BrainLoadSource = "supabase" | "filesystem" | "cache";

export type BrainLoadResult = {
  brain: LoadedBrain;
  source: BrainLoadSource;
  version_id?: string;
  version_semver?: string;
  brain_row?: BrainRow;
};

// ---------- Pack hydration ----------

/**
 * Build a BrainPack from a Supabase version row. The version stores
 * the manifest + modules as JSONB, so hydration is a shape reshape
 * plus module keying.
 */
export function hydrateBrainPackFromVersion(version: BrainVersionRow): BrainPack {
  const modules = version.modules_json as Record<string, unknown>;
  return {
    manifest: version.manifest_json as BrainPack["manifest"],
    modules,
  };
}

// ---------- Loaders ----------

/**
 * Load a brain from Supabase by slug. Throws if the brain does not
 * exist, has no current_version_id, or fails schema validation.
 */
export async function loadBrainFromSupabase(slug: string): Promise<BrainLoadResult> {
  const brainRow = await getBrainBySlug(slug);
  if (!brainRow) throw new Error(`Brain '${slug}' not found in hammerex_nex_brains`);
  if (!brainRow.current_version_id) {
    throw new Error(`Brain '${slug}' has no current_version_id · not yet published`);
  }
  const versionRow = await getCurrentBrainVersion(slug);
  if (!versionRow) {
    throw new Error(
      `Brain '${slug}' current_version_id ${brainRow.current_version_id} not found in hammerex_nex_brain_versions`
    );
  }
  const pack = hydrateBrainPackFromVersion(versionRow);
  const brain = loadBrain(pack);
  return {
    brain,
    source: "supabase",
    version_id: versionRow.id,
    version_semver: versionRow.version_semver,
    brain_row: brainRow,
  };
}

/**
 * Load a brain from either Supabase (canonical) or a supplied
 * filesystem pack (dev-time fallback). Fallback triggers when
 * Supabase is unavailable OR when the brain isn't yet in Supabase.
 */
export async function loadBrainWithFallback(
  slug: string,
  fallbackPack: BrainPack | null
): Promise<BrainLoadResult> {
  if (brainSupabaseAvailable()) {
    try {
      return await loadBrainFromSupabase(slug);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      if (fallbackPack) {
        console.warn(
          `[nex/brains/loader] Supabase load failed for '${slug}' · using filesystem fallback: ${detail}`
        );
        const brain = loadBrain(fallbackPack);
        return { brain, source: "filesystem" };
      }
      throw err;
    }
  }
  if (!fallbackPack) {
    throw new Error(
      `Brain '${slug}': Supabase unavailable AND no filesystem fallback pack provided.`
    );
  }
  const brain = loadBrain(fallbackPack);
  return { brain, source: "filesystem" };
}

// ---------- Bulk warm ----------

/**
 * Load every published brain from Supabase into the in-memory
 * brainRegistry. Called at boot + on version-change events. Failures
 * on individual brains are logged and skipped so one bad brain never
 * blocks the whole runtime.
 */
export async function warmBrainRegistryFromSupabase(): Promise<{
  loaded: number;
  skipped: number;
  errors: Array<{ slug: string; detail: string }>;
}> {
  if (!brainSupabaseAvailable()) {
    return { loaded: 0, skipped: 0, errors: [] };
  }
  const rows = await listBrains({ status: "published" });
  let loaded = 0;
  let skipped = 0;
  const errors: Array<{ slug: string; detail: string }> = [];
  for (const row of rows) {
    if (!row.current_version_id) { skipped++; continue; }
    try {
      const { brain } = await loadBrainFromSupabase(row.slug);
      brainRegistry.register(brain);
      loaded++;
    } catch (err) {
      errors.push({
        slug: row.slug,
        detail: err instanceof Error ? err.message : String(err),
      });
      skipped++;
    }
  }
  return { loaded, skipped, errors };
}

/** Convenience — is Supabase the current data source? */
export function usingSupabaseCanonical(): boolean {
  return brainSupabaseAvailable();
}

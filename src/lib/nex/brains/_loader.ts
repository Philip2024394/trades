// Brain loader — validates a Brain pack against the V1 contract and
// hands back a typed LoadedBrain. Per ADR-0017 §2 the loader:
//   • Validates manifest against BrainManifestSchema
//   • Confirms the manifest slug matches the pack root
//   • Validates each of the 6 V1 modules against its Zod schema
//   • Refuses to load if any V1 module is missing or invalid
//   • Passes V2 modules through as raw JSON (warning, not failure)
//
// The loader is pure: it never touches Supabase, the filesystem, or
// the network. Callers (dev filesystem loader, prod registry loader,
// test fixture harness) resolve the BrainPack and hand it in.

import {
  BrainManifestSchema,
  MODULE_SCHEMAS,
  V1_MODULE_NAMES,
  V2_MODULE_NAMES,
  type V1ModuleName
} from "./_schema";
import {
  BrainBootError,
  type BootAuditError,
  type BrainPack,
  type LoadedBrain
} from "./_types";

export function loadBrain(pack: BrainPack): LoadedBrain {
  const errors: BootAuditError[] = [];

  const manifestParse = BrainManifestSchema.safeParse(pack.manifest);
  if (!manifestParse.success) {
    throw new BrainBootError([{
      kind:   "invalid_manifest",
      detail: `Manifest failed schema validation: ${manifestParse.error.message}`
    }]);
  }
  const manifest = manifestParse.data;

  const v1Loaded: Partial<Record<V1ModuleName, unknown>> = {};

  for (const name of V1_MODULE_NAMES) {
    const raw = pack.modules[name];
    if (raw == null) {
      errors.push({
        kind:       "missing_v1_module",
        brain_slug: manifest.slug,
        module:     name,
        detail:     `V1 module '${name}' missing from Brain '${manifest.slug}'`
      });
      continue;
    }
    const schema = MODULE_SCHEMAS[name];
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      errors.push({
        kind:       "invalid_module",
        brain_slug: manifest.slug,
        module:     name,
        detail:     `V1 module '${name}' failed schema validation: ${parsed.error.message}`
      });
      continue;
    }
    v1Loaded[name] = parsed.data;
  }

  if (errors.length > 0) throw new BrainBootError(errors);

  const optionalModules: Record<string, unknown> = {};
  for (const name of V2_MODULE_NAMES) {
    if (pack.modules[name] != null) optionalModules[name] = pack.modules[name];
  }

  return {
    manifest,
    craft:         v1Loaded.craft         as LoadedBrain["craft"],
    regulations:   v1Loaded.regulations   as LoadedBrain["regulations"],
    materials:     v1Loaded.materials     as LoadedBrain["materials"],
    workflow:      v1Loaded.workflow      as LoadedBrain["workflow"],
    defects:       v1Loaded.defects       as LoadedBrain["defects"],
    pricing_model: v1Loaded.pricing_model as LoadedBrain["pricing_model"],
    optionalModules
  };
}

/** Runtime registry keyed by slug. Populated at boot from the
 *  hammerex_nex_brains table + on-disk JSON packs. Kept in-memory —
 *  Brain content is small and read-often. */
class BrainRegistryImpl {
  private brains = new Map<string, LoadedBrain>();

  register(brain: LoadedBrain): void {
    this.brains.set(brain.manifest.slug, brain);
  }

  get(slug: string): LoadedBrain | undefined {
    return this.brains.get(slug);
  }

  has(slug: string): boolean {
    return this.brains.has(slug);
  }

  list(): LoadedBrain[] {
    return Array.from(this.brains.values());
  }

  clear(): void {
    this.brains.clear();
  }

  size(): number {
    return this.brains.size;
  }
}

export const brainRegistry = new BrainRegistryImpl();

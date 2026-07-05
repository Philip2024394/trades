// Section Registry — singleton store.
//
// Milestone 1 · Registry Kit migration:
// Composes over `createRegistry` from @/platform/registryKit. All 48
// existing section files self-register unchanged; every existing
// caller (renderer, editor, Library UI, AI features, Score engine,
// blueprint installer, generate composer) works verbatim.
//
// Facade behaviour preserved:
//   • `.list(library?)` — with optional library filter
//   • `.ids(library?)` — with optional library filter
//   • `.libraries()` — returns SectionLibrary[] with at least one section
//   • `.counts()` — returns `Record<SectionLibrary, number>` for library
//     badges. The kit's counts() returns {total, byCategory}, so the
//     facade extracts byCategory into the historic shape.

import type { Frozen, RegistrationBase } from "@/platform/registryKit";
import { createRegistry } from "@/platform/registryKit";
import type {
  AnySectionRegistration,
  SectionLibrary,
  SectionRegistration
} from "./sectionTypes";

type SectionRegistrationWithBase = AnySectionRegistration & RegistrationBase;
type FrozenSectionRegistration = Frozen<SectionRegistrationWithBase>;

const inner = createRegistry<SectionRegistrationWithBase>({
  label: "sectionRegistry",
  idFormat: "namespacedId"
});

function normalise(
  reg: AnySectionRegistration
): SectionRegistrationWithBase {
  // RegistrationBase — SectionRegistration already has id/name/
  // description/version. The RegistrationBase.category slot maps to
  // `library` (SectionLibrary is the primary index key that Studio
  // uses for the library-badge counts). Sections that also declare
  // the Slice-D `category: SectionCategory` field keep that value —
  // it's a different classification axis used elsewhere.
  return {
    ...reg,
    // Cast: RegistrationBase.category is `string`; SectionLibrary
    // is a subset of that. AnySectionRegistration also carries an
    // optional `category: SectionCategory` used by the Slice D
    // manifest — we intentionally overwrite that with library so
    // the kit's primary index groups by SectionLibrary.
    category: reg.library as string
  } as SectionRegistrationWithBase & { tags: string[] };
}

// Attach tags separately so TypeScript accepts the intersection
// widening. The kit ingests tags via RegistrationBase.tags.
function normaliseWithTags(
  reg: AnySectionRegistration
): SectionRegistrationWithBase {
  const base = normalise(reg);
  return {
    ...base,
    tags: [
      ...(reg.bestForVerticals ?? []),
      ...(reg.telemetryTags ?? [])
    ]
  };
}

export const sectionRegistry = {
  register<TConfig extends Record<string, unknown>>(
    reg: SectionRegistration<TConfig>
  ): void {
    inner.register(normaliseWithTags(reg as AnySectionRegistration));
  },

  get(id: string): FrozenSectionRegistration | undefined {
    return inner.get(id);
  },

  getOrThrow(id: string): FrozenSectionRegistration {
    return inner.getOrThrow(id);
  },

  /** All sections, or all sections in one library. */
  list(library?: SectionLibrary): FrozenSectionRegistration[] {
    if (library) return inner.listByCategory(library);
    return inner.list();
  },

  /** All libraries that have at least one registration. */
  libraries(): SectionLibrary[] {
    return inner.categories() as SectionLibrary[];
  },

  /** Ids only — lightweight enumeration. */
  ids(library?: SectionLibrary): string[] {
    return (library ? inner.listByCategory(library) : inner.list()).map(
      (r) => r.id
    );
  },

  /** True if any registration matches the id. */
  has(id: string): boolean {
    return inner.has(id);
  },

  /** How many sections exist per library. Preserves the historic
   *  `Record<SectionLibrary, number>` shape (kit returns
   *  `{total, byCategory}`; we extract byCategory). */
  counts(): Record<SectionLibrary, number> {
    return inner.counts().byCategory as Record<SectionLibrary, number>;
  },

  // ─── New surface inherited from the kit ─────────────────────────
  search: inner.search,
  describe: inner.describe,
  listByTag: inner.listByTag,
  tags: inner.tags,
  resolveAlias: inner.resolveAlias,
  selfCheck: inner.selfCheck,
  snapshot: inner.snapshot,
  size: inner.size
};

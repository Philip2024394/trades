// Section Registry — singleton store.
//
// Every section calls `sectionRegistry.register()` at module load. The
// renderer, editor, Library UI, AI features, and Score engine all read
// from this ONE registry. Zero coupling between sections; adding a new
// section is one file.
//
// Registrations are frozen once accepted — no mutation after registration
// to guarantee the renderer + editor see the same schema for the life of
// the process.

import type {
  AnySectionRegistration,
  SectionLibrary,
  SectionRegistration
} from "./sectionTypes";

class SectionRegistry {
  private registrations = new Map<string, AnySectionRegistration>();
  private byLibrary = new Map<SectionLibrary, AnySectionRegistration[]>();

  /** Register a section. Throws if id is duplicated — a duplicate id
   *  is always a bug (bundle drift, copy-paste), never intentional. */
  register<TConfig extends Record<string, unknown>>(
    reg: SectionRegistration<TConfig>
  ): void {
    if (this.registrations.has(reg.id)) {
      throw new Error(
        `sectionRegistry: duplicate registration for "${reg.id}". ` +
          `Every section id must be unique across all libraries.`
      );
    }
    const frozen = Object.freeze(reg) as AnySectionRegistration;
    this.registrations.set(reg.id, frozen);
    const bucket = this.byLibrary.get(reg.library) ?? [];
    bucket.push(frozen);
    this.byLibrary.set(reg.library, bucket);
  }

  /** Get a single registration by id. Returns undefined if not
   *  registered — the caller decides how to handle a missing section
   *  (skip render, fall back to a "section unavailable" placeholder,
   *  etc.). */
  get(id: string): AnySectionRegistration | undefined {
    return this.registrations.get(id);
  }

  /** Same as get() but throws — for code paths that treat a missing
   *  section as a fatal invariant violation. */
  getOrThrow(id: string): AnySectionRegistration {
    const r = this.registrations.get(id);
    if (!r) {
      throw new Error(
        `sectionRegistry: no section registered for id "${id}". ` +
          `Ensure @/lib/studio/sections is imported before use.`
      );
    }
    return r;
  }

  /** All sections, or all sections in one library. */
  list(library?: SectionLibrary): AnySectionRegistration[] {
    if (library) return [...(this.byLibrary.get(library) ?? [])];
    return Array.from(this.registrations.values());
  }

  /** All libraries that have at least one registration. Useful for the
   *  Library UI "which libraries are populated" navigation. */
  libraries(): SectionLibrary[] {
    return Array.from(this.byLibrary.keys());
  }

  /** Ids only — for lightweight enumeration in server contexts. */
  ids(library?: SectionLibrary): string[] {
    return this.list(library).map((r) => r.id);
  }

  /** True if any registration matches the id. */
  has(id: string): boolean {
    return this.registrations.has(id);
  }

  /** How many sections exist per library. Powers the Library UI badges. */
  counts(): Record<SectionLibrary, number> {
    const out = {} as Record<SectionLibrary, number>;
    this.byLibrary.forEach((bucket, lib) => {
      out[lib] = bucket.length;
    });
    return out;
  }
}

/** The one and only registry instance for the process. Server and
 *  client bundles each hold their own copy; because registrations are
 *  pure metadata + a component reference, both copies are identical. */
export const sectionRegistry = new SectionRegistry();

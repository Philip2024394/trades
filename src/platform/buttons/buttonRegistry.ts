// Xrated Button Studio — registry.
//
// Milestone 1 · Registry Kit migration:
// Composes over `createRegistry` from @/platform/registryKit. Every
// existing caller (20+ button variant files, ButtonLibraryBrowser,
// smart-swap engine) works verbatim.
//
// Preserved: `.require()` alias for getOrThrow, `.list({role?, category?})`
// filter shape, `.roles()`, `.counts()` with the ButtonCategory-typed
// buckets. The kit's `.list()` (no-arg) returns everything; the facade
// implements the filtered signature on top.

import type { Frozen, RegistrationBase } from "@/platform/registryKit";
import { createRegistry } from "@/platform/registryKit";
import type {
  ButtonRegistration,
  ButtonRole,
  ButtonCategory,
  FrozenButtonRegistration
} from "./types";

type ButtonRegistrationWithBase =
  ButtonRegistration<Record<string, unknown>> & RegistrationBase;
type FrozenButtonRegistrationWithBase = Frozen<ButtonRegistrationWithBase>;

const inner = createRegistry<ButtonRegistrationWithBase>({
  label: "buttonRegistry",
  idFormat: "namespacedId",
  indexes: {
    byRole: (r) => [r.role]
  }
});

function normalise(
  reg: ButtonRegistration<Record<string, unknown>>
): ButtonRegistrationWithBase {
  return {
    ...reg,
    // RegistrationBase fields (already present on ButtonRegistration).
    tags: [reg.role, ...(reg.bestForVerticals ?? [])]
  };
}

export const buttonRegistry = {
  register<TConfig extends Record<string, unknown>>(
    reg: ButtonRegistration<TConfig>
  ): void {
    inner.register(
      normalise(reg as ButtonRegistration<Record<string, unknown>>)
    );
  },
  get(id: string): FrozenButtonRegistrationWithBase | undefined {
    return inner.get(id);
  },
  require(id: string): FrozenButtonRegistrationWithBase {
    return inner.getOrThrow(id);
  },
  has(id: string): boolean {
    return inner.has(id);
  },
  list(filter?: {
    role?: ButtonRole;
    category?: ButtonCategory;
  }): FrozenButtonRegistrationWithBase[] {
    if (filter?.role) return inner.listByIndex("byRole", filter.role);
    if (filter?.category) return inner.listByCategory(filter.category);
    return inner.list();
  },
  categories(): ButtonCategory[] {
    return inner.categories() as ButtonCategory[];
  },
  roles(): ButtonRole[] {
    // Extract distinct roles from the byRole index.
    return Array.from(
      new Set(
        inner.list().map((r) => r.role)
      )
    );
  },
  counts(): { total: number; byCategory: Record<ButtonCategory, number> } {
    const inn = inner.counts();
    return {
      total: inn.total,
      byCategory: inn.byCategory as Record<ButtonCategory, number>
    };
  },
  search: inner.search,

  // ─── New surface inherited from the kit ─────────────────────────
  describe: inner.describe,
  listByTag: inner.listByTag,
  tags: inner.tags,
  resolveAlias: inner.resolveAlias,
  selfCheck: inner.selfCheck,
  snapshot: inner.snapshot
};

// Legacy type re-export.
export type { FrozenButtonRegistration };

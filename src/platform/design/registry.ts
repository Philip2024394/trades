// Xrated Design System — component registry.
//
// Milestone 1 · Registry Kit migration:
// Composes over `createRegistry` from @/platform/registryKit.
// Every existing caller (design component registrations across
// /components/*, /api/platform/design/[id], /api/platform/design/list)
// works verbatim.
//
// Preserved: the domain-specific describe() output (editableProps,
// themeTokensUsed, animations facts) piped through
// describeRegistration()'s extraFacts option. The id-prefix-matches-
// category invariant is preserved as a validate() hook.

import type { Frozen, RegistrationBase } from "@/platform/registryKit";
import { createRegistry, describeRegistration } from "@/platform/registryKit";
import type {
  AnyDesignComponentRegistration,
  DesignComponentCategory,
  DesignComponentRegistration,
  FrozenDesignComponent
} from "./types";

type DesignRegistration = AnyDesignComponentRegistration & RegistrationBase;
type FrozenDesignRegistration = Frozen<DesignRegistration>;

const inner = createRegistry<DesignRegistration>({
  label: "designSystemRegistry",
  idFormat: "namespacedId",
  validate: (reg) => {
    const [prefix] = reg.id.split(".");
    if (prefix !== reg.category) {
      throw new Error(
        `id prefix "${prefix}" does not match category "${reg.category}" on "${reg.id}".`
      );
    }
    if (!reg.editableProps || !Array.isArray(reg.editableProps)) {
      throw new Error(`"${reg.id}" missing editableProps[].`);
    }
    if (!reg.themeTokensUsed || !Array.isArray(reg.themeTokensUsed)) {
      throw new Error(`"${reg.id}" missing themeTokensUsed[].`);
    }
    // Amendment 6 §RGP-7: containers must declare tier.
    if (reg.category === "containers" && !reg.tier) {
      throw new Error(
        `container "${reg.id}" missing required tier — declare "layout" | "content" | "utility".`
      );
    }
  }
});

function normalise(reg: AnyDesignComponentRegistration): DesignRegistration {
  return {
    ...reg,
    tags: [reg.contentShape, ...(reg.compatibleLayouts ?? [])]
  };
}

/** Preserve the previous domain-specific describe() output by hooking
 *  the kit's describeRegistration() with extraFacts. */
function designExtraFacts(reg: Frozen<DesignRegistration>): string[] {
  const editable = reg.editableProps
    .map((p) => `${p.key} (${p.type.kind})`)
    .join(", ");
  return [
    `Content shape: ${reg.contentShape}.`,
    `Editable props: ${editable || "none"}.`,
    `Theme tokens: ${reg.themeTokensUsed.join(", ") || "none"}.`,
    `Animations: ${reg.animations.join(", ") || "none"}.`
  ];
}

export const designSystemRegistry = {
  register<
    TProps extends Record<string, unknown>,
    TContent extends Record<string, unknown>
  >(
    reg: DesignComponentRegistration<TProps, TContent>
  ): FrozenDesignRegistration {
    return inner.register(
      normalise(reg as unknown as AnyDesignComponentRegistration)
    );
  },
  get(id: string): FrozenDesignRegistration | undefined {
    return inner.get(id);
  },
  getOrThrow(id: string): FrozenDesignRegistration {
    return inner.getOrThrow(id);
  },
  has(id: string): boolean {
    return inner.has(id);
  },
  list(): FrozenDesignRegistration[] {
    return inner.list();
  },
  listByCategory(
    category: DesignComponentCategory
  ): FrozenDesignRegistration[] {
    return inner.listByCategory(category);
  },
  categories(): DesignComponentCategory[] {
    return inner.categories() as DesignComponentCategory[];
  },
  size(): number {
    return inner.size();
  },
  search: inner.search,

  /** AI-consumable describe with design-specific facts appended. */
  describe(id: string): string {
    const reg = inner.get(id);
    if (!reg) return `${id}: not registered.`;
    return describeRegistration<DesignRegistration>(reg, designExtraFacts);
  },

  // ─── New surface inherited from the kit ─────────────────────────
  listByTag: inner.listByTag,
  tags: inner.tags,
  counts: inner.counts,
  resolveAlias: inner.resolveAlias,
  selfCheck: inner.selfCheck,
  snapshot: inner.snapshot
};

// Legacy type re-export.
export type { FrozenDesignComponent };
/** Legacy type — the shape of the registry facade. Callers that used
 *  `import type { DesignSystemRegistry }` get the facade's interface. */
export type DesignSystemRegistry = typeof designSystemRegistry;

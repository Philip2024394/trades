// Design Token Registry — composed over registryKit.
//
// Every token set (theme's worth of tokens) registers here. Consumers
// resolve individual tokens via `resolveToken(setId, path)` — which
// falls back through brand overrides to platform defaults.
//
// Constitution v1: this is the backbone of the Design System. Every
// component consumes tokens through this registry rather than reading
// hard-coded values.

import type { Frozen, RegistrationBase } from "@/platform/registryKit";
import { createRegistry } from "@/platform/registryKit";
import type { DesignToken, DesignTokenSet, TokenCategory } from "./types";

type TokenSetRegistration = DesignTokenSet & RegistrationBase;
type FrozenTokenSetRegistration = Frozen<TokenSetRegistration>;

const inner = createRegistry<TokenSetRegistration>({
  label: "designTokenRegistry",
  idFormat: "slug",
  validate: (set) => {
    if (!Array.isArray(set.tokens) || set.tokens.length === 0) {
      throw new Error(`Token set "${set.id}" must include at least one token.`);
    }
    const seen = new Set<string>();
    for (const t of set.tokens) {
      if (seen.has(t.path)) {
        throw new Error(
          `Token set "${set.id}" defines duplicate token "${t.path}".`
        );
      }
      seen.add(t.path);
    }
  }
});

function normalise(set: DesignTokenSet): TokenSetRegistration {
  return {
    ...set,
    category: "token-set",
    tags: Array.from(new Set(set.tokens.map((t) => t.category))),
    searchKeywords: [set.description, ...set.tokens.map((t) => t.path)]
  };
}

/** Resolve a token by path against a token set. Returns the raw value
 *  or `undefined` if not defined. */
export function resolveToken(
  setId: string,
  path: string
): string | number | undefined {
  const set = inner.get(setId);
  if (!set) return undefined;
  return set.tokens.find((t) => t.path === path)?.value;
}

/** Every token from a set matching a category. */
export function tokensByCategory(
  setId: string,
  category: TokenCategory
): readonly DesignToken[] {
  const set = inner.get(setId);
  if (!set) return [];
  return set.tokens.filter((t) => t.category === category);
}

export const designTokenRegistry = {
  register(set: DesignTokenSet): FrozenTokenSetRegistration {
    return inner.register(normalise(set));
  },
  get(id: string): FrozenTokenSetRegistration | undefined {
    return inner.get(id);
  },
  getOrThrow(id: string): FrozenTokenSetRegistration {
    return inner.getOrThrow(id);
  },
  has(id: string): boolean {
    return inner.has(id);
  },
  list(): FrozenTokenSetRegistration[] {
    return inner.list();
  },
  size(): number {
    return inner.size();
  },
  search: inner.search,
  describe: inner.describe,
  listByTag: inner.listByTag,
  tags: inner.tags,
  counts: inner.counts,
  resolveAlias: inner.resolveAlias,
  selfCheck: inner.selfCheck,
  snapshot: inner.snapshot
};

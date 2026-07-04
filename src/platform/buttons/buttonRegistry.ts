// Xrated Button Studio — registry.
//
// One global registry every button variant self-registers into via a
// side-effect at import time. Callers reach for the registry through
// `buttonRegistry` — never import individual variant files.
//
// Mirrors the shape of `sectionRegistry`. Adding a new button is one
// file (types + renderer + `buttonRegistry.register(...)`).

import type {
  ButtonRegistration,
  ButtonRole,
  ButtonCategory,
  FrozenButtonRegistration
} from "./types";

class ButtonRegistry {
  private byId = new Map<string, FrozenButtonRegistration>();
  private byRole = new Map<ButtonRole, FrozenButtonRegistration[]>();
  private byCategory = new Map<ButtonCategory, FrozenButtonRegistration[]>();

  register<TConfig extends Record<string, unknown>>(
    reg: ButtonRegistration<TConfig>
  ): void {
    if (this.byId.has(reg.id)) {
      throw new Error(
        `Button "${reg.id}" is already registered. Every id must be unique across the platform.`
      );
    }
    const frozen = Object.freeze({ ...reg }) as FrozenButtonRegistration;
    this.byId.set(reg.id, frozen);
    const roleBucket = this.byRole.get(reg.role) ?? [];
    roleBucket.push(frozen);
    this.byRole.set(reg.role, roleBucket);
    const categoryBucket = this.byCategory.get(reg.category) ?? [];
    categoryBucket.push(frozen);
    this.byCategory.set(reg.category, categoryBucket);
  }

  get(id: string): FrozenButtonRegistration | undefined {
    return this.byId.get(id);
  }

  require(id: string): FrozenButtonRegistration {
    const r = this.byId.get(id);
    if (!r) {
      throw new Error(
        `Button "${id}" not found in registry. Ensure @/platform/buttons is imported before use.`
      );
    }
    return r;
  }

  list(filter?: {
    role?: ButtonRole;
    category?: ButtonCategory;
  }): FrozenButtonRegistration[] {
    if (filter?.role) return [...(this.byRole.get(filter.role) ?? [])];
    if (filter?.category) return [...(this.byCategory.get(filter.category) ?? [])];
    return Array.from(this.byId.values());
  }

  categories(): ButtonCategory[] {
    return Array.from(this.byCategory.keys());
  }

  roles(): ButtonRole[] {
    return Array.from(this.byRole.keys());
  }

  counts(): { total: number; byCategory: Record<ButtonCategory, number> } {
    const byCategory = {} as Record<ButtonCategory, number>;
    for (const [cat, bucket] of this.byCategory) {
      byCategory[cat] = bucket.length;
    }
    return { total: this.byId.size, byCategory };
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  /** Weight-based text search across name + description + keywords +
   *  role + category. Sorted by score, capped by `limit`. */
  search(query: string, limit = 50): FrozenButtonRegistration[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.list().slice(0, limit);
    const scored = this.list().map((r) => {
      let score = 0;
      const hay = `${r.name} ${r.description} ${r.shortPitch}`.toLowerCase();
      if (r.id.toLowerCase() === q) score += 100;
      if (hay.includes(q)) score += 10;
      if (r.role.includes(q)) score += 5;
      if (r.category.includes(q)) score += 3;
      for (const k of r.searchKeywords) if (k.toLowerCase().includes(q)) score += 2;
      return { r, score };
    });
    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.r);
  }
}

export const buttonRegistry = new ButtonRegistry();

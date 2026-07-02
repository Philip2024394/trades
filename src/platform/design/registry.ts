// Xrated Design System — component registry.
//
// The single-process index of every registered visual component.
// Studio, Apps, AI, and preview surfaces all read from here.
//
// Mirrors the discipline of appRegistry + packRegistry:
//   • components self-register at module load
//   • duplicate ids throw
//   • frozen on registration to prevent post-hoc mutation

import type {
  AnyDesignComponentRegistration,
  DesignComponentCategory,
  DesignComponentRegistration,
  FrozenDesignComponent
} from "./types";

const ID_RE = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_-]*$/;
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

class DesignSystemRegistry {
  private registrations = new Map<string, FrozenDesignComponent>();
  private byCategory = new Map<
    DesignComponentCategory,
    FrozenDesignComponent[]
  >();

  register<
    TProps extends Record<string, unknown>,
    TContent extends Record<string, unknown>
  >(
    reg: DesignComponentRegistration<TProps, TContent>
  ): FrozenDesignComponent {
    validate(reg as AnyDesignComponentRegistration);
    if (this.registrations.has(reg.id)) {
      throw new Error(
        `DesignSystemRegistry: duplicate id "${reg.id}". Every component id must be unique across the whole platform.`
      );
    }
    const frozen = deepFreeze(reg) as FrozenDesignComponent;
    this.registrations.set(reg.id, frozen);
    const bucket = this.byCategory.get(reg.category) ?? [];
    bucket.push(frozen);
    this.byCategory.set(reg.category, bucket);
    return frozen;
  }

  get(id: string): FrozenDesignComponent | undefined {
    return this.registrations.get(id);
  }

  getOrThrow(id: string): FrozenDesignComponent {
    const r = this.registrations.get(id);
    if (!r) {
      throw new Error(
        `DesignSystemRegistry: no component registered for "${id}". Ensure @/platform/design/components is imported.`
      );
    }
    return r;
  }

  has(id: string): boolean {
    return this.registrations.has(id);
  }

  list(): FrozenDesignComponent[] {
    return Array.from(this.registrations.values());
  }

  listByCategory(
    category: DesignComponentCategory
  ): FrozenDesignComponent[] {
    return [...(this.byCategory.get(category) ?? [])];
  }

  /** Categories that currently have at least one registered component.
   *  Powers picker UIs that grow as new categories light up. */
  categories(): DesignComponentCategory[] {
    return Array.from(this.byCategory.keys());
  }

  /** Ranked keyword search. Prioritises exact id/name matches; falls
   *  through to keyword + description matches. Returns highest first.
   *
   *  Used by AI to find "the button" without having to know every id. */
  search(query: string, limit = 20): FrozenDesignComponent[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.list().slice(0, limit);
    const words = q.split(/\s+/);

    const scored: { reg: FrozenDesignComponent; score: number }[] = [];
    for (const reg of this.registrations.values()) {
      let score = 0;
      const hay = [
        reg.id,
        reg.name.toLowerCase(),
        reg.description.toLowerCase(),
        ...reg.searchKeywords.map((k) => k.toLowerCase()),
        reg.category
      ].join(" ");
      for (const w of words) {
        if (reg.id.includes(w)) score += 8;
        if (reg.name.toLowerCase().includes(w)) score += 6;
        if (reg.searchKeywords.some((k) => k.toLowerCase() === w))
          score += 5;
        if (reg.searchKeywords.some((k) => k.toLowerCase().includes(w)))
          score += 3;
        if (reg.description.toLowerCase().includes(w)) score += 2;
        if (hay.includes(w)) score += 1;
      }
      if (score > 0) scored.push({ reg, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.reg);
  }

  /** Structured description an AI can reason over — no HTML, no styling
   *  — pure facts about the component. Used by the AI SDK to build
   *  natural-language capability lists. */
  describe(id: string): string {
    const r = this.registrations.get(id);
    if (!r) return `${id}: not registered.`;
    const editable = r.editableProps
      .map((p) => `${p.key} (${p.type.kind})`)
      .join(", ");
    return [
      `${r.name} (${r.id}) — ${r.description}`,
      `Category: ${r.category}. Content shape: ${r.contentShape}.`,
      `Editable props: ${editable || "none"}.`,
      `Theme tokens: ${r.themeTokensUsed.join(", ") || "none"}.`,
      `Animations: ${r.animations.join(", ") || "none"}.`,
      `Keywords: ${r.searchKeywords.join(", ") || "none"}.`
    ].join(" ");
  }

  size(): number {
    return this.registrations.size;
  }
}

// ─── Validation ────────────────────────────────────────────────

function validate(reg: AnyDesignComponentRegistration): void {
  if (!ID_RE.test(reg.id)) {
    throw new Error(
      `DesignSystemRegistry: invalid id "${reg.id}". Must be "<category>.<name>" with kebab-case name.`
    );
  }
  const [category] = reg.id.split(".");
  if (category !== reg.category) {
    throw new Error(
      `DesignSystemRegistry: id prefix "${category}" does not match category "${reg.category}" on registration "${reg.id}".`
    );
  }
  if (!SEMVER_RE.test(reg.version)) {
    throw new Error(
      `DesignSystemRegistry: invalid semver "${reg.version}" for "${reg.id}".`
    );
  }
  if (!reg.name || !reg.description) {
    throw new Error(
      `DesignSystemRegistry: "${reg.id}" missing name or description.`
    );
  }
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const anyValue = value as unknown as Record<string, unknown>;
  for (const key of Object.keys(anyValue)) {
    deepFreeze(anyValue[key]);
  }
  return Object.freeze(value);
}

// ─── Singleton ─────────────────────────────────────────────────

export const designSystemRegistry = new DesignSystemRegistry();
export type { DesignSystemRegistry };

// Theme Engine v1 — legacy facade over @/platform/themes/themeRegistry.
//
// Preserves the historical shape (ThemePreset, ThemePresetId,
// THEME_PRESETS, THEME_PRESET_LIST, suggestThemeForTrade) for
// existing consumers. All theme state lives in themeRegistry after
// ADR-014. New code should import from `@/platform/themes` directly.

import { themeRegistry } from "@/platform/themes";
import type { ThemeManifest, ThemePresetId } from "@/platform/themes";

// Legacy type re-exports.
export type { ThemePresetId };
export type ThemePreset = {
  id: ThemePresetId;
  name: string;
  description: string;
  bestForVerticals: string[];
  vars: ThemeManifest["vars"];
  motion: ThemeManifest["motion"];
};

/** Convert a registry manifest into the legacy ThemePreset shape. */
function toPreset(m: ThemeManifest): ThemePreset {
  return {
    id: m.slug,
    name: m.name,
    description: m.description,
    bestForVerticals: [...m.bestForVerticals],
    vars: m.vars,
    motion: m.motion
  };
}

/** Snapshot map from the registry — regenerated on each access.
 *  Cheap: 6 entries. */
function readPresets(): Record<ThemePresetId, ThemePreset> {
  const out = {} as Record<ThemePresetId, ThemePreset>;
  for (const reg of themeRegistry.list()) {
    out[reg.slug] = toPreset(reg);
  }
  return out;
}

/** Compatibility export — a lazy Proxy so any late registrations
 *  (e.g. third-party themes) are visible through the same handle. */
export const THEME_PRESETS = new Proxy(
  {} as Record<ThemePresetId, ThemePreset>,
  {
    get(_target, slug: string | symbol) {
      if (typeof slug !== "string") return undefined;
      const reg = themeRegistry.get(slug);
      return reg ? toPreset(reg) : undefined;
    },
    ownKeys() {
      return themeRegistry.list().map((r) => r.slug);
    },
    has(_target, slug: string | symbol) {
      return typeof slug === "string" && themeRegistry.has(slug);
    },
    getOwnPropertyDescriptor(_target, slug: string | symbol) {
      if (typeof slug !== "string" || !themeRegistry.has(slug)) return undefined;
      return { enumerable: true, configurable: true, writable: false };
    }
  }
);

/** Compatibility export — array snapshot. Regenerated per access. */
export const THEME_PRESET_LIST: readonly ThemePreset[] = new Proxy(
  [] as ThemePreset[],
  {
    get(_target, prop) {
      const list = themeRegistry.list().map(toPreset);
      if (prop === "length") return list.length;
      if (typeof prop === "string" && /^\d+$/.test(prop)) {
        return list[Number(prop)];
      }
      const value = (list as unknown as Record<string | symbol, unknown>)[
        prop as string
      ];
      if (typeof value === "function") {
        return (value as (...args: unknown[]) => unknown).bind(list);
      }
      return value;
    }
  }
) as readonly ThemePreset[];

// (readPresets kept internal — no export needed; the Proxy above
// gives callers a live-view shape.)
void readPresets;

/** Pick the best-fit theme for a trade slug. Falls back to Modern. */
export function suggestThemeForTrade(tradeSlug: string): ThemePresetId {
  return themeRegistry.rank(tradeSlug);
}

// NEX App Builder · Blueprint → existing-pipeline adapter (Philip 2026-08-14).
//
// Phase 6 · the single new piece needed to make the existing multi-page
// assembler consume an AppBlueprint's per-page section list, rather than
// the hardcoded PAGE_LIBRARY_MAP.
//
// This is a THIN TRANSLATOR — no new rendering, no new registry, no new
// pipeline. It walks bp.pages[].sections[] and:
//   1. Resolves each SectionInstance.registryId against sectionRegistry
//   2. Falls back to first-in-library when registryId is a conceptual
//      alias (e.g. "hero/photo-full" → first hero section)
//   3. Merges the section's defaultConfig() with the Blueprint's props
//   4. Emits StudioLayoutJson per page — same shape studio_layouts stores
//
// Nothing else in the pipeline changes. The output is the same shape as
// assemblePipelineLayouts(), so downstream (publish, live preview, editor
// shell) works verbatim.

// Note: pure data transformation. No runtime side effects. Safe on server
// or client — but sectionRegistry is populated by module-level self-
// registration inside `src/lib/studio/sections/*.tsx`, so callers should
// have imported `@/lib/studio/sections` at least once before calling the
// assembler (the pipeline route does this at top of file).
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import type { StudioLayoutJson } from "@/lib/studio/schema";
import type {
  AppBlueprint,
  PageSpec,
  SectionInstance as BpSectionInstance
} from "./blueprint-schema";

// ============================================================================
// Public API
// ============================================================================

export type BlueprintAssemblyResult = {
  /** Per-page id → StudioLayoutJson. Same shape publish-pipeline consumes. */
  pages: Record<string, StudioLayoutJson>;
  /** Sections that couldn't be resolved (surfaced so Studio can flag). */
  unresolved: Array<{
    pageId: string;
    instanceId: string;
    requestedRegistryId: string;
    reason: "no-alias-and-no-library-match" | "empty-library" | "registry-lookup-failed";
  }>;
  /** Per-section resolution log (Studio + tests use for evidence). */
  resolutions: Array<{
    pageId: string;
    instanceId: string;
    requestedRegistryId: string;
    resolvedRegistryId: string;
    strategy: "exact" | "alias" | "library-fallback";
  }>;
};

export function assembleFromBlueprint(bp: AppBlueprint): BlueprintAssemblyResult {
  const result: BlueprintAssemblyResult = {
    pages: {},
    unresolved: [],
    resolutions: []
  };

  for (const page of bp.pages) {
    const layout = assembleOnePage(page, result);
    if (layout && layout.sections.length > 0) {
      result.pages[page.id] = layout;
    }
  }

  return result;
}

// ============================================================================
// Per-page assembly
// ============================================================================

function assembleOnePage(page: PageSpec, out: BlueprintAssemblyResult): StudioLayoutJson | null {
  const sections: StudioLayoutJson["sections"] = [];
  const rows: StudioLayoutJson["rows"] = [];

  for (const inst of page.sections) {
    const resolved = resolveRegistryId(inst.registryId);
    if (!resolved) {
      out.unresolved.push({
        pageId: page.id,
        instanceId: inst.instanceId,
        requestedRegistryId: inst.registryId,
        reason: "no-alias-and-no-library-match"
      });
      continue;
    }

    const reg = sectionRegistry.get(resolved.registryId);
    if (!reg) {
      // Should not happen — resolveRegistryId already checked, but be defensive
      out.unresolved.push({
        pageId: page.id,
        instanceId: inst.instanceId,
        requestedRegistryId: inst.registryId,
        reason: "registry-lookup-failed"
      });
      continue;
    }

    const defaults = safeDefaults(reg);
    const config: Record<string, unknown> = {
      ...defaults,
      ...inst.props
    };

    // Bindings on the section — data source, actions — are stored as
    // config fields so downstream renderers can consume them without a
    // schema change. This keeps the pipeline oblivious to the App Builder
    // extensions while still round-tripping them.
    if (inst.data) config.__nex_data = inst.data;
    if (inst.actions && inst.actions.length > 0) config.__nex_actions = inst.actions;
    if (inst.responsive) config.__nex_responsive = inst.responsive;
    if (inst.states) config.__nex_states = inst.states;

    sections.push({
      instanceId: inst.instanceId,   // stable across regenerations (Blueprint gives us this)
      key: resolved.registryId,
      config
    });

    rows.push({
      id: `row_${inst.instanceId}`,
      columns: [inst.instanceId]
    });

    out.resolutions.push({
      pageId: page.id,
      instanceId: inst.instanceId,
      requestedRegistryId: inst.registryId,
      resolvedRegistryId: resolved.registryId,
      strategy: resolved.strategy
    });
  }

  if (sections.length === 0) return null;
  return { sections, rows };
}

// ============================================================================
// Registry-id resolution
// ============================================================================

type Resolution = {
  registryId: string;
  strategy: "exact" | "alias" | "library-fallback";
};

// Conceptual-id → real-registered-id aliases.
// Blueprint may use readable ids like "hero/photo-full" · this map lets
// NEX generate a Blueprint without knowing every exact registry id.
// When adding here, verify the target id exists via
// `grep -rhE "id:\s*['\"][a-z_]+\.[a-z0-9_]+['\"]" src/lib/studio/sections/`.
const REGISTRY_ALIASES: Record<string, string> = {
  "hero/photo-full":        "hero.split_photo_left_1",
  "hero/simple-heading":    "hero.minimal_centred_1",
  "hero/product-showroom":  "hero.product_showroom_1",
  "hero/magazine":          "hero.magazine_editorial_1",
  "hero/trust":             "hero.trust_minimal_1",
  "gallery/grid":           "gallery.grid_1",
  "gallery/masonry":        "gallery.grid_1",           // fallback: no masonry variant yet
  "product_grid/classic3col": "product_grid.classic_3col_1",
  "product/detail-hero":    "hero.product_showroom_1",  // closest match — product-detail hero doesn't exist yet
  "services/grid":          "services.list_1",
  "contact/split":          "contact.split_1",
  "cta/split-cta":          "cta.centred_1",
  "cta/centred":            "cta.centred_1",
  "cta/compact":            "cta.compact_band_1",
  "map/service-radius":     "map.embed_1",              // fallback: no radius overlay yet
  "map/embed":              "map.embed_1",
  "team/grid":              "team.cards_1",
  "faq/accordion":          "faq.accordion_1",
  "testimonials/grid":      "testimonials.card_grid_1",
  "footer/minimal":         "footer.minimal_1",
  "features/icon-grid":     "features.icon_grid_1",
  "features/three-up":      "features.three_up_reasons_1",
  "pricing/three-tier":     "pricing.three_tier_1",
  "trust-bar/icons":        "trust_bar.icon_row_1",
  "banner/ribbon":          "banner.ribbon_1",
  "statistics/band":        "statistics.band_1",
  "newsletter/inline":      "newsletter.inline_1",
  "video/embed":            "video.embed_1",
  "content/prose":          "cta.centred_1"             // fallback: no plain-prose section yet · uses CTA as content block
};

export function resolveRegistryId(requestedId: string): Resolution | null {
  // 1. Exact match
  if (sectionRegistry.has(requestedId)) {
    return { registryId: requestedId, strategy: "exact" };
  }

  // 2. Alias
  const aliased = REGISTRY_ALIASES[requestedId];
  if (aliased && sectionRegistry.has(aliased)) {
    return { registryId: aliased, strategy: "alias" };
  }

  // 3. Library-fallback — parse the library from the id ("hero/foo" → "hero" · "hero.foo_1" → "hero")
  const library = parseLibrary(requestedId);
  if (library) {
    const list = sectionRegistry.list(library as never);
    if (list.length > 0) {
      return { registryId: list[0].id, strategy: "library-fallback" };
    }
  }

  return null;
}

function parseLibrary(registryId: string): string | null {
  const slash = registryId.indexOf("/");
  if (slash > 0) return registryId.slice(0, slash);
  const dot = registryId.indexOf(".");
  if (dot > 0) return registryId.slice(0, dot);
  return null;
}

function safeDefaults(reg: unknown): Record<string, unknown> {
  const r = reg as { defaultConfig?: () => Record<string, unknown> };
  if (r && typeof r.defaultConfig === "function") {
    try {
      return r.defaultConfig();
    } catch {
      return {};
    }
  }
  return {};
}

// composerRegistry — the specialist pattern for the AI Creative Director.
//
// Each composer is a specialist that takes a CreativeBrief and produces
// ContentBlocks of specific kinds. Multiple composers may register for
// the same block kind (template + LLM implementations); the director
// picks by `preferredBackend` and the merchant's plan.
//
// This is the extension point for future LLM-backed generators —
// they register against the same specialist slugs, so switching
// backends is a config change, not a code change.

import type {
  Frozen,
  RegistrationBase,
  RegistryMetadata
} from "@/platform/registryKit";
import { createRegistry } from "@/platform/registryKit";
import type {
  ContentBlock,
  ContentBlockKind,
  CreativeBrief,
  OutputMedium
} from "./types";

export const REGISTRY_METADATA: RegistryMetadata = {
  owner: "Platform Engineering",
  purpose:
    "Content composer specialists (Copy, Project Story, SEO, Brand Voice). Consumed by CreativeDirector. LLM backends register as alternative implementations of the same specialist slug.",
  lifecycle: "beta",
  sinceVersion: "1.0.0",
  constitutionRefs: ["Amendment 7"],
  adrRefs: ["ADR-029"],
  pmmImpact: "Business OS · Layer 15 (AI Composition Engine v2)",
  relationships: {
    businessOsLayer: 15,
    upstreamDependencies: [
      "playbookRegistry",
      "tradeIntelligenceRegistry",
      "patternRegistry",
      "evidenceRegistry"
    ],
    downstreamDependents: [],
    composition: "leaf",
    pluginCompatible: true
  }
};

export type ComposerBackend = "template" | "llm" | "hybrid";

export type ComposerManifest = {
  manifestVersion: 1;
  slug: string;                                    // "copy", "project-story", "seo", "brand-voice"
  name: string;
  description: string;
  version: string;

  /** Which block kinds this composer produces. */
  supportedBlockKinds: readonly ContentBlockKind[];

  /** Which output media this composer supports. */
  supportedOutputMedia: readonly OutputMedium[];

  /** Backend used — drives ordering + auditability. */
  backend: ComposerBackend;

  /** Composer implementation. Returns blocks (may be async when LLM). */
  compose: (
    brief: CreativeBrief,
    /** Optional context injected by the director — e.g. output of the
     *  brand-voice composer for the copy composer to consume. */
    ctx?: Record<string, unknown>
  ) => ContentBlock[] | Promise<ContentBlock[]>;

  publisher?: {
    name: string;
    verified: boolean;
    contactUrl?: string;
  };
};

export type FrozenComposerManifest = Readonly<ComposerManifest>;

type ComposerRegistration = ComposerManifest & RegistrationBase;
type FrozenComposerRegistration = Frozen<ComposerRegistration>;

const inner = createRegistry<ComposerRegistration>({
  label: "composerRegistry",
  idFormat: "slug",
  validate: (m) => {
    if (m.manifestVersion !== 1)
      throw new Error(`unsupported manifestVersion for composer "${m.slug}".`);
    if (!m.supportedBlockKinds?.length)
      throw new Error(`composer "${m.slug}" must declare supportedBlockKinds.`);
    if (!m.supportedOutputMedia?.length)
      throw new Error(`composer "${m.slug}" must declare supportedOutputMedia.`);
    if (typeof m.compose !== "function")
      throw new Error(`composer "${m.slug}" must supply a compose function.`);
  },
  indexes: {
    byBlockKind: (m) => m.supportedBlockKinds,
    byOutputMedium: (m) => m.supportedOutputMedia,
    byBackend: (m) => [m.backend]
  }
});

function normalise(m: ComposerManifest): ComposerRegistration {
  return {
    ...m,
    id: m.slug,
    category: m.backend,
    tags: [m.backend, ...m.supportedBlockKinds, ...m.supportedOutputMedia],
    searchKeywords: [m.name, m.description],
    author: m.publisher?.name ?? "Xrated Trades Platform"
  };
}

export const composerRegistry = {
  register(m: ComposerManifest): FrozenComposerRegistration {
    return inner.register(normalise(m));
  },
  get(slug: string) {
    return inner.get(slug);
  },
  getOrThrow(slug: string) {
    return inner.getOrThrow(slug);
  },
  has(slug: string) {
    return inner.has(slug);
  },
  list() {
    return inner.list();
  },
  listByBlockKind(kind: ContentBlockKind) {
    return inner.listByIndex("byBlockKind", kind);
  },
  listByOutputMedium(medium: OutputMedium) {
    return inner.listByIndex("byOutputMedium", medium);
  },
  listByBackend(backend: ComposerBackend) {
    return inner.listByIndex("byBackend", backend);
  },
  listByCategory: inner.listByCategory,
  listByTag: inner.listByTag,
  size() {
    return inner.size();
  },
  search: inner.search,
  describe: inner.describe,
  categories: inner.categories,
  tags: inner.tags,
  counts: inner.counts,
  resolveAlias: inner.resolveAlias,
  selfCheck: inner.selfCheck,
  snapshot: inner.snapshot,
  relationships() {
    return REGISTRY_METADATA.relationships;
  }
};

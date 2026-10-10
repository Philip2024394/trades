// src/lib/nex/create-banners/capability-contract.ts
//
// NEX Create Banners · Capability contract · Founder Authorisation A · 2026-09-23
// =================================================================================
// The NEX-owned capability boundary between the Create Banners product and
// whatever generation engine is plugged in.
//
// Layer stack (§9 of Authorisation A):
//   VisualGenerationCapability
//        ↓
//   GenerationEngineProvider (registered under NEX capability runtime)
//        ↓
//   GenerationEngineAdapter (thin, engine-specific — see dedicated binding file)
//
// The adapter must NEVER leak engine-specific details upward. Consumers of
// the capability see only engine-agnostic types.

import type {
  BannerGenerationRequest,
  GenerationResult,
} from "./types";
import type { QualityStatus } from "./quality-status";

/**
 * Public product-facing capability. Every Create Banners consumer talks to
 * this — never to a specific engine.
 */
export interface VisualGenerationCapability {
  readonly capability_slug: "nex.create_banners.visual_generation";
  readonly reports_quality_status: () => QualityStatus;
  generate(
    request: BannerGenerationRequest
  ): Promise<GenerationResult>;
}

/**
 * A registered engine provider. Each provider wraps one engine adapter.
 * NEX can have multiple providers registered simultaneously — the
 * capability runtime picks one based on execution-policy metadata.
 */
export interface GenerationEngineProvider {
  readonly provider_slug: string; // e.g. "nex-visual-engine-primary"
  readonly display_name: string;
  readonly quality_status: QualityStatus;
  readonly adapter: GenerationEngineAdapter;
}

/**
 * The thin engine-specific adapter. Signatures are engine-agnostic even
 * though implementations may translate to engine-specific runtimes.
 *
 * NEX ships one local-engine binding at Authorisation A time (see the
 * dedicated binding file for the current engine). Any future engine
 * (NEX-owned visual model · another local/open model) implements this
 * same interface without any change to the product layer.
 */
export interface GenerationEngineAdapter {
  readonly engine_slug: string;
  readonly adapter_version: string;
  readonly is_local_only: true; // all NEX-approved adapters are local-only
  runAdapter(
    request: BannerGenerationRequest
  ): Promise<GenerationResult>;
}

/**
 * Registry of generation engine providers. Kept simple at Authorisation A
 * time — a real orchestrator layer chooses a provider per request based
 * on quality-status rules.
 */
export interface GenerationEngineRegistry {
  register(provider: GenerationEngineProvider): void;
  get(providerSlug: string): GenerationEngineProvider | null;
  list(): readonly GenerationEngineProvider[];
  pickForRequest(
    request: BannerGenerationRequest
  ): GenerationEngineProvider | null;
}

/**
 * Default in-memory registry. Zero side effects on import.
 */
export class InMemoryGenerationEngineRegistry
  implements GenerationEngineRegistry
{
  private readonly providers = new Map<string, GenerationEngineProvider>();

  register(provider: GenerationEngineProvider): void {
    if (this.providers.has(provider.provider_slug)) {
      throw new Error(
        `Provider already registered: ${provider.provider_slug}`
      );
    }
    this.providers.set(provider.provider_slug, provider);
  }

  get(providerSlug: string): GenerationEngineProvider | null {
    return this.providers.get(providerSlug) ?? null;
  }

  list(): readonly GenerationEngineProvider[] {
    return Array.from(this.providers.values());
  }

  pickForRequest(
    _request: BannerGenerationRequest
  ): GenerationEngineProvider | null {
    // Deterministic pick: first registered provider. A future execution
    // policy can select based on request format / quality status / seed.
    const all = this.list();
    return all.length > 0 ? all[0] ?? null : null;
  }
}

// Doctrine locks
export const _CAPABILITY_CONTRACT_IS_ENGINE_AGNOSTIC = true as const;
export const _CAPABILITY_CONTRACT_NEVER_NAMES_ANY_ENGINE = true as const;
export const _CAPABILITY_CONTRACT_ALL_ADAPTERS_MUST_BE_LOCAL_ONLY =
  true as const;

// AI Gateway — provider router + singleton.
//
// Zero preferred provider. Adapters register themselves at module load;
// the gateway picks per-request based on task support, current health,
// and budget hints. Module 0.7 ships with an empty registry — every
// request short-circuits to { ok: false, error: { code: "no-provider" } }
// so downstream code can build against the response shape today.
//
// Adding a provider is one file (Module 14+): implement AiProvider,
// call aiGateway.register(...) at import time.

import type {
  AiCompleteRequest,
  AiCompleteResponse,
  AiProvider
} from "./aiTypes";

class AiGateway {
  private providers = new Map<string, AiProvider>();

  register(provider: AiProvider): void {
    if (this.providers.has(provider.id)) {
      throw new Error(
        `aiGateway: duplicate provider id "${provider.id}". ` +
          `Provider ids must be unique across all adapters.`
      );
    }
    this.providers.set(provider.id, provider);
  }

  list(): AiProvider[] {
    return Array.from(this.providers.values());
  }

  has(providerId: string): boolean {
    return this.providers.has(providerId);
  }

  /** Pick a provider that supports the task, respecting current health
   *  and budget hints. Returns null when nothing matches — caller
   *  returns a "no-provider" error to the API layer. */
  async pick(req: AiCompleteRequest): Promise<AiProvider | null> {
    const supports = this.list().filter((p) => p.supports.includes(req.task));
    if (supports.length === 0) return null;

    // Health-check in parallel; unhealthy providers drop out.
    const healths = await Promise.all(
      supports.map(async (p) => ({ p, healthy: await safeHealth(p) }))
    );
    const healthy = healths.filter((h) => h.healthy).map((h) => h.p);
    if (healthy.length === 0) return null;

    // Budget-aware pick. Tight latency budget → cheapest per ms. Else
    // → cheapest per output token. Trivially extensible when Module 14
    // registers real providers with real cost curves.
    const budget = req.budget;
    const tight = !!budget?.maxLatencyMs && budget.maxLatencyMs < 5_000;
    return healthy
      .slice()
      .sort((a, b) =>
        tight
          ? a.latencyP50Ms - b.latencyP50Ms
          : a.cost.outputPerKtok - b.cost.outputPerKtok
      )[0];
  }

  async complete(req: AiCompleteRequest): Promise<AiCompleteResponse> {
    const provider = await this.pick(req);
    if (!provider) {
      return {
        ok: false,
        error: {
          code: "no-provider",
          message:
            "No AI provider is registered for this task. Register one via aiGateway.register() at module load.",
          retryable: false
        }
      };
    }
    try {
      return await provider.complete(req);
    } catch (e) {
      return {
        ok: false,
        error: {
          code: "internal",
          message: (e as Error)?.message ?? "Provider threw",
          retryable: true
        }
      };
    }
  }
}

async function safeHealth(p: AiProvider): Promise<boolean> {
  try {
    return await p.isHealthy();
  } catch {
    return false;
  }
}

/** The one and only gateway instance. Providers register at import
 *  time (see Module 14+). The gateway is stateless per-request. */
export const aiGateway = new AiGateway();

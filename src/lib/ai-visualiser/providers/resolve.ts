// Resolves the currently-enabled provider from ai_visualiser_provider_config.
// Called by every route that hits the AI (classify, render, admin test).
// If no row is enabled — or the enabled row has no api_key — the stub
// is returned WITH a flag so callers can refuse to burn merchant
// credits against a non-live provider.
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { AiVisualiserProvider } from "./types";
import { makeStubProvider } from "./stub";
import { makeOpenAiProvider } from "./openai";
import { makeFluxProvider } from "./flux";

export type ResolvedProvider = {
  provider: AiVisualiserProvider;
  isLive: boolean;
  providerId: string;
  costPerRenderPence: number;
};

export async function resolveActiveProvider(): Promise<ResolvedProvider> {
  const { data, error } = await supabaseAdmin
    .from("ai_visualiser_provider_config")
    .select("provider_id, model_id, credentials, cost_per_render_pence")
    .eq("enabled", true)
    .maybeSingle();

  if (error || !data) {
    return {
      provider: makeStubProvider(),
      isLive: false,
      providerId: "stub",
      costPerRenderPence: 0
    };
  }

  const creds = (data.credentials || {}) as { api_key?: string };
  const apiKey = creds.api_key;

  if (!apiKey) {
    return {
      provider: makeStubProvider(),
      isLive: false,
      providerId: "stub",
      costPerRenderPence: 0
    };
  }

  if (data.provider_id === "openai-images") {
    return {
      provider: makeOpenAiProvider({
        apiKey,
        imageModel: data.model_id || undefined
      }),
      isLive: true,
      providerId: data.provider_id,
      costPerRenderPence: data.cost_per_render_pence || 8
    };
  }

  if (data.provider_id === "flux-1.1-pro") {
    return {
      provider: makeFluxProvider({ apiKey }),
      isLive: true,
      providerId: data.provider_id,
      costPerRenderPence: data.cost_per_render_pence || 5
    };
  }

  // Unknown provider row — treat as unconfigured
  return {
    provider: makeStubProvider(),
    isLive: false,
    providerId: "stub",
    costPerRenderPence: 0
  };
}

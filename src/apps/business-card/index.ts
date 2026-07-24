// Business Card Studio — per HOW_TO_ADD_A_STUDIO.md template.

import { manifest } from "./manifest";
import { createStudio, type PersistArgs } from "@/lib/design/trade-os/studio-template";
import { dispatchBackend } from "@/lib/design/trade-os/backend-dispatch";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { DesignIR } from "@/lib/design/compiler";

const { module } = createStudio({
  manifest,

  buildIR: ({ brand, input }): DesignIR => ({
    schema_version: "1.0.0",
    intent: {
      surface: "business-card",
      hints:   []
    },
    trade:             brand.industry || "trade",
    brand_snapshot_id: input.correlation_id,
    layout: {
      style_anchor:    "Modern Minimal",
      info_groups_max: 2
    },
    photography: { photo_urls: [], overlay: false, grain: false },
    typography:  {
      aesthetic:        "modern",
      primary_family:   brand.typography.primary,
      secondary_family: brand.typography.secondary
    },
    colour: {
      primary:   brand.colour.primary,
      secondary: brand.colour.secondary,
      accent:    brand.colour.accent,
      split_pct: { body: 70, graphics: 20, accent: 10 }
    },
    constraints: [],
    outputs: [{ kind: "spread", width_px: 1004, height_px: 650, quality: "high" }],
    memory_hints: [],
    business: {
      name:     brand.name,
      tagline:  brand.tagline,
      phone:    "",
      website:  "",
      services: brand.services.slice(0, 6)
    }
  }),

  runBackend: async ({ compiled }) => dispatchBackend(compiled),

  persist: async (args: PersistArgs) => {
    const { data } = await supabaseAdmin
      .from("hammerex_business_card_generations")
      .insert({
        merchant_slug:  args.merchantSlug,
        model_used:     args.compiled.model,
        prompt_text:    args.compiled.userPrompt,
        image_urls:     args.imageUrls,
        usd_cost:       args.usdCost,
        latency_ms:     args.latencyMs,
        quality_score:  args.qualityScore
      })
      .select("id")
      .single();
    return { generationId: data?.id ?? null };
  }
});

export default module;

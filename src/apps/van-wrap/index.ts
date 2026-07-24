// Van Wrap App — the reference implementation of a Trade OS Studio,
// now built on top of the reusable StudioTemplate. Every step of the
// seven-step generator pattern lives in `createStudio()` — Van Wrap
// supplies only what makes it a Van Wrap: the IR shape and the image
// backend call.
//
// Adding a new Studio (Logo, Business Card, Workwear) is now:
//   1. Write manifest.ts
//   2. Write buildIR({ brand, input }) → DesignIR
//   3. Write runBackend({ compiled }) → BackendCallResult
//   4. Write persist() if the Studio uses a bespoke table (Van Wrap
//      uses hammerex_van_generations)
//
// That's it. Everything else — Brand DNA parse, compile, critic loop,
// event publish, subscriber bootstrap — is inherited.

import { manifest } from "./manifest";
import { createStudio } from "@/lib/design/trade-os/studio-template";
import type { PersistArgs } from "@/lib/design/trade-os/studio-template";
import { buildVehicleIR } from "@/lib/design/compiler";
import { dispatchBackend } from "@/lib/design/trade-os/backend-dispatch";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const { module } = createStudio({
  manifest,

  buildIR: ({ brand, input }) => buildVehicleIR({
    brand: {
      colour: {
        primary:   brand.colour.primary,
        secondary: brand.colour.secondary,
        accent:    brand.colour.accent,
        split_pct: { body: 75, graphics: 20, accent: 5 }
      },
      typography: {
        aesthetic:        "modern",
        primary_family:   brand.typography.primary,
        secondary_family: brand.typography.secondary
      }
    },
    business: {
      name:     brand.name,
      tagline:  brand.tagline,
      phone:    "",
      website:  "",
      services: brand.services.slice(0, 6)
    },
    vehicle: {
      model:  "Ford Transit Custom",
      body:   "L2H1",
      year:   2025,
      colour: { name: "Frozen White", hex: "#F5F5F5" }
    },
    trade:              brand.industry || "trade",
    brand_snapshot_id:  input.correlation_id,
    style_anchor:       "Luxury Minimal",
    hero_photo_urls:    input.reference_urls,
    memory_hints:       []
  }),

  runBackend: async ({ compiled }) => dispatchBackend(compiled),

  persist: async (args: PersistArgs) => {
    // Van Wrap has bespoke lineage: needs a van_session row before it
    // can write a van_generation row. Discover-or-create the session
    // once per merchant per invocation. Future generations reuse.
    let sessionId = args.sessionId;
    if (!sessionId && args.merchantSlug) {
      const { data } = await supabaseAdmin
        .from("hammerex_van_sessions")
        .insert({
          merchant_slug:     args.merchantSlug,
          brand_snapshot_id: args.brandSnapshotId,
          business_name:     args.ir.business?.name ?? "",
          trade:             args.ir.trade ?? "trade",
          van_slug:          "ford-transit-custom",
          van_colour:        "Frozen White",
          design_mode:       "best-shot"
        })
        .select("id")
        .single();
      sessionId = data?.id ?? null;
    }
    if (!sessionId) return { generationId: null };

    const { data, error } = await supabaseAdmin
      .from("hammerex_van_generations")
      .insert({
        session_id:      sessionId,
        kind:            "initial",
        sds_json:        args.ir as unknown as Record<string, unknown>,
        prompt_text:     args.compiled.userPrompt,
        user_prompt:     args.userPrompt,
        image_urls:      args.imageUrls,
        washers_charged: 10,
        usd_cost:        args.usdCost,
        latency_ms:      args.latencyMs,
        model_used:      args.compiled.model,
        quality_tier:    args.compiled.qualityProfile === "hd" ? "hd" : "medium",
        quality_score:   args.qualityScore,
        score_breakdown: args.scoreBreakdown
      })
      .select("id")
      .single();
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[van-wrap] persist failed", error.message);
      return { generationId: null };
    }
    return { generationId: data?.id ?? null };
  }
});

export default module;

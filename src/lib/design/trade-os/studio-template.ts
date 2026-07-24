// Studio Template — reusable skeleton every future Studio inherits.
//
// Van Wrap was the reference implementation. From now on, Logo,
// Business Card, Workwear, Website etc all instantiate this template
// rather than duplicating the seven-step generator pattern.
//
// Contract:
//   1. Parse Brand DNA hard (Zod refuses malformed brand)
//   2. Build IR via a Studio-supplied irBuilder (only per-Studio logic)
//   3. compile() (deterministic, cached, versioned)
//   4. Ensure lineage (brand snapshot + session rows for persistence)
//   5. Fire generateImage() (or generateDocument etc via backendRunner)
//   6. Run runLoop() critic + regenerate cycle
//   7. Persist recipe (sds_json + prompt + score + cost + latency)
//   8. Publish Asset.Generated.v1 for cascade subscribers
//
// A new Studio App now supplies just the manifest + IR builder + a
// backend runner. Every other step lives here.

import type { AppGenerator, AppGenerateInput, AppGenerateResult, StudioAppManifest } from "./manifest";
import type { DesignIR } from "@/lib/design/compiler";
import { compile } from "@/lib/design/compiler";
import { parseBrandRecord, type BrandRecord } from "@/lib/design/brand/schema";
import { computeFingerprint } from "@/lib/design/brand/fingerprint";
import { runLoop } from "@/lib/design/critic/regenerate-loop";
import type { CompiledPrompt } from "@/lib/design/compiler";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { eventBus, envelope } from "./event-bus";
import { ensureSubscribersLoaded } from "./subscribers";

// ─── Types ──────────────────────────────────────────────────────

export type BackendCallResult = {
  images:              Array<{ b64: string } | string>;
  usage_usd_estimate:  number;
} | null;

export type StudioBackendRunner = (args: {
  compiled:    CompiledPrompt;
  userPrompt?: string;
}) => Promise<BackendCallResult>;

export type StudioTemplate = {
  manifest:      StudioAppManifest;
  buildIR:       (args: { brand: BrandRecord; input: AppGenerateInput }) => DesignIR;
  runBackend:    StudioBackendRunner;
  /** Optional per-Studio persistence override. Van Wrap uses van_generations;
   *  Logo Studio will use logo_generations etc. Falls back to a no-op if
   *  the Studio hasn't wired a persistence table yet. */
  persist?:      (args: PersistArgs) => Promise<{ generationId: string | null }>;
};

export type PersistArgs = {
  merchantSlug:   string | null;
  brandSnapshotId: string | null;
  sessionId:      string | null;
  compiled:       CompiledPrompt;
  ir:             DesignIR;
  userPrompt:     string | null;
  imageUrls:      string[];
  usdCost:        number;
  latencyMs:      number;
  qualityScore:   number | null;
  scoreBreakdown: Record<string, unknown> | null;
};

// ─── Template factory ───────────────────────────────────────────

export function createStudio(template: StudioTemplate): { module: { manifest: StudioAppManifest; generator: AppGenerator } } {
  const generator: AppGenerator = async (input) => {
    const t0 = Date.now();

    // 1. Parse Brand DNA hard.
    let brand: BrandRecord;
    try {
      brand = parseBrandRecord(input.brand_snapshot);
    } catch (e) {
      return { ok: false, error: `invalid_brand_snapshot:${e instanceof Error ? e.message : "unknown"}`, latency_ms: Date.now() - t0 };
    }

    // 4. Ensure lineage — brand snapshot + session for persistence.
    const lineage = await ensureLineage({ input, brand });

    // 2. IR — the only per-Studio step.
    const ir = template.buildIR({ brand, input });

    // 3. Compile — deterministic, always runs regardless of API key.
    const result = compile(ir);
    if (!result.ok) {
      return { ok: false, error: `compile_failed:${result.errors.map((e) => `${e.path}: ${e.message}`).join("; ")}`, latency_ms: Date.now() - t0 };
    }

    // 5. Fire the backend.
    const gen = await template.runBackend({ compiled: result.prompt, userPrompt: input.user_prompt });

    if (!gen) {
      // Persist the recipe anyway. Master Rule.
      if (template.persist) {
        await template.persist({
          merchantSlug:    input.merchant_slug ?? null,
          brandSnapshotId: lineage.brandSnapshotId,
          sessionId:       lineage.sessionId,
          compiled:        result.prompt,
          ir,
          userPrompt:      input.user_prompt ?? null,
          imageUrls:       [],
          usdCost:         0,
          latencyMs:       Date.now() - t0,
          qualityScore:    null,
          scoreBreakdown:  null
        });
      }
      return { ok: false, error: "backend_unavailable", prompt_used: result.prompt.userPrompt, latency_ms: Date.now() - t0, cost_pence: 0 };
    }

    // 6. Design Critic + auto-regenerate loop.
    const loop = await runLoop({
      criticInput: {
        brand_snapshot:   input.brand_snapshot,
        capability_slug:  template.manifest.id,
        merchant_request: input.user_prompt ?? ""
      },
      initialPrompt: result.prompt,
      initialImage:  gen,
      regenerate: async (prevPrompt, feedback) => {
        const feedbackText = feedback.length ? `\n\nMODIFICATION_REQUEST:\n- ${feedback.join("\n- ")}` : "";
        const nextGen = await template.runBackend({
          compiled: { ...prevPrompt, userPrompt: prevPrompt.userPrompt + feedbackText },
          userPrompt: input.user_prompt
        });
        return { prompt: prevPrompt, image: nextGen ?? gen };
      }
    });

    const final = loop.final;
    const finalImage = (final.imageResult as BackendCallResult) ?? gen;
    const usdCost = finalImage ? Number((finalImage.usage_usd_estimate * loop.rounds.length).toFixed(4)) : 0;
    const totalCostPence = Math.ceil(usdCost * 0.79 * 100);
    const assetUrls = finalImage?.images.map((_, i) => `b64:image_${i}`) ?? [];

    // 7. Persist the recipe.
    let generationId: string | null = null;
    if (template.persist) {
      const persisted = await template.persist({
        merchantSlug:    input.merchant_slug ?? null,
        brandSnapshotId: lineage.brandSnapshotId,
        sessionId:       lineage.sessionId,
        compiled:        final.prompt,
        ir,
        userPrompt:      input.user_prompt ?? null,
        imageUrls:       assetUrls,
        usdCost,
        latencyMs:       Date.now() - t0,
        qualityScore:    final.critic?.overall ?? null,
        scoreBreakdown:  (final.critic?.scores as Record<string, unknown>) ?? null
      });
      generationId = persisted.generationId;
    }

    // 7b. Cost analytics — one row per generation. Feeds margin dashboards
    // via v_generation_margin_by_day. Best-effort; never blocks the return.
    if (generationId) {
      supabaseAdmin.from("hammerex_generation_costs").insert({
        merchant_slug:   input.merchant_slug ?? null,
        capability_slug: template.manifest.id,
        generation_id:   generationId,
        model_used:      final.prompt.model,
        usd_cost:        usdCost,
        pence_charged:   totalCostPence,
        quality_tier:    final.prompt.qualityProfile === "hd" ? "hd" : "medium",
        latency_ms:      Date.now() - t0,
        quality_score:   final.critic?.overall ?? null,
        cache_hit:       false
      }).then(({ error }) => {
        if (error) console.error("[studio-template] cost log failed", error.message);
      });
    }

    // 8. Publish Asset.Generated.v1.
    ensureSubscribersLoaded();
    await eventBus.publish(envelope({
      type: "Asset.Generated.v1",
      payload: {
        capability_slug: template.manifest.id,
        generation_id:   generationId,
        session_id:      lineage.sessionId,
        merchant_slug:   input.merchant_slug ?? null,
        cost_pence:      totalCostPence
      },
      merchantId:    input.merchant_slug ?? null,
      correlationId: input.correlation_id,
      producer:      template.manifest.id
    }));

    return {
      ok:          true,
      asset_urls:  assetUrls,
      prompt_used: final.prompt.userPrompt,
      cost_pence:  totalCostPence,
      latency_ms:  Date.now() - t0
    };
  };

  return { module: { manifest: template.manifest, generator } };
}

// ─── Lineage helper (shared across Studios) ─────────────────────

type Lineage = { brandIdentityId: string | null; brandSnapshotId: string | null; sessionId: string | null };

async function ensureLineage(args: { input: AppGenerateInput; brand: BrandRecord }): Promise<Lineage> {
  const { input, brand } = args;
  const brandIdentityId = input.brand_identity_id ?? null;

  let brandSnapshotId: string | null = null;
  if (brandIdentityId) {
    const fingerprint = computeFingerprint({
      industry:        brand.industry,
      personality:     brand.personality,
      geometry:        "geometric",
      construction:    "wordmark",
      primary_shape:   "house",
      secondary_shape: "none",
      style:           "architectural",
      symmetry:        "vertical",
      complexity:      "minimal",
      colour:          brand.colour.primary,
      accent:          brand.colour.accent,
      letterform:      brand.name.charAt(0)
    });
    const { data } = await supabaseAdmin
      .from("hammerex_brand_snapshots")
      .insert({
        brand_identity_id: brandIdentityId,
        brand_json:        brand as unknown as Record<string, unknown>,
        fingerprint,
        brand_version:     1
      })
      .select("id")
      .single();
    brandSnapshotId = data?.id ?? null;
  }

  return { brandIdentityId, brandSnapshotId, sessionId: input.session_id ?? null };
}

// Placeholder result to keep the void-loop typechecking happy in
// consumers that mock the runner.
export type StudioTemplateResult = Awaited<AppGenerateResult>;

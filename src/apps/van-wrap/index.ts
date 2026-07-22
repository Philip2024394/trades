// Van Wrap App — real generator wired through the Prompt Compiler.
//
// Flow:
//   1. Read brand snapshot + user inputs from input.brand_snapshot
//   2. Build the DesignIR via compiler.buildVehicleIR()
//   3. compile() → CompiledPrompt (deterministic, cached, versioned)
//   4. Send to GPT Image 1 via imageGen.generateImage()
//   5. Return image URLs + recipe metadata per Master Rule ("save the
//      recipe not the image")
//
// Generation only fires when OPENAI_API_KEY is live. Compiler runs
// regardless — you can inspect the prompt before spending money.

import type { StudioAppModule, AppGenerator } from "@/lib/design/trade-os/manifest";
import type { EventHandler } from "@/lib/design/trade-os/runtime";
import type { EventEnvelope } from "@/lib/design/trade-os/event-bus";
import { manifest } from "./manifest";
import { compile, buildVehicleIR } from "@/lib/design/compiler";
import { generateImage } from "@/lib/openai/imageGen";
import { parseBrandRecord } from "@/lib/design/brand/schema";

const generator: AppGenerator = async (input) => {
  const t0 = Date.now();

  // Parse + validate the brand snapshot. Master Rule: brand is source
  // of truth, so we validate it hard before doing anything.
  let brand;
  try {
    brand = parseBrandRecord(input.brand_snapshot);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? `invalid_brand_snapshot:${e.message}` : "invalid_brand_snapshot",
      latency_ms: Date.now() - t0
    };
  }

  // TODO — real values from the SDS. Placeholders until Van Wrap App
  // has a proper input shape passed from the Studio UI.
  const ir = buildVehicleIR({
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
  });

  // Compile — deterministic. Runs whether or not OPENAI_API_KEY exists.
  const result = compile(ir);
  if (!result.ok) {
    return {
      ok: false,
      error: `compile_failed:${result.errors.map((e) => `${e.path}: ${e.message}`).join("; ")}`,
      latency_ms: Date.now() - t0
    };
  }

  // Persist the recipe (compiled prompt + IR) so we can regenerate
  // forever from stored inputs. Master Rule.
  //   TODO — write to hammerex_van_generations.sds_json + .prompt_text
  //   (already have columns from the foundation migration)

  // Fire GPT Image 1. Returns null when OPENAI_API_KEY missing.
  const gen = await generateImage({
    prompt:  result.prompt.userPrompt,
    quality: result.prompt.qualityProfile === "hd" ? "hd" : "medium",
    size:    "1536x1024"
  });

  if (!gen) {
    return {
      ok:          false,
      error:       "openai_unavailable",   // key missing OR upstream error
      prompt_used: result.prompt.userPrompt,   // still return the prompt for inspection
      latency_ms:  Date.now() - t0,
      cost_pence:  0
    };
  }

  return {
    ok:          true,
    asset_urls:  gen.images.map((_, i) => `b64:image_${i}`),   // caller persists to Storage
    prompt_used: result.prompt.userPrompt,
    cost_pence:  Math.ceil(gen.usage_usd_estimate * 0.79 * 100),
    latency_ms:  Date.now() - t0
  };
};

// Regenerate the merchant's van preview on Brand DNA change.
const generatePreview: EventHandler<unknown> = {
  name: "generatePreview",
  async handle(event: EventEnvelope<unknown>) {
    // TODO — read brand snapshot for this merchant from the event,
    // then call generator(). Wired once the Orchestrator (V3 Q16)
    // ships its handler dispatch.
    void event;
  }
};

const module: StudioAppModule = {
  manifest,
  generator,
  handlers: {
    generatePreview: generatePreview as EventHandler<unknown>
  }
};

export default module;

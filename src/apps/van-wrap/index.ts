// Van Wrap App — module entry point per manifest contract.
// Wires the manifest, generator, and event handlers into a single
// StudioAppModule that the Capability Registry can install.
//
// Generator returns a placeholder result today. Real image generation
// activates once the Prompt Compiler lands (V3 Q13) and OPENAI_API_KEY
// is live on Vercel.

import type { StudioAppModule, AppGenerator } from "@/lib/design/trade-os/manifest";
import type { EventHandler } from "@/lib/design/trade-os/runtime";
import type { EventEnvelope } from "@/lib/design/trade-os/event-bus";
import { manifest } from "./manifest";

const generator: AppGenerator = async (input) => {
  // TODO — activate once Prompt Compiler + OPENAI_API_KEY land:
  //   1. Load VehiclePromptCompiler
  //   2. Compile SDS + brand_snapshot + user_prompt → GPT Image 1 prompt
  //   3. Fire generate side/front/rear images in parallel (3x $0.042 medium)
  //   4. Persist recipe + image URLs to hammerex_van_generations
  //   5. Return AppGenerateResult
  return {
    ok: false,
    error: "prompt_compiler_not_wired_yet",
    latency_ms: 0,
    cost_pence: 0
  };
  // input intentionally unused until wired
  void input;
};

// Event handlers referenced by manifest.subscriptions[].handler.
// When Brand DNA changes, the Van Wrap App regenerates its preview.
const generatePreview: EventHandler<unknown> = {
  name: "generatePreview",
  async handle(event: EventEnvelope<unknown>) {
    // TODO — regenerate the merchant's van preview using the new
    // brand snapshot. Fires on Brand.Updated.v1, Identity.LogoChanged.v1,
    // Identity.ColourChanged.v1 per manifest.subscriptions[].
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

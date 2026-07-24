// Backend dispatch — takes a CompiledPrompt (with .model set by the
// router) and calls the right generator. Returns a normalised
// BackendCallResult with the images already unified.
//
// Adding a new backend: import the new generator here + add a case.
// Everything else already routes through this dispatcher.

import type { CompiledPrompt } from "@/lib/design/compiler";
import type { BackendCallResult } from "./studio-template";
import { generateImage } from "@/lib/openai/imageGen";
import { generateIdeogram } from "@/lib/openai/ideogramGen";
import { generateRecraft } from "@/lib/openai/recraftGen";

export async function dispatchBackend(compiled: CompiledPrompt): Promise<BackendCallResult> {
  switch (compiled.model) {
    case "ideogram-v3": {
      const res = await generateIdeogram({
        prompt:      compiled.userPrompt,
        quality:     compiled.qualityProfile === "hd" || compiled.qualityProfile === "high" ? "premium" : "standard",
        aspect_ratio: "1:1",
        style:       "DESIGN"
      });
      if (!res) return null;
      return { images: res.images.map((i) => i.url), usage_usd_estimate: res.usage_usd_estimate };
    }
    case "recraft-v3": {
      const res = await generateRecraft({
        prompt:  compiled.userPrompt,
        quality: compiled.qualityProfile === "hd" || compiled.qualityProfile === "high" ? "premium" : "standard",
        style:   "vector_illustration"
      });
      if (!res) return null;
      return { images: res.images.map((i) => i.url), usage_usd_estimate: res.usage_usd_estimate };
    }
    case "flux-kontext":
    case "gpt-image-1":
    default: {
      const res = await generateImage({
        prompt:  compiled.userPrompt,
        quality: compiled.qualityProfile === "hd" ? "hd" : "medium",
        size:    "1536x1024"
      });
      return res;
    }
  }
}

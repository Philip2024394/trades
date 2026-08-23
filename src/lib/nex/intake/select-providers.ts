// Provider selector · env-driven · returns the correct implementation for
// each NEX intelligence interface without consumers importing providers
// directly.
//
// Consumers ALWAYS import from this file · never from ./adapters/* directly.
// Provider swap is a config change · not a code change.
//
// Doctrine anchor: project_nex_owns_intelligence_capabilities_2026_08_22

import type { NexVisionService } from "./nex-vision-service";
import type { NexOcrService } from "./nex-ocr-service";
import type { NexPerceptualHashService } from "./nex-perceptual-hash-service";

import { visionStub } from "./adapters/vision-stub";
import { ocrStub } from "./adapters/ocr-stub";
import { perceptualHashStub } from "./adapters/perceptual-hash-stub";
// Task #69 · 2026-08-22 · Real local adapters landed. Selectable via env.
import { visionQwen25VL } from "./adapters/vision-qwen25vl";
import { ocrTesseract } from "./adapters/ocr-tesseract";

export function selectVisionProvider(): NexVisionService {
  const name = process.env.NEX_VISION_PROVIDER ?? "stub";
  switch (name) {
    case "stub":            return visionStub;
    case "qwen25vl":        return visionQwen25VL;   // local Ollama · zero third-party
    default:
      console.warn(`[nex-intake] unknown NEX_VISION_PROVIDER='${name}' · falling back to stub`);
      return visionStub;
  }
}

export function selectOcrProvider(): NexOcrService {
  const name = process.env.NEX_OCR_PROVIDER ?? "stub";
  switch (name) {
    case "stub":            return ocrStub;
    case "tesseract":       return ocrTesseract;      // pure WASM · zero third-party
    default:
      console.warn(`[nex-intake] unknown NEX_OCR_PROVIDER='${name}' · falling back to stub`);
      return ocrStub;
  }
}

export function selectPerceptualHashProvider(): NexPerceptualHashService {
  const name = process.env.NEX_PERCEPTUAL_HASH_PROVIDER ?? "stub";
  switch (name) {
    case "stub":            return perceptualHashStub;
    // case "sharp-phash":  return require("./adapters/perceptual-hash-sharp.js").perceptualHashSharp;
    default:
      console.warn(`[nex-intake] unknown NEX_PERCEPTUAL_HASH_PROVIDER='${name}' · falling back to stub`);
      return perceptualHashStub;
  }
}

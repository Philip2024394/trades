// §36-V3-SDXL · WAVE-P1-CAMPAIGN · 2026-09-15 · nex-sdxl-engine-adapter · integration test
// NEX bounded infrastructure · Node → Python → PCE → V2 pipeline integration test
//
// This test does the full pipeline:
//   1. Craft a V3GenerationRequest (staircase-oriented)
//   2. Invoke the NEX-side SDXL adapter (spawns Python)
//   3. Wait for the image to be produced
//   4. Read the image bytes
//   5. Run PCE V1 extraction on them (dimensions + SHA + format)
//   6. Optionally run V2 difference engine (contract-vs-contract) using a hand-authored reference
//
// Skipped automatically when SDXL weights are not present locally, so the
// broader regression suite is not blocked by this heavy test.

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import * as path from "node:path";
import { runNexSdxlAdapter } from "../nex-sdxl-adapter";
import { runPerceptualContractExtraction } from "../../nex-perceptual-contract-extraction-v1/perceptual-extraction-engine";
import type { V3GenerationRequest } from "../../nex-visual-intelligence-v3/visual-generation-contract";

const REPO_ROOT = process.cwd();
// os.homedir() returns the correct Windows path (e.g. C:\Users\Victus) regardless of
// whether the shell that invoked vitest exported HOME in POSIX-style (/c/Users/Victus).
const PYTHON_EXE = path.resolve(homedir(), "AppData", "Local", "Programs", "Python", "Python312", "python.exe");
const SCRIPT_PATH = path.resolve(REPO_ROOT, "scripts", "nex-sdxl-generate.py");
const OUTPUT_DIR = path.resolve(REPO_ROOT, "data", "nex-sdxl-integration-test");
const REQUEST_JSON_PATH = path.resolve(OUTPUT_DIR, "request.json");
const WEIGHT_CACHE_DIR = path.resolve(REPO_ROOT, "data", "nex-visual-engine-weights", "hf-cache");

// SDXL weights are >5 GB and slow to load · we don't want to run this on every regression pass.
// Skip when the weight cache directory does not exist yet (i.e., smoke test hasn't been run).
const SDXL_AVAILABLE = existsSync(WEIGHT_CACHE_DIR);
const PYTHON_AVAILABLE = existsSync(PYTHON_EXE);
const SCRIPT_AVAILABLE = existsSync(SCRIPT_PATH);

const canRunIntegration = SDXL_AVAILABLE && PYTHON_AVAILABLE && SCRIPT_AVAILABLE;

describe.runIf(canRunIntegration)("§36-V3-SDXL · full Node → Python → PCE pipeline", () => {
  it(
    "I-1 · runNexSdxlAdapter generates a real image · adapter records SHA + provenance",
    async () => {
      const request: V3GenerationRequest = {
        request_id: "integ-staircase-oak-001",
        generation_kind: "reference_conditioned",
        reference_contract_id: "staircase-integration-001",
        reference_contract_sha256: "ab".repeat(32),
        prompt: "a plain wooden staircase, oak handrail, three-quarter left view, eye-level, 4:3, photorealistic, studio lighting, no people",
        output_format: "png",
        max_output_images: 1,
      };
      const result = await runNexSdxlAdapter({
        request,
        options: {
          python_exe: PYTHON_EXE,
          script_path: SCRIPT_PATH,
          output_dir: OUTPUT_DIR,
          request_json_path: REQUEST_JSON_PATH,
          height: 512,
          width: 512,
          num_inference_steps: 12,
          guidance_scale: 5.0,
          seed: 42,
          timeout_ms: 30 * 60 * 1000,
        },
      });
      expect(result.kind).toBe("SUCCESS");
      if (result.kind !== "SUCCESS") return;
      expect(result.output_bytes).toBeGreaterThan(1000);
      expect(result.output_sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(result.outcome.response_kind).toBe("engine_invocation_success");
      expect(result.outcome.perception_verification_status).toBe("pending_perceptual_layer");
      expect(result.outcome.candidate_asset_ids.length).toBe(1);
    },
    45 * 60 * 1000, // 45 min upper bound (single image on 4 GB VRAM with cpu offload is slow)
  );

  it(
    "I-2 · PCE V1 extracts dimensions + format + SHA from the adapter output",
    async () => {
      // Find the generated image (should exist from I-1)
      const req = "integ-staircase-oak-001";
      const image_path = path.resolve(OUTPUT_DIR, `sdxl-${req}.png`);
      expect(existsSync(image_path)).toBe(true);

      const bytes = readFileSync(image_path);
      const pce = runPerceptualContractExtraction({
        request_id: `pce:${req}`,
        image_bytes: new Uint8Array(bytes),
        extraction_timestamp: "2026-09-15T12:00:00.000Z",
      });
      expect(pce.kind).toBe("SUCCESS");
      if (pce.kind !== "SUCCESS") return;
      expect(pce.result.provenance.source_format).toBe("png");
      expect(pce.result.provenance.source_dimensions_width).toBe(512);
      expect(pce.result.provenance.source_dimensions_height).toBe(512);
      const width = pce.result.extracted_properties.find((p) => p.property_id === "dimensions.width");
      expect(width?.verification_status).toBe("verified_deterministic");
      // Semantic properties honestly unable_to_verify
      const material = pce.result.extracted_properties.find((p) => p.property_id === "material.classifications");
      expect(material?.verification_status).toBe("unable_to_verify");
    },
    60 * 1000,
  );
});

describe.runIf(!canRunIntegration)("§36-V3-SDXL · integration test skipped (weights or python not present)", () => {
  it("SKIP · noting the honest environment state", () => {
    expect({
      python_available: PYTHON_AVAILABLE,
      script_available: SCRIPT_AVAILABLE,
      sdxl_weights_cached: SDXL_AVAILABLE,
    }).toBeDefined();
  });
});

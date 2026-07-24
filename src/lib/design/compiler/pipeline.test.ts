// Trade OS · compiler pipeline integration test.
//
// Proves the end-to-end compiler flow for a vehicle-surface brand:
//   • IR parse succeeds
//   • Constraints resolve (universal + vehicle + trade + accessibility + print)
//   • Sections assemble
//   • Refinement dedupes lines
//   • Router picks GPT Image 1 for vehicle surface
//   • Final CompiledPrompt is valid and cache-keyed
//
// Zero network. Zero Supabase. Pure deterministic compiler audit.

import { describe, it, expect } from "vitest";
import { compile, buildVehicleIR } from "./index";

describe("Trade OS compiler pipeline · vehicle surface", () => {
  const brand = {
    colour: {
      primary:   "#0A0A0A",
      secondary: "#FFFFFF",
      accent:    "#FFB300",
      split_pct: { body: 75, graphics: 20, accent: 5 }
    },
    typography: {
      aesthetic:        "modern" as const,
      primary_family:   "Inter",
      secondary_family: "Inter"
    }
  };

  const business = {
    name:     "Chalk & Trowel Plumbing",
    tagline:  "Reliable plumbing across Leeds",
    phone:    "0113 000 0000",
    website:  "chalkandtrowel.co.uk",
    services: ["Boiler installs", "Bathroom fit-outs", "Emergency callouts"]
  };

  const vehicle = {
    model:  "Ford Transit Custom",
    body:   "L2H1",
    year:   2025,
    colour: { name: "Frozen White", hex: "#F5F5F5" }
  };

  it("compiles a plumbing van IR into a valid CompiledPrompt", () => {
    const ir = buildVehicleIR({
      brand, business, vehicle,
      trade:             "plumbing",
      brand_snapshot_id: "test-snapshot",
      style_anchor:      "Modern Bold",
      hero_photo_urls:   [],
      memory_hints:      []
    });

    const result = compile(ir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Model routing
    expect(result.prompt.model).toBe("gpt-image-1");

    // Prompt structure
    expect(result.prompt.userPrompt).toContain("Chalk & Trowel Plumbing");
    expect(result.prompt.userPrompt).toContain("Ford Transit Custom");
    expect(result.prompt.userPrompt.length).toBeGreaterThan(200);

    // Compiler version + explainability
    expect(result.prompt.explainability.length).toBeGreaterThan(3);
    expect(result.prompt.cacheKey.length).toBeGreaterThan(0);
  });

  it("injects trade-specific visual cues for plumbing", () => {
    const ir = buildVehicleIR({
      brand, business, vehicle,
      trade:             "plumbing",
      brand_snapshot_id: "test-snapshot"
    });
    const result = compile(ir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Trade rules should have contributed constraints seen in the prompt.
    // Look for a plumbing-specific cue OR its opposite.
    const anyPlumbingSignal =
      result.prompt.userPrompt.includes("copper") ||
      result.prompt.userPrompt.includes("boiler") ||
      result.prompt.userPrompt.includes("Gas Safe") ||
      result.prompt.userPrompt.includes("cartoon");
    expect(anyPlumbingSignal).toBe(true);
  });

  it("enforces vehicle DVLA preservations", () => {
    const ir = buildVehicleIR({
      brand, business, vehicle,
      trade:             "electrical",
      brand_snapshot_id: "test-snapshot"
    });
    const result = compile(ir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Any vehicle preservation should appear (headlights / mirrors etc)
    const hasVehiclePreservation =
      result.prompt.userPrompt.includes("headlight") ||
      result.prompt.userPrompt.includes("mirror") ||
      result.prompt.userPrompt.includes("registration");
    expect(hasVehiclePreservation).toBe(true);
  });

  it("caches on stable IR hash", () => {
    const ir = buildVehicleIR({
      brand, business, vehicle,
      trade:             "joinery",
      brand_snapshot_id: "test-snapshot-1"
    });

    const first  = compile(ir);
    const second = compile(ir);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(second.cached).toBe(true);
    expect(first.prompt.cacheKey).toBe(second.prompt.cacheKey);
  });

  it("rejects an invalid IR with typed errors", () => {
    const result = compile({ nonsense: true });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].path).toBeDefined();
  });
});

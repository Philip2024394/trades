// Four-Layer Distinction · tests.
//
// Doctrine: docs/brains/nex-four-layer-distinction-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import {
  classifyModule, modulesInLayer, describeLayer, walkOrderBackward,
  isReadOnlyAcrossLayers, requireLayerRegistration,
  LAYER_ORDER, LAYER_MAP,
} from "./index";

describe("Four-Layer Distinction", () => {
  it("declares 4 layers in constitutional order (evidence → observations → knowledge → decisions)", () => {
    expect(LAYER_ORDER).toEqual(["evidence", "observations", "knowledge", "decisions"]);
  });

  it("walkOrderBackward reverses for Voice to trace Decisions → Evidence", () => {
    expect(walkOrderBackward()).toEqual(["decisions", "knowledge", "observations", "evidence"]);
  });

  it("classifies asset-platform/asset-library as Evidence", () => {
    expect(classifyModule("asset-platform/asset-library")).toBe("evidence");
  });

  it("classifies vision-intelligence + sketch-intelligence + reality-reconstruction as Observations", () => {
    expect(classifyModule("vision-intelligence")).toBe("observations");
    expect(classifyModule("sketch-intelligence")).toBe("observations");
    expect(classifyModule("reality-reconstruction")).toBe("observations");
  });

  it("classifies object-library + material-platform + construction-platform + knowledge-layer as Knowledge", () => {
    expect(classifyModule("object-library")).toBe("knowledge");
    expect(classifyModule("material-platform/catalog")).toBe("knowledge");
    expect(classifyModule("construction-platform/rules")).toBe("knowledge");
    expect(classifyModule("knowledge-layer")).toBe("knowledge");
  });

  it("classifies design-history + editing-platform as Decisions", () => {
    expect(classifyModule("design-history")).toBe("decisions");
    expect(classifyModule("editing-platform")).toBe("decisions");
  });

  it("modulesInLayer returns every attribution for a Layer", () => {
    const evidence = modulesInLayer("evidence");
    const observations = modulesInLayer("observations");
    const knowledge = modulesInLayer("knowledge");
    const decisions = modulesInLayer("decisions");
    expect(evidence.length).toBeGreaterThan(0);
    expect(observations.length).toBeGreaterThan(3);
    expect(knowledge.length).toBeGreaterThan(5);
    expect(decisions.length).toBeGreaterThan(2);
    const total = evidence.length + observations.length + knowledge.length + decisions.length;
    expect(total).toBe(LAYER_MAP.length);
  });

  it("describeLayer returns the human-readable description + question", () => {
    const knowledge = describeLayer("knowledge");
    expect(knowledge.question).toBe("What do we know?");
    expect(knowledge.description).toContain("Normalised");
  });

  it("Voice Intelligence + Image Critic are read-only across layers", () => {
    expect(isReadOnlyAcrossLayers("voice-platform")).toBe(true);
    expect(isReadOnlyAcrossLayers("image-critic")).toBe(true);
    expect(isReadOnlyAcrossLayers("object-library")).toBe(false);
  });

  it("requireLayerRegistration returns the attribution for known modules", () => {
    const attr = requireLayerRegistration("object-library");
    expect(attr.layer).toBe("knowledge");
    expect(attr.role).toContain("ObjectDNA");
  });

  it("requireLayerRegistration throws for unregistered modules (PR-blocking guard)", () => {
    expect(() => requireLayerRegistration("something-nonexistent")).toThrow(/missing a Layer registration/);
  });

  it("Every registered module belongs to exactly one Layer (no duplicates)", () => {
    const ids = LAYER_MAP.map((m) => m.module_id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

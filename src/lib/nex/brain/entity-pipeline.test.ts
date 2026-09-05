// src/lib/nex/brain/entity-pipeline.test.ts
// Entity Pipeline observability contract · unit tests
// Philip 2026-09-06 · AUTHORIZE · Universal Entity Intelligence v2

import { describe, it, expect } from "vitest";
import {
  PIPELINE_STAGES,
  PIPELINE_STAGE_PURPOSE,
  PIPELINE_STAGE_IMPLEMENTATION,
  isPipelineStage,
  stagesPresent,
  stageIndex,
  inferLatestStage,
  type PipelineAnnotation,
} from "./entity-pipeline";

describe("PIPELINE_STAGES", () => {
  it("has 8 stages in the correct order", () => {
    expect(PIPELINE_STAGES).toEqual([
      "DISCOVER", "COLLECT", "NORMALIZE", "ENRICH",
      "VERIFY", "STORE", "RANK", "PRESENT",
    ]);
  });
  it("every stage has a purpose statement", () => {
    for (const s of PIPELINE_STAGES) {
      expect(PIPELINE_STAGE_PURPOSE[s]).toBeTruthy();
      expect(PIPELINE_STAGE_PURPOSE[s].length).toBeGreaterThan(20);
    }
  });
  it("every stage has an implementation status", () => {
    for (const s of PIPELINE_STAGES) {
      const impl = PIPELINE_STAGE_IMPLEMENTATION[s];
      expect(["implemented", "partial", "unimplemented"]).toContain(impl.status);
      expect(impl.where).toBeTruthy();
    }
  });
  it("ENRICH is currently unimplemented", () => {
    expect(PIPELINE_STAGE_IMPLEMENTATION.ENRICH.status).toBe("unimplemented");
  });
  it("STORE and PRESENT are implemented", () => {
    expect(PIPELINE_STAGE_IMPLEMENTATION.STORE.status).toBe("implemented");
    expect(PIPELINE_STAGE_IMPLEMENTATION.PRESENT.status).toBe("implemented");
  });
});

describe("isPipelineStage", () => {
  it("accepts every real stage name", () => {
    for (const s of PIPELINE_STAGES) expect(isPipelineStage(s)).toBe(true);
  });
  it("rejects arbitrary strings", () => {
    expect(isPipelineStage("EXAMPLE")).toBe(false);
    expect(isPipelineStage("collect")).toBe(false); // case-sensitive
    expect(isPipelineStage(42)).toBe(false);
    expect(isPipelineStage(null)).toBe(false);
  });
});

describe("stagesPresent", () => {
  it("returns [] when annotations are empty", () => {
    expect(stagesPresent([])).toEqual([]);
  });
  it("dedupes and returns in canonical stage order", () => {
    const anns: PipelineAnnotation[] = [
      { stage: "STORE", source: "s" },
      { stage: "DISCOVER", source: "s" },
      { stage: "STORE", source: "s" },
      { stage: "COLLECT", source: "s" },
    ];
    expect(stagesPresent(anns)).toEqual(["DISCOVER", "COLLECT", "STORE"]);
  });
});

describe("stageIndex", () => {
  it("returns 0 for DISCOVER", () => {
    expect(stageIndex("DISCOVER")).toBe(0);
  });
  it("returns 7 for PRESENT", () => {
    expect(stageIndex("PRESENT")).toBe(7);
  });
});

describe("inferLatestStage", () => {
  it("owner_verified → VERIFY", () => {
    expect(inferLatestStage("owner_verified")).toBe("VERIFY");
  });
  it("authoritative → VERIFY", () => {
    expect(inferLatestStage("authoritative")).toBe("VERIFY");
  });
  it("directory → STORE", () => {
    expect(inferLatestStage("directory")).toBe("STORE");
  });
  it("unknown → null", () => {
    expect(inferLatestStage("unknown")).toBeNull();
    expect(inferLatestStage(undefined)).toBeNull();
  });
});

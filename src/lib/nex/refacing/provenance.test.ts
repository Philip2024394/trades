// provenance.test.ts — PR-18 composition provenance validation.

import { describe, it, expect } from "vitest";
import {
  validateCompositionProvenance,
  tryValidateCompositionProvenance,
  PR18ProvenanceError,
} from "./provenance";
import type { ComponentRole } from "./image-schema";

describe("validateCompositionProvenance", () => {
  const knownIds = new Set(["img_a", "img_b", "img_c"]);

  it("passes when no roles are claimed and provenance is empty", () => {
    expect(() =>
      validateCompositionProvenance(null, [], [], knownIds)
    ).not.toThrow();
  });

  it("passes when every claimed role has a matching provenance entry", () => {
    const claimed: ComponentRole[] = ["baluster", "newel"];
    const provenance = [
      { component_role: "baluster" as ComponentRole, image_id: "img_a", source: "reference_library" as const },
      { component_role: "newel" as ComponentRole,    image_id: "img_b", source: "reference_library" as const },
    ];
    expect(() =>
      validateCompositionProvenance(null, claimed, provenance, knownIds)
    ).not.toThrow();
  });

  it("throws PR18ProvenanceError when a claimed role has no provenance", () => {
    const claimed: ComponentRole[] = ["baluster", "handrail"];
    const provenance = [
      { component_role: "baluster" as ComponentRole, image_id: "img_a", source: "reference_library" as const },
    ];
    expect(() =>
      validateCompositionProvenance("rf_test", claimed, provenance, knownIds)
    ).toThrow(PR18ProvenanceError);
  });

  it("throws when provenance points to an unknown image_id", () => {
    const claimed: ComponentRole[] = ["baluster"];
    const provenance = [
      { component_role: "baluster" as ComponentRole, image_id: "img_ghost", source: "reference_library" as const },
    ];
    expect(() =>
      validateCompositionProvenance("rf_test", claimed, provenance, knownIds)
    ).toThrow(PR18ProvenanceError);
  });

  it("error message names the missing roles and untraceable entries", () => {
    const claimed: ComponentRole[] = ["baluster", "handrail"];
    const provenance = [
      { component_role: "baluster" as ComponentRole, image_id: "img_ghost", source: "reference_library" as const },
    ];
    try {
      validateCompositionProvenance("rf_test", claimed, provenance, knownIds);
      expect(false).toBe(true);
    } catch (err) {
      const e = err as PR18ProvenanceError;
      expect(e.missingComponentRoles).toContain("handrail");
      expect(e.untraceableEntries.map((u) => u.image_id)).toContain("img_ghost");
      expect(e.message).toMatch(/PR-18/);
    }
  });

  it("try* variant returns ok:true on success", () => {
    const r = tryValidateCompositionProvenance(null, [], [], knownIds);
    expect(r.ok).toBe(true);
  });

  it("try* variant returns ok:false with error on failure", () => {
    const r = tryValidateCompositionProvenance(
      "rf_test",
      ["baluster"],
      [],
      knownIds
    );
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.error).toBeInstanceOf(PR18ProvenanceError);
  });
});

// validators.test.ts — PR-16 + PR-13 + PR-18 enforcement.

import { describe, it, expect } from "vitest";
import {
  validatePR16,
  validatePR13NoNexPriceOnCase,
  validateRefacingCase,
  PR16ConfidenceError,
  PR13PriceOnCaseError,
} from "./validators";
import { PR18ProvenanceError } from "./provenance";
import type { RefacingCase } from "./case-schema";
import type { ImagesV3Entry } from "./image-schema";
import type { CompositionProvenance } from "./provenance";
import { newRefacingCaseId } from "./case-id";

// ─── PR-16 tests ───────────────────────────────────────────────────────────

describe("validatePR16", () => {
  it("passes on an entry with proper confidence siblings", () => {
    const entry = {
      image_id: "img_x",
      component_role: "whole_staircase",
      component_role_confidence: "observed",
      material: "wood",
      material_confidence: "observed",
      sub_material: "oak",
      sub_material_confidence: "inferred",
    };
    expect(() => validatePR16(entry)).not.toThrow();
  });

  it("rejects an entry missing component_role_confidence", () => {
    const entry = {
      component_role: "whole_staircase",
      material: "wood",
      material_confidence: "observed",
      sub_material: "oak",
      sub_material_confidence: "inferred",
    };
    expect(() => validatePR16(entry)).toThrow(PR16ConfidenceError);
    try {
      validatePR16(entry);
    } catch (err) {
      expect((err as PR16ConfidenceError).reason).toBe("missing_confidence_sibling");
      expect((err as PR16ConfidenceError).field).toBe("component_role");
    }
  });

  it("rejects a banned certainty-named field (species)", () => {
    const entry = {
      species: "oak", // BANNED per PR-16 field-naming rule
      component_role: "tread",
      component_role_confidence: "observed",
    };
    expect(() => validatePR16(entry)).toThrow(PR16ConfidenceError);
    try {
      validatePR16(entry);
    } catch (err) {
      expect((err as PR16ConfidenceError).reason).toBe("banned_field_name");
      expect((err as PR16ConfidenceError).field).toBe("species");
    }
  });

  it("rejects a banned certainty-named field (tread_count)", () => {
    const entry = { tread_count: 12 };
    expect(() => validatePR16(entry)).toThrow(PR16ConfidenceError);
  });

  it("rejects an invalid confidence value", () => {
    const entry = {
      component_role: "tread",
      component_role_confidence: "definitely",
    };
    expect(() => validatePR16(entry)).toThrow(PR16ConfidenceError);
    try {
      validatePR16(entry);
    } catch (err) {
      expect((err as PR16ConfidenceError).reason).toBe("invalid_confidence_value");
    }
  });

  it("recurses into nested objects (geometry inner fields)", () => {
    const entry = {
      component_role: "whole_staircase",
      component_role_confidence: "observed",
      geometry: {
        configuration: "straight",
        // MISSING configuration_confidence · nested
      },
    };
    expect(() => validatePR16(entry)).toThrow(PR16ConfidenceError);
  });

  it("recurses into arrays", () => {
    const entry = {
      component_role: "whole_staircase",
      component_role_confidence: "observed",
      flights: [
        {
          visible_tread_count: 9,
          // MISSING visible_tread_count_confidence
        },
      ],
    };
    expect(() => validatePR16(entry)).toThrow(PR16ConfidenceError);
  });
});

// ─── PR-13 tests ───────────────────────────────────────────────────────────

describe("validatePR13NoNexPriceOnCase", () => {
  it("passes on a Case with no price fields", () => {
    const c = { refacing_case_id: "rf_abc_def", something_else: "ok" };
    expect(() => validatePR13NoNexPriceOnCase(c)).not.toThrow();
  });

  it("rejects nex_indicative_price", () => {
    const c = { nex_indicative_price: 2800 };
    expect(() => validatePR13NoNexPriceOnCase(c)).toThrow(PR13PriceOnCaseError);
  });

  it("rejects starting_from", () => {
    const c = { starting_from: 2800 };
    expect(() => validatePR13NoNexPriceOnCase(c)).toThrow(PR13PriceOnCaseError);
  });

  it("rejects deeply-nested price fields", () => {
    const c = {
      selected_design: {
        summary: { our_price: 2800 },
      },
    };
    expect(() => validatePR13NoNexPriceOnCase(c)).toThrow(PR13PriceOnCaseError);
  });
});

// ─── PR-18 tests · via validateRefacingCase ────────────────────────────────

function makeMinimalDraft(): RefacingCase {
  return {
    refacing_case_id: newRefacingCaseId(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: "DRAFT",
    existing_staircase: { photos: [], customer_confirmed: false },
    customer_intent: { feelings: [], intent_entries: [] },
    unknown_items: [],
    composition_provenance: [],
  };
}

describe("validateRefacingCase", () => {
  it("passes on a DRAFT with no selected_design + empty provenance", () => {
    const c = makeMinimalDraft();
    expect(() =>
      validateRefacingCase(c, { knownImageIds: new Set() })
    ).not.toThrow();
  });

  it("rejects when selected_design claims a component with no provenance", () => {
    const c = makeMinimalDraft();
    c.status = "DESIGN_SELECTED";
    c.selected_design = {
      direction: "safe-centre",
      name: "Oak Modern",
      reason_for_existing: "Broadly appealing",
      key_materials_description: "Oak + black metal",
      canonical_profile_ids: ["modern_restrained"],
      canonical_profile_ids_confidence: "inferred",
      style: ["modern"],
      mood: ["restrained"],
      material_composition: [],
      reference_image_ids: ["img_hero_1"],
      component_selections: [
        { component_role: "baluster", image_id: "img_bal_1" },
      ],
    };
    // composition_provenance is empty — should throw PR-18
    expect(() =>
      validateRefacingCase(c, { knownImageIds: new Set(["img_hero_1", "img_bal_1"]) })
    ).toThrow(PR18ProvenanceError);
  });

  it("rejects when provenance points to an unknown image_id", () => {
    const c = makeMinimalDraft();
    c.status = "DESIGN_SELECTED";
    c.selected_design = {
      direction: "safe-centre",
      name: "Oak Modern",
      reason_for_existing: "",
      key_materials_description: "",
      canonical_profile_ids: [],
      canonical_profile_ids_confidence: "unknown",
      style: [],
      mood: [],
      material_composition: [],
      reference_image_ids: ["img_hero_1"],
      component_selections: [
        { component_role: "baluster", image_id: "img_bal_ghost" },
      ],
    };
    c.composition_provenance = [
      { component_role: "baluster", image_id: "img_bal_ghost", source: "reference_library" },
    ];
    // img_bal_ghost is NOT in the known set
    expect(() =>
      validateRefacingCase(c, { knownImageIds: new Set(["img_hero_1"]) })
    ).toThrow(PR18ProvenanceError);
  });

  it("passes when every claimed component has provenance and every provenance is known", () => {
    const c = makeMinimalDraft();
    c.status = "DESIGN_SELECTED";
    c.selected_design = {
      direction: "safe-centre",
      name: "Oak Modern",
      reason_for_existing: "",
      key_materials_description: "",
      canonical_profile_ids: [],
      canonical_profile_ids_confidence: "unknown",
      style: [],
      mood: [],
      material_composition: [],
      reference_image_ids: ["img_hero_1", "img_bal_1"],
      component_selections: [
        { component_role: "baluster", image_id: "img_bal_1" },
      ],
    };
    c.composition_provenance = [
      { component_role: "baluster", image_id: "img_bal_1", source: "reference_library" },
    ];
    expect(() =>
      validateRefacingCase(c, { knownImageIds: new Set(["img_hero_1", "img_bal_1"]) })
    ).not.toThrow();
  });

  it("rejects a Case that sneaks in a NEX price field", () => {
    const c = makeMinimalDraft();
    // TS won't let us add nex_indicative_price directly, but casting simulates a
    // rogue write path in production. Validators should catch it.
    (c as unknown as Record<string, unknown>).nex_indicative_price = 2800;
    expect(() =>
      validateRefacingCase(c, { knownImageIds: new Set() })
    ).toThrow(PR13PriceOnCaseError);
  });
});

// NEX Geometry Module — Jurisdiction rules as typed constants.
//
// Source of truth for humans: data/nex-staircase-geometry/jurisdictions.yaml
// This file mirrors the YAML for runtime type-safe access.
// Keep them in sync when updating regulation values.
//
// Every numeric limit carries its source (`regulation` vs `practical`)
// and citation. See Master Doc §Jurisdictions.

import type { Jurisdiction, JurisdictionStaircaseRules, BuildingType } from "./types";

const ENGLAND_DWELLING: JurisdictionStaircaseRules = {
  rise_mm: {
    max: {
      value: 220,
      source: "regulation",
      citation: "Approved Document K, staircase geometry for dwellings",
    },
    min: {
      value: 150,
      source: "practical",
      citation: "workshop convention; not regulated",
    },
  },
  going_mm: {
    min: {
      value: 220,
      source: "regulation",
      citation: "Approved Document K, staircase geometry for dwellings",
    },
    max: {
      value: 300,
      source: "practical",
      citation: "workshop convention; not regulated",
    },
  },
  pitch_deg: {
    max: {
      value: 42,
      source: "regulation",
      citation: "Approved Document K, staircase geometry for dwellings",
    },
  },
  headroom_mm: {
    min: {
      value: 2000,
      source: "regulation",
      citation: "Approved Document K, minimum headroom for staircases",
    },
  },
  consistency: {
    all_rises_equal: true,
    all_goings_equal: true,
    source: "regulation",
    citation: "Approved Document K, requirement for consistent geometry",
  },
  flight: {
    max_consecutive_risers: {
      value: 36,
      source: "regulation",
      citation: "Approved Document K — change of direction / landing required beyond 36 consecutive risers",
    },
    recommended_max_risers: {
      value: 16,
      source: "practical",
      citation: "Design best practice for domestic straight flights — beyond 16 risers a landing or turn is typical",
    },
  },
};

const IRELAND_DWELLING: JurisdictionStaircaseRules = {
  rise_mm: {
    max: {
      value: 220,
      source: "regulation",
      citation: "Technical Guidance Document K (Ireland), staircase geometry for dwellings",
    },
    min: {
      value: 150,
      source: "practical",
      citation: "workshop convention; not regulated",
    },
  },
  going_mm: {
    min: {
      value: 220,
      source: "regulation",
      citation: "Technical Guidance Document K (Ireland), staircase geometry for dwellings",
    },
    max: {
      value: 300,
      source: "practical",
      citation: "workshop convention; not regulated",
    },
  },
  pitch_deg: {
    max: {
      value: 42,
      source: "regulation",
      citation: "Technical Guidance Document K (Ireland), staircase geometry for dwellings",
    },
  },
  headroom_mm: {
    min: {
      value: 2000,
      source: "regulation",
      citation: "Technical Guidance Document K (Ireland), staircase geometry for dwellings",
    },
  },
  consistency: {
    all_rises_equal: true,
    all_goings_equal: true,
    source: "regulation",
    citation: "Technical Guidance Document K (Ireland), requirement for consistent geometry",
  },
  flight: {
    max_consecutive_risers: {
      value: 16,
      source: "regulation",
      citation: "Technical Guidance Document K (Ireland) — no more than 16 risers in any one flight; landing required beyond",
    },
    recommended_max_risers: {
      value: 16,
      source: "practical",
      citation: "Matches Irish regulation — no separate best-practice threshold",
    },
  },
};

/** Every populated (jurisdiction × building_type) rule set.
 *  Add to this table when a new jurisdiction or building type is
 *  needed. Update the YAML at data/nex-staircase-geometry/jurisdictions.yaml
 *  in the same commit. */
export const JURISDICTIONS: {
  readonly [J in Jurisdiction]: {
    readonly display_name: string;
    readonly primary_regulation_document: string;
    readonly building_types: {
      readonly [B in BuildingType]?: JurisdictionStaircaseRules;
    };
  };
} = {
  england: {
    display_name: "England (Building Regulations)",
    primary_regulation_document: "Approved Document K — Stairs, ladders, and ramps",
    building_types: {
      dwelling: ENGLAND_DWELLING,
    },
  },
  republic_of_ireland: {
    display_name: "Republic of Ireland (Building Regulations)",
    primary_regulation_document: "Technical Guidance Document K — Stairways, Ladders, Ramps and Guards",
    building_types: {
      dwelling: IRELAND_DWELLING,
    },
  },
};

/** Convenience — throws if the (jurisdiction, building_type) pair isn't populated.
 *  Callers should catch and surface a "no rules for X" message. */
export function getRules(jurisdiction: Jurisdiction, building_type: BuildingType): JurisdictionStaircaseRules {
  const j = JURISDICTIONS[jurisdiction];
  if (!j) {
    throw new Error(
      `No jurisdiction rules populated for jurisdiction=${jurisdiction}. ` +
      `Add it to data/nex-staircase-geometry/jurisdictions.yaml AND src/lib/nex/staircase-geometry/jurisdictions.ts.`
    );
  }
  const rules = j.building_types[building_type];
  if (!rules) {
    throw new Error(
      `No jurisdiction rules populated for ${jurisdiction} × ${building_type}. ` +
      `Add them to data/nex-staircase-geometry/jurisdictions.yaml AND src/lib/nex/staircase-geometry/jurisdictions.ts.`
    );
  }
  return rules;
}

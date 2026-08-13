// User Identity types — the 10-register classification model.
//
// Doctrine: docs/brains/nex-user-identity-brain-philip-2026-08-03.md
// Composes with Foundation Brain 13 (Match User Knowledge).

export type IdentityRegister =
  | "homeowner_novice"
  | "homeowner_informed"
  | "builder"
  | "joiner"
  | "architect"
  | "interior_designer"
  | "developer"
  | "manufacturer"
  | "student"
  | "diy"
  | "business_owner";

export const IDENTITY_REGISTERS: readonly IdentityRegister[] = [
  "homeowner_novice", "homeowner_informed", "builder", "joiner",
  "architect", "interior_designer", "developer", "manufacturer",
  "student", "diy", "business_owner",
] as const;

export type IdentityClassification = {
  register: IdentityRegister;
  /** Confidence 0..1 · <0.7 → ask a clarifying question (Brain 14). */
  confidence: number;
  /** Matched signal keywords for telemetry. */
  matched_signals: readonly string[];
  /** Original input. */
  original: string;
  /** Human-readable reason. */
  reason: string;
  /** True when caller should ask a clarifying question via Goal Layer. */
  needs_clarification: boolean;
};

/** Audience level for Knowledge Layer filtering. */
export function registerToAudienceLevel(register: IdentityRegister): 1 | 2 | 3 {
  switch (register) {
    case "homeowner_novice":
    case "student":
    case "diy":
      return 1;
    case "homeowner_informed":
    case "business_owner":
      return 2;
    case "builder":
    case "joiner":
    case "architect":
    case "interior_designer":
    case "developer":
    case "manufacturer":
      return 3;
  }
}

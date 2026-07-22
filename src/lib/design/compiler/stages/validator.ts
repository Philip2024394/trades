// Stage 13 · Prompt Validator.
// Deterministic checks that the assembled prompt has every section
// required for its surface. Fails loudly rather than sending an
// under-specified prompt to the model.
//
// Per V3 Q13 spec — nothing missing.

import type { DesignIR, Surface } from "../ir";
import type { PromptSection } from "../types";

export type ValidationResult = {
  ok:      boolean;
  errors:  Array<{ path: string; message: string }>;
};

const REQUIRED_SECTIONS_BY_SURFACE: Record<Surface, string[]> = {
  "vehicle":         ["IDENTITY", "VEHICLE", "LAYOUT", "COLOUR", "OUTPUT", "CONSTRAINTS"],
  "logo":            ["IDENTITY",            "LAYOUT", "COLOUR", "TYPOGRAPHY", "OUTPUT", "CONSTRAINTS"],
  "business-card":   ["IDENTITY",            "LAYOUT", "COLOUR", "TYPOGRAPHY", "OUTPUT", "CONSTRAINTS"],
  "website":         ["IDENTITY",            "LAYOUT", "COLOUR", "TYPOGRAPHY", "OUTPUT", "CONSTRAINTS"],
  "workwear":        ["IDENTITY",            "LAYOUT", "COLOUR",               "OUTPUT", "CONSTRAINTS"],
  "signage":         ["IDENTITY",            "LAYOUT", "COLOUR", "TYPOGRAPHY", "OUTPUT", "CONSTRAINTS"],
  "social":          ["IDENTITY",            "LAYOUT", "COLOUR",               "OUTPUT", "CONSTRAINTS"],
  "print":           ["IDENTITY",            "LAYOUT", "COLOUR", "TYPOGRAPHY", "OUTPUT", "CONSTRAINTS"],
  "invoice":         ["IDENTITY",            "LAYOUT", "COLOUR", "TYPOGRAPHY", "OUTPUT", "CONSTRAINTS"],
  "letterhead":      ["IDENTITY",            "LAYOUT", "COLOUR", "TYPOGRAPHY", "OUTPUT", "CONSTRAINTS"],
  "email-signature": ["IDENTITY",            "LAYOUT", "COLOUR", "TYPOGRAPHY", "OUTPUT"]
};

export function validate(ir: DesignIR, sections: PromptSection[]): ValidationResult {
  const errors: ValidationResult["errors"] = [];
  const presentNames = new Set(sections.filter((s) => s.content.trim().length > 0).map((s) => s.name));
  const required = REQUIRED_SECTIONS_BY_SURFACE[ir.intent.surface] ?? [];

  for (const name of required) {
    if (!presentNames.has(name)) {
      errors.push({ path: `sections.${name}`, message: `Missing required section for ${ir.intent.surface}` });
    }
  }

  // Business name is universally required
  if (!ir.business.name || ir.business.name.trim().length < 2) {
    errors.push({ path: "business.name", message: "Business name required" });
  }

  // At least one output spec
  if (!ir.outputs || ir.outputs.length === 0) {
    errors.push({ path: "outputs", message: "At least one output spec required" });
  }

  // Colour palette must be valid hex
  const hexRe = /^#[0-9A-Fa-f]{6}$/;
  if (!hexRe.test(ir.colour.primary))   errors.push({ path: "colour.primary",   message: "Invalid hex" });
  if (!hexRe.test(ir.colour.secondary)) errors.push({ path: "colour.secondary", message: "Invalid hex" });
  if (!hexRe.test(ir.colour.accent))    errors.push({ path: "colour.accent",    message: "Invalid hex" });

  return { ok: errors.length === 0, errors };
}

// Stage 3 · Constraint Resolver.
// Every capability + surface + trade contributes constraints. This
// stage merges them into a deduplicated Constraint[] the compiler
// uses in Stage 11 (Prompt Assembly).
//
// Preservation language beats negation per V3 Q13 spec.

import type { Constraint, Surface } from "../ir";

// ─── Universal preservation constraints ─────────────────────────

const UNIVERSAL_PRESERVATIONS: Omit<Constraint, "source">[] = [
  { kind: "forbid",   target: "gradients",            reason: "Cheapens the design" },
  { kind: "forbid",   target: "chrome_effects",       reason: "Dated aesthetic" },
  { kind: "forbid",   target: "drop_shadows",         reason: "Amateur signal" },
  { kind: "forbid",   target: "bevel",                reason: "2005-era design cue" },
  { kind: "forbid",   target: "glow",                 reason: "Amateur signal" },
  { kind: "forbid",   target: "clip_art",             reason: "Never appropriate for premium trade branding" },
  { kind: "forbid",   target: "carbon_fibre_texture", reason: "Dated automotive cliche" },
  { kind: "forbid",   target: "multiple_hero_images", reason: "Rule of one hero" }
];

// ─── Vehicle-surface preservations (DVLA + safety) ──────────────

const VEHICLE_PRESERVATIONS: Omit<Constraint, "source">[] = [
  { kind: "preserve", target: "headlights",         reason: "DVLA compliance" },
  { kind: "preserve", target: "tail_lights",        reason: "DVLA compliance" },
  { kind: "preserve", target: "wheel_arches",       reason: "Panel geometry safety" },
  { kind: "preserve", target: "mirrors",            reason: "Safety + panel geometry" },
  { kind: "preserve", target: "registration_plate", reason: "DVLA legal visibility" },
  { kind: "preserve", target: "door_handles",       reason: "Functional access" },
  { kind: "preserve", target: "rear_door_shut_line", reason: "Do not wrap graphics across the seam" }
];

// ─── Print-surface preservations ────────────────────────────────

const PRINT_PRESERVATIONS: Omit<Constraint, "source">[] = [
  { kind: "require", target: "cmyk_colour_space", reason: "Print production" },
  { kind: "require", target: "300_dpi_min",       reason: "Print quality" },
  { kind: "require", target: "3mm_bleed",         reason: "Print bleed" },
  { kind: "require", target: "safe_area_5mm",     reason: "Crop safety" }
];

/** Build the merged Constraint[] for a given surface + trade. */
export function resolveConstraints(surface: Surface, trade: string, extra: Constraint[] = []): Constraint[] {
  const out: Constraint[] = [];

  UNIVERSAL_PRESERVATIONS.forEach((c) => out.push({ ...c, source: "universal" }));

  if (surface === "vehicle") {
    VEHICLE_PRESERVATIONS.forEach((c) => out.push({ ...c, source: "vehicle-surface" }));
  }
  if (surface === "print" || surface === "business-card" || surface === "letterhead" || surface === "invoice") {
    PRINT_PRESERVATIONS.forEach((c) => out.push({ ...c, source: "print-surface" }));
  }

  // Trade-specific — placeholder; DIL Trade Intelligence provides these
  // once V3 Q14 module implementation ships. For now, surface-only.
  void trade;

  // Explicit constraints from caller (e.g. Studio App's manifest.qa.rules)
  extra.forEach((c) => out.push(c));

  // Dedupe by (kind|target)
  const seen = new Set<string>();
  return out.filter((c) => {
    const k = `${c.kind}|${c.target}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

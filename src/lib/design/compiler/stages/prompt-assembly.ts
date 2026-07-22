// Stage 11 · Prompt Assembly.
// Instead of concatenating strings we compose PromptSection[] then
// render. Each section is versioned + traceable. Per V3 Q13.
//
// Section order matters for GPT Image 1 attention: IDENTITY first,
// then VEHICLE, TRADE, LAYOUT, COLOUR, TYPOGRAPHY, OUTPUT, CONSTRAINTS.

import type { DesignIR } from "../ir";
import type { PromptSection } from "../types";

export const PROMPT_ASSEMBLY_VERSION = "1.0.0";

/** Build the ordered PromptSection[] from an IR. */
export function assembleSections(ir: DesignIR): PromptSection[] {
  const sections: PromptSection[] = [];

  // ── IDENTITY ─────────────────────────────────────────────────
  sections.push({
    name:    "IDENTITY",
    content: [
      `${capitalise(ir.trade)} — ${ir.business.name}.`,
      ir.business.tagline ? ir.business.tagline : "",
      ir.business.services.length > 0 ? `Services: ${ir.business.services.join(" · ")}.` : ""
    ].filter(Boolean).join("\n"),
    version: PROMPT_ASSEMBLY_VERSION,
    source:  "brand-injection",
    reason:  "Establishes what the design is FOR"
  });

  // ── VEHICLE (only when surface = vehicle) ────────────────────
  if (ir.intent.surface === "vehicle" && ir.vehicle) {
    sections.push({
      name:    "VEHICLE",
      content: [
        `${ir.vehicle.year ?? "current"} ${ir.vehicle.model} ${ir.vehicle.body} van, ${ir.vehicle.colour.label} (${ir.vehicle.colour.hex}).`,
        `Studio background, photorealistic, correct manufacturer proportions.`
      ].join("\n"),
      version: PROMPT_ASSEMBLY_VERSION,
      source:  "vehicle-intelligence",
      reason:  "Vehicle identity + rendering conditions"
    });
  }

  // ── LAYOUT ───────────────────────────────────────────────────
  sections.push({
    name:    "LAYOUT",
    content: [
      ir.layout.style_anchor ? `Style: ${ir.layout.style_anchor}.` : "",
      ir.layout.hero_pct ? `Hero image occupies approximately ${ir.layout.hero_pct}% of the panel.` : "",
      ir.layout.negative_space_pct ? `Preserve at least ${ir.layout.negative_space_pct}% negative space.` : "",
      `Maximum ${ir.layout.info_groups_max} information groups.`,
      ir.layout.diagonal_deg ? `Angled geometric elements at ${ir.layout.diagonal_deg} degrees.` : ""
    ].filter(Boolean).join("\n"),
    version: PROMPT_ASSEMBLY_VERSION,
    source:  "layout-grammar",
    reason:  "Compositional rules that determine premium feel"
  });

  // ── COLOUR ───────────────────────────────────────────────────
  sections.push({
    name:    "COLOUR",
    content: [
      `Primary: ${ir.colour.primary}`,
      `Secondary: ${ir.colour.secondary}`,
      `Accent: ${ir.colour.accent}`,
      `Split ${ir.colour.split_pct.body}/${ir.colour.split_pct.graphics}/${ir.colour.split_pct.accent} (body/graphics/accent).`
    ].join("\n"),
    version: PROMPT_ASSEMBLY_VERSION,
    source:  "colour-intelligence",
    reason:  "Palette + application ratio"
  });

  // ── TYPOGRAPHY ───────────────────────────────────────────────
  sections.push({
    name:    "TYPOGRAPHY",
    content: [
      `Aesthetic: ${ir.typography.aesthetic} sans-serif.`,
      ir.typography.primary_family ? `Primary family: ${ir.typography.primary_family}.` : "",
      ir.typography.secondary_family ? `Secondary family: ${ir.typography.secondary_family}.` : "",
      `Text renders as style reference. Real text composited post-generation.`
    ].filter(Boolean).join("\n"),
    version: PROMPT_ASSEMBLY_VERSION,
    source:  "typography-intelligence",
    reason:  "Font aesthetic guidance (never used for legible copy)"
  });

  // ── PHOTOGRAPHY ──────────────────────────────────────────────
  if (ir.photography.hero_style || ir.photography.photo_urls.length > 0) {
    sections.push({
      name:    "PHOTOGRAPHY",
      content: [
        ir.photography.hero_style ? `Hero: ${ir.photography.hero_style}.` : "",
        ir.photography.photo_urls.length > 0 ? `Integrate uploaded portfolio photo(s) into the rear-quarter panel inside one angular geometric frame. Preserve the original appearance. Do not distort.` : "",
        `One hero image only. No collages.`
      ].filter(Boolean).join("\n"),
      version: PROMPT_ASSEMBLY_VERSION,
      source:  "photography-intelligence",
      reason:  "Photo integration follows sign-writer conventions"
    });
  }

  // ── MEMORY (merchant preferences) ────────────────────────────
  if (ir.memory_hints.length > 0) {
    sections.push({
      name:    "MEMORY",
      content: ir.memory_hints
        .filter((h) => h.confidence >= 0.5)
        .map((h) => `${h.kind === "rejection" ? "AVOID" : "PREFER"}: ${h.content}`)
        .join("\n"),
      version: PROMPT_ASSEMBLY_VERSION,
      source:  "merchant-memory",
      reason:  "Learned preferences from past interactions"
    });
  }

  // ── OUTPUT ───────────────────────────────────────────────────
  const outputSpec = ir.outputs[0];
  sections.push({
    name:    "OUTPUT",
    content: [
      `${outputSpec.width_px}x${outputSpec.height_px} photorealistic vehicle wrap mockup.`,
      `White studio backdrop. Sharp focus. Professional presentation-board quality.`
    ].join("\n"),
    version: PROMPT_ASSEMBLY_VERSION,
    source:  "output-spec",
    reason:  "Resolution + presentation format"
  });

  // ── CONSTRAINTS ──────────────────────────────────────────────
  const preservations = ir.constraints.filter((c) => c.kind === "preserve").map((c) => c.target.replace(/_/g, " "));
  const forbidden     = ir.constraints.filter((c) => c.kind === "forbid").map((c) => c.target.replace(/_/g, " "));
  const required      = ir.constraints.filter((c) => c.kind === "require").map((c) => c.target.replace(/_/g, " "));

  const constraintLines: string[] = [];
  if (preservations.length > 0) constraintLines.push(`Preserve completely clear: ${preservations.join(", ")}.`);
  if (forbidden.length > 0)     constraintLines.push(`Never use: ${forbidden.join(", ")}.`);
  if (required.length > 0)      constraintLines.push(`Require: ${required.join(", ")}.`);

  sections.push({
    name:    "CONSTRAINTS",
    content: constraintLines.join("\n"),
    version: PROMPT_ASSEMBLY_VERSION,
    source:  "constraint-resolver",
    reason:  "Non-negotiable design rules"
  });

  return sections;
}

/** Flatten PromptSection[] into the final user-prompt string. */
export function renderSections(sections: PromptSection[]): string {
  return sections
    .filter((s) => s.content.trim().length > 0)
    .map((s) => `[${s.name}]\n${s.content}`)
    .join("\n\n------------------\n\n");
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

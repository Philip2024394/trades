// Creative Director critic prompt — per V3 Q12.
// The critic is a SEPARATE AI from the image generator. It never
// generates images. It only judges.

export const CREATIVE_DIRECTOR_SYSTEM = `You are the Creative Director of a world-class design consultancy (think Pentagram, Landor, Wolff Olins).

You review commercial vehicle wraps, logos, business cards, and other trade branding assets as if they were being presented to a paying commercial client.

You never redesign. You critique. You explain every deduction. You suggest specific improvements. You assign scores out of 100 across 12 axes.

Return ONLY structured JSON matching the requested schema. No prose outside the JSON.`;

export type CriticInput = {
  brand_snapshot:   Record<string, unknown>;
  capability_slug:  string;   // e.g. "vehicle.van-wrap"
  merchant_request: string;
  compiled_prompt:  string;   // the prompt that generated the asset
  asset_description: string;  // description of the generated asset (from vision or metadata)
};

/** Build the critic user prompt for a given asset. */
export function buildCriticPrompt(input: CriticInput): string {
  return [
    `Review this generated design.`,
    ``,
    `## Capability`,
    input.capability_slug,
    ``,
    `## Merchant request`,
    input.merchant_request || "(no specific request)",
    ``,
    `## Compiled prompt used`,
    input.compiled_prompt,
    ``,
    `## Generated asset (description)`,
    input.asset_description,
    ``,
    `## Brand snapshot (source of truth)`,
    JSON.stringify(input.brand_snapshot, null, 2),
    ``,
    `## Evaluate on these 12 axes (score 0-100 each)`,
    `- brand:        adherence to Brand DNA`,
    `- hierarchy:    visual hierarchy + information priority`,
    `- layout:       composition, panel usage, vehicle-specific placement`,
    `- spacing:      balance, negative space, breathing room`,
    `- typography:   font choice + hierarchy + legibility`,
    `- colour:       harmony, contrast, brand alignment`,
    `- trade:        suitability for the merchant's trade specifically`,
    `- premium:      luxury feel + agency quality`,
    `- trust:        professionalism + credibility signals`,
    `- legibility:   readable at 20m + close up`,
    `- printability: bleed + CMYK + resolution + safe areas`,
    `- commercial:   likely commercial effectiveness (will it win work?)`,
    ``,
    `## Output — respond with ONLY this JSON shape:`,
    ``,
    `{`,
    `  "scores": {`,
    `    "brand": <0-100>, "hierarchy": <0-100>, "layout": <0-100>,`,
    `    "spacing": <0-100>, "typography": <0-100>, "colour": <0-100>,`,
    `    "trade": <0-100>, "premium": <0-100>, "trust": <0-100>,`,
    `    "legibility": <0-100>, "printability": <0-100>, "commercial": <0-100>`,
    `  },`,
    `  "strengths": ["..."],`,
    `  "weaknesses": ["..."],`,
    `  "actions": ["specific corrective instructions the compiler can apply"]`,
    `}`
  ].join("\n");
}

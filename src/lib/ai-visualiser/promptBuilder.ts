// Deterministic prompt builder. Takes the customer's guided design
// choices (already restricted to the merchant's catalogue) and turns
// them into a single generation prompt the AI provider understands.
// No free text ever reaches this function; every input is an option
// key we looked up from the taxonomy.

export type PromptChoices = {
  style?: { key: string; label: string };
  material?: { key: string; label: string };
  colour?: { key: string; label: string; hex?: string };
  hardware: Array<{ key: string; label: string }>;
  productSkus?: string[]; // optional — merchant's actual product references
};

export type BuildPromptInput = {
  leafDisplayName: string;
  choices: PromptChoices;
};

export function buildRenderPrompt(input: BuildPromptInput): string {
  const { leafDisplayName, choices } = input;
  const parts: string[] = [];

  parts.push(
    `A photorealistic UK home renovation render of the ${leafDisplayName} in the attached photo.`
  );

  if (choices.style) {
    parts.push(`Style: ${choices.style.label}.`);
  }
  if (choices.material) {
    parts.push(`Material: ${choices.material.label}.`);
  }
  if (choices.colour) {
    parts.push(
      `Colour / finish: ${choices.colour.label}${choices.colour.hex ? ` (${choices.colour.hex})` : ""}.`
    );
  }
  if (choices.hardware.length > 0) {
    parts.push(
      `Hardware: ${choices.hardware.map((h) => h.label).join(", ")}.`
    );
  }

  parts.push(
    "Preserve the room's proportions, walls, ceiling, windows, doorframes, floor and existing fixed features. Change only the described element. Natural daylight, no fisheye distortion, no extra people, no text, no watermarks, no logos. Realistic materials with accurate reflections and shadows."
  );

  return parts.join(" ");
}

export function summariseChoices(choices: PromptChoices): string {
  const bits: string[] = [];
  if (choices.style) bits.push(choices.style.label);
  if (choices.material) bits.push(choices.material.label);
  if (choices.colour) bits.push(choices.colour.label);
  if (choices.hardware.length > 0)
    bits.push(choices.hardware.map((h) => h.label).join(" + "));
  return bits.join(" · ");
}

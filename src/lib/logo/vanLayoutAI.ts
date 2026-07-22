// Van layout AI — Claude generates and modifies VanLayout JSON.
//
// Two entry points:
//   generateVanLayout(...)  → first-cut layout from business details
//   modifyVanLayout(...)    → apply a user prompt to an existing layout
//
// Both fall back to defaultVanLayout when the Anthropic key is missing
// so the page still works without AI wired.

import { completeJson } from "@/lib/llm/anthropic";
import { defaultVanLayout, type VanLayout } from "./vanLayout";

const MODEL = "claude-opus-4-7";

const SCHEMA_HINT = `
STRICT JSON output. The "elements" array must be objects matching one of:

{ "kind":"logo",    "url":"<absolute image URL>", "xPct":0-100, "yPct":0-100, "wPct":0-100, "hPct":0-100, "rotate":degrees?, "opacity":0-1? }
{ "kind":"text",    "content":"...", "xPct":0-100, "yPct":0-100, "wPct":0-100, "fontSizeVw":0.5-6?, "fontWeight":"normal|bold|black", "colour":"#hex", "align":"left|center|right", "italic":bool?, "letterSpacing":em?, "uppercase":bool?, "shadow":bool? }
{ "kind":"strip",   "xPct":0-100, "yPct":0-100, "wPct":0-100, "hPct":0-100, "backgroundColour":"#hex", "text":"...", "textColour":"#hex", "fontSizeVw":0.5-4?, "radiusPx":0-40? }
{ "kind":"ribbon",  "xPct":0-100, "yPct":0-100, "wPct":0-100, "text":"...", "angle":degrees?, "colour":"#hex", "textColour":"#hex" }
{ "kind":"divider", "xPct":0-100, "yPct":0-100, "wPct":0-100, "colour":"#hex", "heightPx":1-10? }

Return an object shaped: { "van_slug":"...", "elements":[...], "meta":{ "generated_by":"ai" } }
`.trim();

const CONSTRAINTS = `
Design constraints (non-negotiable):
- Signwriting sits on the SIDE PANEL of the van, roughly xPct 25-85 yPct 30-75.
- Never place elements below yPct 78 (that's wheel arch / lower body).
- Never obscure the number plate (bottom rear area).
- Logo + business name are the hero. Phone is a bright strip beneath them.
- Read at 20 metres: strong contrast, bold typography, no fine serifs.
- UK trades expect: name + phone + strap line, and one cert badge if supplied (Gas Safe / NICEIC / FMB).
- No em dashes anywhere in text content.
- No blue/red emergency-service styling unless the trade is explicitly emergency.
`.trim();

export async function generateVanLayout(input: {
  vanSlug:      string;
  logoUrl?:     string | null;
  businessName: string;
  phone:        string;
  strapLine?:   string;
  trade?:       string;    // e.g. "electrician" or "kitchen fitter"
  cert?:        string;    // e.g. "Gas Safe 512345"
  vibe?:        string;    // e.g. "premium", "no-nonsense", "friendly"
  vanColour?:   { hex: string; label: string; aiHint: string };
}): Promise<VanLayout> {
  const prompt = [
    `Design signwriting for a UK tradesperson's van.`,
    ``,
    `BUSINESS:`,
    `- Name: ${input.businessName}`,
    `- Phone: ${input.phone}`,
    input.strapLine ? `- Strap line: ${input.strapLine}` : "",
    input.trade     ? `- Trade: ${input.trade}` : "",
    input.cert      ? `- Cert / registration: ${input.cert}` : "",
    input.vibe      ? `- Desired vibe: ${input.vibe}` : "",
    input.logoUrl   ? `- Logo URL to place: ${input.logoUrl}` : "- No logo yet, skip the logo element",
    ``,
    `VAN:`,
    `- Slug: ${input.vanSlug}`,
    input.vanColour ? `- Paint colour: ${input.vanColour.label} (${input.vanColour.hex})` : "",
    input.vanColour ? `- Colour guidance: ${input.vanColour.aiHint}` : "",
    input.vanColour ? `- CRITICAL: choose text and strip colours that read CLEAN against ${input.vanColour.label}. High contrast, no colour-on-colour clash.` : "",
    ``,
    CONSTRAINTS,
    ``,
    SCHEMA_HINT
  ].filter(Boolean).join("\n");

  const ai = await completeJson<VanLayout>({
    system:      "You are a senior UK vehicle-signwriting designer. Output JSON only, no prose.",
    messages:    [{ role: "user", content: prompt }],
    model:       MODEL,
    maxTokens:   1500,
    temperature: 0.35
  });

  if (!ai || !Array.isArray(ai.elements)) {
    return defaultVanLayout(input);
  }
  // Guarantee the van_slug + AI provenance meta land regardless of
  // what the model returned.
  return {
    ...ai,
    van_slug: input.vanSlug,
    meta:     { ...(ai.meta ?? {}), generated_by: "ai", generated_at: new Date().toISOString() }
  };
}

export async function modifyVanLayout(input: {
  layout: VanLayout;
  prompt: string;
}): Promise<VanLayout> {
  const prompt = [
    `You are editing an existing van signwriting layout. Apply the user's request while preserving everything else that wasn't asked to change.`,
    ``,
    `CURRENT LAYOUT:`,
    JSON.stringify(input.layout, null, 2),
    ``,
    `USER REQUEST:`,
    input.prompt,
    ``,
    CONSTRAINTS,
    ``,
    SCHEMA_HINT
  ].join("\n");

  const ai = await completeJson<VanLayout>({
    system:      "You are a senior UK vehicle-signwriting designer editing an existing layout. Output JSON only, no prose. Preserve fields the user didn't ask to change.",
    messages:    [{ role: "user", content: prompt }],
    model:       MODEL,
    maxTokens:   1500,
    temperature: 0.25
  });

  if (!ai || !Array.isArray(ai.elements)) {
    return input.layout;
  }
  return {
    ...ai,
    van_slug: input.layout.van_slug,
    meta:     {
      ...(ai.meta ?? {}),
      generated_by: "ai",
      prompt:       input.prompt,
      generated_at: new Date().toISOString()
    }
  };
}

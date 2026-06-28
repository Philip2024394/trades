// App Studio Brand resolver — maps the listing's brand columns into
// concrete CSS values that the public profile root applies via custom
// properties. Single source of truth for both trade-service and
// product-template profiles, so updating these tokens flows through
// to every surface that consumes them (PremiumHero, ShopTeaser, CTAs,
// product cards, etc.).

export type FontFamilyKey =
  | "system"
  | "inter"
  | "roboto"
  | "lora"
  | "playfair"
  | "montserrat";

export type FontScaleKey = "compact" | "normal" | "roomy";

export const FONT_FAMILY_OPTIONS: Array<{
  value: FontFamilyKey;
  label: string;
  stack: string;
  /** Whether the family needs a stylesheet import. We currently rely
   *  on system + Google-font CSS already loaded in `app/layout.tsx`;
   *  this flag lets us decide later whether to lazy-add a <link>. */
  webfont: boolean;
}> = [
  {
    value: "system",
    label: "System (default)",
    stack: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
    webfont: false
  },
  {
    value: "inter",
    label: "Inter (modern, neutral)",
    stack: "'Inter', ui-sans-serif, system-ui, sans-serif",
    webfont: true
  },
  {
    value: "roboto",
    label: "Roboto (clean, friendly)",
    stack: "'Roboto', ui-sans-serif, system-ui, sans-serif",
    webfont: true
  },
  {
    value: "lora",
    label: "Lora (warm serif)",
    stack: "'Lora', Georgia, 'Times New Roman', serif",
    webfont: true
  },
  {
    value: "playfair",
    label: "Playfair Display (premium serif)",
    stack: "'Playfair Display', Georgia, 'Times New Roman', serif",
    webfont: true
  },
  {
    value: "montserrat",
    label: "Montserrat (bold, retail)",
    stack: "'Montserrat', ui-sans-serif, system-ui, sans-serif",
    webfont: true
  }
];

export const FONT_SCALE_OPTIONS: Array<{
  value: FontScaleKey;
  label: string;
  /** Multiplier applied to body + heading sizes via the
   *  `--trade-scale` CSS var. 1.0 = unchanged. */
  multiplier: number;
}> = [
  { value: "compact", label: "Compact (denser)", multiplier: 0.94 },
  { value: "normal", label: "Normal (default)", multiplier: 1 },
  { value: "roomy", label: "Roomy (larger)", multiplier: 1.08 }
];

export function fontStackFor(key: string | null | undefined): string {
  const match = FONT_FAMILY_OPTIONS.find((o) => o.value === key);
  return (match ?? FONT_FAMILY_OPTIONS[0]).stack;
}

export function fontScaleMultiplier(key: string | null | undefined): number {
  const match = FONT_SCALE_OPTIONS.find((o) => o.value === key);
  return (match ?? FONT_SCALE_OPTIONS[1]).multiplier;
}

/** Resolve the four App Studio Brand fields into CSS custom-property
 *  values. Drop into a `style={...}` on the page root and the rest of
 *  the public profile reads via var(...). Safe defaults so a listing
 *  with no overrides matches the historic look exactly. */
export function brandCssVars(input: {
  theme_color: string | null | undefined;
  body_text_color: string | null | undefined;
  font_family: string | null | undefined;
  font_scale: string | null | undefined;
}): Record<string, string> {
  const accent = sanitiseHex(input.theme_color, "#FFB300");
  const text = sanitiseHex(input.body_text_color, "#0A0A0A");
  const stack = fontStackFor(input.font_family);
  const scale = fontScaleMultiplier(input.font_scale);
  return {
    "--trade-accent": accent,
    "--trade-text": text,
    "--trade-font": stack,
    "--trade-scale": String(scale)
  };
}

function sanitiseHex(value: string | null | undefined, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed) ? trimmed : fallback;
}

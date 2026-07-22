// Van layout schema — the structured spec Claude generates and our
// compositor renders. Bounded to five element kinds so the AI can
// output reliable JSON and the renderer stays print-file-friendly.
//
// Coordinates are percentages of the van image bounds (0-100).
// Sizes for text are relative units (rem-ish) that scale with the
// preview container; downstream print export converts to mm.

export type LayoutElement =
  | LogoElement
  | TextElement
  | StripElement
  | RibbonElement
  | DividerElement;

export type LogoElement = {
  kind:    "logo";
  url:     string;    // absolute URL, usually one of the catalog samples
  xPct:    number;
  yPct:    number;
  wPct:    number;
  hPct:    number;
  rotate?: number;    // degrees
  opacity?: number;   // 0-1
};

export type TextElement = {
  kind:          "text";
  content:       string;
  xPct:          number;
  yPct:          number;
  wPct:          number;
  fontSizeVw?:   number;    // font-size in vw units (default 2.5)
  fontWeight?:   "normal" | "bold" | "black";
  colour:        string;    // hex
  align?:        "left" | "center" | "right";
  italic?:       boolean;
  letterSpacing?: number;   // em
  uppercase?:    boolean;
  shadow?:       boolean;
};

export type StripElement = {
  kind:             "strip";
  xPct:             number;
  yPct:             number;
  wPct:             number;
  hPct:             number;
  backgroundColour: string;
  text?:            string;
  textColour?:      string;
  fontSizeVw?:      number;
  radiusPx?:        number;
};

export type RibbonElement = {
  kind:        "ribbon";
  xPct:        number;
  yPct:        number;
  wPct:        number;
  text:        string;
  angle?:      number;     // degrees, default -8
  colour:      string;
  textColour:  string;
};

export type DividerElement = {
  kind:    "divider";
  xPct:    number;
  yPct:    number;
  wPct:    number;
  colour:  string;
  heightPx?: number;
};

export type VanLayout = {
  van_slug: string;
  elements: LayoutElement[];
  meta?: {
    generated_by?: "ai" | "default";
    prompt?:       string;
    generated_at?: string;
  };
};

/** Deterministic fallback layout used when the AI is unavailable or
 *  keyless. Produces a sensible signwriting design so the page still
 *  reads as intended without an API call. */
export function defaultVanLayout(input: {
  vanSlug:      string;
  logoUrl?:     string | null;
  businessName: string;
  phone:        string;
  strapLine?:   string;
}): VanLayout {
  const elements: LayoutElement[] = [];
  if (input.logoUrl) {
    elements.push({
      kind: "logo", url: input.logoUrl,
      xPct: 30, yPct: 38, wPct: 16, hPct: 24
    });
  }
  if (input.businessName) {
    elements.push({
      kind: "text", content: input.businessName,
      xPct: 48, yPct: 44, wPct: 34,
      fontSizeVw: 3.4, fontWeight: "black", colour: "#0A0A0A",
      align: "left", uppercase: true, shadow: true
    });
  }
  if (input.strapLine) {
    elements.push({
      kind: "text", content: input.strapLine,
      xPct: 48, yPct: 55, wPct: 34,
      fontSizeVw: 1.2, fontWeight: "bold", colour: "#0A0A0A",
      align: "left", uppercase: true, letterSpacing: 0.18
    });
  }
  if (input.phone) {
    elements.push({
      kind: "strip",
      xPct: 30, yPct: 66, wPct: 45, hPct: 6,
      backgroundColour: "#0A0A0A", textColour: "#FFB300",
      text: input.phone, fontSizeVw: 2, radiusPx: 6
    });
  }
  return {
    van_slug: input.vanSlug,
    elements,
    meta: { generated_by: "default", generated_at: new Date().toISOString() }
  };
}

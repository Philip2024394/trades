// Van template catalog. One row per van image + angle. Zones define
// where signwriting elements (logo, business name, phone strip) can
// be placed as PERCENTAGES of the container so the composer scales
// cleanly across screen sizes.
//
// Percentages measured from top-left of the image bounds. Any placed
// element is positioned + sized in % of the container so responsive
// scaling stays 1:1.

export type VanZone = {
  /** % from left */          xPct: number;
  /** % from top */           yPct: number;
  /** % width */              wPct: number;
  /** % height (optional) */  hPct?: number;
};

export type VanTemplate = {
  slug:     string;
  model:    string;
  angle:    "driver-side" | "passenger-side" | "front" | "back" | "three-quarter";
  imageUrl: string;
  zones: {
    logo:         VanZone;   // where the logo goes
    businessName: VanZone;   // where the business name text sits
    phone:        VanZone;   // phone-number strip
  };
};

// First 3 van images Philip supplied. Angles marked as
// "three-quarter" pending confirmation of which is which. Zones set
// to reasonable defaults for a side view of a Transit; adjust per
// angle once we see the images render.
export const VAN_TEMPLATES: VanTemplate[] = [
  {
    slug:     "transit-1",
    model:    "Ford Transit",
    angle:    "three-quarter",
    imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledsds-removebg-preview.png",
    zones: {
      logo:         { xPct: 32, yPct: 42, wPct: 14, hPct: 20 },
      businessName: { xPct: 47, yPct: 48, wPct: 32 },
      phone:        { xPct: 32, yPct: 66, wPct: 45 }
    }
  },
  {
    slug:     "transit-2",
    model:    "Ford Transit",
    angle:    "three-quarter",
    imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledsdsdd-removebg-preview.png",
    zones: {
      logo:         { xPct: 32, yPct: 42, wPct: 14, hPct: 20 },
      businessName: { xPct: 47, yPct: 48, wPct: 32 },
      phone:        { xPct: 32, yPct: 66, wPct: 45 }
    }
  },
  {
    slug:     "transit-3",
    model:    "Ford Transit",
    angle:    "three-quarter",
    imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledsdsddd-removebg-preview.png",
    zones: {
      logo:         { xPct: 32, yPct: 42, wPct: 14, hPct: 20 },
      businessName: { xPct: 47, yPct: 48, wPct: 32 },
      phone:        { xPct: 32, yPct: 66, wPct: 45 }
    }
  }
];

export function vanBySlug(slug: string): VanTemplate | undefined {
  return VAN_TEMPLATES.find((v) => v.slug === slug);
}

// ─── Van colours ──────────────────────────────────────────────
//
// Common UK trade-van paint colours. The composer tints the base
// image with the picked colour; the AI is told which colour was
// picked so it chooses contrasting text + strip colours that read
// clean at distance.

export type VanColour = {
  slug:            string;
  label:           string;
  hex:             string;   // paint colour (for the tint layer)
  contrast:        "light" | "dark";  // guides default text colour
  aiHint:          string;   // how to describe it to Claude
};

export const VAN_COLOURS: VanColour[] = [
  { slug: "white",     label: "White",      hex: "#F5F5F5", contrast: "light", aiHint: "clean white van, dark text works best" },
  { slug: "silver",    label: "Silver",     hex: "#B8B8B8", contrast: "light", aiHint: "silver van, dark bold text with high contrast" },
  { slug: "grey",      label: "Grey",       hex: "#5A5A5A", contrast: "dark",  aiHint: "mid-grey van, light or amber text stands out" },
  { slug: "black",     label: "Black",      hex: "#111111", contrast: "dark",  aiHint: "black van, use white or brand yellow for lettering" },
  { slug: "blue",      label: "Blue",       hex: "#1E40AF", contrast: "dark",  aiHint: "deep blue van, white or yellow lettering, avoid navy-on-blue" },
  { slug: "red",       label: "Red",        hex: "#B91C1C", contrast: "dark",  aiHint: "red van, white or black lettering, avoid orange" },
  { slug: "green",     label: "Green",      hex: "#166534", contrast: "dark",  aiHint: "dark green van, white or gold lettering" },
  { slug: "yellow",    label: "Yellow",     hex: "#EAB308", contrast: "light", aiHint: "yellow van, black lettering only" },
  { slug: "orange",    label: "Orange",     hex: "#EA580C", contrast: "dark",  aiHint: "safety orange van, black lettering, high visibility" }
];

export function vanColourBySlug(slug: string): VanColour | undefined {
  return VAN_COLOURS.find((c) => c.slug === slug);
}

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

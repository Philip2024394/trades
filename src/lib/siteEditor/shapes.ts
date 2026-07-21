// Shape library — catalogue for the ShapeDrawer. Each entry is a
// (kind × style) pair the merchant taps to drop a pre-styled shape
// onto the canvas. Style is orthogonal to kind:
//
//   solid     — filled with yellow, no stroke (max attention)
//   outline   — transparent fill, black stroke (badge-style, lets
//               the background image bleed through)
//   bordered  — yellow fill + black stroke (heavy CTA — the "buy
//               button" look Canva ships as its default filled+
//               outlined preset)
//
// Categories in the drawer:
//   basic     — rect / circle / triangle / star
//   arrow     — arrow / line
//   (frames + dividers are planned; extend by adding new entries
//    here — the drawer renders whatever is in SHAPE_LIBRARY)

import type { ShapeLayer } from "./types";

export type ShapeStyle = "solid" | "outline" | "bordered";
export type ShapeCategory = "basic" | "arrow";

export type ShapeCatalogueEntry = {
  id:       string;
  label:    string;
  kind:     ShapeLayer["shape"];
  category: ShapeCategory;
  style:    ShapeStyle;
  /** Palette overrides — defaults come from BRAND_YELLOW / BRAND_BLACK
   *  but individual presets can tint themselves for variety. */
  fill?:    string | null;
  stroke?:  string | null;
  strokeWidth?: number;
};

const YELLOW = "#FFB300";
const BLACK  = "#0A0A0A";

/** Resolve a style preset into the concrete fill/stroke/strokeWidth
 *  the ShapeLayer needs. Overrides on the entry win over defaults. */
export function stylePreset(entry: ShapeCatalogueEntry): {
  fill:        string | null;
  stroke:      string | null;
  strokeWidth: number;
} {
  const s = entry.style;
  const defaults = s === "solid"    ? { fill: YELLOW, stroke: null,  strokeWidth: 0 }
                 : s === "outline"  ? { fill: null,   stroke: BLACK, strokeWidth: 3 }
                 :                    { fill: YELLOW, stroke: BLACK, strokeWidth: 3 };
  return {
    fill:        entry.fill        !== undefined ? entry.fill        : defaults.fill,
    stroke:      entry.stroke      !== undefined ? entry.stroke      : defaults.stroke,
    strokeWidth: entry.strokeWidth !== undefined ? entry.strokeWidth : defaults.strokeWidth
  };
}

export const SHAPE_CATEGORIES: Array<{ slug: ShapeCategory; label: string }> = [
  { slug: "basic", label: "Basic"  },
  { slug: "arrow", label: "Arrows" }
];

export const SHAPE_LIBRARY: ShapeCatalogueEntry[] = [
  // Basic — three style variants each
  { id: "rect-solid",     label: "Solid box",       kind: "rect",     category: "basic", style: "solid"    },
  { id: "rect-outline",   label: "Outline box",     kind: "rect",     category: "basic", style: "outline"  },
  { id: "rect-bordered",  label: "Bordered box",    kind: "rect",     category: "basic", style: "bordered" },
  { id: "circle-solid",   label: "Solid dot",       kind: "circle",   category: "basic", style: "solid"    },
  { id: "circle-outline", label: "Outline dot",     kind: "circle",   category: "basic", style: "outline"  },
  { id: "circle-bordered",label: "Bordered dot",    kind: "circle",   category: "basic", style: "bordered" },
  { id: "triangle-solid", label: "Solid triangle",  kind: "triangle", category: "basic", style: "solid"    },
  { id: "triangle-outline",label:"Outline triangle",kind: "triangle", category: "basic", style: "outline"  },
  { id: "star-solid",     label: "Solid star",      kind: "star",     category: "basic", style: "solid"    },
  { id: "star-outline",   label: "Outline star",    kind: "star",     category: "basic", style: "outline"  },

  // Arrows — stroke-driven so "solid" and "outline" both make sense
  { id: "arrow-solid",    label: "Solid arrow",     kind: "arrow",    category: "arrow", style: "solid"    },
  { id: "arrow-outline",  label: "Outline arrow",   kind: "arrow",    category: "arrow", style: "outline"  }
];

// Paint calculator — 9 UK-real-world scenarios.
//
// Coverage rates (UK decorator standard, NOT the optimistic tin label):
//   Interior wall (smooth)      12 m²/L
//   Interior wall (textured)    10 m²/L
//   Fresh plaster (mist coat)    8 m²/L (then 12 m²/L for top coats)
//   Ceiling (matt emulsion)     11 m²/L
//   Exterior masonry             6 m²/L (textured needs ~5)
//   Timber fence (rough sawn)    5 m²/L
//   Metal railing (smooth)       8 m²/L (allow extra for profile)
//   Gloss / satinwood             14 m²/L per coat (smooth wood)
//
// Per-door / per-window add-ons (separate gloss/satinwood paint, not the
// wall emulsion):
//   Standard internal door (762×1981 mm, both sides + frame) → 0.75 L
//   Standard window (1200×1200 mm, frame + sill + reveal both sides) → 0.5 L
//
// All scenarios output: wall_emulsion_litres + trim_paint_litres +
// total tin combination + warnings + complementary subcategories list.

import type {
  CalculatorOutput,
  CalculatorLabour,
  CalculatorProductRef
} from "./types";

export type PaintScenario =
  | "quick_estimate"
  | "full_room"
  | "single_wall"
  | "external_masonry"
  | "doors_only"
  | "windows_only"
  | "timber_fence"
  | "metal_railing"
  | "skirting_trim";

export type PaintInputs =
  | { scenario: "quick_estimate"; room_type: "small" | "medium" | "large"; coats: 1 | 2 }
  | {
      scenario: "full_room";
      length_m: number;
      width_m: number;
      height_m: number;
      doors: number;
      door_size: "standard" | "tall";
      windows: number;
      window_size: "small" | "standard" | "large";
      include_ceiling: boolean;
      include_floor_paint: boolean;
      surface: "smooth" | "textured" | "fresh_plaster";
      coats: 1 | 2;
      paint_doors_and_windows: boolean;
      waste_10pct: boolean;
    }
  | {
      scenario: "single_wall";
      length_m: number;
      height_m: number;
      surface: "smooth" | "textured" | "fresh_plaster";
      coats: 1 | 2;
      waste_10pct: boolean;
    }
  | {
      scenario: "external_masonry";
      length_m: number;
      height_m: number;
      surface: "smooth" | "textured";
      coats: 1 | 2;
      waste_10pct: boolean;
    }
  | {
      scenario: "doors_only";
      count: number;
      door_size: "standard" | "tall";
      sides: "one" | "both";
      include_frame: boolean;
      coats: 1 | 2;
    }
  | {
      scenario: "windows_only";
      count: number;
      window_size: "small" | "standard" | "large";
      sides: "one" | "both";
      coats: 1 | 2;
    }
  | {
      scenario: "timber_fence";
      length_m: number;
      height_m: number;
      sides: "one" | "both";
      coats: 1 | 2;
    }
  | {
      scenario: "metal_railing";
      length_m: number;
      height_m: number;
      profile: "plain" | "decorative";
      coats: 1 | 2;
    }
  | {
      scenario: "skirting_trim";
      linear_m: number;
      coats: 1 | 2;
    };

// ────────────────────────────────────────────────────────────────────
// Coverage constants
// ────────────────────────────────────────────────────────────────────
const WALL_COVERAGE: Record<"smooth" | "textured" | "fresh_plaster", number> = {
  smooth: 12,
  textured: 10,
  fresh_plaster: 8
};
const CEILING_COVERAGE = 11;
const EXTERIOR_COVERAGE: Record<"smooth" | "textured", number> = {
  smooth: 6,
  textured: 5
};
const FENCE_COVERAGE = 5;
const RAILING_COVERAGE: Record<"plain" | "decorative", number> = {
  plain: 8,
  decorative: 5
};
const TRIM_COVERAGE = 14;

const DOOR_AREA: Record<"standard" | "tall", number> = {
  standard: 0.762 * 1.981,
  tall: 0.838 * 2.135
};
const DOOR_TRIM_PAINT_L: Record<"standard" | "tall", number> = {
  standard: 0.75,
  tall: 0.95
};
const WINDOW_AREA: Record<"small" | "standard" | "large", number> = {
  small: 0.6 * 0.9,
  standard: 1.2 * 1.2,
  large: 1.8 * 1.5
};
const WINDOW_TRIM_PAINT_L: Record<"small" | "standard" | "large", number> = {
  small: 0.3,
  standard: 0.5,
  large: 0.75
};

const QUICK_ROOM_PRESET: Record<
  "small" | "medium" | "large",
  { wall_m2: number; ceiling_m2: number; doors: number; windows: number; label: string }
> = {
  small: { wall_m2: 28, ceiling_m2: 8, doors: 1, windows: 1, label: "Small (e.g. bathroom / box room) — ~28 m² walls + 8 m² ceiling" },
  medium: { wall_m2: 42, ceiling_m2: 14, doors: 1, windows: 1, label: "Medium (e.g. bedroom / dining) — ~42 m² walls + 14 m² ceiling" },
  large: { wall_m2: 56, ceiling_m2: 20, doors: 1, windows: 2, label: "Large (e.g. lounge / open-plan) — ~56 m² walls + 20 m² ceiling" }
};

const TIN_SIZES_L = [10, 5, 2.5, 1];

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────
function packTins(litresNeeded: number): {
  tins: Array<{ size_l: number; count: number }>;
  total_l: number;
} {
  if (litresNeeded <= 0) return { tins: [], total_l: 0 };
  let remaining = litresNeeded;
  const tins: Array<{ size_l: number; count: number }> = [];
  for (const size of TIN_SIZES_L) {
    const n = Math.floor(remaining / size);
    if (n > 0) {
      tins.push({ size_l: size, count: n });
      remaining -= n * size;
    }
  }
  if (remaining > 0.01) {
    const smallest = TIN_SIZES_L.slice().reverse().find((s) => s >= remaining) ?? 1;
    const existing = tins.find((t) => t.size_l === smallest);
    if (existing) existing.count += 1;
    else tins.push({ size_l: smallest, count: 1 });
  }
  const total_l = tins.reduce((acc, t) => acc + t.size_l * t.count, 0);
  return { tins, total_l };
}

function formatTinList(tins: Array<{ size_l: number; count: number }>): string {
  if (tins.length === 0) return "";
  return tins.map((t) => `${t.count} × ${t.size_l}L`).join(" + ");
}

function readNum(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  return fallback;
}

// ────────────────────────────────────────────────────────────────────
// Compute — dispatcher on scenario
// ────────────────────────────────────────────────────────────────────
export function computePaint(
  inputs: PaintInputs,
  product: CalculatorProductRef
): CalculatorOutput {
  switch (inputs.scenario) {
    case "quick_estimate":
      return quickEstimate(inputs, product);
    case "full_room":
      return fullRoom(inputs, product);
    case "single_wall":
      return singleWall(inputs, product);
    case "external_masonry":
      return externalMasonry(inputs, product);
    case "doors_only":
      return doorsOnly(inputs, product);
    case "windows_only":
      return windowsOnly(inputs, product);
    case "timber_fence":
      return timberFence(inputs, product);
    case "metal_railing":
      return metalRailing(inputs, product);
    case "skirting_trim":
      return skirtingTrim(inputs, product);
  }
}

// ────────────────────────────────────────────────────────────────────
// Scenario: Quick estimate
// ────────────────────────────────────────────────────────────────────
function quickEstimate(
  inputs: Extract<PaintInputs, { scenario: "quick_estimate" }>,
  product: CalculatorProductRef
): CalculatorOutput {
  const preset = QUICK_ROOM_PRESET[inputs.room_type];
  const wall_litres = (preset.wall_m2 / WALL_COVERAGE.smooth) * inputs.coats * 1.1;
  const ceiling_litres = (preset.ceiling_m2 / CEILING_COVERAGE) * inputs.coats * 1.1;
  return assembleOutput({
    title: preset.label,
    wall_litres,
    ceiling_litres,
    trim_litres: preset.doors * 0.75 + preset.windows * 0.5,
    product,
    extraLines: [],
    warnings: [
      "Quick estimate — for a tighter figure switch to 'Full room'."
    ]
  });
}

// ────────────────────────────────────────────────────────────────────
// Scenario: Full room (walls + ceiling + optional door/window/floor paint)
// ────────────────────────────────────────────────────────────────────
function fullRoom(
  inputs: Extract<PaintInputs, { scenario: "full_room" }>,
  product: CalculatorProductRef
): CalculatorOutput {
  const length = Math.max(0, inputs.length_m);
  const width = Math.max(0, inputs.width_m);
  const height = Math.max(0, inputs.height_m);

  // All 4 walls = perimeter × height
  const wall_gross = 2 * (length + width) * height;
  const ceiling_m2 = inputs.include_ceiling ? length * width : 0;
  const floor_m2 = inputs.include_floor_paint ? length * width : 0;

  const doors_area = inputs.doors * DOOR_AREA[inputs.door_size];
  const windows_area = inputs.windows * WINDOW_AREA[inputs.window_size];
  const wall_net = Math.max(0, wall_gross - doors_area - windows_area);

  const wall_coverage = WALL_COVERAGE[inputs.surface];
  let wall_litres = (wall_net / wall_coverage) * inputs.coats;
  let ceiling_litres = (ceiling_m2 / CEILING_COVERAGE) * inputs.coats;
  let floor_litres = (floor_m2 / 8) * inputs.coats; // floor paint ~8 m²/L
  let trim_litres = 0;
  if (inputs.paint_doors_and_windows) {
    trim_litres =
      inputs.doors * DOOR_TRIM_PAINT_L[inputs.door_size] +
      inputs.windows * WINDOW_TRIM_PAINT_L[inputs.window_size];
  }

  if (inputs.waste_10pct) {
    wall_litres *= 1.1;
    ceiling_litres *= 1.1;
    floor_litres *= 1.1;
    trim_litres *= 1.1;
  }

  const extraLines = [
    {
      label: "Wall area (net)",
      value: `${wall_net.toFixed(1)} m²`,
      detail: `${wall_gross.toFixed(1)} m² gross − ${(doors_area + windows_area).toFixed(1)} m² openings`,
      tone: "muted" as const
    },
    ...(ceiling_m2 > 0
      ? [
          {
            label: "Ceiling area",
            value: `${ceiling_m2.toFixed(1)} m²`,
            tone: "muted" as const
          }
        ]
      : []),
    ...(floor_m2 > 0
      ? [
          {
            label: "Floor area (if painting)",
            value: `${floor_m2.toFixed(1)} m²`,
            tone: "muted" as const
          }
        ]
      : [])
  ];

  const warnings: string[] = [];
  if (inputs.surface === "fresh_plaster") {
    warnings.push(
      "Fresh plaster needs a mist coat first — water down your first coat 30-40% and let it dry before topcoats."
    );
  }
  if (inputs.coats === 1) {
    warnings.push("Most paints need 2 coats for opacity. We've calculated for 1.");
  }
  if (inputs.include_ceiling && ceiling_litres > 0) {
    warnings.push("Ceilings usually use flat matt emulsion (different product from your wall paint).");
  }

  return assembleOutput({
    title: "Full room — walls + ceiling",
    wall_litres,
    ceiling_litres,
    trim_litres,
    floor_litres,
    product,
    extraLines,
    warnings,
    labour_m2: wall_net + ceiling_m2
  });
}

// ────────────────────────────────────────────────────────────────────
// Scenario: Single wall
// ────────────────────────────────────────────────────────────────────
function singleWall(
  inputs: Extract<PaintInputs, { scenario: "single_wall" }>,
  product: CalculatorProductRef
): CalculatorOutput {
  const area = Math.max(0, inputs.length_m) * Math.max(0, inputs.height_m);
  let litres = (area / WALL_COVERAGE[inputs.surface]) * inputs.coats;
  if (inputs.waste_10pct) litres *= 1.1;
  return assembleOutput({
    title: "Single feature wall",
    wall_litres: litres,
    trim_litres: 0,
    product,
    extraLines: [
      {
        label: "Wall area",
        value: `${area.toFixed(1)} m²`,
        detail: `${inputs.length_m} × ${inputs.height_m} m, ${inputs.surface.replace("_", " ")}`,
        tone: "muted" as const
      }
    ],
    warnings:
      inputs.surface === "fresh_plaster"
        ? ["Mist coat needed first — water down 30-40%."]
        : [],
    labour_m2: area
  });
}

// ────────────────────────────────────────────────────────────────────
// Scenario: External masonry
// ────────────────────────────────────────────────────────────────────
function externalMasonry(
  inputs: Extract<PaintInputs, { scenario: "external_masonry" }>,
  product: CalculatorProductRef
): CalculatorOutput {
  const area = Math.max(0, inputs.length_m) * Math.max(0, inputs.height_m);
  const coverage = EXTERIOR_COVERAGE[inputs.surface];
  let litres = (area / coverage) * inputs.coats;
  if (inputs.waste_10pct) litres *= 1.1;
  return assembleOutput({
    title: "External masonry wall",
    wall_litres: litres,
    trim_litres: 0,
    product,
    extraLines: [
      {
        label: "External area",
        value: `${area.toFixed(1)} m²`,
        detail: `${coverage} m²/L (masonry paint covers less than interior emulsion)`,
        tone: "muted" as const
      }
    ],
    warnings: [
      "Only paint when forecast is dry for 24 hrs after application and no overnight frost expected.",
      ...(inputs.surface === "textured" ? ["Pebble-dash and heavy texture can drink 2× the paint — order extra."] : [])
    ],
    labour_m2: area
  });
}

// ────────────────────────────────────────────────────────────────────
// Scenario: Doors only
// ────────────────────────────────────────────────────────────────────
function doorsOnly(
  inputs: Extract<PaintInputs, { scenario: "doors_only" }>,
  product: CalculatorProductRef
): CalculatorOutput {
  const sidesFactor = inputs.sides === "both" ? 2 : 1;
  const perDoor = DOOR_TRIM_PAINT_L[inputs.door_size];
  const frameAddon = inputs.include_frame ? 0.15 : 0;
  let litres = inputs.count * (perDoor * sidesFactor + frameAddon) * inputs.coats;
  if (litres > 0) litres *= 1.1;
  return assembleOutput({
    title: `${inputs.count} ${inputs.door_size} door${inputs.count === 1 ? "" : "s"}${inputs.sides === "both" ? " — both sides" : ""}`,
    wall_litres: 0,
    trim_litres: litres,
    product,
    extraLines: [
      {
        label: "Per door",
        value: `${perDoor} L per side`,
        detail: inputs.include_frame ? "+0.15 L for frame" : "frame excluded",
        tone: "muted" as const
      }
    ],
    warnings: [
      "Use satinwood or gloss for doors — wall emulsion won't take the wear.",
      "Sand back any flaking paint and prime knots before painting."
    ]
  });
}

// ────────────────────────────────────────────────────────────────────
// Scenario: Windows only
// ────────────────────────────────────────────────────────────────────
function windowsOnly(
  inputs: Extract<PaintInputs, { scenario: "windows_only" }>,
  product: CalculatorProductRef
): CalculatorOutput {
  const sidesFactor = inputs.sides === "both" ? 2 : 1;
  const perWindow = WINDOW_TRIM_PAINT_L[inputs.window_size];
  let litres = inputs.count * perWindow * sidesFactor * inputs.coats;
  if (litres > 0) litres *= 1.1;
  return assembleOutput({
    title: `${inputs.count} ${inputs.window_size} window${inputs.count === 1 ? "" : "s"}${inputs.sides === "both" ? " — both sides" : ""}`,
    wall_litres: 0,
    trim_litres: litres,
    product,
    extraLines: [
      {
        label: "Per window",
        value: `${perWindow} L per side`,
        detail: "frame + sill + reveal",
        tone: "muted" as const
      }
    ],
    warnings: ["Use satinwood or gloss — and mask the glass with painter's tape first."]
  });
}

// ────────────────────────────────────────────────────────────────────
// Scenario: Timber fence
// ────────────────────────────────────────────────────────────────────
function timberFence(
  inputs: Extract<PaintInputs, { scenario: "timber_fence" }>,
  product: CalculatorProductRef
): CalculatorOutput {
  const area =
    Math.max(0, inputs.length_m) *
    Math.max(0, inputs.height_m) *
    (inputs.sides === "both" ? 2 : 1);
  let litres = (area / FENCE_COVERAGE) * inputs.coats * 1.15; // fences always +15% (rough sawn)
  return assembleOutput({
    title: `Timber fence — ${inputs.length_m} m × ${inputs.height_m} m${inputs.sides === "both" ? " (both sides)" : ""}`,
    wall_litres: litres,
    trim_litres: 0,
    product,
    extraLines: [
      {
        label: "Fence surface area",
        value: `${area.toFixed(1)} m²`,
        detail: "5 m²/L — rough-sawn timber drinks more",
        tone: "muted" as const
      }
    ],
    warnings: [
      "Paint dry timber only (moisture content <18%). New panels need a fortnight to weather.",
      "Don't paint in direct sun — surface skins before the body cures."
    ],
    labour_m2: area
  });
}

// ────────────────────────────────────────────────────────────────────
// Scenario: Metal railing / gates
// ────────────────────────────────────────────────────────────────────
function metalRailing(
  inputs: Extract<PaintInputs, { scenario: "metal_railing" }>,
  product: CalculatorProductRef
): CalculatorOutput {
  const area = Math.max(0, inputs.length_m) * Math.max(0, inputs.height_m);
  const coverage = RAILING_COVERAGE[inputs.profile];
  let litres = (area / coverage) * inputs.coats * 1.15;
  return assembleOutput({
    title: `Metal railing / gate — ${inputs.length_m} m × ${inputs.height_m} m`,
    wall_litres: litres,
    trim_litres: 0,
    product,
    extraLines: [
      {
        label: "Profile",
        value: inputs.profile === "decorative" ? "Decorative / wrought" : "Plain bars",
        detail: `${coverage} m²/L equivalent`,
        tone: "muted" as const
      }
    ],
    warnings: [
      "Wire-brush rust spots back to bare metal and prime with metal primer first.",
      "Use a Hammerite-style direct-to-metal paint or a separate primer + topcoat."
    ]
  });
}

// ────────────────────────────────────────────────────────────────────
// Scenario: Skirting / trim only (linear m)
// ────────────────────────────────────────────────────────────────────
function skirtingTrim(
  inputs: Extract<PaintInputs, { scenario: "skirting_trim" }>,
  product: CalculatorProductRef
): CalculatorOutput {
  // Rough rule: 1 m of skirting (150 mm tall) = 0.15 m² of paintable face,
  // both sides paintable in places. Use 0.2 m²/m to be safe.
  const area = inputs.linear_m * 0.2;
  let litres = (area / TRIM_COVERAGE) * inputs.coats * 1.1;
  return assembleOutput({
    title: `Skirting / trim — ${inputs.linear_m} linear m`,
    wall_litres: 0,
    trim_litres: litres,
    product,
    extraLines: [],
    warnings: ["Use satinwood or gloss — wall emulsion will scuff."]
  });
}

// ────────────────────────────────────────────────────────────────────
// Shared output assembler
// ────────────────────────────────────────────────────────────────────
function assembleOutput({
  title,
  wall_litres,
  ceiling_litres = 0,
  trim_litres = 0,
  floor_litres = 0,
  product,
  extraLines,
  warnings,
  labour_m2
}: {
  title: string;
  wall_litres: number;
  ceiling_litres?: number;
  trim_litres?: number;
  floor_litres?: number;
  product: CalculatorProductRef;
  extraLines: CalculatorOutput["lines"];
  warnings: string[];
  labour_m2?: number;
}): CalculatorOutput {
  const total_l = wall_litres + ceiling_litres + trim_litres + floor_litres;
  const { tins, total_l: packed_l } = packTins(total_l);
  const litres_per_unit = readNum(product.calculator_config?.litres_per_unit, 5);
  const tins_to_buy = packed_l > 0 ? Math.max(1, Math.ceil(packed_l / litres_per_unit)) : 0;

  const lines = [
    ...extraLines,
    {
      label: title,
      value: `${total_l.toFixed(1)} L total`,
      detail: tinDetail(wall_litres, ceiling_litres, trim_litres, floor_litres),
      tone: "primary" as const
    },
    ...(tins.length > 0
      ? [
          {
            label: "Best tin combination",
            value: `${packed_l} L packed`,
            detail: formatTinList(tins),
            tone: "muted" as const
          }
        ]
      : []),
    ...(tins_to_buy > 0
      ? [
          {
            label: `Order from ${product.name}`,
            value: `${tins_to_buy} × ${litres_per_unit}L tin${tins_to_buy === 1 ? "" : "s"}`,
            tone: "muted" as const,
            cart: {
              product_id: product.id,
              qty: tins_to_buy,
              cart_label: `${product.name} × ${tins_to_buy}`,
              price_pence: product.price_pence,
              cover_url: product.cover_url
            }
          }
        ]
      : [])
  ];

  const materials_total_pence = tins_to_buy * product.price_pence;

  return {
    lines,
    warnings,
    materials_total_pence,
    ...(labour_m2 !== undefined && labourLineFor(labour_m2, product)
      ? { labour: labourLineFor(labour_m2, product)! }
      : {})
  };
}

function tinDetail(
  wall: number,
  ceiling: number,
  trim: number,
  floor: number
): string {
  const parts: string[] = [];
  if (wall > 0) parts.push(`${wall.toFixed(1)} L walls`);
  if (ceiling > 0) parts.push(`${ceiling.toFixed(1)} L ceiling`);
  if (floor > 0) parts.push(`${floor.toFixed(1)} L floor`);
  if (trim > 0) parts.push(`${trim.toFixed(1)} L gloss/satinwood (doors/windows/trim)`);
  return parts.join(" · ");
}

function labourLineFor(
  m2: number,
  product: CalculatorProductRef
): CalculatorLabour | null {
  if (
    !product.service_trade_type ||
    typeof product.service_rate_pence !== "number" ||
    product.service_rate_unit !== "m2"
  ) {
    return null;
  }
  return {
    trade_label: product.service_trade_type.replace("_", " "),
    rate_pence: product.service_rate_pence,
    rate_unit: "m2",
    quantity: Math.round(m2 * 10) / 10,
    total_pence: Math.round(m2 * product.service_rate_pence)
  };
}

// ────────────────────────────────────────────────────────────────────
// Complementary subcategories per scenario — feeds the cross-sell panel.
// ────────────────────────────────────────────────────────────────────
export function paintComplementarySubcategories(
  scenario: PaintScenario
): string[] {
  const universal = ["paint_brush", "paint_roller", "paint_tray", "drop_sheet"];
  switch (scenario) {
    case "quick_estimate":
    case "full_room":
    case "single_wall":
      return [...universal, "masking_tape", "sandpaper", "filler", "primer", "scraper"];
    case "external_masonry":
      return [...universal, "exterior_paint", "scraper", "sandpaper"];
    case "doors_only":
    case "windows_only":
      return [...universal, "masking_tape", "sandpaper", "primer", "filler"];
    case "timber_fence":
      return [...universal, "fence_paint", "scraper", "sandpaper"];
    case "metal_railing":
      return [...universal, "primer", "sandpaper", "scraper", "paint_thinner"];
    case "skirting_trim":
      return [...universal, "masking_tape", "sandpaper", "filler"];
  }
}

// ────────────────────────────────────────────────────────────────────
// Default inputs per scenario
// ────────────────────────────────────────────────────────────────────
export const PAINT_DEFAULT_INPUTS_BY_SCENARIO: {
  [K in PaintScenario]: Extract<PaintInputs, { scenario: K }>;
} = {
  quick_estimate: { scenario: "quick_estimate", room_type: "medium", coats: 2 },
  full_room: {
    scenario: "full_room",
    length_m: 4,
    width_m: 3,
    height_m: 2.4,
    doors: 1,
    door_size: "standard",
    windows: 1,
    window_size: "standard",
    include_ceiling: true,
    include_floor_paint: false,
    surface: "smooth",
    coats: 2,
    paint_doors_and_windows: true,
    waste_10pct: true
  },
  single_wall: {
    scenario: "single_wall",
    length_m: 4,
    height_m: 2.4,
    surface: "smooth",
    coats: 2,
    waste_10pct: true
  },
  external_masonry: {
    scenario: "external_masonry",
    length_m: 8,
    height_m: 2.5,
    surface: "smooth",
    coats: 2,
    waste_10pct: true
  },
  doors_only: {
    scenario: "doors_only",
    count: 2,
    door_size: "standard",
    sides: "both",
    include_frame: true,
    coats: 2
  },
  windows_only: {
    scenario: "windows_only",
    count: 2,
    window_size: "standard",
    sides: "one",
    coats: 2
  },
  timber_fence: {
    scenario: "timber_fence",
    length_m: 10,
    height_m: 1.8,
    sides: "one",
    coats: 2
  },
  metal_railing: {
    scenario: "metal_railing",
    length_m: 5,
    height_m: 1.1,
    profile: "decorative",
    coats: 2
  },
  skirting_trim: {
    scenario: "skirting_trim",
    linear_m: 14,
    coats: 2
  }
};

/** Default scenario when the calc first renders. */
export const PAINT_DEFAULT_SCENARIO: PaintScenario = "full_room";

/** Back-compat — legacy callers expecting a flat default. */
export const PAINT_DEFAULT_INPUTS: PaintInputs = PAINT_DEFAULT_INPUTS_BY_SCENARIO.full_room;

/** Display labels for the scenario picker tabs. */
export const PAINT_SCENARIO_LABEL: Record<PaintScenario, string> = {
  quick_estimate: "Quick estimate",
  full_room: "Full room",
  single_wall: "Single wall",
  external_masonry: "External wall",
  doors_only: "Doors only",
  windows_only: "Windows only",
  timber_fence: "Timber fence",
  metal_railing: "Metal railing / gate",
  skirting_trim: "Skirting / trim"
};

// Plastering calculator — the ultimate UK plastering job estimator.
//
// Handles rectangular walls AND rectangle-with-gable-triangle walls
// (asymmetric-gable-safe via Heron's formula on 3 measured sides).
// Supports 10 external render finishes, 3 internal finish paths, 4
// beading types (window / door / external corner / internal edge), a
// high-ceiling uplift, feature line items (arches / curved returns),
// and an insulation add-on for timber-studwork rooms.
//
// NO tape-and-joint finish — that's a drywall-taper trade.

import type {
  CalculatorOutput,
  CalculatorProductRef
} from "./types";

export type PlasteringScenario =
  | "full_house"
  | "external_only"
  | "internal_only"
  | "single_elevation"
  | "single_room";

export type WallShape = "rect" | "rect_gable";

export type OpeningType =
  | "window"
  | "single_door"
  | "double_door"
  | "sliding_door"
  | "patio_door"
  | "vent";

export type ExternalFinish =
  | "sc_smooth"
  | "sc_sponge"
  | "nap_dash"
  | "pebble_dash"
  | "stone_dash"
  | "roughcast"
  | "monocouche"
  | "silicone"
  | "acrylic"
  | "lime";

export type SubstrateType = "solid" | "timber_studwork";

export type InternalFinish = "skim_only" | "bonding_skim" | "slab_skim";

export type FeatureType =
  | "arched_ceiling"
  | "arched_wall_edge"
  | "arched_doorway"
  | "curved_return";

export type InsulationType = "mineral_wool" | "pir_board" | "sheep_wool";

export type ProjectType = "new_build" | "existing_build" | "renovation";

export type ReadinessType =
  | "ready_now"
  | "under_construction"
  | "open_for_quotation"
  | "ready_in_weeks";

export type Opening = {
  id: string;
  type: OpeningType;
  width_m: number;
  height_m: number;
  count: number;
};

export type Elevation = {
  id: string;
  name: string;
  wall_shape: WallShape;
  rect_width_m: number;
  rect_height_m: number;
  gable_base_m: number;
  gable_left_slope_m: number;
  gable_right_slope_m: number;
  openings: Opening[];
  quoin_corners: 0 | 1 | 2;
  high_ceiling: boolean;
  finish: ExternalFinish;
  include: boolean;
};

export type RoomFeature = {
  type: FeatureType;
  count: number;
};

export type RoomInsulation = {
  type: InsulationType;
  thickness_mm: number;
};

export type Room = {
  id: string;
  name: string;
  substrate: SubstrateType;
  length_m: number;
  width_m: number;
  height_m: number;
  include_ceiling: boolean;
  openings: Opening[];
  internal_corners: number;
  high_ceiling: boolean;
  finish: InternalFinish;
  features: RoomFeature[];
  insulation: RoomInsulation | null;
  include: boolean;
};

export type BeadingRate = {
  price_per_m_pence: number;
  free: boolean;
};

export type BeadingRates = {
  window: BeadingRate;
  door: BeadingRate;
  external_corner: BeadingRate;
  internal_edge: BeadingRate;
};

export type MyRates = {
  external: Record<ExternalFinish, number>;
  internal: Record<InternalFinish, number>;
  height_uplift_pct: number;
  features: Record<FeatureType, number>;
  insulation: Record<InsulationType, number>;
  beading: BeadingRates;
};

export type ProjectDetails = {
  project_type: ProjectType | null;
  readiness: ReadinessType | null;
  ready_in_weeks: number;
  site_address: string;
  access_notes: string;
  attachments: { name: string; size: number }[];
};

export type PlasteringInputs = {
  scenario: PlasteringScenario;
  elevations: Elevation[];
  rooms: Room[];
  rates: MyRates;
  project: ProjectDetails;
};

export const EXTERNAL_FINISH_LABEL: Record<ExternalFinish, string> = {
  sc_smooth: "Sand & cement — smooth float",
  sc_sponge: "Sand & cement — sponge finish",
  nap_dash: "Nap / wet dash",
  pebble_dash: "Pebble dash",
  stone_dash: "Stone dash",
  roughcast: "Roughcast",
  monocouche: "Monocouche one-coat",
  silicone: "Silicone thin-coat",
  acrylic: "Acrylic thin-coat",
  lime: "Lime render"
};

export const INTERNAL_FINISH_LABEL: Record<InternalFinish, string> = {
  skim_only: "Skim only",
  bonding_skim: "Bonding + skim",
  slab_skim: "Slab + skim"
};

export const OPENING_LABEL: Record<OpeningType, string> = {
  window: "Window",
  single_door: "Single door",
  double_door: "Double door",
  sliding_door: "Sliding door",
  patio_door: "Patio door",
  vent: "Vent"
};

export const FEATURE_LABEL: Record<FeatureType, string> = {
  arched_ceiling: "Arched ceiling",
  arched_wall_edge: "Arched wall edge",
  arched_doorway: "Arched doorway",
  curved_return: "Curved return"
};

export const INSULATION_LABEL: Record<InsulationType, string> = {
  mineral_wool: "Mineral wool batts",
  pir_board: "PIR board",
  sheep_wool: "Sheep wool"
};

export const PROJECT_TYPE_LABEL: Record<ProjectType, string> = {
  new_build: "New build",
  existing_build: "Existing build",
  renovation: "Renovation"
};

export const READINESS_LABEL: Record<ReadinessType, string> = {
  ready_now: "Ready now",
  under_construction: "Under construction",
  open_for_quotation: "Open for quotation",
  ready_in_weeks: "Ready in weeks"
};

export const SCENARIO_LABEL: Record<PlasteringScenario, string> = {
  full_house: "Full house (ext + int)",
  external_only: "External only",
  internal_only: "Internal only",
  single_elevation: "Single elevation",
  single_room: "Single room"
};

// Openings are DOOR-like (top + 2 sides, no floor) or WINDOW-like
// (top + 2 sides, no bottom — bell bead handles bottom separately).
// Both have exactly 3 sides fed to beading engine.
export function openingPerimeter3Sides(o: Opening): number {
  return (o.width_m + 2 * o.height_m) * o.count;
}

export function openingArea(o: Opening): number {
  return o.width_m * o.height_m * o.count;
}

// Heron's formula — area of a triangle from its 3 sides. Used for
// gable triangles measured with a tape (base + left slope + right slope).
// Returns 0 for degenerate (impossible) triangles.
export function triangleArea(a: number, b: number, c: number): number {
  const s = (a + b + c) / 2;
  const inside = s * (s - a) * (s - b) * (s - c);
  if (inside <= 0) return 0;
  return Math.sqrt(inside);
}

export function elevationGrossArea(e: Elevation): number {
  const rect = e.rect_width_m * e.rect_height_m;
  if (e.wall_shape === "rect") return rect;
  const gable = triangleArea(
    e.gable_base_m,
    e.gable_left_slope_m,
    e.gable_right_slope_m
  );
  return rect + gable;
}

export function elevationNetArea(e: Elevation): number {
  const openings = e.openings.reduce((sum, o) => sum + openingArea(o), 0);
  return Math.max(0, elevationGrossArea(e) - openings);
}

export function elevationWindowMeters(e: Elevation): number {
  return e.openings
    .filter((o) => o.type === "window" || o.type === "vent")
    .reduce((sum, o) => sum + openingPerimeter3Sides(o), 0);
}

export function elevationDoorMeters(e: Elevation): number {
  return e.openings
    .filter(
      (o) =>
        o.type === "single_door" ||
        o.type === "double_door" ||
        o.type === "sliding_door" ||
        o.type === "patio_door"
    )
    .reduce((sum, o) => sum + openingPerimeter3Sides(o), 0);
}

export function elevationQuoinMeters(e: Elevation): number {
  return e.quoin_corners * e.rect_height_m;
}

export function roomWallArea(r: Room): number {
  const walls = 2 * (r.length_m + r.width_m) * r.height_m;
  const openings = r.openings.reduce((sum, o) => sum + openingArea(o), 0);
  return Math.max(0, walls - openings);
}

export function roomCeilingArea(r: Room): number {
  return r.include_ceiling ? r.length_m * r.width_m : 0;
}

export function roomWindowMeters(r: Room): number {
  return r.openings
    .filter((o) => o.type === "window" || o.type === "vent")
    .reduce((sum, o) => sum + openingPerimeter3Sides(o), 0);
}

export function roomDoorMeters(r: Room): number {
  return r.openings
    .filter(
      (o) =>
        o.type === "single_door" ||
        o.type === "double_door" ||
        o.type === "sliding_door" ||
        o.type === "patio_door"
    )
    .reduce((sum, o) => sum + openingPerimeter3Sides(o), 0);
}

export function roomInternalEdgeMeters(r: Room): number {
  return r.internal_corners * r.height_m;
}

export function computePlastering(
  inputs: PlasteringInputs,
  _product: CalculatorProductRef
): CalculatorOutput {
  void _product;
  const { scenario, elevations, rooms, rates } = inputs;

  const showExternal =
    scenario === "full_house" ||
    scenario === "external_only" ||
    scenario === "single_elevation";
  const showInternal =
    scenario === "full_house" ||
    scenario === "internal_only" ||
    scenario === "single_room";

  const uplift = 1 + rates.height_uplift_pct / 100;

  const lines: CalculatorOutput["lines"] = [];
  const warnings: string[] = [];
  let totalPence = 0;
  let windowMeters = 0;
  let doorMeters = 0;
  let externalCornerMeters = 0;
  let internalEdgeMeters = 0;

  // External elevations
  if (showExternal) {
    const activeElevations = elevations.filter((e) => e.include);
    for (const e of activeElevations) {
      const gross = elevationGrossArea(e);
      const net = elevationNetArea(e);
      const rate = rates.external[e.finish] ?? 0;
      const withUplift = e.high_ceiling ? net * uplift : net;
      const pence = Math.round(withUplift * rate);
      totalPence += pence;

      const detailParts: string[] = [];
      if (e.wall_shape === "rect_gable") {
        detailParts.push(
          `rect ${e.rect_width_m}×${e.rect_height_m} + gable`
        );
      } else {
        detailParts.push(`${e.rect_width_m}×${e.rect_height_m}`);
      }
      if (e.openings.length > 0) {
        detailParts.push(`− ${(gross - net).toFixed(1)} m² openings`);
      }
      if (e.high_ceiling) {
        detailParts.push(`+${rates.height_uplift_pct}% high`);
      }

      lines.push({
        label: `${e.name} · ${EXTERNAL_FINISH_LABEL[e.finish]}`,
        value: `${net.toFixed(1)} m² · £${(pence / 100).toFixed(0)}`,
        detail: detailParts.join(" · "),
        tone: "primary"
      });

      windowMeters += elevationWindowMeters(e);
      doorMeters += elevationDoorMeters(e);
      externalCornerMeters += elevationQuoinMeters(e);
    }
    if (activeElevations.length === 0) {
      warnings.push("Add at least one external elevation to include render.");
    }
  }

  // Internal rooms
  if (showInternal) {
    const activeRooms = rooms.filter((r) => r.include);
    for (const r of activeRooms) {
      const walls = roomWallArea(r);
      const ceiling = roomCeilingArea(r);
      const total = walls + ceiling;
      const rate = rates.internal[r.finish] ?? 0;
      const withUplift = r.high_ceiling ? total * uplift : total;
      const pence = Math.round(withUplift * rate);
      totalPence += pence;

      const detailParts: string[] = [
        `${r.length_m}×${r.width_m}×${r.height_m}`,
        r.substrate === "solid" ? "solid" : "timber studwork"
      ];
      if (r.include_ceiling) detailParts.push("+ ceiling");
      if (r.high_ceiling) detailParts.push(`+${rates.height_uplift_pct}% high`);

      lines.push({
        label: `${r.name} · ${INTERNAL_FINISH_LABEL[r.finish]}`,
        value: `${total.toFixed(1)} m² · £${(pence / 100).toFixed(0)}`,
        detail: detailParts.join(" · "),
        tone: "primary"
      });

      // Features
      for (const f of r.features) {
        if (f.count <= 0) continue;
        const featurePence = f.count * (rates.features[f.type] ?? 0);
        totalPence += featurePence;
        lines.push({
          label: `  ${FEATURE_LABEL[f.type]} × ${f.count}`,
          value: `£${(featurePence / 100).toFixed(0)}`,
          tone: "muted"
        });
      }

      // Insulation (timber studwork only)
      if (r.substrate === "timber_studwork" && r.insulation) {
        const insArea = walls;
        const insPence = Math.round(insArea * (rates.insulation[r.insulation.type] ?? 0));
        totalPence += insPence;
        lines.push({
          label: `  Insulation — ${INSULATION_LABEL[r.insulation.type]} ${r.insulation.thickness_mm} mm`,
          value: `${insArea.toFixed(1)} m² · £${(insPence / 100).toFixed(0)}`,
          tone: "muted"
        });
      } else if (r.substrate === "timber_studwork" && !r.insulation) {
        warnings.push(
          `${r.name}: timber studwork — confirm insulation with customer.`
        );
      }

      windowMeters += roomWindowMeters(r);
      doorMeters += roomDoorMeters(r);
      internalEdgeMeters += roomInternalEdgeMeters(r);
    }
    if (activeRooms.length === 0) {
      warnings.push("Add at least one internal room to include skim/board.");
    }
  }

  // Beading — 4 types, £/m or free
  const beadingRows: {
    key: keyof BeadingRates;
    label: string;
    meters: number;
  }[] = [
    { key: "window", label: "Window bead", meters: windowMeters },
    { key: "door", label: "Door bead", meters: doorMeters },
    {
      key: "external_corner",
      label: "External corner bead",
      meters: externalCornerMeters
    },
    {
      key: "internal_edge",
      label: "Internal edge bead",
      meters: internalEdgeMeters
    }
  ];

  for (const row of beadingRows) {
    if (row.meters <= 0) continue;
    const rate = rates.beading[row.key];
    const pence = rate.free ? 0 : Math.round(row.meters * rate.price_per_m_pence);
    totalPence += pence;
    lines.push({
      label: row.label,
      value: rate.free
        ? `${row.meters.toFixed(1)} m · Free`
        : `${row.meters.toFixed(1)} m · £${(pence / 100).toFixed(0)}`,
      detail: rate.free
        ? "Included in finish"
        : `£${(rate.price_per_m_pence / 100).toFixed(2)} / m`,
      tone: "muted"
    });
  }

  // Grand total
  lines.push({
    label: "Job total (labour + materials)",
    value: `£${(totalPence / 100).toFixed(0)}`,
    detail: "Estimate · adjust rates in My rates",
    tone: "primary"
  });

  return {
    lines,
    warnings,
    materials_total_pence: totalPence
  };
}

export function plasteringComplementarySubcategories(): string[] {
  return ["render_bead", "scrim_tape", "corner_bead", "plaster_finish"];
}

// Default rates — sensible UK ballparks in pence.
export const DEFAULT_RATES: MyRates = {
  external: {
    sc_smooth: 3500,
    sc_sponge: 3700,
    nap_dash: 4000,
    pebble_dash: 4200,
    stone_dash: 4500,
    roughcast: 4200,
    monocouche: 5500,
    silicone: 6500,
    acrylic: 6000,
    lime: 6500
  },
  internal: {
    skim_only: 1800,
    bonding_skim: 2500,
    slab_skim: 3200
  },
  height_uplift_pct: 15,
  features: {
    arched_ceiling: 25000,
    arched_wall_edge: 8000,
    arched_doorway: 12000,
    curved_return: 6000
  },
  insulation: {
    mineral_wool: 1800,
    pir_board: 3500,
    sheep_wool: 4500
  },
  beading: {
    window: { price_per_m_pence: 400, free: false },
    door: { price_per_m_pence: 400, free: false },
    external_corner: { price_per_m_pence: 500, free: false },
    internal_edge: { price_per_m_pence: 350, free: true }
  }
};

let __id = 0;
const nextId = () => `id-${++__id}`;

export function newOpening(
  type: OpeningType = "window",
  width_m = 1.2,
  height_m = 1.2
): Opening {
  return { id: nextId(), type, width_m, height_m, count: 1 };
}

export function newElevation(name: string, finish: ExternalFinish = "sc_smooth"): Elevation {
  return {
    id: nextId(),
    name,
    wall_shape: "rect",
    rect_width_m: 8,
    rect_height_m: 5,
    gable_base_m: 8,
    gable_left_slope_m: 5,
    gable_right_slope_m: 5,
    openings: [],
    quoin_corners: 0,
    high_ceiling: false,
    finish,
    include: true
  };
}

export function newRoom(
  name: string,
  substrate: SubstrateType = "solid",
  finish: InternalFinish = "skim_only"
): Room {
  return {
    id: nextId(),
    name,
    substrate,
    length_m: 4,
    width_m: 3,
    height_m: 2.4,
    include_ceiling: true,
    openings: [],
    internal_corners: 4,
    high_ceiling: false,
    finish,
    features: [],
    insulation: null,
    include: true
  };
}

export const DEFAULT_ELEVATIONS: Elevation[] = [
  { ...newElevation("Front"), rect_width_m: 8, rect_height_m: 5 },
  { ...newElevation("Back"), rect_width_m: 8, rect_height_m: 5 },
  {
    ...newElevation("Gable 1"),
    wall_shape: "rect_gable",
    rect_width_m: 6,
    rect_height_m: 5,
    gable_base_m: 6,
    gable_left_slope_m: 4.2,
    gable_right_slope_m: 4.2
  },
  {
    ...newElevation("Gable 2"),
    wall_shape: "rect_gable",
    rect_width_m: 6,
    rect_height_m: 5,
    gable_base_m: 6,
    gable_left_slope_m: 4.2,
    gable_right_slope_m: 4.2,
    include: false
  }
];

export const DEFAULT_ROOMS: Room[] = [
  { ...newRoom("Living room", "solid", "skim_only"), length_m: 5, width_m: 4 },
  { ...newRoom("Bedroom", "timber_studwork", "slab_skim") }
];

export const DEFAULT_PROJECT: ProjectDetails = {
  project_type: null,
  readiness: null,
  ready_in_weeks: 2,
  site_address: "",
  access_notes: "",
  attachments: []
};

export const PLASTERING_DEFAULT_INPUTS: PlasteringInputs = {
  scenario: "full_house",
  elevations: DEFAULT_ELEVATIONS,
  rooms: DEFAULT_ROOMS,
  rates: DEFAULT_RATES,
  project: DEFAULT_PROJECT
};

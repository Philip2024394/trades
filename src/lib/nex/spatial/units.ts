// Spatial Intelligence · unit systems + conversions.
//
// Every measurement Nex ever expresses flows through these types. No renderer
// or planner may ever inline unit arithmetic — it lives here or nowhere.
//
// Doctrine: docs/brains/nex-phase-e2-unified-platforms-philip-2026-08-04.md

export type LengthUnit = "mm" | "cm" | "m" | "in" | "ft" | "yd";
export type AreaUnit = "mm2" | "cm2" | "m2" | "ft2";
export type VolumeUnit = "mm3" | "cm3" | "m3" | "l" | "ml" | "gal";
export type WeightUnit = "g" | "kg" | "t" | "oz" | "lb";
export type LiquidUnit = "ml" | "l" | "gal" | "pt";
export type PressureUnit = "psi" | "bar" | "Pa";
export type TemperatureUnit = "C" | "F";
export type AngleUnit = "deg" | "rad";

export type UnitSystem = "length" | "area" | "volume" | "weight" | "liquid" | "pressure" | "temperature" | "angle";

// ─── Conversion factors to a canonical base unit ────────────────────────
// Length base: mm · Area base: mm² · Volume base: mm³ · Weight base: g
// Liquid base: ml · Pressure base: Pa · Angle base: rad.
// Temperature is affine (not multiplicative) · handled separately.

const LENGTH_TO_MM: Record<LengthUnit, number> = {
  mm: 1, cm: 10, m: 1000, in: 25.4, ft: 304.8, yd: 914.4,
};

const AREA_TO_MM2: Record<AreaUnit, number> = {
  mm2: 1, cm2: 100, m2: 1_000_000, ft2: 92_903.04,
};

const VOLUME_TO_MM3: Record<VolumeUnit, number> = {
  mm3: 1, cm3: 1000, m3: 1_000_000_000, l: 1_000_000, ml: 1000, gal: 3_785_411.784,
};

const WEIGHT_TO_G: Record<WeightUnit, number> = {
  g: 1, kg: 1000, t: 1_000_000, oz: 28.349523125, lb: 453.59237,
};

const LIQUID_TO_ML: Record<LiquidUnit, number> = {
  ml: 1, l: 1000, gal: 3785.411784, pt: 568.26125,
};

const PRESSURE_TO_PA: Record<PressureUnit, number> = {
  Pa: 1, bar: 100_000, psi: 6894.757293168,
};

const ANGLE_TO_RAD: Record<AngleUnit, number> = {
  rad: 1, deg: Math.PI / 180,
};

// ─── Generic converters ─────────────────────────────────────────────────

function convertVia<U extends string>(value: number, from: U, to: U, table: Record<U, number>): number {
  const base = value * table[from];
  return base / table[to];
}

export function convertLength(value: number, from: LengthUnit, to: LengthUnit): number { return convertVia(value, from, to, LENGTH_TO_MM); }
export function convertArea(value: number, from: AreaUnit, to: AreaUnit): number { return convertVia(value, from, to, AREA_TO_MM2); }
export function convertVolume(value: number, from: VolumeUnit, to: VolumeUnit): number { return convertVia(value, from, to, VOLUME_TO_MM3); }
export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number { return convertVia(value, from, to, WEIGHT_TO_G); }
export function convertLiquid(value: number, from: LiquidUnit, to: LiquidUnit): number { return convertVia(value, from, to, LIQUID_TO_ML); }
export function convertPressure(value: number, from: PressureUnit, to: PressureUnit): number { return convertVia(value, from, to, PRESSURE_TO_PA); }
export function convertAngle(value: number, from: AngleUnit, to: AngleUnit): number { return convertVia(value, from, to, ANGLE_TO_RAD); }

/** Temperature conversion (affine · not a simple factor). */
export function convertTemperature(value: number, from: TemperatureUnit, to: TemperatureUnit): number {
  if (from === to) return value;
  if (from === "C" && to === "F") return (value * 9) / 5 + 32;
  if (from === "F" && to === "C") return ((value - 32) * 5) / 9;
  return value;
}

export function listUnitsForSystem(system: UnitSystem): readonly string[] {
  switch (system) {
    case "length": return Object.keys(LENGTH_TO_MM);
    case "area": return Object.keys(AREA_TO_MM2);
    case "volume": return Object.keys(VOLUME_TO_MM3);
    case "weight": return Object.keys(WEIGHT_TO_G);
    case "liquid": return Object.keys(LIQUID_TO_ML);
    case "pressure": return Object.keys(PRESSURE_TO_PA);
    case "temperature": return ["C", "F"];
    case "angle": return Object.keys(ANGLE_TO_RAD);
  }
}

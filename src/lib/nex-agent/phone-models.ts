// src/lib/nex-agent/phone-models.ts
//
// Catalog of mobile phone models with realistic screen dimensions + bezel style
// + camera/notch cutout geometry. Used by the workstation LEFT preview to
// scale the iframe to native size AND overlay a red outline showing the safe
// area obscured by the notch/camera.

export type BezelStyle = "iphone-modern" | "iphone-classic" | "android-modern" | "android-classic";
export type CutoutKind = "dynamic-island" | "notch" | "hole-punch" | "waterdrop" | "none";

export interface CutoutSpec {
  /** Cutout family — determines default shape. */
  readonly kind: CutoutKind;
  /** Pixels from the top of the SCREEN (not the bezel). */
  readonly top: number;
  /** True → horizontally centered; otherwise `left` used. */
  readonly centerX?: boolean;
  /** Pixels from the left of the SCREEN. Used only when `centerX` is false. */
  readonly left?: number;
  readonly width: number;
  readonly height: number;
  readonly borderRadius: number;
}

export interface PhoneModel {
  readonly id: string;
  readonly brand: string;
  readonly name: string;
  /** Native CSS pixel width of the screen at 1x device scale. */
  readonly width: number;
  readonly height: number;
  readonly bezelStyle: BezelStyle;
  readonly cutout: CutoutSpec;
}

export const NO_CUTOUT: CutoutSpec = {
  kind: "none", top: 0, width: 0, height: 0, borderRadius: 0,
};

export const PHONE_MODELS: readonly PhoneModel[] = [
  // ─── Apple ────────────────────────────────────────────────────
  {
    id: "iphone-15-pro-max",
    brand: "Apple",
    name: "iPhone 15 Pro Max",
    width: 430, height: 932,
    bezelStyle: "iphone-modern",
    cutout: { kind: "dynamic-island", top: 11, centerX: true, width: 126, height: 37, borderRadius: 20 },
  },
  {
    id: "iphone-15-pro",
    brand: "Apple",
    name: "iPhone 15 Pro",
    width: 393, height: 852,
    bezelStyle: "iphone-modern",
    cutout: { kind: "dynamic-island", top: 11, centerX: true, width: 122, height: 34, borderRadius: 18 },
  },
  {
    id: "iphone-14-plus",
    brand: "Apple",
    name: "iPhone 15 · 14 · 14 Plus",
    width: 390, height: 844,
    bezelStyle: "iphone-modern",
    cutout: { kind: "dynamic-island", top: 11, centerX: true, width: 122, height: 34, borderRadius: 18 },
  },
  {
    id: "iphone-13",
    brand: "Apple",
    name: "iPhone 13 · 12",
    width: 390, height: 844,
    bezelStyle: "iphone-modern",
    cutout: { kind: "notch", top: 0, centerX: true, width: 209, height: 32, borderRadius: 20 },
  },
  {
    id: "iphone-11",
    brand: "Apple",
    name: "iPhone 11 · XR",
    width: 414, height: 896,
    bezelStyle: "iphone-modern",
    cutout: { kind: "notch", top: 0, centerX: true, width: 215, height: 30, borderRadius: 18 },
  },
  {
    id: "iphone-se",
    brand: "Apple",
    name: "iPhone SE (3rd gen)",
    width: 375, height: 667,
    bezelStyle: "iphone-classic",
    cutout: NO_CUTOUT,
  },

  // ─── Samsung ─────────────────────────────────────────────────
  {
    id: "galaxy-s24-ultra",
    brand: "Samsung",
    name: "Galaxy S24 Ultra",
    width: 412, height: 915,
    bezelStyle: "android-modern",
    cutout: { kind: "hole-punch", top: 8, centerX: true, width: 20, height: 20, borderRadius: 10 },
  },
  {
    id: "galaxy-s24",
    brand: "Samsung",
    name: "Galaxy S24 · S23",
    width: 360, height: 780,
    bezelStyle: "android-modern",
    cutout: { kind: "hole-punch", top: 8, centerX: true, width: 18, height: 18, borderRadius: 9 },
  },
  {
    id: "galaxy-a54",
    brand: "Samsung",
    name: "Galaxy A54",
    width: 384, height: 854,
    bezelStyle: "android-modern",
    cutout: { kind: "waterdrop", top: 0, centerX: true, width: 22, height: 12, borderRadius: 6 },
  },

  // ─── Google ──────────────────────────────────────────────────
  {
    id: "pixel-8-pro",
    brand: "Google",
    name: "Pixel 8 Pro",
    width: 412, height: 892,
    bezelStyle: "android-modern",
    cutout: { kind: "hole-punch", top: 10, centerX: true, width: 22, height: 22, borderRadius: 11 },
  },
  {
    id: "pixel-8",
    brand: "Google",
    name: "Pixel 8 · 7",
    width: 412, height: 915,
    bezelStyle: "android-modern",
    cutout: { kind: "hole-punch", top: 10, centerX: true, width: 22, height: 22, borderRadius: 11 },
  },
  {
    id: "pixel-6a",
    brand: "Google",
    name: "Pixel 6a",
    width: 412, height: 917,
    bezelStyle: "android-modern",
    cutout: { kind: "hole-punch", top: 12, centerX: true, width: 20, height: 20, borderRadius: 10 },
  },

  // ─── OnePlus / Xiaomi ────────────────────────────────────────
  {
    id: "oneplus-12",
    brand: "OnePlus",
    name: "OnePlus 12",
    width: 450, height: 956,
    bezelStyle: "android-modern",
    cutout: { kind: "hole-punch", top: 12, left: 22, width: 20, height: 20, borderRadius: 10 },
  },
  {
    id: "xiaomi-14",
    brand: "Xiaomi",
    name: "Xiaomi 14",
    width: 393, height: 852,
    bezelStyle: "android-modern",
    cutout: { kind: "hole-punch", top: 8, centerX: true, width: 20, height: 20, borderRadius: 10 },
  },
];

export const DEFAULT_MODEL_ID = "iphone-14-plus";

export interface BezelColor {
  readonly id: string;
  readonly label: string;
  readonly outer: string;   // CSS background for the bezel body
  readonly rim: string;     // CSS border/rim highlight
}

export const BEZEL_COLORS: readonly BezelColor[] = [
  { id: "space-black",   label: "Space Black",   outer: "linear-gradient(180deg, #1a1a1a 0%, #050505 100%)", rim: "rgba(255,255,255,0.06)" },
  { id: "titanium",      label: "Natural Titanium", outer: "linear-gradient(180deg, #6b6660 0%, #3f3b36 100%)", rim: "rgba(255,255,255,0.14)" },
  { id: "silver",        label: "Silver",        outer: "linear-gradient(180deg, #d9d9d9 0%, #8f8f8f 100%)", rim: "rgba(255,255,255,0.35)" },
  { id: "gold",          label: "Gold",          outer: "linear-gradient(180deg, #e2c48f 0%, #a08349 100%)", rim: "rgba(255,220,160,0.35)" },
  { id: "midnight-blue", label: "Midnight Blue", outer: "linear-gradient(180deg, #1e2a3d 0%, #0a1524 100%)", rim: "rgba(90,130,180,0.14)" },
  { id: "porcelain",     label: "Porcelain",     outer: "linear-gradient(180deg, #f4ede1 0%, #c9c1b3 100%)", rim: "rgba(255,255,255,0.5)" },
  { id: "carbon",        label: "Carbon Green",  outer: "linear-gradient(180deg, #2e4238 0%, #101a15 100%)", rim: "rgba(180,220,190,0.12)" },
];

export const DEFAULT_BEZEL_COLOR_ID = "space-black";

/**
 * Build a BezelColor from a user-picked hex (custom color picker).
 * Returns a gradient from a lightened top to a darkened bottom for realism.
 */
export function customBezelColor(hex: string): BezelColor {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "").slice(0, 6).padStart(6, "0");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const light = `rgb(${Math.min(255, r + 30)}, ${Math.min(255, g + 30)}, ${Math.min(255, b + 30)})`;
  const dark = `rgb(${Math.max(0, r - 40)}, ${Math.max(0, g - 40)}, ${Math.max(0, b - 40)})`;
  return {
    id: `custom-${clean}`,
    label: `Custom · #${clean.toUpperCase()}`,
    outer: `linear-gradient(180deg, ${light} 0%, ${dark} 100%)`,
    rim: `rgba(255,255,255,0.15)`,
  };
}

export function modelById(id: string | null | undefined): PhoneModel | null {
  if (!id) return null;
  return PHONE_MODELS.find((m) => m.id === id) ?? null;
}

export function bezelColorById(id: string | null | undefined): BezelColor {
  return BEZEL_COLORS.find((c) => c.id === id) ?? BEZEL_COLORS[0];
}

/**
 * Group models by brand for the dropdown.
 */
export function groupedModels(): ReadonlyArray<{ brand: string; models: readonly PhoneModel[] }> {
  const byBrand = new Map<string, PhoneModel[]>();
  for (const m of PHONE_MODELS) {
    const arr = byBrand.get(m.brand) ?? [];
    arr.push(m);
    byBrand.set(m.brand, arr);
  }
  return Array.from(byBrand.entries()).map(([brand, models]) => ({ brand, models }));
}

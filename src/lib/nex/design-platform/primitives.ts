// Design Platform · Primitive taxonomy (Philip 2026-08-04).
//
// Every visual atom in Nex is one of these 10 primitives. Components compose
// primitives. Layers stack components. Containers arrange layers. Sections
// group containers. Pages hold sections. DesignDocuments hold pages.
//
// Constitutional rule: any new visual element MUST decompose to these
// primitives · no new primitive without a doctrine amendment.
//
// Doctrine: docs/brains/nex-phase-e1-universal-design-studio-philip-2026-08-04.md

export type PrimitiveKind = "rectangle" | "text" | "image" | "video" | "gradient" | "shadow" | "mask" | "path" | "icon" | "border";

export type Box = { x: number; y: number; width: number; height: number };

export type RectanglePrimitive = { kind: "rectangle"; id: string; box: Box; fill?: string; stroke?: string; stroke_width?: number; corner_radius?: number };
export type TextPrimitive = { kind: "text"; id: string; box: Box; text: string; font_style_ref: string; color: string; text_align?: "left" | "center" | "right" };
export type ImagePrimitive = { kind: "image"; id: string; box: Box; asset_ref: string; preserve_aspect?: "meet" | "slice" | "none"; opacity?: number };
export type VideoPrimitive = { kind: "video"; id: string; box: Box; asset_ref: string; loop?: boolean; muted?: boolean; poster_ref?: string };
export type GradientPrimitive = { kind: "gradient"; id: string; box: Box; gradient_kind: "linear" | "radial" | "conic"; stops: readonly { offset: number; color: string }[]; angle_deg?: number };
export type ShadowPrimitive = { kind: "shadow"; id: string; box: Box; shadow_kind: "drop" | "inner" | "long"; color: string; blur_px: number; spread_px?: number; offset_x?: number; offset_y?: number };
export type MaskPrimitive = { kind: "mask"; id: string; box: Box; mask_kind: "clip_path" | "alpha_mask"; path_ref?: string; asset_ref?: string };
export type PathPrimitive = { kind: "path"; id: string; box: Box; d: string; fill?: string; stroke?: string; stroke_width?: number };
export type IconPrimitive = { kind: "icon"; id: string; box: Box; icon_ref: string; color?: string };
export type BorderPrimitive = { kind: "border"; id: string; box: Box; color: string; width_px: number; style?: "solid" | "dashed" | "dotted"; corner_radius?: number };

export type Primitive =
  | RectanglePrimitive | TextPrimitive | ImagePrimitive | VideoPrimitive | GradientPrimitive
  | ShadowPrimitive | MaskPrimitive | PathPrimitive | IconPrimitive | BorderPrimitive;

export function listPrimitiveKinds(): readonly PrimitiveKind[] {
  return ["rectangle", "text", "image", "video", "gradient", "shadow", "mask", "path", "icon", "border"];
}

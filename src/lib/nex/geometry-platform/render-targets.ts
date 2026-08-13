// Geometry Platform · Render Target catalog (Philip 2026-08-04).
//
// All render targets consume the SAME DesignDocument. New output formats add a
// RenderTarget · never a bespoke renderer.
//
// Doctrine: docs/brains/nex-phase-e2-unified-platforms-philip-2026-08-04.md

export type RenderTargetId =
  | "render2D" | "renderSVG" | "render3D"
  | "renderElevation" | "renderFloorPlan" | "renderExplodedView"
  | "renderAnimation" | "renderAR" | "renderVR"
  | "renderPrint" | "renderWebsite" | "renderPDF";

export type RenderTargetKind = "raster" | "vector" | "scene_graph" | "print" | "html" | "animation" | "ar_vr";

export type RenderTarget = {
  id: RenderTargetId;
  display_name: string;
  kind: RenderTargetKind;
  output_formats: readonly string[];     // e.g. ["PNG", "WEBP"] · ["glTF", "USDZ"]
  camera_default: string;                // CameraProfileId
  lighting_default: string;              // LightingProfileId
  supports_animation?: boolean;
  supports_interactivity?: boolean;
  ships_in_phase: "E.0" | "E.1" | "E.2" | "E.3" | "E.4" | "E.5" | "E.6" | "E.7" | "E.8" | "E.9";
  status: "shipped" | "pending";
};

const RENDER_TARGETS: Record<RenderTargetId, RenderTarget> = {
  render2D: { id: "render2D", display_name: "2D Raster", kind: "raster", output_formats: ["PNG", "JPEG", "WEBP"], camera_default: "marketing", lighting_default: "studio", ships_in_phase: "E.1", status: "pending" },
  renderSVG: { id: "renderSVG", display_name: "SVG Vector", kind: "vector", output_formats: ["SVG"], camera_default: "marketing", lighting_default: "studio", ships_in_phase: "E.0", status: "shipped" },
  render3D: { id: "render3D", display_name: "3D Scene Graph", kind: "scene_graph", output_formats: ["glTF", "USD", "USDZ"], camera_default: "marketing", lighting_default: "showroom", supports_animation: true, ships_in_phase: "E.2", status: "pending" },
  renderElevation: { id: "renderElevation", display_name: "Elevation Drawing", kind: "vector", output_formats: ["SVG", "PDF"], camera_default: "section", lighting_default: "daylight", ships_in_phase: "E.2", status: "pending" },
  renderFloorPlan: { id: "renderFloorPlan", display_name: "Floor Plan", kind: "vector", output_formats: ["SVG", "PDF", "DXF"], camera_default: "floorplan", lighting_default: "daylight", ships_in_phase: "E.2", status: "pending" },
  renderExplodedView: { id: "renderExplodedView", display_name: "Exploded View", kind: "scene_graph", output_formats: ["PNG", "SVG", "glTF"], camera_default: "exploded", lighting_default: "studio", ships_in_phase: "E.2", status: "pending" },
  renderAnimation: { id: "renderAnimation", display_name: "Animation", kind: "animation", output_formats: ["MP4", "GIF", "Lottie JSON"], camera_default: "marketing", lighting_default: "showroom", supports_animation: true, ships_in_phase: "E.3", status: "pending" },
  renderAR: { id: "renderAR", display_name: "AR Model", kind: "ar_vr", output_formats: ["USDZ", "glTF"], camera_default: "marketing", lighting_default: "daylight", supports_interactivity: true, ships_in_phase: "E.4", status: "pending" },
  renderVR: { id: "renderVR", display_name: "VR Walkthrough", kind: "ar_vr", output_formats: ["glTF", "USD"], camera_default: "marketing", lighting_default: "showroom", supports_interactivity: true, ships_in_phase: "E.4", status: "pending" },
  renderPrint: { id: "renderPrint", display_name: "Print-Ready", kind: "print", output_formats: ["PDF/X-1a", "PDF/X-4", "TIFF"], camera_default: "marketing", lighting_default: "studio", ships_in_phase: "E.1", status: "pending" },
  renderWebsite: { id: "renderWebsite", display_name: "Website HTML", kind: "html", output_formats: ["HTML", "CSS"], camera_default: "website", lighting_default: "daylight", supports_interactivity: true, ships_in_phase: "E.2", status: "pending" },
  renderPDF: { id: "renderPDF", display_name: "PDF Document", kind: "print", output_formats: ["PDF"], camera_default: "marketing", lighting_default: "studio", ships_in_phase: "E.1", status: "pending" },
};

export function resolveRenderTarget(id: RenderTargetId): RenderTarget { return RENDER_TARGETS[id]; }
export function listRenderTargets(): readonly RenderTarget[] { return Object.values(RENDER_TARGETS); }
export function shippedRenderTargets(): readonly RenderTarget[] { return listRenderTargets().filter((t) => t.status === "shipped"); }

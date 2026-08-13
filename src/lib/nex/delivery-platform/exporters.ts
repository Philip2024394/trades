// Delivery Platform · seed exporters (SVG shipped · 11 stubs registered).
//
// Doctrine: docs/brains/nex-phase-e5-e7-editing-delivery-design-memory-philip-2026-08-04.md

import type { Exporter, DeliveryFormat } from "./types";

const stub = (format: DeliveryFormat, targets: readonly string[]): Exporter<unknown> => ({
  format,
  status: "stub",
  supported_targets: targets,
  exporter_version: "stub_1.0",
  async export() {
    throw new Error(`Exporter for '${format}' is a stub · shipped in a later Phase E.7.x`);
  },
});

/** SVG exporter · wraps the shipped Phase E.0 renderer. The renderer produces
 *  SVG text · this exporter packages it as a DeliveryResult without further work. */
export const SVG_EXPORTER: Exporter<{ svg: string; width_px: number; height_px: number }> = {
  format: "svg",
  status: "shipped",
  supported_targets: ["renderSVG"],
  exporter_version: "phase_e0_svg_1.0",
  async export(doc) {
    return {
      format: "svg",
      text: doc.svg,
      metadata: { width_px: doc.width_px, height_px: doc.height_px },
      generated_at: new Date().toISOString(),
      exporter_version: "phase_e0_svg_1.0",
    };
  },
};

/** All shipping-set stubs · registered by seedDefaults(). */
export const DEFAULT_STUBS: readonly Exporter<unknown>[] = [
  stub("png", ["render2D"]),
  stub("jpg", ["render2D"]),
  stub("webp", ["render2D"]),
  stub("pdf", ["renderPDF", "renderPrint"]),
  stub("pdf_x1a", ["renderPrint"]),
  stub("pdf_x4", ["renderPrint"]),
  stub("docx", ["renderPDF"]),
  stub("pptx", ["renderPDF"]),
  stub("html", ["renderWebsite"]),
  stub("gltf", ["render3D"]),
  stub("usd", ["render3D"]),
  stub("usdz", ["render3D", "renderAR"]),
  stub("mp4", ["renderAnimation"]),
  stub("gif", ["renderAnimation"]),
  stub("lottie_json", ["renderAnimation"]),
  stub("eps", ["renderPrint"]),
  stub("tiff", ["renderPrint"]),
  stub("psd", ["render2D"]),
  stub("figma", ["render2D"]),
];

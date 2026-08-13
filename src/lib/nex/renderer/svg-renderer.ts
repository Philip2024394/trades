// Pixel Rendering Engine · Phase E.0 SVG Renderer.
//
// Takes a BannerSpecification + ResolvedAssets → produces production-quality SVG.
// SVG output is vector · lossless · downstream-convertible to PNG/JPEG/WEBP/PDF
// via any standard SVG-to-raster library (sharp · resvg · CairoSVG · etc.).
//
// Renderer has ZERO business logic · ZERO design intelligence · ZERO opinions.
// Nex Brain decides. Renderer draws.
//
// Doctrine: docs/brains/nex-pixel-rendering-engine-phase-e0-philip-2026-08-04.md

import crypto from "node:crypto";
import type { BannerSpecification, RenderedBanner, Layer, TextLayer, ShapeLayer, ImageLayer, ContactBoxLayer, FeatureListLayer } from "./types";
import { resolveAssets } from "./asset-resolver";
import { validateGrammar } from "./grammar";
import { bannerToDocument, type BannerDocument } from "./design-document";
import { buildRenderManifest, type RenderManifest } from "./render-manifest";

const RENDERER_VERSION = "phase_e0_svg_1.0";

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderTextLayer(layer: TextLayer): string {
  const transform = layer.transform === "uppercase" ? layer.text.toUpperCase()
    : layer.transform === "lowercase" ? layer.text.toLowerCase()
    : layer.transform === "capitalize" ? layer.text.replace(/\b\w/g, (c) => c.toUpperCase())
    : layer.text;
  const anchor = layer.text_align === "center" ? "middle" : layer.text_align === "right" ? "end" : "start";
  const anchorX = anchor === "middle" ? layer.box.x + layer.box.width / 2 : anchor === "end" ? layer.box.x + layer.box.width : layer.box.x;
  const lineHeight = (layer.line_height ?? 1.2) * layer.font_size_px;

  // Simple word-wrap: break by max_lines (respecting spec.max_lines · shrinking is Phase E.1)
  const words = transform.split(/\s+/);
  const linesOut: string[] = [];
  let current = "";
  const approxCharsPerLine = Math.floor(layer.box.width / (layer.font_size_px * 0.55));
  for (const w of words) {
    const trial = current ? current + " " + w : w;
    if (trial.length > approxCharsPerLine && current) {
      linesOut.push(current);
      current = w;
    } else current = trial;
  }
  if (current) linesOut.push(current);
  const maxLines = layer.max_lines ?? 3;
  const truncated = linesOut.slice(0, maxLines);

  const tspans = truncated.map((line, i) =>
    `<tspan x="${anchorX}" dy="${i === 0 ? 0 : lineHeight}">${esc(line)}</tspan>`
  ).join("");

  const y = layer.box.y + layer.font_size_px;
  const letterSpacing = layer.letter_spacing ? ` letter-spacing="${layer.letter_spacing}"` : "";

  return `<text x="${anchorX}" y="${y}" font-family="${esc(layer.font_family)}" font-weight="${layer.font_weight}" font-size="${layer.font_size_px}" fill="${layer.color}" text-anchor="${anchor}"${letterSpacing}>${tspans}</text>`;
}

function renderShapeLayer(layer: ShapeLayer): string {
  const stroke = layer.stroke ? ` stroke="${layer.stroke}" stroke-width="${layer.stroke_width ?? 1}"` : "";
  const opacity = layer.opacity != null ? ` opacity="${layer.opacity}"` : "";
  if (layer.shape === "rect") {
    return `<rect x="${layer.box.x}" y="${layer.box.y}" width="${layer.box.width}" height="${layer.box.height}" fill="${layer.fill}"${stroke}${opacity}/>`;
  }
  if (layer.shape === "rounded_rect") {
    const r = layer.corner_radius ?? 8;
    return `<rect x="${layer.box.x}" y="${layer.box.y}" width="${layer.box.width}" height="${layer.box.height}" rx="${r}" ry="${r}" fill="${layer.fill}"${stroke}${opacity}/>`;
  }
  if (layer.shape === "circle") {
    const cx = layer.box.x + layer.box.width / 2;
    const cy = layer.box.y + layer.box.height / 2;
    const r = Math.min(layer.box.width, layer.box.height) / 2;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${layer.fill}"${stroke}${opacity}/>`;
  }
  if (layer.shape === "ellipse") {
    const cx = layer.box.x + layer.box.width / 2;
    const cy = layer.box.y + layer.box.height / 2;
    const rx = layer.box.width / 2;
    const ry = layer.box.height / 2;
    return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${layer.fill}"${stroke}${opacity}/>`;
  }
  return "";
}

function renderImageLayer(layer: ImageLayer): string {
  const preserve = layer.preserve_aspect ?? "xMidYMid meet";
  const opacity = layer.opacity != null ? ` opacity="${layer.opacity}"` : "";
  const alt = layer.alt ? ` aria-label="${esc(layer.alt)}"` : "";
  return `<image href="${esc(layer.href)}" x="${layer.box.x}" y="${layer.box.y}" width="${layer.box.width}" height="${layer.box.height}" preserveAspectRatio="${preserve}"${opacity}${alt}/>`;
}

function renderContactBoxLayer(layer: ContactBoxLayer): string {
  const bg = `<rect x="${layer.box.x}" y="${layer.box.y}" width="${layer.box.width}" height="${layer.box.height}" rx="${layer.corner_radius}" ry="${layer.corner_radius}" fill="${layer.background}"/>`;
  const inner_x = layer.alignment === "center" ? layer.box.x + layer.box.width / 2 : layer.box.x + 20;
  const anchor = layer.alignment === "center" ? "middle" : "start";
  const startY = layer.box.y + 20 + 16;
  const lineHeight = 22;
  const shown = layer.contacts.slice(0, layer.max_lines);
  const lines = shown.map((c, i) => {
    const label = renderContactLabel(c);
    return `<text x="${inner_x}" y="${startY + i * lineHeight}" font-family="${esc(layer.font_family)}" font-size="15" fill="${layer.text_color}" text-anchor="${anchor}">${esc(label)}</text>`;
  }).join("");
  return `<g id="${esc(layer.id)}">${bg}${lines}</g>`;
}

function renderContactLabel(c: ContactBoxLayer["contacts"][number]): string {
  if (c.kind === "phone") return `📞 ${c.value}`;
  if (c.kind === "whatsapp") return `💬 ${c.value}`;
  if (c.kind === "website") return `🌐 ${c.value}`;
  if (c.kind === "email") return `✉ ${c.value}`;
  if (c.kind === "instagram") return `📷 ${c.value}`;
  if (c.kind === "facebook") return `f ${c.value}`;
  if (c.kind === "tiktok") return `♪ ${c.value}`;
  if (c.kind === "linkedin") return `in ${c.value}`;
  if (c.kind === "qr_code") return `[QR] ${c.value}`;
  if (c.kind === "address") return `📍 ${c.value}`;
  return c.value;
}

function renderFeatureListLayer(layer: FeatureListLayer): string {
  const items = layer.items.map((item, i) => {
    const y = layer.box.y + (i * (layer.icon_size_px + layer.spacing_px)) + layer.icon_size_px * 0.75;
    return `<text x="${layer.box.x}" y="${y}" font-family="${esc(layer.font_family)}" font-size="${layer.font_size_px}" fill="${layer.color}">• ${esc(item.label)}</text>`;
  }).join("");
  return `<g id="${esc(layer.id)}">${items}</g>`;
}

function renderLayer(layer: Layer): string {
  switch (layer.type) {
    case "text": return renderTextLayer(layer);
    case "shape": return renderShapeLayer(layer);
    case "image": return renderImageLayer(layer);
    case "contact_box": return renderContactBoxLayer(layer);
    case "feature_list": return renderFeatureListLayer(layer);
    case "icon": return `<circle cx="${layer.box.x + layer.box.width / 2}" cy="${layer.box.y + layer.box.height / 2}" r="${Math.min(layer.box.width, layer.box.height) / 2}" fill="${layer.fill}" opacity="0.9"/>`;
    default: return "";
  }
}

/** Main entry point. Accepts a bare BannerSpecification (legacy) or a
 *  full BannerDocument (NDIP). Produces a RenderedBanner plus a RenderManifest.
 *  The renderer makes ZERO aesthetic decisions · it draws exactly what is
 *  specified. */
export function renderBanner(input: BannerSpecification | BannerDocument): RenderedBanner {
  const t0 = Date.now();
  const log: string[] = [];

  // Normalise input · legacy specs become BannerDocuments with empty provenance.
  const doc: BannerDocument = "document_type" in input && input.document_type === "BannerDocument"
    ? input
    : bannerToDocument(input as BannerSpecification);
  const spec = doc.banner_specification;

  log.push(`renderer=${RENDERER_VERSION}`);
  log.push(`document=${doc.document_id} document_type=${doc.document_type} document_version=${doc.document_version}`);
  log.push(`spec_version=${spec.spec_version} · banner=${spec.banner_id} · layout=${spec.layout_family} · personality=${spec.brand_personality}`);
  log.push(`theme_pack=${spec.theme_pack.id} · export=${spec.export.name} ${spec.export.width_px}×${spec.export.height_px}`);

  // Stage 1 · Grammar validation (advisory · never blocking)
  const violations = validateGrammar(spec);
  log.push(`grammar_violations=${violations.length}`);

  // Stage 2 · Asset resolution
  const assets = resolveAssets(spec);
  log.push(`assets_resolved cache_key=${assets.cache_key} hero=${assets.hero_url ? "yes" : "none"}`);

  // Stage 3 · Sort layers by z_index · render each
  const sortedLayers = [...spec.layers].sort((a, b) => a.z_index - b.z_index);
  const componentPositions: Record<string, { x: number; y: number; width: number; height: number }> = {};
  const svgLayers: string[] = [];
  for (const layer of sortedLayers) {
    componentPositions[layer.id] = { x: layer.box.x, y: layer.box.y, width: layer.box.width, height: layer.box.height };
    svgLayers.push(renderLayer(layer));
  }

  // Stage 4 · Compose SVG document
  const background = `<rect width="${spec.export.width_px}" height="${spec.export.height_px}" fill="${spec.theme_pack.colors.background}"/>`;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${spec.export.width_px}" height="${spec.export.height_px}" viewBox="0 0 ${spec.export.width_px} ${spec.export.height_px}">
<title>${esc(spec.banner_id)}</title>
<desc>Rendered by ${RENDERER_VERSION} · theme_pack=${esc(spec.theme_pack.id)} · personality=${esc(spec.brand_personality)}</desc>
${background}
${svgLayers.join("\n")}
</svg>`;

  const render_ms = Date.now() - t0;
  const spec_hash = crypto.createHash("sha256").update(JSON.stringify(spec)).digest("hex").slice(0, 16);

  // Stage 5 · Build render manifest (versioning + reproducibility)
  const sceneGraphNodes = doc.scene_graph.objects.reduce((n, o) => n + (o.kind === "layer_group" ? o.layers.length : 1), 0);
  const manifest = buildRenderManifest({
    doc,
    assets,
    engineVersion: RENDERER_VERSION,
    renderTimeMs: render_ms,
    componentsRendered: sortedLayers.length,
    sceneGraphNodes,
    grammarViolations: violations,
  });
  log.push(`render_manifest render_id=${manifest.render_id} determinism_hash=${manifest.determinism_hash.slice(0, 12)}`);

  return {
    format: "svg",
    content: svg,
    width_px: spec.export.width_px,
    height_px: spec.export.height_px,
    spec_hash,
    metadata: spec.metadata,
    component_positions: componentPositions,
    render_log: log,
    grammar_violations: violations,
    performance: { render_ms, layers_rendered: sortedLayers.length },
    render_manifest: manifest,
  } as RenderedBanner & { render_manifest: RenderManifest };
}

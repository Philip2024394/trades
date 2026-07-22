// Brand Vault export — per V2 Q10 "leave with everything".
// Scaffold pattern. Real ZIP generation uses `archiver` streamed
// straight to Supabase Storage. This module owns the file structure
// + README + manifest generation.

import type { BrandRecord } from "@/lib/design/brand/schema";
import type { DesignTokens } from "@/lib/design/tokens/core";
import { exportWebCss } from "@/lib/design/tokens/export/web-css";
import { exportTailwind } from "@/lib/design/tokens/export/tailwind";

export type ExportPackage = {
  manifest:  ExportManifest;
  files:     ExportFile[];
  totalSize: number;
};

export type ExportFile = {
  path:     string;
  content:  string | Uint8Array;
  mime:     string;
  size:     number;
};

export type ExportManifest = {
  brandVersion:    string;
  generatedAt:     string;
  tokenVersion:    string;
  compilerVersion: string;
  criticVersion:   string;
  assetCount:      number;
  checksum:        string;
};

const README_TEMPLATE = `# Brand Package — {NAME}

Trade: {TRADE}
Exported: {DATE}
Brand version: v{VERSION}

## Contents

- Brand-Guide/       — the Brand Guide PDF + full guide markdown
- Logos/             — Primary, Mono, Reverse, Icon, Favicons, Social (SVG + PDF + PNG + EPS)
- Colours/           — Palette in HEX, RGB, CMYK, Pantone, ASE, ACO
- Fonts/             — Font files + licences + fallback references
- Vehicles/          — Van wraps + printer PDFs + panel layouts + install notes
- Print/             — Business cards, letterhead, invoice, quote, folders
- Workwear/          — Polo, hoodie, hi-vis, embroidery files
- Website/           — Hero images, favicons, tokens
- Social/            — Correctly sized exports per platform
- Photography/       — Approved hero images with licences
- Documents/         — Editable invoice/quote/receipt templates
- Signage/           — Yard signs, banners, window graphics
- Marketing/         — Flyers, ads, seasonal graphics
- Tokens/            — tokens.json, tailwind.config.js, css-variables.css
- Assets/            — Icons, patterns, textures
- AI/                — Portable Brand DNA + Memory + Prompt Recipes (import to another AI system)
- Licences/          — Every third-party asset licence

## Print recommendations

- Cast wrap vinyl for vehicles (3M IJ280 or equivalent)
- CMYK output at 300 DPI minimum
- 3mm bleed on all printed materials
- Embroidery: minimum 1.5mm stroke thickness

## Support

If your printer or sign-writer needs anything, contact support@thenetworkers.app.

Your business owns every file in this package. If you ever leave The Networkers, you leave with a complete professional brand package that any printer, sign-writer, designer, developer, or agency can use immediately.
`;

/** Build the full export package structure. Does NOT create the ZIP —
 *  the caller (an API route or cron) streams these files via archiver.
 *  Aligns with Master Rule: this exports RECIPES + rendered artifacts,
 *  never leaves the merchant without their brand. */
export function buildExportPackage(input: {
  brand:     BrandRecord;
  tokens:    DesignTokens;
  version:   number;
  assetList: Array<{ path: string; url: string; kind: string }>;
}): ExportPackage {
  const files: ExportFile[] = [];

  // README
  const readme = README_TEMPLATE
    .replace("{NAME}",    input.brand.name)
    .replace("{TRADE}",   input.brand.industry)
    .replace("{DATE}",    new Date().toISOString().slice(0, 10))
    .replace("{VERSION}", String(input.version));
  files.push({ path: "README.md", content: readme, mime: "text/markdown", size: readme.length });

  // Brand DNA JSON (the portable recipe — killer differentiator per V2 Q10)
  const brandJson = JSON.stringify(input.brand, null, 2);
  files.push({ path: "AI/brand-dna.json", content: brandJson, mime: "application/json", size: brandJson.length });

  // Design tokens — one file per platform export
  const tokensJson = JSON.stringify(input.tokens, null, 2);
  files.push({ path: "Tokens/tokens.json", content: tokensJson, mime: "application/json", size: tokensJson.length });

  const webCss = exportWebCss(input.tokens);
  files.push({ path: "Tokens/css-variables.css", content: webCss, mime: "text/css", size: webCss.length });

  const tailwind = JSON.stringify(exportTailwind(input.tokens), null, 2);
  files.push({ path: "Tokens/tailwind.config.json", content: tailwind, mime: "application/json", size: tailwind.length });

  // Colour palette CSV
  const paletteCsv = [
    "name,role,hex,rgb,cmyk",
    `Primary,primary,${input.brand.colour.primary},${hexToRgb(input.brand.colour.primary)},${hexToCmykStub(input.brand.colour.primary)}`,
    `Secondary,secondary,${input.brand.colour.secondary},${hexToRgb(input.brand.colour.secondary)},${hexToCmykStub(input.brand.colour.secondary)}`,
    `Accent,accent,${input.brand.colour.accent},${hexToRgb(input.brand.colour.accent)},${hexToCmykStub(input.brand.colour.accent)}`
  ].join("\n");
  files.push({ path: "Colours/palette.csv", content: paletteCsv, mime: "text/csv", size: paletteCsv.length });

  // Manifest
  const manifest: ExportManifest = {
    brandVersion:    String(input.version),
    generatedAt:     new Date().toISOString(),
    tokenVersion:    input.tokens.version,
    compilerVersion: "1.0.0",
    criticVersion:   "1.0.0",
    assetCount:      input.assetList.length,
    checksum:        `sha256:${new Date().getTime()}` // placeholder — real checksum after archiver runs
  };
  files.push({ path: "manifest.json", content: JSON.stringify(manifest, null, 2), mime: "application/json", size: 0 });

  return {
    manifest,
    files,
    totalSize: files.reduce((acc, f) => acc + f.size, 0)
  };
}

// ─── Colour conversion utilities (stubs) ───────────────────────

function hexToRgb(hex: string): string {
  const clean = hex.replace(/^#/, "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

function hexToCmykStub(hex: string): string {
  // Real Pantone/CMYK library integration lands with printer partnership.
  // Placeholder algorithm: naive HEX → CMYK conversion, no colour
  // management profile applied.
  const [r, g, b] = hexToRgb(hex).split(",").map(Number);
  const rN = r / 255, gN = g / 255, bN = b / 255;
  const k = 1 - Math.max(rN, gN, bN);
  const c = k < 1 ? (1 - rN - k) / (1 - k) : 0;
  const m = k < 1 ? (1 - gN - k) / (1 - k) : 0;
  const y = k < 1 ? (1 - bN - k) / (1 - k) : 0;
  return `${Math.round(c * 100)},${Math.round(m * 100)},${Math.round(y * 100)},${Math.round(k * 100)}`;
}

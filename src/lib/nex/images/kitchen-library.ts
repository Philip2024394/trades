// Kitchen Library data source · Philip 2026-08-04.
//
// Reads kitchen-domain specimens from data/nex-image-manifest.json and shapes
// them into the LibraryDesign records that StaircaseLibraryShell consumes.
// Same shell · same functions · different images.

import "server-only";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const MANIFEST_PATH = "data/nex-image-manifest.json";

type ManifestImage = {
  description?: string;
  tags?: readonly string[];
  subject_domain?: string;
  a_plus?: boolean;
  kitchen_context?: string;
  style_class?: string;
  primary_material?: string;
  component_family?: string;
  component_kind?: string;
  notes?: string;
  cross_domain_reference?: readonly string[];
};

export type KitchenLibraryDesign = {
  design_id: string;
  title: string;
  url: string;
  additional_views: string[];
  staircase_type: string;      // reused shape · here == kitchen style tag
  design_style: string;
  design_family?: string;
  materials: string[];
  customer_description: string;
  image_state: string;
  width: number;
  height: number;
};

function readManifest(): Record<string, ManifestImage> {
  const p = join(process.cwd(), MANIFEST_PATH);
  if (!existsSync(p)) return {};
  try {
    const parsed = JSON.parse(readFileSync(p, "utf8")) as { images?: Record<string, ManifestImage> };
    return parsed.images ?? {};
  } catch { return {}; }
}

function humaniseStyle(style?: string): string {
  if (!style) return "Bespoke Kitchen";
  return style.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function firstSentence(desc?: string): string {
  if (!desc) return "";
  const text = desc.trim();
  const period = text.indexOf(". ");
  if (period > 40 && period < 240) return text.slice(0, period + 1);
  return text.slice(0, 220);
}

/** Every kitchen-domain A+ specimen becomes a KitchenLibraryDesign · already
 *  in customer-viewable state (Philip's manifest is manually curated). */
export function listKitchenLibraryDesigns(): readonly KitchenLibraryDesign[] {
  const images = readManifest();
  const out: KitchenLibraryDesign[] = [];
  for (const [url, meta] of Object.entries(images)) {
    if (meta?.subject_domain !== "kitchen") continue;
    if (!meta.a_plus) continue;
    const styleLabel = humaniseStyle(meta.style_class);
    out.push({
      design_id: url.split("/").pop() ?? url,
      title: styleLabel,
      url,
      additional_views: [],
      staircase_type: styleLabel,
      design_style: styleLabel,
      design_family: meta.style_class ? meta.style_class.split("_")[0].replace(/^\w/, (c) => c.toUpperCase()) : "Kitchen",
      materials: (meta.tags ?? []).filter((t) => t.startsWith("walnut") || t.startsWith("oak") || t.startsWith("brass") || t.startsWith("stainless") || t.startsWith("quartz") || t.startsWith("porcelain") || t.startsWith("painted")).slice(0, 6) as string[],
      customer_description: firstSentence(meta.description),
      image_state: "photo",
      // MVP: no cached dimensions yet · use reasonable portrait defaults so the
      // shell's viewport-fit filter accepts them. Future: run the same
      // measure script that populates data/nex-confirmed-image-dimensions.json
      // for the staircase library.
      width: 1200,
      height: 1600,
    });
  }
  return out;
}

export function countKitchenLibraryDesigns(): number {
  return listKitchenLibraryDesigns().length;
}

// Visual Staircase Brain · Phase 1 audit (Philip 2026-08-01)
//
// Reads the entire image manifest · filters to staircase-domain images ·
// extracts detectable staircase attributes from existing description/tags/
// deep-intelligence fields · produces a structured classification report.
//
// Zero LLM cost · pure keyword extraction · foundation for approval
// workflow and retrieval pipeline.

import "server-only";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const MANIFEST_PATH = "data/nex-image-manifest.json";
const REPORT_PATH = "data/nex-image-audit.json";

// Attribute extractors · match keywords against description + tags + deep metadata
const STYLE_PATTERNS: Record<string, RegExp> = {
  modern:        /\bmodern\b/i,
  traditional:   /\btraditional\b/i,
  contemporary:  /\bcontemporary\b/i,
  minimal:       /\bminimal(ist)?\b/i,
  luxury:        /\bluxury|luxurious|premium\b/i,
  farmhouse:     /\bfarmhouse|rustic\b/i,
  victorian:     /\bvictorian\b/i,
  industrial:    /\bindustrial\b/i,
  scandinavian:  /\bscandinavian\b/i,
  shaker:        /\bshaker\b/i,
};

const TIMBER_PATTERNS: Record<string, RegExp> = {
  oak:      /\boak\b/i,
  walnut:   /\bwalnut\b/i,
  pine:     /\bpine\b/i,
  ash:      /\bash\b/i,
  cherry:   /\bcherry\b/i,
  mahogany: /\bmahogany\b/i,
  sapele:   /\bsapele\b/i,
  beech:    /\bbeech\b/i,
  painted:  /\bpainted|paint\b/i,
};

const BALUSTRADE_PATTERNS: Record<string, RegExp> = {
  glass:            /\bglass\s*(balustrade|balusters?|panel|clamp)|frameless\s+glass/i,
  timber_balusters: /\b(timber|wooden|oak|walnut)\s+balusters?|turned\s+baluster/i,
  metal:            /\b(metal|steel|stainless|iron|black)\s+balust|steel\s+baluster/i,
  cable:            /\bcable\s+balust|wire\s+balust/i,
  mixed:            /\bmixed\s+materials?\s+balust|combination/i,
};

const LAYOUT_PATTERNS: Record<string, RegExp> = {
  straight_flight: /\bstraight[\s-]flight|straight\s+staircase/i,
  quarter_turn:    /\bquarter[\s-]turn|l[\s-]shape/i,
  half_turn:       /\bhalf[\s-]turn|u[\s-]shape/i,
  winder:          /\bwinder\b/i,
  space_saver:     /\bspace[\s-]saver\b/i,
  floating:        /\bfloating\s+(stair|step|tread)|cantilever/i,
  curved:          /\bcurved\s+stair|sweeping/i,
  spiral:          /\bspiral\b/i,
  bifurcated:      /\bbifurcated|double\s+return/i,
};

const STRING_PATTERNS: Record<string, RegExp> = {
  closed_string: /\bclosed[\s-]string\b/i,
  cut_string:    /\bcut[\s-]string\b/i,
  open_string:   /\bopen[\s-]string\b/i,
  mono_string:   /\bmono[\s-]string|single\s+stringer/i,
};

const FEATURE_PATTERNS: Record<string, RegExp> = {
  led_lighting:      /\bled\s+(light|lighting|strip)/i,
  under_stair:       /\bunder[\s-]stair\s+(storage|cabinet|space)/i,
  wine_cellar:       /\bwine\s+cellar\b/i,
  feature_step:      /\bbullnose|curtail|feature\s+step/i,
  double_height:     /\bdouble[\s-]height|double\s+height/i,
  gallery_landing:   /\bgallery\s+landing|balcony\s+landing/i,
};

const PROJECT_PATTERNS: Record<string, RegExp> = {
  new_build:       /\bnew[\s-]build/i,
  renovation:      /\brenovat/i,
  loft_conversion: /\bloft\s+conversion/i,
  family_home:     /\bfamily\s+(home|house)/i,
  luxury_home:     /\bluxury\s+(home|house|residence)/i,
  commercial:      /\bcommercial|office\s+building/i,
};

type ImageAttributes = {
  styles:      string[];
  timbers:     string[];
  balustrades: string[];
  layouts:     string[];
  string_types: string[];
  features:    string[];
  project_types: string[];
};

type ClassifiedImage = {
  url:              string;
  created_by:       string;
  subject_domain:   string;
  image_type:       string;
  a_plus:           boolean;
  tags:             string[];
  description_len:  number;
  attributes:       ImageAttributes;
  attribute_count:  number;   // how many attributes detected · high = well-described
  classification_quality: "rich" | "moderate" | "thin" | "empty";
};

function extractAttributes(text: string): ImageAttributes {
  const matched = (patterns: Record<string, RegExp>): string[] =>
    Object.entries(patterns)
      .filter(([, p]) => p.test(text))
      .map(([k]) => k);
  return {
    styles:        matched(STYLE_PATTERNS),
    timbers:       matched(TIMBER_PATTERNS),
    balustrades:   matched(BALUSTRADE_PATTERNS),
    layouts:       matched(LAYOUT_PATTERNS),
    string_types:  matched(STRING_PATTERNS),
    features:      matched(FEATURE_PATTERNS),
    project_types: matched(PROJECT_PATTERNS),
  };
}

function totalAttributes(a: ImageAttributes): number {
  return a.styles.length + a.timbers.length + a.balustrades.length + a.layouts.length + a.string_types.length + a.features.length + a.project_types.length;
}

function qualityBand(count: number): ClassifiedImage["classification_quality"] {
  if (count >= 5) return "rich";
  if (count >= 3) return "moderate";
  if (count >= 1) return "thin";
  return "empty";
}

export type AuditReport = {
  generated_at:            string;
  total_images:            number;
  staircase_images:        number;
  approved_a_plus:         number;
  by_quality: { rich: number; moderate: number; thin: number; empty: number };
  by_creator: Record<string, number>;
  attribute_coverage: {
    styles:        Record<string, number>;
    timbers:       Record<string, number>;
    balustrades:   Record<string, number>;
    layouts:       Record<string, number>;
    string_types:  Record<string, number>;
    features:      Record<string, number>;
    project_types: Record<string, number>;
  };
  rich_images_sample:   ClassifiedImage[];   // first 5 rich · for preview
  thin_images_sample:   ClassifiedImage[];   // first 5 thin · candidates for LLM enrichment
  empty_images_count:   number;
};

export function runStaircaseImageAudit(): AuditReport {
  const path = join(process.cwd(), MANIFEST_PATH);
  if (!existsSync(path)) throw new Error(`Manifest not found at ${MANIFEST_PATH}`);

  const raw = readFileSync(path, "utf8");
  const manifest = JSON.parse(raw) as { images: Record<string, Record<string, unknown>> };
  const entries = Object.entries(manifest.images || {});

  const staircase = entries.filter(([, img]) => img.subject_domain === "staircase");

  const classified: ClassifiedImage[] = [];
  const attrCoverage = {
    styles:        {} as Record<string, number>,
    timbers:       {} as Record<string, number>,
    balustrades:   {} as Record<string, number>,
    layouts:       {} as Record<string, number>,
    string_types:  {} as Record<string, number>,
    features:      {} as Record<string, number>,
    project_types: {} as Record<string, number>,
  };
  const byCreator: Record<string, number> = {};
  let approved = 0;

  for (const [url, img] of staircase) {
    const tags = Array.isArray(img.tags) ? img.tags.join(" ") : "";
    const description = typeof img.description === "string" ? img.description : "";
    const combined = `${tags} ${description}`.toLowerCase();

    const attrs = extractAttributes(combined);
    const count = totalAttributes(attrs);
    const quality = qualityBand(count);

    const item: ClassifiedImage = {
      url,
      created_by:       String(img.created_by ?? "(none)"),
      subject_domain:   String(img.subject_domain ?? ""),
      image_type:       String(img.image_type ?? "(none)"),
      a_plus:           img.a_plus === true,
      tags:             Array.isArray(img.tags) ? img.tags as string[] : [],
      description_len:  description.length,
      attributes:       attrs,
      attribute_count:  count,
      classification_quality: quality,
    };
    classified.push(item);
    if (item.a_plus) approved += 1;
    byCreator[item.created_by] = (byCreator[item.created_by] || 0) + 1;

    // Aggregate attribute coverage
    for (const s of attrs.styles)        attrCoverage.styles[s] = (attrCoverage.styles[s] || 0) + 1;
    for (const t of attrs.timbers)       attrCoverage.timbers[t] = (attrCoverage.timbers[t] || 0) + 1;
    for (const b of attrs.balustrades)   attrCoverage.balustrades[b] = (attrCoverage.balustrades[b] || 0) + 1;
    for (const l of attrs.layouts)       attrCoverage.layouts[l] = (attrCoverage.layouts[l] || 0) + 1;
    for (const st of attrs.string_types) attrCoverage.string_types[st] = (attrCoverage.string_types[st] || 0) + 1;
    for (const f of attrs.features)      attrCoverage.features[f] = (attrCoverage.features[f] || 0) + 1;
    for (const p of attrs.project_types) attrCoverage.project_types[p] = (attrCoverage.project_types[p] || 0) + 1;
  }

  const rich = classified.filter((i) => i.classification_quality === "rich");
  const moderate = classified.filter((i) => i.classification_quality === "moderate");
  const thin = classified.filter((i) => i.classification_quality === "thin");
  const empty = classified.filter((i) => i.classification_quality === "empty");

  const report: AuditReport = {
    generated_at:      new Date().toISOString(),
    total_images:      entries.length,
    staircase_images:  staircase.length,
    approved_a_plus:   approved,
    by_quality: {
      rich: rich.length,
      moderate: moderate.length,
      thin: thin.length,
      empty: empty.length,
    },
    by_creator: byCreator,
    attribute_coverage: attrCoverage,
    rich_images_sample: rich.slice(0, 5),
    thin_images_sample: thin.slice(0, 5),
    empty_images_count: empty.length,
  };

  // Write full report + full classified list to disk for future review
  const fullOutput = { report, all_classified: classified };
  writeFileSync(join(process.cwd(), REPORT_PATH), JSON.stringify(fullOutput, null, 2), "utf8");

  return report;
}

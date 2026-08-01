// Add 1 confirmed staircase design (Philip 2026-08-01 · vision analysis)
//
//   NEX-DESIGN-000024 · Modern Floating Glass Staircase
//                        design_family='Floating' · FIRST Floating record ·
//                        closes coverage gap flagged earlier.
//                        Cross-linked to knowledge article
//                        nex-knowledge-base-modern-floating-glass-staircase.md

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const LIBRARY_PATH = join(process.cwd(), "data/nex-confirmed-images.json");
const lib = JSON.parse(readFileSync(LIBRARY_PATH, "utf8"));

const now = new Date().toISOString();
const DESIGN_ID = (n) => `NEX-DESIGN-${String(n).padStart(6, "0")}`;

const record = {
  design_id:            DESIGN_ID(24),
  title:                "Modern Floating · Timber Treads · Frameless Glass Balustrade · LED Base · Stone Bed",
  design_family:        "Floating",
  primary_brain:        "staircase",
  url:                  "https://ik.imagekit.io/5vv5pw26q/Untitledxcxcdvdfsdfdfdsasddsfsdfdfsdfasdssdsasdddsfsdfdssdsddasdasd.png",
  view_types:           ["hero"],
  staircase_type:       "modern floating · open-riser · single flight · feature architectural centrepiece",
  layout:               "floating treads · concealed structural steel (in wall or central support) · open-riser · matched glass landing balustrade · large open entrance hall with double-height ceiling · decorative stone bed beneath",
  materials:            [
    "thick hardwood floating treads (oak · ash · walnut · other hardwoods)",
    "frameless toughened structural glass balustrade",
    "concealed steel support structure",
    "warm LED lighting (base + optional tread)",
    "decorative stone bed beneath staircase",
    "stone · porcelain or timber flooring",
    "optional painted or exposed steel supports",
  ],
  balustrade_style:     "frameless toughened structural glass · matched between flight and landing · minimal visible fixings · continuous clean line",
  handrail_style:       "optional timber or metal cap · sometimes omitted for pure minimalist look",
  newel_style:          "no traditional newel · concealed structural steel support does the structural work · staircase reads as floating",
  design_style:         "contemporary luxury · modern minimalist · architectural centrepiece · high-end residential · new-build feature",
  project_suitability:  [
    "luxury_home",
    "modern_home",
    "new_build",
    "architect_designed_property",
    "high_end_renovation",
    "double_height_hall",
    "open_plan_home",
    "architectural_feature",
  ],
  related_articles:     [
    "nex-knowledge-base-modern-floating-glass-staircase.md",
    "nex-knowledge-base-staircase-design-ideas-and-inspiration.md",
    "nex-knowledge-base-staircase-materials-overview.md",
  ],
  customer_description: "A luxury contemporary floating staircase forming the centrepiece of a modern open-plan entrance hall. Thick hardwood treads appear to float with no visible risers · frameless toughened glass balustrades run the full flight and continue onto the landing · concealed steel structure hidden in the wall or a central support · warm LED lighting integrated into the base creates a soft glow · decorative stone bed beneath adds material contrast · double-height ceiling and clean architectural lines complete the composition.",
  designer_notes:       "FIRST Floating-family record · closes the coverage gap flagged in the 20-design distribution report. Style commonly specified in luxury new-builds, architect-designed properties, and high-end renovations. Requires careful structural design (steel + wall reinforcement) · best planned early in new build or major renovation. If a true floating staircase isn't practical, similar appearance can be achieved via alternative structural designs. Companion knowledge article: nex-knowledge-base-modern-floating-glass-staircase.md.",
  confirmed_by:         "Philip O'Farrell",
  confirmed_at:         now,
};

const dupById  = lib.confirmed.find((r) => r.design_id === record.design_id);
const dupByUrl = lib.confirmed.find((r) => r.url === record.url);
if (dupById || dupByUrl) {
  console.log(`skip existing · ${record.design_id}`);
} else {
  lib.confirmed.push(record);
  console.log(`added · ${record.design_id} · design_family='${record.design_family}' · ${record.title.slice(0, 80)}...`);
}

lib.updated_at = now;
writeFileSync(LIBRARY_PATH, JSON.stringify(lib, null, 2), "utf8");
console.log(`\nStaircase Visual Brain · ${lib.confirmed.length} records · ${lib.confirmed.reduce((s, r) => s + 1 + (r.additional_views?.length ?? 0), 0)} image URLs`);

const fam = {};
for (const r of lib.confirmed) fam[r.design_family || 'undefined'] = (fam[r.design_family || 'undefined'] || 0) + 1;
console.log('\nFamily distribution:');
for (const k of Object.keys(fam).sort()) console.log('   ', k + ':', fam[k]);

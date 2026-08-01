// Add 1 confirmed staircase-parts record (Philip 2026-08-01 · vision analysis)
//
//   NEX-DESIGN-000021 · Hand-carved decorative stair components ·
//                        Workshop craftsmanship reference
//                        design_family='Components' · NOT surfaced for
//                        generic "show me a staircase" queries.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const LIBRARY_PATH = join(process.cwd(), "data/nex-confirmed-images.json");
const lib = JSON.parse(readFileSync(LIBRARY_PATH, "utf8"));

const now = new Date().toISOString();
const DESIGN_ID = (n) => `NEX-DESIGN-${String(n).padStart(6, "0")}`;

const record = {
  design_id:            DESIGN_ID(21),
  title:                "Hand-Carved Decorative Stair Components · Workshop Craftsmanship Reference",
  design_family:        "Components",
  primary_brain:        "staircase",
  url:                  "https://ik.imagekit.io/5vv5pw26q/Untitleddssdcxvcvcvxcvasdasdasddfdsfdsfczxc.png",
  view_types:           ["hero"],
  staircase_type:       "carved stair components · scroll brackets · appliqués · newels · balusters · workshop reference",
  layout:               "specialist joinery workshop · master craftsman hand-carving hardwood stair component",
  materials:            [
    "hardwood timber stock",
    "oak", "walnut", "ash", "maple", "beech", "mahogany",
    "hand carving chisels and gouges",
    "bench planes and traditional woodworking tools",
    "specialist joinery benches",
  ],
  balustrade_style:     "hand-carved decorative balusters · turned and carved profiles · Victorian and Edwardian styles",
  handrail_style:       "hand-carved decorative handrail profiles · scroll ends · shaped terminations",
  newel_style:          "hand-carved newel posts · Victorian and Edwardian ornamentation · acanthus leaf carvings · turned and carved profiles",
  design_style:         "traditional master craftsmanship · Victorian · Edwardian · Georgian · bespoke hand-carved · heritage restoration",
  project_suitability:  ["heritage_restoration", "victorian_property", "edwardian_property", "georgian_property", "bespoke_carving", "period_matching", "custom_stair_parts"],
  related_articles:     [
    "nex-knowledge-base-staircase-design-ideas-and-inspiration.md",
    "nex-knowledge-base-staircase-materials-overview.md",
  ],
  customer_description: "A master woodworker hand-carving an intricate floral and scroll pattern into a hardwood stair component in a specialist joinery workshop. Reference imagery for carved stair string brackets, decorative under-step scrolls, Victorian and Edwardian stair brackets, acanthus leaf carvings, floral appliqués, carved newel posts, hand-carved balusters, decorative stair panels and ornamental stringer mouldings. Bespoke hardwood components made to order in oak, walnut, ash, maple, beech and mahogany.",
  designer_notes:       "NOT a staircase design record · this is a COMPONENTS-family reference for hand-carved stair parts. Excluded from customer default queries by design_family='Components' filter · only surfaces when the caller explicitly opts in via findConfirmedImages({..., families: ['Components']}). Router will later add Component-Intent detection (queries containing 'carved · bracket · scroll · appliqué · restoration · Victorian bracket · newel carving · baluster carving · period stair parts'). Trade Center integration point: image + text signals routes for supplier discovery.",
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
console.log(`\nVisual Brain · ${lib.confirmed.length} designs · ${lib.confirmed.reduce((s, r) => s + 1 + (r.additional_views?.length ?? 0), 0)} image URLs`);

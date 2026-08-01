// Add 1 confirmed staircase-materials record (Philip 2026-08-01 · vision analysis)
//
//   NEX-DESIGN-000023 · Timber · Sheet Materials · Staircase Boarding · Trade Center reference
//                        design_family='Materials' · new specialty family for sheet materials
//                        (T&G boards · plywood · MDF · MRMDF · mouldings · panelling · trim)
//                        distinct from decorative Components and functional Fixings.
//                        2-image set (warehouse hero + variant view).

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const LIBRARY_PATH = join(process.cwd(), "data/nex-confirmed-images.json");
const lib = JSON.parse(readFileSync(LIBRARY_PATH, "utf8"));

const now = new Date().toISOString();
const DESIGN_ID = (n) => `NEX-DESIGN-${String(n).padStart(6, "0")}`;

const record = {
  design_id:            DESIGN_ID(23),
  title:                "Trade Center · Timber · Sheet Materials · Staircase Boarding · Builders' Merchant Reference",
  design_family:        "Materials",
  primary_brain:        "staircase",
  url:                  "https://ik.imagekit.io/5vv5pw26q/Untitledxcxcdvdfsdfdfdsasddsfsdfdfsdfasdssdsasdddsfsdfdssd.png",
  additional_views:     [
    "https://ik.imagekit.io/5vv5pw26q/Untitledxcxcdvdfsdfdfdsasddsfsdfdfsdfasdssdsasdddsfsdfdssdsdd.png",
  ],
  view_labels:          ["hero · warehouse aisle", "alt · trade collection area"],
  view_types:           ["hero", "alt"],
  staircase_type:       "trade materials reference · sheet materials · T&G boarding · staircase enclosure and finishing materials",
  layout:               "builders' merchant / trade supply warehouse · organised trade aisles · forklift-handled sheet materials · trade collection area · stocked timber and sheet inventory",
  materials:            [
    "tongue and groove (T&G) boarding",
    "MDF sheets",
    "moisture-resistant MDF (MRMDF)",
    "hardwood plywood",
    "softwood plywood",
    "birch plywood",
    "oak veneered panels",
    "white primed MDF",
    "timber battens",
    "CLS timber",
    "planed timber",
    "construction timber",
    "decorative mouldings",
    "scotia and quadrant trims",
    "panel mouldings",
    "skirting boards",
    "architraves",
    "hardwood trims",
    "screws and fixings",
    "adhesives and sealants",
  ],
  balustrade_style:     "not applicable · materials reference · sheet materials used to close open staircase sides and to construct under-stair storage",
  handrail_style:       "not applicable · materials reference",
  newel_style:          "not applicable · materials reference",
  design_style:         "trade supply warehouse · builders' merchant · sheet material stock reference · staircase boarding and finishing materials",
  project_suitability:  [
    "staircase_boarding",
    "under_stair_storage",
    "under_stair_cupboard",
    "close_open_staircase_sides",
    "board_back_of_staircase",
    "staircase_side_panels",
    "decorative_wall_panelling",
    "service_cupboards_beneath_stairs",
    "box_in_exposed_staircase_framing",
    "access_panels",
    "bespoke_storage_units",
    "stairwell_wall_finishing",
  ],
  related_articles:     [
    "nex-knowledge-base-staircase-materials-overview.md",
    "nex-knowledge-base-staircase-design-ideas-and-inspiration.md",
  ],
  customer_description: "A professional builders' merchant and trade supply warehouse stocked with timber, sheet materials, fixings, tools and general building supplies. Reference for materials commonly used to close the sides of an open staircase, board the back of a staircase, build an under-stairs cupboard, finish staircase side panels, install decorative wall panelling, construct service cupboards, box in exposed framing, create access panels and finish stairwell walls. Products shown include plywood, MDF, moisture-resistant MDF, T&G boarding, timber mouldings and trims, construction timber, screws, adhesives and installation accessories.",
  designer_notes:       "NOT a staircase design record · this is a MATERIALS-family reference for sheet materials and staircase-adjacent building supplies (separate from decorative Components carvings and functional Fixings hardware). Excluded from customer default queries by design_family='Materials' being outside CUSTOMER_DEFAULT_FAMILIES · only surfaces when the caller explicitly opts in via findConfirmedImages({..., families: ['Materials']}). Router will later add Materials-Intent detection for queries containing 'T&G · tongue and groove · MDF · plywood · sheet material · under-stair · under-stair storage · boarding · box in · close in · panel · moulding · skirting · architrave · scotia · quadrant'. Trade Center integration point: image + text routes to sheet-materials and timber-merchant supplier discovery.",
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

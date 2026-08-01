// Add 1 confirmed staircase-fixings record (Philip 2026-08-01 · vision analysis)
//
//   NEX-DESIGN-000022 · Staircase screws · fixings · fasteners reference
//                        design_family='Fixings' · new specialty family
//                        for functional hardware (distinct from decorative
//                        Components carvings/brackets/scrolls).

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const LIBRARY_PATH = join(process.cwd(), "data/nex-confirmed-images.json");
const lib = JSON.parse(readFileSync(LIBRARY_PATH, "utf8"));

const now = new Date().toISOString();
const DESIGN_ID = (n) => `NEX-DESIGN-${String(n).padStart(6, "0")}`;

const record = {
  design_id:            DESIGN_ID(22),
  title:                "Staircase Screws · Fixings · Fasteners Reference · Trade Center Hardware Selection",
  design_family:        "Fixings",
  primary_brain:        "staircase",
  url:                  "https://ik.imagekit.io/5vv5pw26q/Untitledxcxcdvdfsdfdfdsasddsfsdfdfsdfasdssdsasdddsfsdf.png",
  view_types:           ["hero"],
  staircase_type:       "installation fixings · hardware reference · screws · fasteners · connectors · Trade Center hardware directory",
  layout:               "professional joinery workshop hardware selection · organised screw storage bins · labelled organiser boxes · assorted screw lengths and diameters",
  materials:            [
    "zinc-plated wood screws",
    "yellow passivated screws",
    "black construction screws",
    "countersunk timber screws",
    "washer head structural screws",
    "coach screws",
    "rail bolts",
    "threaded fixing systems",
    "specialist handrail connectors",
    "wood adhesive (referenced for use with screws)",
    "glued angle blocks (referenced for squeak prevention)",
  ],
  balustrade_style:     "not applicable · fixings reference · brackets and mouldings fixed with small countersunk wood screws with adhesive where required",
  handrail_style:       "not applicable · fixings reference · handrails fixed with timber screws · rail bolts · or specialist handrail connectors",
  newel_style:          "not applicable · fixings reference · newel posts fixed with structural timber screws · coach screws · or threaded fixing systems",
  design_style:         "professional workshop hardware selection · trade-grade fasteners · installation-focused",
  project_suitability:  ["staircase_installation", "staircase_renovation", "hardwood_stair_fixing", "softwood_stair_fixing", "mdf_stair_fixing", "plywood_stair_fixing", "structural_fixing", "decorative_fixing", "handrail_fixing", "newel_post_fixing"],
  related_articles:     [
    "nex-knowledge-base-staircase-design-ideas-and-inspiration.md",
    "nex-knowledge-base-staircase-materials-overview.md",
  ],
  customer_description: "A professional selection of wood screws and construction fixings organised by size and type in labelled storage bins — the kind found in joinery workshops, staircase manufacturers, builders' merchants and hardware suppliers. Reference for choosing the correct screws for riser-to-tread joints (fully threaded wood screws with adhesive), newel posts (structural timber screws, coach screws or threaded systems), handrails (timber screws, rail bolts or specialist connectors), stringers (structural timber screws), decorative brackets (small countersunk wood screws with adhesive) and timber mouldings (small wood screws or concealed fixings).",
  designer_notes:       "NOT a staircase design record · this is a FIXINGS-family reference for functional installation hardware (separate from decorative Components carvings/brackets/scrolls). Excluded from customer default queries by design_family='Fixings' being outside CUSTOMER_DEFAULT_FAMILIES · only surfaces when the caller explicitly opts in via findConfirmedImages({..., families: ['Fixings']}). Router will later add Fixings-Intent detection for queries containing 'which screws · fixings · fasteners · wood screw size · pilot hole · rail bolt · newel post fixing · riser tread fixing · handrail connector · staircase installation hardware'. Sample sizes referenced in the vision text: 30mm timber riser-to-tread joints (thinner timber) · 40mm MDF tread/riser · 5.0x35mm fully threaded countersunk for MDF/plywood risers with adhesive. Hardwood staircases require pilot holes to prevent splitting. Trade Center integration point: image + text routes to hardware supplier discovery.",
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

// Distribution check
const fam = {};
for (const r of lib.confirmed) fam[r.design_family || 'undefined'] = (fam[r.design_family || 'undefined'] || 0) + 1;
console.log('\nFamily distribution:');
for (const k of Object.keys(fam).sort()) console.log('   ', k + ':', fam[k]);

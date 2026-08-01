// Seed the Kitchen Visual Brain scaffold (Philip 2026-08-01)
//
// Creates data/nex-kitchen-confirmed-images.json as a separate library from
// the staircase Confirmed Design Library. Per ADR-0033 Brain Isolation Rule:
// this library is queried only by kitchen-brain code paths (none exist yet).
//
// First record: NEX-KITCHEN-000001 · kitchen design concept + process reference
// (perspective render + drafting drawings + tools). Same schema shape as the
// staircase library but with kitchen-domain field names (kitchen_type,
// cabinet_style, worktop, appliances, lighting) replacing staircase-specific
// ones (balustrade_style, handrail_style, newel_style).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const LIBRARY_PATH = join(process.cwd(), "data/nex-kitchen-confirmed-images.json");

let lib;
if (existsSync(LIBRARY_PATH)) {
  lib = JSON.parse(readFileSync(LIBRARY_PATH, "utf8"));
  console.log(`Existing kitchen library found · ${lib.confirmed?.length ?? 0} records`);
} else {
  lib = {
    version:    1,
    brain:      "kitchen",
    updated_at: new Date().toISOString(),
    confirmed:  [],
  };
  console.log("Creating new Kitchen Visual Brain scaffold");
}

const now = new Date().toISOString();
const KITCHEN_ID = (n) => `NEX-KITCHEN-${String(n).padStart(6, "0")}`;

const record = {
  design_id:            KITCHEN_ID(1),
  title:                "Kitchen Design Concept · Island Layout · Perspective Render with Design Process",
  design_family:        "Modern",
  primary_brain:        "kitchen",
  url:                  "https://ik.imagekit.io/5vv5pw26q/Untitledxcxcdvdfsdfdfdsasddsfsdfdfsdfasdssdsasdd.png",
  view_types:           ["hero"],
  kitchen_type:         "island layout with seating · L or U-shape base plus wall units · tall appliance housing",
  layout:               "base cabinets · wall cabinets · tall appliance housing · central island with seating · integrated oven and appliances · sink and mixer tap · pendant lighting",
  materials:            [
    "cabinet carcass and door timber",
    "worktop (stone/quartz/timber · to specify)",
    "appliance stainless steel",
    "flooring (to specify)",
    "wall finish (to specify)",
  ],
  cabinet_style:        "modern flat-front · base + wall + tall housings · integrated appliances",
  worktop:              "modern flush worktop across island and perimeter runs",
  appliances:           ["integrated oven", "integrated cooker", "extractor over cooker", "sink with mixer tap", "island prep zone"],
  lighting:             "pendant lighting over the island · task and ambient layers indicated on the plan",
  design_style:         "modern contemporary kitchen design · professional design process illustration",
  project_suitability:  ["modern_home", "open_plan_home", "family_home", "kitchen_renovation", "new_build_kitchen"],
  related_articles:     [],   // Kitchen Knowledge Brain doesn't exist yet
  customer_description: "A professional kitchen design concept presented as a detailed perspective architectural drawing alongside a photorealistic finished rendering. Shows a modern kitchen with a central island with seating, base and wall cabinets, tall appliance housings, integrated oven and appliances, and pendant lighting. This is the typical design process used by kitchen designers before a kitchen is manufactured and installed — measured dimensions, design notes, architectural plans and technical drawings all visible.",
  designer_notes:       "FIRST record in the Kitchen Visual Brain scaffold. Per ADR-0033 Brain Isolation, this library is separate from the staircase Confirmed Design Library and is not queried by any customer surface yet. Schema mirrors staircase library shape but replaces staircase-specific fields (balustrade_style · handrail_style · newel_style) with kitchen-domain fields (kitchen_type · cabinet_style · worktop · appliances · lighting). This image doubles as a DESIGN-PROCESS reference (drafting tools · plans · perspective render together) not just a finished-kitchen concept. When Kitchen Centre launches, this record is ready to migrate into the Kitchen Advisor retrieval path.",
  confirmed_by:         "Philip O'Farrell",
  confirmed_at:         now,
};

const dupById  = lib.confirmed.find((r) => r.design_id === record.design_id);
const dupByUrl = lib.confirmed.find((r) => r.url === record.url);
if (dupById || dupByUrl) {
  console.log(`skip existing · ${record.design_id}`);
} else {
  lib.confirmed.push(record);
  console.log(`added · ${record.design_id} · primary_brain='${record.primary_brain}' · ${record.title.slice(0, 80)}...`);
}

lib.updated_at = now;
writeFileSync(LIBRARY_PATH, JSON.stringify(lib, null, 2), "utf8");
console.log(`\nKitchen Visual Brain · ${lib.confirmed.length} records`);

// Verify staircase library is completely untouched
const staircaseLib = JSON.parse(readFileSync(join(process.cwd(), "data/nex-confirmed-images.json"), "utf8"));
const kitchenLeaks = staircaseLib.confirmed.filter((r) => (r.primary_brain ?? "").toLowerCase() === "kitchen");
console.log(`Staircase library · ${staircaseLib.confirmed.length} records · kitchen leaks?: ${kitchenLeaks.length === 0 ? "no · isolation intact" : `YES · ${kitchenLeaks.length} leaks · BRAIN ISOLATION VIOLATED`}`);

// Scaffold empty per-family and per-component Q&A files · Philip 2026-08-02.
// Idempotent · re-run to add newly-defined families/components without
// clobbering existing authored content.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const taxonomy = JSON.parse(readFileSync("data/nex-families.json", "utf8"));

const FAMILY_DIR    = "data/nex-family-qa";
const COMPONENT_DIR = "data/nex-component-qa";
if (!existsSync(FAMILY_DIR))    mkdirSync(FAMILY_DIR,    { recursive: true });
if (!existsSync(COMPONENT_DIR)) mkdirSync(COMPONENT_DIR, { recursive: true });

// Seed question sets · deliberately SMALL and generic · Philip refines as he
// authors. Every question is one that would benefit from being answered ONCE
// at family / component level rather than duplicated per image.
const FAMILY_SEED_QAS = {
  "spiral": [
    "What is a spiral staircase?",
    "How is a spiral staircase supported?",
    "Is a spiral staircase difficult to climb?",
    "Are spiral staircases legal under building regulations?",
    "Can I carry furniture up a spiral staircase?",
    "Can the direction of rotation be reversed?",
    "How much floor space does a spiral staircase need?",
    "Can the centre column be hidden?"
  ],
  "helical": [
    "What is a helical staircase?",
    "How does a helical staircase differ from a spiral?",
    "How is a helical staircase engineered?",
    "How is curved steel rolled for a helical staircase?",
    "How is the curved handrail manufactured for a helical?"
  ],
  "mono-stringer-curved": [
    "What is a curved mono-stringer staircase?",
    "How is a curved mono-stringer engineered?",
    "How is the curved steel plate manufactured?",
    "Can a curved mono-stringer be self-supporting?",
    "How thick is the steel in a curved mono-stringer?"
  ],
  "mono-stringer-straight": [
    "What is a straight mono-stringer staircase?",
    "How is a straight mono-stringer supported?",
    "Can a straight mono-stringer be free-standing?"
  ],
  "floating-cantilever": [
    "What is a floating cantilever staircase?",
    "How are floating treads engineered?",
    "Does a cantilever staircase need a structural wall?",
    "What structural wall types support a cantilever staircase?",
    "How are the hidden brackets designed for a cantilever?",
    "Can a cantilever staircase be built without a wall?"
  ],
  "straight-flight": [
    "What is a straight-flight staircase?",
    "What is the typical span of a straight-flight staircase?",
    "How is a straight-flight installed?"
  ],
  "open-riser": [
    "What is an open-riser staircase?",
    "Are open-riser staircases legal?",
    "Are open risers safe for children?",
    "Can pets use open-riser staircases?",
    "Can I convert open risers to closed risers later?"
  ],
  "glass-balustrade": [
    "Is a glass balustrade safe?",
    "What glass is used for a staircase balustrade?",
    "Is the glass laminated?",
    "Is the glass toughened?",
    "How thick is a structural glass balustrade panel?",
    "Can a glass balustrade panel be replaced individually?",
    "Can I have tinted or low-iron glass?",
    "What fixing systems are used for glass balustrades?"
  ],
  "steel-balustrade": [
    "What are the balusters made from?",
    "Can the balusters be replaced with glass?",
    "What baluster spacing is required?",
    "Can I have horizontal steel rails instead of vertical balusters?"
  ],
  "timber-balustrade": [
    "What timber is used for spindles and newels?",
    "Can I have square or turned spindles?",
    "Can timber balusters be painted?"
  ],
  "feature-lighting": [
    "What lighting is used in feature staircases?",
    "Can the lighting be dimmed?",
    "Can the lighting change colour?",
    "How is the wiring hidden?",
    "Can the lighting be replaced if it fails?",
    "Can lighting be added later?",
    "Can smart home systems control the lighting?"
  ]
};

const COMPONENT_SEED_QAS = {
  "tread": [
    "What is a tread?",
    "How thick are staircase treads?",
    "What timber is used for staircase treads?",
    "Can treads be replaced individually?",
    "Can treads be sanded and refinished?"
  ],
  "riser": [
    "What is a riser?",
    "What is the difference between open and closed risers?",
    "Can I convert from open to closed risers later?"
  ],
  "stringer": [
    "What is a stringer?",
    "What is the difference between a mono-stringer and twin stringers?",
    "What is a cut string vs a closed string?",
    "How thick is the steel in a mono-stringer?"
  ],
  "newel": [
    "What is a newel post?",
    "What are typical newel post sizes?",
    "What timbers are used for newel posts?",
    "How is a newel post fixed?"
  ],
  "handrail": [
    "What is a handrail?",
    "What handrail materials are available?",
    "What handrail height is required?",
    "How is a curved handrail manufactured?"
  ],
  "baluster": [
    "What is a baluster?",
    "What is the maximum baluster spacing allowed?",
    "Can balusters be replaced with glass panels?"
  ],
  "balustrade-glass": [
    "What is a glass balustrade panel?",
    "Is the glass toughened or laminated?",
    "How thick are structural glass panels?",
    "Can a glass panel be replaced individually?"
  ],
  "lighting-led": [
    "What LED lighting is used in staircases?",
    "Can LED tread lights be dimmed?",
    "Can LEDs be replaced?",
    "How is the wiring concealed?"
  ],
  "landing": [
    "What is a staircase landing?",
    "Does the landing need extra structural support?",
    "Can the landing shape be customised?"
  ],
  "fixings-glass": [
    "What glass fixings are used?",
    "What is a stainless steel standoff?",
    "Can glass be fixed without visible bolts?"
  ]
};

let familyFilesCreated  = 0, familyFilesSkipped  = 0;
let compFilesCreated    = 0, compFilesSkipped    = 0;

// Families
for (const fam of taxonomy.families) {
  const path = join(FAMILY_DIR, `${fam.family_id}.json`);
  if (existsSync(path)) { familyFilesSkipped++; continue; }
  const seed = FAMILY_SEED_QAS[fam.family_id] ?? [];
  const payload = {
    version:      1,
    updated_at:   new Date().toISOString(),
    layer:        "family",
    family_id:    fam.family_id,
    label:        fam.label,
    description:  fam.description,
    note:         "Layer 3 · FAMILY Q&A · applies to every staircase in this family. Author once · every image tagged with this family_id gets it automatically. Empty `a` slots are skipped.",
    qa:           seed.map((q) => ({ q, a: "" }))
  };
  writeFileSync(path, JSON.stringify(payload, null, 2), "utf8");
  familyFilesCreated++;
}

// Components
for (const comp of taxonomy.components) {
  const path = join(COMPONENT_DIR, `${comp.component_id}.json`);
  if (existsSync(path)) { compFilesSkipped++; continue; }
  const seed = COMPONENT_SEED_QAS[comp.component_id] ?? [];
  const payload = {
    version:       1,
    updated_at:    new Date().toISOString(),
    layer:         "component",
    component_id:  comp.component_id,
    label:         comp.label,
    description:   comp.description,
    note:          "Layer 2 · COMPONENT BRAIN Q&A · applies to every staircase where this component is present. Cross-references the deeper knowledge articles in data/nex-reference-brains/. Author once · every image tagged with this component_id gets it automatically. Empty `a` slots are skipped.",
    qa:            seed.map((q) => ({ q, a: "" }))
  };
  writeFileSync(path, JSON.stringify(payload, null, 2), "utf8");
  compFilesCreated++;
}

console.log("Scaffolding complete:");
console.log(`  Family files:    ${familyFilesCreated} created · ${familyFilesSkipped} already existed`);
console.log(`  Component files: ${compFilesCreated} created · ${compFilesSkipped} already existed`);

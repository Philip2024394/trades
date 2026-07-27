#!/usr/bin/env node
// scripts/import-nex-education-batch-3.mjs
//
// (A) Reclassifies 4 orphaned under-stair rows from prior batch to
//     staircase_brain, per Philip 2026-07-27 HARD LAW: "understaircase
//     office or cabinets or playarea or wine rack is classed in the
//     staircase family". Classifier is now updated but rows already
//     saved need force-repair.
//
// (B) Saves 5 new images from Philip 2026-07-27:
//     1. Under-stair reclassification example
//     2. Mahogany material reference for 3D design studio
//     3. Walnut material reference for 3D design studio
//     4. Wide-plank hardwood flooring — Grade 1b (paired sibling)
//     5. Smaller-width hardwood flooring — Grade D2 (paired sibling)
//
// (C) Wires sibling_proportion_variation family_tree between images
//     4 & 5 (same hardwood, different plank widths — the point of the
//     "flooring must work with staircase" education article).

import fs from "node:fs/promises";
import path from "node:path";

const API = "http://localhost:3008/api/admin/image-tagger/save";

const UNDER_STAIR_EXAMPLE = "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2012_13_43%20PM.png";
const MAHOGANY_MATERIAL   = "https://ik.imagekit.io/5vv5pw26q/Untitledsdasasdvcxvsdasdsdsd.png";
const WALNUT_MATERIAL     = "https://ik.imagekit.io/5vv5pw26q/Untitledsdasasdvcxvsdasd.png";
const FLOOR_WIDE_1B       = "https://ik.imagekit.io/5vv5pw26q/Untitledasdadasss.png";
const FLOOR_NARROW_D2     = "https://ik.imagekit.io/5vv5pw26q/Untitledasdadasssdasd.png";

const ART_FLOOR = "data/nex-customer-education/hallway-flooring-and-staircase-proportions.md";

// Orphaned rows from batch 2 to be reclassified
const ORPHAN_URLS = [
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2002_15_03%20PM.png", // playhouse
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2002_11_51%20PM.png", // office
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2002_04_59%20PM.png", // panels
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2002_24_32%20PM.png", // seating
];

// -----------------------------------------------------------
// Descriptions
// -----------------------------------------------------------

const under_stair_example_desc = `IMAGE IDENTITY

Image Name:
Under-Stair Feature Example (reclassification reference)

Category:
Customer Education > Under-Stair Ideas > Reclassification Reference

Sub Category:
Under-stair joinery feature that establishes the staircase-family classification rule

Primary Style:
Aspirational interior reference

Secondary Style:
Educational reclassification reference

Photographic Style:
Architectural interior photography

Recommendation Type:
EDUCATIONAL — under-stair joinery is part of the staircase family (Philip 2026-07-27 HARD LAW)

Belongs In:
staircase_brain (under-stair features classification rule)

IMAGE DESCRIPTION

An under-stair joinery feature used as the reference image that established the NEX under-stair classification rule: under-stair office · cabinets · playhouse · wine rack · seating · feature panels · storage · reading nook all belong to the staircase family and classify to staircase_brain. Joinery shops that manufacture staircases routinely deliver under-stair features alongside the staircase itself, so the intelligence must co-locate.

OBJECT DETECTION

PRIMARY OBJECTS
- Under-stair joinery feature integrated into the staircase geometry
- Staircase above
- Interior finishes

SECONDARY OBJECTS
- Adjacent hallway or living context
- Ambient lighting
- Decor styling

BACKGROUND OBJECTS
- Interior environment

MATERIAL ANALYSIS

Primary Material:
Timber joinery (coordinated with staircase)

CAMERA INFORMATION

Image Orientation:
Portrait

Camera Position:
Eye Level

View:
Interior architectural feature view

Composition:
Feature composition on the under-stair joinery

LIGHTING

Primary Lighting:
Warm interior ambient light

QUALITY

Realism:
Ultra photorealistic

Rendering:
Architectural interior visualisation

SETTING

Primary Setting:
Residential under-stair area

AI REPRODUCTION RULES

MUST KEEP
- Under-stair joinery feature clearly integrated with the staircase above
- Sense of purpose-built joinery rather than free-standing furniture
- Coordinated appearance with the staircase family

DO NOT CHANGE
- Under-stair classification framing (this row is a reference example for the rule)
- Educational purpose

ALLOWED MODIFICATIONS
Users may change:
- Timber species / finish
- Feature type (office / cabinets / seating / storage / etc.)
- Interior styling

MASTER AI PROMPT

Ultra photorealistic interior architectural render of a bespoke under-stair joinery feature — integrated with the staircase geometry above · coordinated timber / finish palette · warm interior ambient light · premium interior visualisation. Used as the reclassification reference image that established the NEX under-stair-features-belong-to-staircase-family HARD LAW.`;

const mahogany_material_desc = `IMAGE IDENTITY

Image Name:
Mahogany Material Texture — 3D Design Studio Reference

Category:
NEX 3D Design Studio > Material Library > Timber Species

Sub Category:
Mahogany · seamless timber texture reference for 3D staircase material application

Primary Style:
Material texture reference

Secondary Style:
3D design studio input asset

Photographic Style:
Flat material sample photograph / seamless texture

Recommendation Type:
DESIGN_ASSET — material texture reference for NEX 3D design studio

Belongs In:
staircase_brain (staircase material library) · also inheritable to timber_brain when queried as raw species reference

Material Texture Type:
Mahogany · rich reddish-brown timber with characteristic straight grain and fine texture · takes lacquer or oil finish · premium furniture-grade species

Studio Use:
Applied to staircase 3D previews when a customer selects Mahogany as the timber species. The texture maps to treads · risers · strings · newels · handrails · balusters · under-stair panels via the standard NEX PBR material pipeline.

IMAGE DESCRIPTION

A material texture reference image of Mahogany timber used as an input asset for the NEX 3D design studio staircase material library. Rich reddish-brown timber with the characteristic straight to interlocked grain and fine even texture of Mahogany. Used by the 3D preview to apply Mahogany finish to staircase components when a customer selects the species.

OBJECT DETECTION

PRIMARY OBJECTS
- Mahogany timber texture sample
- Grain pattern
- Finish surface

MATERIAL ANALYSIS

Primary Material:
Mahogany (rich reddish-brown · straight to interlocked grain · fine even texture · premium furniture-grade)

Finish:
Lacquered / oiled — captured for use as base colour map input to PBR pipeline

CAMERA INFORMATION

Image Orientation:
Square / flat sample

View:
Flat material sample view

Composition:
Seamless texture composition (or intended to tile) for material mapping

LIGHTING

Primary Lighting:
Even neutral diffuse light (as required for texture reference — no directional shadows)

QUALITY

Realism:
Photorealistic material sample

Rendering:
Material texture reference

SETTING

Primary Setting:
NEX 3D design studio material library

AI REPRODUCTION RULES

MUST KEEP
- Recognisable Mahogany colour signature (rich reddish-brown)
- Characteristic straight to interlocked grain pattern
- Even lighting suitable for texture use
- Premium furniture-grade appearance

DO NOT CHANGE
- Species colour identity
- Grain characteristics
- Suitability as a PBR base colour map

ALLOWED MODIFICATIONS
Users may change:
- Finish variant (lacquered · oiled · matte · satin) when applied downstream
- Tile density in 3D application

MASTER AI PROMPT

Photorealistic material texture reference of Mahogany timber for use as a PBR base colour map in the NEX 3D design studio staircase material library. Rich reddish-brown timber · characteristic straight to interlocked grain · fine even texture · premium furniture-grade species · even neutral diffuse light · no directional shadows · captured for direct application to staircase components (treads · risers · strings · newels · handrails · balusters · under-stair panels) via the standard NEX PBR material pipeline.`;

const walnut_material_desc = `IMAGE IDENTITY

Image Name:
Walnut Material Texture — 3D Design Studio Reference

Category:
NEX 3D Design Studio > Material Library > Timber Species

Sub Category:
American Black Walnut · seamless timber texture reference for 3D staircase material application

Primary Style:
Material texture reference

Secondary Style:
3D design studio input asset

Photographic Style:
Flat material sample photograph / seamless texture

Recommendation Type:
DESIGN_ASSET — material texture reference for NEX 3D design studio

Belongs In:
staircase_brain (staircase material library) · also inheritable to timber_brain when queried as raw species reference

Material Texture Type:
American Black Walnut · deep chocolate-brown timber with dramatic dark grain contrast · takes lacquer or oil finish · premium furniture-grade species

Studio Use:
Applied to staircase 3D previews when a customer selects Walnut as the timber species. The texture maps to treads · risers · strings · newels · handrails · balusters · under-stair panels via the standard NEX PBR material pipeline.

IMAGE DESCRIPTION

A material texture reference image of American Black Walnut timber used as an input asset for the NEX 3D design studio staircase material library. Deep chocolate-brown timber with the characteristic dark grain contrast and straight-to-wavy grain of American Black Walnut. Used by the 3D preview to apply Walnut finish to staircase components when a customer selects the species.

OBJECT DETECTION

PRIMARY OBJECTS
- American Black Walnut timber texture sample
- Grain pattern
- Finish surface

MATERIAL ANALYSIS

Primary Material:
American Black Walnut (deep chocolate-brown · dramatic grain contrast · straight to wavy grain · premium furniture-grade)

Finish:
Lacquered / oiled — captured for use as base colour map input to PBR pipeline

CAMERA INFORMATION

Image Orientation:
Square / flat sample

View:
Flat material sample view

Composition:
Seamless texture composition (or intended to tile) for material mapping

LIGHTING

Primary Lighting:
Even neutral diffuse light (as required for texture reference — no directional shadows)

QUALITY

Realism:
Photorealistic material sample

Rendering:
Material texture reference

SETTING

Primary Setting:
NEX 3D design studio material library

AI REPRODUCTION RULES

MUST KEEP
- Recognisable Walnut colour signature (deep chocolate-brown)
- Characteristic dark grain contrast
- Even lighting suitable for texture use
- Premium furniture-grade appearance

DO NOT CHANGE
- Species colour identity
- Grain characteristics
- Suitability as a PBR base colour map

ALLOWED MODIFICATIONS
Users may change:
- Finish variant (lacquered · oiled · matte · satin) when applied downstream
- Tile density in 3D application

MASTER AI PROMPT

Photorealistic material texture reference of American Black Walnut timber for use as a PBR base colour map in the NEX 3D design studio staircase material library. Deep chocolate-brown timber · characteristic dark grain contrast · straight to wavy grain · premium furniture-grade species · even neutral diffuse light · no directional shadows · captured for direct application to staircase components (treads · risers · strings · newels · handrails · balusters · under-stair panels) via the standard NEX PBR material pipeline.`;

const floor_wide_desc = `IMAGE IDENTITY

Image Name:
Hardwood Flooring — Wide Plank Grade 1b (sibling A)

Category:
Customer Education > Design Philosophy > Flooring–Staircase Proportion

Sub Category:
Wide-plank hardwood flooring · Grade 1b · paired with the narrow-plank D2 sibling for proportion education

Primary Style:
Material proportion reference

Secondary Style:
Educational sibling comparison

Photographic Style:
Flat flooring reference photograph

Recommendation Type:
EDUCATIONAL — one half of the sibling pair proving flooring plank width must match staircase tread proportions

Educational Article:
${ART_FLOOR}

Sibling Image (sibling_proportion_variation):
${FLOOR_NARROW_D2}

IMAGE DESCRIPTION

A wide-plank hardwood flooring reference · Grade 1b · used as the FIRST of a paired sibling set demonstrating the NEX 60% Journey principle that flooring plank width must be considered alongside staircase tread proportions. Paired with the narrow-plank Grade D2 sibling: when the two are viewed side by side (or when either is paired against a mismatched staircase tread width) the visual imbalance becomes obvious.

Wide flooring paired with a small-tread staircase makes the staircase look undersized. That is the anti-pattern this reference proves.

OBJECT DETECTION

PRIMARY OBJECTS
- Wide-plank hardwood flooring boards
- Grade 1b timber character (fewer knots · cleaner grain · furniture-grade appearance)
- Plank joins and edges

MATERIAL ANALYSIS

Primary Material:
Hardwood flooring · Grade 1b · wide plank

Grade Note:
Grade 1b denotes a cleaner appearance grade in hardwood flooring — fewer character marks · straighter grain · premium finish.

CAMERA INFORMATION

Image Orientation:
Rectangular flooring sample

View:
Top-down or slightly angled flooring reference view

Composition:
Flooring texture composition — plank width and grain the primary subjects

LIGHTING

Primary Lighting:
Even neutral daylight (as required for material reference)

QUALITY

Realism:
Photorealistic material sample

Rendering:
Material reference photography

SETTING

Primary Setting:
Flooring library reference

AI REPRODUCTION RULES

MUST KEEP
- Wide plank width clearly visible (the whole point of the sibling pair)
- Grade 1b hardwood character
- Even lighting suitable for texture use
- Sibling-pair relationship with the Grade D2 narrow-plank reference

DO NOT CHANGE
- Plank width character (widening or narrowing it would break the sibling comparison)
- Sibling-pair relationship

ALLOWED MODIFICATIONS
Users may change:
- Timber species (the point is plank WIDTH, not species)
- Finish (matte · satin · lacquer · oil)

MASTER AI PROMPT

Photorealistic hardwood flooring reference photograph — WIDE plank width · Grade 1b appearance (fewer knots · cleaner grain · furniture-grade finish) · even neutral daylight · captured as the FIRST of a paired sibling set in the "hallway flooring must work with your staircase" NEX education article. Used to demonstrate that wide flooring paired with a small-tread staircase makes the staircase look undersized. Sibling comparison partner is the narrow-plank Grade D2 reference.`;

const floor_narrow_desc = `IMAGE IDENTITY

Image Name:
Hardwood Flooring — Narrow Plank Grade D2 (sibling B)

Category:
Customer Education > Design Philosophy > Flooring–Staircase Proportion

Sub Category:
Narrow-plank hardwood flooring · Grade D2 · paired with the wide-plank 1b sibling for proportion education

Primary Style:
Material proportion reference

Secondary Style:
Educational sibling comparison

Photographic Style:
Flat flooring reference photograph

Recommendation Type:
EDUCATIONAL — one half of the sibling pair proving flooring plank width must match staircase tread proportions

Educational Article:
${ART_FLOOR}

Sibling Image (sibling_proportion_variation):
${FLOOR_WIDE_1B}

IMAGE DESCRIPTION

A narrow-plank hardwood flooring reference · Grade D2 · used as the SECOND of a paired sibling set demonstrating the NEX 60% Journey principle that flooring plank width must be considered alongside staircase tread proportions. Paired with the wide-plank Grade 1b sibling: when the two are viewed side by side the visual difference in plank width — using the same hardwood species — becomes obvious.

Narrow flooring paired with a wide-tread staircase makes the staircase look oversized. That is the anti-pattern this reference proves.

OBJECT DETECTION

PRIMARY OBJECTS
- Narrow-plank hardwood flooring boards
- Grade D2 timber character (more visible knots · character marks · rustic appearance)
- Plank joins and edges

MATERIAL ANALYSIS

Primary Material:
Hardwood flooring · Grade D2 · narrow plank

Grade Note:
Grade D2 denotes a more rustic / character-grade hardwood flooring — visible knots · character marks · variation of grain · casual look.

CAMERA INFORMATION

Image Orientation:
Rectangular flooring sample

View:
Top-down or slightly angled flooring reference view

Composition:
Flooring texture composition — plank width and grain the primary subjects

LIGHTING

Primary Lighting:
Even neutral daylight (as required for material reference)

QUALITY

Realism:
Photorealistic material sample

Rendering:
Material reference photography

SETTING

Primary Setting:
Flooring library reference

AI REPRODUCTION RULES

MUST KEEP
- Narrow plank width clearly visible (the whole point of the sibling pair)
- Grade D2 hardwood character
- Even lighting suitable for texture use
- Sibling-pair relationship with the Grade 1b wide-plank reference

DO NOT CHANGE
- Plank width character (widening or narrowing it would break the sibling comparison)
- Sibling-pair relationship

ALLOWED MODIFICATIONS
Users may change:
- Timber species (the point is plank WIDTH, not species)
- Finish (matte · satin · lacquer · oil)

MASTER AI PROMPT

Photorealistic hardwood flooring reference photograph — NARROW plank width · Grade D2 appearance (more visible knots · character marks · rustic timber) · even neutral daylight · captured as the SECOND of a paired sibling set in the "hallway flooring must work with your staircase" NEX education article. Used to demonstrate that narrow flooring paired with a wide-tread staircase makes the staircase look oversized. Sibling comparison partner is the wide-plank Grade 1b reference.`;

// -----------------------------------------------------------
// Runner
// -----------------------------------------------------------

async function save(url, description, notes) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      images: {
        [url]: { description, source: "ai_generated", created_by: "philip", notes },
      },
    }),
  });
  return await res.json();
}

async function main() {
  console.log("NEX Education Batch 3\n=====================\n");
  console.log("(B) Saving 5 new images…\n");
  const newRows = [
    { url: UNDER_STAIR_EXAMPLE, desc: under_stair_example_desc, notes: "Under-stair reclassification reference example · staircase_brain per HARD LAW", label: "under_stair_example" },
    { url: MAHOGANY_MATERIAL,   desc: mahogany_material_desc,   notes: "3D design studio material · Mahogany timber PBR reference for staircase components", label: "mahogany_material" },
    { url: WALNUT_MATERIAL,     desc: walnut_material_desc,     notes: "3D design studio material · American Black Walnut timber PBR reference for staircase components", label: "walnut_material" },
    { url: FLOOR_WIDE_1B,       desc: floor_wide_desc,          notes: "Hallway flooring proportion pair · wide plank Grade 1b · sibling to " + FLOOR_NARROW_D2, label: "floor_wide_1b" },
    { url: FLOOR_NARROW_D2,     desc: floor_narrow_desc,        notes: "Hallway flooring proportion pair · narrow plank Grade D2 · sibling to " + FLOOR_WIDE_1B, label: "floor_narrow_d2" },
  ];
  for (const r of newRows) {
    const res = await save(r.url, r.desc, r.notes);
    console.log("  " + r.label.padEnd(24), res.ok ? "SAVED" : `ERROR: ${res.error}`);
  }

  console.log("\n(A) Re-saving orphaned batch-2 rows with updated classifier…\n");
  const manifestPath = path.join(process.cwd(), "data", "nex-image-manifest.json");
  let manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  for (const url of ORPHAN_URLS) {
    const row = manifest.images[url];
    if (!row) { console.log("  MISSING:", url); continue; }
    const res = await save(url, row.description || row.master_description || "", row.notes || "");
    console.log("  " + url.split("/").pop().slice(0, 40).padEnd(40), res.ok ? "REPROCESSED" : `ERROR: ${res.error}`);
  }
  manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

  console.log("\n(C) Wiring sibling_proportion_variation on the flooring pair…");
  const w = manifest.images[FLOOR_WIDE_1B];
  const n = manifest.images[FLOOR_NARROW_D2];
  if (w && n) {
    w.family_tree = w.family_tree || { parent_url: undefined, children: [] };
    n.family_tree = n.family_tree || { parent_url: undefined, children: [] };
    const stampW = {
      type: "sibling_proportion_variation",
      url: FLOOR_NARROW_D2,
      generated_at: new Date().toISOString(),
      generated_by: "philip",
      notes: "Sibling proportion variation — narrow plank Grade D2 · same hardwood species · different plank width",
    };
    const stampN = {
      type: "sibling_proportion_variation",
      url: FLOOR_WIDE_1B,
      generated_at: new Date().toISOString(),
      generated_by: "philip",
      notes: "Sibling proportion variation — wide plank Grade 1b · same hardwood species · different plank width",
    };
    if (!w.family_tree.children.some((c) => c.url === FLOOR_NARROW_D2)) w.family_tree.children.push(stampW);
    if (!n.family_tree.children.some((c) => c.url === FLOOR_WIDE_1B)) n.family_tree.children.push(stampN);
    manifest.generated_at = new Date().toISOString();
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
    console.log("  ✓ Wide 1b knows about Narrow D2");
    console.log("  ✓ Narrow D2 knows about Wide 1b");
  }

  console.log("\nFinal row states:\n");
  const reportUrls = [...newRows.map(r => r.url), ...ORPHAN_URLS];
  const labels = {
    [UNDER_STAIR_EXAMPLE]: "under_stair_example  ",
    [MAHOGANY_MATERIAL]:   "mahogany_material    ",
    [WALNUT_MATERIAL]:     "walnut_material      ",
    [FLOOR_WIDE_1B]:       "floor_wide_1b        ",
    [FLOOR_NARROW_D2]:     "floor_narrow_d2      ",
    [ORPHAN_URLS[0]]:      "playhouse (repaired) ",
    [ORPHAN_URLS[1]]:      "office    (repaired) ",
    [ORPHAN_URLS[2]]:      "panels    (repaired) ",
    [ORPHAN_URLS[3]]:      "seating   (repaired) ",
  };
  for (const url of reportUrls) {
    const row = manifest.images[url];
    if (row) {
      console.log(
        "  " + (labels[url] || url.slice(-30)),
        "score:", String(row.master_image_score?.master_score ?? "?").padStart(3),
        "· band:", (row.knowledge_band_label ?? "?").padEnd(22),
        "· brain:", (row.primary_brain ?? "?").padEnd(18),
        "· collections:", (row.collection_memberships || []).length
      );
    }
  }
  console.log("\nBatch 3 complete.");
}

main().catch((e) => { console.error(e); process.exit(1); });

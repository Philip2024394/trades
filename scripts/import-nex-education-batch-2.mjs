#!/usr/bin/env node
// scripts/import-nex-education-batch-2.mjs
//
// Saves 6 images referenced from 5 new customer-education articles
// (Philip 2026-07-27):
//   1. 60%-journey material-variation A (sibling)
//   2. 60%-journey material-variation B (sibling)
//   3. Under-stair children's playhouse
//   4. Under-stair home office
//   5. Wide feature panels with circular display windows
//   6. Under-stair seating area
//
// Wires a NEW relationship pattern: sibling_material_variation
// (same conceptual geometry, different finish/material treatment)
// between images 1 & 2. That relationship is Rule #14 family_tree
// applied sideways instead of parent/child.
//
// Voice: all descriptions authored under the HARD LAW banned-phrasing
// rule (no "At NEX, we…") — NEX-as-intelligence phrasing throughout.

import fs from "node:fs/promises";
import path from "node:path";

const API = "http://localhost:3008/api/admin/image-tagger/save";

const MATERIAL_A = "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2002_57_44%20PM.png";
const MATERIAL_B = "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2002_52_38%20PM.png";
const PLAYHOUSE  = "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2002_15_03%20PM.png";
const OFFICE     = "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2002_11_51%20PM.png";
const PANELS     = "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2002_04_59%20PM.png";
const SEATING    = "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2026,%202026,%2002_24_32%20PM.png";

const ART_60 = "data/nex-customer-education/staircase-is-only-60-percent-of-the-journey.md";
const ART_PLAY = "data/nex-customer-education/under-stair-childrens-playhouse.md";
const ART_OFF = "data/nex-customer-education/under-stair-home-office.md";
const ART_PAN = "data/nex-customer-education/wide-feature-panels-under-staircase.md";
const ART_SEAT = "data/nex-customer-education/under-stair-seating-area.md";

// -----------------------------------------------------------
// Descriptions
// -----------------------------------------------------------

function baseFrame({name, category, sub, article, primary_role, sibling}) {
  return `IMAGE IDENTITY

Image Name:
${name}

Category:
Customer Education > ${category}

Sub Category:
${sub}

Primary Style:
Aspirational interior reference

Secondary Style:
Educational article illustration

Photographic Style:
Architectural interior photography

Recommendation Type:
${primary_role}

Educational Article:
${article}
${sibling ? `\nSibling Image (${sibling.relationship}):\n${sibling.url}\n` : ""}`;
}

const material_a_desc = baseFrame({
  name: "60% Journey — Material Variation A",
  category: "Design Philosophy > 60% Journey",
  sub: "Same conceptual staircase layout · material treatment A",
  article: ART_60,
  primary_role: "EDUCATIONAL — demonstrates how material choice transforms an identical staircase geometry",
  sibling: { url: MATERIAL_B, relationship: "sibling_material_variation" },
}) + `
IMAGE DESCRIPTION

A staircase render used as the FIRST of a paired sibling set. Same layout · geometry · proportions · camera angle · room composition as the paired variation image. Material treatment A applied — finish/species/balustrade combination that establishes one interpretation of the identical foundation. Used in the customer-education article "Choosing the Right Staircase Is Only 60% of the Journey" to prove that the timber choice and finish create the wow factor on top of the staircase framework, not the framework alone.

Paired with variation B (same layout, alternative material treatment). The two images are sibling material variations under Rule #14 family_tree — no parent, no child, just two equally valid interpretations of the same conceptual staircase.

OBJECT DETECTION

PRIMARY OBJECTS
- Complete staircase in interior context
- Balustrade
- Handrail
- Newel post
- Treads and risers
- Surrounding interior finishes

SECONDARY OBJECTS
- Flooring
- Wall finish
- Ambient lighting
- Decor elements

BACKGROUND OBJECTS
- Hallway / entrance context

MATERIAL ANALYSIS

Primary Material:
Timber staircase with material treatment A

Style Note:
The material palette is the entire subject of the pair — study alongside variation B to see how identical geometry yields two different design personalities.

CAMERA INFORMATION

Image Orientation:
Portrait

Camera Position:
Eye Level

View:
Straight-on interior reference view (matched to variation B for direct comparison)

Composition:
Interior architectural composition

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
Residential hallway / entrance context

AI REPRODUCTION RULES

MUST KEEP
- Identical geometry and proportions as sibling variation B
- Same layout / camera / composition (only material changes across the pair)
- Photorealistic interior visualisation quality
- Sense that this is one of two equally valid material interpretations of the same design

DO NOT CHANGE
- Sibling-pair relationship — never orphan this image from variation B
- Geometry of the staircase (change ONLY finish / species / balustrade / decor)

ALLOWED MODIFICATIONS
Users may change:
- Wall colour
- Flooring
- Lighting treatment
- Decor accessories

MASTER AI PROMPT

Ultra photorealistic architectural interior render of a residential staircase in its full room context — material treatment A of a paired sibling set. Identical geometry / proportions / camera / composition to sibling variation B. The material palette (timber species · finish · balustrade metallurgy / glazing · decorative details) is the subject: this variation demonstrates one design personality on top of the shared foundation. Warm interior ambient lighting · realistic shadows · premium interior visualisation · designed for direct side-by-side comparison with variation B in the "60% Journey" education article.`;

const material_b_desc = baseFrame({
  name: "60% Journey — Material Variation B",
  category: "Design Philosophy > 60% Journey",
  sub: "Same conceptual staircase layout · material treatment B",
  article: ART_60,
  primary_role: "EDUCATIONAL — sibling to variation A, demonstrates how a different material palette rebrands the same geometry",
  sibling: { url: MATERIAL_A, relationship: "sibling_material_variation" },
}) + `
IMAGE DESCRIPTION

A staircase render used as the SECOND of a paired sibling set. Same layout · geometry · proportions · camera angle · room composition as the paired variation image. Material treatment B applied — finish/species/balustrade combination that establishes an alternative interpretation of the identical foundation. Used in the customer-education article "Choosing the Right Staircase Is Only 60% of the Journey" as the direct comparison to variation A.

Paired with variation A (same layout, alternative material treatment). The two images are sibling material variations under Rule #14 family_tree — no parent, no child, just two equally valid interpretations of the same conceptual staircase.

OBJECT DETECTION

PRIMARY OBJECTS
- Complete staircase in interior context
- Balustrade
- Handrail
- Newel post
- Treads and risers
- Surrounding interior finishes

SECONDARY OBJECTS
- Flooring
- Wall finish
- Ambient lighting
- Decor elements

BACKGROUND OBJECTS
- Hallway / entrance context

MATERIAL ANALYSIS

Primary Material:
Timber staircase with material treatment B

Style Note:
Directly contrasts variation A to prove the 60/40 design philosophy: identical geometry can carry two different design personalities depending on material and finish choice.

CAMERA INFORMATION

Image Orientation:
Portrait

Camera Position:
Eye Level

View:
Straight-on interior reference view (matched to variation A for direct comparison)

Composition:
Interior architectural composition

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
Residential hallway / entrance context

AI REPRODUCTION RULES

MUST KEEP
- Identical geometry and proportions as sibling variation A
- Same layout / camera / composition (only material changes across the pair)
- Photorealistic interior visualisation quality
- Sense that this is one of two equally valid material interpretations of the same design

DO NOT CHANGE
- Sibling-pair relationship — never orphan this image from variation A
- Geometry of the staircase (change ONLY finish / species / balustrade / decor)

ALLOWED MODIFICATIONS
Users may change:
- Wall colour
- Flooring
- Lighting treatment
- Decor accessories

MASTER AI PROMPT

Ultra photorealistic architectural interior render of a residential staircase in its full room context — material treatment B of a paired sibling set. Identical geometry / proportions / camera / composition to sibling variation A. The material palette (timber species · finish · balustrade metallurgy / glazing · decorative details) is the subject: this variation demonstrates the alternative design personality on top of the shared foundation. Warm interior ambient lighting · realistic shadows · premium interior visualisation · designed for direct side-by-side comparison with variation A in the "60% Journey" education article.`;

const playhouse_desc = baseFrame({
  name: "Under-Stair Children's Playhouse",
  category: "Under-Stair Ideas > Children's Playhouse",
  sub: "Bespoke cottage-style hideaway integrated into the staircase",
  article: ART_PLAY,
  primary_role: "EDUCATIONAL — inspiration for transforming under-stair space into a child's playhouse",
}) + `
IMAGE DESCRIPTION

An under-stair space transformed into a bespoke children's playhouse. Combines a small timber door, cottage-style windows, soft ambient lighting, and child-friendly finishes integrated into the staircase geometry. Used in the customer-education article "Under-Stair Children's Playhouse Ideas" as the primary reference image demonstrating the design pattern.

OBJECT DETECTION

PRIMARY OBJECTS
- Under-stair playhouse structure
- Timber door
- Cottage-style windows
- Interior finishes
- Soft ambient lighting
- Staircase geometry above

SECONDARY OBJECTS
- Decorative elements
- Shelving / interior styling
- Flooring or rug

BACKGROUND OBJECTS
- Adjacent hallway or living context

MATERIAL ANALYSIS

Primary Material:
Timber (matched to staircase) with painted feature elements

CAMERA INFORMATION

Image Orientation:
Portrait

Camera Position:
Eye Level

View:
Interior architectural feature view

Composition:
Focused feature composition on the playhouse element

LIGHTING

Primary Lighting:
Warm interior ambient light with soft internal LED glow

QUALITY

Realism:
Ultra photorealistic

Rendering:
Architectural interior visualisation

SETTING

Primary Setting:
Under-stair area in a family home

AI REPRODUCTION RULES

MUST KEEP
- Recognisable under-stair playhouse feature
- Child-friendly proportions
- Warm inviting atmosphere
- Integration with the staircase geometry

DO NOT CHANGE
- Educational purpose
- Warmth of styling

ALLOWED MODIFICATIONS
Users may change:
- Staircase style above
- Door style
- Window shape
- Interior decor palette

MASTER AI PROMPT

Ultra photorealistic interior architectural render of a bespoke under-stair children's playhouse — small timber door · cottage-style windows · soft warm interior LED lighting · child-friendly finishes · seamlessly integrated into the staircase geometry above. Warm inviting atmosphere · realistic materials · premium interior visualisation. Used as the primary reference for the "Under-Stair Children's Playhouse Ideas" education article.`;

const office_desc = baseFrame({
  name: "Under-Stair Home Office",
  category: "Under-Stair Ideas > Home Office",
  sub: "Bespoke built-in workspace beneath the staircase",
  article: ART_OFF,
  primary_role: "EDUCATIONAL — inspiration for transforming under-stair space into a productive home office",
}) + `
IMAGE DESCRIPTION

An under-stair space transformed into a compact bespoke home office. Combines a built-in desk, floating shelves, drawer storage, cable management, task lighting, and integrated cabinetry that follows the staircase geometry. Used in the customer-education article "Create a Home Office Under Your Staircase" as the primary reference image demonstrating the design pattern.

OBJECT DETECTION

PRIMARY OBJECTS
- Built-in desk
- Floating shelves
- Drawer storage
- Cabinetry following stair geometry
- Task lighting
- Charging / cable management

SECONDARY OBJECTS
- Office chair
- Monitor / laptop
- Books / decor accessories

BACKGROUND OBJECTS
- Adjacent hallway or living context

MATERIAL ANALYSIS

Primary Material:
Timber cabinetry (coordinated with staircase) with painted or matte finish accents

CAMERA INFORMATION

Image Orientation:
Portrait

Camera Position:
Eye Level

View:
Interior architectural feature view

Composition:
Focused feature composition on the office nook

LIGHTING

Primary Lighting:
Warm interior ambient light with LED task lighting

QUALITY

Realism:
Ultra photorealistic

Rendering:
Architectural interior visualisation

SETTING

Primary Setting:
Under-stair area in a modern home

AI REPRODUCTION RULES

MUST KEEP
- Bespoke built-in workspace that follows the staircase geometry
- Practical office essentials (desk, storage, lighting, cable management)
- Clean integrated appearance
- Sense that the space was purpose-built rather than added afterwards

DO NOT CHANGE
- Educational purpose
- Productive workspace framing

ALLOWED MODIFICATIONS
Users may change:
- Cabinetry finish / colour
- Staircase style above
- Decor accessories

MASTER AI PROMPT

Ultra photorealistic interior architectural render of a bespoke under-stair home office — built-in desk · floating shelves · drawer storage · cable management · warm LED task lighting · cabinetry that follows the staircase geometry above · clean integrated appearance · premium interior visualisation. Used as the primary reference for the "Create a Home Office Under Your Staircase" education article.`;

const panels_desc = baseFrame({
  name: "Under-Stair Wide Feature Panels with Circular Display Windows",
  category: "Under-Stair Ideas > Wide Feature Panels",
  sub: "Architectural wall-panel treatment with recessed circular display niches",
  article: ART_PAN,
  primary_role: "EDUCATIONAL — inspiration for treating under-stair space as an architectural feature wall rather than storage",
}) + `
IMAGE DESCRIPTION

An under-stair space transformed into an architectural feature wall using wide continuous panels punctuated by small circular display windows. Each recess softly lit with LED to highlight displayed items (books · ornaments · sculptures · plants). Used in the customer-education article "Wide Feature Panels Under Your Staircase" as the primary reference image demonstrating the design pattern.

OBJECT DETECTION

PRIMARY OBJECTS
- Wide wall panels beneath staircase
- Circular display recesses
- Displayed ornaments / books / objects
- Integrated LED recess lighting
- Staircase geometry above

SECONDARY OBJECTS
- Skirting / trim
- Adjacent flooring

BACKGROUND OBJECTS
- Hallway or living context

MATERIAL ANALYSIS

Primary Material:
Panel finish (oak / walnut / mahogany / painted / matte / textured decorative panel) coordinated with the staircase

CAMERA INFORMATION

Image Orientation:
Portrait

Camera Position:
Eye Level

View:
Interior architectural feature view

Composition:
Symmetrical or rhythmic composition emphasising the panel rhythm and circular window pattern

LIGHTING

Primary Lighting:
Warm interior ambient light with focused LED recess accents

QUALITY

Realism:
Ultra photorealistic

Rendering:
Architectural interior visualisation

SETTING

Primary Setting:
Under-stair area in a contemporary home

AI REPRODUCTION RULES

MUST KEEP
- Wide continuous panels as the primary treatment (not cupboard fronts)
- Circular display windows as the signature architectural element
- LED-lit recesses highlighting displayed items
- Coordinated appearance with the staircase above

DO NOT CHANGE
- Educational purpose
- Architectural-feature framing (never revert this to storage cupboards)

ALLOWED MODIFICATIONS
Users may change:
- Panel finish and colour
- Number and arrangement of circular windows
- Displayed items
- Staircase style above

MASTER AI PROMPT

Ultra photorealistic interior architectural render of a wide-feature-panel under-stair treatment — continuous wall panels punctuated by small circular display windows · each recess softly lit with warm LED · displayed items include books · ornaments · sculptures · plants · panels coordinated with the staircase geometry above · clean modern architectural appearance · no cupboard fronts · pure feature-wall treatment · premium interior visualisation. Used as the primary reference for the "Wide Feature Panels Under Your Staircase" education article.`;

const seating_desc = baseFrame({
  name: "Under-Stair Built-In Seating Area",
  category: "Under-Stair Ideas > Seating Area",
  sub: "Bespoke built-in bench following the staircase geometry",
  article: ART_SEAT,
  primary_role: "EDUCATIONAL — inspiration for transforming under-stair space into a comfortable built-in seating feature",
}) + `
IMAGE DESCRIPTION

An under-stair space transformed into a bespoke built-in seating area. Combines a bench that follows the staircase geometry, hidden storage beneath, upholstered cushions, decorative styling, and warm ambient lighting. Used in the customer-education article "Create a Relaxing Seating Area Under Your Staircase" as the primary reference image demonstrating the design pattern.

OBJECT DETECTION

PRIMARY OBJECTS
- Built-in bench following stair geometry
- Upholstered seat cushions
- Hidden storage beneath bench
- Decorative styling (cushions · throws · shelving · art)
- Staircase geometry above

SECONDARY OBJECTS
- Side tables or floating shelves
- Coat hooks (entrance-hall variant)
- Books / plants / accessories

BACKGROUND OBJECTS
- Adjacent hallway or living context

MATERIAL ANALYSIS

Primary Material:
Timber bench (coordinated with staircase) with upholstered soft finish + decorative accents

CAMERA INFORMATION

Image Orientation:
Portrait

Camera Position:
Eye Level

View:
Interior architectural feature view

Composition:
Comfortable feature composition focused on the seating nook

LIGHTING

Primary Lighting:
Warm interior ambient light with soft feature lighting

QUALITY

Realism:
Ultra photorealistic

Rendering:
Architectural interior visualisation

SETTING

Primary Setting:
Under-stair area in a family home

AI REPRODUCTION RULES

MUST KEEP
- Built-in bench following the staircase geometry
- Upholstered seating comfort
- Warm inviting styling
- Sense that the space was purpose-built rather than added afterwards

DO NOT CHANGE
- Educational purpose
- Warm inviting tone

ALLOWED MODIFICATIONS
Users may change:
- Timber species / finish
- Upholstery colour and pattern
- Decorative accessories
- Staircase style above

MASTER AI PROMPT

Ultra photorealistic interior architectural render of a bespoke under-stair built-in seating area — bench following the staircase geometry above · upholstered cushions · hidden storage beneath · warm decorative styling (cushions · throws · art · plants) · warm interior ambient light with soft feature accents · premium interior visualisation. Used as the primary reference for the "Create a Relaxing Seating Area Under Your Staircase" education article.`;

// -----------------------------------------------------------
// Save runner
// -----------------------------------------------------------

async function save(url, description, notes) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      images: {
        [url]: {
          description,
          source: "ai_generated",
          created_by: "philip",
          notes,
        },
      },
    }),
  });
  return await res.json();
}

async function main() {
  console.log("NEX Education Batch 2 — 6 images\n==================================\n");
  const rows = [
    { url: MATERIAL_A, desc: material_a_desc, notes: "60% Journey · sibling material variation A · paired with " + MATERIAL_B, label: "material_variation_a" },
    { url: MATERIAL_B, desc: material_b_desc, notes: "60% Journey · sibling material variation B · paired with " + MATERIAL_A, label: "material_variation_b" },
    { url: PLAYHOUSE,  desc: playhouse_desc, notes: "Under-stair children's playhouse · primary reference for education article", label: "playhouse" },
    { url: OFFICE,     desc: office_desc,    notes: "Under-stair home office · primary reference for education article",       label: "office" },
    { url: PANELS,     desc: panels_desc,    notes: "Under-stair wide feature panels with circular display windows · primary reference for education article", label: "panels" },
    { url: SEATING,    desc: seating_desc,   notes: "Under-stair built-in seating area · primary reference for education article", label: "seating" },
  ];

  for (const r of rows) {
    const res = await save(r.url, r.desc, r.notes);
    console.log(r.label.padEnd(22), res.ok ? "SAVED" : `ERROR: ${res.error}`);
  }

  console.log("\nWiring sibling_material_variation relationship (A ↔ B)…");
  const manifestPath = path.join(process.cwd(), "data", "nex-image-manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const a = manifest.images[MATERIAL_A];
  const b = manifest.images[MATERIAL_B];
  if (a && b) {
    a.family_tree = a.family_tree || { parent_url: undefined, children: [] };
    b.family_tree = b.family_tree || { parent_url: undefined, children: [] };
    const stampA = {
      type: "sibling_material_variation",
      url: MATERIAL_B,
      generated_at: new Date().toISOString(),
      generated_by: "philip",
      notes: "Sibling material variation B · same geometry / camera / composition · different material treatment",
    };
    const stampB = {
      type: "sibling_material_variation",
      url: MATERIAL_A,
      generated_at: new Date().toISOString(),
      generated_by: "philip",
      notes: "Sibling material variation A · same geometry / camera / composition · different material treatment",
    };
    if (!a.family_tree.children.some((c) => c.url === MATERIAL_B)) a.family_tree.children.push(stampA);
    if (!b.family_tree.children.some((c) => c.url === MATERIAL_A)) b.family_tree.children.push(stampB);
    manifest.generated_at = new Date().toISOString();
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
    console.log("  ✓ Variation A knows about Variation B");
    console.log("  ✓ Variation B knows about Variation A");
  }

  console.log("\nFinal row states:");
  for (const r of rows) {
    const row = manifest.images[r.url];
    if (row) {
      console.log(
        "  " + r.label.padEnd(22),
        "score:", String(row.master_image_score?.master_score ?? "?").padStart(3),
        "· band:", (row.knowledge_band_label ?? "?").padEnd(22),
        "· brain:", (row.primary_brain ?? "?").padEnd(18),
        "· collections:", (row.collection_memberships || []).length
      );
    }
  }
  console.log("\nBatch complete.");
}

main().catch((e) => { console.error(e); process.exit(1); });
